/**
 * Deno/Supabase Edge Functions용 API 크롤러
 * - Deno 네이티브 fetch API 사용
 * - another_cookiejar로 자동 쿠키 관리
 * - Supabase Edge Functions에 배포 가능
 */

import { CookieJar, wrapFetch } from "jsr:@deno/another-cookiejar@5";
import { DOMParser } from "jsr:@b-fuze/deno-dom";

/* ─── 설정 ─── */
const TERM_MIN = 30;
const BASE_URL = 'https://library.daejin.ac.kr';

/* ─── 유틸 함수 ─── */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const plus30 = (t: string): string => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + TERM_MIN, 0, 0);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const pastToday = (t: string): boolean => {
  const now = new Date();
  const [h, m] = t.split(":").map(Number);
  return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
};

/* ─── 타입 정의 ─── */
interface Room {
  sloc_code: string;
  cate_cd: string;
  room_cd: string;
  title: string;
}

interface RoomWithTimes extends Room {
  times: Array<{ start: string; end: string }>;
}

/**
 * Deno 기반 Library API Client
 */
class LibraryAPIClientDeno {
  private baseURL: string;
  private cookieJar: CookieJar;
  private fetch: typeof globalThis.fetch;

  constructor() {
    this.baseURL = BASE_URL;
    this.cookieJar = new CookieJar();

    // fetch를 cookieJar로 래핑 - 자동 쿠키 관리!
    this.fetch = wrapFetch({ cookieJar: this.cookieJar });
  }

