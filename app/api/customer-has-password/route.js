// メアドにパスワード設定済みか確認
// GET /api/customer-has-password?tenantId=xxx&email=xxx
// セキュリティ: メアドが本当に存在するかを漏らさない設計。
//              「設定済みっぽいか」だけを true/false で返す。

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
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
