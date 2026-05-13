// 注文のStripe Checkout Sessionを検証して、支払い完了ならordersを更新する
// POST /api/stripe/verify-session
// Body: { orderId, tenantId }
//
// Webhookが何らかの理由で届かない場合の安全網として使用する
// サンクスページ表示時に呼ばれる想定

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe';

export async function POST(request) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe未初期化' }, { status: 500 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service Role Key未設定' }, { status: 500 });
    }

    const { orderId, tenantId } = await request.json();
    if (!orderId || !tenantId) {
      return NextResponse.json({ error: 'orderId/tenantId が必要' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 注文を取得
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, payment_status, stripe_checkout_session_id, tenant_id, order_data')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 });
    }

    // 既にpaid済みなら何もしない
    if (order.payment_status === 'paid') {
      return NextResponse.json({ alreadyPaid: true });
    }

    // checkout_session_id が無ければ何もしない
    if (!order.stripe_checkout_session_id) {
      return NextResponse.json({ error: 'Stripe Checkoutセッション情報がありません' }, { status: 400 });
    }

    // 店舗のStripe接続情報を取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const stripeAccountId = settingsRow?.settings_data?.stripe?.accountId;
    if (!stripeAccountId) {
      return NextResponse.json({ error: '店舗のStripe接続情報がありません' }, { status: 400 });
    }

    // StripeからCheckoutセッションを取得
    // ★ retrieve は (id, params, options) の3引数構造。ConnectのstripeAccountは第3引数
    const session = await stripe.checkout.sessions.retrieve(
      order.stripe_checkout_session_id,
      undefined,
      { stripeAccount: stripeAccountId }
    );

    // 支払い完了している場合のみ更新
    if (session.payment_status === 'paid') {
      const newOrderData = {
        ...(order.order_data || {}),
        paymentStatus: '入金済（クレジットカード）',
      };
      await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent || null,
          order_data: newOrderData,
        })
        .eq('id', orderId);

      // ★ EC注文の場合は在庫減算（Webhookが届かなかった時の保険、RPC関数で原子的に）
      const cartItems = order.order_data?.cartItems;
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        console.log('[verify-session] EC注文 在庫減算開始:', cartItems.map(c => ({ id: c.productId, qty: c.qty })));
        for (const c of cartItems) {
          if (!c.productId) continue;
          const { data: result, error: rpcErr } = await supabaseAdmin.rpc('decrement_stock', {
            p_product_id: c.productId,
            p_qty: Number(c.qty || 0),
          });
          if (rpcErr) {
            console.error('[verify-session] decrement_stock 失敗:', c.productId, rpcErr.message);
          } else if (result?.success) {
            console.log(`[verify-session] 在庫減算成功: "${result.product_name}" → ${result.new_stock}`);
          }
        }
      }

      return NextResponse.json({ updated: true, paid: true });
    }

    return NextResponse.json({ paid: false, sessionStatus: session.payment_status });
  } catch (err) {
    console.error('[/api/stripe/verify-session] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
