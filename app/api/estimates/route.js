// お見積もり依頼 API
// POST   /api/estimates       → 新規見積依頼（お客様）
// GET    /api/estimates       → 一覧取得（スタッフ）
// PATCH  /api/estimates       → 店舗回答 or 確定変換
//   [2026-10] やり取りの無制限化（docs/ESTIMATE_THREAD_DESIGN.md）
//   - reply: 見積案を追加（出し直し）/ message: 文章だけの返信 / withdraw_version・reinstate_version: 見積案の取り下げ・戻す
//   - request_revision: お客様からの変更依頼（お客様用の鍵で確認）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, noReplyFooter, shopContactEmail } from '@/utils/email';
import { rateLimit, getClientIp } from '@/utils/rateLimit';
import { requireTenantStaff } from '@/utils/adminAuth';
import {
  newExpiresAt, newAccessToken, customerEstimateUrl, isValidCustomerToken, publicEstimate,
  loadVersions, loadMessages, loadThreadsFor, materializeLegacyVersion,
} from '@/utils/estimateThread';

export const runtime = 'nodejs';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// 新しい表・列がまだ無いとき（本番に SQL を流す前）のエラーか
function isMissingSchema(err) {
  const code = err?.code || '';
  return code === '42P01' || code === '42703' || code === 'PGRST204' || code === 'PGRST205';
}

const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function loadShopInfo(supabase, est) {
  const { data: tRow } = await supabase.from('app_settings').select('settings_data').eq('id', est.tenant_id).single();
  const settings = tRow?.settings_data || {};
  const shop = settings.shops?.find(s => String(s.id) === String(est.shop_id)) || settings.shops?.[0] || {};
  return {
    settings,
    shop,
    shopName: shop.name || settings.generalConfig?.appName || 'お花屋さん',
    shopEmail: shopContactEmail(shop, settings),
    shopPhone: shop.phone || settings.generalConfig?.phone || '',
    lineUrl: settings.lineConfig?.addFriendUrl || '',
  };
}

