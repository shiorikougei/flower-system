// 注文番号 + メールアドレスで注文情報を取得する公開API
// POST /api/order-lookup
// Body: { tenantId, orderId, email }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const { tenantId, orderId, email } = await request.json();
    if (!tenantId || !orderId || !email) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 });
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 注文番号は uuid なので、prefix 検索 or 完全一致のどちらにするか
    // 8桁の頭文字でも見つかるようにしておく（お客様向けは短い番号の方が便利）
    let query = supabaseAdmin
      .from('orders')
      .select('id, created_at, payment_status, paid_at, order_data')
      .eq('tenant_id', tenantId);

    // 8文字以下なら prefix 検索、それ以上なら完全一致
    if (orderId.length <= 12) {
      query = query.ilike('id::text', `${orderId}%`);
    } else {
      query = query.eq('id', orderId);
    }

    const { data: orders, error } = await query.limit(5);
    if (error) return NextResponse.json({ error: '検索に失敗しました' }, { status: 500 });

    // メールアドレスで再フィルタ
    const matched = (orders || []).filter(o => {
      const ce = o.order_data?.customerInfo?.email || '';
      return ce.toLowerCase() === email.toLowerCase();
    });

    if (matched.length === 0) {
      return NextResponse.json({ error: '該当する注文が見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ orders: matched });
  } catch (err) {
    console.error('[/api/order-lookup] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
