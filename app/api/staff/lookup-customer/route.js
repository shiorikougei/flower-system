// 電話番号で過去注文を検索し、顧客情報＋LINE連携状態を返す
// GET /api/staff/lookup-customer?phone=09012345678&tenantId=xxx
// 用途: 電話受付時にスタッフが電話番号を入力すると、過去注文から名前・メアド・LINE連携を自動取得

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// 電話番号を正規化（ハイフン・スペース除去、半角統一）
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone)
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[^\d]/g, '');
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');
    const tenantId = url.searchParams.get('tenantId');

    if (!phone || !tenantId) {
      return NextResponse.json({ error: 'phone と tenantId が必要です' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    if (normalized.length < 8) {
      return NextResponse.json({ ok: true, found: false, message: '電話番号が短すぎます' });
    }

    const supabase = admin();

    // ★ 過去の注文から同じ電話番号を持つレコードを検索
    // order_data.customerInfo.phone を中で照合する必要がある (jsonb)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_data, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[lookup-customer]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 電話番号で絞り込み (jsonb 内のフィールドを正規化して比較)
    const matched = (orders || []).filter(o => {
      const orderPhone = normalizePhone(o.order_data?.customerInfo?.phone);
      return orderPhone && orderPhone === normalized;
    });

    if (matched.length === 0) {
      return NextResponse.json({ ok: true, found: false });
    }

    // 最新の注文情報を返す
    const latest = matched[0];
    const ci = latest.order_data?.customerInfo || {};
    const customerEmail = (ci.email || '').toLowerCase();

    // LINE連携状態を取得 (アクティブな紐付けがあるか)
    let lineActive = false;
    let lineDisplayName = null;
    if (customerEmail) {
      const { data: lineLink } = await supabase
        .from('customer_line_links')
        .select('line_user_id, display_name, is_active')
        .eq('tenant_id', tenantId)
        .eq('customer_email', customerEmail)
        .eq('is_active', true)
        .order('linked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lineLink) {
        lineActive = true;
        lineDisplayName = lineLink.display_name || null;
      }
    }

    // 注文履歴サマリー (過去5件まで)
    const orderHistory = matched.slice(0, 5).map(o => ({
      id: o.id,
      date: o.created_at,
      flowerType: o.order_data?.flowerType,
      itemPrice: o.order_data?.itemPrice,
      totalAmount: o.order_data?.totalAmount,
    }));

    return NextResponse.json({
      ok: true,
      found: true,
      customer: {
        name: ci.name || '',
        phone: ci.phone || '',
        email: ci.email || '',
        zip: ci.zip || '',
        address1: ci.address1 || '',
        address2: ci.address2 || '',
      },
      lineLink: {
        active: lineActive,
        displayName: lineDisplayName,
      },
      orderCount: matched.length,
      orderHistory,
    });
  } catch (err) {
    console.error('[lookup-customer]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
