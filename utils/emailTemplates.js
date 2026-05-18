// メールテンプレートの定義・プリセット・置換ロジック
// 設定画面 (autoReplyTemplates) と各API Route で共通使用

// ===============================================================
// トリガー（送信タイミング）の定義
// ===============================================================
export const EMAIL_TRIGGERS = [
  {
    id: 'order_confirmed',
    label: 'ご注文受付',
    description: 'お客様の注文確定時に自動送信',
    auto: true,
    variables: ['customerName', 'shopName', 'orderId', 'orderTotal', 'orderItems', 'paymentMethod', 'bankInfo', 'deliveryDate', 'shopPhone', 'recipientInfo', 'mypageUrl', 'lineAddFriendUrl'],
  },
  {
    id: 'restock_notification',
    label: '入荷のお知らせ',
    description: '在庫切れ通知に登録したお客様への入荷案内（スタッフが商品管理から送信）',
    auto: false,
    variables: ['customerName', 'productName', 'shopName', 'shopUrl'],
  },
  {
    id: 'mypage_magic_link',
    label: '注文履歴の確認URL',
    description: 'お客様が「注文一覧をメールで」をクリックした時',
    auto: true,
    variables: ['customerName', 'shopName', 'magicLinkUrl'],
  },
  {
    id: 'completion_photo',
    label: '完成写真のお知らせ',
    description: '注文管理画面で完成写真をアップロードした時に自動送信',
    auto: true,
    variables: ['customerName', 'shopName', 'orderId', 'completionImageUrl', 'orderItems', 'deliveryDate'],
  },
  {
    id: 'payment_confirmed',
    label: '入金確認・納品日のお知らせ',
    description: '銀行振込のご入金確認後の通知（スタッフが入金済みに変更した時に自動送信）',
    auto: true,
    variables: ['customerName', 'shopName', 'orderId', 'orderTotal', 'orderItems', 'orderBreakdown', 'deliveryDate', 'shopPhone'],
  },
  {
    id: 'anniversary_reminder',
    label: '記念日リマインダー',
    description: 'お客様がマイページで登録した記念日の1週間前に自動送信',
    auto: true,
    variables: ['customerName', 'shopName', 'anniversaryTitle', 'anniversaryDate', 'anniversaryNotes', 'shopPhone'],
  },
  {
    id: 'delivery_completion',
    label: 'お渡し・配達完了 (旧・手動送信用)',
    description: '互換性のため残存。新規はステータス連動の3種類をご利用ください',
    auto: false,
    variables: ['customerName', 'shopName', 'orderId'],
  },
  {
    id: 'status_pickup_done',
    label: '店頭お渡し完了 通知',
    description: 'ステータスを「店頭お渡し完了」に更新した時に自動送信 (確認ダイアログあり)',
    auto: true,
    variables: ['customerName', 'shopName', 'orderId', 'orderItems', 'shopPhone'],
  },
  {
    id: 'status_delivery_done',
    label: '配達完了 通知',
    description: 'ステータスを「配達完了」に更新した時に自動送信 (確認ダイアログあり)',
    auto: true,
    variables: ['customerName', 'shopName', 'orderId', 'orderItems', 'recipientInfo', 'shopPhone'],
  },
  {
    id: 'status_shipping_done',
    label: '配送業者引き渡し完了 通知',
    description: 'ステータスを「配送業者引き渡し完了」に更新した時に自動送信 (確認ダイアログあり / 佐川追跡番号も入力可)',
    auto: true,
    variables: ['customerName', 'shopName', 'orderId', 'orderItems', 'recipientInfo', 'shippingDate', 'shippingInfo', 'shippingTrackingNumber', 'shippingTrackingUrl', 'shopPhone'],
  },
  {
    id: 'custom',
    label: 'カスタム',
    description: '自由な文面（スタッフ手動送信用）',
    auto: false,
    variables: ['customerName', 'shopName', 'orderId'],
  },
];

export function getTriggerById(id) {
  return EMAIL_TRIGGERS.find(t => t.id === id);
}

