'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { CheckCircle2, AlertCircle, ChevronLeft, CreditCard, Banknote, Clock, Calendar, Lightbulb, FileText, ClipboardList, Mail } from 'lucide-react';
import TatefudaPreview from '@/components/TatefudaPreview';

export default function EstimateAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';
  const estimateId = params?.estimateId;

  const [estimate, setEstimate] = useState(null);
  const [appSettings, setAppSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  // ★ ご注文確定に必要な追加情報
  const [orderForm, setOrderForm] = useState({
    // 注文者住所
    customerZip: '',
    customerAddress1: '',
    customerAddress2: '',
    // 支払い方法
    paymentMethod: 'bank_transfer', // 'bank_transfer' | 'card'
    paymentScheduledDate: '',
    // 立札
    tatePattern: '',
    tateInput1: '',
    tateInput2: '',
    tateInput3: '',
    tateInput3a: '',
    tateInput3b: '',
    // お供え
    osonaeInfo: {
      deceasedName: '', mournerName: '', sponsorNames: '', venueName: '', ceremonyTime: '',
    },
    // 自社配達時の事前連絡同意
    priorContactAgreed: false,
    agreeToTerms: false,
  });

  useEffect(() => {
    (async () => {
      try {
        // ★ [セキュリティ] 一覧取得は認証必須化されたため、id 指定で 1件取得に変更
        const [estRes, settingsRes] = await Promise.all([
          fetch(`/api/estimates?id=${encodeURIComponent(estimateId)}`).then(r => r.json()),
          supabase.from('app_settings').select('settings_data').eq('id', tenantId).single(),
        ]);
        const found = (estRes.estimates || []).find(e => e.id === estimateId);
        if (!found) setError('お見積もりが見つかりません');
        else setEstimate(found);
        if (settingsRes.data?.settings_data) setAppSettings(settingsRes.data.settings_data);
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

  // 立札パターン（お供え/通常）
  const rd = estimate?.request_data || {};
  const pd = estimate?.proposed_data || {};
  const isOsonae = rd.purpose?.includes('供') || rd.purpose?.includes('悔') || rd.purpose === 'お供え・お悔やみ';
  const needsTatefuda = rd.cardType === 'tatefuda';
  const tatePatterns = isOsonae ? [
    { id: 'p1', label: '① 御供｜横型 (背景あり)', needs: ['3'], layout: 'horizontal' },
    { id: 'p3', label: '② 御供｜縦型 (シンプル)', needs: ['3'], layout: 'vertical' },
    { id: 'p4', label: '③ 御供｜縦型 (会社名入)', needs: ['3a', '3b'], layout: 'vertical' },
  ] : [
    { id: 'p5', label: '⑤ 祝｜横型 (スタンダード)', needs: ['1', '3'], layout: 'horizontal' },
    { id: 'p6', label: '⑥ 祝｜横型 (様へ構成)', needs: ['1', '2', '3'], layout: 'horizontal' },
    { id: 'p7', label: '⑦ 祝｜縦型 (二列構成)', needs: ['1', '3'], layout: 'vertical' },
    { id: 'p8', label: '⑧ 祝｜縦型 (三列完成版)', needs: ['1', '2', '3'], layout: 'vertical' },
  ];
  const selectedPattern = tatePatterns.find(p => p.id === orderForm.tatePattern);

  // ★ 自社配達の場合は事前連絡同意が必要
  const isDelivery = rd.deliveryMethod === 'delivery' && pd.selfDeliveryAccepted === 'yes';
  // ★ Stripe利用可否（店舗設定から判定）
  const stripeEnabled = appSettings?.stripe?.chargesEnabled && appSettings?.stripe?.accountId;

  async function handleAccept() {
    setError('');
    // バリデーション
    if (!orderForm.customerZip || orderForm.customerZip.length !== 7) { setError('郵便番号 (7桁) を入力してください'); return; }
    if (!orderForm.customerAddress1 || !orderForm.customerAddress2) { setError('ご住所をすべて入力してください'); return; }
    if (orderForm.paymentMethod === 'bank_transfer' && !orderForm.paymentScheduledDate) { setError('ご入金予定日を選択してください'); return; }
    if (needsTatefuda && !orderForm.tatePattern) { setError('立札のレイアウトを選択してください'); return; }
    if (needsTatefuda && selectedPattern) {
      const needs = selectedPattern.needs;
      if (needs.includes('1') && !orderForm.tateInput1) { setError('立札①の内容を入力してください'); return; }
      if (needs.includes('2') && !orderForm.tateInput2) { setError('立札②の宛名を入力してください'); return; }
      if (needs.includes('3') && !orderForm.tateInput3) { setError('立札③の贈り主を入力してください'); return; }
      if (needs.includes('3a') && !orderForm.tateInput3a) { setError('立札③-1の会社名を入力してください'); return; }
      if (needs.includes('3b') && !orderForm.tateInput3b) { setError('立札③-2の役職・氏名を入力してください'); return; }
    }
    if (isOsonae && (!orderForm.osonaeInfo.deceasedName || !orderForm.osonaeInfo.venueName)) {
      setError('お供え花の詳細情報 (故人さま名・斎場名) を入力してください'); return;
    }
    if (isDelivery && !orderForm.priorContactAgreed) {
      setError('自社配達では事前連絡同意が必要です'); return;
    }
    if (!orderForm.agreeToTerms) { setError('注文内容にご同意ください'); return; }

    setAccepting(true);
    try {
      // ★ 見積データ + 入力データを統合した orderData を /api/orders へ POST
      const orderData = {
        shopId,
        fromEstimate: true,
        estimateId,
        customerInfo: {
          name: estimate.customer_name,
          email: estimate.customer_email,
          phone: estimate.customer_phone || '',
          zip: orderForm.customerZip,
          address1: orderForm.customerAddress1,
          address2: orderForm.customerAddress2,
        },
        isRecipientDifferent: !!(rd.recipientName || rd.deliveryAddress1),
        recipientInfo: (rd.recipientName || rd.deliveryAddress1) ? {
          name: rd.recipientName || estimate.customer_name,
          phone: estimate.customer_phone || '',
          zip: rd.deliveryZip || '',
          address1: rd.deliveryAddress1 || '',
          address2: rd.deliveryAddress2 || '',
        } : null,
        receiveMethod: rd.deliveryMethod === 'pickup' ? 'pickup'
                     : (pd.selfDeliveryAccepted === 'yes' ? 'delivery' : 'sagawa'),
        flowerType: rd.flowerType || '',
        flowerPurpose: rd.purpose === 'その他' ? rd.purposeOther : (rd.purpose || ''),
        flowerColor: rd.colorPreference || '',
        flowerVibe: '',
        purposeNote: [rd.otherNotes, rd.countSpec].filter(Boolean).join('\n') || '',
        // ★ お供え情報
        osonaeInfo: isOsonae ? orderForm.osonaeInfo : null,
        // ★ 立札情報
        cardType: rd.cardType === 'message' ? 'メッセージカード' : (needsTatefuda ? '立札' : 'なし'),
        cardMessage: rd.cardType === 'message' ? (rd.cardContent || '') : '',
        tatePattern: needsTatefuda ? orderForm.tatePattern : '',
        tateInput1: orderForm.tateInput1,
        tateInput2: orderForm.tateInput2,
        tateInput3: orderForm.tateInput3,
        tateInput3a: orderForm.tateInput3a,
        tateInput3b: orderForm.tateInput3b,
        selectedDate: rd.desiredDate || '',
        selectedTime: rd.desiredTime || '',
        priorContactAgreed: isDelivery ? orderForm.priorContactAgreed : null,
        // ★ 金額情報
        itemPrice: Number(pd.productPrice) || estimate.proposed_price,
        calculatedFee: (Number(pd.selfDeliveryFee) || 0)
          + (Number(pd.sagawaFee) || 0)
          + (Number(pd.boxFee) || 0)
          + (Number(pd.coolFee) || 0)
          + ((pd.otherFees || []).reduce((s, o) => s + (Number(o.amount) || 0), 0)),
        feeBreakdown: {
          baseFee: (Number(pd.selfDeliveryFee) || 0) + (Number(pd.sagawaFee) || 0),
          boxFee: Number(pd.boxFee) || 0,
          coolFee: Number(pd.coolFee) || 0,
          otherFees: pd.otherFees || [],
        },
        pickupFee: 0,
        paymentScheduledDate: orderForm.paymentMethod === 'bank_transfer' ? orderForm.paymentScheduledDate : null,
        note: `お見積もり依頼から確定 (見積ID: ${String(estimateId).slice(0,8)})\n\n${estimate.reply_message || ''}`,
        status: 'new',
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          shopId,
          orderData,
          paymentMethod: orderForm.paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注文の登録に失敗しました');

      // カード決済の場合は Stripe Checkout へ
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
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
          <h1 className="text-[18px] font-bold text-[#2D4B3E]">ご注文を確定しました</h1>
          <p className="text-[12px] text-[#555] leading-relaxed flex flex-col items-center gap-1">
            <span>お見積もりの内容で正式なご注文を承りました。</span>
            <span>ご注文番号: <span className="font-mono">{String(done.orderId || '').slice(0, 8)}</span></span>
            <span className="flex items-center gap-1 mt-2"><Mail size={12}/> お振込先などのご案内は、ご登録のメールアドレスへ別途お送りします</span>
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
        <div className="max-w-md w-full bg-white p-10 rounded-2xl border-2 border-emerald-200 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-600"/>
          </div>
          <h1 className="text-[18px] font-bold text-emerald-700 flex items-center justify-center gap-1"><CheckCircle2 size={18}/> このお見積もりは確定済みです</h1>
          <p className="text-[12px] text-[#555] leading-relaxed">
            既に正式注文に変換されています。<br/>
            重複してのご注文はできません。
          </p>
          <Link href={`/order/${tenantId}/${shopId}`} className="inline-block px-6 h-12 leading-[48px] bg-emerald-600 text-white rounded-xl text-[13px] font-bold">
            トップに戻る
          </Link>
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
        </div>
      </div>
    );
  }
  if (estimate.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center">
          <p className="text-[14px] text-gray-700 font-bold">こちらのお見積もりは無効です</p>
        </div>
      </div>
    );
  }

  // [見積-1] 有効期限チェック
  const expiresAt = estimate.expires_at ? new Date(estimate.expires_at) : null;
  const now = new Date();
  const isExpired = expiresAt && expiresAt < now;
  const daysUntilExpiry = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isNearExpiry = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 7;

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-2xl border-2 border-red-200 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center">
            <AlertCircle size={32} className="text-red-600"/>
          </div>
          <h1 className="text-[18px] font-bold text-red-700 flex items-center justify-center gap-1"><Clock size={18}/> このお見積もりは有効期限切れです</h1>
          <p className="text-[12px] text-[#555] leading-relaxed">
            有効期限: <strong>{expiresAt.toLocaleDateString('ja-JP')}</strong><br/>
            お手数ですが、改めてお見積もりをご依頼いただくか、<br/>
            お電話で店舗までお問い合わせください。
          </p>
          <Link href={`/order/${tenantId}/${shopId}/estimate`} className="inline-block px-6 h-12 leading-[48px] bg-red-600 text-white rounded-xl text-[13px] font-bold">
            再度見積を依頼する
          </Link>
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
        <div>
          <h1 className="text-[22px] font-bold text-[#2D4B3E]">お見積もりのご確認・確定</h1>
          <p className="text-[11px] text-[#999] mt-1">内容にご納得いただけましたら、下記の情報を入力してご注文を確定してください。</p>
        </div>

        {/* 店舗からの確定見積 */}
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 space-y-4">
          <p className="text-[11px] font-bold text-emerald-700">店舗からの確定見積</p>
          {estimate.reply_message && (
            <pre className="text-[12px] text-[#222] bg-emerald-50 p-4 rounded-xl whitespace-pre-wrap font-sans leading-relaxed">{estimate.reply_message}</pre>
          )}
          {pd && typeof pd === 'object' && (() => {
            const rows = [];
            if (pd.productPrice > 0) rows.push(['商品代 (税抜)', pd.productPrice]);
            if (pd.selfDeliveryAccepted === 'yes' && pd.selfDeliveryFee > 0) rows.push(['自社配達料', pd.selfDeliveryFee]);
            if (pd.sagawaFee > 0) rows.push(['業者配送料 (佐川)', pd.sagawaFee]);
            if (pd.boxFee > 0) rows.push(['箱代', pd.boxFee]);
            if (pd.coolFee > 0) rows.push(['クール便代', pd.coolFee]);
            (pd.otherFees || []).forEach(o => { if (Number(o.amount) > 0) rows.push([o.name || 'その他', Number(o.amount)]); });
            if (rows.length === 0) return null;
            return (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
                <p className="text-[11px] font-bold text-emerald-700 mb-2 flex items-center gap-1"><ClipboardList size={11}/> 料金内訳</p>
                {rows.map(([label, amount], i) => (
                  <div key={i} className="flex justify-between text-[12px] text-emerald-900">
                    <span>{label}</span><span className="font-bold">¥{Number(amount).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-[11px] text-emerald-700 pt-2 border-t border-emerald-300">
                  <span>消費税 (10%)</span><span>¥{tax.toLocaleString()}</span>
                </div>
              </div>
            );
          })()}
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 text-center">
            <p className="text-[11px] text-emerald-700">ご提案価格 (税込)</p>
            <p className="text-[32px] font-bold text-emerald-700">¥{total.toLocaleString()}</p>
            <p className="text-[10px] text-emerald-600 mt-1">税抜 ¥{estimate.proposed_price.toLocaleString()} + 消費税 ¥{tax.toLocaleString()}</p>
          </div>
          {/* [見積-1] 有効期限バナー */}
          {expiresAt && (
            <div className={`rounded-xl p-3 text-center border-2 ${isNearExpiry ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-200'}`}>
              <p className={`text-[11px] font-bold flex items-center justify-center gap-1 ${isNearExpiry ? 'text-amber-800' : 'text-blue-800'}`}>
                <Clock size={11}/> お見積もり有効期限: <strong>{expiresAt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                {daysUntilExpiry !== null && (
                  <span className="ml-1">（あと <strong>{daysUntilExpiry}</strong>日）</span>
                )}
              </p>
              {isNearExpiry && (
                <p className="text-[10px] text-amber-700 mt-1">期限が近いです。お早めにご確定ください。</p>
              )}
            </div>
          )}
        </div>

        {/* ご注文者情報 */}
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-4">
          <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-1"><FileText size={13}/> ご注文者情報</p>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">郵便番号 <span className="text-red-500">*</span></label>
            <input
              type="text" placeholder="0010025 (7桁・ハイフンなし)" inputMode="numeric" maxLength={7}
              value={orderForm.customerZip}
              onChange={e => { const v = e.target.value.replace(/[^\d]/g, ''); setOrderForm({...orderForm, customerZip: v}); if (v.length === 7) fetchAddress(v); }}
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"/>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">都道府県・市区町村</label>
            <input type="text" value={orderForm.customerAddress1} readOnly placeholder="郵便番号入力で自動表示"
              className="w-full h-12 px-4 bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-xl text-[13px] text-[#555] outline-none"/>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">番地・建物名 <span className="text-red-500">*</span></label>
            <input type="text" value={orderForm.customerAddress2}
              onChange={e => setOrderForm({...orderForm, customerAddress2: e.target.value})}
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"/>
          </div>
        </div>

        {/* ★ お供え情報 (用途がお供えの場合) */}
        {isOsonae && (
          <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-300 space-y-4">
            <p className="text-[13px] font-bold text-gray-700">お供え花 詳細情報</p>
            <p className="text-[11px] text-gray-600">立札や手配に使用させていただきます。</p>
            <input type="text" placeholder="故人さまのお名前 *"
              value={orderForm.osonaeInfo.deceasedName}
              onChange={e => setOrderForm({...orderForm, osonaeInfo: {...orderForm.osonaeInfo, deceasedName: e.target.value}})}
              className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-[13px] outline-none focus:border-gray-500"/>
            <input type="text" placeholder="喪主さまのお名前"
              value={orderForm.osonaeInfo.mournerName}
              onChange={e => setOrderForm({...orderForm, osonaeInfo: {...orderForm.osonaeInfo, mournerName: e.target.value}})}
              className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-[13px] outline-none focus:border-gray-500"/>
            <input type="text" placeholder="施主さまのお名前 (複数の場合はカンマ区切り)"
              value={orderForm.osonaeInfo.sponsorNames}
              onChange={e => setOrderForm({...orderForm, osonaeInfo: {...orderForm.osonaeInfo, sponsorNames: e.target.value}})}
              className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-[13px] outline-none focus:border-gray-500"/>
            <input type="text" placeholder="斎場・会場名 *"
              value={orderForm.osonaeInfo.venueName}
              onChange={e => setOrderForm({...orderForm, osonaeInfo: {...orderForm.osonaeInfo, venueName: e.target.value}})}
              className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-[13px] outline-none focus:border-gray-500"/>
            <input type="text" placeholder="通夜・告別式の時刻 (例: 通夜18:00 / 告別10:00)"
              value={orderForm.osonaeInfo.ceremonyTime}
              onChange={e => setOrderForm({...orderForm, osonaeInfo: {...orderForm.osonaeInfo, ceremonyTime: e.target.value}})}
              className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-[13px] outline-none focus:border-gray-500"/>
          </div>
        )}

        {/* ★ 立札詳細 (cardType=tatefuda の場合) */}
        {needsTatefuda && (
          <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-4">
            <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-1"><ClipboardList size={13}/> 立札の詳細</p>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#555]">レイアウト <span className="text-red-500">*</span></label>
              <select value={orderForm.tatePattern}
                onChange={e => setOrderForm({...orderForm, tatePattern: e.target.value})}
                className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-bold outline-none focus:border-[#2D4B3E]">
                <option value="">レイアウトを選択</option>
                {tatePatterns.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            {selectedPattern && (
              <div className="space-y-2">
                {selectedPattern.needs.includes('1') && <input type="text" placeholder={`① 内容 (例: ${isOsonae ? '御供' : '御開店'})`} value={orderForm.tateInput1} onChange={e => setOrderForm({...orderForm, tateInput1: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#2D4B3E]"/>}
                {selectedPattern.needs.includes('2') && <input type="text" placeholder="② 宛名 (例: 〇〇様)" value={orderForm.tateInput2} onChange={e => setOrderForm({...orderForm, tateInput2: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#2D4B3E]"/>}
                {selectedPattern.needs.includes('3') && (
                  <div className="space-y-1">
                    <textarea placeholder={"③ 贈り主 (例: 株式会社〇〇)\n※連名はEnterで改行"} value={orderForm.tateInput3} onChange={e => setOrderForm({...orderForm, tateInput3: e.target.value})} rows={2} className="w-full px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#2D4B3E] resize-y"/>
                    <p className="text-[10px] text-[#999] pl-1 flex items-center gap-1"><Lightbulb size={10}/> 連名: Enterで改行</p>
                  </div>
                )}
                {selectedPattern.needs.includes('3a') && <input type="text" placeholder="③-1 会社名" value={orderForm.tateInput3a} onChange={e => setOrderForm({...orderForm, tateInput3a: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#2D4B3E]"/>}
                {selectedPattern.needs.includes('3b') && (
                  <div className="space-y-1">
                    <textarea placeholder={"③-2 役職・氏名\n※連名はEnterで改行"} value={orderForm.tateInput3b} onChange={e => setOrderForm({...orderForm, tateInput3b: e.target.value})} rows={2} className="w-full px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#2D4B3E] resize-y"/>
                    <p className="text-[10px] text-[#999] pl-1 flex items-center gap-1"><Lightbulb size={10}/> 連名: Enterで改行</p>
                  </div>
                )}

                {/* ★ 仕上がりプレビュー */}
                <p className="text-[10px] font-bold text-[#999] text-center pt-3 mb-1">仕上がりプレビュー</p>
                <TatefudaPreview
                  tatePattern={orderForm.tatePattern}
                  layout={selectedPattern.layout}
                  isOsonae={isOsonae}
                  input1={orderForm.tateInput1}
                  input2={orderForm.tateInput2}
                  input3={orderForm.tateInput3}
                  input3a={orderForm.tateInput3a}
                  input3b={orderForm.tateInput3b}
                />
              </div>
            )}
          </div>
        )}

        {/* ★ 自社配達の事前連絡同意 */}
        {isDelivery && (
          <div className="bg-amber-50 p-5 rounded-2xl border-2 border-amber-200 space-y-3">
            <p className="text-[12px] font-bold text-amber-900 flex items-center gap-1"><AlertCircle size={13}/> 自社配達のご案内</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              自社配達では、お届け先のご都合確認のため、<strong>配達前にお届け先様へ直接お電話</strong>させていただく場合がございます。<br/>
              ご同意いただけない場合は、業者配送（佐川急便）でお受けすることもできますので、店舗までご相談ください。
            </p>
            <label className="flex items-center gap-2 p-3 bg-white rounded-lg border border-amber-300 cursor-pointer">
              <input type="checkbox" checked={orderForm.priorContactAgreed}
                onChange={e => setOrderForm({...orderForm, priorContactAgreed: e.target.checked})}
                className="w-4 h-4 accent-amber-600"/>
              <span className="text-[12px] font-bold text-amber-900">お届け先様への事前連絡に同意します</span>
            </label>
          </div>
        )}

        {/* お支払い方法 */}
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-4">
          <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-1"><CreditCard size={13}/> お支払い方法</p>

          {/* ★ キャンセル・返金不可のご案内 */}
          <div className="bg-red-50 border border-red-300 rounded-xl p-4">
            <p className="text-[12px] font-bold text-red-700 flex items-center gap-1.5 mb-1.5">
              <AlertCircle size={13}/> ご入金後のキャンセル・返金について
            </p>
            <p className="text-[11px] text-red-900 leading-relaxed">
              <strong>お客様都合でのご入金後のキャンセル・返金は承っておりません。</strong><br/>
              銀行振込・クレジットカード決済いずれもご返金できかねます。<br/>
              日程やお届け先の変更はお電話にて承りますので、ご注文確定後にお問い合わせください。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button"
              onClick={() => setOrderForm({...orderForm, paymentMethod: 'bank_transfer'})}
              className={`p-4 rounded-xl border-2 text-left transition-all ${orderForm.paymentMethod === 'bank_transfer' ? 'bg-[#2D4B3E] border-[#2D4B3E] text-white shadow-md' : 'bg-white border-[#EAEAEA] text-[#555]'}`}>
              <div className="flex items-center gap-2 mb-1"><Banknote size={18}/><span className="text-[13px] font-bold">銀行振込</span></div>
              <p className={`text-[10px] ${orderForm.paymentMethod === 'bank_transfer' ? 'text-white/80' : 'text-[#999]'}`}>ご注文確定後、振込先をメールでお送りします。<strong>お支払い確認後から制作を開始</strong>いたします。</p>
            </button>
            <button type="button"
              onClick={() => stripeEnabled && setOrderForm({...orderForm, paymentMethod: 'card'})}
              disabled={!stripeEnabled}
              className={`p-4 rounded-xl border-2 text-left transition-all ${orderForm.paymentMethod === 'card' ? 'bg-[#2D4B3E] border-[#2D4B3E] text-white shadow-md' : 'bg-white border-[#EAEAEA] text-[#555]'} ${!stripeEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <div className="flex items-center gap-2 mb-1"><CreditCard size={18}/><span className="text-[13px] font-bold">クレジットカード</span></div>
              <p className={`text-[10px] ${orderForm.paymentMethod === 'card' ? 'text-white/80' : 'text-[#999]'}`}>{stripeEnabled ? 'Stripeで安全に決済' : '※この店舗では利用不可'}</p>
            </button>
          </div>

          {/* ★ 銀行振込時：画像2と同じ「お支払い確認後から制作開始」案内＋入金予定日＋電話案内 */}
          {orderForm.paymentMethod === 'bank_transfer' && (
            <div className="space-y-3 pt-2">
              {/* 制作開始タイミング強調 */}
              <div className="bg-[#D97D54] text-white rounded-xl p-5 shadow-md">
                <p className="text-[16px] font-bold mb-2 flex items-center gap-2">
                  <Clock size={16}/> お支払い確認後から制作開始
                </p>
                <p className="text-[11px] leading-relaxed opacity-95">
                  銀行振込の場合、<strong className="text-yellow-200 underline">ご入金確認後</strong>からお花の仕入れ・制作を開始いたします。<br/>
                  お届け希望日に間に合うよう、<strong>お早めのお振込み</strong>をお願いいたします。
                </p>
              </div>

              {/* 入金予定日（必須）＋電話案内 */}
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-amber-900 flex items-center gap-1"><Calendar size={13}/> ご入金予定日</label>
                  <span className="text-[10px] bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded">必須</span>
                </div>
                <input
                  type="date"
                  value={orderForm.paymentScheduledDate || ''}
                  onChange={e => setOrderForm({...orderForm, paymentScheduledDate: e.target.value})}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                  className="w-full h-12 px-3 bg-white border-2 border-amber-300 rounded-lg text-[13px] font-bold outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-amber-700">※ お振込み予定の日付を選択してください</p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-[11px] text-yellow-900 leading-relaxed flex items-start gap-1">
                  <Lightbulb size={12} className="mt-0.5 shrink-0"/>
                  <span>ご入金のタイミングに関するご相談がある場合は、<strong>ご注文確定後にお電話</strong>にてお問い合わせください。<br/>
                  <span className="text-[10px] text-yellow-700">（お電話番号は注文完了画面・確認メールでご案内します）</span></span>
                </div>
              </div>
            </div>
          )}

          {orderForm.paymentMethod === 'card' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 flex items-start gap-1">
              <Lightbulb size={12} className="mt-0.5 shrink-0"/>
              <span>「決済へ進む」を押すと、安全なStripe決済ページへ移動します。</span>
            </div>
          )}
        </div>

        {/* 同意 */}
        <label className="flex items-start gap-2 p-4 bg-white border border-[#EAEAEA] rounded-xl cursor-pointer">
          <input type="checkbox" checked={orderForm.agreeToTerms}
            onChange={e => setOrderForm({...orderForm, agreeToTerms: e.target.checked})}
            className="mt-1 w-4 h-4 accent-[#2D4B3E]"/>
          <span className="text-[11px] text-[#555] leading-relaxed">
            お見積もりの内容と上記情報を確認し、注文を確定することに同意します。<br/>
            <span className="text-[10px] text-[#999]">※ご入金確認前のキャンセル・変更はお電話にてご連絡ください。</span>
          </span>
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-[12px] text-red-700 font-bold flex items-center gap-1">
            <AlertCircle size={13}/> {error}
          </div>
        )}

        <button onClick={handleAccept} disabled={accepting}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 shadow-md">
          <CheckCircle2 size={16}/> {accepting ? '確定中...' : (orderForm.paymentMethod === 'card' ? '決済へ進む →' : 'この内容で正式に注文する')}
        </button>

        <Link href={`/order/${tenantId}/${shopId}`} className="block text-center text-[12px] text-[#999] underline">
          今回は見送る
        </Link>
      </main>
    </div>
  );
}
