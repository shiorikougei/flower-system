// [見積-3] 見積関連 Cron 通知
//   ① 未回答催促: status='pending' で 24時間以上経過 → スタッフへ催促
//   ② 期限切れ間近: status='replied' で expires_at まで7日以内 → 顧客へ確定リマインダー
//   ③ 期限切れ自動マーク: expires_at < NOW() の pending/replied → expired にステータス変更
//
// 実行: Vercel Cron で 1日1回（推奨: 朝9時 JST = UTC 0時）
//   vercel.json に schedule 設定

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, noReplyFooter } from "@/utils/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// 認証: Vercel Cron 自動 or 環境変数 CRON_SECRET
function isAuthorized(request) {
  // Vercel Cron は user-agent: vercel-cron で来る
  const ua = request.headers.get("user-agent") || "";
  if (ua.includes("vercel-cron")) return true;
  // 手動実行用 secret
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 未設定なら誰でも実行可（開発用）
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = admin();
  const now = new Date();

  const results = {
    reminderSent: 0,
    expiryWarningSent: 0,
    autoExpired: 0,
    errors: [],
  };

  try {
    // === ③ 期限切れ自動マーク（先に処理） ===
    {
      const { data: expiredList } = await supabase
        .from("estimates")
        .select("id, tenant_id")
        .in("status", ["pending", "replied"])
        .lt("expires_at", now.toISOString());

      if (Array.isArray(expiredList) && expiredList.length > 0) {
        const ids = expiredList.map(e => e.id);
        await supabase
          .from("estimates")
          .update({ status: "expired" })
          .in("id", ids);
        results.autoExpired = ids.length;
      }
    }

    // === ① 未回答催促: pending で 24時間以上 ===
    const reminderThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: needReminder } = await supabase
      .from("estimates")
      .select("id, tenant_id, shop_id, customer_name, customer_email, customer_phone, request_content, created_at, reminder_sent_at")
      .eq("status", "pending")
      .lt("created_at", reminderThreshold)
      .is("reminder_sent_at", null);

    for (const est of needReminder || []) {
      try {
        // 店舗情報取得
        const { data: tRow } = await supabase.from("app_settings").select("settings_data").eq("id", est.tenant_id).single();
        const settings = tRow?.settings_data || {};
        const targetShop = settings.shops?.find(s => String(s.id) === String(est.shop_id)) || settings.shops?.[0] || {};
        const shopEmail = (targetShop.notifyEmail || "").trim() || targetShop.email || settings.generalConfig?.email;
        const shopName = targetShop.name || settings.generalConfig?.appName || est.tenant_id;
        const ccEmails = (targetShop.notifyCcEmails || "").split(",").map(s => s.trim()).filter(Boolean);
        if (!shopEmail) continue;

        const hoursSinceRequest = Math.floor((now.getTime() - new Date(est.created_at).getTime()) / (1000 * 60 * 60));

        const html = `
<div style="font-family: 'Hiragino Kaku Gothic ProN', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #D97706; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 16px;">⏰ 未回答のお見積もり依頼があります</h2>
  </div>
  <div style="background: #FFFAEB; border: 1px solid #FCD34D; border-top: none; padding: 20px; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 16px; font-size: 13px; color: #92400E;">
      <strong>${hoursSinceRequest}時間前</strong> にいただいたお見積もり依頼がまだ未回答です。<br/>
      お早めにご対応をお願いします🌸
    </p>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #333; background: white; padding: 12px; border-radius: 8px;">
      <tr><td style="padding: 6px 12px; color: #666;">お客様</td><td style="padding: 6px 12px;"><strong>${est.customer_name || "-"}</strong> 様</td></tr>
      <tr><td style="padding: 6px 12px; color: #666;">メール</td><td style="padding: 6px 12px;">${est.customer_email || "-"}</td></tr>
      <tr><td style="padding: 6px 12px; color: #666;">電話</td><td style="padding: 6px 12px;">${est.customer_phone || "-"}</td></tr>
      <tr><td style="padding: 6px 12px; color: #666;">店舗</td><td style="padding: 6px 12px;">${shopName}</td></tr>
      <tr><td style="padding: 6px 12px; color: #666;">経過時間</td><td style="padding: 6px 12px;"><strong style="color: #DC2626;">${hoursSinceRequest}時間</strong></td></tr>
    </table>
    <div style="margin: 20px 0 0; padding: 12px; background: white; border-radius: 8px; font-size: 12px; color: #555;">
      <strong>ご依頼内容（抜粋）:</strong><br/>
      ${String(est.request_content || "").slice(0, 200).replace(/\n/g, "<br/>")}${(est.request_content || "").length > 200 ? "..." : ""}
    </div>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${BASE_URL}/staff/estimates" style="display: inline-block; padding: 12px 24px; background: #D97706; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">
        📋 スタッフ画面で回答する
      </a>
    </div>
  </div>
  <p style="text-align: center; font-size: 11px; color: #999; margin-top: 12px;">${noReplyFooter()}</p>
</div>`;

        await sendEmail({
          to: shopEmail,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          subject: `⏰ 未回答のお見積もり依頼があります（${est.customer_name}様 / ${hoursSinceRequest}時間経過）`,
          html,
        });

        await supabase
          .from("estimates")
          .update({ reminder_sent_at: now.toISOString() })
          .eq("id", est.id);
        results.reminderSent++;
      } catch (e) {
        results.errors.push({ id: est.id, type: "reminder", message: e?.message });
      }
    }

    // === ② 期限切れ間近 → スタッフへ通知のみ（顧客送信は店舗判断で手動） ===
    //    テナントごとに集約して1通にまとめて送信
    const warningThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: needWarning } = await supabase
      .from("estimates")
      .select("id, tenant_id, shop_id, customer_name, customer_email, customer_phone, expires_at, proposed_price, replied_at, staff_expiry_alert_sent_at, expiry_warning_sent_at")
      .eq("status", "replied")
      .lt("expires_at", warningThreshold)
      .gt("expires_at", now.toISOString())
      .is("staff_expiry_alert_sent_at", null);

    // テナント別にグループ化
    const byTenant = {};
    for (const est of needWarning || []) {
      const key = `${est.tenant_id}__${est.shop_id || ""}`;
      if (!byTenant[key]) byTenant[key] = { tenantId: est.tenant_id, shopId: est.shop_id, items: [] };
      byTenant[key].items.push(est);
    }

    for (const group of Object.values(byTenant)) {
      try {
        const { data: tRow } = await supabase.from("app_settings").select("settings_data").eq("id", group.tenantId).single();
        const settings = tRow?.settings_data || {};
        const targetShop = settings.shops?.find(s => String(s.id) === String(group.shopId)) || settings.shops?.[0] || {};
        const shopEmail = (targetShop.notifyEmail || "").trim() || targetShop.email || settings.generalConfig?.email;
        const shopName = targetShop.name || settings.generalConfig?.appName || group.tenantId;
        const ccEmails = (targetShop.notifyCcEmails || "").split(",").map(s => s.trim()).filter(Boolean);
        if (!shopEmail) continue;

        const itemsHtml = group.items.map(est => {
          const daysLeft = Math.ceil((new Date(est.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const taxIncTotal = Math.round((est.proposed_price || 0) * 1.1);
          const customerSentBefore = !!est.expiry_warning_sent_at;
          return `
<tr style="border-bottom: 1px solid #FEE2D6;">
  <td style="padding: 10px 8px; vertical-align: top;">
    <div style="font-weight: bold; color: #2D4B3E;">${est.customer_name || "-"} 様</div>
    <div style="font-size: 11px; color: #666;">${est.customer_email || "メール未登録"}</div>
    ${est.customer_phone ? `<div style="font-size: 11px; color: #666;">TEL: ${est.customer_phone}</div>` : ""}
  </td>
  <td style="padding: 10px 8px; vertical-align: top; text-align: right; white-space: nowrap;">
    <div style="font-size: 16px; color: #047857; font-weight: bold;">¥${taxIncTotal.toLocaleString()}</div>
    <div style="font-size: 11px; color: #DC2626;"><strong>あと${daysLeft}日</strong></div>
    <div style="font-size: 10px; color: #999;">${new Date(est.expires_at).toLocaleDateString("ja-JP")}まで</div>
    ${customerSentBefore ? `<div style="font-size: 9px; color: #999; margin-top: 4px;">📧 ${new Date(est.expiry_warning_sent_at).toLocaleDateString("ja-JP")} 顧客通知済</div>` : ""}
  </td>
</tr>`;
        }).join("");

        const html = `
<div style="font-family: 'Hiragino Kaku Gothic ProN', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
  <div style="background: #D97706; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 16px;">⏱ 期限切れ間近のお見積もりがあります</h2>
  </div>
  <div style="background: #FFFAEB; border: 1px solid #FCD34D; border-top: none; padding: 20px; border-radius: 0 0 12px 12px;">
    <p style="margin: 0 0 16px; font-size: 13px; color: #92400E;">
      ${shopName} には <strong>${group.items.length}件</strong> の有効期限間近（7日以内）のお見積もりがあります。<br/>
      顧客へのリマインド送信は <strong>スタッフ画面から判断・操作</strong> してください。
    </p>
    <div style="background: white; border-radius: 8px; padding: 4px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        ${itemsHtml}
      </table>
    </div>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${BASE_URL}/staff/estimates" style="display: inline-block; padding: 12px 24px; background: #D97706; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">
        📋 スタッフ画面で確認・送信する
      </a>
    </div>
    <p style="font-size: 11px; color: #666; margin: 16px 0 0; line-height: 1.8;">
      💡 スタッフ画面の対象見積もりに <strong>「顧客にリマインド送信」</strong> ボタンが表示されます。<br/>
      📌 顧客への自動送信は行いません。送信タイミングは店舗ご判断でお願いします。
    </p>
  </div>
  <p style="text-align: center; font-size: 11px; color: #999; margin-top: 12px;">${noReplyFooter()}</p>
</div>`;

        await sendEmail({
          to: shopEmail,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          subject: `⏱ 期限切れ間近の見積もり ${group.items.length}件のお知らせ | ${shopName}`,
          html,
        });

        // 全件をアラート済みにマーク（同じ見積に毎日送らない）
        const ids = group.items.map(e => e.id);
        await supabase
          .from("estimates")
          .update({ staff_expiry_alert_sent_at: now.toISOString() })
          .in("id", ids);

        results.expiryWarningSent += group.items.length;
      } catch (e) {
        results.errors.push({ tenantId: group.tenantId, type: "expiry_warning_staff", message: e?.message });
      }
    }

    return NextResponse.json({ ok: true, ...results, ranAt: now.toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message, ...results }, { status: 500 });
  }
}
