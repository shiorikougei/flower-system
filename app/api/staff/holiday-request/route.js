// 休み希望提出 CRUD
// GET    /api/staff/holiday-request?yearMonth=YYYY-MM&staff=  → 取得
// PUT    /api/staff/holiday-request  Body: { staffName, yearMonth, date, priority?, notes? } → upsert
// DELETE /api/staff/holiday-request  Body: { id }

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
    const yearMonth = searchParams.get('yearMonth');
    const staff = searchParams.get('staff');

    let q = auth.supabaseAdmin
      .from('shift_holiday_requests')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('date', { ascending: true });
    if (yearMonth) q = q.eq('year_month', yearMonth);
    if (staff) q = q.eq('staff_name', staff);
    const { data } = await q.limit(1000);
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { staffName, yearMonth, date, priority, notes, startTime, endTime } = await request.json();
    if (!staffName || !yearMonth || !date) {
      return NextResponse.json({ error: 'staffName/yearMonth/date必須' }, { status: 400 });
    }
    await auth.supabaseAdmin.from('shift_holiday_requests').upsert({
      tenant_id: auth.tenantId,
      staff_name: staffName,
      year_month: yearMonth,
      date,
      priority: priority || 1,
      notes: notes || null,
      status: 'pending',
      start_time: startTime || null,
      end_time: endTime || null,
    }, { onConflict: 'tenant_id,staff_name,date' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id, staffName, date } = await request.json();
    let q = auth.supabaseAdmin.from('shift_holiday_requests').delete().eq('tenant_id', auth.tenantId);
    if (id) q = q.eq('id', id);
    else if (staffName && date) q = q.eq('staff_name', staffName).eq('date', date);
    else return NextResponse.json({ error: 'id または staffName+date 必要' }, { status: 400 });
    await q;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
