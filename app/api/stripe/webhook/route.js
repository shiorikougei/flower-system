// Stripe Webhook 受信エンドポイント
// POST /api/stripe/webhook
//
// 注意:
//   - Stripeダッシュボードでこのエンドポイントを登録し、署名シークレットを取得すること
//   - Webhookシークレットは STRIPE_WEBHOOK_SECRET 環境変数に設定
//   - Stripeから生のリクエストボディを受け取って署名検証する必要があるため、
//     Next.jsのデフォルトのbody parserを無効化している（experimental routes/segment config）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe';

export const runtime = 'nodejs';   // Edgeでは crypto が一部使えないため明示
export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe未初期化' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[/api/stripe/webhook] STRIPE_WEBHOOK_SECRET が未設定');
    return NextResponse.json({ error: 'Webhookシークレット未設定' }, { status: 500 });
  }

  // 生のテキストとして読み取って署名検証
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[/api/stripe/webhook] 署名検証失敗:', err.message);
    return NextResponse.json({ error: '署名検証失敗' }, { status: 400 });
  }

  // Service Role で更新（webhookは認証されないユーザーとして来る）
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    switch (event.type) {
      // ---- 決済成功 ----
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.order_id;
        if (!orderId) {
          console.warn('checkout.session.completed: order_id がmetadataにない');
          break;
        }

        // 既存の order_data を取得して paymentStatus も "入金済" に更新
        const { data: orderRow } = await supabaseAdmin
          .from('orders')
          .select('order_data')
          .eq('id', orderId)
          .single();

        const newOrderData = {
          ...(orderRow?.order_data || {}),
          paymentStatus: '入金済（クレジットカード）',
        };

        const { error } = await supabaseAdmin
          .from('orders')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent || null,
            order_data: newOrderData,
          })
          .eq('id', orderId);

        if (error) console.error('orders更新失敗:', error);

        // ★ EC注文の場合は在庫を減算
        const cartItems = orderRow?.order_data?.cartItems;
        if (Array.isArray(cartItems) && cartItems.length > 0) {
          console.log('[webhook] EC注文(クレカ) 在庫減算開始:', cartItems.map(c => ({ id: c.productId, qty: c.qty })));
          for (const c of cartItems) {
            if (!c.productId) {
              console.warn('[webhook] productId が空のアイテム:', c);
              continue;
            }
            const { data: prod, error: getErr } = await supabaseAdmin
              .from('products')
              .select('id, stock, name')
              .eq('id', c.productId)
              .single();
            if (getErr) {
              console.error('[webhook] 商品取得失敗:', c.productId, getErr.message);
              continue;
            }
            if (prod) {
              const newStock = Math.max(0, Number(prod.stock || 0) - Number(c.qty || 0));
              const { error: updErr } = await supabaseAdmin
                .from('products')
                .update({ stock: newStock })
                .eq('id', c.productId);
              if (updErr) {
                console.error('[webhook] 在庫更新失敗:', c.productId, updErr.message);
              } else {
                console.log(`[webhook] 在庫減算成功: "${prod.name}" ${prod.stock} → ${newStock}`);
              }
            }
          }
        }
        break;
      }

      // ---- 決済失敗 ----
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const orderId = pi.metadata?.order_id;
        if (!orderId) break;

        await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', orderId);
        break;
      }

      // ---- 返金 ----
      case 'charge.refunded': {
        const charge = event.data.object;
        // payment_intent から order を逆引き
        if (charge.payment_intent) {
          await supabaseAdmin
            .from('orders')
            .update({ payment_status: 'refunded' })
            .eq('stripe_payment_intent_id', charge.payment_intent);
        }
        break;
      }

      // ---- Connectアカウント更新（店舗の状態が変わったとき）----
      case 'account.updated': {
        const account = event.data.object;
        const tenantId = account.metadata?.tenant_id;
        if (!tenantId) break;

        const { data: settingsRow } = await supabaseAdmin
          .from('app_settings')
          .select('settings_data')
          .eq('id', tenantId)
          .single();
        const settingsData = settingsRow?.settings_data || {};
        if (settingsData.stripe?.accountId === account.id) {
          await supabaseAdmin
            .from('app_settings')
            .update({
              settings_data: {
                ...settingsData,
                stripe: {
                  ...settingsData.stripe,
                  chargesEnabled: account.charges_enabled,
                  payoutsEnabled: account.payouts_enabled,
                  detailsSubmitted: account.details_submitted,
                },
              },
            })
            .eq('id', tenantId);
        }
        break;
      }

      default:
        // 未処理イベントはスキップ
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[/api/stripe/webhook] イベント処理失敗:', err);
    return NextResponse.json({ error: 'webhook処理エラー' }, { status: 500 });
  }
}
