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
      reference_images: Array.isArray(referenceImages) ? referenceImages.slice(0, 10) : null,
      status: 'pending',
    }]).select('id').single();

    if (error) {
      console.error('[estimates POST]', error);
      return NextResponse.json({ error: '見積依頼の登録に失敗しました' }, { status: 500 });
    }

    // 店舗へ通知メール（構造化データがあれば見やすくHTMLテーブル化）
    try {
      const { data: tRow } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      const shopEmail = tRow?.settings_data?.generalConfig?.email || tRow?.settings_data?.shops?.[0]?.email;
      const shopName = tRow?.settings_data?.generalConfig?.appName || tenantId;
      if (shopEmail) {
        // 構造化データを見やすいHTMLテーブルに整形
        const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
        const rd = requestData || {};
        const purposeLabel = rd.purpose === 'その他' ? `その他: ${rd.purposeOther || ''}` : (rd.purpose || '');
        const dmMap = { pickup: '店頭で受取', delivery: '自社配達', shipping: '宅配便配送', undecided: '未定・相談' };
        const cardMap = { none: '不要', message: 'メッセージカード', tatefuda: '立札' };
        const rows = [];
        if (rd.purpose) rows.push(['ご用途', escHtml(purposeLabel)]);
        if (rd.deliveryMethod) rows.push(['受取方法', escHtml(dmMap[rd.deliveryMethod] || rd.deliveryMethod)]);
        if (rd.desiredDate) rows.push(['ご希望日', escHtml(rd.desiredDate) + (rd.desiredTime ? ` ${escHtml(rd.desiredTime)}` : '')]);
        if (rd.deliveryAddress) rows.push(['お届け先住所', escHtml(rd.deliveryAddress)]);
        if (rd.recipientName) rows.push(['お届け先お名前', `${escHtml(rd.recipientName)} 様`]);
        if (rd.flowerType) rows.push(['花の種類', escHtml(rd.flowerType)]);
        if (rd.colorPreference) rows.push(['色・イメージ', escHtml(rd.colorPreference)]);
        if (rd.countSpec) rows.push(['本数・サイズ指定', escHtml(rd.countSpec)]);
        if (rd.budget) rows.push(['ご予算', escHtml(rd.budget)]);
        if (rd.cardType && rd.cardType !== 'none') rows.push([cardMap[rd.cardType] || 'カード', escHtml(rd.cardContent || '（内容は後日相談）')]);
        if (rd.otherNotes) rows.push(['その他特記事項', escHtml(rd.otherNotes)]);
        // 参考画像のサムネイル
        const refImgs = Array.isArray(referenceImages) ? referenceImages : [];
        if (refImgs.length > 0) {
          const imgsHtml = refImgs.map(u => `<a href="${u}" target="_blank" style="display:inline-block;margin:4px;"><img src="${u}" alt="参考画像" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid #eaeaea;object-fit:cover;"/></a>`).join('');
          rows.push([`参考画像 (${refImgs.length}枚)`, imgsHtml]);
        }

        const tableHtml = rows.length > 0
          ? `<table style="width:100%;border-collapse:collapse;margin:10px 0;">
              ${rows.map(([k,v]) => `<tr style="border-bottom:1px solid #eaeaea;">
                <td style="padding:10px;background:#f0fdf4;font-weight:bold;color:#117768;width:35%;vertical-align:top;font-size:12px;">${k}</td>
                <td style="padding:10px;color:#222;font-size:13px;vertical-align:top;">${v}</td>
              </tr>`).join('')}
            </table>`
          : `<pre style="white-space:pre-wrap;background:white;padding:10px;border:1px solid #eaeaea;border-radius:4px;font-family:inherit;font-size:13px;">${escHtml(requestContent)}</pre>`;

        await sendEmail({
          to: shopEmail,
          subject: `【見積依頼】${customerName} 様 / ${rd.purpose || '用途不明'} / ${rd.budget || ''}`,
          html: `<!DOCTYPE html><html><body style="font-family:'Hiragino Sans',sans-serif;padding:20px;background:#fbfaf9;">
            <div style="max-width:600px;margin:0 auto;background:white;padding:30px;border-radius:12px;">
              <h2 style="color:#117768;margin:0 0 20px;">💰 新規お見積もりのご依頼</h2>

              <div style="background:#f0fdf4;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #117768;">
                <p style="margin:5px 0;"><strong>お客様:</strong> ${escHtml(customerName)} 様</p>
                <p style="margin:5px 0;"><strong>メール:</strong> <a href="mailto:${escHtml(customerEmail)}" style="color:#117768;">${escHtml(customerEmail)}</a></p>
                <p style="margin:5px 0;"><strong>お電話:</strong> ${customerPhone ? `<a href="tel:${escHtml(customerPhone)}" style="color:#117768;">${escHtml(customerPhone)}</a>` : '-'}</p>
              </div>

              <h3 style="color:#117768;margin:20px 0 10px;font-size:14px;">📋 ご依頼内容</h3>
              ${tableHtml}

              <p style="margin-top:30px;text-align:center;">
                <a href="https://noodleflorix.com/staff/estimates"
                   style="display:inline-block;background:#117768;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
                  スタッフ画面で回答する →
                </a>
              </p>
            </div>
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
