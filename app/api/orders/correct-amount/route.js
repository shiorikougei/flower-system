// [注文-4] オーナー権限による注文金額の事後訂正
// POST /api/orders/correct-amount
//   body: {
//     orderId, newItemPrice, newCalculatedFee, newPickupFee?, reason,
//     notifyCustomer?: boolean, notifyStore?: boolean
//   }
// 認証: スタッフセッション + オーナーロール必須

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

function escapeHtml(s) {
  return String(s || "").replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[c]));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      orderId,
      newItemPrice,
      newCalculatedFee,
      newPickupFee,
      reason,
      notifyCustomer = false,
      notifyStore = false,
      operatorName,
      operatorRole,
    } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderIdが必要です" }, { status: 400 });
    }
    if (!reason || String(reason).trim().length < 3) {
      return NextResponse.json({ error: "訂正理由を3文字以上で入力してください" }, { status: 400 });
    }
    if (newItemPrice == null || Number(newItemPrice) < 0) {
      return NextResponse.json({ error: "商品代を正しく入力してください" }, { status: 400 });
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

    // ★ オーナー権限チェック（クライアント主張 + サーバー検証）
    //   現状は localStorage の role を信頼。
    //   将来的に profiles テーブルに role を持つようになったらサーバーDBで照合
    if (operatorRole !== "owner") {
      return NextResponse.json({ error: "オーナー権限が必要です" }, { status: 403 });
    }

    // 注文取得
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (oErr || !order) {
      return NextResponse.json({ error: "注文が見つかりません" }, { status: 404 });
    }

    // テナント整合性チェック
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userData.user.id)
      .single();
    if (!profile?.tenant_id || String(profile.tenant_id).toLowerCase() !== String(order.tenant_id).toLowerCase()) {
      return NextResponse.json({ error: "このテナントへの操作権限がありません" }, { status: 403 });
    }

    const od = order.order_data || {};
    const oldItemPrice = Number(od.itemPrice) || 0;
    const oldCalculatedFee = Number(od.calculatedFee) || 0;
    const oldPickupFee = Number(od.pickupFee) || 0;
    const oldEcBoxFee = Number(od.ecBoxFee) || 0;
    const oldSubTotal = oldItemPrice + oldCalculatedFee + oldPickupFee + oldEcBoxFee;
    const oldTax = Math.floor(oldSubTotal * 0.1);
    const oldTotal = oldSubTotal + oldTax;

    // [訂正] 入金状況の判定
    //   DB payment_status='paid' OR
    //   order_data.paymentStatus に「前払い済み」「入金済み」含む
    //   → "入金済み"扱い、訂正後の差額がリアル世界の追加振込/返金になる
    const dbPaymentStatus = order.payment_status;
    const jpPaymentStatus = String(od.paymentStatus || '');
    const wasPaid = dbPaymentStatus === 'paid'
      || jpPaymentStatus.includes('前払い済み')
      || jpPaymentStatus.includes('入金済み');
    // 既に支払われた金額（訂正前の総額 = 入金された金額）
    const paidAmount = wasPaid ? (od.paidAmount != null ? Number(od.paidAmount) : oldTotal) : 0;

    const itemPrice = Number(newItemPrice);
    const calculatedFee = newCalculatedFee != null ? Number(newCalculatedFee) : oldCalculatedFee;
    const pickupFee = newPickupFee != null ? Number(newPickupFee) : oldPickupFee;
    const subTotal = itemPrice + calculatedFee + pickupFee + oldEcBoxFee;
    const tax = Math.floor(subTotal * 0.1);
    const newTotal = subTotal + tax;

    // [訂正] 訂正後の支払い状況計算
    //   wasPaid=true なら、訂正後に追加振込or返金が必要か判定
    const balance = newTotal - paidAmount; // 0=ぴったり、+=追加必要、-=返金必要
    let paymentSituation; // 'fully_paid'|'additional_required'|'refund_required'|'unpaid'
    if (wasPaid) {
      if (balance === 0) paymentSituation = 'fully_paid';
      else if (balance > 0) paymentSituation = 'additional_required';
      else paymentSituation = 'refund_required';
    } else {
      paymentSituation = 'unpaid';
    }

    // 監査ログ用の訂正履歴
    const correction = {
      at: new Date().toISOString(),
      operatorName: operatorName || "オーナー",
      operatorUserId: userData.user.id,
      reason: String(reason).slice(0, 500),
      before: {
        itemPrice: oldItemPrice,
        calculatedFee: oldCalculatedFee,
        pickupFee: oldPickupFee,
        totalAmount: oldTotal,
        paymentStatus: jpPaymentStatus,
        dbPaymentStatus,
        paidAmount,
      },
      after: {
        itemPrice,
        calculatedFee,
        pickupFee,
        totalAmount: newTotal,
        paymentSituation,
        balance,
      },
      notified: { customer: !!notifyCustomer, store: !!notifyStore },
    };

    const updatedOrderData = {
      ...od,
      itemPrice,
      calculatedFee,
      pickupFee,
      totalAmount: newTotal,
      // [訂正] 支払い済みの場合、実際に支払われた金額をスナップショット
      ...(wasPaid && { paidAmount }),
      amountCorrections: [...(Array.isArray(od.amountCorrections) ? od.amountCorrections : []), correction],
    };

    const { error: updErr } = await supabase
      .from("orders")
      .update({ order_data: updatedOrderData })
      .eq("id", orderId);
    if (updErr) {
      return NextResponse.json({ error: `更新失敗: ${updErr.message}` }, { status: 500 });
    }

    // 店舗情報取得（メール送信用）
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("settings_data")
      .eq("id", order.tenant_id)
      .single();
    const settings = settingsRow?.settings_data || {};
    const targetShop = settings.shops?.find(s => String(s.id) === String(od.shopId)) || settings.shops?.[0] || {};
    const shopName = targetShop.name || settings.generalConfig?.appName || "お花屋さん";
    const shopPhone = targetShop.phone || "";
    const shopBankInfo = targetShop.bankInfo || "";

    const diff = newTotal - oldTotal;
    const diffLabel = diff > 0 ? `+¥${diff.toLocaleString()}` : `¥${diff.toLocaleString()}`;

    // [訂正] 支払い状況別 案内文を組み立て
    let situationBlock = '';
    let paymentStatusBadge = '';
    if (paymentSituation === 'unpaid') {
      paymentStatusBadge = `<span style="background:#FEF2F2; color:#B91C1C; font-size:10px; font-weight:bold; padding:3px 8px; border-radius:4px;">未入金</span>`;
      situationBlock = `
        <div style="background: #FEF2F2; border: 2px solid #FCA5A5; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 8px; color: #B91C1C; font-size: 13px; font-weight: bold;">💳 お支払いについて</p>
          <p style="margin: 0; color: #7F1D1D; font-size: 12px; line-height: 1.9;">
            訂正後の金額 <strong>¥${newTotal.toLocaleString()}</strong> をお支払いください。<br/>
            ${shopBankInfo ? `<br/><strong>お振込先:</strong><br/><span style="display: inline-block; background: white; padding: 8px 12px; border-radius: 4px; margin-top: 4px; font-family: monospace; white-space: pre-line;">${escapeHtml(shopBankInfo)}</span>` : 'お振込先・お支払い方法は店舗からご案内いたします。'}
          </p>
        </div>`;
    } else if (paymentSituation === 'fully_paid') {
      paymentStatusBadge = `<span style="background:#ECFDF5; color:#047857; font-size:10px; font-weight:bold; padding:3px 8px; border-radius:4px;">入金済み</span>`;
      situationBlock = `
        <div style="background: #ECFDF5; border: 2px solid #6EE7B7; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 8px; color: #047857; font-size: 13px; font-weight: bold;">✓ お支払い完了済み</p>
          <p style="margin: 0; color: #065F46; font-size: 12px; line-height: 1.9;">
            お支払い済み金額 <strong>¥${paidAmount.toLocaleString()}</strong> = 訂正後の合計 <strong>¥${newTotal.toLocaleString()}</strong> となり、追加のお支払い・返金はございません。
          </p>
        </div>`;
    } else if (paymentSituation === 'additional_required') {
      paymentStatusBadge = `<span style="background:#FFFBEB; color:#92400E; font-size:10px; font-weight:bold; padding:3px 8px; border-radius:4px;">追加お支払いが必要</span>`;
      situationBlock = `
        <div style="background: #FFFBEB; border: 2px solid #FCD34D; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 8px; color: #92400E; font-size: 13px; font-weight: bold;">⚠️ 追加お支払いのご案内</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #78350F; margin: 4px 0;">
            <tr><td style="padding: 3px 0;">既にお支払い済み</td><td style="text-align: right;">¥${paidAmount.toLocaleString()}</td></tr>
            <tr><td style="padding: 3px 0;">訂正後の合計</td><td style="text-align: right;">¥${newTotal.toLocaleString()}</td></tr>
            <tr style="border-top: 1px solid #FCD34D;"><td style="padding: 6px 0; font-weight: bold;">追加お支払い額</td><td style="text-align: right; font-weight: bold; font-size: 16px; color: #B45309;">¥${balance.toLocaleString()}</td></tr>
          </table>
          <p style="margin: 8px 0 0; color: #78350F; font-size: 12px; line-height: 1.9;">
            ${shopBankInfo ? `<strong>追加お振込先:</strong><br/><span style="display: inline-block; background: white; padding: 8px 12px; border-radius: 4px; margin-top: 4px; font-family: monospace; white-space: pre-line;">${escapeHtml(shopBankInfo)}</span>` : '追加お支払い方法については別途ご案内いたします。'}
          </p>
        </div>`;
    } else if (paymentSituation === 'refund_required') {
      paymentStatusBadge = `<span style="background:#EFF6FF; color:#1E40AF; font-size:10px; font-weight:bold; padding:3px 8px; border-radius:4px;">返金処理予定</span>`;
      situationBlock = `
        <div style="background: #EFF6FF; border: 2px solid #93C5FD; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <p style="margin: 0 0 8px; color: #1E40AF; font-size: 13px; font-weight: bold;">💰 返金のご案内</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #1E3A8A; margin: 4px 0;">
            <tr><td style="padding: 3px 0;">お支払い済み</td><td style="text-align: right;">¥${paidAmount.toLocaleString()}</td></tr>
            <tr><td style="padding: 3px 0;">訂正後の合計</td><td style="text-align: right;">¥${newTotal.toLocaleString()}</td></tr>
            <tr style="border-top: 1px solid #93C5FD;"><td style="padding: 6px 0; font-weight: bold;">ご返金額</td><td style="text-align: right; font-weight: bold; font-size: 16px; color: #1E40AF;">¥${Math.abs(balance).toLocaleString()}</td></tr>
          </table>
          <p style="margin: 8px 0 0; color: #1E3A8A; font-size: 12px; line-height: 1.9;">
            ご返金方法は別途ご案内いたします。<br/>
            お振込先の口座情報をお電話・メールでお知らせいただけますようお願いいたします。
          </p>
        </div>`;
    }

    // === 顧客への訂正通知メール ===
    if (notifyCustomer && od.customerInfo?.email) {
      try {
        const customerHtml = `
<div style="font-family: 'Hiragino Kaku Gothic ProN', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #2D4B3E; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 16px;">📝 ご注文金額の訂正のお知らせ</h2>
  </div>
  <div style="background: #FBFAF9; border: 1px solid #EAEAEA; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 14px; color: #333; margin: 0 0 16px;">
      <strong>${escapeHtml(od.customerInfo?.name || "お客様")}</strong> 様
    </p>
    <p style="font-size: 13px; color: #555; line-height: 1.9; margin: 0 0 16px;">
      ${escapeHtml(shopName)}でございます。<br/>
      この度はご注文ありがとうございます。<br/>
      ご注文金額に訂正がございましたので、ご連絡いたします。
    </p>

    <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 10px; flex-wrap: wrap;">
        <div>
          <p style="font-size: 11px; color: #666; margin: 0 0 4px;">注文番号</p>
          <p style="font-size: 13px; font-weight: bold; color: #2D4B3E; margin: 0;">${escapeHtml(String(orderId).slice(0, 8))}</p>
        </div>
        ${paymentStatusBadge}
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr style="border-bottom: 1px solid #EAEAEA;">
          <td style="padding: 8px 0; color: #666;">訂正前</td>
          <td style="padding: 8px 0; text-align: right; color: #999;">¥${oldTotal.toLocaleString()} (税込)</td>
        </tr>
        <tr style="border-bottom: 1px solid #EAEAEA; background: #FFFBEB;">
          <td style="padding: 12px 8px; color: #92400E; font-weight: bold;">訂正後</td>
          <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #92400E; font-size: 16px;">¥${newTotal.toLocaleString()} (税込)</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">差額</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${diff > 0 ? "#B45309" : diff < 0 ? "#047857" : "#555"};">${diffLabel}</td>
        </tr>
      </table>
    </div>

    ${situationBlock}

    <div style="background: #FFFAEB; border-left: 4px solid #D97706; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
      <p style="margin: 0 0 4px; font-size: 11px; color: #92400E; font-weight: bold;">訂正理由</p>
      <p style="margin: 0; font-size: 13px; color: #5B2C00; line-height: 1.7;">${escapeHtml(reason)}</p>
    </div>

    <p style="font-size: 12px; color: #666; line-height: 1.9; margin: 16px 0;">
      ご不明な点がございましたら、お気軽にお問い合わせください。
    </p>
    ${shopPhone ? `<p style="text-align: center; font-size: 12px; color: #2D4B3E; font-weight: bold; margin: 12px 0;">📞 ${escapeHtml(shopPhone)}</p>` : ""}
  </div>
  <p style="text-align: center; font-size: 11px; color: #999; margin-top: 12px;">${noReplyFooter()}</p>
</div>`;

        await sendEmail({
          to: od.customerInfo.email,
          subject: `📝 ご注文金額の訂正のお知らせ | ${shopName}`,
          html: customerHtml,
        });
      } catch (e) {
        console.warn("[correct-amount] customer email failed:", e?.message);
      }
    }

    // === 店舗への通知メール ===
    if (notifyStore) {
      try {
        const storeEmail = (targetShop.notifyEmail || "").trim() || targetShop.email || settings.generalConfig?.email;
        const ccEmails = (targetShop.notifyCcEmails || "").split(",").map(s => s.trim()).filter(Boolean);
        if (storeEmail) {
          const storeHtml = `
<div style="font-family: 'Hiragino Kaku Gothic ProN', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #B45309; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0;">
    <h2 style="margin: 0; font-size: 16px;">💰 注文金額訂正の通知</h2>
  </div>
  <div style="background: #FFFAEB; border: 1px solid #FCD34D; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #333; margin: 0 0 16px;">
      <tr><td style="padding: 6px 0; color: #666; width: 30%;">注文ID</td><td style="padding: 6px 0;"><strong>${escapeHtml(String(orderId).slice(0, 8))}</strong></td></tr>
      <tr><td style="padding: 6px 0; color: #666;">お客様</td><td style="padding: 6px 0;">${escapeHtml(od.customerInfo?.name || "-")}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">操作者</td><td style="padding: 6px 0;">${escapeHtml(operatorName || "オーナー")}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">訂正前</td><td style="padding: 6px 0; color: #999;">¥${oldTotal.toLocaleString()}</td></tr>
      <tr style="background: #FFFBEB;"><td style="padding: 10px 8px; color: #92400E; font-weight: bold;">訂正後</td><td style="padding: 10px 8px; font-weight: bold; color: #92400E; font-size: 16px;">¥${newTotal.toLocaleString()}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">差額</td><td style="padding: 6px 0; font-weight: bold;">${diffLabel}</td></tr>
    </table>

    <!-- 入金状況の表示 -->
    <div style="background: ${paymentSituation === 'unpaid' ? '#FEF2F2' : paymentSituation === 'fully_paid' ? '#ECFDF5' : paymentSituation === 'additional_required' ? '#FFFBEB' : '#EFF6FF'}; padding: 12px 16px; border-radius: 8px; margin: 12px 0;">
      <p style="margin: 0 0 4px; font-size: 11px; font-weight: bold; color: ${paymentSituation === 'unpaid' ? '#B91C1C' : paymentSituation === 'fully_paid' ? '#047857' : paymentSituation === 'additional_required' ? '#92400E' : '#1E40AF'};">
        ${paymentSituation === 'unpaid' ? '🔴 未入金 — 訂正後の金額を回収予定' :
          paymentSituation === 'fully_paid' ? '✅ 入金済み — 過不足なし' :
          paymentSituation === 'additional_required' ? `🟡 入金済み (元金額) — 追加 ¥${balance.toLocaleString()} 必要` :
          `🔵 入金済み (元金額) — 返金 ¥${Math.abs(balance).toLocaleString()} 必要`}
      </p>
      <p style="margin: 0; font-size: 11px; color: #555;">
        支払い済み: ¥${paidAmount.toLocaleString()} / 訂正後: ¥${newTotal.toLocaleString()} / 差: ${balance >= 0 ? '+' : ''}¥${balance.toLocaleString()}
      </p>
    </div>

    <div style="background: white; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 0 0 4px; font-size: 11px; color: #666; font-weight: bold;">訂正理由</p>
      <p style="margin: 0; font-size: 13px; color: #333; line-height: 1.7;">${escapeHtml(reason)}</p>
    </div>
    <p style="font-size: 11px; color: #666; margin: 12px 0;">
      お客様への通知: ${notifyCustomer ? "送信済 ✓" : "未送信"}
    </p>
    <div style="text-align: center; margin-top: 16px;">
      <a href="${BASE_URL}/staff/orders" style="display: inline-block; padding: 10px 24px; background: #B45309; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">
        📋 注文一覧で確認する
      </a>
    </div>
  </div>
  <p style="text-align: center; font-size: 11px; color: #999; margin-top: 12px;">${noReplyFooter()}</p>
</div>`;

          await sendEmail({
            to: storeEmail,
            cc: ccEmails.length > 0 ? ccEmails : undefined,
            subject: `💰 注文金額訂正（${od.customerInfo?.name || "お客様"}様）${diffLabel}`,
            html: storeHtml,
          });
        }
      } catch (e) {
        console.warn("[correct-amount] store email failed:", e?.message);
      }
    }

    return NextResponse.json({
      ok: true,
      newTotal,
      diff,
      correction,
      paymentSituation,
      balance,
      paidAmount,
      wasPaid,
    });
  } catch (e) {
    console.error("[correct-amount]", e);
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
