// マイページの Magic Link URL を生成
// 既存の customer_sessions テーブルを使って24時間有効なトークンを発行

import crypto from 'crypto';

const TOKEN_EXPIRY_HOURS = 24;

/**
 * 注文確認メール等から、お客様が直接マイページに飛べる URL を生成
 *   - 既存セッションは使い回さず、新規トークンを発行（混乱防止 + セキュリティ）
 *   - shopId なしの場合は default
 */
export async function createMypageMagicUrl({ supabaseAdmin, tenantId, shopId, email }) {
  if (!supabaseAdmin || !tenantId || !email) return '';
  const normalizedEmail = String(email).toLowerCase().trim();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  try {
    await supabaseAdmin.from('customer_sessions').insert({
      token,
      tenant_id: String(tenantId),
      email: normalizedEmail,
      expires_at: expiresAt,
    });
  } catch (e) {
    console.warn('[mypageLink] customer_sessions insert failed:', e?.message);
    return '';
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${appUrl}/order/${tenantId}/${shopId || 'default'}/mypage?token=${token}`;
}