  /**
   * 로그인 (Deno fetch 사용)
   */
  async login(userId: string, userPw: string): Promise<boolean> {
    console.log('[API 로그인] 시도...');
    try {
      // 1단계: 로그인 페이지 방문
      console.log('[API 로그인] 로그인 페이지 방문 중...');
      await this.fetch(`${this.baseURL}/home_login_write.mir`);
      await sleep(300);

      // 2단계: 로그인 폼 제출
      console.log('[API 로그인] 로그인 폼 제출 중...');
      const form = new URLSearchParams();
      form.append('home_login_mloc_code', 'DJUL');
      form.append('home_login_id_login01', userId);
      form.append('home_login_password_login01', userPw);
      form.append('login_type', 'portal_member');
      form.append('home_login_mloc_code', 'DJUL');
      form.append('home_login_id_login02', '');
      form.append('home_login_password_login02', '');
      form.append('login_type', 'outsider_member');
      form.append('home_login_id_save_yn', 'N');
      form.append('home_login_id', userId);
      form.append('home_login_password', userPw);
      form.append('login_type', '');

      const loginResponse = await this.fetch(`${this.baseURL}/home_security_login_write_prss.mir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.baseURL}/home_login_write.mir`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: form.toString(),
        redirect: 'follow',
      });

      const finalUrl = loginResponse.url;
      const html = await loginResponse.text();

      console.log('[API 로그인] 로그인 후 최종 URL:', finalUrl);

      // 로그인 성공 확인 (LOGOUT 버튼 존재 여부)
      if (html.includes('LOGOUT')) {
        console.log('[API 로그인] 성공!');
        return true;
      }

      // 최종 URL이 로그인 페이지이면 실패
      if (finalUrl.includes('home_login_write.mir')) {
        console.error('[API 로그인] 실패: 로그인 후에도 로그인 페이지에 머물러 있습니다.');
        return false;
      }

      await sleep(500);

      // 3단계: 세미나실 목록 페이지로 직접 접근하여 세션 확인
      console.log('[API 로그인] 세션 확인 중...');
      const testResponse = await this.fetch(`${this.baseURL}/seminar_seminar_list.mir`);

      if (testResponse.url.includes('home_login_write.mir')) {
        console.error('[API 로그인] 실패: 세미나실 페이지 접근 시 로그인 페이지로 리다이렉트됨');
        return false;
      }

      console.log('[API 로그인] 세션 확인 완료!');
      return true;

    } catch (error) {
      console.error('[API 로그인] 실패:', error.message);
      return false;
    }
  }

  /**
   * 세미나실 목록 조회 (HTML 파싱)
   */
  async getSeminarList(_dateStr: string): Promise<Room[]> {
    console.log(`[API 세미나실 목록] 조회 시작`);
    try {
      const response = await this.fetch(`${this.baseURL}/seminar_seminar_list.mir`);
      const html = await response.text();

      // HTML 파싱 (Deno용 DOMParser 사용)
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc) {
        console.error('[API 세미나실 목록] HTML 파싱 실패');
        return [];
      }

      const rooms: Room[] = [];

      // 세미나실 링크 찾기
      const links = doc.querySelectorAll('a[onclick*="seminar_resv"]');

      links.forEach((elem) => {
        const onclick = elem.getAttribute('onclick');
        const text = elem.textContent?.trim() || '';

        if (onclick) {
          // onclick="seminar_resv('seminar_resv.mir', 'SWON', 'SEMINAR', 'SWON_SEMINAR_01', ...)"
          const matches = onclick.match(/seminar_resv\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/);

          if (matches && matches.length >= 5) {
            rooms.push({
              sloc_code: matches[2],
              cate_cd: matches[3],
              room_cd: matches[4],
              title: text,
            });
          }
        }
      });

      console.log(`[API 세미나실 목록] ${rooms.length}개 방 발견`);
      return rooms;
    } catch (error) {
      console.error('[API 세미나실 목록] 실패:', error.message);
      return [];
    }
  }

  /**
   * 특정 세미나실의 예약 가능 시간 조회
   */
  async getAvailableTimes(room: Room, dateStr: string): Promise<RoomWithTimes> {
    const startTime = Date.now();
    console.log(`[API 시간 조회] 방: ${room.title} (${room.room_cd})`);

    try {
      const [year, month, day] = dateStr.split('-');

      const params = new URLSearchParams();
      params.append('sloc_code', room.sloc_code);
      params.append('group_code', room.cate_cd);
      params.append('seminar_code', room.room_cd);
      params.append('resv_datev', dateStr);
      params.append('seminar_name', room.title);
      params.append('year', year);
      params.append('month', month);
      params.append('day', day);

      const response = await this.fetch(`${this.baseURL}/seminar_resv.mir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const html = await response.text();

      // HTML 파싱하여 시작 시간 옵션 추출
      const doc = new DOMParser().parseFromString(html, 'text/html');
      if (!doc) {
        throw new Error('HTML 파싱 실패');
      }

      let starts: string[] = [];
      const options = doc.querySelectorAll('#start_time option');

      options.forEach((elem) => {
        const time = elem.textContent?.trim() || '';
        // 시간 형식인지 확인 (HH:MM)
        if (/^\d{1,2}:\d{2}$/.test(time)) {
          starts.push(time);
        }
      });

      // 오늘 날짜인 경우 과거 시간 필터링
      const TODAY = new Date().toISOString().slice(0, 10);
      if (dateStr === TODAY) {
        starts = starts.filter((t) => !pastToday(t));
      }

      const times = starts.map((s) => ({ start: s, end: plus30(s) }));

      const duration = (Date.now() - startTime) / 1000;
      console.log(`[API 시간 조회] 완료: ${room.title}, ${times.length}개 시간대 (${duration.toFixed(1)}초)`);

      return { ...room, times };
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      console.error(`[API 시간 조회] 실패: ${room.title} (${duration.toFixed(1)}초)`, error.message);
      return { ...room, times: [] };
    }
  }

  /**
   * 메인 크롤링 함수
   */
  async crawl(dateStr: string): Promise<RoomWithTimes[]> {
    console.log(`🚀 [API 크롤] 시작: ${dateStr}`);
    const overallStartTime = Date.now();

    try {
      // 1. 세미나실 목록 조회
      const rooms = await this.getSeminarList(dateStr);

      if (rooms.length === 0) {
        console.log('[API 크롤] 예약 가능한 방이 없습니다.');
        return [];
      }

      console.log(`[API 크롤] ${rooms.length}개 방 병렬 조회 시작...`);

      // 2. 각 방의 시간 정보 병렬 조회
      const results = await Promise.all(
        rooms.map(room => this.getAvailableTimes(room, dateStr))
      );

      const successfulResults = results.filter(r => r.times && r.times.length >= 0);
      const duration = (Date.now() - overallStartTime) / 1000;

      console.log(`✅ [API 크롤] 완료: ${successfulResults.length}개 방 정보 수집 (${duration.toFixed(1)}초 소요)`);

      return successfulResults;
    } catch (error) {
      const duration = (Date.now() - overallStartTime) / 1000;
      console.error(`❌ [API 크롤] 실패 (${duration.toFixed(1)}초 소요):`, error.message);
      return [];
    }
  }
}

/* ─── Supabase Edge Function용 Export ─── */

/**
 * Supabase Edge Function 핸들러
 */
export async function handler(req: Request): Promise<Response> {
  try {
    // CORS 헤더
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // 요청 파라미터 파싱
    const { date, userId, userPw } = await req.json();

    if (!userId || !userPw) {
      return new Response(
        JSON.stringify({ error: 'userId와 userPw가 필요합니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dateStr = date || new Date().toISOString().slice(0, 10);

    // API 크롤러 초기화 및 실행
    const client = new LibraryAPIClientDeno();

    // 로그인
    const loginSuccess = await client.login(userId, userPw);
    if (!loginSuccess) {
      return new Response(
        JSON.stringify({ error: '로그인 실패' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 크롤링
    const results = await client.crawl(dateStr);

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        rooms: results,
        count: results.length,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/* ─── 로컬 테스트용 (Deno 직접 실행) ─── */
if (import.meta.main) {
  console.log('🚀 Deno 로컬 테스트 시작...\n');

  // 환경 변수 로드 (또는 직접 입력)
  const userId = Deno.env.get('USER_ID') || '20241476';
  const userPw = Deno.env.get('USER_PW') || 'kdhkdh0723';
  const dateStr = Deno.args[0] || new Date().toISOString().slice(0, 10);

  const client = new LibraryAPIClientDeno();

  // 로그인
  const loginSuccess = await client.login(userId, userPw);
  if (!loginSuccess) {
    console.error('❌ 로그인 실패');
    Deno.exit(1);
  }

  // 크롤링
  const results = await client.crawl(dateStr);

  console.log('\n📊 결과:');
  console.log(`총 ${results.length}개 방`);
  results.forEach(room => {
    console.log(`\n${room.title}: ${room.times.length}개 시간대`);
    if (room.times.length > 0) {
      console.log(`  예시: ${room.times[0].start} - ${room.times[0].end}`);
    }
  });
}
