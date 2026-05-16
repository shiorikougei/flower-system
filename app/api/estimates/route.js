// お見積もり依頼 API
// POST   /api/estimates       → 新規見積依頼（お客様）
// GET    /api/estimates       → 一覧取得（スタッフ）
// PATCH  /api/estimates       → 店舗回答 or 確定変換

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, noReplyFooter } from '@/utils/email';
import { rateLimit, getClientIp } from '@/utils/rateLimit';

export const runtime = 'nodejs';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// POST: お客様が見積依頼
export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const allowed = await rateLimit({ key: `estimate:${ip}`, max: 5, windowSec: 300 });
    if (!allowed) {
      return NextResponse.json({ error: 'リクエスト過多です' }, { status: 429 });
    }

    const body = await request.json();
    const { tenantId, shopId, customerName, customerEmail, customerPhone, requestContent, requestData, referenceImages } = body;

    if (!tenantId || !customerName || !customerEmail || !requestContent) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }
    if (String(requestContent).length > 2000) {
      return NextResponse.json({ error: '内容が長すぎます (2000文字以内)' }, { status: 400 });
    }

    const supabase = admin();
    const { data, error } = await supabase.from('estimates').insert([{
      tenant_id: String(tenantId).toLowerCase(),
      shop_id: shopId || null,
      customer_name: String(customerName).slice(0, 100),
      customer_email: String(customerEmail).toLowerCase().slice(0, 200),
      customer_phone: customerPhone ? String(customerPhone).slice(0, 30) : null,
      request_content: String(requestContent).slice(0, 2000),
      request_data: requestData || null,
      reference_images: Array.isArray(referenceImages) ? referenceImages.slice(0, 5) : null,
      status: 'pending',
    }]).select('id').single();

    if (error) {
      console.error('[estimates POST]', error);
      return NextResponse.json({ error: '見積依頼の登録に失敗しました' }, { status: 500 });
    }

    // 店舗へ通知メール
    try {
      const { data: tRow } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      const shopEmail = tRow?.settings_data?.generalConfig?.email || tRow?.settings_data?.shops?.[0]?.email;
      const shopName = tRow?.settings_data?.generalConfig?.appName || tenantId;
      if (shopEmail) {
        await sendEmail({
          to: shopEmail,
          subject: `【見積依頼】${customerName} 様からのご依頼`,
          html: `<!DOCTYPE html><html><body style="font-family:'Hiragino Sans',sans-serif;padding:20px;">
            <h2 style="color:#117768;">💰 新規お見積もりのご依頼</h2>
            <div style="background:#f9f9f9;padding:15px;border-radius:8px;">
              <p><strong>お客様:</strong> ${customerName} 様</p>
              <p><strong>メール:</strong> ${customerEmail}</p>
              <p><strong>お電話:</strong> ${customerPhone || '-'}</p>
              <p><strong>ご依頼内容:</strong></p>
              <pre style="white-space:pre-wrap;background:white;padding:10px;border:1px solid #eaeaea;border-radius:4px;">${requestContent}</pre>
            </div>
            <p style="margin-top:20px;">
              <a href="https://noodleflorix.com/staff/estimates/${data.id}"
                 style="background:#117768;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">
                スタッフ画面で回答する →
              </a>
            </p>
            ${noReplyFooter()}
          </body></html>`,
        });
      }
    } catch (e) { console.warn('[estimate notify mail]', e?.message); }

    return NextResponse.json({ ok: true, estimateId: data.id });
  } catch (err) {
    console.error('[estimates POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: 見積一覧（スタッフ用）
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');
    const status = url.searchParams.get('status'); // optional filter
    if (!tenantId) return NextResponse.json({ error: 'tenantId必要' }, { status: 400 });

    const supabase = admin();
    let q = supabase.from('estimates').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ estimates: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: 店舗回答 or お客様承諾
export async function PATCH(request) {
  try {
    const { id, action, replyMessage, proposedPrice, customerToken } = await request.json();
    if (!id || !action) return NextResponse.json({ error: 'id/action必要' }, { status: 400 });

    const supabase = admin();
    const { data: cur } = await supabase.from('estimates').select('*').eq('id', id).single();
    if (!cur) return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 });

    if (action === 'reply') {
      // 店舗回答
      await supabase.from('estimates').update({
        reply_message: String(replyMessage || '').slice(0, 2000),
        proposed_price: Number(proposedPrice) || 0,
        status: 'replied',
        replied_at: new Date().toISOString(),
      }).eq('id', id);

      // お客様にメール
      try {
        await sendEmail({
          to: cur.customer_email,
          subject: `【お見積もりのご回答】${cur.customer_name} 様`,
          html: `<!DOCTYPE html><html><body style="font-family:'Hiragino Sans',sans-serif;padding:20px;">
            <h2 style="color:#117768;">💐 お見積もりのご回答</h2>
            <p>${cur.customer_name} 様</p>
            <p>お問い合わせいただきありがとうございます。<br/>下記の内容でお見積もりさせていただきます。</p>
            <div style="background:#f0fdf4;border:2px solid #117768;padding:20px;border-radius:12px;margin:20px 0;">
              <p style="margin:0;font-size:11px;color:#666;">ご提案価格(税込)</p>
              <p style="margin:5px 0;font-size:32px;font-weight:bold;color:#117768;">¥${(Math.floor(Number(proposedPrice) * 1.1)).toLocaleString()}</p>
            </div>
            <p style="background:white;padding:15px;border:1px solid #eaeaea;border-radius:8px;white-space:pre-wrap;">${replyMessage || ''}</p>
            <p style="margin-top:20px;">
              内容にご納得いただけましたら、下記から正式注文へお進みください👇
            </p>
            <a href="https://noodleflorix.com/order/${cur.tenant_id}/${cur.shop_id || 'default'}/estimate/${id}"
               style="display:inline-block;background:#117768;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              この内容で確定する →
            </a>
            ${noReplyFooter()}
          </body></html>`,
        });
      } catch (e) { console.warn(e); }

      return NextResponse.json({ ok: true });
    } else if (action === 'accept') {
      // お客様承諾 → 正式注文に変換
      if (cur.status !== 'replied') {
        return NextResponse.json({ error: '回答前の見積です' }, { status: 400 });
      }

      // 注文として登録
      const proposedSub = Number(cur.proposed_price) || 0;
      const tax = Math.floor(proposedSub * 0.1);
      const orderRecord = {
        tenant_id: cur.tenant_id,
        order_data: {
          shopId: cur.shop_id,
          fromEstimate: true,
          estimateId: id,
          customerInfo: { name: cur.customer_name, email: cur.customer_email, phone: cur.customer_phone },
          itemPrice: proposedSub,
          totalAmount: proposedSub + tax,
          note: `お見積依頼から確定: ${cur.request_content}\n\n店舗回答: ${cur.reply_message || ''}`,
          status: 'new',
          paymentMethod: 'bank_transfer',
        },
        payment_status: 'unpaid',
      };
      const { data: order } = await supabase.from('orders').insert([orderRecord]).select('id').single();

      // 見積を converted に
      await supabase.from('estimates').update({ status: 'converted', order_id: order?.id }).eq('id', id);
      return NextResponse.json({ ok: true, orderId: order?.id });
    } else if (action === 'reject') {
      await supabase.from('estimates').update({ status: 'rejected' }).eq('id', id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: '不正なaction' }, { status: 400 });
  } catch (err) {
    console.error('[estimates PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
