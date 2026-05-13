// 在庫切れ通知の一斉送信
// POST /api/stock-notify/dispatch
// Body: { productId }
//
// 指定商品の未通知者全員にメールを送る（スタッフが在庫を補充した時に呼ぶ）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/utils/email';
import { findTemplateFor, renderTemplate, bodyToHtml } from '@/utils/emailTemplates';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ error: '未認証' }, { status: 401 });

    // 認証チェック
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '認証失敗' }, { status: 401 });

    const { productId } = await request.json();
    if (!productId) return NextResponse.json({ error: 'productId 必須' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 商品取得（テナントID, 商品名）
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, name, tenant_id, stock, image_url')
      .eq('id', productId)
      .single();
    if (!product) return NextResponse.json({ error: '商品が見つかりません' }, { status: 404 });

    if (product.stock <= 0) {
      return NextResponse.json({ skipped: true, reason: '在庫がないため送信スキップ' });
    }

    // ユーザーの tenant_id がproductと一致するか確認
    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (profile?.tenant_id !== product.tenant_id) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    // 未通知の登録を取得
    const { data: pendings } = await supabaseAdmin
      .from('stock_notifications')
      .select('id, email, customer_name')
      .eq('product_id', productId)
      .is('notified_at', null);

    if (!pendings || pendings.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // 店舗名取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', product.tenant_id)
      .single();
    const shopName = settingsRow?.settings_data?.shops?.[0]?.name || settingsRow?.settings_data?.generalConfig?.appName || 'お花屋さん';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const shopId = settingsRow?.settings_data?.shops?.[0]?.id || 'default';

    // テンプレートシステムで送信（設定で編集可能、未設定ならプリセット）
    const tpl = findTemplateFor('restock_notification', settingsRow?.settings_data?.autoReplyTemplates, { shopId });

    let sent = 0;
    for (const r of pendings) {
      try {
        let subject, html;
        if (tpl) {
          const vars = {
            customerName: r.customer_name || 'お客',
            productName: product.name,
            shopName,
            shopUrl: `${appUrl}/order/${product.tenant_id}/${shopId}/shop`,
          };
          const rendered = renderTemplate(tpl, vars);
          subject = rendered.subject;
          html = bodyToHtml(rendered.body, { shopName });
        } else {
          subject = `【${shopName}】「${product.name}」が入荷しました`;
          html = buildRestockEmail({ productName: product.name, shopName, productImage: product.image_url, shopUrl: `${appUrl}/order/${product.tenant_id}/${shopId}/shop`, customerName: r.customer_name });
        }
        const from = `${shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`;
        const result = await sendEmail({ to: r.email, subject, html, from });
        if (!result.error) {
          await supabaseAdmin.from('stock_notifications').update({ notified_at: new Date().toISOString() }).eq('id', r.id);
          sent++;
        }
      } catch (e) {
        console.warn('[stock-notify dispatch] 1件失敗:', r.email, e.message);
      }
    }

    return NextResponse.json({ sent, total: pendings.length });
  } catch (err) {
    console.error('[stock-notify dispatch] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}

function buildRestockEmail({ productName, shopName, productImage, shopUrl, customerName }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><title>${escapeHtml(productName)} 入荷のお知らせ</title></head>
<body style="margin:0; padding:0; background:#FBFAF9; font-family:'Hiragino Sans', sans-serif; color:#111;">
<div style="max-width:600px; margin:0 auto; background:white; padding:40px 24px;">
  <h1 style="color:#2D4B3E; font-size:20px; margin:0 0 24px 0;">入荷のお知らせ</h1>
  <p style="font-size:14px;">${escapeHtml(customerName || 'お客')}様</p>
  <p style="font-size:13px; line-height:1.7;">
    お待たせいたしました。<br>
    お問い合わせいただいていた商品が入荷いたしましたのでお知らせいたします。
  </p>
  <div style="margin:24px 0; padding:16px; background:#FBFAF9; border:1px solid #EAEAEA; border-radius:12px;">
    ${productImage ? `<img src="${escapeHtml(productImage)}" alt="${escapeHtml(productName)}" style="width:100%; max-width:300px; border-radius:8px; display:block; margin:0 auto 12px;">` : ''}
    <p style="text-align:center; font-weight:bold; font-size:16px; color:#2D4B3E; margin:0;">${escapeHtml(productName)}</p>
  </div>
  <p style="text-align:center; margin:24px 0;">
    <a href="${escapeHtml(shopUrl)}" style="display:inline-block; padding:12px 32px; background:#2D4B3E; color:white; text-decoration:none; border-radius:8px; font-weight:bold; font-size:14px;">商品ページを見る</a>
  </p>
  <p style="font-size:11px; color:#999; margin-top:32px; line-height:1.6;">${escapeHtml(shopName)} よりお知らせ</p>
</div>
</body></html>`;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
