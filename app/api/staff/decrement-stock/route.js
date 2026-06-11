// [POS-#26] 店頭販売による在庫減算API
//
// スタッフが「店頭で○個販売」ボタンを押した時に呼ばれる
// 在庫を減算するだけ（売上記録はしない＝各店舗の既存POSに任せる）
// 監査ログに「誰が・いつ・何を・何個」を記録
//
// POST /api/staff/decrement-stock
//   Body: { productId, qty, note }
//   Response: { ok, newStock, productName }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/utils/rateLimit';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // レート制限: 1IPあたり 60回/分（連続操作許可）
    const ip = getClientIp(request);
    const allowed = await rateLimit({ key: `decrement_stock:${ip}`, max: 60, windowSec: 60 });
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'リクエスト過多です' }, { status: 429 });
    }

    // 認証チェック
    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return NextResponse.json({ ok: false, error: '未認証' }, { status: 401 });

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: '認証失敗' }, { status: 401 });

    const body = await request.json();
    const { productId, qty, note, staffName } = body;
    if (!productId) return NextResponse.json({ ok: false, error: 'productId必須' }, { status: 400 });

    const decrementQty = Math.max(1, Math.floor(Number(qty) || 1));
    if (decrementQty > 999) {
      return NextResponse.json({ ok: false, error: '一度に減らせるのは999個まで' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ ok: false, error: 'tenant_id取得失敗' }, { status: 400 });

    // 商品が同テナントに属するか検証
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, stock, tenant_id, restock_allowed')
      .eq('id', productId)
      .single();
    if (prodErr || !product) {
      return NextResponse.json({ ok: false, error: '商品が見つかりません' }, { status: 404 });
    }
    if (String(product.tenant_id) !== String(tenantId)) {
      return NextResponse.json({ ok: false, error: '権限がありません' }, { status: 403 });
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
      console.error('[decrement-stock] RPC failed:', rpcErr?.message || 'unknown');
      return NextResponse.json({ ok: false, error: '在庫減算失敗' }, { status: 500 });
    }
    if (!rpcResult?.success) {
      return NextResponse.json({
        ok: false,
        error: rpcResult?.error || '在庫減算失敗',
      }, { status: 400 });
    }

    // ★ 監査ログ記録（誰が・いつ・何を・何個 + 任意メモ）
    try {
      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenantId,
        staff_name: staffName || 'スタッフ',
        action: 'store_sale_stock_decrement',
        target_type: 'product',
        target_id: String(productId),
        description: `店頭販売: ${product.name} × ${decrementQty}個${note ? ` (メモ: ${note})` : ''}`,
        metadata: {
          productName: product.name,
          qty: decrementQty,
          stockBefore: product.stock,
          stockAfter: rpcResult.new_stock,
          note: note || null,
        },
      });
    } catch (e) {
      console.warn('[decrement-stock] audit log failed');
    }

    return NextResponse.json({
      ok: true,
      newStock: rpcResult.new_stock,
      productName: product.name,
      decrementedQty: decrementQty,
    });
  } catch (err) {
    console.error('[/api/staff/decrement-stock]', err?.message || 'unknown');
    return NextResponse.json({ ok: false, error: '在庫減算失敗' }, { status: 500 });
  }
}
