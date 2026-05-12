'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Search, ChevronLeft, Package, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function OrderHistoryPage() {
  const params = useParams();
  const tenantId = params?.tenantId || 'default';
  const shopId = params?.shopId || 'default';

  const [email, setEmail] = useState('');
  const [orderId, setOrderId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e?.preventDefault?.();
    setError('');
    setIsSearching(true);
    setSearched(true);
    try {
      const res = await fetch('/api/order-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, orderId: orderId.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '検索に失敗しました');
      setResults(data.orders || []);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function formatDate(s) {
    if (!s) return '-';
    try {
      const d = new Date(s);
      return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return s; }
  }

  function totalOf(o) {
    const d = o.order_data || {};
    const item = Number(d.itemPrice) || 0;
    const fee = Number(d.calculatedFee) || 0;
    const pickup = Number(d.pickupFee) || 0;
    const sub = item + fee + pickup;
    return sub + Math.floor(sub * 0.1);
  }

  function paymentBadge(o) {
    if (o.payment_status === 'paid') return { label: '入金済', cls: 'bg-green-50 text-green-700 border-green-200' };
    if (o.payment_status === 'failed') return { label: '決済失敗', cls: 'bg-red-50 text-red-700 border-red-200' };
    if (o.payment_status === 'processing') return { label: '決済処理中', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (o.payment_status === 'refunded') return { label: '返金済', cls: 'bg-[#FBFAF9] text-[#999999] border-[#EAEAEA]' };
    const ps = o.order_data?.paymentStatus || '未入金';
    const isPaid = ps && !ps.includes('未');
    return { label: ps, cls: isPaid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-[#D97D54]/10 text-[#D97D54] border-[#D97D54]/20' };
  }

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-[800px] mx-auto h-16 px-6 flex items-center justify-between">
          <Link href={`/order/${tenantId}/${shopId}`} className="flex items-center gap-1 text-[12px] font-bold text-[#555555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 戻る
          </Link>
          <h1 className="text-[16px] font-bold text-[#2D4B3E]">ご注文の確認</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 pt-10 space-y-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#2D4B3E]">ご注文の確認・履歴</h1>
          <p className="text-[12px] text-[#555555] mt-1">ご注文番号とメールアドレスをご入力いただくと、注文内容を確認できます。</p>
        </div>

        <form onSubmit={handleSearch} className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#999999]">ご注文番号</label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="例: 1a2b3c4d  または完全な注文番号"
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] focus:border-[#2D4B3E] outline-none"
              required
            />
            <p className="text-[10px] text-[#999999]">注文確認メールの最初の8文字でも検索できます</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#999999]">ご注文時のメールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@example.com"
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] focus:border-[#2D4B3E] outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl font-bold text-[13px] hover:bg-[#1f352b] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Search size={16}/> {isSearching ? '検索中...' : '注文を検索する'}
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            <AlertCircle size={16}/>
            <p className="text-[12px] font-bold">{error}</p>
          </div>
        )}

        {searched && !error && results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-[14px] font-bold text-[#2D4B3E]">検索結果 ({results.length}件)</h2>
            {results.map(o => {
              const d = o.order_data || {};
              const badge = paymentBadge(o);
              return (
                <div key={o.id} className="bg-white p-5 rounded-2xl border border-[#EAEAEA] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-[11px] text-[#999999]">ご注文番号: <code className="text-[#555555] bg-[#FBFAF9] px-2 py-0.5 rounded text-[10px]">{String(o.id).slice(0, 8)}</code></p>
                    <p className="text-[11px] text-[#999999]">ご注文日時: {formatDate(o.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
                    {d.status === 'completed' && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#FBFAF9] text-[#555555] border border-[#EAEAEA]">手配完了</span>}
                    {d.status === 'キャンセル' && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">キャンセル</span>}
                  </div>

                  <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] space-y-2 text-[12px]">
                    <p className="text-[#555555]"><span className="text-[#999999]">お名前:</span> <span className="font-bold">{d.customerInfo?.name} 様</span></p>
                    {Array.isArray(d.cartItems) && d.cartItems.length > 0 ? (
                      <>
                        <p className="text-[#999999]">ご注文内容:</p>
                        {d.cartItems.map((c, i) => (
                          <p key={i} className="text-[#555555] pl-3">• {c.name} × {c.qty} (¥{Number(c.price).toLocaleString()})</p>
                        ))}
                      </>
                    ) : (
                      <>
                        {d.flowerType && <p className="text-[#555555]"><span className="text-[#999999]">商品:</span> <span className="font-bold">{d.flowerType}</span></p>}
                        {d.flowerPurpose && <p className="text-[#555555]"><span className="text-[#999999]">用途:</span> {d.flowerPurpose}</p>}
                      </>
                    )}
                    {d.selectedDate && <p className="text-[#555555]"><span className="text-[#999999]">納品希望日:</span> {d.selectedDate}</p>}
                  </div>

                  <div className="flex justify-between items-baseline pt-3 border-t border-[#F0F0F0]">
                    <span className="text-[12px] font-bold text-[#555555]">合計（税込）</span>
                    <span className="text-[18px] font-bold text-[#2D4B3E]">¥{totalOf(o).toLocaleString()}</span>
                  </div>

                  {o.payment_status === 'paid' && (
                    <div className="flex items-center gap-2 text-green-700 text-[11px] pt-1">
                      <CheckCircle2 size={14}/> お支払い完了 {o.paid_at && `（${formatDate(o.paid_at)}）`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {searched && !error && results.length === 0 && !isSearching && (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#EAEAEA]">
            <Package size={32} className="mx-auto text-[#CCC] mb-3"/>
            <p className="text-[13px] font-bold text-[#999999]">該当する注文が見つかりません</p>
            <p className="text-[11px] text-[#CCC] mt-1">ご注文番号とメールアドレスをご確認ください</p>
          </div>
        )}
      </main>
    </div>
  );
}
