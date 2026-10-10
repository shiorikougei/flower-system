'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { CheckCircle2, AlertCircle, ChevronLeft, CreditCard, Banknote, Clock, Calendar, Lightbulb, FileText, ClipboardList, Mail, Send } from 'lucide-react';
import TatefudaFreeInput from '@/components/TatefudaFreeInput';
// [セキュリティ 2026-10] 店舗設定は秘密の項目を除いた /api/public/settings から読む
import { fetchPublicSettings } from '@/utils/fetchPublicSettings';

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
  // [2026-10] やり取りの無制限化: お客様用の鍵・選んだ見積案・変更依頼
  const [accessToken, setAccessToken] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [revisionText, setRevisionText] = useState('');
  const [sendingRevision, setSendingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState('');
  const [revisionSent, setRevisionSent] = useState(false);

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
    // [2026-10 B2] 立札は自由入力（会社名・送り主・ご要望）
    tateCompany: '',
    tateSender: '',
    tateRequest: '',
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
        // [2026-10] メールのリンクに付いているお客様用の鍵（?t=）も一緒に送る
        const t = new URLSearchParams(window.location.search).get('t') || '';
        setAccessToken(t);
        const [estRes, settingsRes] = await Promise.all([
          fetch(`/api/estimates?id=${encodeURIComponent(estimateId)}${t ? `&t=${encodeURIComponent(t)}` : ''}`).then(r => r.json()),
          fetchPublicSettings(tenantId),
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
  // [2026-10] 見積案（出し直すたびに増える）。取り下げていない案ならどれからでも注文できる。最新を目立たせる
  const versions = Array.isArray(estimate?.versions) ? estimate.versions : [];
  const activeVersions = versions.filter(v => v.status === 'active');
  const latestActive = activeVersions[activeVersions.length - 1] || null;
  const selectedVersion = activeVersions.find(v => v.id === selectedVersionId) || latestActive;
  const pd = selectedVersion?.proposed_data || {};
  const selectedPrice = Number(selectedVersion?.proposed_price) || 0;
  const isOsonae = rd.purpose?.includes('供') || rd.purpose?.includes('悔') || rd.purpose === 'お供え・お悔やみ';
  const needsTatefuda = rd.cardType === 'tatefuda';
  // [2026-10 B2] 立札のレイアウト（横型・縦型など）と頭書きはお店が決める

  // ★ 自社配達の場合は事前連絡同意が必要
  const isDelivery = rd.deliveryMethod === 'delivery' && pd.selfDeliveryAccepted === 'yes';
  // ★ Stripe利用可否（店舗設定から判定）
  const stripeEnabled = appSettings?.stripe?.chargesEnabled && appSettings?.stripe?.accountId;

  async function handleAccept() {
    setError('');
    if (!selectedVersion) { setError('ご注文いただける見積案がありません。お店にお問い合わせください'); return; }
    // バリデーション
    if (!orderForm.customerZip || orderForm.customerZip.length !== 7) { setError('郵便番号 (7桁) を入力してください'); return; }
    if (!orderForm.customerAddress1 || !orderForm.customerAddress2) { setError('ご住所をすべて入力してください'); return; }
    if (orderForm.paymentMethod === 'bank_transfer' && !orderForm.paymentScheduledDate) { setError('ご入金予定日を選択してください'); return; }
    if (needsTatefuda && !orderForm.tateSender.trim()) { setError('立札の送り主のお名前を入力してください'); return; }
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
        // [2026-10] どの見積案で注文するか（金額はサーバーがこの見積案から確定する）
        estimateVersionId: selectedVersion.id,
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
        tatePattern: '',
        tateCompany: needsTatefuda ? orderForm.tateCompany.trim() : '',
        tateSender: needsTatefuda ? orderForm.tateSender.trim() : '',
        tateRequest: needsTatefuda ? orderForm.tateRequest.trim() : '',
        selectedDate: rd.desiredDate || '',
        selectedTime: rd.desiredTime || '',
        priorContactAgreed: isDelivery ? orderForm.priorContactAgreed : null,
        // ★ 金額情報
        // 表示用の目安。実際の金額はサーバーが見積案から確定する
        itemPrice: selectedPrice - ((Number(pd.selfDeliveryFee) || 0) + (Number(pd.sagawaFee) || 0) + (Number(pd.boxFee) || 0) + (Number(pd.coolFee) || 0) + ((pd.otherFees || []).reduce((s, o) => s + (Number(o.amount) || 0), 0))),
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
        note: `お見積もり依頼から確定 (見積ID: ${String(estimateId).slice(0,8)} / 見積案 ${selectedVersion.version_no})\n\n${selectedVersion.message || ''}`,
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
          estimateToken: accessToken,
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

  // [2026-10] お客様からの変更依頼（文章のみ）
  async function handleRequestRevision() {
    setRevisionError('');
    const text = revisionText.trim();
    if (!text) { setRevisionError('ご依頼の内容を入力してください'); return; }
    setSendingRevision(true);
    try {
      const res = await fetch('/api/estimates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: estimateId, action: 'request_revision', customerToken: accessToken, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '送信に失敗しました');
      setRevisionText('');
      setRevisionSent(true);
      setEstimate(prev => prev ? {
        ...prev,
        status: 'revision_requested',
        messages: [...(prev.messages || []), { id: 'local-' + Date.now(), sender: 'customer', body: text, created_at: new Date().toISOString() }],
      } : prev);
    } catch (e) {
      setRevisionError(e.message);
    } finally {
      setSendingRevision(false);
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
  if (estimate.status === 'rejected' || estimate.status === 'deleted') {
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

  const tax = Math.floor(selectedPrice * 0.1);
  const total = selectedPrice + tax;

  // 料金内訳の行
  const breakdownRows = (d) => {
    const rows = [];
    if (!d || typeof d !== 'object') return rows;
    if (d.productPrice > 0) rows.push(['商品代 (税抜)', d.productPrice]);
    if (d.selfDeliveryAccepted === 'yes' && d.selfDeliveryFee > 0) rows.push(['自社配達料', d.selfDeliveryFee]);
    if (d.sagawaFee > 0) rows.push(['業者配送料 (佐川)', d.sagawaFee]);
    if (d.boxFee > 0) rows.push(['箱代', d.boxFee]);
    if (d.coolFee > 0) rows.push(['クール便代', d.coolFee]);
    (d.otherFees || []).forEach(o => { if (Number(o.amount) > 0) rows.push([o.name || 'その他', Number(o.amount)]); });
    return rows;
  };

  // [2026-10] やり取りを時間順に並べる（最初のご依頼 → 見積案・メッセージ）
  const timeline = [
    { kind: 'request', key: 'request', at: estimate.created_at },
    ...versions.map(v => ({ kind: 'version', key: 'v-' + v.id, at: v.created_at, v })),
    ...(Array.isArray(estimate.messages) ? estimate.messages : []).map(m => ({ kind: 'message', key: 'm-' + m.id, at: m.created_at, m })),
  ].sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  const fmtAt = (at) => at ? new Date(at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

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
          <p className="text-[12px] text-[#555] mt-1 leading-relaxed">お店とのやり取りと、お見積もりの内容です。ご希望の見積案を選んでご注文いただけます。内容を変えたいときは、下の「変更を依頼する」からお送りください。</p>
        </div>

        {estimate.status === 'revision_requested' && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-[12px] text-amber-900 leading-relaxed">
            <p className="font-bold">変更のご依頼を受け付けました</p>
            <p>お店からのお返事をメールでお知らせします。今ある見積案でご注文いただくこともできます。</p>
          </div>
        )}

        {/* [2026-10] これまでのやり取り */}
        <section className="space-y-3" aria-label="これまでのやり取り">
          <p className="text-[13px] font-bold text-[#2D4B3E]">これまでのやり取り</p>
          {timeline.map(item => {
            if (item.kind === 'request') {
              return (
                <div key={item.key} className="bg-white border border-[#EAEAEA] rounded-2xl p-4 space-y-1">
                  <p className="text-[11px] font-bold text-[#555]">お客様のご依頼 <span className="font-normal text-[#999] ml-1">{fmtAt(item.at)}</span></p>
                  <pre className="text-[12px] text-[#222] whitespace-pre-wrap font-sans leading-relaxed [overflow-wrap:anywhere]">{estimate.request_content}</pre>
                </div>
              );
            }
            if (item.kind === 'message') {
              const isCustomer = item.m.sender === 'customer';
              return (
                <div key={item.key} className={`rounded-2xl p-4 space-y-1 border ${isCustomer ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className={`text-[11px] font-bold ${isCustomer ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {isCustomer ? 'お客様からの変更のご依頼' : 'お店からのご連絡'} <span className="font-normal text-[#777] ml-1">{fmtAt(item.at)}</span>
                  </p>
                  <pre className="text-[12px] text-[#222] whitespace-pre-wrap font-sans leading-relaxed [overflow-wrap:anywhere]">{item.m.body}</pre>
                </div>
              );
            }
            const v = item.v;
            const isWithdrawn = v.status !== 'active';
            const isLatest = latestActive && v.id === latestActive.id;
            const isSelected = selectedVersion && v.id === selectedVersion.id;
            const vTax = Math.floor((Number(v.proposed_price) || 0) * 0.1);
            const vTotal = (Number(v.proposed_price) || 0) + vTax;
            const rows = breakdownRows(v.proposed_data);
            return (
              <div key={item.key} className={`bg-white rounded-2xl p-5 space-y-3 ${isWithdrawn ? 'border border-gray-200 opacity-60' : isLatest ? 'border-2 border-emerald-500 shadow-md' : 'border border-emerald-200'}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[13px] font-bold text-emerald-800">
                    お店のお見積もり 見積案 {v.version_no}
                    <span className="font-normal text-[11px] text-[#777] ml-2">{fmtAt(item.at)}</span>
                  </p>
                  <div className="flex gap-1.5">
                    {isLatest && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white">最新</span>}
                    {isWithdrawn && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-200 text-gray-600">お店が取り下げました</span>}
                    {isSelected && !isWithdrawn && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#2D4B3E] text-white">選択中</span>}
                  </div>
                </div>
                {v.message && (
                  <pre className="text-[12px] text-[#222] bg-emerald-50 p-4 rounded-xl whitespace-pre-wrap font-sans leading-relaxed [overflow-wrap:anywhere]">{v.message}</pre>
                )}
                {rows.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1.5">
                    <p className="text-[11px] font-bold text-emerald-700 mb-2 flex items-center gap-1"><ClipboardList size={11}/> 料金内訳</p>
                    {rows.map(([label, amount], i) => (
                      <div key={i} className="flex justify-between text-[12px] text-emerald-900">
                        <span>{label}</span><span className="font-bold">¥{Number(amount).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[11px] text-emerald-700 pt-2 border-t border-emerald-300">
                      <span>消費税 (10%)</span><span>¥{vTax.toLocaleString()}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] text-emerald-700">ご提案価格 (税込)</p>
                    <p className="text-[26px] font-bold text-emerald-700 leading-tight">¥{vTotal.toLocaleString()}</p>
                    <p className="text-[11px] text-emerald-600">税抜 ¥{(Number(v.proposed_price) || 0).toLocaleString()} + 消費税 ¥{vTax.toLocaleString()}</p>
                  </div>
                  {!isWithdrawn && (
                    <button type="button"
                      onClick={() => { setSelectedVersionId(v.id); document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' }); }}
                      className={`h-11 px-5 rounded-xl text-[13px] font-bold ${isLatest ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50'}`}>
                      この見積案で注文する
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* [2026-10] 変更を依頼する */}
        <section className="bg-white p-5 rounded-2xl border border-[#EAEAEA] space-y-3" aria-label="変更を依頼する">
          <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-1"><Send size={13}/> 変更を依頼する</p>
          <p className="text-[11px] text-[#555] leading-relaxed">お花の内容・ご予算・お届けの日時など、変えたいことをお書きください。お店から、お返事か新しいお見積もりをメールでお送りします。</p>
          <label className="block">
            <span className="sr-only">変更のご依頼の内容</span>
            <textarea value={revisionText} onChange={e => { setRevisionText(e.target.value); setRevisionSent(false); }}
              rows={4} maxLength={2000}
              placeholder="例: ご予算を 8,000 円くらいにしたいです / 色をもう少し淡い色にできますか"
              className="w-full px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E] resize-y leading-relaxed"/>
          </label>
          {revisionError && <p className="text-[12px] text-red-700 font-bold">{revisionError}</p>}
          {revisionSent && <p className="text-[12px] text-emerald-700 font-bold">お店に送信しました。お返事はメールでお知らせします。</p>}
          <button type="button" onClick={handleRequestRevision} disabled={sendingRevision || !revisionText.trim()}
            className="h-11 px-5 bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
            {sendingRevision ? '送信中...' : '変更を依頼する'}
          </button>
        </section>

        {/* ご注文する見積案 */}
        <div id="order-form" className="bg-white p-6 rounded-2xl border-2 border-emerald-200 space-y-4 scroll-mt-6">
          <p className="text-[13px] font-bold text-emerald-700">ご注文する見積案</p>
          {selectedVersion ? (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 text-center">
              <p className="text-[12px] font-bold text-emerald-800">見積案 {selectedVersion.version_no}{latestActive && selectedVersion.id === latestActive.id ? '（最新）' : ''}</p>
              <p className="text-[11px] text-emerald-700 mt-1">ご提案価格 (税込)</p>
              <p className="text-[32px] font-bold text-emerald-700">¥{total.toLocaleString()}</p>
              <p className="text-[10px] text-emerald-600 mt-1">税抜 ¥{selectedPrice.toLocaleString()} + 消費税 ¥{tax.toLocaleString()}</p>
              {activeVersions.length > 1 && (
                <p className="text-[11px] text-[#555] mt-2">ほかの見積案で注文するときは、上の「この見積案で注文する」を押してください。</p>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">今ご注文いただける見積案がありません。お店からのお返事をお待ちください。</p>
          )}
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
            <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-1"><ClipboardList size={13}/> 立札の内容</p>
            {rd.cardContent && (
              <p className="text-[11px] text-[#555] bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-3 whitespace-pre-wrap">ご依頼時の内容: {rd.cardContent}</p>
            )}
            <TatefudaFreeInput compact
              company={orderForm.tateCompany} sender={orderForm.tateSender} request={orderForm.tateRequest}
              onChange={(k, val) => setOrderForm(f => ({ ...f, [k]: val }))}
            />
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
