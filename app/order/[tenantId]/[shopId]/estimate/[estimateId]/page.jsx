'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { CheckCircle2, AlertCircle, ChevronLeft } from 'lucide-react';

export default function EstimateAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';
  const estimateId = params?.estimateId;

  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // 公開API的に取得（estimateId は推測困難な UUID）
        const res = await fetch(`/api/estimates?tenantId=${tenantId}`);
        const data = await res.json();
        const found = (data.estimates || []).find(e => e.id === estimateId);
        if (!found) {
          setError('お見積もりが見つかりません');
        } else {
          setEstimate(found);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [estimateId, tenantId]);

  async function handleAccept() {
    setAccepting(true);
    setError('');
    try {
      const res = await fetch('/api/estimates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: estimateId, action: 'accept' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setAccepting(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#999] animate-pulse">読み込み中...</div>;
  if (error && !estimate) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl border border-red-200 text-center">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-3"/>
        <p className="text-[14px] text-red-700 font-bold">{error}</p>
      </div>
    </div>
  );

  if (done) {
    return (
      <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-[#EAEAEA] text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-600"/>
          </div>
          <h1 className="text-[18px] font-bold text-[#2D4B3E]">🎉 ご注文を確定しました</h1>
          <p className="text-[12px] text-[#555] leading-relaxed">
            お見積もりの内容で正式なご注文を承りました。<br/>
            ご注文番号: <span className="font-mono">{String(done.orderId || '').slice(0, 8)}</span><br/>
            <br/>
            お支払い方法・お振込先などのご案内をメールでお送りしますので、しばらくお待ちください。
          </p>
          <Link href={`/order/${tenantId}/${shopId}`} className="inline-block px-6 h-12 leading-[48px] bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold">
            トップに戻る
          </Link>
        </div>
      </div>
    );
  }

  if (estimate.status === 'converted') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 text-center">
          <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-3"/>
          <p className="text-[14px] text-emerald-700 font-bold">こちらのお見積もりは既に確定済みです</p>
        </div>
      </div>
    );
  }

  if (estimate.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-amber-200 text-center">
          <AlertCircle size={32} className="mx-auto text-amber-600 mb-3"/>
          <p className="text-[14px] text-amber-700 font-bold">店舗からのご回答をお待ちください</p>
          <p className="text-[11px] text-[#555] mt-2">回答後、お見積もり結果をメールでお送りします。</p>
        </div>
      </div>
    );
  }

  const tax = Math.floor(estimate.proposed_price * 0.1);
  const total = estimate.proposed_price + tax;

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-20">
      <header className="bg-white border-b border-[#EAEAEA]">
        <div className="max-w-[700px] mx-auto px-6 h-16 flex items-center">
          <Link href={`/order/${tenantId}/${shopId}`} className="flex items-center gap-1 text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 戻る
          </Link>
        </div>
      </header>

      <main className="max-w-[700px] mx-auto px-6 py-10 space-y-6">
        <h1 className="text-[22px] font-bold text-[#2D4B3E]">お見積もりのご確認</h1>

        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-4">
          <p className="text-[11px] font-bold text-[#555]">ご依頼内容</p>
          <pre className="text-[12px] text-[#222] bg-[#FBFAF9] p-4 rounded-xl whitespace-pre-wrap font-sans leading-relaxed">{estimate.request_content}</pre>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-emerald-200 space-y-4">
          <p className="text-[11px] font-bold text-emerald-700">店舗からのご回答</p>
          {estimate.reply_message && (
            <pre className="text-[12px] text-[#222] bg-emerald-50 p-4 rounded-xl whitespace-pre-wrap font-sans leading-relaxed">{estimate.reply_message}</pre>
          )}
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 text-center">
            <p className="text-[11px] text-emerald-700">ご提案価格 (税込)</p>
            <p className="text-[32px] font-bold text-emerald-700">¥{total.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-600 mt-1">税抜 ¥{estimate.proposed_price.toLocaleString()} + 消費税 ¥{tax.toLocaleString()}</p>
          </div>
        </div>

        {error && <p className="text-[12px] text-red-600 font-bold">{error}</p>}

        <button onClick={handleAccept} disabled={accepting}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 shadow-md">
          <CheckCircle2 size={16}/> {accepting ? '確定中...' : 'この内容で正式に注文する'}
        </button>

        <Link href={`/order/${tenantId}/${shopId}`} className="block text-center text-[12px] text-[#999] underline">
          今回は見送る
        </Link>
      </main>
    </div>
  );
}
