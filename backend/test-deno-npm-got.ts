/**
 * Deno에서 npm:got + npm:tough-cookie 사용 가능 여부 테스트
 */

console.log('=== Deno npm: specifier 테스트 ===\n');

// 테스트 1: got import
console.log('1. got 라이브러리 import 테스트...');
try {
  const got = (await import('npm:got@14')).default;
  console.log('✅ got import 성공');
  console.log('   타입:', typeof got);
} catch (error) {
  console.error('❌ got import 실패:', error.message);
}

// 테스트 2: tough-cookie import
console.log('\n2. tough-cookie import 테스트...');
try {
  const { CookieJar } = await import('npm:tough-cookie@5');
  console.log('✅ tough-cookie import 성공');

  const jar = new CookieJar();
  console.log('✅ CookieJar 인스턴스 생성 성공');
} catch (error) {
  console.error('❌ tough-cookie import 실패:', error.message);
}

// 테스트 3: got + CookieJar 통합
console.log('\n3. got + CookieJar 통합 테스트...');
try {
  const got = (await import('npm:got@14')).default;
  const { CookieJar } = await import('npm:tough-cookie@5');

  const cookieJar = new CookieJar();
  const client = got.extend({
    cookieJar,
    timeout: { request: 10000 },
  });

  console.log('✅ got + CookieJar 클라이언트 생성 성공');

  // 실제 HTTP 요청 테스트
  console.log('   HTTP 요청 테스트 중...');
  const response = await client.get('https://httpbin.org/cookies/set/test/value');

  console.log('✅ HTTP 요청 성공');
  console.log('   응답 상태:', response.statusCode);

  // 쿠키 확인
  const cookies = await cookieJar.getCookies('https://httpbin.org');
  console.log('   저장된 쿠키:', cookies.length > 0 ? `✅ ${cookies.length}개` : '❌ 없음');

} catch (error) {
  console.error('❌ 통합 테스트 실패:', error.message);
  console.error('   상세:', error.stack);
}

// 테스트 4: 실제 대진대 로그인 페이지 접근
console.log('\n4. 대진대 도서관 접근 테스트...');
try {
  const got = (await import('npm:got@14')).default;
  const { CookieJar } = await import('npm:tough-cookie@5');

  const cookieJar = new CookieJar();
  const client = got.extend({
    prefixUrl: 'https://library.daejin.ac.kr',
    cookieJar,
    timeout: { request: 10000 },
    followRedirect: true,
  });

  const response = await client.get('home_login_write.mir');
  console.log('✅ 로그인 페이지 접근 성공');
  console.log('   응답 크기:', response.body.length);
  console.log('   쿠키 저장됨:', (await cookieJar.getCookies('https://library.daejin.ac.kr')).length > 0 ? '✅' : '❌');

} catch (error) {
  console.error('❌ 대진대 접근 실패:', error.message);
}

console.log('\n=== 테스트 완료 ===');
