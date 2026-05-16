'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, Send, CheckCircle2 } from 'lucide-react';

export default function EstimatePage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';

  const [appSettings, setAppSettings] = useState(null);
  const [form, setForm] = useState({
    customerName: '', customerEmail: '', customerPhone: '',
    requestContent: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
        if (data?.settings_data) setAppSettings(data.settings_data);
      } catch {}
    })();
  }, [tenantId]);

  const appName = appSettings?.generalConfig?.appName || 'FLORIX';

  async function handleSubmit() {
    setError('');
    if (!form.customerName || !form.customerEmail || !form.requestContent) {
      setError('お名前・メール・ご依頼内容は必須です');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId, shopId,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '送信に失敗しました');
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-[#EAEAEA] text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-600"/>
          </div>
          <h1 className="text-[18px] font-bold text-[#2D4B3E]">お見積もりのご依頼を受け付けました</h1>
          <p className="text-[12px] text-[#555] leading-relaxed">
            内容を確認の上、お見積もり結果をご登録のメールアドレス宛にお送りいたします。<br/>
            通常 1〜2営業日以内にご連絡いたします🌸
          </p>
          <Link href={`/order/${tenantId}/${shopId}`} className="inline-block px-6 h-12 leading-[48px] bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold">
            トップに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-20">
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-10">
        <div className="max-w-[700px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={`/order/${tenantId}/${shopId}`} className="flex items-center gap-1 text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 戻る
          </Link>
          <span className="font-serif font-bold text-[16px] text-[#2D4B3E]">{appName}</span>
          <div className="w-12"/>
        </div>
      </header>

      <main className="max-w-[700px] mx-auto px-6 py-10 space-y-6">
        <div>
          <p className="text-[11px] text-[#117768] font-bold tracking-widest">ESTIMATE</p>
          <h1 className="text-[24px] font-bold text-[#2D4B3E] mt-1">お見積もり依頼フォーム</h1>
          <p className="text-[12px] text-[#555] mt-2 leading-relaxed">
            以下のようなご依頼におすすめです：<br/>
            ・バラ12本／99本など本数指定<br/>
            ・複数の花束・アレンジを同時にご注文<br/>
            ・予算がわからない／参考写真からのお見積もり<br/>
            ・お供え花・プリザーブド加工等の特別なご依頼
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">お名前 <span className="text-red-500">*</span></label>
            <input type="text" value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})}
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#117768]"/>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">メールアドレス <span className="text-red-500">*</span></label>
            <input type="email" value={form.customerEmail} onChange={e => setForm({...form, customerEmail: e.target.value})}
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#117768]"/>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">お電話番号 <span className="text-[10px] text-[#999]">(任意)</span></label>
            <input type="tel" value={form.customerPhone} onChange={e => setForm({...form, customerPhone: e.target.value})}
              className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#117768]"/>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#555]">ご依頼内容 <span className="text-red-500">*</span></label>
            <textarea value={form.requestContent} onChange={e => setForm({...form, requestContent: e.target.value})}
              rows={8}
              placeholder="例: 6月15日に赤いバラ21本の花束をお願いしたいです。受取は当日17時頃、店頭引取り。&#10;予算は5,000〜8,000円くらいでお願いします。&#10;ピンクのカスミソウも入れていただけると嬉しいです。"
              className="w-full px-4 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#117768] resize-none leading-relaxed"/>
          </div>
          {error && <p className="text-[12px] text-red-600 font-bold">{error}</p>}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full h-14 bg-[#117768] hover:bg-[#0d5e54] text-white rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50">
            <Send size={16}/> {submitting ? '送信中...' : 'お見積もりを依頼する'}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-[11px] text-blue-900 leading-relaxed">
          💡 通常 1〜2 営業日以内にメールでお見積もり結果をご連絡いたします。<br/>
          内容にご納得いただいてから正式注文への変換が可能です。
        </div>
      </main>
    </div>
  );
}
