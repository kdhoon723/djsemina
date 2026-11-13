import { createClient } from 'jsr:@supabase/supabase-js@2';
import { LibraryAPIClient } from '../_shared/library-client.ts';
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
    if (results.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '세미나실 목록 파싱 결과 0개 (사이트 구조 변경 의심)'
      }), {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
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
