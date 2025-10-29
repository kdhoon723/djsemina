import got from 'got';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
dotenv.config();

/* ─── 설정 ─── */
const TERM_MIN = 30;
const BASE_URL = 'https://library.daejin.ac.kr';

/* ─── 유틸 함수 ─── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plus30 = (t) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + TERM_MIN, 0, 0);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};
const pastToday = (t) => {
  const now = new Date();
  const [h, m] = t.split(":").map(Number);
  return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
};

/**
 * API 기반 크롤러 클래스 (got 라이브러리 사용)
 */
class LibraryAPIClient {
  constructor() {
    this.baseURL = BASE_URL;
    this.cookieJar = new CookieJar();

    this.client = got.extend({
      prefixUrl: this.baseURL,
      cookieJar: this.cookieJar,
      timeout: { request: 30000 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      followRedirect: true,
      maxRedirects: 20,
    });
  }

  /**
   * 로그인 (got 라이브러리 사용)
   */
  async login(userId, userPw) {
    console.log('[API 로그인] 시도...');
    try {
      // 1단계: 로그인 페이지 방문
      console.log('[API 로그인] 로그인 페이지 방문 중...');
      await this.client.get('home_login_write.mir');
      await sleep(300);

      // 2단계: 로그인 폼 제출 (실제 form 필드 순서대로 모두 전송)
      console.log('[API 로그인] 로그인 폼 제출 중...');
      const form = new URLSearchParams();
      form.append('home_login_mloc_code', 'DJUL');
      form.append('home_login_id_login01', userId);
      form.append('home_login_password_login01', userPw);
      form.append('login_type', 'portal_member');
      form.append('home_login_mloc_code', 'DJUL');  // 두 번째
      form.append('home_login_id_login02', '');
      form.append('home_login_password_login02', '');
      form.append('login_type', 'outsider_member');  // 두 번째
      form.append('home_login_id_save_yn', 'N');
      form.append('home_login_id', userId);
      form.append('home_login_password', userPw);
      form.append('login_type', '');  // 세 번째 (빈 값)

      const loginResponse = await this.client.post('home_security_login_write_prss.mir', {
        body: form.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `${this.baseURL}/home_login_write.mir`,
        },
      });

      const finalUrl = loginResponse.url;
      console.log('[API 로그인] 로그인 후 최종 URL:', finalUrl);

      // 로그인 성공 확인 (LOGOUT 버튼 존재 여부)
      if (loginResponse.body && loginResponse.body.includes('LOGOUT')) {
        const cookies = await this.cookieJar.getCookies(this.baseURL);
        console.log(`[API 로그인] 쿠키: ${cookies.map(c => c.key).join(', ')}`);
        console.log('[API 로그인] 성공!');
        return true;
      }

      // 최종 URL이 로그인 페이지이면 실패
      if (finalUrl && finalUrl.includes('home_login_write.mir')) {
        console.error('[API 로그인] 실패: 로그인 후에도 로그인 페이지에 머물러 있습니다.');
        return false;
      }

      await sleep(500);

      // 3단계: 세미나실 목록 페이지로 직접 접근하여 세션 확인
      console.log('[API 로그인] 세션 확인 중...');
      const testResponse = await this.client.get('seminar_seminar_list.mir');

      // 로그인되어 있으면 세미나실 목록이 보임
      if (testResponse.url && testResponse.url.includes('home_login_write.mir')) {
        console.error('[API 로그인] 실패: 세미나실 페이지 접근 시 로그인 페이지로 리다이렉트됨');
        return false;
      }

      console.log('[API 로그인] 세션 확인 완료!');
      return true;

    } catch (error) {
      console.error('[API 로그인] 실패:', error.message);
      if (error.response) {
        console.error('[API 로그인] 응답 상태:', error.response.statusCode);
      }
      return false;
    }
  }

  /**
   * 세미나실 목록 조회
   */
  async getSeminarList(dateStr) {
    console.log(`[API 세미나실 목록] 조회 시작: ${dateStr}`);
    try {
      const response = await this.client.get('seminar_seminar_list.mir');

      // HTML 파싱
      const $ = cheerio.load(response.body);
      const rooms = [];

      // 세미나실 링크 찾기
      $('a[onclick*="seminar_resv"]').each((i, elem) => {
        const onclick = $(elem).attr('onclick');
        const text = $(elem).text().trim();

        if (onclick) {
          // onclick="seminar_resv('seminar_resv.mir', 'SWON', 'SEMINAR', 'SWON_SEMINAR_01', ...)
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
  async getAvailableTimes(room, dateStr) {
    const startTime = Date.now();
    console.log(`[API 시간 조회] 방: ${room.title} (${room.room_cd})`);

    try {
      const [year, month, day] = dateStr.split('-');

      // 세미나실 예약 페이지로 POST 요청
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

      // HTML 파싱하여 시작 시간 옵션 추출
      const $ = cheerio.load(response.body);
      let starts = [];

      $('#start_time option').each((i, elem) => {
        const time = $(elem).text().trim();
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
   * 메인 크롤링 함수 (API 기반)
   */
  async crawl(dateStr) {
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

/* ─── 전역 변수 ─── */
let apiClient = null;

/**
 * API 크롤러 초기화
 */
export async function initializeAPICrawler() {
  if (apiClient) {
    console.log('이미 API 크롤러가 초기화되었습니다.');
    return;
  }

  console.log('🚀 [API 크롤러 초기화] 시작...');

  try {
    apiClient = new LibraryAPIClient();

    // 로그인
    const loginSuccess = await apiClient.login(process.env.USER_ID, process.env.USER_PW);
    if (!loginSuccess) {
      throw new Error('API 크롤러 초기 로그인 실패');
    }

    console.log('✅ [API 크롤러 초기화] 완료');
  } catch (error) {
    console.error('❌ [API 크롤러 초기화] 실패:', error);
    apiClient = null;
    throw error;
  }
}

/**
 * API 기반 크롤링
 */
export async function crawlAPI(dateStr) {
  if (!apiClient) {
    throw new Error('API 크롤러가 초기화되지 않았습니다.');
  }

  return await apiClient.crawl(dateStr);
}

/**
 * API 크롤러 종료
 */
export async function closeAPICrawler() {
  console.log('🚀 [API 크롤러 종료] 시작...');
  apiClient = null;
  console.log('✅ [API 크롤러 종료] 완료');
}
