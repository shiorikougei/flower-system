// メアドにパスワード設定済みか確認
// GET /api/customer-has-password?tenantId=xxx&email=xxx
// セキュリティ: メアドが本当に存在するかを漏らさない設計。
//              「設定済みっぽいか」だけを true/false で返す。

import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/utils/rateLimit';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    // [セキュリティ 2026-10] 回数制限（総当たり・大量の問い合わせ対策）
    if (!(await rateLimit({ key: `customer_has_pw:${getClientIp(request)}`, max: 30, windowSec: 600 }))) {
      return NextResponse.json({ error: '短い時間に何度も試されています。しばらくしてからお試しください。' }, { status: 429 });
    }
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const email = String(searchParams.get('email') || '').toLowerCase().trim();
    if (!tenantId || !email) {
      return NextResponse.json({ hasPassword: false });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data } = await supabaseAdmin
      .from('customer_credentials')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle();

    return NextResponse.json({ hasPassword: Boolean(data) });
  } catch (err) {
    return NextResponse.json({ hasPassword: false });
  }
}
