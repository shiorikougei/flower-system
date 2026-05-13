'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Package, AlertCircle, CheckCircle2, Mail } from 'lucide-react';

function MyPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params?.tenantId || 'default';
  const shopId = params?.shopId || 'default';
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('リンクが無効です');
      setIsLoading(false);
      return;
    }
    fetch('/api/mypage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('読み込みに失敗しました'))
      .finally(() => setIsLoading(false));
  }, [token]);

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
            <ChevronLeft size={16}/> ホームへ
          </Link>
          <h1 className="text-[16px] font-bold text-[#2D4B3E]">マイページ</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 pt-10 space-y-6">
        {isLoading ? (
          <div className="py-20 text-center text-[#999999] font-bold animate-pulse">読み込み中...</div>
        ) : error ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#EAEAEA] space-y-3">
            <AlertCircle size={32} className="mx-auto text-[#D97D54]"/>
            <p className="text-[13px] font-bold text-[#999999]">{error}</p>
            <Link href={`/order/${tenantId}/${shopId}/history`} className="inline-block px-5 h-11 leading-[44px] bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold mt-2">
              再度送信する
            </Link>
          </div>
        ) : data && (
          <>
            <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA]">
              <p className="text-[11px] text-[#999999] flex items-center gap-1.5"><Mail size={12}/> ご注文時のメールアドレス</p>
              <p className="text-[14px] font-bold text-[#111111] mt-1">{data.email}</p>
            </div>

            <div>
              <h2 className="text-[18px] font-bold text-[#2D4B3E] mb-4">ご注文履歴 ({data.orders.length}件)</h2>
              {data.orders.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#EAEAEA]">
                  <Package size={32} className="mx-auto text-[#CCC] mb-3"/>
                  <p className="text-[13px] font-bold text-[#999999]">ご注文がまだありません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {data.orders.map(o => {
                    const d = o.order_data || {};
                    const badge = paymentBadge(o);
                    return (
                      <div key={o.id} className="bg-white p-5 rounded-2xl border border-[#EAEAEA] space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-[11px] text-[#999999]">注文番号: <code className="bg-[#FBFAF9] px-2 py-0.5 rounded">{String(o.id).slice(0, 8)}</code></p>
                          <p className="text-[11px] text-[#999999]">{formatDate(o.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${badge.cls}`}>{badge.label}</span>
                          {d.orderType === 'ec' && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">🛒 EC注文</span>}
                          {d.status === 'completed' && <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#FBFAF9] text-[#555555] border border-[#EAEAEA]">手配完了</span>}
                        </div>
                        <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] space-y-1 text-[12px]">
                          {Array.isArray(d.cartItems) && d.cartItems.length > 0 ? (
                            d.cartItems.map((c, i) => (
                              <p key={i} className="text-[#555555]">• {c.name} × {c.qty}</p>
                            ))
                          ) : (
                            <>
                              {d.flowerType && <p className="text-[#555555]"><strong>{d.flowerType}</strong></p>}
                              {d.flowerPurpose && <p className="text-[#999999] text-[11px]">用途: {d.flowerPurpose}</p>}
                            </>
                          )}
                          {d.selectedDate && <p className="text-[#999999] text-[11px] pt-1 border-t border-[#F0F0F0] mt-2">納品希望日: {d.selectedDate}</p>}
                        </div>
                        <div className="flex justify-between items-baseline pt-2 border-t border-[#F0F0F0]">
                          <span className="text-[12px] font-bold text-[#555555]">合計（税込）</span>
                          <span className="text-[18px] font-bold text-[#2D4B3E]">¥{totalOf(o).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function MyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#2D4B3E] font-bold">読み込み中...</div>}>
      <MyPageContent />
    </Suspense>
  );
}
