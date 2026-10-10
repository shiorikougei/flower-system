// [2026-10 C5] 店頭払い・税込 22,000 円超の注文の電話確認
// POST /api/staff/phone-confirmation
//   body: { orderId, action: 'confirm' | 'send_card_link', staffName? }
//   - confirm        : 電話で確認できた → 注文を確定（店頭払いのまま）
//   - send_card_link : 電話で確認できなかった → カード払いのご案内（決済リンク・期限 約 24 時間）をお客様にメール
//                      期限までに支払いがなければ、日次処理でキャンセル扱いにする（データは残す）
// スタッフ認証・自分のお店の注文のみ

import { NextResponse } from 'next/server';
import { requireTenantStaff } from '@/utils/adminAuth';
import { stripe, APP_URL } from '@/utils/stripe';
import { sendEmail, shopContactInfo, noReplyFooter } from '@/utils/email';
import { escapeHtml } from '@/utils/emailTemplates';

export const runtime = 'nodejs';

// Stripe の決済ページは最長 24 時間。少し余裕を見て 23 時間 50 分
const CARD_LINK_SECONDS = 23 * 60 * 60 + 50 * 60;

export async function POST(request) {
  const auth = await requireTenantStaff(request);
  if (!auth.ok) return auth.response;
  try {
    const { orderId, action, staffName } = await request.json();
    if (!orderId || !['confirm', 'send_card_link'].includes(action)) {
      return NextResponse.json({ error: '操作が正しくありません' }, { status: 400 });
    }
    const supabase = auth.supabaseAdmin;
    const { data: order } = await supabase
      .from('orders')
      .select('id, tenant_id, payment_status, order_data')
      .eq('id', orderId)
      .maybeSingle();
    if (!order || String(order.tenant_id) !== String(auth.tenant_id)) {
      return NextResponse.json({ error: '注文が見つかりません' }, { status: 404 });
    }
    const od = order.order_data || {};
    const pc = od.phoneConfirmation;
    if (!pc || pc.status !== 'pending') {
      return NextResponse.json({ error: 'この注文は電話確認の対象ではありません（すでに処理済みの可能性があります）' }, { status: 400 });
    }
    const who = String(staffName || '').slice(0, 50) || '-';
    const now = new Date().toISOString();

    if (action === 'confirm') {
      const next = {
        ...od,
        phoneConfirmation: { ...pc, status: 'confirmed', confirmedAt: now, confirmedBy: who },
        statusHistory: [{ status: '電話確認OK', staff: who, date: now }, ...(Array.isArray(od.statusHistory) ? od.statusHistory : [])],
      };
      const { error } = await supabase.from('orders').update({ order_data: next }).eq('id', orderId);
      if (error) throw error;
      return NextResponse.json({ ok: true, status: 'confirmed' });
    }

    // ---- send_card_link: カード払いのご案内 ----
    if (!stripe) return NextResponse.json({ error: 'カード決済の設定がありません' }, { status: 500 });
    const { data: settingsRow } = await supabase.from('app_settings').select('settings_data').eq('id', order.tenant_id).maybeSingle();
    const settings = settingsRow?.settings_data || {};
    const stripeAccountId = settings.stripe?.accountId;
    if (!stripeAccountId) return NextResponse.json({ error: 'カード決済が設定されていません' }, { status: 400 });
    const customerEmail = od.customerInfo?.email;
    if (!customerEmail) return NextResponse.json({ error: 'お客様のメールアドレスが登録されていません。お電話でご案内してください' }, { status: 400 });
    const total = Number(od.totalAmount) || 0;
    if (total <= 0) return NextResponse.json({ error: '注文の合計金額が正しくありません' }, { status: 400 });

    const shopId = od.shopId || 'default';
    const expiresAt = Math.floor(Date.now() / 1000) + CARD_LINK_SECONDS;
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'jpy',
            product_data: { name: `${od.flowerType || 'お花'}のご注文（注文番号 ${od.managementNo || String(orderId).slice(0, 8)}）` },
            unit_amount: total,
          },
          quantity: 1,
        }],
        expires_at: expiresAt,
        success_url: `${APP_URL}/order/${order.tenant_id}/${shopId}/thanks?order_id=${orderId}&payment=success`,
        cancel_url: `${APP_URL}/order/${order.tenant_id}/${shopId}`,
        customer_email: customerEmail,
        metadata: { order_id: orderId, tenant_id: String(order.tenant_id) },
        payment_intent_data: { metadata: { order_id: orderId, tenant_id: String(order.tenant_id) } },
      },
      { stripeAccount: stripeAccountId }
    );

    const deadline = new Date(expiresAt * 1000);
    const next = {
      ...od,
      paymentMethod: 'card',
      phoneConfirmation: { ...pc, status: 'card_link_sent', cardLinkSentAt: now, cardLinkSentBy: who, cardLinkExpiresAt: deadline.toISOString() },
      statusHistory: [{ status: 'カード払いのご案内を送信', staff: who, date: now }, ...(Array.isArray(od.statusHistory) ? od.statusHistory : [])],
    };
    const { error: upErr } = await supabase
      .from('orders')
      .update({ order_data: next, payment_status: 'processing', stripe_checkout_session_id: session.id })
      .eq('id', orderId);
    if (upErr) throw upErr;

    const info = shopContactInfo(settings, od.shopId);
    const deadlineText = deadline.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const html = `<!DOCTYPE html><html lang="ja"><body style="font-family:'Hiragino Sans',sans-serif;padding:20px;background:#FBFAF9;">
      <div style="max-width:600px;margin:0 auto;background:white;padding:30px;border-radius:12px;">
        <h2 style="color:#117768;margin:0 0 16px;">お支払い方法のご案内</h2>
        <p>${escapeHtml(od.customerInfo?.name || '')} 様</p>
        <p>このたびはご注文いただき、誠にありがとうございます。<br/>
        ご注文の確認のためお電話をさせていただきましたが、ご連絡がつかなかったため、クレジットカードでのお支払いをお願いしております。</p>
        <div style="background:#f0fdf4;border:2px solid #117768;padding:16px;border-radius:12px;margin:16px 0;">
          <p style="margin:0;font-size:12px;color:#555;">ご注文番号: ${escapeHtml(od.managementNo || String(orderId).slice(0, 8))}</p>
          <p style="margin:6px 0 0;font-size:24px;font-weight:bold;color:#117768;">¥${total.toLocaleString()}（税込）</p>
        </div>
        <p style="margin:20px 0;text-align:center;">
          <a href="${session.url}" style="display:inline-block;background:#117768;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">クレジットカードで支払う</a>
        </p>
        <p style="background:#FEF3C7;color:#92400E;padding:12px;border-radius:8px;font-size:13px;">
          <strong>お支払いの期限: ${escapeHtml(deadlineText)} まで</strong><br/>
          期限までにお支払いが確認できない場合は、ご注文はキャンセルとなります。
        </p>
        ${noReplyFooter({ shopName: info.shopName, shopEmail: info.shopEmail, shopPhone: info.shopPhone, lineAddFriendUrl: info.lineAddFriendUrl })}
      </div>
    </body></html>`;
    const mail = await sendEmail({
      to: customerEmail,
      from: `${info.shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
      subject: `【${info.shopName}】お支払い方法のご案内（${deadlineText}まで）`,
      html,
    });
    return NextResponse.json({ ok: true, status: 'card_link_sent', expiresAt: deadline.toISOString(), mailed: !mail?.error && !mail?.skipped });
  } catch (e) {
    console.error('[/api/staff/phone-confirmation]', e?.message);
    return NextResponse.json({ error: '処理に失敗しました' }, { status: 500 });
  }
}