// ===============================================================
// プリセットテンプレート（初期値）
// ===============================================================
export function getPresetTemplates() {
  return [
    {
      id: 'preset_order_confirmed',
      trigger: 'order_confirmed',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】ご注文ありがとうございます (注文番号: {orderId})',
      body: `{customerName} 様

この度はご注文いただき、誠にありがとうございます。
下記の内容でご注文を承りました。

━━━━━━━━━━━━━━━━━━━━
ご注文番号: {orderId}
━━━━━━━━━━━━━━━━━━━━

【ご注文内容】
{orderItems}

【合計金額（税込）】
¥{orderTotal}

【お支払い方法】
{paymentMethod}

{bankInfo}

【お届け予定】
{deliveryDate}

{recipientInfo}
━━━━━━━━━━━━━━━━━━━━

ご不明な点がございましたら、{shopName}までお問い合わせください。
TEL: {shopPhone}

━━━━━━━━━━━━━━━━━━━━
🌸 マイページのご案内 🌸
━━━━━━━━━━━━━━━━━━━━
下記のリンクから、ご注文履歴の確認・領収書のダウンロード・
記念日リマインダーのご登録などができます。

{mypageUrl}

※リンクは24時間有効です。
※マイページではパスワード設定もしていただけます。

{lineAddFriendUrl}
またのご利用を心よりお待ちしております。`,
    },
    {
      id: 'preset_restock',
      trigger: 'restock_notification',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】「{productName}」が入荷しました',
      body: `{customerName} 様

お待たせいたしました。
お問い合わせいただいていた商品が入荷いたしましたのでお知らせいたします。

━━━━━━━━━━━━━━━━━━━━
商品名: {productName}
━━━━━━━━━━━━━━━━━━━━

下記より商品ページをご確認ください。
{shopUrl}

ご注文を心よりお待ちしております。

{shopName}`,
    },
    {
      id: 'preset_mypage',
      trigger: 'mypage_magic_link',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】注文履歴ご確認URL',
      body: `{customerName} 様

ご注文履歴の確認URLをお送りします。
下記URLより、過去のご注文内容を確認できます。

{magicLinkUrl}

※このリンクは24時間有効です。
心当たりのない場合は、このメールは破棄してください。

{shopName}`,
    },
    {
      id: 'preset_completion_photo',
      trigger: 'completion_photo',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】ご注文商品の完成写真をお送りします',
      body: `{customerName} 様

いつもありがとうございます。
ご注文いただいた商品の完成写真をお送りいたします💐

━━━━━━━━━━━━━━━━━━━━
ご注文番号: {orderId}
━━━━━━━━━━━━━━━━━━━━

【ご注文内容】
{orderItems}

【お届け予定】
{deliveryDate}

完成写真:
{completionImageUrl}

ご注文時のイメージに沿って心を込めてお作りしました。
お受け取り、心よりお待ちしております🌸

{shopName}`,
    },
    {
      id: 'preset_anniversary_reminder',
      trigger: 'anniversary_reminder',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】まもなく {anniversaryTitle}（{anniversaryDate}）です🌸',
      body: `{customerName} 様

いつもありがとうございます。
お客様にご登録いただいた記念日が、まもなく到来いたします。

━━━━━━━━━━━━━━━━━━━━
{anniversaryTitle}
記念日: {anniversaryDate}
{anniversaryNotes}
━━━━━━━━━━━━━━━━━━━━

今年も大切な日に、心を込めたお花をご用意いたします💐
ご予約・ご相談はお気軽にお問い合わせください。

{shopName}
TEL: {shopPhone}

※このメールは記念日リマインダーの設定に基づいて自動送信されています。`,
    },
    {
      id: 'preset_payment_confirmed',
      trigger: 'payment_confirmed',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】ご入金を確認いたしました (注文番号: {orderId})',
      body: `{customerName} 様

いつもありがとうございます。
ご注文いただきましたお品物について、ご入金を確認いたしましたのでお知らせいたします🌸

━━━━━━━━━━━━━━━━━━━━
ご注文番号: {orderId}
━━━━━━━━━━━━━━━━━━━━

【ご注文内容】
{orderItems}

【金額の内訳】
{orderBreakdown}

【納品予定日】
{deliveryDate}

これより商品のご準備に取り掛からせていただきます。
納品予定日にお届けまたはお渡しさせていただきます💐

ご不明な点がございましたら、{shopName}までお問い合わせください。
TEL: {shopPhone}

引き続きどうぞよろしくお願いいたします。`,
    },
    {
      id: 'preset_delivery_completion',
      trigger: 'delivery_completion',
      targetShops: 'all',
      enabled: false,  // デフォルトはOFF（手動送信用）
      subject: '【{shopName}】ご注文の商品をお渡しいたしました',
      body: `{customerName} 様

本日はご来店（またはお受け取り）ありがとうございました。
ご注文番号: {orderId} の商品を、確かにお渡しいたしました。

商品のお手入れや配送についてご不明な点がございましたら、
お気軽にお問い合わせください。

またのご利用を心よりお待ちしております。

{shopName}`,
    },
    // ★ 店頭お渡し完了 (status: 店頭お渡し完了)
    {
      id: 'preset_status_pickup_done',
      trigger: 'status_pickup_done',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】お引き取りありがとうございました (注文番号: {orderId})',
      body: `{customerName} 様

本日はご来店ありがとうございました🌸

下記のご注文のお品物を、確かにお渡しいたしました。

━━━━━━━━━━━━━━━━━━━━
ご注文番号: {orderId}
━━━━━━━━━━━━━━━━━━━━

【ご注文内容】
{orderItems}

お花のお手入れ・水替え方法などご不明な点がございましたら、
お気軽にお問い合わせください。

ご不明な点がございましたら {shopName} までご連絡ください。
TEL: {shopPhone}

またのご利用を心よりお待ちしております🌷

{shopName}`,
    },
    // ★ 配達完了 (status: 配達完了)
    {
      id: 'preset_status_delivery_done',
      trigger: 'status_delivery_done',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】お花をお届けいたしました (注文番号: {orderId})',
      body: `{customerName} 様

いつもありがとうございます🌸

下記のご注文のお花を、本日お届けいたしました。
ご確認のほどよろしくお願いいたします。

━━━━━━━━━━━━━━━━━━━━
ご注文番号: {orderId}
━━━━━━━━━━━━━━━━━━━━

【ご注文内容】
{orderItems}

{recipientInfo}
お花を末永くお楽しみいただけますよう、こまめな水替えを
おすすめいたします💐

ご不明な点がございましたら {shopName} までご連絡ください。
TEL: {shopPhone}

またのご利用を心よりお待ちしております🌷

{shopName}`,
    },
    // ★ 配送業者引き渡し完了 (status: 配送業者引き渡し完了)
    {
      id: 'preset_status_shipping_done',
      trigger: 'status_shipping_done',
      targetShops: 'all',
      enabled: true,
      subject: '【{shopName}】お花を発送いたしました (注文番号: {orderId})',
      body: `{customerName} 様

いつもありがとうございます🌸

下記のご注文のお花を、本日配送業者へお引き渡しいたしました。
通常 翌日〜数日以内 にお届け予定です。

━━━━━━━━━━━━━━━━━━━━
ご注文番号: {orderId}
━━━━━━━━━━━━━━━━━━━━

【ご注文内容】
{orderItems}

{recipientInfo}
【発送日】
{shippingDate}
{shippingInfo}
お花の鮮度保持のため、お受け取り後は早めに開梱して
水替えをお願いいたします💐

万一お届けに関する問題（配送遅延・破損等）がございましたら、
直接配送業者へお問い合わせください。
▼ 佐川急便 お問い合わせ
https://www.sagawa-exp.co.jp/send/howto/inquiry.html

ご不明な点がございましたら {shopName} までご連絡ください。
TEL: {shopPhone}

またのご利用を心よりお待ちしております🌷

{shopName}`,
    },
  ];
}

