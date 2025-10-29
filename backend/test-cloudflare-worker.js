// Cloudflare Workers 호환성 테스트
// nodejs_compat 환경 시뮬레이션

// 1. got 라이브러리 import 테스트
async function testGotImport() {
  console.log('=== got 라이브러리 Import 테스트 ===');
  try {
    const got = await import('got');
    console.log('✅ got import 성공');
    console.log('got.default:', typeof got.default);
    return true;
  } catch (error) {
    console.error('❌ got import 실패:', error.message);
    return false;
  }
}

// 2. tough-cookie 라이브러리 import 테스트
async function testCookieJarImport() {
  console.log('\n=== tough-cookie Import 테스트 ===');
  try {
    const { CookieJar } = await import('tough-cookie');
    console.log('✅ CookieJar import 성공');

    // CookieJar 생성 테스트
    const jar = new CookieJar();
    console.log('✅ CookieJar 인스턴스 생성 성공');

    return true;
  } catch (error) {
    console.error('❌ CookieJar import 실패:', error.message);
    return false;
  }
}

// 3. got + CookieJar 통합 테스트
async function testGotWithCookies() {
  console.log('\n=== got + CookieJar 통합 테스트 ===');
  try {
    const got = (await import('got')).default;
    const { CookieJar } = await import('tough-cookie');

    const cookieJar = new CookieJar();

    // got 클라이언트 생성 (간단한 GET 요청)
    const client = got.extend({
      cookieJar,
      timeout: { request: 5000 },
    });

    console.log('✅ got + CookieJar 클라이언트 생성 성공');

    // 실제 HTTP 요청 테스트 (httpbin.org는 테스트용 API)
    console.log('HTTP 요청 테스트 중...');
    const response = await client.get('https://httpbin.org/cookies/set/test/value');

    console.log('✅ HTTP 요청 성공');
    console.log('응답 상태:', response.statusCode);

    // 쿠키가 저장되었는지 확인
    const cookies = await cookieJar.getCookies('https://httpbin.org');
    console.log('저장된 쿠키:', cookies.length > 0 ? '✅ 있음' : '❌ 없음');

    return true;
  } catch (error) {
    console.error('❌ 통합 테스트 실패:', error.message);
    console.error('상세 오류:', error.stack);
    return false;
  }
}

// 4. Node.js 모듈 의존성 확인
async function checkNodeModules() {
  console.log('\n=== Node.js 모듈 의존성 확인 ===');

  const modules = [
    'http',
    'https',
    'stream',
    'buffer',
    'url',
    'net',
  ];

  for (const mod of modules) {
    try {
      await import(mod);
      console.log(`✅ ${mod} 사용 가능`);
    } catch (error) {
      console.log(`❌ ${mod} 사용 불가: ${error.message}`);
    }
  }
}

// 전체 테스트 실행
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  Cloudflare Workers 호환성 테스트                     ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const test1 = await testGotImport();
  const test2 = await testCookieJarImport();
  const test3 = await checkNodeModules();
  const test4 = await testGotWithCookies();

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  테스트 결과 요약                                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('got import:', test1 ? '✅' : '❌');
  console.log('CookieJar import:', test2 ? '✅' : '❌');
  console.log('Node.js 모듈:', test3 ? '✅' : '❌');
  console.log('통합 테스트:', test4 ? '✅' : '❌');

  if (test1 && test2 && test4) {
    console.log('\n🎉 결론: Cloudflare Workers에서 사용 가능할 것으로 보입니다!');
  } else {
    console.log('\n⚠️  결론: 일부 기능이 작동하지 않을 수 있습니다.');
  }
}

runAllTests().catch(console.error);
