// [2026-10] 受注一覧の「未完了・未入金・アーカイブ」の分け方（受注一覧とホームの件数で共通）
//   - 未完了 : お渡し前のもの全部（入金状態問わず、まだ何かやることがある）
//   - 未入金 : お渡し完了 かつ 未入金（入金だけ待ってる）
//   - アーカイブ : お渡し完了 かつ (入金完了 or キャンセル)
// 決済が終わらないまま 20 分たったカード払いの注文は、どれにも入れない（utils/orderVisibility.js）

import { isAbandonedCardOrder } from '@/utils/orderVisibility';

export function isOrderPaid(order) {
  // ★ Stripe決済反映: DB の payment_status='paid' (Webhookで自動更新) を優先
  if (order?.payment_status === 'paid') return true;
  const ps = String(order?.order_data?.paymentStatus || '');
  return /入金済|前払い済み/.test(ps);
}

/** '未完了' | '未入金' | 'アーカイブ' | null（決済が終わっていないカード払いの注文） */
export function orderTabOf(order) {
  if (isAbandonedCardOrder(order)) return null;
  const status = order?.order_data?.status || 'new';
  const isCompletedKeyword = /完了|引き渡し|発送済/.test(String(status));
  const isWorkflowCompleted = status === 'completed' || status === '完了' || status === 'キャンセル' || isCompletedKeyword;
  const isCancelled = status === 'キャンセル';
  if (!isWorkflowCompleted) return '未完了';
  if (!isOrderPaid(order) && !isCancelled) return '未入金';
  return 'アーカイブ';
}
