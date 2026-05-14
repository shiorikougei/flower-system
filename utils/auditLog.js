// 操作履歴記録のクライアントヘルパー
// 使用例:
//   import { logAction } from '@/utils/auditLog';
//   await logAction({ action: 'order_status_change', targetType: 'order', targetId: orderId, description: 'ステータスを「制作中」に変更' });

import { supabase } from '@/utils/supabase';
import { getCurrentStaff } from '@/utils/staffRole';

/**
 * 操作履歴を記録（失敗してもエラーにしない・既存処理を止めない）
 */
export async function logAction({ action, targetType, targetId, description, metadata }) {
  if (!action) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const staff = getCurrentStaff();

    await fetch('/api/staff/audit-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action,
        targetType,
        targetId,
        description,
        metadata,
        staffName: staff?.name || '未選択',
        staffRole: staff?.role || 'owner',
      }),
    });
  } catch (e) {
    console.warn('[auditLog] failed:', e?.message);
  }
}

// 操作タイプの定義（一覧画面のフィルタや表示で使用）
export const ACTION_LABELS = {
  order_status_change: '注文ステータス変更',
  order_payment_confirm: '入金確認',
  order_delete: '注文削除',
  order_archive: '注文完了/復活',
  settings_save: '設定保存',
  staff_add: 'スタッフ追加',
  staff_delete: 'スタッフ削除',
  product_add: '商品追加',
  product_edit: '商品編集',
  product_delete: '商品削除',
  customer_email_change: '顧客メアド変更',
  customer_line_manage: 'LINE紐付け編集',
  template_email_send: 'テンプレメール送信',
};
