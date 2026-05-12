// 店舗の Stripe Connect 接続状態を取得する API Route
// GET /api/stripe/account
//
// 認証: Supabase セッション必須。ログインユーザーの tenant_id 配下の
//       app_settings.settings_data.stripe を読み、Stripe APIで最新状態を確認する。

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/utils/stripe';

export async function GET(request) {
  try {
    // 1. リクエストから Authorization ヘッダー (JWT) を取得
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return NextResponse.json({ error: '未認証' }, { status: 401 });
    }

    // 2. Supabase クライアントを JWT 付きで作成（ユーザー権限で動く）
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );

    // 3. ログインユーザーの tenant_id を取得
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: '認証に失敗' }, { status: 401 });
    }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_idが取得できません' }, { status: 400 });
    }

    // 4. app_settings から Stripe 接続情報を取得
    const { data: settingsRow } = await supabase
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const stripeInfo = settingsRow?.settings_data?.stripe;

    if (!stripeInfo?.accountId) {
      return NextResponse.json({ connected: false });
    }

    // 5. Stripe APIで最新状態を取得（接続済みなら、その口座の状態を反映）
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe SDK 未初期化（STRIPE_SECRET_KEY未設定）' }, { status: 500 });
    }
    try {
      const account = await stripe.accounts.retrieve(stripeInfo.accountId);

      // ★ DB側のキャッシュも最新化（注文ページが参照するため）
      //   Service Role でアップサート（権限の都合）
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      await supabaseAdmin
        .from('app_settings')
        .upsert({
          id: tenantId,
          settings_data: {
            ...(settingsRow?.settings_data || {}),
            stripe: {
              ...stripeInfo,
              accountId: account.id,
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled,
              detailsSubmitted: account.details_submitted,
            },
          },
        });

      return NextResponse.json({
        connected: true,
        accountId: account.id,
        type: stripeInfo.type || 'express',
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements,  // 追加情報が必要な場合の参考
      });
    } catch (e) {
      // Stripe側でアカウントが消えている等
      return NextResponse.json({
        connected: false,
        error: 'Stripe側でアカウント情報を取得できませんでした',
      });
    }
  } catch (err) {
    console.error('[/api/stripe/account] error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
