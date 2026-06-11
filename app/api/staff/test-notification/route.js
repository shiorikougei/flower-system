// [Phase1-⑤] 店舗通知メアドの確認フロー
// 設定で入力したメアドに「テスト通知」を送信して、実際に届くかを確認できるAPI

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/utils/email';
import { escapeHtml } from '@/utils/emailTemplates';
import { rateLimit, getClientIp } from '@/utils/rateLimit';

export async function POST(request) {
  try {
    // レート制限: IPあたり 10回/5分（誤送信スパム防止）
    const ip = getClientIp(request);
    const allowed = await rateLimit({ key: `test_notify:${ip}`, max: 10, windowSec: 300 });
    if (!allowed) {
      return NextResponse.json({ error: 'リクエスト過多です。しばらく待ってから再度お試しください。' }, { status: 429 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '認証失敗' }, { status: 401 });

    const body = await request.json();
    const { email, ccEmails, shopName: providedShopName } = body;
    if (!email || typeof email !== 'string') return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 });
    // 簡易フォーマット検証
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 });
    }

    const ccList = Array.isArray(ccEmails)
      ? ccEmails.filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      : [];

    const shopName = providedShopName || 'FLORIX';
    const now = new Date().toLocaleString('ja-JP');

    const html = `
      <!DOCTYPE html>
      <html><body style="font-family:'Hiragino Sans',sans-serif; background:#FBFAF9; padding:20px;">
        <div style="max-width:600px; margin:0 auto; background:white; padding:30px; border-radius:12px;">
          <div style="background:#117768; color:white; padding:16px 20px; border-radius:8px 8px 0 0; font-size:14px; font-weight:bold; margin:-30px -30px 20px;">
            ✅ 通知メール テスト送信
          </div>
          <h2 style="color:#117768; margin:0 0 12px;">設定確認のテスト通知です</h2>
          <p style="color:#333; font-size:13px; line-height:1.7;">
            このメールが届いていれば、<strong>${escapeHtml(shopName)}</strong> の受注通知メール設定は正常です。<br/>
            今後、新しいご注文や見積依頼が入ると、このメールアドレスに通知が届きます。
          </p>
          <div style="background:#f0fdf4; padding:14px; border-left:4px solid #117768; margin:16px 0; font-size:12px; color:#333;">
            <strong>送信先:</strong> ${escapeHtml(email)}<br/>
            ${ccList.length > 0 ? `<strong>CC:</strong> ${escapeHtml(ccList.join(', '))}<br/>` : ''}
            <strong>送信日時:</strong> ${escapeHtml(now)}
          </div>
          <p style="font-size:11px; color:#999; margin-top:24px;">
            このメールに心当たりがない場合は、第三者が誤って入力した可能性があります。お手数ですがメールを破棄してください。
          </p>
        </div>
      </body></html>
    `;

    const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
    const result = await sendEmail({
      to: email,
      cc: ccList.length > 0 ? ccList : undefined,
      subject: `【テスト通知】${shopName} 受注通知メール設定の確認`,
      html,
      from,
    });

    if (result?.error) {
      return NextResponse.json({ error: '送信失敗しました。メールアドレスが正しいか確認してください。' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, sentTo: email, cc: ccList });
  } catch (err) {
    console.error('[/api/staff/test-notification] error:', err?.message || 'unknown');
    return NextResponse.json({ error: '送信失敗しました' }, { status: 500 });
  }
}
