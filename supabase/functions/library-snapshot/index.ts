/**
 * Supabase Edge Function: library-snapshot
 * 특정 스냅샷의 상세 데이터 조회
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
    const snapshotId = url.searchParams.get('id');
    if (!snapshotId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'id 파라미터가 필요합니다'
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
    console.log(`[Snapshot] ${snapshotId} 스냅샷 조회`);
    // 특정 스냅샷 조회
    const { data: snapshot, error } = await supabase.from('seminar_room_snapshots').select('*').eq('id', snapshotId).single();
    if (error) {
      console.error('[Snapshot] 조회 오류:', error.message);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      snapshot: {
        id: snapshot.id,
        date: snapshot.date,
        rooms: snapshot.rooms,
        fetchedAt: snapshot.fetched_at,
        createdAt: snapshot.created_at
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[Snapshot] 오류:', error.message);
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
