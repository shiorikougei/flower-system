// メールアドレス変更の確定実行
// POST /api/mypage/confirm-email-change  Body: { token }
//
// 動作:
//   1. トークン検証（有効期限、未使用）
//   2. 全テーブルで old_email → new_email に更新
//      - orders.order_data.customerInfo.email
//      - customer_sessions.email
//      - customer_anniversaries.customer_email
//      - customer_credentials.email
//      - customer_line_links.customer_email
//      - stock_notifications.email
//   3. confirmed_at をセット（再使用防止）
//   4. 新メアドで新規セッショントークンを発行して返す
//
// セキュリティ: トークンは一度きり

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const TOKEN_EXPIRY_HOURS = 24;
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { token } = await request.json();
    if (!token) return NextResponse.json({ error: 'トークン必要' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: req } = await supabaseAdmin
      .from('customer_email_change_requests')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!req) return NextResponse.json({ error: '無効なリンクです' }, { status: 401 });
    if (req.confirmed_at) {
      return NextResponse.json({ error: 'このリンクは既に使用されています' }, { status: 410 });
    }
    if (new Date(req.expires_at) < new Date()) {
      return NextResponse.json({ error: 'リンクの有効期限が切れています' }, { status: 410 });
    }

    const { tenant_id, old_email, new_email } = req;

    // 1. orders の order_data.customerInfo.email を更新
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, order_data')
      .eq('tenant_id', tenant_id);
    for (const o of orders || []) {
      if (o.order_data?.customerInfo?.email?.toLowerCase() === old_email) {
        const newData = {
          ...o.order_data,
          customerInfo: { ...o.order_data.customerInfo, email: new_email },
        };
        await supabaseAdmin.from('orders').update({ order_data: newData }).eq('id', o.id);
      }
      // 受取人(recipientInfo)が同じメアドのケースも対応
      if (o.order_data?.recipientInfo?.email?.toLowerCase() === old_email) {
        const newData = {
          ...o.order_data,
          recipientInfo: { ...o.order_data.recipientInfo, email: new_email },
        };
        await supabaseAdmin.from('orders').update({ order_data: newData }).eq('id', o.id);
      }
    }

    // 2. customer_sessions
    await supabaseAdmin
      .from('customer_sessions')
      .update({ email: new_email })
      .eq('tenant_id', tenant_id)
      .eq('email', old_email);

    // 3. customer_anniversaries
    await supabaseAdmin
      .from('customer_anniversaries')
      .update({ customer_email: new_email })
      .eq('tenant_id', tenant_id)
      .eq('customer_email', old_email);

    // 4. customer_credentials（既存のパスワードはそのまま新メアドに移動）
    await supabaseAdmin
      .from('customer_credentials')
      .update({ email: new_email })
      .eq('tenant_id', tenant_id)
      .eq('email', old_email);

    // 5. customer_line_links
    await supabaseAdmin
      .from('customer_line_links')
      .update({ customer_email: new_email })
      .eq('tenant_id', tenant_id)
      .eq('customer_email', old_email);

    // 6. stock_notifications（テーブルが存在する場合）
    try {
      await supabaseAdmin
        .from('stock_notifications')
        .update({ email: new_email })
        .eq('tenant_id', tenant_id)
        .eq('email', old_email);
    } catch (e) { /* テーブル無くてもエラー無視 */ }

    // 7. リクエストを confirmed 化
    await supabaseAdmin
      .from('customer_email_change_requests')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', req.id);

    // 8. 新メアドで新規セッショントークン発行
    const newSessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from('customer_sessions').insert({
      token: newSessionToken,
      tenant_id,
      email: new_email,
      expires_at: expiresAt,
    });

    return NextResponse.json({
      ok: true,
      newEmail: new_email,
      newToken: newSessionToken,
      tenantId: tenant_id,
    });
  } catch (err) {
    console.error('[confirm-email-change] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
