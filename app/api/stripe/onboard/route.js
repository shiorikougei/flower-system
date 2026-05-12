// Express アカウントを新規作成し、オンボーディングURLを返す
// POST /api/stripe/onboard
//
// 流れ:
//   1. 既存の stripe.accountId があれば、それで AccountLink を作成（再オンボーディング）
//   2. 無ければ新規 Express Account を作成し、accountId を app_settings に保存
//   3. AccountLink (type: 'account_onboarding') の URL を返す
//   4. フロントはこの URL に遷移してオンボーディングを実施

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, APP_URL } from '@/utils/stripe';

export async function POST(request) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'STRIPE_SECRET_KEY が未設定' }, { status: 500 });
    }

    // 認証
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '認証に失敗' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: 'tenant_idが取得できません' }, { status: 400 });

    // 既存設定取得
    const { data: settingsRow } = await supabase
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const settingsData = settingsRow?.settings_data || {};
    const existingStripe = settingsData.stripe || {};

    // アカウントID が無ければ新規作成
    let accountId = existingStripe.accountId;
    if (!accountId) {
      const created = await stripe.accounts.create({
        type: 'express',
        country: 'JP',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { tenant_id: String(tenantId) },
      });
      accountId = created.id;

      // app_settings に保存
      const newSettingsData = {
        ...settingsData,
        stripe: {
          accountId,
          type: 'express',
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          connectedAt: new Date().toISOString(),
        },
      };
      await supabase
        .from('app_settings')
        .upsert({ id: tenantId, settings_data: newSettingsData });
    }

    // AccountLink を作成（オンボーディング画面のURLを取得）
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_URL}/staff/settings?stripe_refresh=1`,
      return_url: `${APP_URL}/staff/settings?stripe_return=1`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error('[/api/stripe/onboard] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
