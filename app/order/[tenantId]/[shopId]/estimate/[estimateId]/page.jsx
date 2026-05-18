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

  // ★ ご注文確定に必要な追加情報
  const [orderForm, setOrderForm] = useState({
    customerZip: '',
    customerAddress1: '',
    customerAddress2: '',
    paymentScheduledDate: '',
    agreeToTerms: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/estimates?tenantId=${tenantId}`);
        const data = await res.json();
        const found = (data.estimates || []).find(e => e.id === estimateId);
        if (!found) setError('お見積もりが見つかりません');
        else setEstimate(found);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [estimateId, tenantId]);

  async function fetchAddress(zip) {
    if (zip.length !== 7) return;
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      const data = await res.json();
      if (data.results?.[0]) {
        const r = data.results[0];
        setOrderForm(f => ({ ...f, customerAddress1: `${r.address1}${r.address2}${r.address3}` }));
      }
    } catch {}
  }

  async function handleAccept() {
    setError('');
    if (!orderForm.customerZip || orderForm.customerZip.length !== 7) {
      setError('郵便番号 (7桁) を入力してください');
      return;
    }
    if (!orderForm.customerAddress1 || !orderForm.customerAddress2) {
      setError('ご住所をすべて入力してください');
      return;
    }
    if (!orderForm.paymentScheduledDate) {
      setError('ご入金予定日を選択してください');
      return;
    }
    if (!orderForm.agreeToTerms) {
      setError('注文内容にご同意ください');
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch('/api/estimates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: estimateId,
          action: 'accept',
          customerExtraData: {
            zip: orderForm.customerZip,
            address1: orderForm.customerAddress1,
            address2: orderForm.customerAddress2,
            paymentScheduledDate: orderForm.paymentScheduledDate,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '確定に失敗しました');
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

  // ★ 確定完了画面
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
            ご注文番号: <span className="font-mono">{String(done.orderId || '').slice(0, 8)}</span><br/><br/>
            お振込先などのご案内は、ご登録のメールアドレスへ別途お送りします📩
          </p>
          <Link href={`/order/${tenantId}/${shopId}`} className="inline-block px-6 h-12 leading-[48px] bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold">
            トップに戻る
          </Link>
        </div>
      </div>
    );
  }

  // ★ 既に確定済み
  if (estimate.status === 'converted') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-2xl border-2 border-emerald-200 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-600"/>
          </div>
          <h1 className="text-[18px] font-bold text-emerald-700">✅ このお見積もりは確定済みです</h1>
          <p className="text-[12px] text-[#555] leading-relaxed">
            既に正式注文に変換されています。<br/>
            重複してのご注文はできません。<br/><br/>
            ご注文内容の確認はマイページから可能です。
          </p>
          <Link href={`/order/${tenantId}/${shopId}`} className="inline-block px-6 h-12 leading-[48px] bg-emerald-600 text-white rounded-xl text-[13px] font-bold">
            トップに戻る
          </Link>
        </div>
      </div>
    );
  }

  // ★ 未回答
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

  // ★ 却下済み
  if (estimate.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center">
          <p className="text-[14px] text-gray-700 font-bold">こちらのお見積もりは無効です</p>
        </div>
      </div>
    );
  }

  // 提示金額計算
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
        <div>
          <h1 className="text-[22px] font-bold text-[#2D4B3E]">お見積もりのご確認</h1>
          <p className="text-[11px] text-[#999] mt-1">内容にご納得いただけましたら、下記の情報を入力してご注文を確定してください🌸</p>
        </div>

        {/* ★ 店舗からの確定見積 (これだけ表示) */}
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 space-y-4">
          <p className="text-[11px] font-bold text-emerald-700">💐 店舗からの確定見積</p>
          {estimate.reply_message && (
            <pre className="text-[12px] text-[#222] bg-emerald-50 p-4 rounded-xl whitespace-pre-wrap font-sans leading-relaxed">{estimate.reply_message}</pre>
          )}

          {/* 料金内訳 */}
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

        {/* ★ 注文確定に必要な追加情報 */}
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-4">
          <p className="text-[13px] font-bold text-[#2D4B3E]">📝 ご注文確定に必要な情報</p>

          {/* 注文者住所 */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">
              ご注文者のご住所 <span className="text-red-500">*</span>
              <span className="text-[10px] text-[#999] ml-1">(領収書発行に必要)</span>
            </label>
            <input
              type="text"
              placeholder="郵便番号 (7桁・ハイフンなし)"
              value={orderForm.customerZip}
              onChange={e => {
                const v = e.target.value.replace(/[^\d]/g, '');
                setOrderForm({...orderForm, customerZip: v});
                if (v.length === 7) fetchAddress(v);
              }}
              inputMode="numeric"
              maxLength={7}
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
            />
            <input
              type="text"
              placeholder="都道府県・市区町村 (自動入力)"
              value={orderForm.customerAddress1}
              readOnly
              className="w-full h-12 px-4 bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-xl text-[13px] text-[#555] outline-none"
            />
            <input
              type="text"
              placeholder="番地・建物名・部屋番号"
              value={orderForm.customerAddress2}
              onChange={e => setOrderForm({...orderForm, customerAddress2: e.target.value})}
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
            />
          </div>

          {/* お支払い方法 (銀行振込固定) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">お支払い方法</label>
            <div className="p-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] text-[#555]">
              🏦 <strong>銀行振込</strong><br/>
              <span className="text-[10px] text-[#999]">確定後、メールでお振込先をご案内します</span>
            </div>
          </div>

          {/* 入金予定日 */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">
              ご入金予定日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={orderForm.paymentScheduledDate}
              onChange={e => setOrderForm({...orderForm, paymentScheduledDate: e.target.value})}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-bold outline-none focus:border-[#2D4B3E]"
            />
            <p className="text-[10px] text-[#999]">ご入金確認後から商品の制作・準備を開始いたします</p>
          </div>

          {/* 同意 */}
          <label className="flex items-start gap-2 p-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={orderForm.agreeToTerms}
              onChange={e => setOrderForm({...orderForm, agreeToTerms: e.target.checked})}
              className="mt-1 w-4 h-4 accent-[#2D4B3E]"
            />
            <span className="text-[11px] text-[#555] leading-relaxed">
              お見積もりの内容と上記情報を確認し、注文を確定することに同意します。
              <br/>
              <span className="text-[10px] text-[#999]">※ご入金確認前のキャンセル・変更はお電話にてご連絡ください。</span>
            </span>
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[12px] text-red-700 font-bold">
            ⚠️ {error}
          </div>
        )}

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
