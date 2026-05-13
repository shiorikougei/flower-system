// 記念日リマインダー自動送信 Cron
// GET /api/cron/anniversary-reminders
//
// Vercel Cron で毎日朝 9:00 (JST) に実行する想定（vercel.json で定義）
// - 「今日から7日後」が登録された記念日に一致する顧客を抽出
// - 過去24h以内に既に送信済みなら重複防止のためスキップ
// - 各テナント設定の anniversary_reminder テンプレートでメール送信
//
// セキュリティ: Vercel Cron からの呼び出しを Authorization: Bearer ${CRON_SECRET} で検証

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/utils/email';
import { findTemplateFor, renderTemplate, bodyToHtml } from '@/utils/emailTemplates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Vercel Cron 経由の呼び出しか検証
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Vercelダッシュボードからの手動実行のため secret 未設定なら通す（任意）
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 7日後の月・日を計算（JST想定）
    const target = new Date();
    target.setDate(target.getDate() + 7);
    const targetMonth = target.getMonth() + 1;
    const targetDay = target.getDate();

    // 該当する記念日を取得
    const { data: annivs, error } = await supabaseAdmin
      .from('customer_anniversaries')
      .select('*')
      .eq('month', targetMonth)
      .eq('day', targetDay);
    if (error) throw error;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let sent = 0;
    let skipped = 0;
    const errors = [];

    for (const a of annivs || []) {
      try {
        // 直近24h以内に送信済みならスキップ
        if (a.last_notified_at && new Date(a.last_notified_at) > oneDayAgo) {
          skipped++;
          continue;
        }

        // テナント設定取得
        const { data: settingsRow } = await supabaseAdmin
          .from('app_settings')
          .select('settings_data')
          .eq('id', a.tenant_id)
          .single();
        const settings = settingsRow?.settings_data || {};
        const shop = settings.shops?.[0] || {};
        const shopName = shop.name || settings.generalConfig?.appName || 'お花屋さん';
        const shopPhone = shop.phone || '';

        const tpl = findTemplateFor('anniversary_reminder', settings.autoReplyTemplates, { shopId: shop.id });
        if (!tpl) { skipped++; continue; }

        const vars = {
          customerName: a.customer_name || 'お客',
          shopName,
          anniversaryTitle: a.title,
          anniversaryDate: `${a.month}月${a.day}日`,
          anniversaryNotes: a.notes ? `メモ: ${a.notes}` : '',
          shopPhone,
        };
        const { subject, body } = renderTemplate(tpl, vars);
        const html = bodyToHtml(body, { shopName });
        const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;

        const result = await sendEmail({ to: a.customer_email, subject, html, from });
        if (result.error) {
          errors.push({ id: a.id, error: result.error });
          continue;
        }

        // last_notified_at を更新
        await supabaseAdmin
          .from('customer_anniversaries')
          .update({ last_notified_at: now.toISOString() })
          .eq('id', a.id);

        sent++;
      } catch (e) {
        errors.push({ id: a.id, error: e.message });
      }
    }

    return NextResponse.json({
      executed_at: now.toISOString(),
      target_date: `${targetMonth}/${targetDay}`,
      checked: annivs?.length || 0,
      sent,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('[cron/anniversary-reminders] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
