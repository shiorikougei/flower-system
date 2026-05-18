'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, Send, CheckCircle, XCircle, RefreshCw, Mail, Phone } from 'lucide-react';

export default function EstimatesPage() {
  const [tenantId, setTenantId] = useState(null);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  // ★ 新・回答フォーム (料金内訳 + 自動メッセージ生成)
  const [replyForm, setReplyForm] = useState({
    productPrice: '',          // 商品代 (税抜)
    selfDeliveryAccepted: '',  // '' | 'yes' | 'no' (自社配達対応可否)
    selfDeliveryFee: '',       // 自社配達料
    sagawaFee: '',             // 業者配送料
    boxFee: '',                // 箱代
    coolFee: '',               // クール便代
    otherFee: '',              // その他料金
    otherFeeNote: '',          // その他料金の内訳メモ
    message: '',               // 回答メッセージ
  });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
      setTenantId(profile?.tenant_id);
    })();
  }, []);

  useEffect(() => {
    if (tenantId) loadEstimates();
  }, [tenantId]);

  async function loadEstimates() {
    setLoading(true);
    try {
      const res = await fetch(`/api/estimates?tenantId=${tenantId}`);
      const data = await res.json();
      setEstimates(data.estimates || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // ★ 合計金額計算 (税抜)
  function calcTotal() {
    return [
      replyForm.productPrice,
      replyForm.selfDeliveryFee,
      replyForm.sagawaFee,
      replyForm.boxFee,
      replyForm.coolFee,
      replyForm.otherFee,
    ].reduce((sum, v) => sum + (Number(v) || 0), 0);
  }

  // ★ メッセージを自動生成
  function generateMessage(est) {
    const rd = est.request_data || {};
    const total = calcTotal();
    const totalTax = Math.floor(total * 1.1);

    let msg = `${est.customer_name} 様\n\n`;
    msg += `ご依頼ありがとうございます🌸\n`;
    msg += `下記の内容でお見積もりさせていただきます。\n\n`;

    // 内容サマリー
    if (rd.purpose) msg += `用途: ${rd.purpose === 'その他' ? `その他(${rd.purposeOther||''})` : rd.purpose}\n`;
    if (rd.flowerType) msg += `お花の種類: ${rd.flowerType}\n`;
    if (rd.colorPreference) msg += `色・イメージ: ${rd.colorPreference}\n`;
    if (rd.desiredDate) msg += `ご希望日: ${rd.desiredDate}${rd.desiredTime ? ' '+rd.desiredTime : ''}\n`;
    msg += `\n`;

    // 料金内訳
    msg += `【お見積り内訳】\n`;
    if (replyForm.productPrice) msg += `商品代(税抜): ¥${Number(replyForm.productPrice).toLocaleString()}\n`;
    if (replyForm.selfDeliveryAccepted === 'yes' && replyForm.selfDeliveryFee) {
      msg += `自社配達料: ¥${Number(replyForm.selfDeliveryFee).toLocaleString()}\n`;
    }
    if (replyForm.sagawaFee) {
      msg += `業者配送料(佐川): ¥${Number(replyForm.sagawaFee).toLocaleString()}\n`;
    }
    if (replyForm.boxFee) msg += `箱代: ¥${Number(replyForm.boxFee).toLocaleString()}\n`;
    if (replyForm.coolFee) msg += `クール便代: ¥${Number(replyForm.coolFee).toLocaleString()}\n`;
    if (replyForm.otherFee) msg += `${replyForm.otherFeeNote || 'その他'}: ¥${Number(replyForm.otherFee).toLocaleString()}\n`;
    msg += `─────────────\n`;
    msg += `合計(税抜): ¥${total.toLocaleString()}\n`;
    msg += `合計(税込): ¥${totalTax.toLocaleString()}\n\n`;

    // 自社配達対応不可の場合の注釈
    if (replyForm.selfDeliveryAccepted === 'no' && rd.deliveryMethod === 'delivery') {
      msg += `※ ご希望の自社配達ですが、配達状況により対応が難しいため、業者配送（佐川急便）でのご案内となります。何卒ご了承ください。\n\n`;
    }

    msg += `内容にご納得いただけましたら、メール記載のURLから正式注文へお進みください💐\n\n`;
    msg += `ご質問・修正のご希望等ございましたら、お気軽にご返信ください🌷`;
    return msg;
  }

  async function handleReply(id) {
    if (!replyForm.message) { alert('回答メッセージを入力してください'); return; }
    if (calcTotal() <= 0) { alert('金額を入力してください'); return; }
    try {
      const res = await fetch('/api/estimates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, action: 'reply',
          replyMessage: replyForm.message,
          proposedPrice: calcTotal(),
          proposedData: {
            productPrice: Number(replyForm.productPrice) || 0,
            selfDeliveryAccepted: replyForm.selfDeliveryAccepted,
            selfDeliveryFee: Number(replyForm.selfDeliveryFee) || 0,
            sagawaFee: Number(replyForm.sagawaFee) || 0,
            boxFee: Number(replyForm.boxFee) || 0,
            coolFee: Number(replyForm.coolFee) || 0,
            otherFee: Number(replyForm.otherFee) || 0,
            otherFeeNote: replyForm.otherFeeNote || '',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingId(null);
      setReplyForm({
        productPrice: '', selfDeliveryAccepted: '', selfDeliveryFee: '',
        sagawaFee: '', boxFee: '', coolFee: '', otherFee: '', otherFeeNote: '', message: '',
      });
      loadEstimates();
      alert('お客様にお見積もりメールを送信しました🎉');
    } catch (e) { alert('エラー: ' + e.message); }
  }

  async function handleReject(id) {
    if (!confirm('このお見積もり依頼を却下しますか？')) return;
    try {
      await fetch('/api/estimates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' }),
      });
      loadEstimates();
    } catch (e) { alert(e.message); }
  }

  const filtered = filter === 'all' ? estimates : estimates.filter(e => e.status === filter);

  const STATUS_LABELS = {
    pending: { label: '未回答', color: 'bg-amber-100 text-amber-700 border-amber-300' },
    replied: { label: '回答済', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    accepted: { label: '承諾済', color: 'bg-green-100 text-green-700 border-green-300' },
    converted: { label: '注文確定', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    rejected: { label: '却下', color: 'bg-gray-100 text-gray-600 border-gray-300' },
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] pb-32">
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-10">
        <div className="max-w-[1000px] mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2">💰 お見積もり依頼管理</h1>
          <button onClick={loadEstimates} className="p-2 hover:bg-[#FBFAF9] rounded-lg"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-6 py-8 space-y-6">
        {/* フィルター */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: 'すべて' },
            { id: 'pending', label: '🟡 未回答' },
            { id: 'replied', label: '🔵 回答済' },
            { id: 'converted', label: '✅ 確定済' },
            { id: 'rejected', label: '❌ 却下' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-[12px] font-bold ${filter === f.id ? 'bg-[#2D4B3E] text-white' : 'bg-white border border-[#EAEAEA] text-[#555]'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-[#999] py-12 animate-pulse">読み込み中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-[#999] py-12">該当する見積依頼はありません</p>
        ) : (
          <div className="space-y-4">
            {filtered.map(est => {
              const status = STATUS_LABELS[est.status] || STATUS_LABELS.pending;
              const isEditing = editingId === est.id;
              return (
                <div key={est.id} className="bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>{status.label}</span>
                        <span className="text-[10px] text-[#999] font-mono">{new Date(est.created_at).toLocaleString('ja-JP')}</span>
                      </div>
                      <p className="text-[14px] font-bold text-[#111]">{est.customer_name} 様</p>
                      <div className="flex gap-3 text-[11px] text-[#555] mt-1">
                        <a href={`mailto:${est.customer_email}`} className="flex items-center gap-1 hover:text-[#2D4B3E]"><Mail size={11}/> {est.customer_email}</a>
                        {est.customer_phone && <a href={`tel:${est.customer_phone}`} className="flex items-center gap-1 hover:text-[#2D4B3E]"><Phone size={11}/> {est.customer_phone}</a>}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#FBFAF9] p-3 rounded-lg">
                    <p className="text-[10px] font-bold text-[#999] mb-2">ご依頼内容</p>
                    {/* ★ 構造化データがあればテーブル表示、なければプレーンテキスト */}
                    {est.request_data && typeof est.request_data === 'object' ? (
                      <div className="space-y-1">
                        {(() => {
                          const rd = est.request_data;
                          const dmMap = { pickup: '店頭で受取', delivery: '自社配達', shipping: '宅配便配送', undecided: '未定・相談' };
                          const cardMap = { none: '不要', message: 'メッセージカード', tatefuda: '立札' };
                          const purposeLabel = rd.purpose === 'その他' ? `その他: ${rd.purposeOther || ''}` : rd.purpose;
                          const fields = [];
                          if (rd.purpose) fields.push(['ご用途', purposeLabel]);
                          if (rd.deliveryMethod) fields.push(['受取方法', dmMap[rd.deliveryMethod] || rd.deliveryMethod]);
                          if (rd.desiredDate) fields.push(['ご希望日', rd.desiredDate + (rd.desiredTime ? ` / ${rd.desiredTime}` : '')]);
                          // ★ 新フォーム形式の住所結合 / 旧 deliveryAddress も互換
                          const addrParts2 = [];
                          if (rd.deliveryZip) addrParts2.push(`〒${rd.deliveryZip}`);
                          if (rd.deliveryAddress1) addrParts2.push(rd.deliveryAddress1);
                          if (rd.deliveryAddress2) addrParts2.push(rd.deliveryAddress2);
                          const combinedAddr = addrParts2.join(' ') || rd.deliveryAddress;
                          if (combinedAddr) fields.push(['お届け先住所', combinedAddr]);
                          if (rd.recipientName) fields.push(['お届け先お名前', `${rd.recipientName} 様`]);
                          if (rd.flowerType) fields.push(['花の種類', rd.flowerType]);
                          if (rd.colorPreference) fields.push(['色・イメージ', rd.colorPreference]);
                          if (rd.countSpec) fields.push(['本数・サイズ', rd.countSpec]);
                          if (rd.budget) fields.push(['ご予算', rd.budget]);
                          if (rd.cardType && rd.cardType !== 'none') fields.push([cardMap[rd.cardType] || 'カード', rd.cardContent || '（後日相談）']);
                          if (rd.instagramManagementNos) fields.push(['Instagram管理番号', rd.instagramManagementNos]);
                          if (rd.instagramUrls) fields.push(['Instagram URL', rd.instagramUrls]);
                          if (rd.otherNotes) fields.push(['その他', rd.otherNotes]);
                          return fields.map(([k, v], i) => (
                            <div key={i} className="grid grid-cols-[110px_1fr] gap-2 text-[12px] py-1 border-b border-[#EAEAEA] last:border-b-0">
                              <span className="font-bold text-[#117768] text-[11px]">{k}</span>
                              <span className="text-[#222] whitespace-pre-wrap break-words">{v}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    ) : (
                      <pre className="text-[12px] text-[#222] whitespace-pre-wrap font-sans leading-relaxed">{est.request_content}</pre>
                    )}
                  </div>

                  {/* ★ 参考画像のサムネイル表示 */}
                  {Array.isArray(est.reference_images) && est.reference_images.length > 0 && (
                    <div className="bg-[#FBFAF9] p-3 rounded-lg">
                      <p className="text-[10px] font-bold text-[#999] mb-2">📷 参考画像 ({est.reference_images.length}枚)</p>
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {est.reference_images.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="relative aspect-square bg-white rounded-lg overflow-hidden border border-[#EAEAEA] hover:shadow-md transition-all group">
                            <img src={url} alt={`参考画像${idx + 1}`} className="w-full h-full object-cover"/>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-bold">🔍 拡大</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {est.reply_message && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                      <p className="text-[10px] font-bold text-emerald-700 mb-1">店舗回答 (¥{Number(est.proposed_price).toLocaleString()} 税抜)</p>
                      <pre className="text-[12px] text-[#222] whitespace-pre-wrap font-sans leading-relaxed">{est.reply_message}</pre>
                    </div>
                  )}

                  {est.status === 'pending' && !isEditing && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => { setEditingId(est.id); setReplyForm({ productPrice: '', selfDeliveryAccepted: '', selfDeliveryFee: '', sagawaFee: '', boxFee: '', coolFee: '', otherFee: '', otherFeeNote: '', message: '' }); }}
                        className="flex-1 h-10 bg-[#117768] text-white text-[12px] font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-[#0d5e54]">
                        <Send size={12}/> 回答する
                      </button>
                      <button onClick={() => handleReject(est.id)}
                        className="h-10 px-4 bg-white border border-red-200 text-red-600 text-[12px] font-bold rounded-lg hover:bg-red-50 flex items-center gap-1">
                        <XCircle size={12}/> 却下
                      </button>
                    </div>
                  )}

                  {isEditing && (() => {
                    const total = calcTotal();
                    const totalTax = Math.floor(total * 1.1);
                    const rd = est.request_data || {};
                    const wantsSelfDelivery = rd.deliveryMethod === 'delivery';

                    return (
                    <div className="space-y-4 pt-3 border-t border-[#EAEAEA] bg-[#FBFAF9] -mx-6 px-6 py-4 rounded-b-2xl">
                      <p className="text-[12px] font-bold text-[#117768]">💰 お見積もり料金 内訳</p>

                      {/* 商品代 */}
                      <div>
                        <label className="text-[10px] font-bold text-[#555]">商品代 (税抜) *</label>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-bold">¥</span>
                          <input type="number" value={replyForm.productPrice}
                            onChange={e => setReplyForm({...replyForm, productPrice: e.target.value})}
                            placeholder="例: 5000"
                            className="flex-1 h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[14px] font-bold outline-none focus:border-[#117768]"/>
                        </div>
                      </div>

                      {/* 自社配達対応可否 (お客様が delivery希望時のみ表示) */}
                      {wantsSelfDelivery && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                          <p className="text-[11px] font-bold text-emerald-900">🚚 自社配達のご希望あり - 対応可否を選択</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button"
                              onClick={() => setReplyForm({...replyForm, selfDeliveryAccepted: 'yes', sagawaFee: ''})}
                              className={`p-2.5 rounded-lg border-2 text-[11px] font-bold ${replyForm.selfDeliveryAccepted === 'yes' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-emerald-200 text-emerald-700'}`}>
                              ✅ 対応可能
                            </button>
                            <button type="button"
                              onClick={() => setReplyForm({...replyForm, selfDeliveryAccepted: 'no', selfDeliveryFee: ''})}
                              className={`p-2.5 rounded-lg border-2 text-[11px] font-bold ${replyForm.selfDeliveryAccepted === 'no' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-amber-200 text-amber-700'}`}>
                              ⚠️ 対応不可 (業者配送に切替)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 自社配達料 */}
                      {(replyForm.selfDeliveryAccepted === 'yes' || (!wantsSelfDelivery && rd.deliveryMethod !== 'pickup')) && (
                        <div>
                          <label className="text-[10px] font-bold text-[#555]">🚚 自社配達料 (税抜)</label>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-bold">¥</span>
                            <input type="number" value={replyForm.selfDeliveryFee}
                              onChange={e => setReplyForm({...replyForm, selfDeliveryFee: e.target.value})}
                              placeholder="例: 500"
                              className="flex-1 h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#117768]"/>
                          </div>
                        </div>
                      )}

                      {/* 業者配送料 */}
                      {(replyForm.selfDeliveryAccepted === 'no' || rd.deliveryMethod === 'shipping' || (!wantsSelfDelivery && rd.deliveryMethod !== 'pickup')) && (
                        <div>
                          <label className="text-[10px] font-bold text-[#555]">📦 業者配送料 (税抜)</label>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-bold">¥</span>
                            <input type="number" value={replyForm.sagawaFee}
                              onChange={e => setReplyForm({...replyForm, sagawaFee: e.target.value})}
                              placeholder="例: 1450"
                              className="flex-1 h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#117768]"/>
                          </div>
                        </div>
                      )}

                      {/* 箱代 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-[#555]">📦 箱代 (任意)</label>
                          <input type="number" value={replyForm.boxFee}
                            onChange={e => setReplyForm({...replyForm, boxFee: e.target.value})}
                            placeholder="例: 300"
                            className="w-full h-11 px-3 mt-1 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#117768]"/>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#555]">❄️ クール便代 (任意)</label>
                          <input type="number" value={replyForm.coolFee}
                            onChange={e => setReplyForm({...replyForm, coolFee: e.target.value})}
                            placeholder="例: 220"
                            className="w-full h-11 px-3 mt-1 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#117768]"/>
                        </div>
                      </div>

                      {/* その他料金 */}
                      <div className="grid grid-cols-[1fr_120px] gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-[#555]">📝 その他料金の名称 (任意)</label>
                          <input type="text" value={replyForm.otherFeeNote}
                            onChange={e => setReplyForm({...replyForm, otherFeeNote: e.target.value})}
                            placeholder="例: スタンド料・特別装飾代"
                            className="w-full h-11 px-3 mt-1 bg-white border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#117768]"/>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-[#555]">金額</label>
                          <input type="number" value={replyForm.otherFee}
                            onChange={e => setReplyForm({...replyForm, otherFee: e.target.value})}
                            placeholder="例: 1000"
                            className="w-full h-11 px-3 mt-1 bg-white border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#117768]"/>
                        </div>
                      </div>

                      {/* 合計表示 */}
                      <div className="bg-white border-2 border-[#117768] rounded-xl p-4 text-center space-y-1">
                        <p className="text-[10px] text-[#999]">合計</p>
                        <p className="text-[20px] font-bold text-[#117768]">
                          ¥{totalTax.toLocaleString()} <span className="text-[11px] text-[#999]">(税込)</span>
                        </p>
                        <p className="text-[10px] text-[#555]">税抜: ¥{total.toLocaleString()} + 消費税 ¥{Math.floor(total * 0.1).toLocaleString()}</p>
                      </div>

                      {/* 自動生成ボタン + メッセージ */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-[#555]">💬 回答メッセージ</label>
                          <button type="button"
                            onClick={() => setReplyForm({...replyForm, message: generateMessage(est)})}
                            disabled={total <= 0}
                            className="text-[10px] bg-[#117768]/10 text-[#117768] px-3 py-1 rounded-full font-bold hover:bg-[#117768] hover:text-white disabled:opacity-50">
                            ✨ 内容から自動生成
                          </button>
                        </div>
                        <textarea value={replyForm.message}
                          onChange={e => setReplyForm({...replyForm, message: e.target.value})}
                          rows={10}
                          placeholder="先に料金を入力して「✨ 内容から自動生成」を押すか、手入力してください。"
                          className="w-full px-3 py-2 bg-white border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#117768] resize-none leading-relaxed"/>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)} className="h-10 px-4 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-lg">キャンセル</button>
                        <button onClick={() => handleReply(est.id)}
                          disabled={total <= 0 || !replyForm.message}
                          className="flex-1 h-10 bg-[#117768] text-white text-[12px] font-bold rounded-lg hover:bg-[#0d5e54] flex items-center justify-center gap-1 disabled:opacity-50">
                          <Send size={12}/> 回答メールを送信
                        </button>
                      </div>
                    </div>
                    );
                  })()}

                  {est.status === 'converted' && est.order_id && (
                    <div className="bg-emerald-50 p-3 rounded-lg text-[11px] text-emerald-700">
                      ✅ <strong>正式注文に確定済み</strong> (注文ID: {String(est.order_id).slice(0, 8)})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
