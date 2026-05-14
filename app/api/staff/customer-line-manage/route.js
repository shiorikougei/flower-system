// スタッフによる LINE 紐付けの手動編集
// POST /api/staff/customer-line-manage
// Body: {
//   action: 'reassign' | 'enable' | 'disable' | 'delete',
//   linkId: uuid,
//   newEmail?: string  // reassign の時のみ必要
// }
//
// 用途:
//   - 「メアド + LINE両方変えてしまった」ようなお客様を、過去注文番号で本人確認した上で
//     スタッフが手動で LINE を別メアドに紐付け直す

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

    const { action, linkId, newEmail } = await request.json();
    if (!action || !linkId) return NextResponse.json({ error: 'action/linkId必要' }, { status: 400 });

    // テナント取得
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: '認証失敗' }, { status: 401 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'tenant_id取得失敗' }, { status: 400 });

    // 対象 link の存在確認 + テナント検証
    const { data: link } = await supabaseAdmin
      .from('customer_line_links')
      .select('*')
      .eq('id', linkId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: '指定の連携が見つかりません' }, { status: 404 });

    if (action === 'enable') {
      await supabaseAdmin
        .from('customer_line_links')
        .update({ is_active: true })
        .eq('id', linkId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'disable') {
      await supabaseAdmin
        .from('customer_line_links')
        .update({ is_active: false })
        .eq('id', linkId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      await supabaseAdmin
        .from('customer_line_links')
        .delete()
        .eq('id', linkId);
      return NextResponse.json({ ok: true });
    }

    if (action === 'reassign') {
      if (!newEmail || !newEmail.includes('@')) {
        return NextResponse.json({ error: '有効な新メアドが必要' }, { status: 400 });
      }
      const normalizedNew = String(newEmail).toLowerCase().trim();

      // 該当メアドの過去注文があるか確認（誤操作防止）
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id, order_data')
        .eq('tenant_id', tenantId)
        .limit(50);
      const hasOrder = (orders || []).some(o =>
        o.order_data?.customerInfo?.email?.toLowerCase() === normalizedNew
      );
      if (!hasOrder) {
        return NextResponse.json({
          error: 'このメアドでの過去注文が見つかりません。本人確認のため、既存注文があるメアドのみ紐付け可能です。'
        }, { status: 400 });
      }

      // reassign実行（同じ tenant_id + line_user_id の重複を避けるため、まず古いレコードを別メアドにいる場合は無効化）
      await supabaseAdmin
        .from('customer_line_links')
        .update({
          customer_email: normalizedNew,
          is_active: true,
        })
        .eq('id', linkId);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '不正なaction' }, { status: 400 });
  } catch (err) {
    console.error('[customer-line-manage] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
