// お客様向け 注文確定 API Route
// POST /api/orders
//
// Body: { tenantId, shopId, orderData, paymentMethod }
//   paymentMethod: 'card' | 'bank_transfer' | 'cod'
//
// 動作:
//   1. 入力の最低限のバリデーション
//   2. Service Role でorders にinsert（RLS対応のため必要）
//   3. paymentMethod === 'card' なら Stripe Checkout Session作成
//   4. レスポンスを返す: { orderId, checkoutUrl? }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, APP_URL } from '@/utils/stripe';
import { sendEmail } from '@/utils/email';
import { findTemplateFor, renderTemplate, bodyToHtml, formatOrderItems, formatRecipientInfo, formatLineAddFriendBlock } from '@/utils/emailTemplates';
import { sendLineParallelToEmail } from '@/utils/line';
import { createMypageMagicUrl } from '@/utils/mypageLink';

export async function POST(request) {
  try {
    const body = await request.json();
    const { tenantId, shopId, orderData, paymentMethod } = body;

    // ---- 入力バリデーション（最低限）----
    if (!tenantId) return NextResponse.json({ error: 'tenantId が必要' }, { status: 400 });
    if (!orderData) return NextResponse.json({ error: 'orderData が必要' }, { status: 400 });
    if (!['card', 'bank_transfer'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'paymentMethod が不正' }, { status: 400 });
    }

    // Service Role で書き込み（RLSをバイパス）
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'サーバー設定エラー（SUPABASE_SERVICE_ROLE_KEY未設定）' }, { status: 500 });
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ---- 金額の再計算（クライアントの数字を信用しない）----
    // EC注文（カート）の場合は cartItems から再計算
    let item = 0;
    let lineItemsForStripe = [];
    const isEcOrder = orderData.orderType === 'ec' && Array.isArray(orderData.cartItems);

    if (isEcOrder) {
      // 商品IDをDBで再検索して、価格と在庫を検証する
      const ids = orderData.cartItems.map(c => c.productId).filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ error: 'カートが空です' }, { status: 400 });

      const { data: dbProducts, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('id, name, price, stock, image_url, tenant_id, is_active')
        .in('id', ids);
      if (prodErr) return NextResponse.json({ error: '商品データの取得に失敗' }, { status: 500 });

      for (const c of orderData.cartItems) {
        const p = dbProducts.find(x => x.id === c.productId);
        if (!p) return NextResponse.json({ error: `商品が見つかりません` }, { status: 400 });
        if (String(p.tenant_id) !== String(tenantId)) return NextResponse.json({ error: '不正なテナントの商品が含まれています' }, { status: 400 });
        if (!p.is_active) return NextResponse.json({ error: `「${p.name}」は現在販売停止中です` }, { status: 400 });
        const qty = Math.max(1, Math.floor(Number(c.qty) || 0));
        if (qty > p.stock) return NextResponse.json({ error: `「${p.name}」の在庫が不足しています（在庫: ${p.stock}）` }, { status: 400 });
        item += p.price * qty;
        lineItemsForStripe.push({
          price_data: {
            currency: 'jpy',
            product_data: { name: p.name, images: p.image_url ? [p.image_url] : undefined },
            unit_amount: p.price,
          },
          quantity: qty,
        });
      }
    } else {
      // 既存のカスタム注文（単一）
      item = Number(orderData.itemPrice) || 0;
    }

    const fee = Number(orderData.calculatedFee) || 0;
    const pickup = Number(orderData.pickupFee) || 0;
    const subTotal = item + fee + pickup;
    const tax = Math.floor(subTotal * 0.1);
    const totalAmount = subTotal + tax;

    // 税込分のline_item を追加（カート注文の場合）
    if (isEcOrder && tax > 0) {
      lineItemsForStripe.push({
        price_data: {
          currency: 'jpy',
          product_data: { name: '消費税 (10%)' },
          unit_amount: tax,
        },
        quantity: 1,
      });
    }

    if (totalAmount <= 0) {
      return NextResponse.json({ error: '合計金額が不正です' }, { status: 400 });
    }

    // ---- ordersにinsert ----
    const initialPaymentStatus = paymentMethod === 'card' ? 'processing' : 'unpaid';
    const orderRecord = {
      tenant_id: String(tenantId),
      order_data: {
        ...orderData,
        paymentMethod,
        totalAmount,
        status: 'new',
      },
      payment_status: initialPaymentStatus,
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('orders')
      .insert([orderRecord])
      .select('id')
      .single();

    if (insertErr) {
      console.error('[/api/orders] insert error:', insertErr);
      return NextResponse.json({ error: '注文の登録に失敗しました' }, { status: 500 });
    }
    const orderId = inserted.id;

    // ---- お客様向け 注文確認メール送信 ----
    //   テンプレートシステム経由（設定で編集可能、未設定ならプリセット使用）
    async function sendConfirmationEmail() {
      try {
        const customerEmail = orderData.customerInfo?.email;
        if (!customerEmail) return;

        // 店舗情報・テンプレート取得
        const { data: settingsRow } = await supabaseAdmin
          .from('app_settings')
          .select('settings_data')
          .eq('id', tenantId)
          .single();
        const settings = settingsRow?.settings_data || {};
        const shop = settings.shops?.find(s => String(s.id) === String(shopId)) || settings.shops?.[0] || {};
        const shopName = shop.name || settings.generalConfig?.appName || 'お花屋さん';
        const bankInfo = shop.bankInfo || '';
        const shopPhone = shop.phone || '';

        // テンプレート取得（未設定ならプリセット）
        const tpl = findTemplateFor('order_confirmed', settings.autoReplyTemplates, { shopId: shop.id });
        if (!tpl) return;

        // 変数置換
        const paymentLabelMap = {
          card: 'クレジットカード決済（決済完了）',
          bank_transfer: '銀行振込',
        };
        // ★ マイページURL（Magic Link）発行
        const mypageUrl = await createMypageMagicUrl({
          supabaseAdmin,
          tenantId,
          shopId,
          email: customerEmail,
        });

        const vars = {
          customerName: orderData.customerInfo?.name || 'お客',
          shopName,
          orderId: String(orderId).slice(0, 8),
          orderTotal: totalAmount.toLocaleString(),
          orderItems: formatOrderItems(orderRecord.order_data),
          paymentMethod: paymentLabelMap[paymentMethod] || paymentMethod,
          bankInfo: paymentMethod === 'bank_transfer' && bankInfo ? `【お振込先】\n${bankInfo}\n※お振込手数料はお客様ご負担となります。` : '',
          deliveryDate: orderData.selectedDate ? `${orderData.selectedDate} ${orderData.selectedTime || ''}`.trim() : '',
          shopPhone,
          recipientInfo: formatRecipientInfo(orderRecord.order_data),
          mypageUrl,
          lineAddFriendUrl: formatLineAddFriendBlock(settings.lineConfig),
        };
        const { subject, body } = renderTemplate(tpl, vars);
        const html = bodyToHtml(body, { shopName });

        // FROM名を店舗名で上書き
        const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
        await sendEmail({ to: customerEmail, subject, html, from });

        // ★ LINE併送（有効時のみ）
        await sendLineParallelToEmail({
          supabaseAdmin,
          tenantSettings: settings,
          tenantId,
          customerEmail,
          text: `${subject}\n\n${body}`,
        });
      } catch (e) {
        console.warn('[orders] 注文確認メール送信失敗:', e.message);
      }
    }

    // ---- カード以外はそのまま完了（EC注文なら在庫減算） ----
    if (paymentMethod !== 'card') {
      // EC注文の銀行振込は、決済確認前に在庫を減らす（カードはwebhookで減らす）
      if (isEcOrder) {
        console.log('[orders] EC注文(銀行振込) 在庫減算開始:', orderData.cartItems.map(c => ({ id: c.productId, qty: c.qty })));
        for (const c of orderData.cartItems) {
          // ★ RPC関数で原子的に減算（並行注文時の整合性確保）
          const { data: result, error: rpcErr } = await supabaseAdmin.rpc('decrement_stock', {
            p_product_id: c.productId,
            p_qty: Number(c.qty || 0),
          });
          if (rpcErr) {
            console.error('[orders] decrement_stock 失敗:', c.productId, rpcErr.message);
            continue;
          }
          if (result?.success) {
            console.log(`[orders] 在庫減算成功: "${result.product_name}" → ${result.new_stock}`);
          } else {
            console.warn(`[orders] 在庫減算スキップ:`, result);
          }
        }
      }

      // 銀行振込はここで確定メール送信
      await sendConfirmationEmail();
      return NextResponse.json({ orderId });
    }

    // ---- カード決済: Stripe Checkout Session作成 ----
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe SDK 未初期化' }, { status: 500 });
    }

    // 店舗のStripe接続情報を取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const stripeAccountId = settingsRow?.settings_data?.stripe?.accountId;
    if (!stripeAccountId) {
      return NextResponse.json({ error: 'この店舗はStripe決済を有効化していません' }, { status: 400 });
    }

    // line_items の組み立て: EC注文ならカート商品ごと、それ以外は単一
    let line_items;
    if (isEcOrder && lineItemsForStripe.length > 0) {
      line_items = lineItemsForStripe;
    } else {
      const product_name = `${orderData.flowerType || 'お花'} - ${orderData.flowerPurpose || ''}`.trim();
      line_items = [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: product_name || 'お花のご注文',
              description: `お届け希望日: ${orderData.selectedDate || '指定なし'}`,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ];
    }

    const cancelUrl = isEcOrder
      ? `${APP_URL}/order/${tenantId}/${shopId}/cart?payment=cancel&order_id=${orderId}`
      : `${APP_URL}/order/${tenantId}/${shopId}?payment=cancel&order_id=${orderId}`;

    // ★ EC注文なら success_url に from=ec を付ける（サンクスページの戻り先制御用）
    const successUrl = isEcOrder
      ? `${APP_URL}/order/${tenantId}/${shopId}/thanks?order_id=${orderId}&payment=success&from=ec`
      : `${APP_URL}/order/${tenantId}/${shopId}/thanks?order_id=${orderId}&payment=success`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: orderData.customerInfo?.email || undefined,
        metadata: {
          order_id: orderId,
          tenant_id: String(tenantId),
        },
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    // checkout_session_id を orders に保存（webhookで照合）
    await supabaseAdmin
      .from('orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', orderId);

    return NextResponse.json({ orderId, checkoutUrl: session.url });
  } catch (err) {
    console.error('[/api/orders] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
