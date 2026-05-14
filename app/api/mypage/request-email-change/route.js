// メールアドレス変更リクエスト送信
// POST /api/mypage/request-email-change
// Body: { token, newEmail }
// 動作:
//   1. token認証で旧メアドを取得
//   2. 新メアドがすでに別の顧客で使われていないか確認
//   3. 確認トークンを発行して customer_email_change_requests に保存
//   4. 新メアド宛に「変更を確認するリンク」をメール送信

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendEmail } from '@/utils/email';

export const runtime = 'nodejs';

const EXPIRY_HOURS = 24;

async function authBy(token, supabaseAdmin) {
  if (!token) return { error: 'トークン必要', status: 400 };
  const { data: session } = await supabaseAdmin
    .from('customer_sessions')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (!session) return { error: '無効なリンク', status: 401 };
  if (new Date(session.expires_at) < new Date()) {
    return { error: 'リンクの有効期限切れ', status: 401 };
  }
  return { session };
}

export async function POST(request) {
  try {
    const { token, newEmail } = await request.json();
    if (!newEmail || !newEmail.includes('@')) {
      return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 });
    }
    const normalizedNew = String(newEmail).toLowerCase().trim();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const auth = await authBy(token, supabaseAdmin);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const tenantId = auth.session.tenant_id;
    const oldEmail = auth.session.email;

    if (oldEmail === normalizedNew) {
      return NextResponse.json({ error: '現在のメールアドレスと同じです' }, { status: 400 });
    }

    // 新メアドが既に別顧客で使われていないかチェック（注文 or credentials）
    const { data: existingOrders } = await supabaseAdmin
      .from('orders')
      .select('id, order_data')
      .eq('tenant_id', tenantId)
      .limit(50);
    const conflict = (existingOrders || []).some(
      o => o.order_data?.customerInfo?.email?.toLowerCase() === normalizedNew
    );
    if (conflict) {
      return NextResponse.json({
        error: 'このメールアドレスは別のお客様のご注文で既に使用されています。',
      }, { status: 409 });
    }

    // トークン発行
    const changeToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from('customer_email_change_requests').insert({
      token: changeToken,
      tenant_id: tenantId,
      old_email: oldEmail,
      new_email: normalizedNew,
      expires_at: expiresAt,
    });

    // 店舗情報取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const settings = settingsRow?.settings_data || {};
    const shop = settings.shops?.[0] || {};
    const shopName = shop.name || settings.generalConfig?.appName || 'お花屋さん';

    // 確認URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const confirmUrl = `${appUrl}/order/${tenantId}/default/email-change?token=${changeToken}`;

    // 新メアド宛に確認メール
    const subject = `【${shopName}】メールアドレス変更のご確認`;
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#FBFAF9; font-family:'Hiragino Sans', sans-serif; color:#111; line-height:1.7;">
  <div style="max-width:600px; margin:0 auto; background:white; padding:40px 24px;">
    <h1 style="font-size:18px; color:#2D4B3E; margin:0 0 16px 0;">メールアドレス変更のご確認</h1>
    <p style="font-size:13px;">マイページのメールアドレス変更リクエストを受け付けました。</p>
    <p style="font-size:13px; padding:12px; background:#FBFAF9; border-radius:8px;">
      変更前: ${oldEmail}<br/>
      <strong>変更後: ${normalizedNew}</strong>
    </p>
    <p style="font-size:13px;">下記のリンクをクリックして変更を確定してください。</p>
    <div style="text-align:center; margin:24px 0;">
      <a href="${confirmUrl}" style="display:inline-block; background:#2D4B3E; color:white; padding:14px 32px; border-radius:12px; text-decoration:none; font-weight:bold; font-size:13px;">メールアドレスの変更を確定する</a>
    </div>
    <p style="font-size:11px; color:#999;">※このリンクは24時間有効です。<br/>※心当たりのない場合はこのメールを破棄してください。</p>
    <p style="font-size:11px; color:#999; margin-top:32px; padding-top:16px; border-top:1px solid #EAEAEA; text-align:center;">— ${shopName} —</p>
  </div>
</body></html>`;
    const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
    await sendEmail({ to: normalizedNew, subject, html, from });

    // 旧メアド宛にも通知（不正検知用）
    const notifySubject = `【${shopName}】メールアドレス変更のリクエストを受け付けました`;
    const notifyHtml = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background:#FBFAF9; font-family:'Hiragino Sans', sans-serif; color:#111; line-height:1.7;">
  <div style="max-width:600px; margin:0 auto; background:white; padding:40px 24px;">
    <h1 style="font-size:18px; color:#2D4B3E; margin:0 0 16px 0;">メールアドレス変更リクエスト通知</h1>
    <p style="font-size:13px;">マイページから下記のメールアドレス変更がリクエストされました：</p>
    <p style="font-size:13px; padding:12px; background:#FBFAF9; border-radius:8px;">
      変更前: ${oldEmail}（このアドレス）<br/>
      変更後: ${normalizedNew}
    </p>
    <p style="font-size:12px; color:#D97D54;">⚠️ 心当たりがない場合は、すぐに ${shopName} までお問い合わせください。</p>
    <p style="font-size:11px; color:#999; margin-top:16px;">※実際の変更は、新メールアドレス宛に送られた確認リンクのクリック後に有効になります。</p>
    <p style="font-size:11px; color:#999; margin-top:32px; padding-top:16px; border-top:1px solid #EAEAEA; text-align:center;">— ${shopName} —</p>
  </div>
</body></html>`;
    await sendEmail({ to: oldEmail, subject: notifySubject, html: notifyHtml, from });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('[request-email-change] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
