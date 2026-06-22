// [POS] 公開QRスキャンページ
// 在庫確認はログイン不要、変更時のみPIN認証
// /scan/[productId]

'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import {
  Plus, Minus, AlertCircle, AlertTriangle, CheckCircle2, Loader2,
  Tag, Lock, X, RefreshCw, Package,
} from 'lucide-react';

export default function ScanPage() {
  const params = useParams();
  const productId = params?.productId;

  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [shopName, setShopName] = useState('');
  const [error, setError] = useState('');

  // 在庫変更モーダル
  const [showDecrementModal, setShowDecrementModal] = useState(false);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  async function loadProduct() {
    setIsLoading(true);
    setError('');
    try {
      // 公開なので Supabase クライアント（匿名）で取得
      const { data: productData, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, image_url, stock, category, tenant_id, is_active, restock_allowed')
        .eq('id', productId)
        .eq('is_active', true)
        .single();
      if (prodErr || !productData) {
        setError('商品が見つかりません');
        return;
      }
      setProduct(productData);

      // 店舗名取得
      const { data: settingsRow } = await supabase
        .from('app_settings')
        .select('settings_data')
        .eq('id', productData.tenant_id)
        .single();
      const settings = settingsRow?.settings_data || {};
      setShopName(settings.shops?.[0]?.name || settings.generalConfig?.appName || 'お花屋さん');
    } catch (e) {
      setError(e.message || '読み込み失敗');
    } finally {
      setIsLoading(false);
    }
  }

  function openDecrementModal() {
    setQty(1);
    setNote('');
    setPin('');
    setMessage(null);
    setShowDecrementModal(true);
  }

  async function handleSubmit() {
    if (qty < 1 || !pin || pin.length !== 4) return;
    setIsProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/scan/decrement-with-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          pin,
          qty,
          note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.error || '処理失敗' });
        setPin('');
        return;
      }
      setMessage({
        type: 'success',
        text: `${data.staffName}が ${data.productName}を ${data.decrementedQty}個 販売しました\n残り在庫: ${data.newStock}個`,
      });
      // 在庫表示を更新
      setProduct({ ...product, stock: data.newStock });
      setPin('');
      setNote('');
      setQty(1);
      // 2秒後にモーダルを閉じる
      setTimeout(() => {
        setShowDecrementModal(false);
        setMessage(null);
      }, 2500);
    } catch (e) {
      setMessage({ type: 'error', text: e.message || '処理失敗' });
    } finally {
      setIsProcessing(false);
    }
  }

  // ローディング
  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#FBFAF9] flex flex-col items-center justify-center font-sans p-6">
        <Loader2 size={32} className="animate-spin text-[#2D4B3E]" />
        <p className="text-[12px] text-[#999] mt-4">読み込み中...</p>
      </main>
    );
  }

  // エラー
  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#FBFAF9] flex flex-col items-center justify-center font-sans p-6">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-[16px] font-bold text-[#111] mb-2">商品が見つかりません</h1>
        <p className="text-[12px] text-[#555] text-center mb-6 max-w-sm">{error}</p>
        <button onClick={loadProduct} className="px-5 h-11 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold flex items-center gap-2">
          <RefreshCw size={14}/> 再読み込み
        </button>
      </main>
    );
  }

  const isOutOfStock = product.stock === 0;
  const stockColor = product.stock === 0 ? 'red' : product.stock <= 3 ? 'amber' : 'green';

  return (
    <main className="min-h-screen bg-[#FBFAF9] font-sans pb-16">
      {/* ヘッダー */}
      <header className="bg-white border-b border-[#EAEAEA] px-4 py-3 sticky top-0 z-10">
        <p className="text-[10px] font-bold text-[#999] tracking-widest">在庫確認</p>
        <p className="text-[13px] font-bold text-[#2D4B3E]">{shopName}</p>
      </header>

      <div className="max-w-[500px] mx-auto p-4 space-y-4">
        {/* 商品情報 */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden">
          {product.image_url ? (
            <div className="aspect-square bg-[#FBFAF9]">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-square bg-[#FBFAF9] flex items-center justify-center">
              <Package size={48} className="text-[#CCC]" />
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

            {/* 在庫表示（大きく目立つ） */}
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
                <p className="text-[10px] text-amber-600 mt-2 flex items-center justify-center gap-1"><AlertTriangle size={10}/> 在庫わずか</p>
              )}
              {isOutOfStock && product.restock_allowed && (
                <p className="text-[10px] text-red-600 mt-2">再入荷待ち</p>
              )}
            </div>
          </div>
        </div>

        {/* スタッフ操作（在庫を減らすボタン） */}
        {!isOutOfStock && (
          <button
            onClick={openDecrementModal}
            className="w-full h-14 bg-amber-600 text-white rounded-2xl text-[14px] font-bold hover:bg-amber-700 flex items-center justify-center gap-2 shadow-md"
          >
            <Lock size={16} /> 店頭販売で在庫を減らす（スタッフ）
          </button>
        )}

        {/* リロードボタン */}
        <button
          onClick={loadProduct}
          className="w-full h-11 bg-white border border-[#EAEAEA] text-[#555] rounded-xl text-[12px] font-bold hover:border-[#2D4B3E] flex items-center justify-center gap-2"
        >
          <RefreshCw size={14}/> 最新の在庫を確認
        </button>

        <p className="text-[10px] text-[#999] text-center leading-relaxed">
          在庫変更にはスタッフのPINコードが必要です。<br/>
          一般のお客様は確認のみご利用いただけます。
        </p>
      </div>

      {/* PIN入力モーダル */}
      {showDecrementModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !isProcessing && setShowDecrementModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#EAEAEA] p-4 flex justify-between items-center rounded-t-2xl">
              <h3 className="text-[15px] font-bold text-amber-900 flex items-center gap-2">
                <Lock size={16}/> スタッフ認証が必要
              </h3>
              {!isProcessing && (
                <button onClick={() => setShowDecrementModal(false)} className="text-[#999] hover:text-[#111]">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="p-6 space-y-4">
              {/* 商品概要 */}
              <div className="bg-[#FBFAF9] rounded-xl p-3 flex items-center gap-3">
                {product.image_url && (
                  <img src={product.image_url} alt="" className="w-12 h-12 object-cover rounded-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[#111] truncate">{product.name}</p>
                  <p className="text-[10px] text-[#999]">現在の在庫: <span className="font-bold text-[#2D4B3E]">{product.stock}個</span></p>
                </div>
              </div>

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
              </div>

              {/* メモ（任意） */}
              <div>
                <label className="text-[11px] font-bold text-[#999] block mb-2">メモ（任意）</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例: 田中様ご来店"
                  disabled={isProcessing}
                  className="w-full h-11 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] focus:border-amber-500 outline-none"
                />
              </div>

              {/* PINコード入力 */}
              <div>
                <label className="text-[11px] font-bold text-amber-900 block mb-2 flex items-center gap-1">
                  <Lock size={12}/> あなたのスタッフPIN（4桁）
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && qty >= 1 && pin.length === 4) handleSubmit();
                  }}
                  autoFocus
                  disabled={isProcessing}
                  placeholder="••••"
                  className="w-full h-16 text-center text-[36px] font-bold tracking-[0.6em] bg-amber-50 border-2 border-amber-200 rounded-xl outline-none focus:border-amber-500 font-mono"
                />
                <p className="text-[10px] text-[#999] mt-1">設定 → スタッフ管理 で登録した4桁PIN</p>
              </div>

              {/* メッセージ */}
              {message && (
                <div className={`rounded-xl p-3 text-[12px] font-bold whitespace-pre-line ${
                  message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {message.text}
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowDecrementModal(false)}
                  disabled={isProcessing}
                  className="flex-1 h-12 bg-[#EAEAEA] text-[#555] rounded-xl text-[12px] font-bold disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isProcessing || qty < 1 || qty > product.stock || pin.length !== 4}
                  className="flex-1 h-12 bg-amber-600 text-white rounded-xl text-[12px] font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <><Loader2 size={14} className="animate-spin" /> 処理中...</>
                  ) : (
                    <><CheckCircle2 size={14} /> 認証して販売</>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-[#999] leading-relaxed text-center pt-1">
                ※ レジ機能ではありません。POSレジは普段通りご利用ください。<br/>
                ※ 操作は全て監査ログに記録されます。
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
