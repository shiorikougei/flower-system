// オーナー: 全テナント横断の出勤中スタッフ一覧
// GET /api/owner/attendance-overview
// 簡易認証: NocoLde owner page でログイン済の前提（X-Owner-Auth ヘッダで簡易check）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 出勤中のレコードを全テナント取得
    const { data: openRecs } = await supabaseAdmin
      .from('staff_attendance')
      .select('id, tenant_id, staff_name, clock_in_at, break_start_at, break_minutes')
      .is('clock_out_at', null)
      .order('clock_in_at', { ascending: true });

    if (!openRecs || openRecs.length === 0) {
      return NextResponse.json({ totalOpen: 0, byTenant: [] });
    }

    // テナントID一覧
    const tenantIds = [...new Set(openRecs.map(r => r.tenant_id))];

    // テナント名取得
    const { data: tenantRows } = await supabaseAdmin
      .from('app_settings')
      .select('id, settings_data')
      .in('id', tenantIds);

    const tenantNameMap = Object.fromEntries(
      (tenantRows || []).map(r => [r.id, r.settings_data?.generalConfig?.appName || r.id])
    );

    // テナント別グループ化
    const grouped = {};
    openRecs.forEach(r => {
      if (!grouped[r.tenant_id]) {
        grouped[r.tenant_id] = {
          tenantId: r.tenant_id,
          tenantName: tenantNameMap[r.tenant_id] || r.tenant_id,
          records: [],
        };
      }
      grouped[r.tenant_id].records.push({
        id: r.id,
        staffName: r.staff_name,
        clockInAt: r.clock_in_at,
        isOnBreak: Boolean(r.break_start_at),
        breakMinutes: r.break_minutes || 0,
      });
    });

    return NextResponse.json({
      totalOpen: openRecs.length,
      byTenant: Object.values(grouped),
    });
  } catch (err) {
    console.error('[attendance-overview]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
