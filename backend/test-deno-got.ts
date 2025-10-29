/**
 * Deno에서 npm:got 사용 가능 여부 테스트
 */

console.log('🔍 Deno에서 got 라이브러리 import 테스트...\n');

try {
  // npm: 접두사로 got import 시도
  console.log('1. got import 시도...');
  const got = (await import('npm:got@14')).default;
  console.log('✅ got import 성공!');
  console.log('   got 버전:', got.version || 'unknown');

  // tough-cookie import 시도
  console.log('\n2. tough-cookie import 시도...');
  const { CookieJar } = await import('npm:tough-cookie@5');
  console.log('✅ tough-cookie import 성공!');

  // 간단한 요청 테스트
  console.log('\n3. 실제 HTTP 요청 테스트...');
  const cookieJar = new CookieJar();

  const client = got.extend({
    cookieJar,
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
    timeout: { request: 10000 },
  });

  console.log('   요청 전송 중...');
  const response = await client.get('https://library.daejin.ac.kr/home_login_write.mir');

  console.log('✅ HTTP 요청 성공!');
  console.log('   상태 코드:', response.statusCode);
  console.log('   응답 크기:', response.body.length, 'bytes');
  console.log('   쿠키:', await cookieJar.getCookies('https://library.daejin.ac.kr'));

  console.log('\n🎉 결론: Deno에서 got + tough-cookie 사용 가능!');

} catch (error) {
  console.error('\n❌ 오류 발생:', error.message);
  console.error('   스택:', error.stack);
  console.log('\n💡 결론: Deno에서 got 사용 불가능 - another_cookiejar 필요');
  Deno.exit(1);
}
