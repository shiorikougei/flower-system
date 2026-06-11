// 商品個別ページのクライアントUI
// SEO用のコンテンツ豊富なページ + カート追加機能

"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import {
  ShoppingCart, Plus, Minus, ChevronLeft, Package,
  Truck, Store, CreditCard, ShieldCheck, AlertCircle,
  CheckCircle2, X, Loader2,
} from "lucide-react";
import { addToCart } from "@/utils/cart";
import { getCurrentStaff } from "@/utils/staffRole";

export default function ProductDetailClient({ product: initialProduct, shop, tenantId }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [product, setProduct] = useState(initialProduct);

  // [POS-#25] スタッフモード判定（Supabase Authでログイン中か）
  const [isStaff, setIsStaff] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [showStoreSaleModal, setShowStoreSaleModal] = useState(false);
  const [storeSaleQty, setStoreSaleQty] = useState(1);
  const [storeSaleNote, setStoreSaleNote] = useState("");
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [storeSaleMessage, setStoreSaleMessage] = useState(null);

  useEffect(() => {
    // ログイン中のスタッフ判定
    async function checkStaff() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsStaff(true);
          const cur = getCurrentStaff();
          setStaffName(cur?.name || "スタッフ");
        }
      } catch {}
    }
    checkStaff();
  }, []);

  // 在庫減算（店頭販売）
  async function handleStoreSale() {
    if (storeSaleQty < 1) return;
    setIsProcessingSale(true);
    setStoreSaleMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStoreSaleMessage({ type: "error", text: "認証エラー: 再ログインしてください" });
        return;
      }
      const res = await fetch("/api/staff/decrement-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: product.id,
          qty: storeSaleQty,
          note: storeSaleNote || null,
          staffName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStoreSaleMessage({ type: "error", text: data.error || "処理失敗" });
        return;
      }
      setStoreSaleMessage({
        type: "success",
        text: `✅ ${data.productName} を ${data.decrementedQty}個 店頭販売しました\n（残り在庫: ${data.newStock}個）`,
      });
      // 在庫表示を更新
      setProduct({ ...product, stock: data.newStock });
      setStoreSaleQty(1);
      setStoreSaleNote("");
      setTimeout(() => {
        setShowStoreSaleModal(false);
        setStoreSaleMessage(null);
      }, 2500);
    } catch (e) {
      setStoreSaleMessage({ type: "error", text: e.message || "処理失敗" });
    } finally {
      setIsProcessingSale(false);
    }
  }

  const shopId = String(shop.id || "default");
  const allImages = [
    ...(product.image_url ? [product.image_url] : []),
    ...(Array.isArray(product.image_urls) ? product.image_urls.filter(u => typeof u === "string" && u) : []),
  ];
  const currentImage = allImages[selectedImage] || product.image_url || "";

  const isOutOfStock = product.stock === 0;
  const inStock = product.stock > 0;

  function handleAddToCart() {
    addToCart(tenantId, {
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url,
      stock: product.stock,
      selectedOptions: null,
    }, qty);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  }

  return (
    <main className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-[1100px] mx-auto h-16 px-6 flex items-center justify-between">
          <Link
            href={`/order/${tenantId}/${shopId}/shop`}
            className="flex items-center gap-1 text-[12px] font-bold text-[#555555] hover:text-[#2D4B3E]"
          >
            <ChevronLeft size={16} /> 商品一覧に戻る
          </Link>
          <span className="font-serif font-bold text-[16px] text-[#2D4B3E]">
            {shop.name || "FLORIX"}
          </span>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto p-6 md:p-8">
        {/* パンくず */}
        <nav className="text-[11px] text-[#999] mb-4 space-x-1" aria-label="パンくずリスト">
          <Link href={`/order/${tenantId}/${shopId}`} className="hover:text-[#2D4B3E]">{shop.name || "ホーム"}</Link>
          <span>/</span>
          <Link href={`/order/${tenantId}/${shopId}/shop`} className="hover:text-[#2D4B3E]">商品一覧</Link>
          <span>/</span>
          <span className="text-[#555]">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 画像エリア */}
          <div className="space-y-3">
            <div className="aspect-square bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={`${product.name} - ${shop.name || "FLORIX"}`}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#CCC]">
                  <Package size={48} />
                </div>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      i === selectedImage ? "border-[#2D4B3E]" : "border-transparent hover:border-[#EAEAEA]"
                    }`}
                    aria-label={`画像${i + 1}を表示`}
                  >
                    <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 情報エリア */}
          <div className="space-y-5">
            {product.category && (
              <p className="text-[11px] text-[#999] font-bold">{product.category}</p>
            )}
            <h1 className="text-[24px] md:text-[28px] font-bold text-[#111]">{product.name}</h1>

            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold text-[#2D4B3E]">
                ¥{Number(product.price).toLocaleString()}
              </span>
              <span className="text-[12px] font-bold text-[#999]">(税抜)</span>
            </div>

            {/* 在庫表示 */}
            <div>
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold">
                  <AlertCircle size={12} /> 在庫切れ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[11px] font-bold">
                  在庫あり（{product.stock}点）
                </span>
              )}
            </div>

            {/* 説明文（SEO最重要） */}
            {product.description && (
              <div className="bg-white border border-[#EAEAEA] rounded-xl p-4">
                <h2 className="text-[12px] font-bold text-[#999] mb-2">商品説明</h2>
                <p className="text-[13px] text-[#333] leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}

            {/* 個数+カートボタン */}
            {!isOutOfStock && (
              <div className="bg-white border border-[#EAEAEA] rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-bold text-[#999]">個数:</p>
                  <div className="flex items-center bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 hover:bg-white rounded-l-xl">
                      <Minus size={14} className="mx-auto" />
                    </button>
                    <span className="w-12 text-center font-bold">{qty}</span>
                    <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="w-10 h-10 hover:bg-white rounded-r-xl">
                      <Plus size={14} className="mx-auto" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold hover:bg-[#1f352b] flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={16} /> {qty}個をカートに追加 ¥{(product.price * qty).toLocaleString()}
                </button>
                {addedToCart && (
                  <Link
                    href={`/order/${tenantId}/${shopId}/cart`}
                    className="block w-full h-12 leading-[48px] text-center bg-green-600 text-white rounded-xl text-[13px] font-bold hover:bg-green-700"
                  >
                    ✅ カートに追加しました→確認する
                  </Link>
                )}
              </div>
            )}

            {/* [POS-#25] スタッフ専用: 店頭販売ボタン（ログイン中のスタッフのみ表示） */}
            {isStaff && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-amber-600 text-white px-2 py-0.5 rounded-md">👤 スタッフ専用</span>
                  <span className="text-[11px] text-amber-700">{staffName}でログイン中</span>
                </div>
                <button
                  onClick={() => { setStoreSaleQty(1); setStoreSaleNote(""); setStoreSaleMessage(null); setShowStoreSaleModal(true); }}
                  disabled={product.stock === 0}
                  className="w-full h-12 bg-amber-600 text-white rounded-xl text-[13px] font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  📦 店頭販売で在庫を減らす
                </button>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  ※ レジ機能ではありません。EC在庫を実店舗販売分と合わせて管理するためのボタンです。<br/>
                  ※ POS（U-Reji、Airレジ等）はそのままご利用ください。
                </p>
              </div>
            )}

            {/* 店舗情報・配送・安心ポイント（SEO + 信頼性） */}
            <div className="bg-white border border-[#EAEAEA] rounded-2xl p-4 space-y-3 text-[12px]">
              <h2 className="font-bold text-[#2D4B3E] flex items-center gap-2">
                <ShieldCheck size={14} /> お買い物の安心ポイント
              </h2>
              <ul className="space-y-1.5 text-[#555]">
                <li className="flex items-start gap-2">
                  <Store size={12} className="text-[#2D4B3E] mt-0.5 shrink-0" />
                  <span>{shop.name || "当店"}が新鮮な状態でお届けします</span>
                </li>
                <li className="flex items-start gap-2">
                  <Truck size={12} className="text-[#2D4B3E] mt-0.5 shrink-0" />
                  <span>{shop.address || "全国"}より丁寧に配送</span>
                </li>
                <li className="flex items-start gap-2">
                  <CreditCard size={12} className="text-[#2D4B3E] mt-0.5 shrink-0" />
                  <span>クレジットカード・銀行振込に対応</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 関連リンク（SEO内部リンク） */}
        <div className="mt-12 pt-8 border-t border-[#EAEAEA]">
          <h2 className="text-[14px] font-bold text-[#2D4B3E] mb-4">こちらもご覧ください</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link
              href={`/order/${tenantId}/${shopId}/shop`}
              className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] transition-all"
            >
              <p className="text-[12px] font-bold text-[#2D4B3E]">🌸 他の商品を見る</p>
              <p className="text-[10px] text-[#999] mt-1">EC商品一覧</p>
            </Link>
            <Link
              href={`/order/${tenantId}/${shopId}/custom`}
              className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] transition-all"
            >
              <p className="text-[12px] font-bold text-[#2D4B3E]">✨ カスタム注文</p>
              <p className="text-[10px] text-[#999] mt-1">用途・色・予算に合わせて</p>
            </Link>
            <Link
              href={`/order/${tenantId}/${shopId}/estimate`}
              className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] transition-all"
            >
              <p className="text-[12px] font-bold text-[#2D4B3E]">💬 見積もり依頼</p>
              <p className="text-[10px] text-[#999] mt-1">スタッフが提案</p>
            </Link>
          </div>
        </div>
      </div>

      {/* [POS-#25] 店頭販売モーダル */}
      {showStoreSaleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !isProcessingSale && setShowStoreSaleModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#EAEAEA] p-4 flex justify-between items-center rounded-t-2xl">
              <h3 className="text-[15px] font-bold text-amber-900 flex items-center gap-2">
                📦 店頭販売で在庫を減らす
              </h3>
              {!isProcessingSale && (
                <button onClick={() => setShowStoreSaleModal(false)} className="text-[#999] hover:text-[#111]">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="p-6 space-y-4">
              {/* 商品情報 */}
              <div className="bg-[#FBFAF9] rounded-xl p-3 flex items-center gap-3">
                {product.image_url && (
                  <img src={product.image_url} alt={product.name} className="w-14 h-14 object-cover rounded-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#111] truncate">{product.name}</p>
                  <p className="text-[11px] text-[#999]">現在の在庫: <span className="font-bold text-[#2D4B3E]">{product.stock}個</span></p>
                </div>
              </div>

              {/* 販売数量 */}
              <div>
                <label className="text-[11px] font-bold text-[#999] block mb-2">販売数量</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStoreSaleQty(Math.max(1, storeSaleQty - 1))}
                    disabled={isProcessingSale}
                    className="w-12 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl hover:bg-white disabled:opacity-50"
                  >
                    <Minus size={16} className="mx-auto" />
                  </button>
                  <input
                    type="number"
                    value={storeSaleQty}
                    onChange={(e) => setStoreSaleQty(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
                    min={1}
                    max={product.stock}
                    disabled={isProcessingSale}
                    className="flex-1 h-12 text-center text-[20px] font-bold bg-[#FBFAF9] border-2 border-[#EAEAEA] rounded-xl focus:border-amber-500 outline-none"
                  />
                  <button
                    onClick={() => setStoreSaleQty(Math.min(product.stock, storeSaleQty + 1))}
                    disabled={isProcessingSale}
                    className="w-12 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl hover:bg-white disabled:opacity-50"
                  >
                    <Plus size={16} className="mx-auto" />
                  </button>
                </div>
                <p className="text-[10px] text-[#999] mt-1">最大 {product.stock}個まで</p>
              </div>

              {/* メモ（任意） */}
              <div>
                <label className="text-[11px] font-bold text-[#999] block mb-2">メモ（任意）</label>
                <input
                  type="text"
                  value={storeSaleNote}
                  onChange={(e) => setStoreSaleNote(e.target.value)}
                  placeholder="例: お友達の田中様、ご来店"
                  disabled={isProcessingSale}
                  className="w-full h-11 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] focus:border-amber-500 outline-none"
                />
                <p className="text-[10px] text-[#999] mt-1">後で監査ログから振り返れます</p>
              </div>

              {/* メッセージ */}
              {storeSaleMessage && (
                <div className={`rounded-xl p-3 text-[12px] font-bold whitespace-pre-line ${
                  storeSaleMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {storeSaleMessage.text}
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowStoreSaleModal(false)}
                  disabled={isProcessingSale}
                  className="flex-1 h-12 bg-[#EAEAEA] text-[#555] rounded-xl text-[12px] font-bold disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleStoreSale}
                  disabled={isProcessingSale || storeSaleQty < 1 || storeSaleQty > product.stock}
                  className="flex-1 h-12 bg-amber-600 text-white rounded-xl text-[12px] font-bold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessingSale ? (
                    <><Loader2 size={14} className="animate-spin" /> 処理中...</>
                  ) : (
                    <><CheckCircle2 size={14} /> {storeSaleQty}個 販売した</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
