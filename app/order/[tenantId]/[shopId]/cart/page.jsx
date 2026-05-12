'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { ShoppingCart, Plus, Minus, Trash2, ChevronLeft, Package, AlertCircle } from 'lucide-react';
import { getCart, updateQty, removeFromCart, getCartTotal } from '@/utils/cart';

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.tenantId || 'default';
  const shopId = params?.shopId || 'default';

  const [cart, setCart] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '', zip: '', address1: '', address2: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCart(getCart(tenantId));
    loadSettings();
  }, [tenantId]);

  async function loadSettings() {
    try {
      const { data } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      if (data?.settings_data) {
        setAppSettings(data.settings_data);
        const s = data.settings_data.stripe;
        setStripeEnabled(Boolean(s?.accountId && s?.chargesEnabled));
      }
    } catch (e) {}
  }

  function refresh() {
    setCart(getCart(tenantId));
  }

  function handleQtyChange(itemId, newQty) {
    updateQty(tenantId, itemId, newQty);
    refresh();
  }

  function handleRemove(itemId) {
    if (!confirm('カートから削除しますか？')) return;
    removeFromCart(tenantId, itemId);
    refresh();
  }

  const fetchAddress = async (zip) => {
    if (zip.length !== 7) return;
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      const data = await res.json();
      if (data.results?.[0]) {
        const a = data.results[0];
        setCustomerInfo(prev => ({ ...prev, address1: `${a.address1}${a.address2}${a.address3}` }));
      }
    } catch (e) {}
  };

  const subTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = Math.floor(subTotal * 0.1);
  const totalAmount = subTotal + tax;

  function validate() {
    if (cart.length === 0) return 'カートが空です';
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.email) return 'お客様情報を入力してください';
    if (!paymentMethod) return 'お支払い方法を選択してください';
    return '';
  }

  async function handleCheckout() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setIsSubmitting(true);
    try {
      const orderPayload = {
        shopId,
        // EC注文であることを示すフラグ
        orderType: 'ec',
        cartItems: cart.map(c => ({ productId: c.id, name: c.name, price: c.price, qty: c.qty, imageUrl: c.imageUrl })),
        itemPrice: subTotal,            // 既存ロジックとの互換
        calculatedFee: 0,
        pickupFee: 0,
        feeBreakdown: { baseFee: 0, boxFee: 0, coolFee: 0 },
        customerInfo,
        isRecipientDifferent: false,
        recipientInfo: { name: '', phone: '', zip: '', address1: '', address2: '' },
        status: 'new',
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, shopId, orderData: orderPayload, paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注文の送信に失敗しました');

      // 成功したらカートをクリア
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`florix_cart_${tenantId}`);
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push(`/order/${tenantId}/${shopId}/thanks?order_id=${data.orderId}&from=ec`);
      }
    } catch (e) {
      setError(e.message);
      setIsSubmitting(false);
    }
  }

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';
  const targetShop = appSettings?.shops?.find(s => String(s.id) === String(shopId)) || appSettings?.shops?.[0] || { name: appName };

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-[800px] mx-auto h-16 px-6 flex items-center justify-between">
          <Link href={`/order/${tenantId}/${shopId}/shop`} className="flex items-center gap-1 text-[12px] font-bold text-[#555555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 商品一覧に戻る
          </Link>
          <div className="flex items-center gap-3">
            {logoUrl ? <img src={logoUrl} alt={appName} className="h-6 object-contain" /> : <span className="font-serif font-bold text-[16px] text-[#2D4B3E]">{targetShop.name}</span>}
          </div>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 pt-8 space-y-8">
        <h1 className="text-[24px] font-bold text-[#2D4B3E] flex items-center gap-3"><ShoppingCart size={24}/>カート</h1>

        {cart.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#EAEAEA]">
            <Package size={32} className="mx-auto text-[#CCC] mb-3" />
            <p className="text-[13px] font-bold text-[#999999]">カートは空です</p>
            <Link href={`/order/${tenantId}/${shopId}/shop`} className="inline-block mt-4 px-5 h-11 leading-[44px] bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold">
              商品を見に行く
            </Link>
          </div>
        ) : (
          <>
            {/* カート商品リスト */}
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-[#EAEAEA] flex gap-4">
                  <div className="w-20 h-20 shrink-0 bg-[#FBFAF9] rounded-xl overflow-hidden">
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#CCC]"><Package size={20}/></div>}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-[13px] font-bold text-[#111111] truncate">{item.name}</p>
                    <p className="text-[13px] font-bold text-[#2D4B3E]">¥{item.price.toLocaleString()}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-[#FBFAF9] rounded-lg border border-[#EAEAEA]">
                        <button onClick={() => handleQtyChange(item.id, item.qty - 1)} className="w-8 h-8 text-[#555555] hover:bg-white"><Minus size={12} className="mx-auto"/></button>
                        <span className="w-8 text-center text-[12px] font-bold">{item.qty}</span>
                        <button onClick={() => handleQtyChange(item.id, item.qty + 1)} className="w-8 h-8 text-[#555555] hover:bg-white"><Plus size={12} className="mx-auto"/></button>
                      </div>
                      <button onClick={() => handleRemove(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 小計 */}
            <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-2">
              <div className="flex justify-between text-[13px] text-[#555555]"><span>商品代（税抜）</span><span>¥{subTotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-[12px] text-[#999999] pt-2 border-t border-[#F0F0F0]"><span>消費税（10%）</span><span>¥{tax.toLocaleString()}</span></div>
              <div className="flex justify-between items-baseline pt-3 border-t border-[#EAEAEA]">
                <span className="text-[13px] font-bold text-[#111111]">合計（税込）</span>
                <span className="text-[20px] font-bold text-[#2D4B3E]">¥{totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* お客様情報 */}
            <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-3">
              <p className="text-[12px] font-bold text-[#555555] mb-3">お客様情報</p>
              <input type="text" placeholder="お名前" value={customerInfo.name} onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"/>
              <input type="tel" placeholder="電話番号" value={customerInfo.phone} onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"/>
              <input type="email" placeholder="メールアドレス" value={customerInfo.email} onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"/>
              <input type="text" placeholder="郵便番号（7桁・ハイフンなし）" value={customerInfo.zip} onChange={(e) => { setCustomerInfo({...customerInfo, zip: e.target.value}); if (e.target.value.length === 7) fetchAddress(e.target.value); }} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"/>
              <input type="text" placeholder="住所（自動入力）" value={customerInfo.address1} readOnly className="w-full h-12 px-4 bg-[#EAEAEA]/30 rounded-xl text-[13px] text-[#999999] outline-none"/>
              <input type="text" placeholder="番地・建物名" value={customerInfo.address2} onChange={(e) => setCustomerInfo({...customerInfo, address2: e.target.value})} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"/>
            </div>

            {/* お支払い方法 */}
            <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-3">
              <p className="text-[12px] font-bold text-[#555555] mb-3">お支払い方法</p>
              {stripeEnabled && (
                <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${paymentMethod === 'card' ? 'border-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA]'}`}>
                  <input type="radio" name="pm" value="card" checked={paymentMethod === 'card'} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 accent-[#2D4B3E]"/>
                  <div>
                    <p className="text-[13px] font-bold text-[#111111]">クレジットカード決済</p>
                    <p className="text-[11px] text-[#555555] mt-1">Stripeの安全な決済画面で決済</p>
                  </div>
                </label>
              )}
              <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${paymentMethod === 'bank_transfer' ? 'border-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA]'}`}>
                <input type="radio" name="pm" value="bank_transfer" checked={paymentMethod === 'bank_transfer'} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 accent-[#2D4B3E]"/>
                <div>
                  <p className="text-[13px] font-bold text-[#111111]">銀行振込</p>
                  <p className="text-[11px] text-[#555555] mt-1">注文後、振込先をメールでお送りします</p>
                </div>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <AlertCircle size={16}/>
                <p className="text-[12px] font-bold">{error}</p>
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full h-14 bg-[#2D4B3E] text-white rounded-xl font-bold text-[14px] hover:bg-[#1f352b] disabled:opacity-50 transition-all"
            >
              {isSubmitting ? '送信中...' : `合計 ¥${totalAmount.toLocaleString()} を注文確定する`}
            </button>
          </>
        )}
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
        .font-serif { font-family: 'Noto Serif JP', serif; }
      `}</style>
    </div>
  );
}
