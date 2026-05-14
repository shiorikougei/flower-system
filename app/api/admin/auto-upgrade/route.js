// 機能アップグレードを即時実行
// POST /api/admin/auto-upgrade
// Body: { tenantId, featureKeys: ['ec', 'sales', ...] }
//
// 動作:
//   1. テナントの settings.features の指定機能を ON
//   2. 管理者にメール通知（即時稼働 + 翌月から課金）
//
// セキュリティ: スタッフセッショントークン必須（自分のテナントのみ更新可）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/utils/email';
import { FEATURE_GROUPS } from '@/utils/features';
import { DEFAULT_PRICING, calcMonthlyFee, calcWithManualOverride } from '@/utils/subscriptionPricing';

export const runtime = 'nodejs';
const ADMIN_EMAIL = 'marusyou.reishin@gmail.com';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

    const { featureKeys } = await request.json();
    if (!Array.isArray(featureKeys) || featureKeys.length === 0) {
      return NextResponse.json({ error: '有効化する機能を選択してください' }, { status: 400 });
    }

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

    // 現在の設定取得
    const { data: settingsRow } = await supabaseAdmin.from('app_settings').select('settings_data').eq('id', tenantId).single();
    const settings = settingsRow?.settings_data || {};
    const tenantName = settings.generalConfig?.appName || tenantId;
    const currentFeatures = settings.features || {};

    // 既にONのものは除外
    const newlyEnabled = featureKeys.filter(k => !currentFeatures[k]);
    if (newlyEnabled.length === 0) {
      return NextResponse.json({ ok: true, message: '指定された機能は全て既に有効です', enabled: [] });
    }

    // features を更新（即時ON）
    const nextFeatures = { ...currentFeatures };
    newlyEnabled.forEach(k => { nextFeatures[k] = true; });
    const nextSettings = { ...settings, features: nextFeatures };
    await supabaseAdmin.from('app_settings').upsert({ id: tenantId, settings_data: nextSettings });

    // 管理者通知メール
    const enabledLabels = newlyEnabled.map(k => {
      const item = FEATURE_GROUPS.flatMap(g => g.items).find(i => i.key === k);
      return item ? `・${item.label}` : `・${k}`;
    }).join('\n');

    // 料金プレビュー（オーナー設定があれば取得）
    const { data: ownerRow } = await supabaseAdmin.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
    const pricing = { ...DEFAULT_PRICING, ...(ownerRow?.settings_data?.pricingConfig || {}) };
    // ★ 手動オーバーライドがあればそちらを優先（モデル店舗・特別契約）
    const tenantBilling = ownerRow?.settings_data?.tenantBilling?.[tenantId] || {};
    const m = tenantBilling.manualPriceJpy;
    const useManual = m != null && m !== '' && Number(m) >= 0;
    const newFee = useManual
      ? calcWithManualOverride(Number(m), pricing.taxRate)
      : calcMonthlyFee(nextFeatures, pricing);
    const isManualOverride = useManual;

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FBFAF9;font-family:'Hiragino Sans',sans-serif;color:#111;line-height:1.7;">
  <div style="max-width:600px;margin:0 auto;background:white;padding:40px 24px;">
    <div style="background:#f0fdf4;padding:8px 12px;border-radius:6px;display:inline-block;font-size:11px;font-weight:bold;color:#15803d;">
      🎉 アップグレード自動有効化
    </div>
    <h1 style="font-size:18px;color:#2D4B3E;margin:12px 0 16px;">${tenantName} が機能を追加しました</h1>
    <div style="background:#FBFAF9;padding:12px;border-radius:8px;margin-bottom:16px;">
      <p style="font-size:11px;color:#999;margin:0;">店舗:</p>
      <p style="font-size:14px;font-weight:bold;margin:2px 0;">${tenantName}</p>
      <p style="font-size:10px;color:#999;font-family:monospace;">ID: ${tenantId}</p>
    </div>
    <div style="background:#f0fdf4;border:1pt solid #15803d;padding:12px;border-radius:8px;margin:12px 0;">
      <p style="font-size:12px;font-weight:bold;color:#15803d;margin:0 0 8px;">追加された機能:</p>
      <pre style="font-size:12px;font-family:'Hiragino Sans',sans-serif;white-space:pre-line;margin:0;">${enabledLabels}</pre>
    </div>
    <div style="background:#fff7ed;border:1pt solid #f97316;padding:12px;border-radius:8px;margin:12px 0;">
      <p style="font-size:11px;color:#c2410c;font-weight:bold;margin:0;">📋 料金変更</p>
      <p style="font-size:14px;font-weight:bold;color:#c2410c;margin:6px 0;">翌月から ¥${newFee.total.toLocaleString()}/月（税込）${isManualOverride ? '【特別契約・据え置き】' : ''}</p>
      <p style="font-size:10px;color:#9a3412;margin:0;">${isManualOverride
        ? '※特別契約（固定料金）のため、機能を追加しても月額は据え置きです。'
        : '※当月分はお試し期間として無償でご利用いただけます。'}</p>
    </div>
    <p style="font-size:11px;color:#999;margin-top:24px;padding-top:16px;border-top:1px solid #EAEAEA;">
      ※即時 features を ON にしました。確認は: https://noodleflorix.com/owner
    </p>
  </div>
</body></html>`;

    const from = `FLORIX システム通知 <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
    await sendEmail({ to: ADMIN_EMAIL, subject: `[アップグレード] ${tenantName} - ${newlyEnabled.length}機能追加`, html, from });

    return NextResponse.json({
      ok: true,
      enabled: newlyEnabled,
      newMonthlyFee: newFee.total,
      message: `${newlyEnabled.length}個の機能を即時有効化しました。当月分は無料でお試しいただけます。`,
    });
  } catch (err) {
    console.error('[auto-upgrade]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
