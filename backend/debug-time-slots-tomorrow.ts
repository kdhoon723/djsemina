/**
 * 내일 날짜로 시간 슬롯 HTML 디버깅
 */

import got from 'npm:got@14';
import { CookieJar } from 'npm:tough-cookie@5';

const BASE_URL = 'https://library.daejin.ac.kr';
const userId = Deno.env.get('USER_ID') || '20241476';
const userPw = Deno.env.get('USER_PW') || 'kdhkdh0723';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const cookieJar = new CookieJar();
const client = got.extend({
  prefixUrl: BASE_URL,
  cookieJar,
  timeout: { request: 30000 },
  headers: { 'User-Agent': 'Mozilla/5.0' },
  followRedirect: true,
  maxRedirects: 20,
});

console.log('[로그인] 시작');

// 로그인
await client.get('home_login_write.mir');
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

await client.post('home_security_login_write_prss.mir', {
  body: form.toString(),
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': `${BASE_URL}/home_login_write.mir`,
  },
});

console.log('[로그인] 완료');
await sleep(500);

// 내일 날짜로 세미나실 시간 조회
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dateStr = tomorrow.toISOString().slice(0, 10);
const [year, month, day] = dateStr.split('-');

console.log(`\n[시간 조회] 날짜: ${dateStr} (내일)`);
console.log('[시간 조회] 캐럴1실 (DJUL, C, C01)');

const params = new URLSearchParams();
params.append('sloc_code', 'DJUL');
params.append('group_code', 'C');
params.append('seminar_code', 'C01');
params.append('resv_datev', dateStr);
params.append('seminar_name', '캐럴1실');
params.append('year', year);
params.append('month', month);
params.append('day', day);

const response = await client.post('seminar_resv.mir', {
  body: params.toString(),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
});

const html = response.body;

console.log('\n[HTML 구조 분석]');
console.log('HTML 길이:', html.length);

// 패턴 1: <option> 태그 with 시간
const pattern1 = /<option[^>]*>(\d{1,2}:\d{2})<\/option>/g;
const matches1 = Array.from(html.matchAll(pattern1));
console.log('\n패턴 1: <option>(시간)</option> 매칭 수:', matches1.length);
if (matches1.length > 0) {
  console.log('첫 10개:');
  matches1.slice(0, 10).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m[1]} (전체: ${m[0]})`);
  });
}

// 패턴 2: 모든 <option> 태그
const pattern2 = /<option[^>]*>([^<]+)<\/option>/g;
const matches2 = Array.from(html.matchAll(pattern2));
console.log('\n패턴 2: 모든 <option> 태그 수:', matches2.length);
if (matches2.length > 0) {
  console.log('처음 15개:');
  matches2.slice(0, 15).forEach((m, i) => {
    console.log(`  ${i + 1}. "${m[1].trim()}"`);
  });
}

// 패턴 3: value 속성이 있는 option
const pattern3 = /<option[^>]*value="([^"]*)"[^>]*>([^<]+)<\/option>/g;
const matches3 = Array.from(html.matchAll(pattern3));
console.log('\n패턴 3: value 속성 있는 <option> 수:', matches3.length);
if (matches3.length > 0) {
  console.log('처음 10개:');
  matches3.slice(0, 10).forEach((m, i) => {
    console.log(`  ${i + 1}. value="${m[1]}" text="${m[2].trim()}"`);
  });
}

// HTML 샘플 저장
const encoder = new TextEncoder();
await Deno.writeFile('debug_time_slots_tomorrow.html', encoder.encode(html));
console.log('\n[저장] debug_time_slots_tomorrow.html');

// select 태그 찾기
const selectMatch = html.match(/<select[^>]*name="start_time"[^>]*>([\s\S]*?)<\/select>/i);
if (selectMatch) {
  console.log('\n[start_time select 블록]:');
  console.log(selectMatch[1].substring(0, 500));
}
