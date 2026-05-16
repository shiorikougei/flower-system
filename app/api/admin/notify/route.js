// 管理者(NocoLde)宛の通知メール送信API
// POST /api/admin/notify
// Body: {
//   type: 'upgrade' | 'cancel' | 'feedback' | 'feature_change',
//   tenantId, tenantName,
//   subject, body, metadata?
// }
//
// 通知先: marusyou.reishin@gmail.com（管理者）
// + DB の clientRequests / upgradeRequests に記録

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/utils/email';

export const runtime = 'nodejs';

const ADMIN_EMAIL = 'marusyou.reishin@gmail.com';

const TYPE_LABELS = {
  upgrade: 'アップグレード依頼',
  cancel: '解約申請',
  feedback: '要望・バグ報告',
  feature_change: '機能変更依頼',
};

// ★ 簡易レート制限（IP/分単位、メモリ）— spam踏み台防止
const rateLimitMap = new Map();
function checkRate(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 5; // 1分5件まで
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count <= max;
}

export async function POST(request) {
  try {
    // ★ レート制限
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRate(ip)) {
      return NextResponse.json({ error: 'リクエスト過多です。しばらくしてから再度お試しください。' }, { status: 429 });
    }

    const payload = await request.json();
    const { type, tenantId, tenantName, subject, body, metadata, _hp } = payload;

    // ★ honeypot: 隠しフィールド _hp に何か入っていれば bot 確定
    if (_hp) {
      return NextResponse.json({ ok: true }); // 攻撃者には成功を装う
    }
    // ★ 文字数制限（過剰な巨大ペイロード防御）
    if ((subject || '').length > 200 || (body || '').length > 5000) {
      return NextResponse.json({ error: '入力が長すぎます' }, { status: 400 });
    }

    if (!type || !subject) return NextResponse.json({ error: 'type/subject必須' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // メール本文
    const typeLabel = TYPE_LABELS[type] || type;
    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FBFAF9;font-family:'Hiragino Sans',sans-serif;color:#111;line-height:1.7;">
  <div style="max-width:600px;margin:0 auto;background:white;padding:40px 24px;">
    <div style="background:${type === 'cancel' ? '#fef2f2' : type === 'upgrade' ? '#f0fdf4' : '#f0f9ff'};padding:8px 12px;border-radius:6px;display:inline-block;font-size:11px;font-weight:bold;color:${type === 'cancel' ? '#dc2626' : type === 'upgrade' ? '#15803d' : '#2563eb'};">
      ${typeLabel}
    </div>
    <h1 style="font-size:18px;color:#2D4B3E;margin:12px 0 16px;">${subject}</h1>
    <div style="background:#FBFAF9;padding:12px;border-radius:8px;margin-bottom:16px;">
      <p style="font-size:11px;color:#999;margin:0;">店舗:</p>
      <p style="font-size:14px;font-weight:bold;margin:2px 0 0;">${tenantName || '(不明)'}</p>
      <p style="font-size:10px;color:#999;font-family:monospace;margin:4px 0 0;">ID: ${tenantId || '-'}</p>
    </div>
    <p style="font-size:13px;white-space:pre-line;">${body || ''}</p>
    ${metadata ? `<pre style="background:#f4f4f4;padding:12px;border-radius:6px;font-size:10px;overflow-x:auto;">${JSON.stringify(metadata, null, 2)}</pre>` : ''}
    <p style="font-size:11px;color:#999;margin-top:24px;padding-top:16px;border-top:1px solid #EAEAEA;">
      ※このメールは FLORIX システムから自動送信されています。<br/>
      対応はオーナーページから行ってください: https://noodleflorix.com/owner
    </p>
  </div>
</body></html>`;

    const from = `FLORIX システム通知 <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
    const result = await sendEmail({ to: ADMIN_EMAIL, subject: `[${typeLabel}] ${subject}`, html, from });

    // DB にも記録（ownerページで管理可能に）
    try {
      const { data: ownerRow } = await supabaseAdmin.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
      const ownerData = ownerRow?.settings_data || {};
      const newReq = {
        id: `${type}_${Date.now()}`,
        type,
        tenantId: tenantId || '-',
        tenantName: tenantName || '(不明)',
        subject,
        body,
        metadata: metadata || null,
        status: 'new',
        date: new Date().toISOString(),
      };
      // タイプごとに別配列に格納
      if (type === 'upgrade' || type === 'feature_change') {
        const upgradeRequests = [newReq, ...(ownerData.upgradeRequests || [])];
        await supabaseAdmin.from('app_settings').upsert({
          id: 'nocolde_owner',
          settings_data: { ...ownerData, upgradeRequests },
        });
      } else {
        const clientRequests = [newReq, ...(ownerData.clientRequests || [])];
        await supabaseAdmin.from('app_settings').upsert({
          id: 'nocolde_owner',
          settings_data: { ...ownerData, clientRequests },
        });
      }
    } catch (e) { console.warn('DB記録失敗:', e?.message); }

    return NextResponse.json({ ok: true, mailed: !result.error });
  } catch (err) {
    console.error('[admin/notify] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
