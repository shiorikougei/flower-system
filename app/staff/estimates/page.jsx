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
  const [replyForm, setReplyForm] = useState({ message: '', price: '' });

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

  async function handleReply(id) {
    if (!replyForm.message || !replyForm.price) { alert('回答内容と価格を入力してください'); return; }
    try {
      const res = await fetch('/api/estimates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reply', replyMessage: replyForm.message, proposedPrice: Number(replyForm.price) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingId(null);
      setReplyForm({ message: '', price: '' });
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
                          if (rd.deliveryAddress) fields.push(['お届け先住所', rd.deliveryAddress]);
                          if (rd.recipientName) fields.push(['お届け先お名前', `${rd.recipientName} 様`]);
                          if (rd.flowerType) fields.push(['花の種類', rd.flowerType]);
                          if (rd.colorPreference) fields.push(['色・イメージ', rd.colorPreference]);
                          if (rd.countSpec) fields.push(['本数・サイズ', rd.countSpec]);
                          if (rd.budget) fields.push(['ご予算', rd.budget]);
                          if (rd.cardType && rd.cardType !== 'none') fields.push([cardMap[rd.cardType] || 'カード', rd.cardContent || '（後日相談）']);
                          if (rd.referenceUrls) fields.push(['参考URL', rd.referenceUrls]);
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

                  {est.reply_message && (
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                      <p className="text-[10px] font-bold text-emerald-700 mb-1">店舗回答 (¥{Number(est.proposed_price).toLocaleString()} 税抜)</p>
                      <pre className="text-[12px] text-[#222] whitespace-pre-wrap font-sans leading-relaxed">{est.reply_message}</pre>
                    </div>
                  )}

                  {est.status === 'pending' && !isEditing && (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => { setEditingId(est.id); setReplyForm({ message: '', price: '' }); }}
                        className="flex-1 h-10 bg-[#117768] text-white text-[12px] font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-[#0d5e54]">
                        <Send size={12}/> 回答する
                      </button>
                      <button onClick={() => handleReject(est.id)}
                        className="h-10 px-4 bg-white border border-red-200 text-red-600 text-[12px] font-bold rounded-lg hover:bg-red-50 flex items-center gap-1">
                        <XCircle size={12}/> 却下
                      </button>
                    </div>
                  )}

                  {isEditing && (
                    <div className="space-y-3 pt-2 border-t border-[#EAEAEA]">
                      <div>
                        <label className="text-[10px] font-bold text-[#555]">ご提案金額 (税抜)</label>
                        <input type="number" value={replyForm.price} onChange={e => setReplyForm({...replyForm, price: e.target.value})}
                          placeholder="例: 5000"
                          className="w-full h-11 px-3 mt-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[14px] font-bold outline-none focus:border-[#117768]"/>
                        {replyForm.price && (
                          <p className="text-[10px] text-[#999] mt-1">税込: ¥{(Math.floor(Number(replyForm.price) * 1.1)).toLocaleString()}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#555]">回答メッセージ</label>
                        <textarea value={replyForm.message} onChange={e => setReplyForm({...replyForm, message: e.target.value})}
                          rows={4}
                          placeholder="例: ご依頼ありがとうございます。バラ21本+カスミソウで承ります。受取は6月15日17時で承っております。"
                          className="w-full px-3 py-2 mt-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#117768] resize-none leading-relaxed"/>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingId(null)} className="h-10 px-4 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-lg">キャンセル</button>
                        <button onClick={() => handleReply(est.id)} className="flex-1 h-10 bg-[#117768] text-white text-[12px] font-bold rounded-lg hover:bg-[#0d5e54] flex items-center justify-center gap-1">
                          <Send size={12}/> 回答メールを送信
                        </button>
                      </div>
                    </div>
                  )}

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
