// 注文データの入力検証ヘルパー
// /api/orders で使用 — 任意JSON 投入による DB 圧迫 / XSS 攻撃を防ぐ

const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;
const PHONE_RE = /^[\d\-+()\s]{8,20}$/;
const ZIP_RE = /^\d{3}-?\d{4}$/;

// jsonb サイズ上限（50KB）
const MAX_ORDER_DATA_SIZE = 50 * 1024;

/**
 * 注文データのバリデーション
 * @param {Object} orderData
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateOrderData(orderData) {
  if (!orderData || typeof orderData !== 'object') {
    return { ok: false, error: 'orderData が不正です' };
  }

  // ★ サイズ上限チェック（DoS防止）
  try {
    const size = JSON.stringify(orderData).length;
    if (size > MAX_ORDER_DATA_SIZE) {
      return { ok: false, error: `注文データが大きすぎます (${Math.ceil(size/1024)}KB > 50KB)` };
    }
  } catch (e) {
    return { ok: false, error: 'orderData のシリアライズに失敗' };
  }

  // ★ customerInfo 検証
  const ci = orderData.customerInfo;
  if (!ci || typeof ci !== 'object') {
    return { ok: false, error: 'お客様情報が必要です' };
  }
  if (!ci.name || String(ci.name).length > 100) {
    return { ok: false, error: 'お名前は1〜100文字で入力してください' };
  }
  if (!ci.email || !EMAIL_RE.test(String(ci.email)) || String(ci.email).length > 200) {
    return { ok: false, error: 'メールアドレスの形式が正しくありません' };
  }
  if (!ci.phone || !PHONE_RE.test(String(ci.phone))) {
    return { ok: false, error: '電話番号の形式が正しくありません' };
  }
  if (ci.zip && !ZIP_RE.test(String(ci.zip))) {
    return { ok: false, error: '郵便番号の形式が正しくありません' };
  }
  if (ci.address1 && String(ci.address1).length > 200) {
    return { ok: false, error: '住所が長すぎます' };
  }
  if (ci.address2 && String(ci.address2).length > 200) {
    return { ok: false, error: '建物名等が長すぎます' };
  }

  // ★ お届け先（オプション）
  if (orderData.isRecipientDifferent && orderData.recipientInfo) {
    const ri = orderData.recipientInfo;
    if (ri.name && String(ri.name).length > 100) {
      return { ok: false, error: 'お届け先お名前が長すぎます' };
    }
    if (ri.phone && !PHONE_RE.test(String(ri.phone))) {
      return { ok: false, error: 'お届け先電話番号の形式が正しくありません' };
    }
  }

  // ★ cartItems 検証（EC注文）
  if (Array.isArray(orderData.cartItems)) {
    if (orderData.cartItems.length > 50) {
      return { ok: false, error: 'カート内商品が多すぎます (50点まで)' };
    }
    for (const c of orderData.cartItems) {
      const qty = Number(c.qty);
      if (!Number.isFinite(qty) || qty < 1 || qty > 99) {
        return { ok: false, error: '数量は1〜99の整数で指定してください' };
      }
      const price = Number(c.price);
      if (!Number.isFinite(price) || price < 0 || price > 1000000) {
        return { ok: false, error: '価格が不正です' };
      }
    }
  }

  // ★ itemPrice 範囲チェック
  if (orderData.itemPrice != null) {
    const ip = Number(orderData.itemPrice);
    if (!Number.isFinite(ip) || ip < 0 || ip > 10000000) {
      return { ok: false, error: '商品代金が不正です' };
    }
  }

  // ★ メッセージ / メモの文字数制限
  if (orderData.cardMessage && String(orderData.cardMessage).length > 500) {
    return { ok: false, error: 'カードメッセージは500文字以内で' };
  }
  if (orderData.note && String(orderData.note).length > 1000) {
    return { ok: false, error: 'ご要望は1000文字以内で' };
  }

  return { ok: true };
}
