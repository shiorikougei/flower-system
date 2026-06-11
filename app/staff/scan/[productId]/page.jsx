// [POS-#25] スタッフ専用 QRスキャン後ページ
// QRコードをスキャン → /staff/scan/[productId] に遷移
// 未ログインなら /staff/login にリダイレクト（ログイン後にこのURLに戻る）

'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import {
  Package, Plus, Minus, ChevronLeft, AlertCircle,
  CheckCircle2, Loader2, ShieldCheck, Tag,
} from 'lucide-react';
import { getCurrentStaff } from '@/utils/staffRole';

export default function StaffScanPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.productId;

  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [staffName, setStaffName] = useState('');
  const [error, setError] = useState('');

  // 在庫減算モーダル状態
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    initData();
  }, [productId]);

  async function initData() {
    setIsLoading(true);
    setError('');
    try {
      // 認証チェック
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // 未ログイン → ログイン後にこのページに戻るようリダイレクト
        const returnUrl = `/staff/scan/${productId}`;
        window.location.href = `/staff/login?returnUrl=${encodeURIComponent(returnUrl)}`;
        return;
      }

      // tenant_id 取得
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
      const tId = profile?.tenant_id;
      if (!tId) {
        setError('tenant_id が取得できません');
        return;
      }

      // 商品情報取得（同テナントのみ）
      const { data: productData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('tenant_id', tId)
        .single();
      if (prodErr || !productData) {
        setError('商品が見つかりません（他テナントの商品の可能性があります）');
        return;
      }
      setProduct(productData);

      // 店舗情報も取得
      const { data: settingsRow } = await supabase
        .from('app_settings')
        .select('settings_data')
        .eq('id', tId)
        .single();
      const settings = settingsRow?.settings_data || {};
      setShop(settings.shops?.[0] || null);

      // 現在のスタッフ名取得
      const cur = getCurrentStaff();
      setStaffName(cur?.name || 'スタッフ');
    } catch (e) {
      setError(e.message || '読み込み失敗');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDecrement() {
    if (qty < 1) return;
    setIsProcessing(true);
    setMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: 'error', text: 'セッション切れ。再ログインしてください' });
        return;
      }
      const res = await fetch('/api/staff/decrement-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: product.id,
          qty,
          note: note || null,
          staffName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.error || '処理失敗' });
        return;
      }
      setMessage({
        type: 'success',
        text: `✅ ${data.productName} を ${data.decrementedQty}個 店頭販売しました\n残り在庫: ${data.newStock}個`,
      });
      setProduct({ ...product, stock: data.newStock });
      setQty(1);
      setNote('');
    } catch (e) {
      setMessage({ type: 'error', text: e.message || '処理失敗' });
    } finally {
      setIsProcessing(false);
    }
  }

  // ローディング画面
  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#FBFAF9] flex flex-col items-center justify-center font-sans p-6">
        <Loader2 size={32} className="animate-spin text-[#2D4B3E]" />
        <p className="text-[12px] text-[#999] mt-4">読み込み中...</p>
      </main>
    );
  }

  // エラー画面
  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#FBFAF9] flex flex-col items-center justify-center font-sans p-6">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-[16px] font-bold text-[#111] mb-2">読み込みエラー</h1>
        <p className="text-[12px] text-[#555] text-center mb-6 max-w-sm">{error || '商品が見つかりません'}</p>
        <Link href="/staff/products" className="px-5 h-11 leading-[44px] bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold">
          商品管理に戻る
        </Link>
      </main>
    );
  }

  const isOutOfStock = product.stock === 0;
  const stockColor = product.stock === 0 ? 'red' : product.stock <= 3 ? 'amber' : 'green';

  return (
    <main className="min-h-screen bg-[#FBFAF9] font-sans pb-32">
      {/* ヘッダー */}
      <header className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <Link href="/staff/products" className="text-amber-700 hover:text-amber-900">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-amber-700">👤 スタッフモード</p>
          <p className="text-[10px] text-amber-600">{staffName} / {shop?.name || ''}</p>
        </div>
        <ShieldCheck size={18} className="text-amber-600" />
      </header>

      <div className="max-w-[500px] mx-auto p-4 space-y-4">
        {/* 商品情報カード */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden">
          {product.image_url && (
            <div className="aspect-square bg-[#FBFAF9]">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-5 space-y-3">
            {product.category && (
              <p className="text-[10px] text-[#999] font-bold">{product.category}</p>
            )}
            <h1 className="text-[20px] font-bold text-[#111] leading-tight">{product.name}</h1>
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-[#2D4B3E]">
                ¥{Number(product.price).toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-[#999]">(税抜)</span>
            </div>
            {/* 在庫状況（大きく表示） */}
            <div className={`rounded-xl p-4 text-center border-2 ${
              stockColor === 'green' ? 'bg-green-50 border-green-200' :
              stockColor === 'amber' ? 'bg-amber-50 border-amber-200' :
              'bg-red-50 border-red-200'
            }`}>
              <p className={`text-[11px] font-bold mb-1 ${
                stockColor === 'green' ? 'text-green-700' :
                stockColor === 'amber' ? 'text-amber-700' :
                'text-red-700'
              }`}>現在の在庫</p>
              <p className={`text-[48px] font-bold leading-none ${
                stockColor === 'green' ? 'text-green-700' :
                stockColor === 'amber' ? 'text-amber-700' :
                'text-red-700'
              }`}>{product.stock}<span className="text-[16px] font-normal ml-1">個</span></p>
              {stockColor === 'amber' && (
                <p className="text-[10px] text-amber-600 mt-2">⚠️ 在庫わずか</p>
              )}
            </div>
          </div>
        </div>

        {/* 店頭販売UI */}
        {!isOutOfStock && (
          <div className="bg-white border-2 border-amber-300 rounded-2xl p-5 space-y-4">
            <h2 className="text-[14px] font-bold text-amber-900 flex items-center gap-2">
              <Tag size={16} /> 店頭販売で在庫を減らす
            </h2>

            {/* 数量 */}
            <div>
              <label className="text-[11px] font-bold text-[#999] block mb-2">販売数量</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={isProcessing}
                  className="w-14 h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl hover:bg-white disabled:opacity-50"
                >
                  <Minus size={20} className="mx-auto" />
                </button>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
                  min={1}
                  max={product.stock}
                  disabled={isProcessing}
                  className="flex-1 h-14 text-center text-[28px] font-bold bg-[#FBFAF9] border-2 border-[#EAEAEA] rounded-xl focus:border-amber-500 outline-none"
                />
                <button
                  onClick={() => setQty(Math.min(product.stock, qty + 1))}
                  disabled={isProcessing}
                  className="w-14 h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl hover:bg-white disabled:opacity-50"
                >
                  <Plus size={20} className="mx-auto" />
                </button>
              </div>
              <p className="text-[10px] text-[#999] mt-1">最大 {product.stock}個まで</p>
            </div>

            {/* メモ（任意） */}
            <div>
              <label className="text-[11px] font-bold text-[#999] block mb-2">メモ（任意）</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例: お客様ご来店、田中様"
                disabled={isProcessing}
                className="w-full h-11 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] focus:border-amber-500 outline-none"
              />
            </div>

            {/* メッセージ */}
            {message && (
              <div className={`rounded-xl p-3 text-[12px] font-bold whitespace-pre-line ${
                message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message.text}
              </div>
            )}

            {/* 販売ボタン */}
            <button
              onClick={handleDecrement}
              disabled={isProcessing || qty < 1 || qty > product.stock}
              className="w-full h-14 bg-amber-600 text-white rounded-xl text-[14px] font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <><Loader2 size={16} className="animate-spin" /> 処理中...</>
              ) : (
                <><CheckCircle2 size={18} /> {qty}個 販売した</>
              )}
            </button>

            <p className="text-[10px] text-[#999] leading-relaxed text-center">
              ※ レジ機能ではありません。POSレジは普段通りご利用ください。<br/>
              ※ 操作は全て監査ログに記録されます。
            </p>
          </div>
        )}

        {/* 在庫切れ */}
        {isOutOfStock && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <AlertCircle size={32} className="mx-auto text-red-500 mb-2" />
            <p className="text-[14px] font-bold text-red-700">在庫切れです</p>
            <p className="text-[11px] text-red-600 mt-1">補充後、商品管理から在庫数を更新してください</p>
          </div>
        )}

        {/* 商品管理ページへのリンク */}
        <Link
          href="/staff/products"
          className="block w-full h-11 leading-[44px] text-center bg-white border border-[#EAEAEA] text-[#555] rounded-xl text-[12px] font-bold hover:border-[#2D4B3E]"
        >
          商品管理に戻る
        </Link>
      </div>
    </main>
  );
}
