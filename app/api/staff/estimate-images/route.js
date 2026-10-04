// 見積の参考写真（お客様が見積依頼時に添付した画像）の取得
// GET /api/staff/estimate-images?ids=uuid1,uuid2,...
//
// 認証: スタッフセッション必須（自テナントの見積のみ）
// 読み取り専用。見積・注文のデータは一切変更しない。
// 過去の注文は order_data.estimateId から写真を「表示するだけ」に使う（注文データへは保存しない）。
// Returns:
//   { images: { [estimateId]: string[] } }   // 写真が無い・見積が削除済みの場合はキー自体が無い

import { NextResponse } from 'next/server';
import { requireTenantStaff } from '@/utils/adminAuth';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

export async function GET(request) {
  try {
    const auth = await requireTenantStaff(request);
    if (!auth.ok) return auth.response;
    if (!auth.tenant_id) return NextResponse.json({ error: 'テナント情報が取得できません' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const ids = [...new Set(
      String(searchParams.get('ids') || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => UUID_RE.test(s))
    )].slice(0, MAX_IDS);
    if (ids.length === 0) return NextResponse.json({ images: {} });

    const { data, error } = await auth.supabaseAdmin
      .from('estimates')
      .select('id, reference_images')
      .in('id', ids)
      .eq('tenant_id', String(auth.tenant_id));

    if (error) {
      console.error('[/api/staff/estimate-images] select error:', error);
      return NextResponse.json({ error: '見積の写真の取得に失敗しました' }, { status: 500 });
    }

    const images = {};
    for (const row of data || []) {
      const list = Array.isArray(row.reference_images)
        ? row.reference_images.filter(u => typeof u === 'string' && /^https?:\/\//.test(u))
        : [];
      if (list.length > 0) images[row.id] = list;
    }
    return NextResponse.json({ images });
  } catch (e) {
    console.error('[/api/staff/estimate-images] error:', e);
    return NextResponse.json({ error: '見積の写真の取得に失敗しました' }, { status: 500 });
  }
}