// ===============================================================
// テンプレート本文の変数置換 & HTML化
// ===============================================================
export function renderTemplate(template, vars) {
  let subject = template.subject || '';
  let body = template.body || '';
  for (const [k, v] of Object.entries(vars || {})) {
    const re = new RegExp(`\\{${k}\\}`, 'g');
    subject = subject.replace(re, v == null ? '' : String(v));
    body = body.replace(re, v == null ? '' : String(v));
  }
  return { subject, body };
}

// プレーンテキストの本文をHTMLメールに変換（シンプルなラッパー）
// 画像URLが本文中にあれば <img> として埋め込み、それ以外のURLは普通のリンクに
export function bodyToHtml(body, { shopName } = {}) {
  const lines = (body || '').split('\n');
  const htmlParts = lines.map(line => {
    const trimmed = line.trim();
    // 画像URLっぽいもの (画像拡張子 or Supabase Storage)
    if (/^https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)(\?[^\s]*)?$/i.test(trimmed) ||
        /^https?:\/\/[^\s]+\/storage\/v1\/object\/[^\s]+$/i.test(trimmed)) {
      return `<img src="${trimmed}" alt="" style="max-width:100%; height:auto; border-radius:8px; margin:8px 0; display:block;">`;
    }
    // URL → リンク
    const escaped = escapeHtml(line);
    const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2D4B3E; word-break:break-all;">$1</a>');
    return linked;
  });
  const html = htmlParts.join('<br>');

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#FBFAF9; font-family:'Hiragino Sans', sans-serif; color:#111; line-height:1.7;">
  <div style="max-width:600px; margin:0 auto; background:white; padding:40px 24px;">
    <div style="font-size:13px; word-break:break-word;">${html}</div>
    ${shopName ? `<p style="font-size:11px; color:#999; margin-top:32px; padding-top:16px; border-top:1px solid #EAEAEA; text-align:center;">— ${escapeHtml(shopName)} —</p>` : ''}
  </div>
