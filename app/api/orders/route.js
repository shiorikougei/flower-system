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
import { findTemplateFor, renderTemplate, bodyToHtml, formatOrderItems, formatOrderBreakdown, formatRecipientInfo, formatLineAddFriendBlock, escapeHtml } from '@/utils/emailTemplates';
import { sendLineParallelToEmail } from '@/utils/line';
import { createMypageMagicUrl } from '@/utils/mypageLink';
import { rateLimit, getClientIp } from '@/utils/rateLimit';
import { validateOrderData } from '@/utils/orderValidator';

export async function POST(request) {
  try {
    // ★ レート制限（同一IPから10件/分まで）— DB圧迫攻撃防止
    const ip = getClientIp(request);
    const allowed = await rateLimit({ key: `orders:${ip}`, max: 10, windowSec: 60 });
    if (!allowed) {
      return NextResponse.json({ error: 'リクエスト過多です。しばらくしてから再度お試しください。' }, { status: 429 });
    }

    const body = await request.json();
    const { tenantId, shopId, orderData, paymentMethod } = body;

    // ---- 入力バリデーション（最低限）----
    if (!tenantId) return NextResponse.json({ error: 'tenantId が必要' }, { status: 400 });
    if (!orderData) return NextResponse.json({ error: 'orderData が必要' }, { status: 400 });

    // ★ スタッフ代理入力フラグ検証（クライアントから送られたフラグだけは信用しない）
    //    Bearer トークンを検証し、認証ユーザーのtenant_idが一致する場合のみ true として扱う
    let isStaffEntered = false;
    if (orderData.isStaffEntered) {
      const authHeader = request.headers.get('authorization') || '';
      const accessToken = authHeader.replace(/^Bearer\s+/i, '');
      if (!accessToken) {
        // 認証なしならフラグを無効化（一般顧客フローとして扱う）
        orderData.isStaffEntered = false;
      } else {
        try {
          const supabaseUser = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
          );
          const { data: { user } } = await supabaseUser.auth.getUser();
          if (!user) {
            orderData.isStaffEntered = false;
          } else {
            const supabaseAdminTmp = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL,
              process.env.SUPABASE_SERVICE_ROLE_KEY
            );
            const { data: profile } = await supabaseAdminTmp
              .from('profiles')
              .select('tenant_id')
              .eq('id', user.id)
              .single();
            if (profile?.tenant_id && String(profile.tenant_id) === String(tenantId)) {
              isStaffEntered = true; // 認証OK＋tenant一致でのみ承認
            } else {
              orderData.isStaffEntered = false;
              return NextResponse.json({ error: '権限がありません（他テナントのデータは操作できません）' }, { status: 403 });
            }
          }
        } catch (e) {
          orderData.isStaffEntered = false;
        }
      }
    }

    // ★ paymentMethod 検証: スタッフ代理時のみ緩和
    if (!isStaffEntered && !['card', 'bank_transfer'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'paymentMethod が不正' }, { status: 400 });
    }

    // ---- 詳細バリデーション（DoS・XSS・不正入力防止）----
    const validation = validateOrderData(orderData);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
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

    let ecBoxFee = 0; // ★ EC専用 箱代
    if (isEcOrder) {
      // 商品IDをDBで再検索して、価格と在庫を検証する
      const ids = orderData.cartItems.map(c => c.productId).filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ error: 'カートが空です' }, { status: 400 });

      const { data: dbProducts, error: prodErr } = await supabaseAdmin
        .from('products')
        .select('id, name, price, stock, image_url, tenant_id, is_active, box_size, options')
        .in('id', ids);
      if (prodErr) return NextResponse.json({ error: '商品データの取得に失敗' }, { status: 500 });

      // ★ カート内の最大サイズを判定（数値サイズ: 60, 80, 100, 120 等を比較）
      let maxSize = null;
      let maxRank = -1;

      for (const c of orderData.cartItems) {
        const p = dbProducts.find(x => x.id === c.productId);
        if (!p) return NextResponse.json({ error: `商品が見つかりません` }, { status: 400 });
        if (String(p.tenant_id) !== String(tenantId)) return NextResponse.json({ error: '不正なテナントの商品が含まれています' }, { status: 400 });
        if (!p.is_active) return NextResponse.json({ error: `「${p.name}」は現在販売停止中です` }, { status: 400 });
        const qty = Math.max(1, Math.floor(Number(c.qty) || 0));
        if (qty > p.stock) return NextResponse.json({ error: `「${p.name}」の在庫が不足しています（在庫: ${p.stock}）` }, { status: 400 });

        // ★ オプション金額をサーバー側で再検証（クライアントの数字を信用しない）
        const productOpts = p.options || {};
        const selected = c.selectedOptions || {};
        let serverOptTotal = 0;
        const verifiedOptions = {};
        if (selected.wrapping && productOpts.wrapping?.enabled) {
          const price = Number(productOpts.wrapping.price) || 0;
          serverOptTotal += price;
          verifiedOptions.wrapping = { price };
        }
        if (selected.messageCard && productOpts.messageCard?.enabled) {
          const price = Number(productOpts.messageCard.price) || 0;
          serverOptTotal += price;
          verifiedOptions.messageCard = { price, text: String(selected.messageCard.text || '').slice(0, 500) };
        }
        if (selected.textInsertion && productOpts.textInsertion?.enabled) {
          const price = Number(productOpts.textInsertion.price) || 0;
          const maxLen = Number(productOpts.textInsertion.maxLength) || 30;
          const allowKanji = Boolean(productOpts.textInsertion.allowKanji);
          const text = String(selected.textInsertion.text || '').slice(0, maxLen);
          if (!allowKanji && /[一-鿿]/.test(text)) {
            return NextResponse.json({ error: `「${p.name}」の文字入れに漢字は使用できません` }, { status: 400 });
          }
          const validPositions = Array.isArray(productOpts.textInsertion.positions) ? productOpts.textInsertion.positions : [];
          const position = validPositions.includes(selected.textInsertion.position) ? selected.textInsertion.position : (validPositions[0] || '');
          serverOptTotal += price;
          verifiedOptions.textInsertion = { price, text, position };
        }
        // クライアントから来たオプション情報をサーバー検証済みに置き換え
        c.selectedOptions = Object.keys(verifiedOptions).length > 0 ? verifiedOptions : null;
        c.optionsTotal = serverOptTotal;

        const unitWithOpt = p.price + serverOptTotal;
        item += unitWithOpt * qty;
        // 数値ベース比較（'80', '100', '120' 等）
        const r = Number(p.box_size) || 0;
        if (r > maxRank) { maxRank = r; maxSize = p.box_size || null; }
        lineItemsForStripe.push({
          price_data: {
            currency: 'jpy',
            product_data: { name: p.name + (serverOptTotal > 0 ? '（オプション込み）' : ''), images: p.image_url ? [p.image_url] : undefined },
            unit_amount: unitWithOpt,
          },
          quantity: qty,
        });
      }

      // ★ 設定から EC箱代マスター取得 → 最大サイズの箱代を加算
      const { data: settingsRow } = await supabaseAdmin
        .from('app_settings').select('settings_data').eq('id', String(tenantId)).single();
      const ecBoxFees = settingsRow?.settings_data?.boxFeeConfig?.ecBoxFees || {};
      ecBoxFee = maxSize ? (Number(ecBoxFees[maxSize]) || 0) : 0;
      if (ecBoxFee > 0) {
        lineItemsForStripe.push({
          price_data: {
            currency: 'jpy',
            product_data: { name: `梱包代 (${maxSize}サイズ)` },
            unit_amount: ecBoxFee,
          },
          quantity: 1,
        });
      }
    } else {
      // 既存のカスタム注文（単一）
      item = Number(orderData.itemPrice) || 0;
    }

    const fee = Number(orderData.calculatedFee) || 0;
    const pickup = Number(orderData.pickupFee) || 0;
    const subTotal = item + fee + pickup + ecBoxFee;
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

    // ---- 管理番号採番 (YYYYMMDD-NNN) ----
    const today = new Date();
    const yyyymmdd = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1).toISOString();
    const { count: todayCount } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', String(tenantId))
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay);
    const seq = String((todayCount || 0) + 1).padStart(3, '0');
    const managementNo = `${yyyymmdd}-${seq}`;

    // ---- ordersにinsert ----
    // ★ スタッフ代理入力: 前払い済み→paid / それ以外→unpaid
    let initialPaymentStatus;
    if (isStaffEntered) {
      const psLabel = String(orderData.paymentStatus || '');
      initialPaymentStatus = psLabel.includes('前払い済み') ? 'paid' : 'unpaid';
    } else {
      initialPaymentStatus = paymentMethod === 'card' ? 'processing' : 'unpaid';
    }
    const orderRecord = {
      tenant_id: String(tenantId),
      order_data: {
        ...orderData,
        paymentMethod,
        totalAmount,
        status: 'new',
        managementNo,  // ★ 管理番号
        ecBoxFee,      // ★ EC箱代
        // ★ EC注文はサーバー側で検証した金額を上書き保存
        ...(isEcOrder ? { itemPrice: item } : {}),
      },
      payment_status: initialPaymentStatus,
      // [業務-3] 担当者個人受付の場合の売上帰属（NULL OK）
      attributed_staff_id: orderData.attributedStaffId || null,
      attributed_staff_name: orderData.attributedStaffName || null,
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

    // ★ お見積もり経由の場合、estimates テーブルを converted に
    if (orderData?.fromEstimate && orderData?.estimateId) {
      try {
        await supabaseAdmin
          .from('estimates')
          .update({ status: 'converted', order_id: orderId })
          .eq('id', orderData.estimateId);
      } catch (e) {
        console.warn('[/api/orders] estimate mark converted失敗:', e?.message);
      }
    }

    // ---- お客様向け 注文確認メール送信 ----
    //   テンプレートシステム経由（設定で編集可能、未設定ならプリセット使用）
    async function sendConfirmationEmail() {
      try {
        // ★ スタッフ代理入力で「自動返信OFF」が選ばれている場合はメール/LINEともにスキップ
        if (isStaffEntered && orderData.sendAutoReply === false) {
          return;
        }
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
        // ★ スタッフ代理入力: order_data.paymentStatusの日本語ラベルを優先
        const paymentLabel = isStaffEntered && orderData.paymentStatus
          ? String(orderData.paymentStatus)
          : (paymentLabelMap[paymentMethod] || paymentMethod);
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
          orderBreakdown: formatOrderBreakdown(orderRecord.order_data),
          paymentMethod: paymentLabel,
          bankInfo: !isStaffEntered && paymentMethod === 'bank_transfer' && bankInfo
            ? `【お振込先】\n${bankInfo}\n※お振込手数料はお客様ご負担となります。\n\n⏱️ お振込み確認後から制作を開始いたします。${orderData.paymentScheduledDate ? `\n📅 ご入金予定日: ${orderData.paymentScheduledDate}` : ''}\n\n📞 ご入金のタイミングに関するご相談・ご質問は、お電話にてお問い合わせください。\n${shopPhone ? `   TEL: ${shopPhone}` : ''}`
            : '',
          deliveryDate: orderData.selectedDate ? `${orderData.selectedDate} ${orderData.selectedTime || ''}`.trim() : '',
          shopPhone,
          recipientInfo: formatRecipientInfo(orderRecord.order_data),
          mypageUrl,
          lineAddFriendUrl: formatLineAddFriendBlock(settings.lineConfig, customerEmail),
        };
        const { subject, body } = renderTemplate(tpl, vars);
        const html = bodyToHtml(body, { shopName, shopEmail: shop.email || settings.generalConfig?.email || '', shopPhone, lineAddFriendUrl: settings.lineConfig?.addFriendUrl || '' });

        // FROM名を店舗名で上書き
        const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
        await sendEmail({ to: customerEmail, subject, html, from });

        // ★ LINE併送（有効時のみ）
        //    スタッフ代理入力で「LINEで送る」OFFの場合は併送しない
        if (!(isStaffEntered && orderData.sendLineNotification === false)) {
          await sendLineParallelToEmail({
            supabaseAdmin,
            tenantSettings: settings,
            tenantId,
            customerEmail,
            text: `${subject}\n\n${body}`,
          });
        }
      } catch (e) {
        console.warn('[orders] 注文確認メール送信失敗:', e.message);
      }
    }

    // ---- ★ 店舗 受注通知メール送信（管理者向け）----
    async function sendStoreNotificationEmail(eventType = 'order') {
      try {
        // 店舗情報・テンプレート取得
        const { data: settingsRow } = await supabaseAdmin
          .from('app_settings')
          .select('settings_data')
          .eq('id', tenantId)
          .single();
        const settings = settingsRow?.settings_data || {};
        const shop = settings.shops?.find(s => String(s.id) === String(shopId)) || settings.shops?.[0] || {};

        // 通知先メアド未設定 or 該当タイミングOFFならスキップ
        const notifyEmail = (shop.notifyEmail || '').trim();
        if (!notifyEmail) return;
        if (eventType === 'order' && shop.notifyOnOrder === false) return;
        if (eventType === 'payment' && shop.notifyOnPayment === false) return;

        // CC（カンマ区切り）
        const ccEmails = (shop.notifyCcEmails || '')
          .split(',').map(s => s.trim()).filter(Boolean);

        const shopName = shop.name || settings.generalConfig?.appName || 'お花屋さん';
        const shopPhone = shop.phone || '';
        const customerName = orderData.customerInfo?.name || 'お客様';
        const shortOrderId = String(orderId).slice(0, 8);

        const eventLabel = eventType === 'payment' ? '【決済完了】' : '【新規注文】';
        const subject = `${eventLabel} ${customerName}様より受注 (#${shortOrderId}) - ${shopName}`;

        // 本文: お客様への確認メールと同じ詳細をHTMLで作成
        const { buildOrderConfirmationEmail } = await import('@/utils/email');
        const bankInfo = shop.bankInfo || '';
        const { html: customerHtml } = buildOrderConfirmationEmail({
          order: { id: orderId, order_data: orderRecord.order_data },
          shopName,
          bankInfo,
        });
        // ★ [Phase1-③ XSS対策] 顧客入力(customerName)・店舗入力(shopPhone等)を全てescapeHtml
        const storeBanner = `
          <div style="background:#117768; color:white; padding:16px 20px; border-radius:8px 8px 0 0; font-size:14px; font-weight:bold;">
            📥 ${escapeHtml(eventLabel)} 新しい注文が入りました
          </div>
          <div style="background:#f4faf8; padding:14px 20px; border-left:4px solid #117768; margin-bottom:16px; font-size:12px; color:#333; line-height:1.6;">
            <strong>お客様:</strong> ${escapeHtml(customerName)} 様<br/>
            <strong>注文ID:</strong> ${escapeHtml(shortOrderId)}<br/>
            <strong>合計金額:</strong> ¥${totalAmount.toLocaleString()}（税込）<br/>
            <strong>受付日時:</strong> ${new Date().toLocaleString('ja-JP')}<br/>
            ${shopPhone ? `<strong>店舗TEL:</strong> ${escapeHtml(shopPhone)}<br/>` : ''}
            <span style="font-size:11px; color:#666;">↓ 以下、お客様への確認メールと同じ内容です ↓</span>
          </div>
        `;
        const html = storeBanner + customerHtml;

        const from = `${shopName} 受注通知 <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
        await sendEmail({
          to: notifyEmail,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          subject,
          html,
          from,
        });
      } catch (e) {
        console.warn('[orders] 店舗通知メール送信失敗:', e.message);
      }
    }

    // ---- スタッフ代理入力 / カード以外はそのまま完了（EC注文なら在庫減算） ----
    if (isStaffEntered || paymentMethod !== 'card') {
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

      // ★ メール送信はバックグラウンドで実行（フォーム応答を早く返すため）
      sendConfirmationEmail().catch(e => console.warn('[orders] 確認メール bg:', e?.message));
      sendStoreNotificationEmail('order').catch(e => console.warn('[orders] 店舗通知 bg:', e?.message));
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

    // ★ クレカ決済も「注文が入った」段階で店舗通知（決済完了通知は webhook で別途送信）
    //    バックグラウンドで送信 → 即レスポンス
    sendStoreNotificationEmail('order').catch(e => console.warn('[orders] 店舗通知 bg(card):', e?.message));

    return NextResponse.json({ orderId, checkoutUrl: session.url });
  } catch (err) {
    console.error('[/api/orders] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
