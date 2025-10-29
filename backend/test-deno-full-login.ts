/**
 * Deno에서 npm:got를 사용한 전체 로그인 테스트
 */

import got from 'got';
import { CookieJar } from 'tough-cookie';

const BASE_URL = 'https://library.daejin.ac.kr';
const userId = Deno.env.get('USER_ID') || '20241476';
const userPw = Deno.env.get('USER_PW') || 'kdhkdh0723';

console.log('=== Deno npm:got 전체 로그인 테스트 ===\n');

const cookieJar = new CookieJar();
const client = got.extend({
  prefixUrl: BASE_URL,
  cookieJar,
  timeout: { request: 30000 },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  followRedirect: true,
  maxRedirects: 20,
});

try {
  // 1단계: 로그인 페이지 방문
  console.log('1. 로그인 페이지 방문...');
  await client.get('home_login_write.mir');
  console.log('✅ 완료\n');

  await new Promise(r => setTimeout(r, 300));

  // 2단계: 로그인 폼 제출
  console.log('2. 로그인 폼 제출...');
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

  const loginResponse = await client.post('home_security_login_write_prss.mir', {
    body: form.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `${BASE_URL}/home_login_write.mir`,
    },
  });

  console.log('✅ 응답 받음');
  console.log('   최종 URL:', loginResponse.url);
  console.log('   응답 크기:', loginResponse.body.length);
  console.log('   LOGOUT 버튼:', loginResponse.body.includes('LOGOUT') ? '✅ 있음' : '❌ 없음');
  console.log();

  // 3단계: 세미나실 페이지 접근
  console.log('3. 세미나실 목록 페이지 접근...');
  const listResponse = await client.get('seminar_seminar_list.mir');

  console.log('✅ 응답 받음');
  console.log('   최종 URL:', listResponse.url);
  console.log('   응답 크기:', listResponse.body.length);

  // 간단한 HTML 파싱 (정규표현식)
  const roomMatches = listResponse.body.match(/seminar_resv\([^)]+\)/g);
  const roomCount = roomMatches ? roomMatches.length : 0;

  console.log('   발견된 세미나실:', roomCount, '개');
  console.log();

  if (roomCount > 0) {
    console.log('🎉 성공! Deno에서 npm:got + npm:tough-cookie 완벽 작동!');
    console.log('\n결론:');
    console.log('  ✅ Node.js 라이브러리(got + tough-cookie)를 Deno에서 그대로 사용 가능!');
    console.log('  ✅ Supabase Edge Functions에서도 사용 가능!');
    console.log('  ✅ 기존 api-crawler.js 코드를 거의 그대로 이식 가능!');
    console.log('  ✅ Deno 네이티브 라이브러리로 마이그레이션할 필요 없음!');
  } else {
    console.log('⚠️  세미나실을 찾지 못했습니다. HTML 응답 확인 필요.');
  }

} catch (error) {
  console.error('❌ 실패:', error.message);
  if (error.response) {
    console.error('   응답 상태:', error.response.statusCode);
  }
}
