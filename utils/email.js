// サーバー側専用 メール送信ユーティリティ（Resend）
// ⚠️ API Route からのみ import すること（RESEND_API_KEY を含む）

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const DEFAULT_FROM = process.env.EMAIL_FROM || 'order@noodleflorix.com';
const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Florix';

/**
 * 送信専用フッター（共通）
 * このメールアドレスへの返信は確認されない旨をお客様に明示
 * @param {object} opts
 * @param {string} [opts.shopName] - 店舗名
 * @param {string} [opts.shopEmail] - 店舗連絡先メアド
 * @param {string} [opts.shopPhone] - 店舗電話
 * @param {string} [opts.lineAddFriendUrl] - LINE友達追加URL
 * @param {string} [opts.contactEmail] - 後方互換用 (旧引数)
 */
export function noReplyFooter({
  shopName = '',
  shopEmail = '',
  shopPhone = '',
  lineAddFriendUrl = '',
  contactEmail = '', // 後方互換
} = {}) {
  // 連絡先メアドの決定 (shopEmail優先 / なければ contactEmail / それもなければ NocoLde の問い合わせ)
  const email = shopEmail || contactEmail || 'marusyou.reishin@gmail.com';
  const contactLines = [];
  if (email) contactLines.push(`📧 <a href="mailto:${email}" style="color:#92722c;text-decoration:underline;">${email}</a>`);
  if (shopPhone) contactLines.push(`📞 <a href="tel:${shopPhone}" style="color:#92722c;text-decoration:underline;">${shopPhone}</a>`);
  if (lineAddFriendUrl) contactLines.push(`💬 公式LINE: <a href="${lineAddFriendUrl}" style="color:#06C755;text-decoration:underline;">友達追加して問い合わせ</a>`);

  return `
    <div style="margin-top:32px;padding:14px;background:#f9f5ed;border:1pt solid #e5d9bd;border-radius:8px;font-size:11px;color:#92722c;line-height:1.7;">
      ⚠️ <strong>このメールは送信専用アドレスから自動送信されています。</strong><br/>
      ご返信いただいてもご対応できかねますので、お問い合わせは下記${shopName ? `（${shopName}）` : ''}までご連絡ください。<br/>
      ${contactLines.join('<br/>')}
    </div>
  `;
}

/**
 * メール送信
 * @param {object} params
 * @param {string} params.to - 宛先メールアドレス
 * @param {string} params.subject - 件名
 * @param {string} params.html - HTML本文
 * @param {string} [params.from] - 送信元（オプション）
 * @param {string[]} [params.bcc] - BCC（オプション）
 * @param {string[]} [params.cc] - CC（オプション）★ 店舗通知用に追加
 */
