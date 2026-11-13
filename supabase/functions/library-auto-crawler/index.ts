import { createClient } from 'jsr:@supabase/supabase-js@2';
import { LibraryAPIClient } from '../_shared/library-client.ts';
Deno.serve(async (req)=>{
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
    const { userId, userPw } = await req.json();
    if (!userId || !userPw) {
      return new Response(JSON.stringify({
        success: false,
        error: 'userId와 userPw가 필요합니다'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const now = new Date();
    const kstOffset = 9 * 60;
    const kstNow = new Date(now.getTime() + kstOffset * 60 * 1000);
    const kstHour = kstNow.getUTCHours();
    if (kstHour >= 20) {
      kstNow.setUTCDate(kstNow.getUTCDate() + 1);
    }
    const today = new Date(kstNow);
    const tomorrow = new Date(kstNow);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    console.log(`[Auto-Crawler] 시작 (KST 기준, 20시 이후 처리): ${todayStr}, ${tomorrowStr}`);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
    console.log(`[Auto-Crawler] 오늘 데이터 크롤링: ${todayStr}`);
    const todayResults = await client.crawl(todayStr);
    console.log(`[Auto-Crawler] 내일 데이터 크롤링: ${tomorrowStr}`);
    const tomorrowResults = await client.crawl(tomorrowStr);
    if (todayResults.length === 0 && tomorrowResults.length === 0) {
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
    let todaySaved = false;
    if (todayResults.length > 0) {
      const { error: todayError } = await supabase.from('seminar_room_snapshots').insert({
        date: todayStr,
        rooms: todayResults,
        fetched_at: new Date().toISOString()
      });
      if (todayError) {
        console.error('[Auto-Crawler] 오늘 데이터 저장 실패:', todayError);
      } else {
        console.log(`[Auto-Crawler] 오늘 데이터 저장 완료 (${todayResults.length}개 방)`);
        todaySaved = true;
      }
    }
    let tomorrowSaved = false;
    if (tomorrowResults.length > 0) {
      const { error: tomorrowError } = await supabase.from('seminar_room_snapshots').insert({
        date: tomorrowStr,
        rooms: tomorrowResults,
        fetched_at: new Date().toISOString()
      });
      if (tomorrowError) {
        console.error('[Auto-Crawler] 내일 데이터 저장 실패:', tomorrowError);
      } else {
        console.log(`[Auto-Crawler] 내일 데이터 저장 완료 (${tomorrowResults.length}개 방)`);
        tomorrowSaved = true;
      }
    }
    return new Response(JSON.stringify({
      success: true,
      results: {
        today: {
          date: todayStr,
          count: todayResults.length,
          saved: todaySaved
        },
        tomorrow: {
          date: tomorrowStr,
          count: tomorrowResults.length,
          saved: tomorrowSaved
        }
      },
      message: '자동 크롤링 완료'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[Auto-Crawler] 오류:', error.message);
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
