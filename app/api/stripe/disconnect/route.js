// Stripe Connect 接続を解除する
// POST /api/stripe/disconnect
//
// 注意: Standardアカウントの場合は Stripe側で disconnect API を呼ぶ。
//       Expressアカウントの場合は、アプリ側で参照を消すだけにする（アカウント自体は残す）。

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, STRIPE_CLIENT_ID } from '@/utils/stripe';

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

    const { data: settingsRow } = await supabase
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const settingsData = settingsRow?.settings_data || {};
    const stripeInfo = settingsData.stripe;
    if (!stripeInfo?.accountId) {
      return NextResponse.json({ disconnected: true });  // 既に未接続
    }

    // Standardアカウントなら Stripe APIで切断
    if (stripeInfo.type === 'standard' && STRIPE_CLIENT_ID) {
      try {
        await stripe.oauth.deauthorize({
          client_id: STRIPE_CLIENT_ID,
          stripe_user_id: stripeInfo.accountId,
        });
      } catch (e) {
        console.warn('Stripe deauthorize failed, will still remove local link:', e.message);
      }
    }
    // Express はアプリ側で参照を消すだけ

    const newSettings = { ...settingsData };
    delete newSettings.stripe;
    await supabase
      .from('app_settings')
      .upsert({ id: tenantId, settings_data: newSettings });

    return NextResponse.json({ disconnected: true });
  } catch (err) {
    console.error('[/api/stripe/disconnect] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
