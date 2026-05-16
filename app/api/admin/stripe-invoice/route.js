// 管理者(NocoLde)用 Stripe Invoice 作成
// POST /api/admin/stripe-invoice
// Body: { tenantId, tenantName, billingEmail, amount, description }
// Returns: { hosted_invoice_url, invoice_pdf, invoice_id }
//
// 動作:
//   1. Stripe Customer を作成 or 取得（メールベース）
//   2. Stripe Invoice Item を追加
//   3. Invoice を確定 → 支払いリンクを返す
//
// 必要な環境変数: STRIPE_SECRET_KEY (NocoLde 自身のStripeアカウントのキー)
//   ※既存のテナント別 Stripe Connect とは別、NocoLde の決済受取用

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireOwner } from '@/utils/adminAuth';

export const runtime = 'nodejs';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

export async function POST(request) {
  try {
    // ★ NocoLdeスーパー管理者のみ実行可（cronからの内部呼出はCRON_SECRETでバイパス）
    const isCron = request.headers.get('x-cron-secret') === process.env.CRON_SECRET;
    if (!isCron) {
      const auth = await requireOwner(request);
      if (!auth.ok) return auth.response;
    }

    if (!stripe) {
      return NextResponse.json({ error: 'Stripe未設定（STRIPE_SECRET_KEY が必要）' }, { status: 500 });
    }
    const { tenantId, tenantName, billingEmail, amount, description } = await request.json();
    if (!billingEmail || !amount || amount <= 0) {
      return NextResponse.json({ error: 'billingEmail/amount必須' }, { status: 400 });
    }

    // 1. Customer作成 or 取得
    const existing = await stripe.customers.list({ email: billingEmail, limit: 1 });
    const customer = existing.data[0] || await stripe.customers.create({
      email: billingEmail,
      name: tenantName,
      metadata: { tenant_id: tenantId },
    });

    // 2. Invoice Item追加
    await stripe.invoiceItems.create({
      customer: customer.id,
      amount,                     // 円単位、税込
      currency: 'jpy',
      description: description || `${tenantName} 月額利用料`,
    });

    // 3. Invoice作成 + 確定
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: true,
      description: `FLORIX 利用料金 (${tenantName})`,
    });

    // finalize（支払いリンクを生成）
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

    return NextResponse.json({
      ok: true,
      invoiceId: finalized.id,
      hostedInvoiceUrl: finalized.hosted_invoice_url,
      invoicePdf: finalized.invoice_pdf,
      amount,
      customerEmail: billingEmail,
    });
  } catch (err) {
    console.error('[stripe-invoice]', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
