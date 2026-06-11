// [Phase2.5-#114] 監査ログの整合性検証
// 全レコードを順次取り出してハッシュチェーンを再計算し、改ざんを検知

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

function computeRowHash({ prevHash, tenantId, staffName, staffRole, action, targetType, targetId, description, createdAtIso }) {
  const payload = [
    prevHash || '',
    tenantId || '',
    staffName || '',
    staffRole || '',
    action || '',
    targetType || '',
    targetId || '',
    description || '',
    createdAtIso || '',
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

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

    // テナントの全audit_logを古い順に取得（row_hashが設定されているもののみ）
    const { data: rows } = await supabaseAdmin
      .from('audit_log')
      .select('id, tenant_id, staff_name, staff_role, action, target_type, target_id, description, created_at, row_hash, prev_hash')
      .eq('tenant_id', tenantId)
      .not('row_hash', 'is', null)
      .order('created_at', { ascending: true });

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: true, total: 0, verified: 0, tampered: [] });
    }

    // 全レコードのハッシュチェーンを再計算
    let prev = '';
    const tampered = [];
    let verified = 0;

    for (const row of rows) {
      const expected = computeRowHash({
        prevHash: prev,
        tenantId: row.tenant_id,
        staffName: row.staff_name,
        staffRole: row.staff_role,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        description: row.description,
        createdAtIso: row.created_at,
      });
      if (expected !== row.row_hash) {
        tampered.push({
          id: row.id,
          createdAt: row.created_at,
          expected,
          actual: row.row_hash,
        });
      } else if (row.prev_hash !== prev) {
        // prev_hash の整合性も検証
        tampered.push({
          id: row.id,
          createdAt: row.created_at,
          prevHashExpected: prev,
          prevHashActual: row.prev_hash,
          reason: 'prev_hash mismatch',
        });
      } else {
        verified++;
      }
      prev = row.row_hash;
    }

    return NextResponse.json({
      ok: tampered.length === 0,
      total: rows.length,
      verified,
      tampered,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[audit-log verify]', err?.message);
    return NextResponse.json({ error: '検証失敗' }, { status: 500 });
  }
}
