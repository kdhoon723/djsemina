import got from 'got';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function testGotLogin() {
  // Cookie Jar 생성 (자동 쿠키 관리)
  const cookieJar = new CookieJar();

  const client = got.extend({
    prefixUrl: 'https://library.daejin.ac.kr',
    cookieJar,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    followRedirect: true,
    maxRedirects: 20,
  });

  console.log('1단계: 로그인 페이지 방문');
  await client.get('home_login_write.mir');

  console.log('쿠키:', await cookieJar.getCookies('https://library.daejin.ac.kr'));

  console.log('\n2단계: 로그인 POST');

  // Form 데이터 (실제 form 순서대로)
  const form = new URLSearchParams();
  form.append('home_login_mloc_code', 'DJUL');
  form.append('home_login_id_login01', process.env.USER_ID);
  form.append('home_login_password_login01', process.env.USER_PW);
  form.append('login_type', 'portal_member');
  form.append('home_login_mloc_code', 'DJUL');  // 두 번째
  form.append('home_login_id_login02', '');
  form.append('home_login_password_login02', '');
  form.append('login_type', 'outsider_member');  // 두 번째
  form.append('home_login_id_save_yn', 'N');
  form.append('home_login_id', process.env.USER_ID);
  form.append('home_login_password', process.env.USER_PW);
  form.append('login_type', '');  // 세 번째 (빈 값)

  try {
    const response = await client.post('home_security_login_write_prss.mir', {
      body: form.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://library.daejin.ac.kr/home_login_write.mir',
      },
    });

    console.log('응답 URL:', response.url);
    console.log('응답 상태:', response.statusCode);

    // HTML 저장
    fs.writeFileSync('got_login_response.html', response.body);
    console.log('HTML 저장: got_login_response.html');

    // 응답 분석
    const $ = cheerio.load(response.body);

    // LOGOUT 버튼 확인
    if (response.body.includes('LOGOUT')) {
      console.log('\n✅ 로그인 성공! LOGOUT 버튼 발견');
    } else if (response.body.includes('SecurityCheck') || response.body.includes('sso.daejin.ac.kr')) {
      console.log('\n✅ SSO 페이지로 이동 - 로그인 진행 중!');

      // SSO URL 추출
      $('script').each((i, script) => {
        const content = $(script).html();
        if (content && content.includes('SecurityCheck')) {
          console.log('\nSSO JavaScript 발견:');
          console.log(content.substring(0, 300));
        }
      });

      // Form auto-submit 확인
      $('form').each((i, form) => {
        const action = $(form).attr('action');
        if (action && (action.includes('SecurityCheck') || action.includes('sso'))) {
          console.log(`\nSSO Form 발견: action="${action}"`);

          $(form).find('input[type="hidden"]').each((j, input) => {
            console.log(`  ${$(input).attr('name')} = ${$(input).attr('value')}`);
          });
        }
      });
    } else if (response.body.includes('존재하지 않는 이용자') || response.body.includes('로그인')) {
      console.log('\n❌ 로그인 실패 - 로그인 페이지로 돌아옴');
    } else {
      console.log('\n⚠️ 알 수 없는 응답');
    }

    console.log('\n최종 쿠키:', await cookieJar.getCookies('https://library.daejin.ac.kr'));

  } catch (error) {
    console.error('오류:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.statusCode);
      console.error('응답 URL:', error.response.url);
    }
  }
}

testGotLogin().catch(console.error);
