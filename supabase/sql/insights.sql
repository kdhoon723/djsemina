-- ============================================================================
-- 이용 인사이트 백엔드 (Supabase 프로젝트 YOUR_PROJECT_REF 에 배포됨)
--
-- 설계: 무거운 "진짜 예약" 계산(스냅샷 비교)은 DB에서 1회 수행해 작은 fact
-- 테이블에 캐시하고, 프론트(/insights)는 압축 JSON 1건만 받아 브라우저에서
-- 모든 통계를 즉석 집계/탐색한다.
--
-- 핵심 정의(타임존 보정): 슬롯 start 시각은 KST. 어떤 슬롯이 "예약됨"이라는 건
-- 그 슬롯의 KST 시작 시각 '이전'에 가용 목록에서 사라진 경우만 카운트한다.
-- (시간이 지나 마감된 슬롯은 예약이 아니므로 제외 — fetched_at < slot_dt 보장)
-- ============================================================================

-- 날짜 범위로 (날짜×방) 단위 비트마스크 fact 계산
create or replace function public.get_room_booking_facts_range(p_start date, p_end date)
returns table(d date, cate text, title text, bookable int, booked int, advance int)
language sql security definer stable set search_path = public as $fn$
with src as (
  select date, fetched_at, rooms from seminar_room_snapshots
  where date between p_start and p_end
),
obs as (
  select s.date, s.fetched_at, r->>'cate_cd' cate, r->>'title' title,
    ((extract(hour from (t->>'start')::time)::int*60
      + extract(minute from (t->>'start')::time)::int - 540)/30) slotidx,   -- 0=09:00 .. 22=20:00
    ((s.date + (t->>'start')::time) at time zone 'Asia/Seoul') slot_dt        -- KST 보정
  from src s
   cross join lateral jsonb_array_elements(s.rooms) r
   cross join lateral jsonb_array_elements(coalesce(r->'times','[]'::jsonb)) t
  where (t->>'start') ~ '^[0-9]{1,2}:[0-9]{2}$'
),
fut as (  -- 슬롯이 아직 미래(=진짜 예약 가능)일 때의 관측만
  select date, fetched_at, cate, title, slotidx, slot_dt
  from obs where fetched_at < slot_dt and slotidx between 0 and 22
),
perslot as (
  select date, cate, title, slotidx, min(slot_dt) slot_dt, max(fetched_at) last_avail
  from fut group by date, cate, title, slotidx
),
deadline as (  -- 슬롯 시작 직전 마지막 크롤 시각
  select p.date, p.cate, p.title, p.slotidx, p.last_avail, max(x.fetched_at) dl
  from perslot p join src x on x.date = p.date and x.fetched_at < p.slot_dt
  group by p.date, p.cate, p.title, p.slotidx, p.last_avail
)
select date d, cate, title,
  sum(1<<slotidx)::int as bookable,                                          -- 가용했던 슬롯
  sum(case when last_avail < dl then 1<<slotidx else 0 end)::int as booked,  -- 시작 전 사라짐 = 예약
  sum(case when last_avail < dl and last_avail < (date::timestamp at time zone 'Asia/Seoul')
        then 1<<slotidx else 0 end)::int as advance                          -- 예약일 시작 전(전날까지) 예약
from deadline group by date, cate, title;
$fn$;

-- 최근 N일 편의 래퍼
create or replace function public.get_room_booking_facts(p_days int default 120)
returns table(d date, cate text, title text, bookable int, booked int, advance int)
language sql security definer stable set search_path = public as $w$
  select * from public.get_room_booking_facts_range(
    current_date - least(greatest(coalesce(p_days,120),1),400), current_date);
$w$;

-- 캐시 테이블 (프론트는 이걸 읽음)
create table if not exists public.library_booking_facts (
  d date not null, cate text, title text not null,
  bookable int not null default 0, booked int not null default 0, advance int not null default 0,
  primary key (d, title)
);
alter table public.library_booking_facts enable row level security;
drop policy if exists "public read facts" on public.library_booking_facts;
create policy "public read facts" on public.library_booking_facts for select to anon, authenticated using (true);
grant select on public.library_booking_facts to anon, authenticated;

