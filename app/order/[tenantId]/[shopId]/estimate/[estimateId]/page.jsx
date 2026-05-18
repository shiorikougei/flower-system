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

        {/* ★ ご依頼内容 (構造化されてればテーブル、そうでなければtext) */}
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-3">
          <p className="text-[11px] font-bold text-[#555]">ご依頼内容</p>
          {estimate.request_data && typeof estimate.request_data === 'object' ? (
            <div className="space-y-1.5 text-[12px]">
              {(() => {
                const rd = estimate.request_data;
                const dmMap = { pickup: '店頭で受取', delivery: '自社配達', shipping: '宅配便配送', undecided: '未定・相談' };
                const cardMap = { none: '不要', message: 'メッセージカード', tatefuda: '立札' };
                const purposeLabel = rd.purpose === 'その他' ? `その他: ${rd.purposeOther || ''}` : rd.purpose;
                const fields = [];
                if (rd.purpose) fields.push(['ご用途', purposeLabel]);
                if (rd.deliveryMethod) fields.push(['受取方法', dmMap[rd.deliveryMethod] || rd.deliveryMethod]);
                if (rd.desiredDate) fields.push(['ご希望日', rd.desiredDate + (rd.desiredTime ? ` / ${rd.desiredTime}` : '')]);
                const addrParts = [];
                if (rd.deliveryZip) addrParts.push(`〒${rd.deliveryZip}`);
                if (rd.deliveryAddress1) addrParts.push(rd.deliveryAddress1);
                if (rd.deliveryAddress2) addrParts.push(rd.deliveryAddress2);
                const combinedAddr = addrParts.join(' ') || rd.deliveryAddress;
                if (combinedAddr) fields.push(['お届け先住所', combinedAddr]);
                if (rd.recipientName) fields.push(['お届け先お名前', `${rd.recipientName} 様`]);
                if (rd.flowerType) fields.push(['花の種類', rd.flowerType]);
                if (rd.colorPreference) fields.push(['色・イメージ', rd.colorPreference]);
                if (rd.countSpec) fields.push(['本数・サイズ', rd.countSpec]);
                if (rd.budget) fields.push(['ご予算 (希望)', rd.budget]);
                if (rd.cardType && rd.cardType !== 'none') fields.push([cardMap[rd.cardType] || 'カード', rd.cardContent || '（後日相談）']);
                if (rd.otherNotes) fields.push(['その他', rd.otherNotes]);
                return fields.map(([k, v], i) => (
                  <div key={i} className="grid grid-cols-[110px_1fr] gap-2 py-1 border-b border-[#F0F0F0] last:border-b-0">
                    <span className="font-bold text-[#117768] text-[11px]">{k}</span>
                    <span className="text-[#222] whitespace-pre-wrap break-words">{v}</span>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <pre className="text-[12px] text-[#222] bg-[#FBFAF9] p-4 rounded-xl whitespace-pre-wrap font-sans leading-relaxed">{estimate.request_content}</pre>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-emerald-200 space-y-4">
          <p className="text-[11px] font-bold text-emerald-700">店舗からのご回答</p>
          {estimate.reply_message && (
            <pre className="text-[12px] text-[#222] bg-emerald-50 p-4 rounded-xl whitespace-pre-wrap font-sans leading-relaxed">{estimate.reply_message}</pre>
          )}

          {/* ★ 料金内訳 (proposed_data があれば表示) */}
          {estimate.proposed_data && typeof estimate.proposed_data === 'object' && (() => {
            const pd = estimate.proposed_data;
            const rows = [];
            if (pd.productPrice > 0) rows.push(['商品代 (税抜)', pd.productPrice]);
            if (pd.selfDeliveryAccepted === 'yes' && pd.selfDeliveryFee > 0) rows.push(['自社配達料', pd.selfDeliveryFee]);
            if (pd.sagawaFee > 0) rows.push(['業者配送料 (佐川)', pd.sagawaFee]);
            if (pd.boxFee > 0) rows.push(['箱代', pd.boxFee]);
            if (pd.coolFee > 0) rows.push(['クール便代', pd.coolFee]);
            (pd.otherFees || []).forEach(o => {
              if (Number(o.amount) > 0) rows.push([o.name || 'その他', Number(o.amount)]);
            });
            if (rows.length === 0) return null;
            return (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
                <p className="text-[11px] font-bold text-emerald-700 mb-2">📋 料金内訳</p>
                {rows.map(([label, amount], i) => (
                  <div key={i} className="flex justify-between text-[12px] text-emerald-900">
                    <span>{label}</span>
                    <span className="font-bold">¥{Number(amount).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[11px] text-emerald-700 pt-2 border-t border-emerald-300">
                  <span>消費税 (10%)</span>
                  <span>¥{tax.toLocaleString()}</span>
                </div>
              </div>
            );
          })()}

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
