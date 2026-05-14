// 顧客パスワード設定/変更/解除 API
// マイページ（token認証済み）からのみ呼び出し可
//
// POST  /api/customer-set-password   Body: { token, newPassword }  → 設定/変更
// DELETE /api/customer-set-password   Body: { token }                → 解除

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

async function authBy(token, supabaseAdmin) {
  if (!token) return { error: 'トークン必要', status: 400 };
  const { data: session } = await supabaseAdmin
    .from('customer_sessions')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (!session) return { error: '無効なリンク', status: 401 };
  if (new Date(session.expires_at) < new Date()) {
    return { error: 'リンクの有効期限切れ', status: 401 };
  }
  return { session };
}

// パスワード強度の最低要件: 8文字以上
function validatePassword(pw) {
  if (!pw || typeof pw !== 'string') return 'パスワードが必要';
  if (pw.length < 8) return 'パスワードは8文字以上で設定してください';
  if (pw.length > 100) return 'パスワードが長すぎます';
  return null;
}

export async function POST(request) {
  try {
    const { token, newPassword } = await request.json();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const auth = await authBy(token, supabaseAdmin);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const validationErr = validatePassword(newPassword);
    if (validationErr) return NextResponse.json({ error: validationErr }, { status: 400 });

    const hash = await bcrypt.hash(newPassword, 10);

    // upsert
    await supabaseAdmin
      .from('customer_credentials')
      .upsert(
        {
          tenant_id: auth.session.tenant_id,
          email: auth.session.email,
          password_hash: hash,
          failed_attempts: 0,
          locked_until: null,
        },
        { onConflict: 'tenant_id,email' }
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[customer-set-password] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { token } = await request.json();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const auth = await authBy(token, supabaseAdmin);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    await supabaseAdmin
      .from('customer_credentials')
      .delete()
      .eq('tenant_id', auth.session.tenant_id)
      .eq('email', auth.session.email);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
