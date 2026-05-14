// シフト管理 CRUD
// GET    /api/staff/shift?from=YYYY-MM-DD&to=YYYY-MM-DD  → 期間内のシフト取得
// PUT    /api/staff/shift  Body: { id?, staffName, date, patternId, patternName, startTime, endTime, isOff, locked, notes }
//          - id があれば更新、なければ upsert (UNIQUE: tenant_id + staff_name + date)
// DELETE /api/staff/shift  Body: { id }   または  { staffName, date }

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

export async function GET(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let q = auth.supabaseAdmin
      .from('shift_schedules')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('date', { ascending: true });
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);

    const { data } = await q.limit(2000);
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id, staffName, date, patternId, patternName, startTime, endTime, isOff, locked, notes } = await request.json();
    if (!staffName || !date) return NextResponse.json({ error: 'staffName/date必須' }, { status: 400 });

    const payload = {
      tenant_id: auth.tenantId,
      staff_name: staffName,
      date,
      pattern_id: patternId || null,
      pattern_name: patternName || null,
      start_time: startTime || null,
      end_time: endTime || null,
      is_off: Boolean(isOff),
      is_auto_generated: false,
      locked: Boolean(locked),
      notes: notes || null,
    };

    if (id) {
      await auth.supabaseAdmin.from('shift_schedules').update(payload).eq('id', id).eq('tenant_id', auth.tenantId);
    } else {
      // upsert (UNIQUE: tenant_id + staff_name + date)
      await auth.supabaseAdmin.from('shift_schedules').upsert(payload, { onConflict: 'tenant_id,staff_name,date' });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[shift PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id, staffName, date } = await request.json();
    let q = auth.supabaseAdmin.from('shift_schedules').delete().eq('tenant_id', auth.tenantId);
    if (id) q = q.eq('id', id);
    else if (staffName && date) q = q.eq('staff_name', staffName).eq('date', date);
    else return NextResponse.json({ error: 'id または staffName+date 必要' }, { status: 400 });
    await q;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
