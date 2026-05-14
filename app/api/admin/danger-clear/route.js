// テストデータの選択削除
// POST /api/admin/danger-clear
// Body: { targets: ['orders'|'customers'|'products'|'staff_attendance'|'all'] }
//
// ⚠️ 店舗設定 (app_settings) は一切触らない。テーブル単位のデータのみ削除。

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { targets } = await request.json();
    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ error: 'targets配列が必要です' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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
        'audit_log',
        'staff_attendance',
        'shift_schedules',
        'shift_holiday_requests',
      ],
    };

    let allTables = [];
    if (targets.includes('all')) {
      allTables = [...groups.orders, ...groups.customers, ...groups.products, ...groups.staff_attendance];
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
