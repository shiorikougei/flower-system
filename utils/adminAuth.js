// 管理者(NocoLde)API 共通認証ヘルパー
// 自テナント認証 + NocoLde オーナーメアド whitelist
//
// 使い方:
//   import { requireOwner, requireAuthedUser } from '@/utils/adminAuth';
//   const auth = await requireOwner(request);
//   if (!auth.ok) return auth.response;

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/utils/rateLimit';

// NocoLde スーパー管理者のメアド whitelist
const SUPER_ADMIN_EMAILS = [
  'marusyou.reishin@gmail.com',
  'shiorikougei@gmail.com',  // しーちゃん
];

// NocoLde オーナー管理ページのパスワード（フロントの handleLogin と一致させる）
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'nocolde2026';

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
 *   - Bearer トークン (Supabase) でメアドが whitelist にあればOK
 *   - もしくは x-owner-password ヘッダで OWNER_PASSWORD と一致すればOK
 */
export async function requireOwner(request) {
  // ★ オーナーパスワード方式 (Supabaseログイン不要)
  const pwHeader = request.headers.get('x-owner-password') || '';
  if (pwHeader) {
    // ★ ブルートフォース対策: IP単位で5回/分まで
    const ip = getClientIp(request);
    const allowed = await rateLimit({ key: `owner_auth:${ip}`, max: 5, windowSec: 60 });
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: '試行回数が多すぎます。しばらくしてから再度お試しください。' }, { status: 429 }) };
    }
    if (pwHeader === OWNER_PASSWORD) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      return { ok: true, user: { email: 'owner@nocolde' }, supabaseAdmin, viaOwnerPassword: true };
    }
    // パスワード一致しないが、ブルートフォース防止のため即エラーは返さずBearer経路へ
  }

  // ★ Bearer トークン方式
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
