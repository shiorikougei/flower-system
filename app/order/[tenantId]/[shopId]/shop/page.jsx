'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { ShoppingCart, Plus, Minus, Package, X, ChevronLeft, Search } from 'lucide-react';
import { getCart, addToCart, getCartCount } from '@/utils/cart';

export default function ShopCatalogPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.tenantId || 'default';
  const shopId = params?.shopId || 'default';

  const [appSettings, setAppSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [addingToast, setAddingToast] = useState(null);

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
        // is_active=true & stock>0 のもののみ表示（公開ポリシーで自動制限される）
        supabase.from('products').select('*').eq('tenant_id', tenantId).eq('is_active', true).gt('stock', 0).order('display_order', { ascending: true })
      ]);
      if (settingsRes.data?.settings_data) setAppSettings(settingsRes.data.settings_data);
      setProducts(productsRes.data || []);
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

  function handleAddToCart(product, qty = 1) {
    addToCart(tenantId, { id: product.id, name: product.name, price: product.price, imageUrl: product.image_url, stock: product.stock }, qty);
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
          <div className="flex items-center gap-3">
            <Link href={`/order/${tenantId}/${shopId}`} className="text-[12px] font-bold text-[#555555] hover:text-[#2D4B3E]">
              カスタム注文
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
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden hover:shadow-md transition-all flex flex-col group">
                <button onClick={() => setSelectedProduct(p)} className="block aspect-square bg-[#FBFAF9] relative overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#CCC]"><Package size={32}/></div>
                  )}
                </button>
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  {p.category && <p className="text-[10px] text-[#999999]">{p.category}</p>}
                  <button onClick={() => setSelectedProduct(p)} className="text-left text-[13px] font-bold text-[#111111] hover:text-[#2D4B3E] line-clamp-2 min-h-[2.6em]">{p.name}</button>
                  <p className="text-[15px] font-bold text-[#2D4B3E]">¥{p.price.toLocaleString()}<span className="text-[10px] font-normal text-[#999999] ml-1">(税抜)</span></p>
                  <button
                    onClick={() => handleAddToCart(p, 1)}
                    className="mt-auto w-full h-10 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14}/> カートに入れる
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 商品詳細モーダル */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(qty) => { handleAddToCart(selectedProduct, qty); setSelectedProduct(null); }}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#EAEAEA] p-4 flex justify-between items-center">
          <h3 className="text-[14px] font-bold text-[#2D4B3E]">商品詳細</h3>
          <button onClick={onClose} className="text-[#999999] hover:text-[#111111]"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="aspect-square bg-[#FBFAF9] rounded-2xl overflow-hidden">
              {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#CCC]"><Package size={48}/></div>}
            </div>
            <div className="space-y-4">
              {product.category && <p className="text-[10px] text-[#999999]">{product.category}</p>}
              <h2 className="text-[20px] font-bold text-[#111111]">{product.name}</h2>
              <p className="text-[26px] font-bold text-[#2D4B3E]">¥{product.price.toLocaleString()}<span className="text-[11px] font-normal text-[#999999] ml-1">(税抜)</span></p>
              <p className="text-[12px] text-[#555555] leading-relaxed whitespace-pre-wrap">{product.description || '—'}</p>
              <p className="text-[11px] text-[#999999]">在庫: <span className="font-bold text-[#555555]">{product.stock}</span></p>

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
                <button onClick={() => onAddToCart(qty)} className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold hover:bg-[#1f352b] flex items-center justify-center gap-2">
                  <ShoppingCart size={16}/> {qty}個をカートに追加
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
