/**
 * Supabase Edge Functions용 API 크롤러
 * npm:got + npm:tough-cookie 사용 (Node.js 코드 거의 그대로 이식)
 */

import got from 'npm:got@14';
import { CookieJar } from 'npm:tough-cookie@5';

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
 * API 크롤러 클래스 (got 라이브러리 사용)
 */
class LibraryAPIClient {
  private client: any;
  private cookieJar: any;

  constructor() {
    this.cookieJar = new CookieJar();

    this.client = got.extend({
      prefixUrl: BASE_URL,
      cookieJar: this.cookieJar,
      timeout: { request: 30000 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      followRedirect: true,
      maxRedirects: 20,
    });
  }

  /**
   * 로그인
   */
  async login(userId: string, userPw: string): Promise<boolean> {
    console.log('[API 로그인] 시도...');
    try {
      // 1단계: 로그인 페이지 방문
      await this.client.get('home_login_write.mir');
      await sleep(300);

      // 2단계: 로그인 폼 제출
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

      const loginResponse = await this.client.post('home_security_login_write_prss.mir', {
        body: form.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${BASE_URL}/home_login_write.mir`,
        },
      });

      // 로그인 성공 확인
      if (loginResponse.body && loginResponse.body.includes('LOGOUT')) {
        console.log('[API 로그인] 성공!');
        return true;
      }

      if (loginResponse.url && loginResponse.url.includes('home_login_write.mir')) {
        console.error('[API 로그인] 실패: 로그인 페이지로 돌아옴');
        return false;
      }

      await sleep(500);

      // 3단계: 세션 확인
      const testResponse = await this.client.get('seminar_seminar_list.mir');

      if (testResponse.url && testResponse.url.includes('home_login_write.mir')) {
        console.error('[API 로그인] 실패: 세션 없음');
        return false;
      }

      console.log('[API 로그인] 세션 확인 완료!');
      return true;

    } catch (error: any) {
      console.error('[API 로그인] 실패:', error.message);
      return false;
    }
  }

  /**
   * 세미나실 목록 조회
   */
  async getSeminarList(_dateStr: string): Promise<Room[]> {
    console.log('[API 세미나실 목록] 조회 시작');
    try {
      const response = await this.client.get('seminar_seminar_list.mir');
      const html = response.body;

      // 정규표현식으로 파싱 (cheerio 대신)
      const rooms: Room[] = [];
      const onclickMatches = html.matchAll(/onclick="seminar_resv\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'[^>]+>([^<]+)</g);

      for (const match of onclickMatches) {
        rooms.push({
          sloc_code: match[2],
          cate_cd: match[3],
          room_cd: match[4],
          title: match[5].trim(),
        });
      }

      console.log(`[API 세미나실 목록] ${rooms.length}개 방 발견`);
      return rooms;
    } catch (error: any) {
      console.error('[API 세미나실 목록] 실패:', error.message);
      return [];
    }
  }

  /**
   * 특정 세미나실의 예약 가능 시간 조회
   */
  async getAvailableTimes(room: Room, dateStr: string): Promise<RoomWithTimes> {
    const startTime = Date.now();

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

      const response = await this.client.post('seminar_resv.mir', {
        body: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      // 정규표현식으로 시간 추출
      const timeMatches = response.body.matchAll(/<option[^>]*>(\d{1,2}:\d{2})<\/option>/g);
      let starts = Array.from(timeMatches).map((m: any) => m[1]);

      // 오늘 날짜인 경우 과거 시간 필터링
      const TODAY = new Date().toISOString().slice(0, 10);
      if (dateStr === TODAY) {
        starts = starts.filter((t: string) => !pastToday(t));
      }

      const times = starts.map((s: string) => ({ start: s, end: plus30(s) }));
      const duration = (Date.now() - startTime) / 1000;

      console.log(`[API 시간 조회] ${room.title}: ${times.length}개 (${duration.toFixed(1)}초)`);

      return { ...room, times };
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      console.error(`[API 시간 조회] 실패: ${room.title} (${duration.toFixed(1)}초)`);
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
      const rooms = await this.getSeminarList(dateStr);

      if (rooms.length === 0) {
        console.log('[API 크롤] 예약 가능한 방이 없습니다.');
        return [];
      }

      console.log(`[API 크롤] ${rooms.length}개 방 병렬 조회 시작...`);

      // 병렬 조회
      const results = await Promise.all(
        rooms.map(room => this.getAvailableTimes(room, dateStr))
      );

      const duration = (Date.now() - overallStartTime) / 1000;
      console.log(`✅ [API 크롤] 완료: ${results.length}개 방 (${duration.toFixed(1)}초)`);

      return results;
    } catch (error: any) {
      const duration = (Date.now() - overallStartTime) / 1000;
      console.error(`❌ [API 크롤] 실패 (${duration.toFixed(1)}초):`, error.message);
      return [];
    }
  }
}

/* ─── Supabase Edge Function 핸들러 ─── */

/**
 * Edge Function 핸들러
 */
export async function handler(req: Request): Promise<Response> {
  try {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const { date, userId, userPw } = await req.json();

    if (!userId || !userPw) {
      return new Response(
        JSON.stringify({ error: 'userId와 userPw가 필요합니다' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dateStr = date || new Date().toISOString().slice(0, 10);

    // 크롤러 초기화 및 실행
    const client = new LibraryAPIClient();

    const loginSuccess = await client.login(userId, userPw);
    if (!loginSuccess) {
      return new Response(
        JSON.stringify({ error: '로그인 실패' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = await client.crawl(dateStr);

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        rooms: results,
        count: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
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

/* ─── 로컬 테스트용 ─── */
if (import.meta.main) {
  console.log('🚀 Deno 로컬 테스트 (npm:got 사용)\n');

  const userId = Deno.env.get('USER_ID');
  const userPw = Deno.env.get('USER_PW');
  const dateStr = Deno.args[0] || new Date().toISOString().slice(0, 10);

  const client = new LibraryAPIClient();

  const loginSuccess = await client.login(userId, userPw);
  if (!loginSuccess) {
    console.error('❌ 로그인 실패');
    Deno.exit(1);
  }

  const results = await client.crawl(dateStr);

  console.log('\n📊 결과:');
  console.log(`총 ${results.length}개 방`);
  results.slice(0, 3).forEach(room => {
    console.log(`\n${room.title}: ${room.times.length}개 시간대`);
    if (room.times.length > 0) {
      console.log(`  예시: ${room.times.slice(0, 3).map(t => t.start).join(', ')}...`);
    }
  });

  console.log('\n✅ 크롤링 완료!');
}
