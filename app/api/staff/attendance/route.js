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
      // 出勤中レコードを退勤化（休憩中なら休憩も終了させる）
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

      const now = new Date();
      let breakMinutes = open.break_minutes || 0;
      // 休憩中なら自動で締める
      if (open.break_start_at) {
        breakMinutes += Math.floor((now - new Date(open.break_start_at)) / 60000);
      }
      await auth.supabaseAdmin
        .from('staff_attendance')
        .update({
          clock_out_at: now.toISOString(),
          break_minutes: breakMinutes,
          break_start_at: null,
        })
        .eq('id', open.id);
      return NextResponse.json({ ok: true, id: open.id });
    }

    if (action === 'break_start') {
      // 休憩開始（出勤中レコードの break_start_at をセット）
      const { data: open } = await auth.supabaseAdmin
        .from('staff_attendance')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('staff_name', staffName)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!open) return NextResponse.json({ error: '出勤中の打刻がありません' }, { status: 400 });
      if (open.break_start_at) return NextResponse.json({ ok: true, already: true });
      await auth.supabaseAdmin
        .from('staff_attendance')
        .update({ break_start_at: new Date().toISOString() })
        .eq('id', open.id);
      return NextResponse.json({ ok: true, id: open.id });
    }

    if (action === 'break_end') {
      // 休憩終了（break_minutes に加算して break_start_at を null に）
      const { data: open } = await auth.supabaseAdmin
        .from('staff_attendance')
        .select('*')
        .eq('tenant_id', auth.tenantId)
        .eq('staff_name', staffName)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!open || !open.break_start_at) return NextResponse.json({ ok: true, noBreak: true });

      const addMinutes = Math.floor((new Date() - new Date(open.break_start_at)) / 60000);
      await auth.supabaseAdmin
        .from('staff_attendance')
        .update({
          break_minutes: (open.break_minutes || 0) + addMinutes,
          break_start_at: null,
        })
        .eq('id', open.id);
      return NextResponse.json({ ok: true, id: open.id, addedMinutes: addMinutes });
    }

    if (action === 'manual_insert') {
      // ★ 手動挿入: 出勤忘れ・退勤忘れの後追い記録
      const { clockInAt, clockOutAt, notes } = await (async () => {
        // すでにrequestを消費しているので回避
        return { clockInAt: null, clockOutAt: null, notes: null };
      })();
      // ↑ 上記は使えないので fallthrough
      return NextResponse.json({ error: 'manual_insertは PUT を使ってください' }, { status: 400 });
    }

    return NextResponse.json({ error: '不正なaction' }, { status: 400 });
  } catch (err) {
    console.error('[attendance POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ★ 編集（手動修正）+ 手動挿入
// PUT /api/staff/attendance
// Body: { id?, staffName, clockInAt, clockOutAt?, notes? }
//   id があれば更新、なければ新規挿入
export async function PUT(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id, staffName, clockInAt, clockOutAt, notes } = await request.json();
    if (!staffName || !clockInAt) return NextResponse.json({ error: 'staffName/clockInAt必須' }, { status: 400 });

    // 退勤時刻 < 出勤時刻 はエラー
    if (clockOutAt && new Date(clockOutAt) <= new Date(clockInAt)) {
      return NextResponse.json({ error: '退勤時刻は出勤時刻より後にしてください' }, { status: 400 });
    }

    // duration 自動計算
    const duration = clockOutAt
      ? Math.floor((new Date(clockOutAt) - new Date(clockInAt)) / 60000)
      : null;

    if (id) {
      // 編集
      const { data: existing } = await auth.supabaseAdmin
        .from('staff_attendance')
        .select('id')
        .eq('id', id)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle();
      if (!existing) return NextResponse.json({ error: '該当レコードなし' }, { status: 404 });

      await auth.supabaseAdmin
        .from('staff_attendance')
        .update({
          staff_name: staffName,
          clock_in_at: clockInAt,
          clock_out_at: clockOutAt || null,
          duration_minutes: duration,
          notes: notes || null,
        })
        .eq('id', id);
      return NextResponse.json({ ok: true, id });
    } else {
      // 新規挿入
      const { data } = await auth.supabaseAdmin
        .from('staff_attendance')
        .insert({
          tenant_id: auth.tenantId,
          staff_name: staffName,
          clock_in_at: clockInAt,
          clock_out_at: clockOutAt || null,
          duration_minutes: duration,
          notes: notes || null,
        })
        .select()
        .single();
      return NextResponse.json({ ok: true, id: data?.id });
    }
  } catch (err) {
    console.error('[attendance PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 削除
// DELETE /api/staff/attendance
// Body: { id }
export async function DELETE(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id必要' }, { status: 400 });

    await auth.supabaseAdmin
      .from('staff_attendance')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId);

    return NextResponse.json({ ok: true });
  } catch (err) {
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
