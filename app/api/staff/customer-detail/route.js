// 顧客カルテ用の詳細データ取得
// GET /api/staff/customer-detail?email=xxx
//
// 認証: スタッフセッション必須（テナント自動判別）
// Returns:
//   {
//     anniversaries: [...],   // マイページ登録の記念日
//     lineLinks: [...],       // 該当メアドのLINE紐付け（is_active含む）
//     allLineLinksInTenant: [...],  // テナント全体のLINE紐付け（移動候補用）
//   }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get('email') || '').toLowerCase().trim();
    if (!email) return NextResponse.json({ error: 'email必要' }, { status: 400 });

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

    // 記念日
    const { data: anniversaries } = await supabaseAdmin
      .from('customer_anniversaries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_email', email)
      .order('month', { ascending: true })
      .order('day', { ascending: true });

    // 該当メアドのLINE紐付け
    const { data: lineLinks } = await supabaseAdmin
      .from('customer_line_links')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_email', email)
      .order('linked_at', { ascending: false });

    // テナント全体のLINE紐付け（移動候補のため）
    const { data: allLineLinksInTenant } = await supabaseAdmin
      .from('customer_line_links')
      .select('id, line_user_id, customer_email, display_name, is_active, linked_at')
      .eq('tenant_id', tenantId)
      .order('linked_at', { ascending: false });

    // パスワード設定状況
    const { data: cred } = await supabaseAdmin
      .from('customer_credentials')
      .select('id, last_login_at')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle();

    return NextResponse.json({
      anniversaries: anniversaries || [],
      lineLinks: lineLinks || [],
      allLineLinksInTenant: allLineLinksInTenant || [],
      hasPassword: Boolean(cred),
      lastLoginAt: cred?.last_login_at || null,
    });
  } catch (err) {
    console.error('[customer-detail] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
