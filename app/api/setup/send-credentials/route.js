// 初期設定完了時に管理者パスワードをメール送付
// POST /api/setup/send-credentials
// Body: { email, shopName, tenantId, systemPassword }
//
// 動作: 登録メアド宛に設定画面ロック解除パスワードを送付
// 既存テナントのパスワード再発行にも使用

import { NextResponse } from 'next/server';
import { sendEmail, noReplyFooter } from '@/utils/email';
import { requireOwner } from '@/utils/adminAuth';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { email, shopName, tenantId, systemPassword, isReissue = false } = await request.json();
    if (!email || !systemPassword) {
      return NextResponse.json({ error: 'email/systemPassword必須' }, { status: 400 });
    }

    // ★ 再発行は NocoLde スーパー管理者のみ、初回setupは setup-token 経由なので一定許容
    if (isReissue) {
      const auth = await requireOwner(request);
      if (!auth.ok) return auth.response;
    } else {
      // 初回 setup: setupToken を検証（無いと拒否）
      const setupToken = request.headers.get('x-setup-token') || '';
      if (!setupToken || setupToken.length < 6) {
        return NextResponse.json({ error: 'setupToken が必要です' }, { status: 401 });
      }
    }

    const title = isReissue ? '設定画面ロック解除パスワード（再発行）' : 'NocoLde ご利用開始のご案内';
    const intro = isReissue
      ? '設定画面のロック解除パスワードを再発行いたしました。'
      : 'この度はNocoLde (FLORIX) のご利用を開始いただきありがとうございます。<br/>下記がお客様専用のシステムへログインするための重要な情報です。';

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FBFAF9;font-family:'Hiragino Sans',sans-serif;color:#111;line-height:1.7;">
  <div style="max-width:600px;margin:0 auto;background:white;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;color:#2D4B3E;margin:0 0 4px;">${title}</h1>
      <p style="font-size:12px;color:#999;margin:0;">${shopName || tenantId} 様</p>
    </div>

    <p style="font-size:13px;">${intro}</p>

    <div style="background:#fff7ed;border:2pt solid #f97316;padding:20px;border-radius:12px;margin:24px 0;">
      <p style="font-size:11px;font-weight:bold;color:#c2410c;margin:0 0 10px;letter-spacing:2px;">🔑 設定画面ロック解除パスワード</p>
      <div style="background:white;border:1pt solid #f97316;border-radius:8px;padding:18px 12px;text-align:center;">
        <span style="font-family:monospace;font-size:32pt;font-weight:bold;color:#c2410c;letter-spacing:8pt;">${systemPassword}</span>
      </div>
      <p style="font-size:10px;color:#9a3412;margin:12px 0 0;">
        ⚠️ このパスワードは設定画面の編集時（料金・スタッフ管理・店舗情報等）に必要です。<br/>
        紛失されないよう大切に保管してください。
      </p>
    </div>

    <div style="background:#f0fdf4;border:1pt solid #15803d;padding:14px;border-radius:8px;margin:20px 0;">
      <p style="font-size:11px;font-weight:bold;color:#15803d;margin:0 0 6px;">💡 パスワード変更方法</p>
      <p style="font-size:11px;color:#15803d;margin:0;line-height:1.6;">
        ログイン後 → 各種設定 → スタッフ管理タブ → 「設定画面のロック解除パスワード」項目から変更可能です。
      </p>
    </div>

    <p style="font-size:11px;color:#666;margin-top:24px;line-height:1.6;">
      ご不明な点がございましたら、利用規約をご確認いただくか、<a href="mailto:marusyou.reishin@gmail.com" style="color:#2D4B3E;">marusyou.reishin@gmail.com</a> までお問い合わせください。
    </p>

    ${noReplyFooter()}

    <p style="font-size:11px;color:#999;margin-top:32px;padding-top:16px;border-top:1px solid #EAEAEA;text-align:center;">— NocoLde —</p>
  </div>
</body></html>`;

    const subject = isReissue
      ? `【NocoLde】設定画面ロック解除パスワード 再発行のお知らせ`
      : `【NocoLde】ご利用開始のご案内 - 設定画面ロック解除パスワードのお知らせ`;
    const from = `NocoLde <${process.env.EMAIL_FROM || 'noreply@noodleflorix.com'}>`;

    const result = await sendEmail({ to: email, subject, html, from });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[send-credentials]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
