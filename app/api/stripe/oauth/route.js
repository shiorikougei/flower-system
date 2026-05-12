// 既存Stripeアカウントを持つ店舗向け Standard OAuth フロー
//
// GET /api/stripe/oauth         → Stripeの認可画面URLを返す（フロントは遷移するだけ）
// GET /api/stripe/oauth?code=… → Stripeからのコールバック（認可コードをaccess_tokenに交換し、accountIdを保存）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, STRIPE_CLIENT_ID, APP_URL } from '@/utils/stripe';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // CSRF防止用
  const error = url.searchParams.get('error');

  // ----- パターン1: コールバック処理（codeあり） -----
  if (code) {
    try {
      if (!stripe) throw new Error('Stripe未初期化');

      // state からテナントIDを取り出す（簡易的にBase64エンコードしたtenant_idとする）
      let tenantId = '';
      try {
        const decoded = JSON.parse(Buffer.from(state || '', 'base64').toString('utf-8'));
        tenantId = decoded.tenant_id;
      } catch (e) {
        return NextResponse.redirect(`${APP_URL}/staff/settings?stripe_error=invalid_state`);
      }

      // 認可コードを access_token に交換
      const tokenRes = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code,
      });
      const connectedAccountId = tokenRes.stripe_user_id;

      // Service Role でSupabaseに書き込み（OAuthコールバックはユーザーJWTを持たないため）
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('settings_data')
        .eq('id', tenantId)
        .single();
      const settingsData = existing?.settings_data || {};
      await supabaseAdmin
        .from('app_settings')
        .upsert({
          id: tenantId,
          settings_data: {
            ...settingsData,
            stripe: {
              accountId: connectedAccountId,
              type: 'standard',
              chargesEnabled: true,
              payoutsEnabled: true,
              detailsSubmitted: true,
              connectedAt: new Date().toISOString(),
            },
          },
        });

      return NextResponse.redirect(`${APP_URL}/staff/settings?stripe_connected=1`);
    } catch (err) {
      console.error('[/api/stripe/oauth callback] error:', err);
      return NextResponse.redirect(`${APP_URL}/staff/settings?stripe_error=${encodeURIComponent(err.message || 'unknown')}`);
    }
  }

  if (error) {
    return NextResponse.redirect(`${APP_URL}/staff/settings?stripe_error=${encodeURIComponent(error)}`);
  }

  // ----- パターン2: 認可URLを返す（codeなし） -----
  // 認証ヘッダーから tenant_id を取得
  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }
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

  if (!STRIPE_CLIENT_ID) {
    return NextResponse.json({ error: 'STRIPE_CLIENT_IDが未設定' }, { status: 500 });
  }

  // state にテナントIDを含める（コールバック時に取り出す）
  const encodedState = Buffer.from(JSON.stringify({ tenant_id: tenantId })).toString('base64');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: STRIPE_CLIENT_ID,
    scope: 'read_write',
    redirect_uri: `${APP_URL}/api/stripe/oauth`,
    state: encodedState,
  });
  const authorizeUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

  return NextResponse.json({ url: authorizeUrl });
}