-- 갱신: 최근 p_days + 미래 2일 재계산 후 upsert (cron 컨텍스트라 statement timeout 없음)
create or replace function public.refresh_library_booking_facts(p_days int default 12)
returns int language plpgsql security definer set search_path = public as $rf$
declare n int; lo date;
begin
  lo := current_date - least(greatest(coalesce(p_days,12),1),400);
  delete from public.library_booking_facts where d >= lo;
  insert into public.library_booking_facts (d,cate,title,bookable,booked,advance)
  select d,cate,title,bookable,booked,advance from public.get_room_booking_facts_range(lo, current_date + 2)
  on conflict (d,title) do update
    set cate=excluded.cate, bookable=excluded.bookable, booked=excluded.booked, advance=excluded.advance;
  get diagnostics n = row_count; return n;
end $rf$;

-- 프론트가 호출하는 압축 JSON (캐시 테이블만 읽어 빠름, 1행이라 PostgREST 1000행 제한 회피)
create or replace function public.get_booking_facts_json()
returns jsonb language sql security definer stable set search_path = public as $j$
  select jsonb_build_object(
    'updated_at', now(),
    'slots', (select jsonb_agg(to_char((time '09:00' + (g*interval '30 min')),'HH24:MI')) from generate_series(0,22) g),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(
              to_char(d,'YYYY-MM-DD'), cate, title, bookable, booked, advance) order by d,title)
              from public.library_booking_facts), '[]'::jsonb)
  );
$j$;
grant execute on function public.get_room_booking_facts_range(date,date) to anon, authenticated;
grant execute on function public.get_room_booking_facts(int) to anon, authenticated;
grant execute on function public.get_booking_facts_json() to anon, authenticated;

-- 자동 갱신: 6시간마다 최근 12일 + 미래 2일 재계산
-- select cron.schedule('refresh-library-facts','0 */6 * * *', $$select public.refresh_library_booking_facts(12)$$);

-- 최초 백필(월 단위로 쪼개 실행):
-- select public.get_room_booking_facts_range('2025-10-01','2025-10-31'); ... 등으로 insert

-- ============================================================================
-- 예약행동 통계 (5분 간격 스냅샷 차분 기반) — needs-raw-compute
-- 인접 스냅샷에서 한 방에 동시에 사라진(예약된) 슬롯 묶음 = 1회 예약(burst).
-- gone_at = last_avail 직후 첫 크롤 시각(slot_dt 이전이어야 진짜 예약).
-- 시스템 1인 1일 3시간(6슬롯) 제한이 데이터에 보임(≤6슬롯 98%).
-- 무거우므로 캐시 테이블에 단일행 jsonb로 저장, 프론트는 작은 JSON 1건만 읽음.
-- ============================================================================

-- 캐시 테이블 (단일행, id=1 고정)
create table if not exists public.library_behavior_stats (
  id int primary key default 1,
  computed_at timestamptz, window_days int, payload jsonb,
  constraint one_row check (id = 1)
);
alter table public.library_behavior_stats enable row level security;
drop policy if exists "public read behavior" on public.library_behavior_stats;
create policy "public read behavior" on public.library_behavior_stats for select to anon, authenticated using (true);
grant select on public.library_behavior_stats to anon, authenticated;

