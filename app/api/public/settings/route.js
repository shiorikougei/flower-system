// [セキュリティ 2026-10] お客様向けページ用の店舗設定
// GET /api/public/settings?id=<tenantId または tenantId_gallery>
//   → { settings_data }（LINE の鍵・PIN・パスワード・通知先メールなどは取り除く。utils/publicSettings.js）
// ログイン不要。読み取りのみ。

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publicSettings, isPublicSettingsId } from '@/utils/publicSettings';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = String(searchParams.get('id') || searchParams.get('tenantId') || '').toLowerCase();
    if (!isPublicSettingsId(id)) {
      return NextResponse.json({ settings_data: null }, { status: 400 });
    }
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('[/api/public/settings] select error:', error?.code);
      return NextResponse.json({ settings_data: null }, { status: 500 });
    }
    return NextResponse.json(
      { settings_data: data?.settings_data ? publicSettings(data.settings_data) : null },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } }
    );
  } catch (e) {
    console.error('[/api/public/settings] error:', e?.message);
    return NextResponse.json({ settings_data: null }, { status: 500 });
  }
}
