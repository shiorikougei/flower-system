// マイページの記念日リマインダー CRUD
// GET    /api/mypage/anniversaries?token=xxx          → 一覧取得
// POST   /api/mypage/anniversaries  Body: { token, title, month, day, notes? }  → 追加
// DELETE /api/mypage/anniversaries  Body: { token, id }                          → 削除

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function authBy(token, supabaseAdmin) {
  if (!token) return { error: 'トークンが必要', status: 400 };
  const { data: session } = await supabaseAdmin
    .from('customer_sessions')
    .select('*')
    .eq('token', token)
    .single();
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
      .from('customer_anniversaries')
      .select('*')
      .eq('tenant_id', auth.session.tenant_id)
      .eq('customer_email', auth.session.email)
      .order('month', { ascending: true })
      .order('day', { ascending: true });

    return NextResponse.json({ items: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { token, title, month, day, notes, customerName } = await request.json();
    if (!title || !month || !day) {
      return NextResponse.json({ error: 'title/month/day が必要' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const auth = await authBy(token, supabaseAdmin);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { data, error } = await supabaseAdmin
      .from('customer_anniversaries')
      .insert({
        tenant_id: auth.session.tenant_id,
        customer_email: auth.session.email,
        customer_name: customerName || null,
        title,
        month: Number(month),
        day: Number(day),
        notes: notes || null,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { token, id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id が必要' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const auth = await authBy(token, supabaseAdmin);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // セキュリティ: 自分のレコードのみ削除可
    await supabaseAdmin
      .from('customer_anniversaries')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.session.tenant_id)
      .eq('customer_email', auth.session.email);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
