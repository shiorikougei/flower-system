// [POS] PIN認証付き 在庫減算API（公開エンドポイント・PIN必須）
//
// QRコードスキャン後の「在庫を減らす」ボタンから呼ばれる
// ログイン不要・PIN認証のみ
//
// POST /api/scan/decrement-with-pin
//   Body: { productId, pin, qty, note }
//   Response: { ok, newStock, productName, staffName }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/utils/rateLimit';

export const runtime = 'nodejs';

function comparePin(inputPin, storedValue) {
  if (!storedValue) return false;
  return String(inputPin) === String(storedValue);
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);

    // ★ 厳しめのレートリミット（PIN総当たり攻撃対策）: 1IPあたり 10回/分
    const allowed = await rateLimit({ key: `scan_pin:${ip}`, max: 10, windowSec: 60 });
    if (!allowed) {
      return NextResponse.json({ ok: false, error: '試行回数が多すぎます。1分後に再度お試しください。' }, { status: 429 });
    }

    const body = await request.json();
    const { productId, pin, qty, note } = body;

    if (!productId) return NextResponse.json({ ok: false, error: 'productId必須' }, { status: 400 });
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return NextResponse.json({ ok: false, error: 'PINは4桁の数字' }, { status: 400 });
    }

    const decrementQty = Math.max(1, Math.floor(Number(qty) || 1));
    if (decrementQty > 999) {
      return NextResponse.json({ ok: false, error: '一度に減らせるのは999個まで' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 商品情報取得（tenant_id を商品から取得）
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, stock, tenant_id, is_active')
      .eq('id', productId)
      .single();
    if (prodErr || !product) {
      return NextResponse.json({ ok: false, error: '商品が見つかりません' }, { status: 404 });
    }
    if (!product.is_active) {
      return NextResponse.json({ ok: false, error: '商品が非公開状態です' }, { status: 400 });
    }

    const tenantId = product.tenant_id;

    // テナントのスタッフリスト取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const staffList = settingsRow?.settings_data?.staffList || [];

    // ★ PIN照合（一致するスタッフを探す）
    const matchedStaff = staffList.find(s => s.pin && comparePin(pin, s.pin));
    if (!matchedStaff) {
      // 失敗を監査ログに記録
      try {
        await supabaseAdmin.from('audit_log').insert({
          tenant_id: tenantId,
          staff_name: 'unknown',
          action: 'scan_pin_failed',
          target_type: 'product',
          target_id: String(productId),
          description: `QRスキャン在庫減算でPIN認証失敗 (IP: ${ip})`,
        });
      } catch {}
      return NextResponse.json({ ok: false, error: 'PINが違います' }, { status: 401 });
    }

    // 在庫不足チェック
    if (Number(product.stock) < decrementQty) {
      return NextResponse.json({
        ok: false,
        error: `在庫不足（在庫: ${product.stock}個 / 要求: ${decrementQty}個）`,
      }, { status: 400 });
    }

    // ★ 在庫減算（既存のRPC関数を流用：原子的）
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('decrement_stock', {
      p_product_id: productId,
      p_qty: decrementQty,
    });
    if (rpcErr) {
      console.error('[scan/decrement-with-pin] RPC failed:', rpcErr?.code || 'unknown');
      return NextResponse.json({ ok: false, error: '在庫減算失敗' }, { status: 500 });
    }
    if (!rpcResult?.success) {
      return NextResponse.json({
        ok: false,
        error: rpcResult?.error || '在庫減算失敗',
      }, { status: 400 });
    }

    // 監査ログ
    try {
      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenantId,
        staff_name: matchedStaff.name || 'スタッフ',
        staff_role: matchedStaff.role || 'staff',
        action: 'scan_stock_decrement',
        target_type: 'product',
        target_id: String(productId),
        description: `QRスキャン店頭販売: ${product.name} × ${decrementQty}個${note ? ` (メモ: ${note})` : ''}`,
        metadata: {
          productName: product.name,
          qty: decrementQty,
          stockBefore: product.stock,
          stockAfter: rpcResult.new_stock,
          note: note || null,
          via: 'qr_scan',
        },
      });
    } catch (e) {
      console.warn('[scan/decrement-with-pin] audit log failed');
    }

    return NextResponse.json({
      ok: true,
      newStock: rpcResult.new_stock,
      productName: product.name,
      decrementedQty: decrementQty,
      staffName: matchedStaff.name || 'スタッフ',
    });
  } catch (err) {
    console.error('[/api/scan/decrement-with-pin]', err?.message || 'unknown');
    return NextResponse.json({ ok: false, error: '在庫減算失敗' }, { status: 500 });
  }
}