</body>
</html>`;
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

// ===============================================================
// 設定からトリガーに合致するテンプレートを取得
// ===============================================================
//   - shopId が一致するか targetShops === 'all' のものを優先
//   - 見つからなければ プリセット を返す
export function findTemplateFor(triggerId, autoReplyTemplates, { shopId } = {}) {
  const presets = getPresetTemplates();
  const templates = Array.isArray(autoReplyTemplates) ? autoReplyTemplates : [];

  // まずユーザー設定のテンプレートから探す
  let found = templates.find(t => t.trigger === triggerId && t.enabled !== false && (
    t.targetShops === 'all' ||
    (Array.isArray(t.targetShops) && t.targetShops.includes(shopId))
  ));
  if (found) return found;

  // 次に「全店舗」を含むユーザー設定（enabledチェックなし）
  found = templates.find(t => t.trigger === triggerId && t.enabled !== false);
  if (found) return found;

  // 最後にプリセット
  return presets.find(p => p.trigger === triggerId) || null;
}

// ===============================================================
// LINE友達追加URLを案内文化（{lineAddFriendUrl} 変数の置換用）
// 設定がなければ空文字を返す（メール本文がスッキリ）
// ※ customerEmail を渡せば「○○を送信してください」と具体的に案内
// ===============================================================
export function formatLineAddFriendBlock(lineConfig, customerEmail) {
  const url = lineConfig?.addFriendUrl || '';
  if (!url || !lineConfig?.enabled) return '';
  const emailLine = customerEmail
    ? `   ご登録メールアドレス: ${customerEmail}`
    : '   ご登録のメールアドレス';
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 LINEでも進捗を受け取れます
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ご注文進捗・完成写真・入金確認を LINE でもお届けします。
下記の手順で、簡単に登録できます🌸

────────── 登録手順 ──────────

  STEP 1 ▸ 公式LINEを友達追加
  ${url}

  STEP 2 ▸ トーク画面下部のリッチメニュー
        「📧 LINE連携する」ボタンをタップ

  STEP 3 ▸ FLORIX からメッセージが届きます
        「メールアドレスを送信してください」

  STEP 4 ▸ 下記のメールアドレスをトークに送信
${emailLine}

  STEP 5 ▸ 連携完了 🎉
        以降、ご注文進捗を LINE にもお届けします

──────────────────────────────

  ※ 連携停止: マイページから個別解除が可能です
  ※ 機種変更時: 新しいLINEで同じメアドを送れば自動で切替

`;
}

