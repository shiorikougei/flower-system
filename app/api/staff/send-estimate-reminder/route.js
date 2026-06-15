// [見積-4] スタッフが顧客へ「期限切れ間近リマインド」を手動送信するAPI
//
// POST /api/staff/send-estimate-reminder
//   body: { estimateId: string, customMessage?: string }
//
// 認証: スタッフセッション必須

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, noReplyFooter } from "@/utils/email";

export const runtime = "nodejs";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { estimateId, customMessage } = await request.json();
    if (!estimateId) {
      return NextResponse.json({ error: "estimateIdが必要です" }, { status: 400 });
    }

    // スタッフ認証
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const supabase = admin();
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 見積取得
    const { data: est, error: estErr } = await supabase
      .from("estimates")
      .select("*")
      .eq("id", estimateId)
      .single();
    if (estErr || !est) {
      return NextResponse.json({ error: "見積もりが見つかりません" }, { status: 404 });
    }
    if (!est.customer_email) {
      return NextResponse.json({ error: "顧客メールが登録されていません" }, { status: 400 });
    }
    if (est.status !== "replied") {
      return NextResponse.json({ error: `現在のステータス(${est.status})ではリマインド送信できません。回答済みのみ可能です。` }, { status: 400 });
    }

    // 認証スタッフのテナントIDを取得 → 見積のtenant_idと照合
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userData.user.id)
      .single();
    if (!profile?.tenant_id || String(profile.tenant_id).toLowerCase() !== String(est.tenant_id).toLowerCase()) {
      return NextResponse.json({ error: "この見積もりへの操作権限がありません" }, { status: 403 });
    }

    // 店舗情報取得
    const { data: tRow } = await supabase
      .from("app_settings")
      .select("settings_data")
      .eq("id", est.tenant_id)
      .single();
    const settings = tRow?.settings_data || {};
    const targetShop = settings.shops?.find(s => String(s.id) === String(est.shop_id)) || settings.shops?.[0] || {};
    const shopName = targetShop.name || settings.generalConfig?.appName || "お花屋さん";
    const shopPhone = targetShop.phone || "";

    // 期限関連
    const expiresAt = est.expires_at ? new Date(est.expires_at) : null;
    const now = new Date();
    const daysUntilExpiry = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    if (!expiresAt || daysUntilExpiry === null || daysUntilExpiry < 0) {
      return NextResponse.json({ error: "有効期限が無効または既に切れています" }, { status: 400 });
    }

    const confirmUrl = `${BASE_URL}/order/${est.tenant_id}/${est.shop_id || "default"}/estimate/${est.id}`;
    const taxIncTotal = Math.round((est.proposed_price || 0) * 1.1);

    // カスタムメッセージ
    const customMsgHtml = customMessage
      ? `<div style="background: #FFFAEB; padding: 12px 16px; border-radius: 8px; margin: 16px 0; border-left: 3px solid #D97706;">
           <p style="font-size: 12px; color: #92400E; margin: 0; line-height: 1.8; white-space: pre-wrap;">${String(customMessage).replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]))}</p>
         </div>`
      : "";

    const html = `
<div style="font-family: 'Hiragino Kaku Gothic ProN', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #D97706; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 16px;">⏱ お見積もりの有効期限が近づいています</h2>
  </div>
  <div style="background: #FFFAEB; border: 1px solid #FCD34D; border-top: none; padding: 20px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 14px; color: #333; margin: 0 0 16px;">
      <strong>${est.customer_name}</strong> 様
    </p>
    <p style="font-size: 13px; color: #555; line-height: 1.9; margin: 0 0 16px;">
      ${shopName}でございます。<br/>
      先日お送りしたお見積もりの有効期限まで、あと <strong style="color: #DC2626;">${daysUntilExpiry}日</strong> となりました。
    </p>
    ${customMsgHtml}
    <div style="background: white; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
      <p style="font-size: 12px; color: #666; margin: 0 0 4px;">ご提案価格（税込）</p>
      <p style="font-size: 24px; color: #047857; font-weight: bold; margin: 0;">¥${taxIncTotal.toLocaleString()}</p>
      <p style="font-size: 11px; color: #999; margin: 4px 0 0;">有効期限: ${expiresAt.toLocaleDateString("ja-JP")}</p>
    </div>
    <p style="font-size: 12px; color: #666; line-height: 1.8; margin: 16px 0;">
      ご検討中の場合は、お早めに下記からご確定ください。<br/>
      ご不明点はお気軽にお問い合わせください🌸
    </p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${confirmUrl}" style="display: inline-block; padding: 14px 28px; background: #047857; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
        🌸 お見積もりを確定する
      </a>
    </div>
    ${shopPhone ? `<p style="text-align: center; font-size: 12px; color: #666; margin: 12px 0 0;">お電話でのお問い合わせ: <strong>${shopPhone}</strong></p>` : ""}
  </div>
  <p style="text-align: center; font-size: 11px; color: #999; margin-top: 12px;">${noReplyFooter()}</p>
</div>`;

    await sendEmail({
      to: est.customer_email,
      subject: `⏱ お見積もりの有効期限まで残り${daysUntilExpiry}日です | ${shopName}`,
      html,
    });

    // 送信履歴を更新
    await supabase
      .from("estimates")
      .update({ expiry_warning_sent_at: now.toISOString() })
      .eq("id", estimateId);

    return NextResponse.json({
      ok: true,
      sentTo: est.customer_email,
      daysUntilExpiry,
    });
  } catch (e) {
    console.error("[/api/staff/send-estimate-reminder]", e);
    return NextResponse.json({ error: e?.message || "送信に失敗しました" }, { status: 500 });
  }
}
