// 出退勤打刻
// POST /api/staff/attendance      Body: { action: 'clock_in'|'clock_out', staffName }
// GET  /api/staff/attendance?staff=&from=&to=  → 一覧/集計取得
//   - openOnly=true で出勤中のみ

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function authAndTenant(request) {
  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) return { error: '未認証', status: 401 };

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return { error: '認証失敗', status: 401 };

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
  const tenantId = profile?.tenant_id;
  if (!tenantId) return { error: 'tenant_id取得失敗', status: 400 };

  return { supabaseAdmin, tenantId };
}

export async function POST(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { action, staffName } = await request.json();
    if (!action || !staffName) return NextResponse.json({ error: 'action/staffName必須' }, { status: 400 });

    if (action === 'clock_in') {
      // 既に出勤中なら無視
      const { data: open } = await auth.supabaseAdmin
        .from('staff_attendance')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .eq('staff_name', staffName)
        .is('clock_out_at', null)
        .maybeSingle();
      if (open) return NextResponse.json({ ok: true, already: true, id: open.id });

      const { data } = await auth.supabaseAdmin
        .from('staff_attendance')
        .insert({ tenant_id: auth.tenantId, staff_name: staffName })
        .select()
        .single();
      return NextResponse.json({ ok: true, id: data?.id });
    }

    if (action === 'clock_out') {
      // 出勤中レコードを退勤化
      const { data: open } = await auth.supabaseAdmin
        .from('staff_attendance')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('staff_name', staffName)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!open) return NextResponse.json({ ok: true, noOpen: true });

      await auth.supabaseAdmin
        .from('staff_attendance')
        .update({ clock_out_at: new Date().toISOString() })
        .eq('id', open.id);
      return NextResponse.json({ ok: true, id: open.id });
    }

    return NextResponse.json({ error: '不正なaction' }, { status: 400 });
  } catch (err) {
    console.error('[attendance POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const staff = searchParams.get('staff') || '';
    const from = searchParams.get('from') || '';   // YYYY-MM-DD
    const to = searchParams.get('to') || '';
    const openOnly = searchParams.get('openOnly') === 'true';

    let q = auth.supabaseAdmin
      .from('staff_attendance')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('clock_in_at', { ascending: false });

    if (staff) q = q.eq('staff_name', staff);
    if (from) q = q.gte('clock_in_at', `${from}T00:00:00.000Z`);
    if (to) q = q.lte('clock_in_at', `${to}T23:59:59.999Z`);
    if (openOnly) q = q.is('clock_out_at', null);

    const { data } = await q.limit(500);

    // スタッフ別月次集計
    const summary = {};
    (data || []).forEach(r => {
      if (!r.duration_minutes) return;
      const d = new Date(r.clock_in_at);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const key = `${r.staff_name}__${monthKey}`;
      if (!summary[key]) summary[key] = { staffName: r.staff_name, monthKey, totalMinutes: 0, days: new Set() };
      summary[key].totalMinutes += r.duration_minutes;
      summary[key].days.add(d.toISOString().split('T')[0]);
    });
    const summaryArr = Object.values(summary).map(s => ({
      ...s,
      days: s.days.size,
      totalHours: Math.round((s.totalMinutes / 60) * 10) / 10,
    }));

    return NextResponse.json({ items: data || [], summary: summaryArr });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
