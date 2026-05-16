// 管理者(NocoLde)API 共通認証ヘルパー
// 自テナント認証 + NocoLde オーナーメアド whitelist
//
// 使い方:
//   import { requireOwner, requireAuthedUser } from '@/utils/adminAuth';
//   const auth = await requireOwner(request);
//   if (!auth.ok) return auth.response;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// NocoLde スーパー管理者のメアド whitelist
const SUPER_ADMIN_EMAILS = [
  'marusyou.reishin@gmail.com',
  'shiorikougei@gmail.com',  // しーちゃん
];

/**
 * Bearer token で認証ユーザーを取得
 * @returns { ok: boolean, user?, tenant_id?, response?(NextResponse) }
 */
export async function requireAuthedUser(request) {
  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return { ok: false, response: NextResponse.json({ error: '認証が必要です' }, { status: 401 }) };
  }

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: '認証失敗' }, { status: 401 }) };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();

  return { ok: true, user, tenant_id: profile?.tenant_id, supabaseAdmin };
}

/**
 * NocoLde スーパー管理者のみ許可
 */
export async function requireOwner(request) {
  const auth = await requireAuthedUser(request);
  if (!auth.ok) return auth;
  const email = (auth.user.email || '').toLowerCase();
  if (!SUPER_ADMIN_EMAILS.includes(email)) {
    return { ok: false, response: NextResponse.json({ error: 'オーナー権限が必要です' }, { status: 403 }) };
  }
  return auth;
}

/**
 * テナントスタッフ（自テナントのみ操作）
 * @param {string} targetTenantId - 操作対象のtenantId
 */
export async function requireTenantStaff(request, targetTenantId) {
  const auth = await requireAuthedUser(request);
  if (!auth.ok) return auth;
  if (targetTenantId && String(auth.tenant_id) !== String(targetTenantId)) {
    return { ok: false, response: NextResponse.json({ error: '他テナントのデータは操作できません' }, { status: 403 }) };
  }
  return auth;
}
