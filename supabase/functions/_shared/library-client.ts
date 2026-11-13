import got from 'npm:got@14';
import { CookieJar } from 'npm:tough-cookie@5';
const TERM_MIN = 30;
const BASE_URL = 'https://library.daejin.ac.kr';
const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));
const plus30 = (t)=>{
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m + TERM_MIN, 0, 0);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};
const pastToday = (t)=>{
  const now = new Date();
  const [h, m] = t.split(':').map(Number);
  return h < now.getHours() || h === now.getHours() && m <= now.getMinutes();
};
export class LibraryAPIClient {
  client;
  cookieJar;
  constructor(){
    this.cookieJar = new CookieJar();
    this.client = got.extend({
      prefixUrl: BASE_URL,
      cookieJar: this.cookieJar,
      timeout: {
        request: 25000
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      followRedirect: true,
      maxRedirects: 20
    });
  }
  async login(userId, userPw) {
    console.log('[로그인] 시작');
    try {
      await this.client.get('home_login_write.mir');
      await sleep(300);
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
          'Referer': `${BASE_URL}/home_login_write.mir`
        }
      });
      if (loginResponse.body && loginResponse.body.includes('LOGOUT')) {
        console.log('[로그인] 성공');
        return true;
      }
      await sleep(500);
      const testResponse = await this.client.get('seminar_seminar_list.mir');
      if (testResponse.url && testResponse.url.includes('home_login_write.mir')) {
        console.error('[로그인] 실패');
        return false;
      }
      console.log('[로그인] 세션 확인 완료');
      return true;
    } catch (error) {
      console.error('[로그인] 오류:', error.message);
      return false;
    }
  }
  async crawl(dateStr) {
    console.log(`[크롤링] 시작: ${dateStr}`);
    const startTime = Date.now();
    try {
      const [year, month, day] = dateStr.split('-');
      const nowTime = new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Seoul',
        hour12: false
      });
      const params = new URLSearchParams({
        sloc_code: 'DJUL',
        year,
        month,
        day,
        resv_use_start_datev: dateStr,
        resv_use_end_timev: nowTime,
        holiday_datev: dateStr,
        all_search_yn: 'Y',
        closed_datev: dateStr,
        resv_try_datev: dateStr
      });
      const response = await this.client.post('seminar_seminar_list_inc.mir', {
        body: params.toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      const html = response.body;
      const resvDate = html.match(/data-resv-date="([^"]*)"/)?.[1];
      if (resvDate !== dateStr) {
        console.error(`[크롤링] 요청 날짜 ${dateStr}와 응답 날짜 ${resvDate} 불일치`);
        return [];
      }
      const isToday = dateStr === new Date().toISOString().slice(0, 10);
      const results = html.split('<div class="studyroom_card"').slice(1).map((card)=>{
        const attr = (name: string)=>card.match(new RegExp(`data-${name}="([^"]*)"`))?.[1];
        const starts = [...card.matchAll(/data-start-time="([^"]+)"\s+data-status="AVAILABLE"/g)].map((m)=>m[1]).filter((t)=>!isToday || !pastToday(t));
        return {
          sloc_code: attr('sloc-code'),
          cate_cd: attr('group-code'),
          room_cd: attr('seminar-code'),
          title: attr('seminar-name'),
          times: starts.map((s)=>({
              start: s,
              end: plus30(s)
            }))
        };
      });
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[크롤링] ${results.length}개 방 완료 (${duration}초)`);
      return results;
    } catch (error) {
      console.error('[크롤링] 오류:', error.message);
      return [];
    }
  }
}
