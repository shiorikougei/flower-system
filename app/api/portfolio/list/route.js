// 公開ポートフォリオ取得API（お客様向け）
// GET /api/portfolio/list?tenantId=xxx
//
// app_settings の RLS で anon が ${tenantId}_gallery を読めない場合があるため、
// service role key で確実に取得して返す
//
// セキュリティ: 公開可能な作品データのみ（サーバーで安全に取得）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ items: [] });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', `${tenantId}_gallery`)
      .maybeSingle();

    const images = data?.settings_data?.images || [];
    return NextResponse.json({ items: images });
  } catch (err) {
    console.error('[portfolio/list] error:', err);
    return NextResponse.json({ items: [], error: err.message });
  }
}