-- 갱신: 최근 p_days 스냅샷 차분 → burst/예약시각/리드타임/구분별 집계 → 단일행 upsert
create or replace function public.refresh_behavior_stats(p_days integer default 45)
returns integer language plpgsql security definer set search_path = public as $function$
declare pl jsonb; n int;
begin
  create temp table _ev on commit drop as
  with src as (select date, fetched_at, rooms from seminar_room_snapshots
               where date >= current_date - least(greatest(coalesce(p_days,45),1),120)),
  obs as (
    select s.date, s.fetched_at, r->>'cate_cd' cate, r->>'title' room, t->>'start' st,
      ((s.date + (t->>'start')::time) at time zone 'Asia/Seoul') slot_dt
    from src s cross join lateral jsonb_array_elements(s.rooms) r
     cross join lateral jsonb_array_elements(coalesce(r->'times','[]'::jsonb)) t
    where (t->>'start') ~ '^[0-9]{1,2}:[0-9]{2}$'),
  perslot as (select date, cate, room, st, min(slot_dt) slot_dt, max(fetched_at) last_avail
    from obs where fetched_at < slot_dt group by date, cate, room, st),
  gone as (select p.date,p.cate,p.room,p.slot_dt,
      (select min(x.fetched_at) from src x where x.date=p.date and x.fetched_at>p.last_avail) gone_at
    from perslot p)
  select date,cate,room,slot_dt,gone_at from gone where gone_at is not null and gone_at < slot_dt;

  -- 동시에 사라진 슬롯 묶음 = 1회 예약(burst)
  create temp table _burst on commit drop as
  select date, cate, room, gone_at, count(*) sz, min(slot_dt) first_slot
  from _ev group by date, cate, room, gone_at;

  pl := jsonb_build_object(
    'burst', (select coalesce(jsonb_agg(jsonb_build_array(k,c) order by k),'[]') from
      (select least(sz,7) k, count(*) c from _burst group by least(sz,7)) q),
    'bookingByHour', (select coalesce(jsonb_agg(jsonb_build_array(h,c) order by h),'[]') from
      (select extract(hour from gone_at at time zone 'Asia/Seoul')::int h, count(*) c from _burst group by 1) q),
    'leadtime', (select coalesce(jsonb_agg(jsonb_build_array(label,c) order by ord),'[]') from
      (select case bk when 0 then '0-1h' when 1 then '1-3h' when 2 then '3-6h' when 3 then '6-12h'
                       when 4 then '12-24h' when 5 then '1-2일' else '2일+' end label, bk ord, count(*) c
       from (select width_bucket(extract(epoch from (first_slot-gone_at))/3600, array[1,3,6,12,24,48]) bk from _burst) y
       group by bk) q),
    'byCate', (select coalesce(jsonb_object_agg(cate, a),'{}') from
      (select cate, jsonb_build_object('bookings',count(*),'avgSlots',round(avg(sz),2)) a from _burst group by cate) q),
    'avgSlots', (select round(avg(sz),2) from _burst),
    'capCompliancePct', (select round(100.0*count(*) filter (where sz<=6)/nullif(count(*),0),1) from _burst),
    'totalBookings', (select count(*) from _burst)
  );
  insert into public.library_behavior_stats(id,computed_at,window_days,payload)
  values (1, now(), p_days, pl)
  on conflict (id) do update set computed_at=excluded.computed_at, window_days=excluded.window_days, payload=excluded.payload;
  get diagnostics n = row_count; return (select count(*) from _burst);
end $function$;

-- 프론트가 읽는 단일행 JSON (anon)
create or replace function public.get_behavior_stats_json()
returns jsonb language sql stable security definer set search_path = public as $function$
  select jsonb_build_object('computed_at',computed_at,'window_days',window_days,'payload',payload)
  from public.library_behavior_stats where id=1;
$function$;
grant execute on function public.refresh_behavior_stats(integer) to anon, authenticated;
grant execute on function public.get_behavior_stats_json() to anon, authenticated;

-- 자동 갱신: 매일 05:30 UTC (cron 컨텍스트는 statement timeout 없어 45일 OK)
-- select cron.schedule('refresh-behavior-stats','30 5 * * *', $$select public.refresh_behavior_stats(45)$$);
-- ⚠️ 최초 백필은 Management API 타임아웃(90s) 때문에 21일 등 작은 window로:
--    select public.refresh_behavior_stats(21);

-- ============================================================================
-- 배포 현황 (Supabase 프로젝트 YOUR_PROJECT_REF, DJBus와 공유)
--   테이블: library_booking_facts(약 4.4k행), library_behavior_stats(단일행)
--   함수: get_room_booking_facts_range/get_room_booking_facts/refresh_library_booking_facts/
--         get_booking_facts_json/refresh_behavior_stats/get_behavior_stats_json
--   cron: #17 refresh-library-facts (0 */6 * * *), #18 refresh-behavior-stats (30 5 * * *)
--   ※ 크롤러(seminar_room_snapshots 적재)는 DJBus 기존 cron #7 library-auto-crawler(*/15)
-- ============================================================================
