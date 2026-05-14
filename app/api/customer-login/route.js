// 顧客パスワードログインAPI
// POST /api/customer-login
// Body: { tenantId, email, password }
// Returns: { token } - 成功時、24h 有効な customer_sessions トークン
//
// セキュリティ:
//   - bcrypt でハッシュ照合
//   - 5回失敗で30分ロック
//   - 「ユーザーが存在しない」と「パスワード不一致」を区別せず汎用エラー

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const TOKEN_EXPIRY_HOURS = 24;
const MAX_FAILS = 5;
const LOCK_MINUTES = 30;

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { tenantId, email, password } = await request.json();
    if (!tenantId || !email || !password) {
      return NextResponse.json({ error: '必須項目が不足' }, { status: 400 });
    }
    const normalizedEmail = String(email).toLowerCase().trim();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: cred } = await supabaseAdmin
      .from('customer_credentials')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!cred) {
      // 存在しないが、攻撃者にバレないよう同じ汎用エラー
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 });
    }

    // ロック中チェック
    if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
      const minLeft = Math.ceil((new Date(cred.locked_until) - new Date()) / 60000);
      return NextResponse.json({
        error: `アカウントが一時的にロックされています。${minLeft}分後にお試しください。`,
      }, { status: 423 });
    }

    const ok = await bcrypt.compare(password, cred.password_hash);
    if (!ok) {
      // 失敗カウントアップ
      const newFails = (cred.failed_attempts || 0) + 1;
      const shouldLock = newFails >= MAX_FAILS;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;
      await supabaseAdmin
        .from('customer_credentials')
        .update({
          failed_attempts: shouldLock ? 0 : newFails,
          locked_until: lockedUntil,
        })
        .eq('id', cred.id);

      if (shouldLock) {
        return NextResponse.json({
          error: `${MAX_FAILS}回連続で失敗しました。${LOCK_MINUTES}分後にもう一度お試しください。`,
        }, { status: 423 });
      }
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, { status: 401 });
    }

    // 成功 → 失敗カウントリセット + last_login_at 更新
    await supabaseAdmin
      .from('customer_credentials')
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', cred.id);

    // セッショントークン発行
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from('customer_sessions').insert({
      token,
      tenant_id: String(tenantId),
      email: normalizedEmail,
      expires_at: expiresAt,
    });

    return NextResponse.json({ token, expiresAt });
  } catch (err) {
    console.error('[customer-login] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
