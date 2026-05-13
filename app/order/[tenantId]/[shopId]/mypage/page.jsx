'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Package, AlertCircle, CheckCircle2, Mail,
  Calendar, Plus, Trash2, FileText, RotateCcw, Heart
} from 'lucide-react';

function MyPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantId = params?.tenantId || 'default';
  const shopId = params?.shopId || 'default';
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [anniversaries, setAnniversaries] = useState([]);
  const [appSettings, setAppSettings] = useState(null);

  // 記念日追加フォーム
  const [annivForm, setAnnivForm] = useState({ title: '', month: '', day: '', notes: '' });
  const [showAnnivForm, setShowAnnivForm] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('リンクが無効です');
      setIsLoading(false);
      return;
    }
    // マイページデータ + 記念日 + 店舗設定
    Promise.all([
      fetch('/api/mypage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).then(r => r.json()),
      fetch(`/api/mypage/anniversaries?token=${encodeURIComponent(token)}`)
        .then(r => r.json()),
      // app_settings は anon でも取得可能
      fetch(`/api/mypage/settings?tenantId=${tenantId}`).then(r => r.ok ? r.json() : { settings: null }).catch(() => ({ settings: null })),
    ])
      .then(([mypage, annivs, settings]) => {
        if (mypage.error) { setError(mypage.error); return; }
        setData(mypage);
        setAnniversaries(annivs.items || []);
        if (settings.settings) setAppSettings(settings.settings);
      })
      .catch(() => setError('読み込みに失敗しました'))
      .finally(() => setIsLoading(false));
  }, [token, tenantId]);

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

  // 記念日 追加
  async function addAnniversary() {
    if (!annivForm.title || !annivForm.month || !annivForm.day) {
      alert('タイトル・月・日を入力してください');
      return;
    }
    try {
      const res = await fetch('/api/mypage/anniversaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          title: annivForm.title,
          month: Number(annivForm.month),
          day: Number(annivForm.day),
          notes: annivForm.notes,
          customerName: data?.orders?.[0]?.order_data?.customerInfo?.name || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setAnniversaries(prev => [...prev, d.item]);
      setAnnivForm({ title: '', month: '', day: '', notes: '' });
      setShowAnnivForm(false);
    } catch (e) {
      alert('登録に失敗しました: ' + e.message);
    }
  }

  // 記念日 削除
  async function deleteAnniversary(id) {
    if (!confirm('この記念日を削除しますか？')) return;
    try {
      const res = await fetch('/api/mypage/anniversaries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, id }),
      });
      if (!res.ok) throw new Error('削除失敗');
      setAnniversaries(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      alert(e.message);
    }
  }

  // 領収書PDF発行
  function printReceipt(o) {
    const d = o.order_data || {};
    const total = totalOf(o);
    const customer = d.customerInfo || {};
    const shop = appSettings?.shops?.[0] || {};
    const shopName = shop.name || appSettings?.generalConfig?.appName || 'お花屋さん';
    const shopAddress = shop.address || '';
    const shopPhone = shop.phone || '';
    const shopInvoice = shop.invoiceNumber || '';
    const logoUrl = appSettings?.generalConfig?.logoUrl || '';
    const safeId = String(o.id).slice(0, 8);
    const issueDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    const orderDate = new Date(o.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

    const items = Array.isArray(d.cartItems) && d.cartItems.length > 0
      ? d.cartItems.map(c => `<tr><td>${c.name}</td><td style="text-align:center;">${c.qty}</td><td style="text-align:right;">¥${(Number(c.price) * Number(c.qty)).toLocaleString()}</td></tr>`).join('')
      : `<tr><td>${d.flowerType || 'お花'} （${d.flowerPurpose || ''}）</td><td style="text-align:center;">1</td><td style="text-align:right;">¥${(Number(d.itemPrice) || 0).toLocaleString()}</td></tr>`;

    const taxExcluded = Math.floor(total / 1.1);
    const tax = total - taxExcluded;

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/><title>領収書_${safeId}</title>
      <style>
        @page { size: A4 portrait; margin: 20mm; }
        * { box-sizing: border-box; }
        body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; color: #222; margin: 0; padding: 0; }
        .container { max-width: 170mm; margin: 0 auto; }
        .title { text-align: center; font-size: 26pt; font-weight: 900; letter-spacing: 0.5em; padding: 6mm 0; border-bottom: 2pt double #222; margin-bottom: 8mm; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 8mm; font-size: 10pt; }
        .customer { font-size: 14pt; font-weight: bold; padding: 4mm 0; border-bottom: 0.5pt solid #999; margin-bottom: 6mm; }
        .customer-suffix { font-size: 10pt; font-weight: normal; margin-left: 2mm; }
        .amount-block { background: #fafafa; border: 1.5pt solid #222; padding: 8mm; margin: 8mm 0; text-align: center; }
        .amount-label { font-size: 10pt; color: #666; margin-bottom: 2mm; }
        .amount-value { font-size: 28pt; font-weight: 900; color: #117768; letter-spacing: 0.1em; }
        .amount-tax { font-size: 9pt; color: #666; margin-top: 2mm; }
        .description { font-size: 11pt; padding: 4mm 0; margin-bottom: 6mm; border-bottom: 0.5pt solid #ddd; }
        table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 10pt; }
        th, td { padding: 2.5mm 3mm; border-bottom: 0.5pt solid #ddd; }
        th { background: #f4f4f4; font-weight: bold; }
        .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12mm; padding-top: 6mm; border-top: 0.5pt solid #999; }
        .shop-info { font-size: 9pt; line-height: 1.7; }
        .shop-name { font-size: 13pt; font-weight: 900; margin-bottom: 2mm; }
        .stamp { width: 24mm; height: 24mm; border: 2pt solid #c41e3a; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #c41e3a; font-size: 7pt; font-weight: bold; opacity: 0.6; line-height: 1.2; text-align: center; }
      </style></head><body>
      <div class="container">
        <div class="title">領 収 書</div>
        <div class="meta">
          <div>No. ${safeId}</div>
          <div>発行日: ${issueDate}</div>
        </div>
        <div class="customer">${customer.name || 'お客様'}<span class="customer-suffix">様</span></div>
        <div class="amount-block">
          <div class="amount-label">領収金額（税込）</div>
          <div class="amount-value">¥ ${total.toLocaleString()} -</div>
          <div class="amount-tax">（内訳: 本体 ¥${taxExcluded.toLocaleString()} / 消費税 ¥${tax.toLocaleString()}）</div>
        </div>
        <div class="description">但し、お花のご注文代金として、上記正に領収いたしました。</div>
        <table>
          <thead><tr><th>品目</th><th style="width:18mm; text-align:center;">数量</th><th style="width:30mm; text-align:right;">金額(税抜)</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
        <div style="font-size:10pt; color:#555; margin-top:6mm;">ご注文日: ${orderDate}</div>
        <div class="footer">
          <div class="shop-info">
            ${logoUrl ? `<img src="${logoUrl}" alt="" style="max-height:14mm; max-width:50mm; object-fit:contain; display:block; margin-bottom:2mm;"/>` : ''}
            <div class="shop-name">${shopName}</div>
            <div>${shopAddress}</div>
            <div>TEL: ${shopPhone}</div>
            ${shopInvoice ? `<div>登録番号: ${shopInvoice}</div>` : ''}
          </div>
          <div class="stamp">${shopName}<br/>領収印</div>
        </div>
      </div>
      <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  // 前回注文と同じ内容で再注文
  function reorder(o) {
    const d = o.order_data || {};
    if (Array.isArray(d.cartItems) && d.cartItems.length > 0) {
      // EC注文 → カートに復元してカート画面へ
      const cartKey = `florix_cart_${tenantId}`;
      const cart = d.cartItems.map(c => ({
        id: c.productId || c.id,
        name: c.name,
        price: c.price,
        qty: c.qty,
        imageUrl: c.imageUrl || '',
      }));
      try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch (e) {}
      router.push(`/order/${tenantId}/${shopId}/cart`);
    } else {
      // カスタム注文 → 入口経由でオーダーメイドへ（prefill 情報は付かないが画面遷移）
      // (TODO: prefillクエリ対応は次フェーズ)
      alert('オーダーメイド注文ページへ移動します。前回の内容をご参考にご入力ください。');
      router.push(`/order/${tenantId}/${shopId}/custom`);
    }
  }

  const customerNameDefault = data?.orders?.[0]?.order_data?.customerInfo?.name || '';

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

      <main className="max-w-[800px] mx-auto px-6 pt-10 space-y-8">
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
            {/* お客様情報 */}
            <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA]">
              <p className="text-[11px] text-[#999999] flex items-center gap-1.5"><Mail size={12}/> ご注文時のメールアドレス</p>
              <p className="text-[14px] font-bold text-[#111111] mt-1">{data.email}</p>
              {customerNameDefault && <p className="text-[12px] text-[#555] mt-2">{customerNameDefault} 様</p>}
            </div>

            {/* 記念日リマインダー */}
            <section className="bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden">
              <div className="p-5 border-b border-[#EAEAEA] flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-[15px] font-bold text-[#2D4B3E] flex items-center gap-2"><Heart size={16} className="text-[#D97D54]"/> 記念日リマインダー</h2>
                <button
                  onClick={() => setShowAnnivForm(true)}
                  className="flex items-center gap-1 bg-[#2D4B3E] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#1f352b]"
                >
                  <Plus size={12}/> 追加
                </button>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-[11px] text-[#999] leading-relaxed mb-3">
                  記念日（誕生日・結婚記念日・月命日など）を登録すると、1週間前にメールでお知らせいたします💐
                </p>
                {anniversaries.length === 0 && !showAnnivForm ? (
                  <p className="text-[12px] text-[#999] py-4 text-center">まだ登録された記念日はありません</p>
                ) : (
                  anniversaries.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-[#111]">{a.title}</p>
                        <p className="text-[11px] text-[#555] mt-0.5">毎年 {a.month}/{a.day}{a.notes ? ` ・ ${a.notes}` : ''}</p>
                      </div>
                      <button
                        onClick={() => deleteAnniversary(a.id)}
                        className="text-red-400 hover:text-red-600 ml-2"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  ))
                )}

                {showAnnivForm && (
                  <div className="bg-[#117768]/5 border border-[#117768]/30 rounded-xl p-4 space-y-2 mt-2">
                    <input
                      type="text" placeholder="記念日タイトル（例: 母の誕生日）" value={annivForm.title}
                      onChange={(e) => setAnnivForm({ ...annivForm, title: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"
                    />
                    <div className="flex gap-2">
                      <select value={annivForm.month} onChange={(e) => setAnnivForm({ ...annivForm, month: e.target.value })}
                        className="flex-1 h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]">
                        <option value="">月</option>
                        {Array.from({length: 12}, (_, i) => i+1).map(m => <option key={m} value={m}>{m}月</option>)}
                      </select>
                      <select value={annivForm.day} onChange={(e) => setAnnivForm({ ...annivForm, day: e.target.value })}
                        className="flex-1 h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]">
                        <option value="">日</option>
                        {Array.from({length: 31}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}日</option>)}
                      </select>
                    </div>
                    <input
                      type="text" placeholder="メモ（例: 毎年ピンク系、予算1万円） 任意" value={annivForm.notes}
                      onChange={(e) => setAnnivForm({ ...annivForm, notes: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"
                    />
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setShowAnnivForm(false)} className="flex-1 h-10 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-lg">キャンセル</button>
                      <button onClick={addAnniversary} className="flex-1 h-10 bg-[#2D4B3E] text-white text-[12px] font-bold rounded-lg hover:bg-[#1f352b]">登録する</button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 注文履歴 */}
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
                    const isPaid = o.payment_status === 'paid' || (d.paymentStatus && !d.paymentStatus.includes('未'));
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

                        {/* アクションボタン */}
                        <div className="flex gap-2 pt-2 border-t border-[#F0F0F0]">
                          {isPaid && (
                            <button
                              onClick={() => printReceipt(o)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-[#FBFAF9] text-[#555] border border-[#EAEAEA] hover:bg-[#2D4B3E] hover:text-white hover:border-[#2D4B3E] transition-all"
                            >
                              <FileText size={12}/> 領収書を発行
                            </button>
                          )}
                          <button
                            onClick={() => reorder(o)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-[#D97D54]/10 text-[#D97D54] border border-[#D97D54]/30 hover:bg-[#D97D54] hover:text-white transition-all"
                          >
                            <RotateCcw size={12}/> 同じ内容で再注文
                          </button>
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