// ===============================================================
// お届け先情報を文字列化（{recipientInfo} 変数の置換用）
// ご依頼主 === お届け先 のときは空文字を返す
// ===============================================================
export function formatRecipientInfo(orderData) {
  const d = orderData || {};
  if (!d.isRecipientDifferent) return '';
  const r = d.recipientInfo || {};
  if (!r.name && !r.address1) return '';
  const lines = [
    '【お届け先】',
    `${r.name || ''} 様`,
  ];
  if (r.zip) lines.push(`〒${r.zip}`);
  if (r.address1 || r.address2) lines.push(`${r.address1 || ''} ${r.address2 || ''}`.trim());
  if (r.phone) lines.push(`TEL: ${r.phone}`);
  return lines.join('\n') + '\n';
}

// ===============================================================
// 注文内容を文字列化（{orderItems} 変数の置換用）
// ===============================================================
export function formatOrderItems(orderData) {
  const d = orderData || {};
  if (Array.isArray(d.cartItems) && d.cartItems.length > 0) {
    return d.cartItems.map(c => `・${c.name} × ${c.qty}  ¥${Number(c.price * c.qty).toLocaleString()}`).join('\n');
  }
  // カスタム注文
  const parts = [];
  if (d.flowerType) parts.push(`・${d.flowerType}`);
  if (d.flowerPurpose) parts.push(`  用途: ${d.flowerPurpose}`);
  if (d.flowerColor) parts.push(`  色: ${d.flowerColor}`);
  if (d.flowerVibe) parts.push(`  イメージ: ${d.flowerVibe}`);
  return parts.join('\n') || '（商品情報なし）';
}

// ===============================================================
// 金額内訳を文字列化（商品代/送料/箱代/クール代/税/合計）
// payment_confirmed 等のメール本文で「合計とのつじつまが合わない」を防ぐ
// ===============================================================
export function formatOrderBreakdown(orderData) {
  const d = orderData || {};
  // EC注文 (cart) と カスタム注文 で itemPrice の計算が違うのでケアフル
  let itemSubtotal = 0;
  if (Array.isArray(d.cartItems) && d.cartItems.length > 0) {
    itemSubtotal = d.cartItems.reduce((s, c) => s + Number(c.price || 0) * Number(c.qty || 1), 0);
  } else {
    itemSubtotal = Number(d.itemPrice) || 0;
  }
  const calcFee = Number(d.calculatedFee) || 0;
  const pickupFee = Number(d.pickupFee) || 0;
  const breakdown = d.feeBreakdown || {};
  const baseFee = Number(breakdown.baseFee) || 0;
  const boxFee = Number(breakdown.boxFee) || 0;
  const coolFee = Number(breakdown.coolFee) || 0;

  const subTotal = itemSubtotal + calcFee + pickupFee;
  const tax = Math.floor(subTotal * 0.1);
  const total = subTotal + tax;

  const lines = [];
  lines.push(`商品代 (税抜)：¥${itemSubtotal.toLocaleString()}`);
  // 送料 (自社配達 or 業者配送): baseFee がある時のみ
  if (baseFee > 0) {
    const label = d.receiveMethod === 'delivery' ? '配達料' : (d.receiveMethod === 'sagawa' ? '送料 (佐川急便)' : '配送料');
    lines.push(`${label}：¥${baseFee.toLocaleString()}`);
  } else if (calcFee > 0 && baseFee === 0) {
    // breakdown が壊れてる場合の互換: calcFee 一括表示
    lines.push(`配送料：¥${calcFee.toLocaleString()}`);
  }
  if (boxFee > 0) lines.push(`箱代：¥${boxFee.toLocaleString()}`);
  if (coolFee > 0) lines.push(`クール便代：¥${coolFee.toLocaleString()}`);
  if (pickupFee > 0) lines.push(`器具回収費：¥${pickupFee.toLocaleString()}`);
  lines.push(`消費税 (10%)：¥${tax.toLocaleString()}`);
  lines.push('─────────────────────');
  lines.push(`合計 (税込)：¥${total.toLocaleString()}`);

  return lines.join('\n');
}
