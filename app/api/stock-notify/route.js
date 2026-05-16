// 在庫切れ入荷通知の登録 API
// POST /api/stock-notify
// Body: { tenantId, productId, email, customerName? }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ★ 簡易レート制限（IP+1分間で5件まで）— spam踏み台防止
const rateMap = new Map();
function checkRate(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60000; }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count <= 5;
}

const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

export async function POST(request) {
  try {
    // ★ レート制限
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRate(ip)) {
      return NextResponse.json({ error: 'リクエスト過多です。しばらくお待ちください。' }, { status: 429 });
    }

    const { tenantId, productId, email, customerName } = await request.json();
    if (!tenantId || !productId || !email) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    // ★ email 形式バリデーション
    if (!EMAIL_RE.test(String(email))) {
      return NextResponse.json({ error: 'メールアドレスの形式が不正です' }, { status: 400 });
    }

    // ★ 文字数制限
    if (String(email).length > 200 || String(customerName || '').length > 100) {
      return NextResponse.json({ error: '入力が長すぎます' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // ★ 商品実在チェック（tenantId と productId が両方一致する商品が公開中であること）
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, tenant_id, is_active, restock_allowed')
      .eq('id', productId)
      .eq('tenant_id', String(tenantId))
      .single();
    if (prodErr || !product) {
      return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 });
    }
    if (!product.is_active) {
      return NextResponse.json({ error: 'この商品は現在販売停止中です' }, { status: 400 });
    }
    if (!product.restock_allowed) {
      return NextResponse.json({ error: 'この商品は再入荷予定がありません' }, { status: 400 });
    }

    // 既存登録は upsert（重複時は何もしない）
    const { error } = await supabaseAdmin
      .from('stock_notifications')
      .upsert(
        {
          tenant_id: String(tenantId),
          product_id: productId,
          email: String(email).toLowerCase(),
          customer_name: String(customerName || '').slice(0, 100) || null,
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
