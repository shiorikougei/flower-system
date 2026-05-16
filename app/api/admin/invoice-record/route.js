// 請求履歴の操作API
// POST   /api/admin/invoice-record  → 手動で請求記録を追加（オーナーページの「発行」ボタンから）
// PATCH  /api/admin/invoice-record  → 入金記録 / ステータス変更
// DELETE /api/admin/invoice-record?id=xxx → 削除
//
// 保存先: app_settings.id='nocolde_owner'.settings_data.invoices = [...]

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOwner } from '@/utils/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ★ cron 経由の内部呼出か、Owner Bearer 必須
async function gateOwnerOrCron(request) {
  const isCron = request.headers.get('x-cron-secret') === process.env.CRON_SECRET;
  if (isCron) return { ok: true };
  return await requireOwner(request);
}

async function loadOwnerData() {
  const supabaseAdmin = admin();
  const { data } = await supabaseAdmin.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
  return { supabaseAdmin, data: data?.settings_data || {} };
}

async function saveOwnerData(supabaseAdmin, ownerData) {
  return supabaseAdmin.from('app_settings').upsert({ id: 'nocolde_owner', settings_data: ownerData });
}

// POST: 手動で請求履歴を追加
export async function POST(request) {
  try {
    const auth = await gateOwnerOrCron(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { tenantId, tenantName, month, subscriptionTotal = 0, aiTotal = 0, grandTotal, paymentMethod = 'bank_transfer', billingEmail = '', stripeInvoiceUrl = '' } = body;
    if (!tenantId || !month || grandTotal == null) {
      return NextResponse.json({ error: 'tenantId/month/grandTotal必要' }, { status: 400 });
    }
    const { supabaseAdmin, data } = await loadOwnerData();
    const invoices = data.invoices || [];
    const record = {
      id: `inv_${tenantId}_${month}_${Date.now()}`,
      tenantId, tenantName, month,
      subscriptionTotal: Number(subscriptionTotal) || 0,
      aiTotal: Number(aiTotal) || 0,
      grandTotal: Number(grandTotal),
      paymentMethod, billingEmail,
      sentAt: new Date().toISOString(),
      paidAt: null,
      status: 'unpaid',
      stripeInvoiceUrl,
      via: 'manual',
    };
    invoices.push(record);
    await saveOwnerData(supabaseAdmin, { ...data, invoices });
    return NextResponse.json({ ok: true, record });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH: 入金記録 or ステータス変更
export async function PATCH(request) {
  try {
    const auth = await gateOwnerOrCron(request);
    if (!auth.ok) return auth.response;

    const { id, status, paidAt, paidVia, memo } = await request.json();
    if (!id) return NextResponse.json({ error: 'id必要' }, { status: 400 });
    const { supabaseAdmin, data } = await loadOwnerData();
    const invoices = data.invoices || [];
    const idx = invoices.findIndex(i => i.id === id);
    if (idx === -1) return NextResponse.json({ error: '見つかりません' }, { status: 404 });
    if (status) invoices[idx].status = status;
    if (status === 'paid') {
      invoices[idx].paidAt = paidAt || new Date().toISOString();
      invoices[idx].paidVia = paidVia || 'manual';
    }
    if (status === 'unpaid') {
      invoices[idx].paidAt = null;
      invoices[idx].paidVia = null;
    }
    if (memo != null) invoices[idx].memo = memo;
    await saveOwnerData(supabaseAdmin, { ...data, invoices });
    return NextResponse.json({ ok: true, record: invoices[idx] });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: 請求記録を削除
export async function DELETE(request) {
  try {
    const auth = await gateOwnerOrCron(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id必要' }, { status: 400 });
    const { supabaseAdmin, data } = await loadOwnerData();
    const invoices = (data.invoices || []).filter(i => i.id !== id);
    await saveOwnerData(supabaseAdmin, { ...data, invoices });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
