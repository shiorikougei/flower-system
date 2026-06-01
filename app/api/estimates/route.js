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
    const allowed = await rateLimit({ key: `estimate:${ip}`, max: 10, windowSec: 300 });
    if (!allowed) {
      return NextResponse.json({ error: 'リクエスト過多です。5分ほど待ってから再度お試しください。' }, { status: 429 });
    }

    const body = await request.json();
    const { tenantId, shopId, customerName, customerEmail, customerPhone, requestContent, requestData, referenceImages } = body;

    // ★ どの必須項目が欠けてるか明示
    const missing = [];
    if (!tenantId) missing.push('テナントID');
    if (!customerName) missing.push('お名前');
    if (!customerEmail) missing.push('メールアドレス');
    if (!requestContent) missing.push('ご依頼内容');
    if (missing.length > 0) {
      return NextResponse.json({ error: `必須項目が不足しています: ${missing.join(', ')}` }, { status: 400 });
    }
    if (String(requestContent).length > 4000) {
      return NextResponse.json({ error: `内容が長すぎます (${String(requestContent).length}文字 / 上限 4000文字)` }, { status: 400 });
    }

    const supabase = admin();

    // ★ 参考画像が text[] スキーマに合わない場合の互換性対応:
    //    URL配列を text[] にキャスト
    let refImgs = null;
    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
      refImgs = referenceImages
        .filter(u => typeof u === 'string' && u.length > 0)
        .slice(0, 10);
    }

    const insertPayload = {
      tenant_id: String(tenantId).toLowerCase(),
      shop_id: shopId || null,
      customer_name: String(customerName).slice(0, 100),
      customer_email: String(customerEmail).toLowerCase().slice(0, 200),
      customer_phone: customerPhone ? String(customerPhone).slice(0, 30) : null,
      request_content: String(requestContent).slice(0, 4000),
      request_data: requestData || null,
      reference_images: refImgs,
      status: 'pending',
    };

    const { data, error } = await supabase.from('estimates').insert([insertPayload]).select('id').single();

    if (error) {
      // ★ 詳細なエラー情報を返す（デバッグ用）
      console.error('[estimates POST] insert error:', error);
      console.error('[estimates POST] payload:', JSON.stringify(insertPayload).slice(0, 500));
      return NextResponse.json({
        error: '見積依頼の登録に失敗しました',
        detail: error.message || String(error),
        code: error.code,
        hint: error.hint || null,
      }, { status: 500 });
    }

    // 店舗へ通知メール（構造化データがあれば見やすくHTMLテーブル化）
    try {
      const { data: tRow } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      const settings = tRow?.settings_data || {};
      // ★ 該当店舗の notifyEmail を優先（なければ旧 email / generalConfig.email にフォールバック）
      const targetShop = settings.shops?.find(s => String(s.id) === String(shopId)) || settings.shops?.[0] || {};
      const shopEmail = (targetShop.notifyEmail || '').trim()
        || targetShop.email
        || settings.generalConfig?.email;
      const shopName = targetShop.name || settings.generalConfig?.appName || tenantId;
      // ★ CCメール（カンマ区切り）
      const ccEmails = (targetShop.notifyCcEmails || '').split(',').map(s => s.trim()).filter(Boolean);
      // ★ 通知タイミング OFF ならスキップ
      const notifyEnabled = targetShop.notifyOnEstimate !== false;
      if (shopEmail && notifyEnabled) {
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
        // ★ 新フォーム: 郵便番号+住所1+住所2を組み合わせ。旧: deliveryAddress
        const addrParts = [];
        if (rd.deliveryZip) addrParts.push(`〒${rd.deliveryZip}`);
        if (rd.deliveryAddress1) addrParts.push(rd.deliveryAddress1);
        if (rd.deliveryAddress2) addrParts.push(rd.deliveryAddress2);
        const addrCombined = addrParts.join(' ') || rd.deliveryAddress || '';
        if (addrCombined) rows.push(['お届け先住所', escHtml(addrCombined)]);
        if (rd.recipientName) rows.push(['お届け先お名前', `${escHtml(rd.recipientName)} 様`]);
        if (rd.flowerType) rows.push(['花の種類', escHtml(rd.flowerType)]);
        if (rd.colorPreference) rows.push(['色・イメージ', escHtml(rd.colorPreference)]);
        if (rd.countSpec) rows.push(['本数・サイズ指定', escHtml(rd.countSpec)]);
        if (rd.budget) rows.push(['ご予算', escHtml(rd.budget)]);
        if (rd.cardType && rd.cardType !== 'none') rows.push([cardMap[rd.cardType] || 'カード', escHtml(rd.cardContent || '（内容は後日相談）')]);
        if (rd.instagramManagementNos) rows.push(['Instagram管理番号', escHtml(rd.instagramManagementNos)]);
        if (rd.instagramUrls) {
          // URL を改行で分割してそれぞれリンク化
          const urls = String(rd.instagramUrls).split(/[\n\s]+/).filter(u => /^https?:\/\//.test(u.trim()));
          const urlsHtml = urls.length > 0
            ? urls.map(u => `<a href="${escHtml(u)}" target="_blank" style="color:#117768;text-decoration:underline;">${escHtml(u)}</a>`).join('<br/>')
            : escHtml(rd.instagramUrls);
          rows.push(['Instagram URL', urlsHtml]);
        }
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
          cc: ccEmails.length > 0 ? ccEmails : undefined,
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

// DELETE: 見積依頼を削除（スタッフ）
// クエリ: ?id=xxx
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id が必要' }, { status: 400 });

    const supabase = admin();
    const { error } = await supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: 店舗回答 or お客様承諾
export async function PATCH(request) {
  try {
    const { id, action, replyMessage, proposedPrice, proposedData, customerToken, customerExtraData } = await request.json();
    if (!id || !action) return NextResponse.json({ error: 'id/action必要' }, { status: 400 });

    const supabase = admin();
    const { data: cur } = await supabase.from('estimates').select('*').eq('id', id).single();
    if (!cur) return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 });

    if (action === 'reply') {
      // 店舗回答
      await supabase.from('estimates').update({
        reply_message: String(replyMessage || '').slice(0, 4000),
        proposed_price: Number(proposedPrice) || 0,
        proposed_data: proposedData || null, // ★ 料金内訳を保存
        status: 'replied',
        replied_at: new Date().toISOString(),
      }).eq('id', id);

      // ★ 店舗情報を取得 (送信元・問合せ先のため)
      const { data: tRow2 } = await supabase.from('app_settings').select('settings_data').eq('id', cur.tenant_id).single();
      const settings2 = tRow2?.settings_data || {};
      const shop2 = settings2.shops?.find(s => String(s.id) === String(cur.shop_id)) || settings2.shops?.[0] || {};
      const shopName2 = shop2.name || settings2.generalConfig?.appName || 'お花屋さん';
      const shopEmail2 = shop2.email || settings2.generalConfig?.email || '';
      const shopPhone2 = shop2.phone || settings2.generalConfig?.phone || '';
      const lineUrl2 = settings2.lineConfig?.addFriendUrl || '';

      // ★ LINE preference を尊重: 'line_only' ならメール送信スキップ
      let preference2 = 'both';
      try {
        const { data: link } = await supabase
          .from('customer_line_links')
          .select('notification_preference')
          .eq('tenant_id', cur.tenant_id)
          .eq('customer_email', cur.customer_email.toLowerCase())
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (link?.notification_preference) preference2 = link.notification_preference;
      } catch {}

      // お客様にメール (line_only なら送信スキップ)
      if (preference2 !== 'line_only') {
        try {
          await sendEmail({
            to: cur.customer_email,
            from: `${shopName2} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
            subject: `【${shopName2}】お見積もりのご回答 - ${cur.customer_name} 様`,
            html: `<!DOCTYPE html><html><body style="font-family:'Hiragino Sans',sans-serif;padding:20px;background:#FBFAF9;">
              <div style="max-width:600px;margin:0 auto;background:white;padding:30px;border-radius:12px;">
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
                ${noReplyFooter({ shopName: shopName2, shopEmail: shopEmail2, shopPhone: shopPhone2, lineAddFriendUrl: lineUrl2 })}
              </div>
            </body></html>`,
          });
        } catch (e) { console.warn(e); }
      }

      // ★ LINE併送 (line_only or both で連携あり時のみ)
      try {
        const { sendLineParallelToEmail } = await import('@/utils/line');
        await sendLineParallelToEmail({
          supabaseAdmin: supabase,
          tenantSettings: settings2,
          tenantId: cur.tenant_id,
          customerEmail: cur.customer_email,
          text: `【${shopName2}】お見積もりのご回答\n\n${cur.customer_name} 様\n\nご提案価格(税込): ¥${(Math.floor(Number(proposedPrice) * 1.1)).toLocaleString()}\n\n${replyMessage || ''}\n\n▼ 内容にご納得いただけましたら、こちらから正式注文へ\nhttps://noodleflorix.com/order/${cur.tenant_id}/${cur.shop_id || 'default'}/estimate/${id}`,
        });
      } catch (e) { console.warn('[estimate reply LINE]', e?.message); }

      return NextResponse.json({ ok: true });
    } else if (action === 'accept') {
      // お客様承諾 → 正式注文に変換
      if (cur.status !== 'replied') {
        return NextResponse.json({ error: '回答前の見積です' }, { status: 400 });
      }

      // 注文として登録
      const proposedSub = Number(cur.proposed_price) || 0;
      const tax = Math.floor(proposedSub * 0.1);
      const rd = cur.request_data || {};
      const pd = cur.proposed_data || {};

      // 受取方法を推定 (見積回答内容から)
      let receiveMethod = '';
      if (rd.deliveryMethod === 'pickup') receiveMethod = 'pickup';
      else if (rd.deliveryMethod === 'shipping' || pd.sagawaFee > 0) receiveMethod = 'sagawa';
      else if (pd.selfDeliveryAccepted === 'yes' || pd.selfDeliveryFee > 0) receiveMethod = 'delivery';
      else if (pd.sagawaFee > 0) receiveMethod = 'sagawa';

      // 配達先住所の組み立て
      const recipientInfo = rd.deliveryMethod && rd.deliveryMethod !== 'pickup' ? {
        name: rd.recipientName || cur.customer_name,
        phone: cur.customer_phone || '',
        zip: rd.deliveryZip || '',
        address1: rd.deliveryAddress1 || '',
        address2: rd.deliveryAddress2 || '',
      } : null;

      const cxd = customerExtraData || {};

      const orderRecord = {
        tenant_id: cur.tenant_id,
        order_data: {
          shopId: cur.shop_id,
          fromEstimate: true,
          estimateId: id,
          // ★ お客様情報 (見積依頼の情報＋確定時の追加情報)
          customerInfo: {
            name: cur.customer_name,
            email: cur.customer_email,
            phone: cur.customer_phone,
            zip: cxd.zip || '',
            address1: cxd.address1 || '',
            address2: cxd.address2 || '',
          },
          paymentScheduledDate: cxd.paymentScheduledDate || null,
          // ★ お届け先 (異なる場合のみ)
          isRecipientDifferent: !!recipientInfo,
          recipientInfo: recipientInfo,
          receiveMethod,
          // ★ 商品情報 (見積依頼の構造化データを反映)
          flowerType: rd.flowerType || '',
          flowerPurpose: rd.purpose === 'その他' ? rd.purposeOther : (rd.purpose || ''),
          flowerColor: rd.colorPreference || '',
          flowerVibe: '',
          purposeNote: rd.otherNotes || rd.countSpec || '',
          // ★ 配達希望日時
          selectedDate: rd.desiredDate || '',
          selectedTime: rd.desiredTime || '',
          // ★ メッセージカード・立札
          cardType: rd.cardType === 'message' ? 'メッセージカード' : (rd.cardType === 'tatefuda' ? '立札' : 'なし'),
          cardMessage: rd.cardType === 'message' ? (rd.cardContent || '') : '',
          // ★ 金額情報 - calculatedFee は配送料+箱代+クール代+その他全て含む
          //   (OrderDetailModal の getTotals は item + calculatedFee + pickup で計算するため)
          itemPrice: Number(pd.productPrice) || proposedSub,
          calculatedFee: (Number(pd.selfDeliveryFee) || 0)
            + (Number(pd.sagawaFee) || 0)
            + (Number(pd.boxFee) || 0)
            + (Number(pd.coolFee) || 0)
            + ((pd.otherFees || []).reduce((s, o) => s + (Number(o.amount) || 0), 0)),
          feeBreakdown: {
            baseFee: (Number(pd.selfDeliveryFee) || 0) + (Number(pd.sagawaFee) || 0),
            boxFee: Number(pd.boxFee) || 0,
            coolFee: Number(pd.coolFee) || 0,
            otherFees: pd.otherFees || [],
          },
          pickupFee: 0,
          totalAmount: proposedSub + tax,
          // ★ 見積データの参照
          note: `お見積もり依頼から確定 (見積ID: ${String(id).slice(0,8)})\n\n${cur.reply_message || ''}`,
          status: 'new',
          paymentMethod: 'bank_transfer',
          paymentStatus: '未入金',
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
