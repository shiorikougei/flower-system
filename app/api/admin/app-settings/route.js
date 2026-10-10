// [セキュリティ 2026-10] 管理者ページ（/owner）用の設定の読み書き
// これまで /owner はブラウザから app_settings を直接読み書きしていた（RLS の「誰でも読める」「nocolde_owner は誰でも書ける」に依存）。
// サーバーでオーナー確認（requireOwner: x-owner-password = OWNER_PASSWORD、または許可されたメールのログイン）をしてから読み書きする。
//
// GET  /api/admin/app-settings            → { rows: [{ id, settings_data, updated_at }] }（全テナント）
// GET  /api/admin/app-settings?id=xxx     → { settings_data, updated_at }
// PUT  /api/admin/app-settings            body: { id, settings_data }
//      → 今の設定に一番上の階層で上書き（送られてこなかった項目は残す。誤って他の項目を消さないため）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOwner } from '@/utils/adminAuth';

export const runtime = 'nodejs';

const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function GET(request) {
  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;
  try {
    const id = new URL(request.url).searchParams.get('id');
    const supabase = admin();
    if (id) {
      if (!ID_RE.test(id)) return NextResponse.json({ error: 'id が不正です' }, { status: 400 });
      const { data, error } = await supabase.from('app_settings').select('settings_data, updated_at').eq('id', id).maybeSingle();
      if (error) throw error;
      return NextResponse.json({ settings_data: data?.settings_data || null, updated_at: data?.updated_at || null });
    }
    const { data, error } = await supabase.from('app_settings').select('id, settings_data, updated_at');
    if (error) throw error;
    return NextResponse.json({ rows: data || [] });
  } catch (e) {
    console.error('[/api/admin/app-settings GET]', e?.message);
    return NextResponse.json({ error: '設定の読み込みに失敗しました' }, { status: 500 });
  }
}

export async function PUT(request) {
  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;
  try {
    const { id, settings_data } = await request.json();
    if (!id || !ID_RE.test(String(id))) return NextResponse.json({ error: 'id が不正です' }, { status: 400 });
    if (!settings_data || typeof settings_data !== 'object' || Array.isArray(settings_data)) {
      return NextResponse.json({ error: 'settings_data が不正です' }, { status: 400 });
    }
    const supabase = admin();
    const { data: cur, error: rErr } = await supabase.from('app_settings').select('settings_data').eq('id', id).maybeSingle();
    if (rErr) throw rErr;
    const next = { ...(cur?.settings_data || {}), ...settings_data };
    const { error } = await supabase.from('app_settings').upsert({ id: String(id), settings_data: next });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[/api/admin/app-settings PUT]', e?.message);
    return NextResponse.json({ error: '設定の保存に失敗しました' }, { status: 500 });
  }
}
