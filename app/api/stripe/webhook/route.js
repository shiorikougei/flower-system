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
import { sendEmail } from '@/utils/email';
import { findTemplateFor, renderTemplate, bodyToHtml, formatOrderItems, formatRecipientInfo } from '@/utils/emailTemplates';
import { sendLineParallelToEmail } from '@/utils/line';
import { createMypageMagicUrl } from '@/utils/mypageLink';

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
          .select('order_data, payment_status')
          .eq('id', orderId)
          .single();

        // ★ 二重処理防止: 既に paid 済みなら何もしない
        if (orderRow?.payment_status === 'paid') {
          console.log('[webhook] 既に決済済みのためスキップ:', orderId);
          break;
        }

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

        // ★ クレカ決済成功メール送信（テンプレートシステム経由）
        try {
          const customerEmail = orderRow?.order_data?.customerInfo?.email;
          const tenantId = session.metadata?.tenant_id;
          if (customerEmail && tenantId) {
            const { data: settingsRow } = await supabaseAdmin
              .from('app_settings')
              .select('settings_data')
              .eq('id', tenantId)
              .single();
            const settings = settingsRow?.settings_data || {};
            const shopId = orderRow?.order_data?.shopId;
            const shop = settings.shops?.find(s => String(s.id) === String(shopId)) || settings.shops?.[0] || {};
            const shopName = shop.name || settings.generalConfig?.appName || 'お花屋さん';
            const shopPhone = shop.phone || '';

            const tpl = findTemplateFor('order_confirmed', settings.autoReplyTemplates, { shopId: shop.id });
            if (tpl) {
              // 金額再計算
              const od = orderRow.order_data || {};
              const item = Number(od.itemPrice) || (Array.isArray(od.cartItems) ? od.cartItems.reduce((s, c) => s + Number(c.price) * Number(c.qty), 0) : 0);
              const fee = Number(od.calculatedFee) || 0;
              const pickup = Number(od.pickupFee) || 0;
              const total = (item + fee + pickup) + Math.floor((item + fee + pickup) * 0.1);

              // ★ マイページURL（Magic Link）発行
              const mypageUrl = await createMypageMagicUrl({
                supabaseAdmin,
                tenantId,
                shopId: od.shopId,
                email: customerEmail,
              });

              const vars = {
                customerName: od.customerInfo?.name || 'お客',
                shopName,
                orderId: String(orderId).slice(0, 8),
                orderTotal: total.toLocaleString(),
                orderItems: formatOrderItems(od),
                paymentMethod: 'クレジットカード決済（決済完了）',
                bankInfo: '',
                deliveryDate: od.selectedDate ? `${od.selectedDate} ${od.selectedTime || ''}`.trim() : '',
                shopPhone,
                recipientInfo: formatRecipientInfo(od),
                mypageUrl,
              };
              const { subject, body } = renderTemplate(tpl, vars);
              const html = bodyToHtml(body, { shopName });
              const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
              await sendEmail({ to: customerEmail, subject, html, from });
              console.log('[webhook] 注文確認メール送信完了:', customerEmail);

              // ★ LINE併送（有効時のみ）
              await sendLineParallelToEmail({
                supabaseAdmin,
                tenantSettings: settings,
                tenantId,
                customerEmail,
                text: `${subject}\n\n${body}`,
              });
            }
          }
        } catch (mailErr) {
          console.warn('[webhook] 注文確認メール送信失敗:', mailErr.message);
        }

        // ★ EC注文の場合は在庫を減算（RPC関数で原子的に）
        const cartItems = orderRow?.order_data?.cartItems;
        if (Array.isArray(cartItems) && cartItems.length > 0) {
          console.log('[webhook] EC注文(クレカ) 在庫減算開始:', cartItems.map(c => ({ id: c.productId, qty: c.qty })));
          for (const c of cartItems) {
            if (!c.productId) continue;
            const { data: result, error: rpcErr } = await supabaseAdmin.rpc('decrement_stock', {
              p_product_id: c.productId,
              p_qty: Number(c.qty || 0),
            });
            if (rpcErr) {
              console.error('[webhook] decrement_stock 失敗:', c.productId, rpcErr.message);
            } else if (result?.success) {
              console.log(`[webhook] 在庫減算成功: "${result.product_name}" → ${result.new_stock}`);
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
