/**
 * Supabase Edge Function: library-history
 * 세미나실 예약 히스토리 조회
 */ import { createClient } from 'jsr:@supabase/supabase-js@2';
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
    const url = new URL(req.url);
    const date = url.searchParams.get('date');
    if (!date) {
      return new Response(JSON.stringify({
        success: false,
        error: 'date 파라미터가 필요합니다'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`[History] ${date} 날짜의 히스토리 조회`);
    // 해당 날짜의 모든 스냅샷 조회 (rooms 포함 — 한 번에 전부 반환해 N+1 제거)
    // 시간 오름차순(과거→현재): 슬라이더 왼쪽=과거, 오른쪽=현재
    const { data: snapshots, error } = await supabase.from('seminar_room_snapshots').select('id, date, fetched_at, created_at, rooms').eq('date', date).order('fetched_at', {
      ascending: true
    });
    if (error) {
      console.error('[History] 조회 오류:', error.message);
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
    return new Response(JSON.stringify({
      success: true,
      date,
      snapshots: snapshots || [],
      count: snapshots?.length || 0
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[History] 오류:', error.message);
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
