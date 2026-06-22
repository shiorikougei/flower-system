// [Phase2.5-#112] PIN認証のサーバー側検証
//
// 現状: PIN がクライアントの localStorage / React state で照合 → DevTools改竄で回避可能
// 改善: サーバーで PIN をハッシュ照合 + IPベースのレートリミット + 監査ログ
//
// POST /api/staff/verify-pin
//   Body: { staffName, pin }
//   Response: { ok: true, role } | { ok: false, error, lockedUntilSec }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { rateLimit, getClientIp } from '@/utils/rateLimit';

export const runtime = 'nodejs';

// PINハッシュ化（既存DB値が平文の場合の後方互換含む）
function hashPin(pin, salt) {
  return crypto.createHmac('sha256', salt || process.env.PIN_SALT || 'florix-default-salt')
    .update(String(pin))
    .digest('hex');
}

// 平文 or ハッシュ済みの両方に対応した比較
// 既存データが平文の場合: 平文比較 → 一致したらサーバー側で自動的にハッシュ化を促す（既存運用を壊さない）
function comparePin(inputPin, storedValue) {
  if (!storedValue) return false;
  // ハッシュ済み判定: 64文字の16進数 = SHA256
  const isHashed = /^[0-9a-f]{64}$/i.test(String(storedValue));
  if (isHashed) {
    return hashPin(inputPin) === storedValue;
  }
  // 後方互換: 平文の場合は直接比較（移行期間中のみ）
  return String(inputPin) === String(storedValue);
}

export async function POST(request) {
  try {
    // IPベースのレートリミット: 1IPあたり 10回/分
    const ip = getClientIp(request);
    const allowed = await rateLimit({ key: `pin_verify:${ip}`, max: 10, windowSec: 60 });
    if (!allowed) {
      return NextResponse.json({
        ok: false,
        error: '試行回数が多すぎます。しばらく経ってから再度お試しください。',
        lockedUntilSec: 60,
      }, { status: 429 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ ok: false, error: '未認証' }, { status: 401 });

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: '認証失敗' }, { status: 401 });

    const body = await request.json();
    const { staffName, pin } = body;
    if (!staffName || !pin) return NextResponse.json({ ok: false, error: 'スタッフ名・PIN必須' }, { status: 400 });
    if (!/^\d{4}$/.test(String(pin))) {
      return NextResponse.json({ ok: false, error: 'PINは4桁の数字' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ ok: false, error: 'tenant_id取得失敗' }, { status: 400 });

    // tenant設定からスタッフリスト取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings').select('settings_data').eq('id', tenantId).single();
    const staffList = settingsRow?.settings_data?.staffList || [];
    const staff = staffList.find(s => s.name === staffName);
    if (!staff) return NextResponse.json({ ok: false, error: 'スタッフが見つかりません' }, { status: 404 });
    if (!staff.pin) return NextResponse.json({ ok: false, error: 'PIN未設定です' }, { status: 400 });

    // サーバー側でPIN比較
    const matched = comparePin(pin, staff.pin);
    if (!matched) {
      // 失敗を監査ログに記録（fire-and-forget）
      try {
        await supabaseAdmin.from('audit_log').insert({
          tenant_id: tenantId,
          staff_name: staffName,
          action: 'pin_verify_failed',
          description: `PIN認証失敗 (IP: ${ip})`,
        });
      } catch {}
      return NextResponse.json({ ok: false, error: 'PINが違います' }, { status: 401 });
    }

    // 認証成功
    return NextResponse.json({
      ok: true,
      role: staff.role || 'staff',
      name: staff.name,
      store: staff.store,
    });
  } catch (err) {
    console.error('[/api/staff/verify-pin]', err?.message);
    return NextResponse.json({ ok: false, error: '検証失敗' }, { status: 500 });
  }
}
