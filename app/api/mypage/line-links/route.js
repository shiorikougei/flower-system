// マイページから自分のLINE連携状況を確認/解除
// GET    /api/mypage/line-links?token=xxx        → アクティブな連携一覧
// DELETE /api/mypage/line-links  Body: { token, id } → 指定の連携を解除（is_active=false）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function authBy(token, supabaseAdmin) {
  if (!token) return { error: 'トークン必要', status: 400 };
  const { data: session } = await supabaseAdmin
    .from('customer_sessions')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (!session) return { error: '無効なリンク', status: 401 };
  if (new Date(session.expires_at) < new Date()) {
    return { error: 'リンクの有効期限切れ', status: 401 };
  }
  return { session };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const auth = await authBy(token, supabaseAdmin);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data } = await supabaseAdmin
      .from('customer_line_links')
      .select('id, line_user_id, display_name, is_active, linked_at, last_message_at')
      .eq('tenant_id', auth.session.tenant_id)
      .eq('customer_email', auth.session.email)
      .order('linked_at', { ascending: false });

    return NextResponse.json({ items: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { token, id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id必要' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const auth = await authBy(token, supabaseAdmin);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // 自分のレコードのみ無効化（is_active=false にする。完全削除はしない）
    await supabaseAdmin
      .from('customer_line_links')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', auth.session.tenant_id)
      .eq('customer_email', auth.session.email);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
