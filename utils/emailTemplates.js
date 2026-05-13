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
    variables: ['customerName', 'shopName', 'orderId', 'orderTotal', 'orderItems', 'paymentMethod', 'bankInfo', 'deliveryDate', 'shopPhone'],
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
    id: 'delivery_completion',
    label: 'お渡し・配達完了',
    description: '商品をお渡しまたは配達完了したお客様への完了通知（手動）',
    auto: false,
    variables: ['customerName', 'shopName', 'orderId'],
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

━━━━━━━━━━━━━━━━━━━━

ご不明な点がございましたら、{shopName}までお問い合わせください。
TEL: {shopPhone}

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
