// 操作履歴の記録 + 取得
// POST /api/staff/audit-log  Body: { action, targetType, targetId, description, metadata, staffName, staffRole }
// GET  /api/staff/audit-log?limit=100&action=&staff= → 一覧取得（フィルタ可）

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

    const body = await request.json();
    const { action, targetType, targetId, description, metadata, staffName, staffRole } = body;
    if (!action) return NextResponse.json({ error: 'action必須' }, { status: 400 });

    await auth.supabaseAdmin.from('audit_log').insert({
      tenant_id: auth.tenantId,
      staff_name: staffName || '未選択',
      staff_role: staffRole || null,
      action,
      target_type: targetType || null,
      target_id: targetId ? String(targetId) : null,
      description: description || null,
      metadata: metadata || null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[audit-log POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const auth = await authAndTenant(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);
    const action = searchParams.get('action') || '';
    const staff = searchParams.get('staff') || '';

    let q = auth.supabaseAdmin
      .from('audit_log')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (action) q = q.eq('action', action);
    if (staff) q = q.eq('staff_name', staff);

    const { data } = await q;
    return NextResponse.json({ items: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
