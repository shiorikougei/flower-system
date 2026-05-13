// 顧客向け Magic Link 送信API
// POST /api/customer-magiclink
// Body: { tenantId, shopId, email }
//
// 動作:
//   - 過去にこのテナントで注文履歴があるかチェック
//   - あれば Magic Link URLを生成してメール送信
//   - お客様はそのリンクをクリックすると注文履歴ページに自動ログインされる

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendEmail } from '@/utils/email';

const TOKEN_EXPIRY_HOURS = 24;

export async function POST(request) {
  try {
    const { tenantId, shopId, email } = await request.json();
    if (!tenantId || !email) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }
    const normalizedEmail = String(email).toLowerCase().trim();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 過去の注文を確認
    const { data: pastOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(50);

    // メールアドレスでフィルタ
    const hasOrders = (pastOrders || []).some(o => {
      // この時点では order_data を取ってない、フィルタは別途必要
      return true; // 仮: 一旦緩く
    });

    // 実際にメールアドレスでマッチさせる
    const { data: matchedOrders } = await supabaseAdmin
      .from('orders')
      .select('id, order_data')
      .eq('tenant_id', tenantId);

    const ordersForEmail = (matchedOrders || []).filter(o => {
      const ce = o.order_data?.customerInfo?.email || '';
      return ce.toLowerCase() === normalizedEmail;
    });

    if (ordersForEmail.length === 0) {
      // 注文履歴がなくても、ヒント情報を漏らさないため成功と見せる
      return NextResponse.json({ sent: true, hint: 'もしご注文履歴があればメールが届きます' });
    }

    // トークン生成
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    // セッショントークンをDBに保存
    await supabaseAdmin
      .from('customer_sessions')
      .insert({
        token,
        tenant_id: String(tenantId),
        email: normalizedEmail,
        expires_at: expiresAt,
      });

    // 店舗名取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const shopName = settingsRow?.settings_data?.shops?.[0]?.name || settingsRow?.settings_data?.generalConfig?.appName || 'お花屋さん';

    // Magic Link URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const magicUrl = `${appUrl}/order/${tenantId}/${shopId || 'default'}/mypage?token=${token}`;

    // メール送信
    const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><title>注文履歴の確認</title></head>
<body style="margin:0; padding:0; background:#FBFAF9; font-family:'Hiragino Sans', sans-serif; color:#111;">
<div style="max-width:600px; margin:0 auto; background:white; padding:40px 24px;">
  <h1 style="color:#2D4B3E; font-size:20px; margin:0 0 24px 0;">注文履歴のご確認</h1>
  <p style="font-size:13px; line-height:1.7;">
    ご注文履歴の確認URLをお送りします。<br>
    下記ボタンより、過去のご注文内容を確認できます。
  </p>
  <p style="text-align:center; margin:32px 0;">
    <a href="${magicUrl}" style="display:inline-block; padding:14px 40px; background:#2D4B3E; color:white; text-decoration:none; border-radius:8px; font-weight:bold; font-size:14px;">注文履歴を見る</a>
  </p>
  <p style="font-size:11px; color:#999; line-height:1.6;">
    このリンクは <strong>${TOKEN_EXPIRY_HOURS}時間</strong> 有効です。<br>
    心当たりのない場合は、このメールは破棄してください。<br><br>
    ${escapeHtml(shopName)} よりお知らせ
  </p>
</div>
</body></html>`;

    // ★ FROM名を店舗名で上書き
    const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
    await sendEmail({
      to: normalizedEmail,
      subject: `【${shopName}】注文履歴ご確認URL`,
      html,
      from,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('[customer-magiclink] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
