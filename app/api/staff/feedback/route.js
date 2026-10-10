// [セキュリティ 2026-10] スタッフ画面「アプリの要望・バグ報告」の送信
// POST /api/staff/feedback  body: { type, text, tenantName }
// これまではブラウザから app_settings（nocolde_owner）を直接書き換えていた。
// サーバーでスタッフのログインを確かめてから、nocolde_owner.clientRequests の先頭に 1 件足す（ほかの項目は変えない）

import { NextResponse } from 'next/server';
import { requireTenantStaff } from '@/utils/adminAuth';
import { rateLimit, getClientIp } from '@/utils/rateLimit';

export const runtime = 'nodejs';

const TYPES = ['アップデート依頼', 'バグ修正依頼', 'その他'];

export async function POST(request) {
  const auth = await requireTenantStaff(request);
  if (!auth.ok) return auth.response;
  try {
    const allowed = await rateLimit({ key: `staff_feedback:${getClientIp(request)}`, max: 10, windowSec: 600 });
    if (!allowed) return NextResponse.json({ error: '短い時間に何度も送信されています。しばらくしてからお試しください。' }, { status: 429 });

    const { type, text, tenantName } = await request.json();
    const body = String(text || '').trim();
    if (!body) return NextResponse.json({ error: '内容を入力してください' }, { status: 400 });
    if (body.length > 4000) return NextResponse.json({ error: '内容が長すぎます（上限 4000 文字）' }, { status: 400 });

    const supabase = auth.supabaseAdmin;
    const { data, error: rErr } = await supabase.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').maybeSingle();
    if (rErr) throw rErr;
    const ownerData = data?.settings_data || {};
    const current = Array.isArray(ownerData.clientRequests) ? ownerData.clientRequests : [];
    const entry = {
      id: `fb_${Date.now()}`,
      tenantId: String(auth.tenant_id || ''),
      tenantName: String(tenantName || '').slice(0, 100),
      type: TYPES.includes(type) ? type : 'その他',
      text: body,
      date: new Date().toISOString().split('T')[0],
      status: 'new',
    };
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 'nocolde_owner', settings_data: { ...ownerData, clientRequests: [entry, ...current].slice(0, 500) } });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[/api/staff/feedback]', e?.message);
    return NextResponse.json({ error: '送信に失敗しました' }, { status: 500 });
  }
}
