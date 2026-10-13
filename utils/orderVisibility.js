// [2026-10 C2] カード決済が終わっていない注文の扱い（9/17 打ち合わせ）
// - カード払いで、注文から 20 分たっても決済が終わっていない注文は、受注一覧・カレンダー・ダッシュボード・
//   配達管理・売上・顧客の注文履歴・印刷に出さない（データは消さない。表示から外すだけ）
// - 20 分以内は「カード決済待ち」として表示する
// - あとから決済が終わる（Stripe の webhook で payment_status = 'paid'）と、自動で一覧に戻る
// - スタッフが手を付けた注文（ステータス変更の履歴がある・入金済みにした）は外さない

export const UNPAID_CARD_HIDE_MINUTES = 20;

function isCardAwaitingPayment(order) {
  if (!order) return false;
  const d = order.order_data || {};
  if (d.paymentMethod !== 'card') return false;
  if (d.isStaffEntered) return false;
  // [2026-10 C5] 電話確認から「カード払いのご案内」を送った注文は、期限（24 時間）まで一覧に出す
  if (d.phoneConfirmation) return false;
  if (!['processing', 'failed'].includes(order.payment_status)) return false;
  // スタッフが入金済みにした・ステータスを動かした注文は対象外
  if (/入金済|前払い済み/.test(String(d.paymentStatus || ''))) return false;
  if (Array.isArray(d.statusHistory) && d.statusHistory.length > 0) return false;
  return true;
}

function minutesSinceCreated(order, now) {
  const t = new Date(order?.created_at || 0).getTime();
  if (!t) return Infinity;
  return (now - t) / 60000;
}

/** 決済が終わらないまま 20 分たった注文（画面から外す対象） */
export function isAbandonedCardOrder(order, now = Date.now()) {
  return isCardAwaitingPayment(order) && minutesSinceCreated(order, now) >= UNPAID_CARD_HIDE_MINUTES;
}

/** 注文から 20 分以内で、まだ決済が終わっていない注文（「カード決済待ち」の札を付ける） */
export function isCardPaymentPending(order, now = Date.now()) {
  return isCardAwaitingPayment(order) && minutesSinceCreated(order, now) < UNPAID_CARD_HIDE_MINUTES;
}

/** 画面に出す注文だけにする */
export function visibleOrders(orders, now = Date.now()) {
  return (orders || []).filter(o => !isAbandonedCardOrder(o, now));
}
