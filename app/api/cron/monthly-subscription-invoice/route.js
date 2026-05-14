// 月次サブスク請求自動送付
// GET /api/cron/monthly-subscription-invoice
//
// 毎月1日 朝 8:30 (JST) に実行（vercel.json で定義）
// - 全テナントの翌月分料金を計算
// - 請求書HTMLをメールで送付（請求先メール宛）
// - モデル店舗（manualPriceJpy=0）は送信スキップ可能

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/utils/email';
import { DEFAULT_PRICING, calcMonthlyFee, calcWithManualOverride } from '@/utils/subscriptionPricing';
import { FEATURE_GROUPS } from '@/utils/features';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // オーナー設定取得
    const { data: ownerRow } = await supabaseAdmin.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
    const ownerData = ownerRow?.settings_data || {};
    const pricing = { ...DEFAULT_PRICING, ...(ownerData.pricingConfig || {}) };
    const tenantBilling = ownerData.tenantBilling || {};

    // 全テナント取得
    const { data: rows } = await supabaseAdmin.from('app_settings').select('id, settings_data')
      .neq('id', 'nocolde_owner');
    const tenants = (rows || [])
      .filter(r => !['gallery', 'default'].includes(r.id) && !r.id.endsWith('_gallery'))
      .map(r => ({
        id: r.id,
        name: r.settings_data?.generalConfig?.appName || r.id,
        features: r.settings_data?.features || {},
      }));

    // 翌月
    const next = new Date(); next.setMonth(next.getMonth() + 1);
    const targetMonth = `${next.getFullYear()}年${next.getMonth() + 1}月`;
    const dueDate = (() => {
      const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0);
      return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    })();

    let sent = 0;
    let skipped = 0;
    const errors = [];
    const newInvoiceRecords = []; // ★ 送信履歴用

    // ★ AI使用量も統合
    const aiPricingCfg = ownerData.aiPricingConfig || { freeQuotaPerMonth: 100, pricePerExtraJpy: 5 };
    const currentMonthKey = new Date().toISOString().slice(0,7);

    for (const t of tenants) {
      try {
        const billing = tenantBilling[t.id] || {};
        // ★ 優先順位: (1)固定額 manualPriceJpy → (2)機能別オーバーライド → (3)自動計算
        const m = billing.manualPriceJpy;
        const useManual = m != null && m !== '' && Number(m) >= 0;
        const hasFeatureOverrides = (billing.basePriceOverride != null && billing.basePriceOverride !== '') ||
          (billing.featurePriceOverrides && Object.keys(billing.featurePriceOverrides).length > 0);
        const fee = useManual
          ? calcWithManualOverride(Number(m), pricing.taxRate)
          : calcMonthlyFee(
              t.features,
              pricing,
              hasFeatureOverrides ? { basePrice: billing.basePriceOverride, featurePrices: billing.featurePriceOverrides } : null
            );

        // ★ AI使用料計算
        const { data: tRow } = await supabaseAdmin.from('app_settings').select('settings_data').eq('id', t.id).single();
        const monthUsage = tRow?.settings_data?.aiUsage?.[currentMonthKey] || { total: 0 };
        const aiOverage = Math.max(0, (monthUsage.total || 0) - aiPricingCfg.freeQuotaPerMonth);
        const aiSubTotal = aiOverage * aiPricingCfg.pricePerExtraJpy;
        const aiTax = Math.round(aiSubTotal * 0.10);
        const aiTotal = aiSubTotal + aiTax;

        // 合算
        const grandTotal = fee.total + aiTotal;

        // 0円なら送信スキップ
        if (grandTotal === 0) { skipped++; continue; }

        // 請求先メール
        const to = billing.billingEmail;
        if (!to || !to.includes('@')) { skipped++; continue; }

        // ★ Stripe Invoice 作成（クレカ希望テナント）
        let stripeInvoiceUrl = '';
        if (billing.paymentMethod === 'card' && process.env.STRIPE_SECRET_KEY) {
          try {
            const stripeRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/stripe-invoice`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenantId: t.id,
                tenantName: t.name,
                billingEmail: to,
                amount: grandTotal,
                description: `${targetMonth} FLORIX利用料 (${t.name})`,
              }),
            });
            const stripeData = await stripeRes.json();
            if (stripeRes.ok) stripeInvoiceUrl = stripeData.hostedInvoiceUrl;
          } catch (e) { console.warn('[stripe-invoice] failed:', e.message); }
        }

        const featureRows = fee.featureBreakdown ? fee.featureBreakdown.map(f => {
          const item = FEATURE_GROUPS.flatMap(g => g.items).find(i => i.key === f.key);
          return `<tr><td style="padding:6px;border:0.5pt solid #ddd;">${item?.label || f.key}</td><td style="padding:6px;border:0.5pt solid #ddd;text-align:right;">¥${f.price.toLocaleString()}</td></tr>`;
        }).join('') : '';

        const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FBFAF9;font-family:'Hiragino Sans',sans-serif;color:#111;line-height:1.7;">
  <div style="max-width:600px;margin:0 auto;background:white;padding:40px 24px;">
    <h1 style="font-size:18px;color:#2D4B3E;margin:0 0 16px;">${targetMonth} 利用料金 ご請求のお知らせ</h1>
    <p style="font-size:13px;">${t.name} 御中</p>
    <p style="font-size:13px;">いつもFLORIXをご利用いただきありがとうございます。<br/>${targetMonth}分の月額利用料金をお知らせいたします。</p>
    <div style="background:#fafafa;border:1.5pt solid #222;padding:16px;margin:16px 0;text-align:center;border-radius:8px;">
      <div style="font-size:11px;color:#666;">${targetMonth} ご請求金額（税込）</div>
      <div style="font-size:24pt;font-weight:bold;color:#117768;letter-spacing:0.05em;margin-top:4px;">¥${grandTotal.toLocaleString()}</div>
      <div style="font-size:9pt;color:#666;margin-top:4px;">サブスク ¥${fee.total.toLocaleString()}${aiTotal > 0 ? ` + AI使用料 ¥${aiTotal.toLocaleString()}` : ''}</div>
    </div>
    ${fee.manual ? `<p style="font-size:11px;color:#1e40af;background:#f0f9ff;padding:8px;border-radius:4px;">※特別契約による固定料金${billing.manualReason ? `（${billing.manualReason}）` : ''}</p>` : `
      <p style="font-size:11px;color:#117768;font-weight:bold;margin:12px 0 4px;">▼ サブスクリプション利用料</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="background:#f4f4f4;"><th style="padding:6px;border:0.5pt solid #ddd;text-align:left;">項目</th><th style="padding:6px;border:0.5pt solid #ddd;text-align:right;">金額</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px;border:0.5pt solid #ddd;">基本料金</td><td style="padding:6px;border:0.5pt solid #ddd;text-align:right;">¥${fee.basePrice.toLocaleString()}</td></tr>
          ${featureRows}
        </tbody>
      </table>
    `}
    ${aiOverage > 0 ? `
      <p style="font-size:11px;color:#117768;font-weight:bold;margin:12px 0 4px;">▼ AI生成機能 利用超過分</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="background:#f4f4f4;"><th style="padding:6px;border:0.5pt solid #ddd;text-align:left;">項目</th><th style="padding:6px;border:0.5pt solid #ddd;text-align:center;">数量</th><th style="padding:6px;border:0.5pt solid #ddd;text-align:right;">単価</th><th style="padding:6px;border:0.5pt solid #ddd;text-align:right;">金額</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px;border:0.5pt solid #ddd;">AI生成（無料枠超過）</td><td style="padding:6px;border:0.5pt solid #ddd;text-align:center;">${aiOverage}回</td><td style="padding:6px;border:0.5pt solid #ddd;text-align:right;">¥${aiPricingCfg.pricePerExtraJpy.toLocaleString()}</td><td style="padding:6px;border:0.5pt solid #ddd;text-align:right;">¥${aiSubTotal.toLocaleString()}</td></tr>
        </tbody>
      </table>
    ` : ''}
    ${stripeInvoiceUrl ? `
      <div style="background:#3b82f6;color:white;padding:14px;margin:16px 0;text-align:center;border-radius:8px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;">💳 クレジットカードでお支払い</p>
        <a href="${stripeInvoiceUrl}" style="display:inline-block;background:white;color:#3b82f6;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">支払いページを開く →</a>
      </div>
    ` : `
      <div style="background:#f0fdf4;border:1pt solid #15803d;padding:12px;margin:12px 0;font-size:11px;color:#15803d;border-radius:4px;">
        🏦 <strong>銀行振込でのお支払い</strong>: 別途お知らせした口座へお振込みください
      </div>
    `}
    <div style="background:#fff7ed;border:1pt solid #f97316;padding:12px;margin:12px 0;font-size:12px;color:#c2410c;text-align:center;font-weight:bold;border-radius:4px;">
      お支払い期日: ${dueDate}
    </div>
    <p style="font-size:11px;color:#666;margin-top:24px;line-height:1.6;">
      ご請求に関するお問い合わせ・解約については、利用規約をご確認いただくか、marusyou.reishin@gmail.com までお問い合わせください。
    </p>
    <div style="margin-top:24px;padding:14px;background:#f9f5ed;border:1pt solid #e5d9bd;border-radius:8px;font-size:11px;color:#92722c;line-height:1.6;">
      ⚠️ <strong>このメールは送信専用アドレスから自動送信されています。</strong><br/>
      ご返信いただいてもご対応できかねますので、お問い合わせは
      📩 <a href="mailto:marusyou.reishin@gmail.com" style="color:#92722c;text-decoration:underline;">marusyou.reishin@gmail.com</a> までご連絡ください。
    </div>
    <p style="font-size:11px;color:#999;margin-top:32px;padding-top:16px;border-top:1px solid #EAEAEA;text-align:center;">— NocoLde —</p>
  </div>
</body></html>`;

        const subject = `【NocoLde】${targetMonth} 利用料金のご請求 (${grandTotal.toLocaleString()}円)`;
        const from = `NocoLde <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
        const result = await sendEmail({ to, subject, html, from });
        if (result.error) {
          errors.push({ tenant: t.id, error: result.error });
        } else {
          sent++;
          // ★ 請求履歴に追加（管理ページの請求・入金管理タブで参照）
          newInvoiceRecords.push({
            id: `inv_${t.id}_${targetMonth}_${Date.now()}`,
            tenantId: t.id,
            tenantName: t.name,
            month: targetMonth,
            subscriptionTotal: fee.total,
            aiTotal,
            grandTotal,
            paymentMethod: billing.paymentMethod || 'bank_transfer',
            billingEmail: to,
            sentAt: new Date().toISOString(),
            paidAt: null,
            status: 'unpaid',
            stripeInvoiceUrl: stripeInvoiceUrl || '',
            via: 'cron',
          });
        }
      } catch (e) {
        errors.push({ tenant: t.id, error: e.message });
      }
    }

    // ★ 請求履歴を nocolde_owner に追記保存
    if (newInvoiceRecords.length > 0) {
      try {
        const existing = ownerData.invoices || [];
        const merged = [...existing, ...newInvoiceRecords];
        await supabaseAdmin.from('app_settings').upsert({
          id: 'nocolde_owner',
          settings_data: { ...ownerData, invoices: merged },
        });
      } catch (e) { console.warn('[invoice-record] save failed:', e.message); }
    }

    return NextResponse.json({
      executed_at: new Date().toISOString(),
      target_month: targetMonth,
      total_tenants: tenants.length,
      sent,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('[monthly-subscription-invoice]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
