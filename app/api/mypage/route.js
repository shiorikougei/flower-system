// マイページ用 注文一覧取得API
// POST /api/mypage
// Body: { token }
//
// Magic Linkのトークンを検証して、対応するメールの全注文を返す

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ error: 'トークンが必要' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // トークン取得
    const { data: session } = await supabaseAdmin
      .from('customer_sessions')
      .select('*')
      .eq('token', token)
      .single();

    if (!session) {
      return NextResponse.json({ error: '無効なリンクです' }, { status: 401 });
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'リンクの有効期限が切れています' }, { status: 401 });
    }

    // last_used_at を更新
    await supabaseAdmin
      .from('customer_sessions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('token', token);

    // 注文取得
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, payment_status, paid_at, order_data')
      .eq('tenant_id', session.tenant_id)
      .order('created_at', { ascending: false });

    const filteredOrders = (orders || []).filter(o => {
      const ce = o.order_data?.customerInfo?.email || '';
      return ce.toLowerCase() === session.email.toLowerCase();
    });

    return NextResponse.json({
      email: session.email,
      tenantId: session.tenant_id,
      orders: filteredOrders,
    });
  } catch (err) {
    console.error('[mypage] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
