/**
 * Supabase Edge Function: library-crawler
 * npm:got + npm:tough-cookie + Database Cache
 */ import got from 'npm:got@14';
import { CookieJar } from 'npm:tough-cookie@5';
import { createClient } from 'jsr:@supabase/supabase-js@2';
/* ─── 설정 ─── */ const TERM_MIN = 30;
const BASE_URL = 'https://library.daejin.ac.kr';
/* ─── 유틸 함수 ─── */ const sleep = (ms)=>new Promise((r)=>setTimeout(r, ms));
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
/**
 * API 크롤러 클래스
 */ class LibraryAPIClient {
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
  async getSeminarList() {
    console.log('[세미나실 목록] 조회');
    try {
      const response = await this.client.get('seminar_seminar_list.mir');
      const html = response.body;
      const rooms = [];
      const scriptMatches = html.matchAll(/seminar_resv\('\/seminar_resv\.mir',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g);
      for (const match of scriptMatches){
        rooms.push({
          sloc_code: match[1],
          cate_cd: match[2],
          room_cd: match[3],
          title: match[4]
        });
      }
      console.log(`[세미나실 목록] ${rooms.length}개 발견`);
      return rooms;
    } catch (error) {
      console.error('[세미나실 목록] 오류:', error.message);
      return [];
    }
  }
  async getAvailableTimes(room, dateStr) {
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
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      const timeMatches = response.body.matchAll(/<option[^>]*>(\d{1,2}:\d{2})<\/option>/g);
      let starts = Array.from(timeMatches).map((m)=>m[1]);
      const TODAY = new Date().toISOString().slice(0, 10);
      if (dateStr === TODAY) {
        starts = starts.filter((t)=>!pastToday(t));
      }
      const times = starts.map((s)=>({
          start: s,
          end: plus30(s)
        }));
      return {
        ...room,
        times
      };
    } catch (error) {
      console.error(`[시간 조회] ${room.title} 오류:`, error.message);
      return {
        ...room,
        times: []
      };
    }
  }
  async crawl(dateStr) {
    console.log(`[크롤링] 시작: ${dateStr}`);
    const startTime = Date.now();
    try {
      const rooms = await this.getSeminarList();
      if (rooms.length === 0) return [];
      console.log(`[크롤링] ${rooms.length}개 방 병렬 조회`);
      const results = await Promise.all(rooms.map((room)=>this.getAvailableTimes(room, dateStr)));
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[크롤링] 완료 (${duration}초)`);
      return results;
    } catch (error) {
      console.error('[크롤링] 오류:', error.message);
      return [];
    }
  }
}
/* ─── Supabase Edge Function 핸들러 ─── */ Deno.serve(async (req)=>{
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { date, useCache = true } = await req.json();
    // 자격증명은 클라이언트(번들)가 아니라 서버 시크릿에서 읽는다 — 프론트 노출 방지
    const userId = Deno.env.get('LIBRARY_USER_ID');
    const userPw = Deno.env.get('LIBRARY_USER_PW');
    if (!userId || !userPw) {
      return new Response(JSON.stringify({
        success: false,
        error: '서버 설정 오류: LIBRARY_USER_ID/LIBRARY_USER_PW 시크릿이 설정되지 않았습니다'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const dateStr = date || new Date().toISOString().slice(0, 10);
    console.log(`[Edge Function] 요청: ${dateStr}, useCache: ${useCache}`);
    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    // 캐시 조회
    if (useCache) {
      console.log('[캐시] 조회 시작');
      const { data: cachedData, error: cacheError } = await supabase.from('seminar_room_snapshots').select('*').eq('date', dateStr).order('fetched_at', {
        ascending: false
      }).limit(1).single();
      if (cachedData && !cacheError) {
        console.log('[캐시] 히트! 반환');
        return new Response(JSON.stringify({
          success: true,
          date: dateStr,
          rooms: cachedData.rooms,
          count: cachedData.rooms.length,
          cached: true,
          fetchedAt: cachedData.fetched_at
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      console.log('[캐시] 미스 - 크롤링 시작');
    }
    // 실시간 크롤링
    const client = new LibraryAPIClient();
    const loginSuccess = await client.login(userId, userPw);
    if (!loginSuccess) {
      return new Response(JSON.stringify({
        success: false,
        error: '로그인 실패'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const results = await client.crawl(dateStr);
    const fetchedAt = new Date().toISOString();
    // DB에 저장
    console.log('[DB] 스냅샷 저장 시작');
    const { error: insertError } = await supabase.from('seminar_room_snapshots').insert({
      date: dateStr,
      rooms: results,
      fetched_at: fetchedAt
    });
    if (insertError) {
      console.error('[DB] 저장 실패:', insertError.message);
    } else {
      console.log('[DB] 저장 완료');
    }
    return new Response(JSON.stringify({
      success: true,
      date: dateStr,
      rooms: results,
      count: results.length,
      cached: false,
      fetchedAt
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[Edge Function] 오류:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
