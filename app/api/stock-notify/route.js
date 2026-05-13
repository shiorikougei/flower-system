// 在庫切れ入荷通知の登録 API
// POST /api/stock-notify
// Body: { tenantId, productId, email, customerName? }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const { tenantId, productId, email, customerName } = await request.json();
    if (!tenantId || !productId || !email) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // 既存登録は upsert（重複時は何もしない）
    const { error } = await supabaseAdmin
      .from('stock_notifications')
      .upsert(
        {
          tenant_id: String(tenantId),
          product_id: productId,
          email: email.toLowerCase(),
          customer_name: customerName || null,
        },
        { onConflict: 'product_id,email', ignoreDuplicates: true }
      );
    if (error) {
      console.error('[stock-notify] insert error:', error);
      return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ registered: true });
  } catch (err) {
    console.error('[stock-notify] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
