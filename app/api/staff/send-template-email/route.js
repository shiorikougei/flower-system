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
import { findTemplateFor, renderTemplate, bodyToHtml, formatOrderItems, formatRecipientInfo, formatLineAddFriendBlock } from '@/utils/emailTemplates';
import { sendLineParallelToEmail } from '@/utils/line';
import { createMypageMagicUrl } from '@/utils/mypageLink';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

    const { orderId, triggerId } = await request.json();
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

    const vars = {
      customerName: od.customerInfo?.name || 'お客',
      shopName,
      orderId: String(order.id).slice(0, 8),
      orderTotal: total.toLocaleString(),
      orderItems: formatOrderItems(od),
      paymentMethod: paymentLabelMap[od.paymentMethod] || od.paymentMethod || '',
      bankInfo: bankInfo ? `【お振込先】\n${bankInfo}` : '',
      deliveryDate: od.selectedDate ? `${od.selectedDate} ${od.selectedTime || ''}`.trim() : '',
      shopPhone,
      completionImageUrl: od.completionImage || '',
      recipientInfo: formatRecipientInfo(od),
      mypageUrl: await createMypageMagicUrl({ supabaseAdmin, tenantId, shopId: od.shopId, email: customerEmail }),
      lineAddFriendUrl: formatLineAddFriendBlock(settings.lineConfig),
    };

    const { subject, body } = renderTemplate(tpl, vars);
    const html = bodyToHtml(body, { shopName });
    const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
    const result = await sendEmail({ to: customerEmail, subject, html, from });

    if (result.error) {
      return NextResponse.json({ error: 'メール送信に失敗しました', detail: result.error }, { status: 500 });
    }

    // ★ LINE連携が有効ならLINEにも送信（並列、失敗してもメール送信は成功扱い）
    const lineResult = await sendLineParallelToEmail({
      supabaseAdmin,
      tenantSettings: settings,
      tenantId,
      customerEmail,
      text: `${subject}\n\n${body}`,
      imageUrl: triggerId === 'completion_photo' ? od.completionImage : null,
    });

    return NextResponse.json({ sent: true, line: lineResult });
  } catch (err) {
    console.error('[send-template-email] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
