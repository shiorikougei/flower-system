// スタッフが注文に対してテンプレートメールを送信する API
// POST /api/staff/send-template-email
// Body: { orderId, triggerId }
//
// 動作:
//   1. 認証チェック（テナント一致確認）
//   2. 注文データ取得
//   3. 設定のテンプレート + 変数で本文生成
//   4. お客様にメール送信

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/utils/email';
import { findTemplateFor, renderTemplate, bodyToHtml, formatOrderItems, formatOrderBreakdown, formatRecipientInfo, formatLineAddFriendBlock } from '@/utils/emailTemplates';
import { sendLineParallelToEmail, getNotificationPreference } from '@/utils/line';
import { createMypageMagicUrl } from '@/utils/mypageLink';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

    const { orderId, triggerId, extraVars } = await request.json();
    if (!orderId || !triggerId) {
      return NextResponse.json({ error: 'orderId/triggerIdが必要' }, { status: 400 });
    }

    // 認証ユーザーのテナントを取得
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: '認証失敗' }, { status: 401 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'tenant_id取得失敗' }, { status: 400 });

    // 注文取得 + テナント検証
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, tenant_id, order_data, created_at, payment_status')
      .eq('id', orderId)
      .single();
    if (!order) return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 });
    if (order.tenant_id !== tenantId) return NextResponse.json({ error: '権限がありません' }, { status: 403 });

    const od = order.order_data || {};
    const customerEmail = od.customerInfo?.email;
    if (!customerEmail) return NextResponse.json({ error: 'お客様のメールアドレスが登録されていません' }, { status: 400 });

    // 設定 + テンプレート取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const settings = settingsRow?.settings_data || {};
    const shopId = od.shopId;
    const shop = settings.shops?.find(s => String(s.id) === String(shopId)) || settings.shops?.[0] || {};
    const shopName = shop.name || settings.generalConfig?.appName || 'お花屋さん';
    const shopPhone = shop.phone || '';
    const bankInfo = shop.bankInfo || '';

    const tpl = findTemplateFor(triggerId, settings.autoReplyTemplates, { shopId: shop.id });
    if (!tpl) return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 });

    // 金額計算
    const item = Number(od.itemPrice) || (Array.isArray(od.cartItems) ? od.cartItems.reduce((s, c) => s + Number(c.price) * Number(c.qty), 0) : 0);
    const fee = Number(od.calculatedFee) || 0;
    const pickup = Number(od.pickupFee) || 0;
    const total = (item + fee + pickup) + Math.floor((item + fee + pickup) * 0.1);

    const paymentLabelMap = {
      card: 'クレジットカード決済',
      bank_transfer: '銀行振込',
    };

    // 配送追跡情報: スタッフが入力した追跡番号 (extraVars.shippingTrackingNumber) があれば
    //   佐川の追跡URLを生成
    const trackingNo = String(extraVars?.shippingTrackingNumber || '').trim();
    const trackingUrl = trackingNo
      ? `https://k2k.sagawa-exp.co.jp/p/web/okurijoinput.do?okurijoNo=${encodeURIComponent(trackingNo)}`
      : '';
    const shippingInfoBlock = trackingNo
      ? `\n【配送業者の追跡番号】\n佐川急便  お問い合わせ番号: ${trackingNo}\n追跡URL: ${trackingUrl}\n`
      : '';

    const vars = {
      customerName: od.customerInfo?.name || 'お客',
      shopName,
      orderId: String(order.id).slice(0, 8),
      orderTotal: total.toLocaleString(),
      orderItems: formatOrderItems(od),
      orderBreakdown: formatOrderBreakdown(od),
      paymentMethod: paymentLabelMap[od.paymentMethod] || od.paymentMethod || '',
      bankInfo: bankInfo ? `【お振込先】\n${bankInfo}` : '',
      deliveryDate: od.selectedDate ? `${od.selectedDate} ${od.selectedTime || ''}`.trim() : '',
      // 発送日 (sagawa の場合は order_data.shippingDate, それ以外は今日の日付)
      shippingDate: od.shippingDate || new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }),
      // 配送追跡情報
      shippingTrackingNumber: trackingNo,
      shippingTrackingUrl: trackingUrl,
      shippingInfo: shippingInfoBlock,
      shopPhone,
      completionImageUrl: od.completionImage || '',
      recipientInfo: formatRecipientInfo(od),
      mypageUrl: await createMypageMagicUrl({ supabaseAdmin, tenantId, shopId: od.shopId, email: customerEmail }),
      lineAddFriendUrl: formatLineAddFriendBlock(settings.lineConfig, customerEmail),
    };

    const { subject, body } = renderTemplate(tpl, vars);
    const html = bodyToHtml(body, { shopName, shopEmail: shop.email || settings.generalConfig?.email || '', shopPhone, lineAddFriendUrl: settings.lineConfig?.addFriendUrl || '' });
    const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;

    // お客様の通知設定を取得
    const pref = await getNotificationPreference(supabaseAdmin, tenantId, customerEmail);
    // 'line_only' なら メール送信スキップ (LINE側のみ送信)
    let emailResult = { skipped: true, reason: 'preference_line_only' };
    if (pref !== 'line_only') {
      emailResult = await sendEmail({ to: customerEmail, subject, html, from });
      if (emailResult.error) {
        // メールエラーでもLINEは送る（最低限通知届くように）
        console.warn('[send-template-email] mail error', emailResult.error);
      }
    }

    // LINE連携が有効ならLINEにも送信（preference='email_only'時はsendLineParallelToEmail内でスキップ）
    const lineResult = await sendLineParallelToEmail({
      supabaseAdmin,
      tenantSettings: settings,
      tenantId,
      customerEmail,
      text: `${subject}\n\n${body}`,
      imageUrl: triggerId === 'completion_photo' ? od.completionImage : null,
    });

    return NextResponse.json({ sent: true, email: emailResult, line: lineResult, preference: pref });
  } catch (err) {
    console.error('[send-template-email] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