export async function sendEmail({ to, subject, html, from, bcc, cc }) {
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
      ...(cc ? { cc } : {}),
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
 * @param order { id, order_data, payment_status }
 *   payment_status: DBカラム('unpaid'/'processing'/'paid')
 */
export function buildOrderConfirmationEmail({ order, shopName, bankInfo }) {
  const d = order.order_data || {};
  const dbPaymentStatus = order.payment_status; // 'unpaid' / 'processing' / 'paid'
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
    itemsHtml = d.cartItems.map(c => {
      const opt = c.selectedOptions || {};
      const optTotal = Number(c.optionsTotal) || 0;
      const lineTotal = (Number(c.price) + optTotal) * Number(c.qty);
      // ★ オプション表示
      const optLines = [];
      if (opt.wrapping)      optLines.push(`🎁 ラッピング (+¥${(Number(opt.wrapping.price)||0).toLocaleString()})`);
      if (opt.messageCard)   optLines.push(`💌 メッセージカード${opt.messageCard.text ? `「${escapeHtml(opt.messageCard.text)}」` : ''} ${Number(opt.messageCard.price) > 0 ? `(+¥${Number(opt.messageCard.price).toLocaleString()})` : '(無料)'}`);
      if (opt.textInsertion) optLines.push(`✍️ 文字入れ「${escapeHtml(opt.textInsertion.text)}」(${escapeHtml(opt.textInsertion.position)}) (+¥${(Number(opt.textInsertion.price)||0).toLocaleString()})`);
      const optBlock = optLines.length > 0
        ? `<br><span style="font-size:11px; color:#b8588a;">${optLines.join('<br>')}</span>`
        : '';
      return `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #EEE;">${escapeHtml(c.name)}${optBlock}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #EEE; text-align: right;">× ${c.qty}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #EEE; text-align: right;">¥${lineTotal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');
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

  // [支払メール修正] 支払い方法 × 実際の状態 で正しく分岐
  //   paymentMethod (order_data) と payment_status (DB), isStaffEntered, paymentStatus(JP)
  //   を全部見て、誤った「完了」表示を絶対に出さない
  const paymentMethod = d.paymentMethod;
  const isStaffEntered = !!d.isStaffEntered;
  const jpPaymentStatus = String(d.paymentStatus || '');
  const isActuallyPaid = dbPaymentStatus === 'paid';
  const isUnpaid = !isActuallyPaid && (dbPaymentStatus === 'unpaid' || !dbPaymentStatus);
  let paymentInfoHtml = '';

  if (isStaffEntered) {
    // === スタッフ代理入力 ===
    if (jpPaymentStatus.includes('前払い済み') || isActuallyPaid) {
      paymentInfoHtml = `
        <div style="background: #ECFDF5; border: 1px solid #6EE7B7; border-radius: 8px; padding: 12px;">
          <p style="margin: 0; color: #047857; font-weight: bold; font-size: 13px;">✓ お支払いを確認済みです（前払い済み）</p>
          <p style="margin: 6px 0 0; color: #065F46; font-size: 11px;">ご注文ありがとうございました。</p>
        </div>`;
    } else if (jpPaymentStatus.includes('引き取り') || jpPaymentStatus.includes('未入金')) {
      paymentInfoHtml = `
        <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 12px;">
          <p style="margin: 0; color: #92400E; font-weight: bold; font-size: 13px;">📍 店舗お引き取り時にお支払いください</p>
          <p style="margin: 6px 0 0; color: #78350F; font-size: 11px;">商品お渡し時にお会計をお願いいたします。</p>
        </div>`;
    } else {
      paymentInfoHtml = `
        <p style="color: #555; font-size: 12px;">お支払い方法: ${escapeHtml(jpPaymentStatus || '店舗にてご確認ください')}</p>`;
    }
  } else if (paymentMethod === 'card') {
    // === カード決済（顧客） ===
    if (isActuallyPaid) {
      paymentInfoHtml = `
        <div style="background: #ECFDF5; border: 1px solid #6EE7B7; border-radius: 8px; padding: 12px;">
          <p style="margin: 0; color: #047857; font-weight: bold; font-size: 13px;">✓ クレジットカードでのお支払いが完了しています</p>
        </div>`;
    } else if (dbPaymentStatus === 'processing') {
      paymentInfoHtml = `
        <div style="background: #EFF6FF; border: 1px solid #93C5FD; border-radius: 8px; padding: 12px;">
          <p style="margin: 0; color: #1E40AF; font-weight: bold; font-size: 13px;">💳 お支払い手続き中です</p>
          <p style="margin: 6px 0 0; color: #1E3A8A; font-size: 11px;">決済完了次第、確認メールをお送りします。</p>
        </div>`;
    } else {
      paymentInfoHtml = `
        <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 12px;">
          <p style="margin: 0; color: #B91C1C; font-weight: bold; font-size: 13px;">⚠️ お支払いがまだ完了していません</p>
          <p style="margin: 6px 0 0; color: #991B1B; font-size: 11px;">お手数ですが店舗までお問い合わせください。</p>
        </div>`;
    }
  } else if (paymentMethod === 'bank_transfer') {
    // === 銀行振込（顧客） ===
    if (isActuallyPaid) {
      paymentInfoHtml = `
        <div style="background: #ECFDF5; border: 1px solid #6EE7B7; border-radius: 8px; padding: 12px;">
          <p style="margin: 0; color: #047857; font-weight: bold; font-size: 13px;">✓ ご入金を確認しました</p>
          <p style="margin: 6px 0 0; color: #065F46; font-size: 11px;">ありがとうございました。発送準備に入ります。</p>
        </div>`;
    } else if (bankInfo) {
      paymentInfoHtml = `
        <h3 style="color: #2D4B3E; font-size: 14px; margin-top: 24px;">お振込先</h3>
        <pre style="background: #FBFAF9; padding: 12px; border-radius: 8px; border: 1px solid #EAEAEA; font-family: sans-serif; font-size: 12px; white-space: pre-wrap;">${escapeHtml(bankInfo)}</pre>
        <p style="font-size: 11px; color: #999;">※お振込手数料はお客様ご負担となります。</p>
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; margin-top: 12px;">
          <p style="font-size: 12px; color: #c2410c; font-weight: bold; margin: 0 0 4px;">⚠️ お支払いについて</p>
          <p style="font-size: 11px; color: #9a3412; margin: 0; line-height: 1.6;">
            お振込みのご確認が取れ次第、<strong>発送</strong>させていただきます。<br/>
            <strong>ご入金に関してのご相談・ご質問がある方はお電話にてお問い合わせください。</strong>
          </p>
        </div>`;
    }
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

    <div style="margin-top:24px;padding:14px;background:#f9f5ed;border:1pt solid #e5d9bd;border-radius:8px;font-size:11px;color:#92722c;line-height:1.6;">
      ⚠️ <strong>このメールは送信専用アドレスから自動送信されています。</strong><br/>
      ご返信いただいてもご対応できかねますので、お問い合わせは <strong>${escapeHtml(shopName)}</strong> までご連絡ください。
    </div>
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
