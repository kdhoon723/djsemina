/**
 * HTML 구조 디버깅
 */

import got from 'npm:got@14';
import { CookieJar } from 'npm:tough-cookie@5';

const BASE_URL = 'https://library.daejin.ac.kr';
const userId = Deno.env.get('USER_ID') || '20241476';
const userPw = Deno.env.get('USER_PW') || 'kdhkdh0723';

const cookieJar = new CookieJar();
const client = got.extend({
  prefixUrl: BASE_URL,
  cookieJar,
  timeout: { request: 30000 },
  headers: { 'User-Agent': 'Mozilla/5.0' },
  followRedirect: true,
  maxRedirects: 20,
});

// 로그인
await client.get('home_login_write.mir');
await new Promise(r => setTimeout(r, 300));

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

// 세미나실 목록
const response = await client.get('seminar_seminar_list.mir');
const html = response.body;

// onclick 패턴 찾기
const pattern1 = /onclick="seminar_resv\([^)]+\)"/g;
const matches1 = html.match(pattern1);

console.log('onclick 패턴 매칭 수:', matches1?.length || 0);
if (matches1 && matches1.length > 0) {
  console.log('\n첫 3개 예시:');
  matches1.slice(0, 3).forEach((m, i) => {
    console.log(`${i + 1}. ${m}`);
  });
}

// 더 넓은 컨텍스트로 찾기
const pattern2 = /onclick="seminar_resv\([^)]+\)"[^>]*>([^<]+)</g;
const matches2 = Array.from(html.matchAll(pattern2));

console.log('\n\nonclick + 텍스트 매칭 수:', matches2.length);
if (matches2.length > 0) {
  console.log('\n첫 3개 예시:');
  matches2.slice(0, 3).forEach((m, i) => {
    console.log(`${i + 1}. 제목: "${m[1].trim()}"`);
    console.log(`   전체: ${m[0].substring(0, 100)}...`);
  });
}

// seminar_resv 함수 호출만 찾기 (onclick 없이)
const pattern3 = /seminar_resv\([^)]+\)/g;
const matches3 = html.match(pattern3);
console.log('\n\nseminar_resv 호출 수:', matches3?.length || 0);

// HTML 샘플 저장
const encoder = new TextEncoder();
await Deno.writeFile('debug_seminar_list.html', encoder.encode(html));
console.log('\nHTML 저장 완료: debug_seminar_list.html');
