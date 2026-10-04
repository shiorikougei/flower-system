// 見積金額の確認用（注文詳細で「見積の金額」と「注文の金額」を突き合わせる表示に使う）
// GET /api/staff/estimate-amount?estimateId=xxx
//
// 認証: スタッフセッション必須（自テナントの見積のみ）
// 読み取り専用。見積・注文のデータは一切変更しない。
// Returns:
//   { proposedPrice, tax, expectedTotal, status, repliedAt, requestContent, replyMessage }
//   expectedTotal = お客様の承諾画面に表示した税込金額（proposed_price + floor(proposed_price * 0.1)）

import { NextResponse } from 'next/server';
import { requireTenantStaff } from '@/utils/adminAuth';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  try {
    const auth = await requireTenantStaff(request);
    if (!auth.ok) return auth.response;
    if (!auth.tenant_id) return NextResponse.json({ error: 'テナント情報が取得できません' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const estimateId = String(searchParams.get('estimateId') || '').trim();
    if (!UUID_RE.test(estimateId)) {
      return NextResponse.json({ error: '見積IDが不正です' }, { status: 400 });
    }

    const { data: est, error } = await auth.supabaseAdmin
      .from('estimates')
      .select('id, proposed_price, status, replied_at, request_content, reply_message')
      .eq('id', estimateId)
      .eq('tenant_id', String(auth.tenant_id))
      .maybeSingle();

    if (error) {
      console.error('[/api/staff/estimate-amount] select error:', error);
      return NextResponse.json({ error: '見積の取得に失敗しました' }, { status: 500 });
    }
    if (!est) return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 });

    // 受注書に「見積のやり取り」を載せるための内容（スタッフのみ・自店舗のみ）
    const exchange = { requestContent: est.request_content || '', replyMessage: est.reply_message || '' };
    const proposedPrice = Number(est.proposed_price);
    if (!Number.isFinite(proposedPrice) || proposedPrice <= 0) {
      return NextResponse.json({ proposedPrice: null, tax: null, expectedTotal: null, status: est.status, repliedAt: est.replied_at || null, ...exchange });
    }
    // 承諾画面（estimate/[estimateId]/page.jsx）と同じ計算
    const tax = Math.floor(proposedPrice * 0.1);
    return NextResponse.json({ proposedPrice, tax, expectedTotal: proposedPrice + tax, status: est.status, repliedAt: est.replied_at || null, ...exchange });
  } catch (e) {
    console.error('[/api/staff/estimate-amount] error:', e);
    return NextResponse.json({ error: '見積の取得に失敗しました' }, { status: 500 });
  }
}