// お客様へのお知らせ（メール + LINE 連携済みなら LINE）。お客様の通知設定を尊重する
async function notifyCustomer(supabase, est, { subject, heading, bodyHtml, lineText }) {
  const info = await loadShopInfo(supabase, est);
  let preference = 'both';
  try {
    const { data: link } = await supabase
      .from('customer_line_links')
      .select('notification_preference, is_active')
      .eq('tenant_id', est.tenant_id)
      .eq('customer_email', String(est.customer_email || '').toLowerCase())
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (link?.notification_preference) preference = link.notification_preference;
  } catch {}
  const url = customerEstimateUrl(est);
  if (preference !== 'line_only') {
    try {
      await sendEmail({
        to: est.customer_email,
        from: `${info.shopName} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
        subject: `【${info.shopName}】${subject}`,
        html: `<!DOCTYPE html><html><body style="font-family:'Hiragino Sans',sans-serif;padding:20px;background:#FBFAF9;">
          <div style="max-width:600px;margin:0 auto;background:white;padding:30px;border-radius:12px;">
            <h2 style="color:#117768;margin:0 0 16px;">${escHtml(heading)}</h2>
            <p>${escHtml(est.customer_name)} 様</p>
            ${bodyHtml}
            <p style="margin:24px 0 0;">
              <a href="${url}" style="display:inline-block;background:#117768;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">お見積もりのページを開く</a>
            </p>
            <p style="font-size:12px;color:#666;margin-top:16px;">お見積もりのページから、ご注文や内容の変更のご依頼ができます。</p>
            ${noReplyFooter({ shopName: info.shopName, shopEmail: info.shopEmail, shopPhone: info.shopPhone, lineAddFriendUrl: info.lineUrl })}
          </div>
        </body></html>`,
      });
    } catch (e) { console.warn('[estimate notify customer mail]', e?.message); }
  }
  try {
    const { sendLineParallelToEmail } = await import('@/utils/line');
    await sendLineParallelToEmail({
      supabaseAdmin: supabase,
      tenantSettings: info.settings,
      tenantId: est.tenant_id,
      customerEmail: est.customer_email,
      text: `【${info.shopName}】${subject}\n\n${est.customer_name} 様\n\n${lineText}\n\n▼ お見積もりのページ\n${url}`,
    });
  } catch (e) { console.warn('[estimate notify customer LINE]', e?.message); }
}

// お店へのお知らせ（お客様から変更依頼が来たとき）
async function notifyShopRevision(supabase, est, body) {
  const info = await loadShopInfo(supabase, est);
  const shopEmail = (info.shop.notifyEmail || '').trim() || info.shop.email || info.settings.generalConfig?.email;
  if (!shopEmail || info.shop.notifyOnEstimate === false) return;
  const ccEmails = (info.shop.notifyCcEmails || '').split(',').map(s => s.trim()).filter(Boolean);
  await sendEmail({
    to: shopEmail,
    cc: ccEmails.length > 0 ? ccEmails : undefined,
    subject: `【見積】${est.customer_name} 様から変更のご依頼があります`,
    html: `<!DOCTYPE html><html><body style="font-family:'Hiragino Sans',sans-serif;padding:20px;background:#fbfaf9;">
      <div style="max-width:600px;margin:0 auto;background:white;padding:30px;border-radius:12px;">
        <h2 style="color:#117768;margin:0 0 16px;">お見積もりの変更のご依頼</h2>
        <p style="margin:5px 0;"><strong>お客様:</strong> ${escHtml(est.customer_name)} 様</p>
        <p style="margin:5px 0;"><strong>メール:</strong> ${escHtml(est.customer_email)}</p>
        <p style="margin:5px 0;"><strong>お電話:</strong> ${escHtml(est.customer_phone || '-')}</p>
        <div style="background:#FFFAEB;border-left:4px solid #D97706;padding:14px;border-radius:8px;margin:16px 0;white-space:pre-wrap;font-size:13px;">${escHtml(body)}</div>
        <p style="margin-top:24px;text-align:center;">
          <a href="https://noodleflorix.com/staff/estimates" style="display:inline-block;background:#117768;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">スタッフ画面で返信する</a>
        </p>
      </div>
      ${noReplyFooter()}
    </body></html>`,
  });
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

    // どの必須項目が欠けてるか明示
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

    // ★ [セキュリティ] テナント存在チェック（任意のテナント宛 spam 防止）
    //    存在しない or 無効化されたテナントには見積を作らせない
    {
      const { data: tenantRow, error: tErr } = await supabase
        .from('app_settings')
        .select('id')
        .eq('id', String(tenantId).toLowerCase())
        .maybeSingle();
      if (tErr || !tenantRow) {
        // 詳細エラーは返さず一般的な失敗を返す（情報漏洩防止）
        return NextResponse.json({ error: '見積依頼の登録に失敗しました。店舗IDをご確認ください。' }, { status: 400 });
      }
    }

    // 参考画像が text[] スキーマに合わない場合の互換性対応:
    //    URL配列を text[] にキャスト
    let refImgs = null;
    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
      refImgs = referenceImages
        // [セキュリティ 2026-10] http(s) の URL だけ保存する
        .filter(u => typeof u === 'string' && /^https?:\/\//i.test(u) && u.length <= 1000)
        .slice(0, 10);
    }

    // [見積-1] 有効期限 = 作成日 + 30日
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

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
      expires_at: expiresAt,
      // [2026-10] お客様用の鍵（メールのリンクに付ける。見積のページの操作に使う）
      access_token: newAccessToken(),
    };

    let { data, error } = await supabase.from('estimates').insert([insertPayload]).select('id').single();
    if (error && isMissingSchema(error)) {
      // 鍵の列がまだ無い（本番に SQL を流す前）ときは、鍵なしで今までどおり登録する
      const { access_token, ...withoutToken } = insertPayload;
      ({ data, error } = await supabase.from('estimates').insert([withoutToken]).select('id').single());
    }

    if (error) {
      // [Phase1-① PII保護] 詳細エラーは本番でクライアントに返さない（DB構造・PII漏洩リスク）
      console.error('[estimates POST] insert error:', error?.code || 'unknown');
      // payloadのログ出力は廃止（顧客個人情報を含む）
      return NextResponse.json({
        error: '見積依頼の登録に失敗しました。しばらく経ってから再度お試しください。',
        // 開発環境のみ詳細を返す
        ...(process.env.NODE_ENV === 'development' ? { detail: error.message, code: error.code } : {}),
      }, { status: 500 });
    }

    // 店舗へ通知メール（重い処理なのでバックグラウンドで実行 = フォーム応答を早く返す）
    //    insert 完了 → 即レスポンス → メール送信は別タスクで実行
    (async () => {
    try {
      const { data: tRow } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      const settings = tRow?.settings_data || {};
      // 該当店舗の notifyEmail を優先（なければ旧 email / generalConfig.email にフォールバック）
      const targetShop = settings.shops?.find(s => String(s.id) === String(shopId)) || settings.shops?.[0] || {};
      const shopEmail = (targetShop.notifyEmail || '').trim()
        || targetShop.email
        || settings.generalConfig?.email;
      const shopName = targetShop.name || settings.generalConfig?.appName || tenantId;
      // CCメール（カンマ区切り）
      const ccEmails = (targetShop.notifyCcEmails || '').split(',').map(s => s.trim()).filter(Boolean);
      // 通知タイミング OFF ならスキップ
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
        // 新フォーム: 郵便番号+住所1+住所2を組み合わせ。旧: deliveryAddress
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
        // [セキュリティ 2026-10] http(s) の URL だけ・エスケープして入れる
        const refImgs = (Array.isArray(referenceImages) ? referenceImages : []).filter(u => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, 10);
        if (refImgs.length > 0) {
          const imgsHtml = refImgs.map(u => `<a href="${escHtml(u)}" target="_blank" style="display:inline-block;margin:4px;"><img src="${escHtml(u)}" alt="参考画像" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid #eaeaea;object-fit:cover;"/></a>`).join('');
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
    })().catch(e => console.warn('[estimate notify bg]', e?.message)); // バックグラウンド実行のエラーをキャッチ

    // insert が成功した時点で即レスポンス（メール送信完了を待たない）
    return NextResponse.json({ ok: true, estimateId: data.id });
  } catch (err) {
    console.error('[estimates POST]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// GET: 見積一覧（スタッフ用） or 単一取得（お客様向け確認ページ）
// ★ [セキュリティ]
//    - id 指定: 1件だけ返す（公開・UUID推測困難なため URL 知っている人のみアクセス可）
//    - tenantId 指定（id なし）: 一覧取得は認証必須
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');
    const id = url.searchParams.get('id');
    const status = url.searchParams.get('status'); // optional filter
    const token = url.searchParams.get('t');

    const supabase = admin();

    // ★ id 指定: お客様向け1件取得（認証不要、UUID知っている前提）
    //   [2026-10] お客様用の鍵がある見積は、鍵が合うときだけ返す。やり取り（見積案・メッセージ）も一緒に返す
    if (id) {
      const { data, error } = await supabase.from('estimates').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data || !isValidCustomerToken(data, token)) return NextResponse.json({ estimates: [] });
      let versions = [];
      let messages = [];
      try {
        versions = await loadVersions(supabase, data);
        messages = await loadMessages(supabase, data);
      } catch (e) {
        if (!isMissingSchema(e)) throw e;
        versions = [];
        messages = [];
      }
      if (versions.length === 0 && data.replied_at && data.proposed_price !== null) {
        // 表がまだ無いときの「見積案1」
        versions = [{ id: 'legacy', version_no: 1, proposed_price: Number(data.proposed_price) || 0, proposed_data: data.proposed_data, message: data.reply_message || '', status: 'active', created_at: data.replied_at, legacy: true }];
      }
      return NextResponse.json({ estimates: [{ ...publicEstimate(data), versions, messages }] });
    }

    // 一覧取得: 認証必須
    if (!tenantId) return NextResponse.json({ error: 'tenantId必要' }, { status: 400 });
    const auth = await requireTenantStaff(request, tenantId);
    if (!auth.ok) return auth.response;

    // [2026-10] サイドバーのバッジ用: 変更依頼ありの件数だけ返す
    if (url.searchParams.get('count') === 'revision_requested') {
      const { count, error: cErr } = await supabase
        .from('estimates')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'revision_requested');
      if (cErr) throw cErr;
      return NextResponse.json({ count: count || 0 });
    }

    let q = supabase.from('estimates').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    const list = (data || []).map(publicEstimate);
    let threads = {};
    try {
      threads = await loadThreadsFor(supabase, list);
    } catch (e) {
      if (!isMissingSchema(e)) throw e;
    }
    return NextResponse.json({
      estimates: list.map(e => ({ ...e, versions: threads[e.id]?.versions || [], messages: threads[e.id]?.messages || [] })),
    });
  } catch (err) {
    console.error('[estimates GET]', err?.message);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// DELETE: 見積依頼を削除（スタッフ）
// クエリ: ?id=xxx
// ★ [セキュリティ] 認証必須 + 当該見積のテナントと一致確認
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id が必要' }, { status: 400 });

    const supabase = admin();
    // ★ [セキュリティ] 削除対象の所有テナントを取得
    const { data: target } = await supabase.from('estimates').select('tenant_id').eq('id', id).maybeSingle();
    if (!target) return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 });

    // ★ [セキュリティ] 自テナントスタッフ認証必須
    const auth = await requireTenantStaff(request, target.tenant_id);
    if (!auth.ok) return auth.response;

    const { error } = await supabase.from('estimates').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[estimates DELETE]', err?.message);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// PATCH: 店舗回答 or お客様承諾
