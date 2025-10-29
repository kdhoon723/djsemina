/**
 * 전체 크롤러 테스트 (내일 날짜)
 * Edge Function과 동일한 로직으로 테스트
 */

import got from 'npm:got@14';
import { CookieJar } from 'npm:tough-cookie@5';

const TERM_MIN = 30;
const BASE_URL = 'https://library.daejin.ac.kr';

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

interface Room {
  sloc_code: string;
  cate_cd: string;
  room_cd: string;
  title: string;
}

interface RoomWithTimes extends Room {
  times: Array<{ start: string; end: string }>;
}

class LibraryAPIClient {
  private client: any;
  private cookieJar: any;

  constructor() {
    this.cookieJar = new CookieJar();
    this.client = got.extend({
      prefixUrl: BASE_URL,
      cookieJar: this.cookieJar,
      timeout: { request: 25000 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      followRedirect: true,
      maxRedirects: 20,
    });
  }

  async login(userId: string, userPw: string): Promise<boolean> {
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
          'Referer': `${BASE_URL}/home_login_write.mir`,
        },
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
    } catch (error: any) {
      console.error('[로그인] 오류:', error.message);
      return false;
    }
  }

  async getSeminarList(): Promise<Room[]> {
    console.log('[세미나실 목록] 조회');
    try {
      const response = await this.client.get('seminar_seminar_list.mir');
      const html = response.body;

      const rooms: Room[] = [];
      const scriptMatches = html.matchAll(/seminar_resv\('\/seminar_resv\.mir',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g);

      for (const match of scriptMatches) {
        rooms.push({
          sloc_code: match[1],
          cate_cd: match[2],
          room_cd: match[3],
          title: match[4],
        });
      }

      console.log(`[세미나실 목록] ${rooms.length}개 발견`);
      return rooms;
    } catch (error: any) {
      console.error('[세미나실 목록] 오류:', error.message);
      return [];
    }
  }

  async getAvailableTimes(room: Room, dateStr: string): Promise<RoomWithTimes> {
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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const timeMatches = response.body.matchAll(/<option[^>]*>(\d{1,2}:\d{2})<\/option>/g);
      let starts = Array.from(timeMatches).map((m: any) => m[1]);

      const TODAY = new Date().toISOString().slice(0, 10);
      if (dateStr === TODAY) {
        starts = starts.filter((t: string) => !pastToday(t));
      }

      const times = starts.map((s: string) => ({ start: s, end: plus30(s) }));

      console.log(`  ${room.title}: ${times.length}개 시간대 가능`);

      return { ...room, times };
    } catch (error: any) {
      console.error(`[시간 조회] ${room.title} 오류:`, error.message);
      return { ...room, times: [] };
    }
  }

  async crawl(dateStr: string): Promise<RoomWithTimes[]> {
    console.log(`\n[크롤링] 시작: ${dateStr}`);
    const startTime = Date.now();

    try {
      const rooms = await this.getSeminarList();
      if (rooms.length === 0) return [];

      console.log(`[크롤링] ${rooms.length}개 방 병렬 조회\n`);

      // 처음 3개만 테스트
      const testRooms = rooms.slice(0, 3);
      const results = await Promise.all(
        testRooms.map(room => this.getAvailableTimes(room, dateStr))
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n[크롤링] 완료 (${duration}초)`);

      // 결과 출력
      console.log('\n[결과]:');
      results.forEach(r => {
        console.log(`\n${r.title} (${r.room_cd})`);
        if (r.times.length > 0) {
          r.times.forEach(t => {
            console.log(`  ${t.start} - ${t.end}`);
          });
        } else {
          console.log('  예약 불가능');
        }
      });

      return results;
    } catch (error: any) {
      console.error('[크롤링] 오류:', error.message);
      return [];
    }
  }
}

// 테스트 실행
const userId = Deno.env.get('USER_ID') || '20241476';
const userPw = Deno.env.get('USER_PW') || 'kdhkdh0723';

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dateStr = tomorrow.toISOString().slice(0, 10);

console.log('='.repeat(50));
console.log('세미나실 크롤러 테스트 (내일)');
console.log('='.repeat(50));
console.log(`날짜: ${dateStr}\n`);

const client = new LibraryAPIClient();

const loginSuccess = await client.login(userId, userPw);
if (!loginSuccess) {
  console.error('로그인 실패!');
  Deno.exit(1);
}

const results = await client.crawl(dateStr);

console.log('\n' + '='.repeat(50));
console.log(`총 ${results.filter(r => r.times.length > 0).length}/${results.length}개 방 예약 가능`);
console.log('='.repeat(50));
