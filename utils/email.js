// サーバー側専用 メール送信ユーティリティ（Resend）
// ⚠️ API Route からのみ import すること（RESEND_API_KEY を含む）

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const DEFAULT_FROM = process.env.EMAIL_FROM || 'order@noodleflorix.com';
const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Florix';

/**
 * メール送信
 * @param {object} params
 * @param {string} params.to - 宛先メールアドレス
 * @param {string} params.subject - 件名
 * @param {string} params.html - HTML本文
 * @param {string} [params.from] - 送信元（オプション）
 * @param {string[]} [params.bcc] - BCC（オプション）
 */
export async function sendEmail({ to, subject, html, from, bcc }) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY が未設定のためメール送信スキップ');
    return { skipped: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from || `${DEFAULT_FROM_NAME} <${DEFAULT_FROM}>`,
      to,
      subject,
      html,
      ...(bcc ? { bcc } : {}),
    });
    if (error) {
      console.error('[email] 送信失敗:', error);
      return { error };
    }
    return { data };
  } catch (err) {
    console.error('[email] 例外:', err);
    return { error: err };
  }
}

/**
 * 注文確認メール
 */
export function buildOrderConfirmationEmail({ order, shopName, bankInfo }) {
  const d = order.order_data || {};
  const orderId = String(order.id || '').slice(0, 8);
  const customerName = d.customerInfo?.name || 'お客様';

  // 金額計算
  const item = Number(d.itemPrice) || 0;
  const fee = Number(d.calculatedFee) || 0;
  const pickup = Number(d.pickupFee) || 0;
  const subTotal = item + fee + pickup;
  const tax = Math.floor(subTotal * 0.1);
  const total = subTotal + tax;

  // 商品リスト
  let itemsHtml = '';
  if (Array.isArray(d.cartItems) && d.cartItems.length > 0) {
    itemsHtml = d.cartItems.map(c => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #EEE;">${escapeHtml(c.name)}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #EEE; text-align: right;">× ${c.qty}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #EEE; text-align: right;">¥${Number(c.price * c.qty).toLocaleString()}</td>
      </tr>
    `).join('');
  } else if (d.flowerType) {
    itemsHtml = `
      <tr>
        <td colspan="3" style="padding: 8px 0; border-bottom: 1px solid #EEE;">
          <strong>${escapeHtml(d.flowerType)}</strong><br>
          <span style="font-size: 11px; color: #999;">用途: ${escapeHtml(d.flowerPurpose || '-')} / カラー: ${escapeHtml(d.flowerColor || '-')} / イメージ: ${escapeHtml(d.flowerVibe || '-')}</span>
        </td>
      </tr>
    `;
  }

  // 支払い方法ごとの案内
  const paymentMethod = d.paymentMethod;
  let paymentInfoHtml = '';
  if (paymentMethod === 'card') {
    paymentInfoHtml = `<p style="color: #2D4B3E; font-weight: bold;">✓ クレジットカードでのお支払いが完了しています</p>`;
  } else if (paymentMethod === 'bank_transfer' && bankInfo) {
    paymentInfoHtml = `
      <h3 style="color: #2D4B3E; font-size: 14px; margin-top: 24px;">お振込先</h3>
      <pre style="background: #FBFAF9; padding: 12px; border-radius: 8px; border: 1px solid #EAEAEA; font-family: sans-serif; font-size: 12px; white-space: pre-wrap;">${escapeHtml(bankInfo)}</pre>
      <p style="font-size: 11px; color: #999;">※お振込手数料はお客様ご負担となります。</p>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>ご注文ありがとうございます</title>
</head>
<body style="margin: 0; padding: 0; background: #FBFAF9; font-family: 'Hiragino Sans', sans-serif; color: #111;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px 24px;">

    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #2D4B3E; font-size: 22px; margin: 0 0 8px 0;">ご注文ありがとうございます</h1>
      <p style="color: #555; font-size: 13px; margin: 0;">${escapeHtml(shopName)}</p>
    </div>

    <p style="font-size: 14px;">${escapeHtml(customerName)} 様</p>
    <p style="font-size: 13px; line-height: 1.7;">
      この度はご注文いただき、誠にありがとうございます。<br>
      下記の内容でご注文を承りました。
    </p>

    <div style="background: #FBFAF9; border: 1px solid #EAEAEA; border-radius: 12px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0 0 4px 0; font-size: 11px; color: #999;">ご注文番号</p>
      <p style="margin: 0; font-family: monospace; font-size: 14px; color: #2D4B3E;">${orderId}</p>
    </div>

    <h3 style="color: #2D4B3E; font-size: 14px; border-bottom: 2px solid #2D4B3E; padding-bottom: 4px;">ご注文内容</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      ${itemsHtml}
    </table>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #EAEAEA;">
      <table style="width: 100%; font-size: 12px; color: #555;">
        <tr><td>商品代（税抜）</td><td style="text-align: right;">¥${item.toLocaleString()}</td></tr>
        ${fee > 0 ? `<tr><td>配送料</td><td style="text-align: right;">¥${fee.toLocaleString()}</td></tr>` : ''}
        ${pickup > 0 ? `<tr><td>後日回収費</td><td style="text-align: right;">¥${pickup.toLocaleString()}</td></tr>` : ''}
        <tr><td>消費税（10%）</td><td style="text-align: right;">¥${tax.toLocaleString()}</td></tr>
        <tr><td colspan="2"><hr style="border: none; border-top: 1px solid #EAEAEA; margin: 8px 0;"></td></tr>
        <tr style="font-size: 14px; font-weight: bold; color: #2D4B3E;">
          <td>合計（税込）</td>
          <td style="text-align: right;">¥${total.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    ${paymentInfoHtml}

    ${d.selectedDate ? `
      <h3 style="color: #2D4B3E; font-size: 14px; margin-top: 24px;">お届け予定</h3>
      <p style="font-size: 12px;">${escapeHtml(d.selectedDate)} ${escapeHtml(d.selectedTime || '')}</p>
    ` : ''}

    <p style="font-size: 11px; color: #999; margin-top: 32px; line-height: 1.6;">
      ご不明な点がございましたら、${escapeHtml(shopName)} までお問い合わせください。<br>
      このメールはご注文を確認した時点で自動送信されています。
    </p>
  </div>
</body>
</html>`;

  return {
    subject: `【${shopName}】ご注文ありがとうございます (注文番号: ${orderId})`,
    html,
  };
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
