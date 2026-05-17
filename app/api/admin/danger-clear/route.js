// テストデータの選択削除
// POST /api/admin/danger-clear
// Body: { targets: ['orders'|'customers'|'products'|'staff_attendance'|'all'] }
//
// ⚠️ 店舗設定 (app_settings) は一切触らない。テーブル単位のデータのみ削除。

import { NextResponse } from 'next/server';
import { requireOwner } from '@/utils/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // ★ NocoLdeスーパー管理者のみ実行可
    const auth = await requireOwner(request);
    if (!auth.ok) return auth.response;
    const supabaseAdmin = auth.supabaseAdmin;

    const { targets } = await request.json();
    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ error: 'targets配列が必要です' }, { status: 400 });
    }

    // 削除対象テーブル定義
    const groups = {
      orders: ['orders'],
      customers: [
        'customer_anniversaries',
        'customer_line_links',
        'customer_email_change_requests',
        'customer_sessions',
        'customer_credentials',
      ],
      products: ['stock_notifications', 'products'], // 子テーブル先
      staff_attendance: [
        'staff_attendance',
        'shift_schedules',
        'shift_holiday_requests',
      ],
      audit_log: ['audit_log'], // ★ 操作履歴のみ単独削除可能
    };

    let allTables = [];
    if (targets.includes('all')) {
      allTables = [...groups.orders, ...groups.customers, ...groups.products, ...groups.staff_attendance, ...groups.audit_log];
    } else {
      for (const t of targets) {
        if (groups[t]) allTables = allTables.concat(groups[t]);
      }
    }
    // 重複削除
    allTables = [...new Set(allTables)];

    const results = [];
    for (const table of allTables) {
      try {
        // 全件削除（neq id でフェイルセーフ）
        const { error, count } = await supabaseAdmin
          .from(table)
          .delete({ count: 'exact' })
          .not('id', 'is', null);
        if (error) {
          results.push({ table, ok: false, error: error.message });
        } else {
          results.push({ table, ok: true, deleted: count ?? 0 });
        }
      } catch (e) {
        results.push({ table, ok: false, error: e.message });
      }
    }

    return NextResponse.json({
      ok: true,
      executed_at: new Date().toISOString(),
      results,
      note: 'app_settings は触っていません（店舗設定は無傷）',
    });
  } catch (err) {
    console.error('[danger-clear]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