export async function PATCH(request) {
  try {
    const { id, action, replyMessage, proposedPrice, proposedData, customerToken, customerExtraData, body: messageBody, versionId } = await request.json();
    if (!id || !action) return NextResponse.json({ error: 'id/action必要' }, { status: 400 });

    const supabase = admin();
    const { data: cur } = await supabase.from('estimates').select('*').eq('id', id).single();
    if (!cur) return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 });

    // ★ [セキュリティ] reply / reject は店舗スタッフ専用
    //    （accept はお客様承諾フローなので顧客トークンで認証する仕様だが、深夜にトークン検証を強化予定）
    let staffUserId = null;
    if (['reply', 'reject', 'trash', 'restore', 'message', 'withdraw_version', 'reinstate_version'].includes(action)) {
      const authR = await requireTenantStaff(request, cur.tenant_id);
      if (!authR.ok) return authR.response;
      staffUserId = authR.user?.id || null;
    }

    // [2026-10] お客様からの変更依頼（ログイン不要。お客様用の鍵で確認）
    if (action === 'request_revision') {
      if (!isValidCustomerToken(cur, customerToken)) {
        return NextResponse.json({ error: 'お見積もりが見つかりません' }, { status: 404 });
      }
      const ip = getClientIp(request);
      const allowed = await rateLimit({ key: `estimate_revision:${id}:${ip}`, max: 5, windowSec: 600 });
      if (!allowed) {
        return NextResponse.json({ error: '短い時間に何度も送信されています。10分ほど待ってから再度お試しください。' }, { status: 429 });
      }
      const text = String(messageBody || '').trim();
      if (!text) return NextResponse.json({ error: 'ご依頼の内容を入力してください' }, { status: 400 });
      if (text.length > 2000) return NextResponse.json({ error: `内容が長すぎます (${text.length}文字 / 上限 2000文字)` }, { status: 400 });
      if (!['replied', 'revision_requested', 'expired'].includes(cur.status)) {
        return NextResponse.json({ error: 'このお見積もりには変更のご依頼を送れません' }, { status: 400 });
      }
      const { error: mErr } = await supabase.from('estimate_messages').insert([{
        estimate_id: id, tenant_id: cur.tenant_id, sender: 'customer', body: text,
      }]);
      if (mErr) throw mErr;
      const { error: uErr } = await supabase.from('estimates').update({
        status: 'revision_requested',
        expires_at: newExpiresAt(),
      }).eq('id', id);
      if (uErr) throw uErr;
      try { await notifyShopRevision(supabase, cur, text); } catch (e) { console.warn('[estimate revision notify]', e?.message); }
      return NextResponse.json({ ok: true });
    }

    // [2026-10] お店から文章だけの返信（金額は変えない）
    if (action === 'message') {
      const text = String(messageBody || '').trim();
      if (!text) return NextResponse.json({ error: '返信の内容を入力してください' }, { status: 400 });
      if (text.length > 4000) return NextResponse.json({ error: '内容が長すぎます（上限 4000文字）' }, { status: 400 });
      if (['converted', 'rejected', 'deleted'].includes(cur.status)) {
        return NextResponse.json({ error: 'この見積には返信できません' }, { status: 400 });
      }
      const { error: mErr } = await supabase.from('estimate_messages').insert([{
        estimate_id: id, tenant_id: cur.tenant_id, sender: 'shop', body: text, created_by: staffUserId,
      }]);
      if (mErr) throw mErr;
      // 見積案があれば「回答済」に戻す（無ければ未回答のまま）。期限は 30 日延ばす
      let hasVersion = false;
      try { hasVersion = (await loadVersions(supabase, cur)).length > 0; } catch {}
      const nextStatus = hasVersion ? 'replied' : cur.status;
      const { error: uErr } = await supabase.from('estimates').update({
        status: nextStatus,
        ...(hasVersion ? { expires_at: newExpiresAt() } : {}),
      }).eq('id', id);
      if (uErr) throw uErr;
      await notifyCustomer(supabase, cur, {
        subject: 'お見積もりについてのご連絡',
        heading: 'お見積もりについてのご連絡',
        bodyHtml: `<div style="background:#f0fdf4;padding:15px;border-radius:8px;white-space:pre-wrap;font-size:13px;line-height:1.8;">${escHtml(text)}</div>`,
        lineText: text,
      });
      return NextResponse.json({ ok: true, status: nextStatus });
    }

    // [2026-10] 見積案の取り下げ・元に戻す
    if (action === 'withdraw_version' || action === 'reinstate_version') {
      if (!versionId) return NextResponse.json({ error: 'versionId が必要' }, { status: 400 });
      let targetId = versionId;
      if (versionId === 'legacy') {
        // 表に無い「見積案1」は、今の回答を見積案1として保存してから取り下げる
        const rows = await materializeLegacyVersion(supabase, cur);
        targetId = rows.find(r => r.version_no === 1)?.id;
        if (!targetId) return NextResponse.json({ error: '見積案が見つかりません' }, { status: 404 });
      }
      const { data: target } = await supabase.from('estimate_versions').select('id, estimate_id').eq('id', targetId).maybeSingle();
      if (!target || target.estimate_id !== id) return NextResponse.json({ error: '見積案が見つかりません' }, { status: 404 });
      const { error: vErr } = await supabase.from('estimate_versions')
        .update({ status: action === 'withdraw_version' ? 'withdrawn' : 'active' })
        .eq('id', targetId);
      if (vErr) throw vErr;
      return NextResponse.json({ ok: true });
    }

    if (action === 'reply') {
      // 店舗回答
      // [2026-10] 回答のたびに「見積案」を 1 つ追加する（出し直し）。何度でも可
      if (!['pending', 'replied', 'revision_requested', 'expired'].includes(cur.status)) {
        return NextResponse.json({ error: 'この見積には回答できません（確定済み・却下・ゴミ箱）' }, { status: 400 });
      }
      const priceInt = Math.floor(Number(proposedPrice) || 0);
      if (priceInt <= 0) return NextResponse.json({ error: '金額を入力してください' }, { status: 400 });
      let versionNo = 1;
      try {
        const rows = await materializeLegacyVersion(supabase, cur);
        versionNo = rows.length > 0 ? Math.max(...rows.map(r => r.version_no)) + 1 : 1;
        const { error: vErr } = await supabase.from('estimate_versions').insert([{
          estimate_id: id,
          tenant_id: cur.tenant_id,
          version_no: versionNo,
          proposed_price: priceInt,
          proposed_data: proposedData || null,
          message: String(replyMessage || '').slice(0, 4000),
          status: 'active',
          created_by: staffUserId,
        }]);
        if (vErr) throw vErr;
      } catch (e) {
        // 表がまだ無い（本番に SQL を流す前）ときは、今までどおり estimates だけ更新する
        if (!isMissingSchema(e)) throw e;
        versionNo = 1;
      }

      // [見積-1] 回答時に有効期限をリセット（回答日から30日延長）
      // 今の画面・自動お知らせが動くように、最新の見積案を estimates にも入れる
      const { error: upErr } = await supabase.from('estimates').update({
        reply_message: String(replyMessage || '').slice(0, 4000),
        proposed_price: priceInt,
        proposed_data: proposedData || null, // 料金内訳を保存
        status: 'replied',
        replied_at: new Date().toISOString(),
        expires_at: newExpiresAt(),
        // 催促・期限通知履歴をリセット（次フェーズで再通知できるように）
        reminder_sent_at: null,
        expiry_warning_sent_at: null,
        staff_expiry_alert_sent_at: null,
      }).eq('id', id);
      if (upErr) throw upErr;

      if (versionNo > 1) {
        const taxIncl = Math.floor(priceInt * 1.1);
        await notifyCustomer(supabase, cur, {
          subject: `お見積もりを更新しました（見積案 ${versionNo}）`,
          heading: `お見積もりを更新しました（見積案 ${versionNo}）`,
          bodyHtml: `<p>ご依頼の内容をもとに、お見積もりを出し直しました。</p>
            <div style="background:#f0fdf4;border:2px solid #117768;padding:20px;border-radius:12px;margin:20px 0;">
              <p style="margin:0;font-size:11px;color:#666;">見積案 ${versionNo} のご提案価格（税込）</p>
              <p style="margin:5px 0;font-size:32px;font-weight:bold;color:#117768;">¥${taxIncl.toLocaleString()}</p>
            </div>
            <p style="background:white;padding:15px;border:1px solid #eaeaea;border-radius:8px;white-space:pre-wrap;">${escHtml(replyMessage || '')}</p>`,
          lineText: `見積案 ${versionNo} のご提案価格（税込）: ¥${taxIncl.toLocaleString()}\n\n${replyMessage || ''}`,
        });
        return NextResponse.json({ ok: true, versionNo });
      }

      // 店舗情報を取得 (送信元・問合せ先のため)
      const { data: tRow2 } = await supabase.from('app_settings').select('settings_data').eq('id', cur.tenant_id).single();
      const settings2 = tRow2?.settings_data || {};
      const shop2 = settings2.shops?.find(s => String(s.id) === String(cur.shop_id)) || settings2.shops?.[0] || {};
      const shopName2 = shop2.name || settings2.generalConfig?.appName || 'お花屋さん';
      const shopEmail2 = shopContactEmail(shop2, settings2);
      const shopPhone2 = shop2.phone || settings2.generalConfig?.phone || '';
      const lineUrl2 = settings2.lineConfig?.addFriendUrl || '';

      // LINE preference を尊重: 'line_only' ならメール送信スキップ
      let preference2 = 'both';
      let isLineLinked = false;
      try {
        const { data: link } = await supabase
          .from('customer_line_links')
          .select('notification_preference, is_active')
          .eq('tenant_id', cur.tenant_id)
          .eq('customer_email', cur.customer_email.toLowerCase())
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (link?.notification_preference) preference2 = link.notification_preference;
        if (link?.is_active) isLineLinked = true;
      } catch {}

      // LINE未連携のお客様向け招待ブロック（LINE機能ON & 未連携の場合のみ）
      const lineInviteBlock = (!isLineLinked && settings2.lineConfig?.enabled && lineUrl2) ? `
        <div style="margin:24px 0; background:#06C755; padding:2px; border-radius:14px;">
          <div style="background:white; padding:20px; border-radius:12px;">
            <div style="text-align:center; margin-bottom:14px;">
              <span style="display:inline-block; background:#06C755; color:white; padding:6px 16px; border-radius:20px; font-size:11px; font-weight:bold;">💬 おすすめ</span>
              <h3 style="color:#06C755; margin:10px 0 4px; font-size:16px;">LINEで進捗を受け取りませんか？</h3>
              <p style="color:#666; font-size:12px; margin:0;">完成写真・お届け状況をLINEでお届けします🌸</p>
            </div>
            <div style="background:#f0fdf4; padding:14px; border-radius:8px; font-size:12px; color:#333; line-height:1.7;">
              <p style="margin:0 0 8px; font-weight:bold; color:#117768;">📱 連携手順（30秒で完了）</p>
              <ol style="margin:0; padding-left:20px;">
                <li>下の「LINEで友達追加」ボタンをタップ</li>
                <li>友達追加後、リッチメニュー「📧 LINE連携する」をタップ</li>
                <li>下記のメールアドレスをトークに送信:<br/>
                  <code style="display:inline-block; background:white; padding:4px 10px; border:1px dashed #06C755; border-radius:4px; margin-top:4px; font-family:monospace; color:#06C755; font-weight:bold;">${cur.customer_email}</code>
                </li>
                <li>連携完了！ 🎉</li>
              </ol>
            </div>
            <p style="text-align:center; margin:14px 0 0;">
              <a href="${lineUrl2}"
                 style="display:inline-block; background:#06C755; color:white; padding:14px 36px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px;">
                💬 LINEで友達追加する
              </a>
            </p>
            <p style="text-align:center; color:#999; font-size:10px; margin:10px 0 0;">
              ※ いつでもマイページから連携解除できます
            </p>
          </div>
        </div>
      ` : '';

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
                <a href="${customerEstimateUrl(cur)}"
                   style="display:inline-block;background:#117768;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                  この内容で確定する →
                </a>
                ${lineInviteBlock}
                ${noReplyFooter({ shopName: shopName2, shopEmail: shopEmail2, shopPhone: shopPhone2, lineAddFriendUrl: lineUrl2 })}
              </div>
            </body></html>`,
          });
        } catch (e) { console.warn(e); }
      }

      // LINE併送 (line_only or both で連携あり時のみ)
      try {
        const { sendLineParallelToEmail } = await import('@/utils/line');
        await sendLineParallelToEmail({
          supabaseAdmin: supabase,
          tenantSettings: settings2,
          tenantId: cur.tenant_id,
          customerEmail: cur.customer_email,
          text: `【${shopName2}】お見積もりのご回答\n\n${cur.customer_name} 様\n\nご提案価格(税込): ¥${(Math.floor(Number(proposedPrice) * 1.1)).toLocaleString()}\n\n${replyMessage || ''}\n\n▼ 内容にご納得いただけましたら、こちらから正式注文へ\n${customerEstimateUrl(cur)}`,
        });
      } catch (e) { console.warn('[estimate reply LINE]', e?.message); }

      return NextResponse.json({ ok: true });
    } else if (action === 'accept') {
      // お客様承諾 → 正式注文に変換
      // [2026-10] お客様用の鍵がある見積は、鍵が合わないと受け付けない
      if (!isValidCustomerToken(cur, customerToken)) {
        return NextResponse.json({ error: '見積が見つかりません' }, { status: 404 });
      }
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
          // お客様情報 (見積依頼の情報＋確定時の追加情報)
          customerInfo: {
            name: cur.customer_name,
            email: cur.customer_email,
            phone: cur.customer_phone,
            zip: cxd.zip || '',
            address1: cxd.address1 || '',
            address2: cxd.address2 || '',
          },
          paymentScheduledDate: cxd.paymentScheduledDate || null,
          // お届け先 (異なる場合のみ)
          isRecipientDifferent: !!recipientInfo,
          recipientInfo: recipientInfo,
          receiveMethod,
          // 商品情報 (見積依頼の構造化データを反映)
          flowerType: rd.flowerType || '',
          flowerPurpose: rd.purpose === 'その他' ? rd.purposeOther : (rd.purpose || ''),
          flowerColor: rd.colorPreference || '',
          flowerVibe: '',
          purposeNote: rd.otherNotes || rd.countSpec || '',
          // 配達希望日時
          selectedDate: rd.desiredDate || '',
          selectedTime: rd.desiredTime || '',
          // メッセージカード・立札
          cardType: rd.cardType === 'message' ? 'メッセージカード' : (rd.cardType === 'tatefuda' ? '立札' : 'なし'),
          cardMessage: rd.cardType === 'message' ? (rd.cardContent || '') : '',
          // 金額情報 - calculatedFee は配送料+箱代+クール代+その他全て含む
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
          // 見積データの参照
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
    } else if (action === 'trash') {
      // ★ [2026-10] 「削除」はデータを消さず、ゴミ箱（status = 'deleted'）へ移す。あとから元に戻せる
      const { error: trashErr } = await supabase.from('estimates').update({ status: 'deleted' }).eq('id', id);
      if (trashErr) throw trashErr;
      return NextResponse.json({ ok: true });
    } else if (action === 'restore') {
      // ★ [2026-10] 却下・ゴミ箱から元に戻す。戻し先は見積の状態から判断する
      //    注文に確定済み -> converted / 回答済み -> replied / それ以外 -> pending
      if (cur.status !== 'rejected' && cur.status !== 'deleted') {
        return NextResponse.json({ error: 'この見積は元に戻す対象ではありません' }, { status: 400 });
      }
      const restored = cur.order_id ? 'converted' : (cur.replied_at || cur.reply_message ? 'replied' : 'pending');
      const { error: restoreErr } = await supabase.from('estimates').update({ status: restored }).eq('id', id);
      if (restoreErr) throw restoreErr;
      return NextResponse.json({ ok: true, status: restored });
    }
    return NextResponse.json({ error: '不正なaction' }, { status: 400 });
  } catch (err) {
    console.error('[estimates PATCH]', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
