'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { ShoppingCart, Plus, Minus, Package, X, ChevronLeft, Search, Sparkles, Bell, CheckCircle2 } from 'lucide-react';
import { getCart, addToCart, getCartCount } from '@/utils/cart';

export default function ShopCatalogPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';

  const [appSettings, setAppSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [addingToast, setAddingToast] = useState(null);
  const [notifyTarget, setNotifyTarget] = useState(null);   // 入荷通知登録モーダルの対象商品

  useEffect(() => {
    loadData();
    refreshCartCount();

    // localStorage の変更を別タブで検知（同タブ内の変更には反応しないので addToCart 直後は手動で refresh）
    const handler = () => refreshCartCount();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [tenantId]);

  function refreshCartCount() {
    setCartCount(getCartCount(tenantId));
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const [settingsRes, productsRes] = await Promise.all([
        supabase.from('app_settings').select('settings_data').eq('id', tenantId).single(),
        // 在庫切れ商品も含めて取得し、UIで「在庫切れ + 通知登録」を出す
        supabase.from('products').select('*').eq('tenant_id', tenantId).eq('is_active', true).order('display_order', { ascending: true })
      ]);
      if (settingsRes.data?.settings_data) setAppSettings(settingsRes.data.settings_data);
      // ★ ドライフラワー（一点もの）= restock_allowed が false の在庫0商品は自動非表示
      //    restock_allowed が true の商品は在庫0でも表示し、入荷通知登録を可能にする
      const visibleProducts = (productsRes.data || []).filter(p =>
        Number(p.stock) > 0 || p.restock_allowed === true
      );
      setProducts(visibleProducts);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return ['all', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  function handleAddToCart(product, qty = 1, selectedOptions = null) {
    addToCart(tenantId, {
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url,
      stock: product.stock,
      selectedOptions: selectedOptions || null,  // ★ お客様が選択したオプション
    }, qty);
    refreshCartCount();
    setAddingToast(`「${product.name}」をカートに入れました`);
    setTimeout(() => setAddingToast(null), 2000);
  }

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';
  const targetShop = appSettings?.shops?.find(s => String(s.id) === String(shopId)) || appSettings?.shops?.[0] || { name: appName };

  if (isLoading) {
    return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-sans text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-[1100px] mx-auto h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? <img src={logoUrl} alt={appName} className="h-6 object-contain" /> : <span className="font-serif font-bold text-[18px] text-[#2D4B3E]">{targetShop.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/order/${tenantId}/${shopId}`} className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-[#555555] hover:text-[#2D4B3E] px-2 py-1">
              <Sparkles size={12}/> カスタム注文
            </Link>
            <Link href={`/order/${tenantId}/${shopId}/history`} className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-[#555555] hover:text-[#2D4B3E] px-2 py-1">
              <Search size={12}/> 注文確認
            </Link>
            <Link
              href={`/order/${tenantId}/${shopId}/cart`}
              className="relative flex items-center gap-1.5 h-10 px-4 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all"
            >
              <ShoppingCart size={16} />
              カート
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#D97D54] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 pt-10 space-y-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#2D4B3E]">商品ラインナップ</h1>
          <p className="text-[12px] text-[#555555] mt-1">気に入った商品をカートに追加して、まとめてご注文いただけます。</p>
        </div>

        {/* 検索 & カテゴリ */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="商品名で検索"
              className="w-full h-11 pl-10 pr-4 bg-white border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
            />
          </div>
          {categories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`shrink-0 px-4 h-11 rounded-xl text-[12px] font-bold transition-all ${selectedCategory === c ? 'bg-[#2D4B3E] text-white' : 'bg-white border border-[#EAEAEA] text-[#555555] hover:border-[#2D4B3E]'}`}
                >
                  {c === 'all' ? 'すべて' : c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 商品リスト */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#EAEAEA]">
            <Package size={32} className="mx-auto text-[#CCC] mb-3" />
            <p className="text-[13px] font-bold text-[#999999]">該当する商品がありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map(p => {
              const isOutOfStock = p.stock === 0;
              return (
                <div key={p.id} className={`bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden hover:shadow-md transition-all flex flex-col group ${isOutOfStock ? 'opacity-80' : ''}`}>
                  <button onClick={() => !isOutOfStock && setSelectedProduct(p)} className="block aspect-square bg-[#FBFAF9] relative overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className={`w-full h-full object-cover transition-transform duration-300 ${isOutOfStock ? 'grayscale' : 'group-hover:scale-105'}`} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#CCC]"><Package size={32}/></div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute top-3 left-3 bg-[#111111]/80 text-white text-[10px] font-bold px-2 py-1 rounded">在庫切れ</div>
                    )}
                  </button>
                  <div className="p-4 space-y-2 flex-1 flex flex-col">
                    {p.category && <p className="text-[10px] text-[#999999]">{p.category}</p>}
                    <button onClick={() => !isOutOfStock && setSelectedProduct(p)} className="text-left text-[13px] font-bold text-[#111111] hover:text-[#2D4B3E] line-clamp-2 min-h-[2.6em]">{p.name}</button>
                    <p className="text-[15px] font-bold text-[#2D4B3E]">¥{p.price.toLocaleString()}<span className="text-[10px] font-normal text-[#999999] ml-1">(税抜)</span></p>
                    {isOutOfStock ? (
                      <button
                        onClick={() => setNotifyTarget(p)}
                        className="mt-auto w-full h-10 bg-white border border-[#D97D54] text-[#D97D54] rounded-xl text-[12px] font-bold hover:bg-[#D97D54] hover:text-white transition-all flex items-center justify-center gap-1.5"
                      >
                        <Bell size={14}/> 入荷したら通知
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="mt-auto w-full h-10 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all flex items-center justify-center gap-1.5"
                      >
                        <ShoppingCart size={14}/> 詳細を見てカートへ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 商品詳細モーダル */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(qty, opts) => { handleAddToCart(selectedProduct, qty, opts); setSelectedProduct(null); }}
        />
      )}

      {/* 入荷通知登録モーダル */}
      {notifyTarget && (
        <NotifyModal
          product={notifyTarget}
          tenantId={tenantId}
          onClose={() => setNotifyTarget(null)}
        />
      )}

      {/* カート追加トースト */}
      {addingToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#2D4B3E] text-white px-5 py-3 rounded-xl shadow-lg text-[12px] font-bold animate-in fade-in slide-in-from-bottom-2 z-50">
          {addingToast}
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
        .font-serif { font-family: 'Noto Serif JP', serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function ProductDetailModal({ product, onClose, onAddToCart }) {
  const [qty, setQty] = useState(1);
  const maxQty = product.stock;

  // ★ 画像配列: メイン + 追加（最大5枚）
  const allImages = [
    ...(product.image_url ? [product.image_url] : []),
    ...((Array.isArray(product.image_urls) ? product.image_urls : []).filter(u => typeof u === 'string' && u)),
  ];
  const [imageIdx, setImageIdx] = useState(0);
  const currentImage = allImages[imageIdx] || product.image_url || '';

  // ★ オプション選択状態
  const opts = product.options || {};
  const [wrappingOn, setWrappingOn] = useState(false);
  const [messageCardOn, setMessageCardOn] = useState(false);
  const [messageCardText, setMessageCardText] = useState('');
  const [textInsertionOn, setTextInsertionOn] = useState(false);
  const [textInsertionText, setTextInsertionText] = useState('');
  const [textInsertionPos, setTextInsertionPos] = useState((opts.textInsertion?.positions || [])[0] || '');

  // 文字入れバリデーション
  const tiMax = Number(opts.textInsertion?.maxLength) || 30;
  const tiAllowKanji = Boolean(opts.textInsertion?.allowKanji);
  // 漢字判定: CJK統合漢字
  const hasKanji = /[一-鿿]/.test(textInsertionText);
  const tiError = textInsertionOn ? (
    textInsertionText.length === 0 ? '文字を入力してください' :
    textInsertionText.length > tiMax ? `${tiMax}文字以内で入力してください` :
    (!tiAllowKanji && hasKanji) ? '漢字は使用できません' :
    !textInsertionPos ? '文字入れ位置を選択してください' : ''
  ) : '';

  // 追加金額の合計
  const wrappingPrice = wrappingOn ? (Number(opts.wrapping?.price) || 0) : 0;
  const messageCardPrice = messageCardOn ? (Number(opts.messageCard?.price) || 0) : 0;
  const textInsertionPrice = textInsertionOn ? (Number(opts.textInsertion?.price) || 0) : 0;
  const optionsTotal = wrappingPrice + messageCardPrice + textInsertionPrice;
  const totalPerUnit = product.price + optionsTotal;

  const handleSubmit = () => {
    if (textInsertionOn && tiError) {
      alert(tiError);
      return;
    }
    const selectedOptions = {
      wrapping: wrappingOn ? { price: wrappingPrice } : null,
      messageCard: messageCardOn ? { price: messageCardPrice, text: messageCardText } : null,
      textInsertion: textInsertionOn ? { price: textInsertionPrice, text: textInsertionText, position: textInsertionPos } : null,
    };
    onAddToCart(qty, selectedOptions);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#EAEAEA] p-4 flex justify-between items-center">
          <h3 className="text-[14px] font-bold text-[#2D4B3E]">商品詳細</h3>
          <button onClick={onClose} className="text-[#999999] hover:text-[#111111]"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              {/* メイン画像 */}
              <div className="aspect-square bg-[#FBFAF9] rounded-2xl overflow-hidden">
                {currentImage ? <img src={currentImage} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#CCC]"><Package size={48}/></div>}
              </div>
              {/* サムネイル（複数画像がある場合） */}
              {allImages.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setImageIdx(i)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${i === imageIdx ? 'border-[#2D4B3E]' : 'border-transparent hover:border-[#EAEAEA]'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover"/>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              {product.category && <p className="text-[10px] text-[#999999]">{product.category}</p>}
              <h2 className="text-[20px] font-bold text-[#111111]">{product.name}</h2>
              <p className="text-[26px] font-bold text-[#2D4B3E]">¥{product.price.toLocaleString()}<span className="text-[11px] font-normal text-[#999999] ml-1">(税抜)</span></p>
              <p className="text-[12px] text-[#555555] leading-relaxed whitespace-pre-wrap">{product.description || '—'}</p>
              <p className="text-[11px] text-[#999999]">在庫: <span className="font-bold text-[#555555]">{product.stock}</span></p>
            </div>
          </div>

          {/* ★ オプション選択 */}
          {(opts.wrapping?.enabled || opts.messageCard?.enabled || opts.textInsertion?.enabled) && (
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-5 space-y-4">
              <p className="text-[13px] font-bold text-pink-900">🎀 オプション</p>

              {opts.wrapping?.enabled && (
                <label className="flex items-start gap-3 cursor-pointer bg-white p-3 rounded-lg border border-pink-100">
                  <input type="checkbox" checked={wrappingOn} onChange={(e) => setWrappingOn(e.target.checked)} className="mt-0.5 w-5 h-5 accent-pink-600" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#111111]">🎁 ラッピング</span>
                    <span className="text-[12px] font-bold text-pink-700">+¥{(Number(opts.wrapping?.price)||0).toLocaleString()}</span>
                  </div>
                </label>
              )}

              {opts.messageCard?.enabled && (
                <div className="bg-white p-3 rounded-lg border border-pink-100">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={messageCardOn} onChange={(e) => setMessageCardOn(e.target.checked)} className="mt-0.5 w-5 h-5 accent-pink-600" />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-[#111111]">💌 メッセージカード（紙）</span>
                      <span className="text-[12px] font-bold text-pink-700">{(Number(opts.messageCard?.price)||0) === 0 ? '無料' : `+¥${(Number(opts.messageCard?.price)||0).toLocaleString()}`}</span>
                    </div>
                  </label>
                  {messageCardOn && (
                    <div className="mt-3 ml-8">
                      <textarea
                        value={messageCardText}
                        onChange={(e) => setMessageCardText(e.target.value)}
                        placeholder="メッセージ内容（任意）"
                        className="w-full h-20 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] resize-none focus:border-pink-600 outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {opts.textInsertion?.enabled && (
                <div className="bg-white p-3 rounded-lg border border-pink-100">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={textInsertionOn} onChange={(e) => setTextInsertionOn(e.target.checked)} className="mt-0.5 w-5 h-5 accent-pink-600" />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-[#111111]">✍️ 文字入れ</span>
                      <span className="text-[12px] font-bold text-pink-700">+¥{(Number(opts.textInsertion?.price)||0).toLocaleString()}</span>
                    </div>
                  </label>
                  {textInsertionOn && (
                    <div className="mt-3 ml-8 space-y-3">
                      <div>
                        <label className="text-[11px] font-bold text-[#555555] block mb-1">
                          入れる文字（{tiMax}文字まで{tiAllowKanji ? '' : '・漢字不可'}）
                        </label>
                        <input
                          type="text"
                          value={textInsertionText}
                          onChange={(e) => setTextInsertionText(e.target.value)}
                          maxLength={tiMax}
                          placeholder={tiAllowKanji ? '例: お誕生日おめでとう' : '例: 2025.7.18'}
                          className="w-full h-10 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold focus:border-pink-600 outline-none"
                        />
                        <p className="text-[10px] text-[#999999] mt-1">{textInsertionText.length} / {tiMax}文字</p>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[#555555] block mb-1">文字入れ位置</label>
                        <div className="flex gap-2 flex-wrap">
                          {(opts.textInsertion?.positions || []).map(pos => (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => setTextInsertionPos(pos)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all ${textInsertionPos === pos ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-[#555555] border-[#EAEAEA] hover:border-pink-300'}`}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                      </div>
                      {tiError && (
                        <p className="text-[11px] font-bold text-red-600">⚠️ {tiError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-[#F0F0F0] space-y-3">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-bold text-[#999999]">個数:</p>
              <div className="flex items-center bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 text-[#555555] hover:bg-white rounded-l-xl">
                  <Minus size={14} className="mx-auto" />
                </button>
                <span className="w-12 text-center font-bold">{qty}</span>
                <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-10 h-10 text-[#555555] hover:bg-white rounded-r-xl">
                  <Plus size={14} className="mx-auto" />
                </button>
              </div>
            </div>
            {optionsTotal > 0 && (
              <div className="bg-[#FBFAF9] rounded-xl p-3 text-[12px] space-y-1">
                <div className="flex justify-between"><span className="text-[#555555]">商品代</span><span className="font-bold">¥{(product.price * qty).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-[#555555]">オプション (×{qty})</span><span className="font-bold text-pink-700">+¥{(optionsTotal * qty).toLocaleString()}</span></div>
                <div className="flex justify-between pt-1 border-t border-[#EAEAEA]"><span className="font-bold text-[#111111]">小計</span><span className="font-bold text-[#2D4B3E]">¥{(totalPerUnit * qty).toLocaleString()}</span></div>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={textInsertionOn && Boolean(tiError)}
              className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold hover:bg-[#1f352b] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart size={16}/> {qty}個をカートに追加（¥{(totalPerUnit * qty).toLocaleString()}）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ★ 入荷通知登録モーダル
function NotifyModal({ product, tenantId, onClose }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/stock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, productId: product.id, email: email.trim(), customerName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登録に失敗しました');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#EAEAEA] p-4 flex justify-between items-center">
          <h3 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Bell size={16}/> 入荷通知の登録</h3>
          <button onClick={onClose} className="text-[#999999] hover:text-[#111111]"><X size={18}/></button>
        </div>
        <div className="p-6">
          {done ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 size={40} className="mx-auto text-green-500" />
              <p className="text-[13px] font-bold text-[#111111]">登録完了しました</p>
              <p className="text-[12px] text-[#555555] leading-relaxed">
                「{product.name}」が入荷次第、メールにてお知らせいたします。
              </p>
              <button onClick={onClose} className="mt-4 px-6 h-10 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold">閉じる</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] flex gap-3">
                {product.image_url && <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-lg object-cover"/>}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#111111] truncate">{product.name}</p>
                  <p className="text-[11px] text-[#D97D54] mt-0.5">在庫切れ中</p>
                </div>
              </div>
              <p className="text-[12px] text-[#555555] leading-relaxed">
                こちらの商品が入荷した際にメールでお知らせいたします。
              </p>
              <div className="space-y-2">
                <input type="text" placeholder="お名前（任意）" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />
                <input type="email" required placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />
              </div>
              {error && <p className="text-red-500 text-[11px] font-bold">{error}</p>}
              <button type="submit" disabled={isSubmitting}
                className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold hover:bg-[#1f352b] disabled:opacity-50">
                {isSubmitting ? '送信中...' : '通知を登録する'}
              </button>
              <p className="text-[10px] text-[#999999] text-center">※ご登録後の連絡先変更・解除は店舗までご連絡ください</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
