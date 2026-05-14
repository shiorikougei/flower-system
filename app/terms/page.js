'use client';
import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, FileText, AlertCircle, Send, CheckCircle2 } from 'lucide-react';

export default function TermsPage() {
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelForm, setCancelForm] = useState({ tenantName: '', email: '', reason: '', wishMonth: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submitCancel() {
    if (!cancelForm.tenantName || !cancelForm.email) {
      alert('店舗名・連絡先メールアドレスを入力してください');
      return;
    }
    setSending(true);
    try {
      // ログイン中ならテナントID取得
      let tenantId = '';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
          tenantId = profile?.tenant_id || '';
        }
      } catch {}

      const res = await fetch('/api/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cancel',
          tenantId,
          tenantName: cancelForm.tenantName,
          subject: `${cancelForm.tenantName} から解約申請`,
          body: `店舗名: ${cancelForm.tenantName}\n連絡先: ${cancelForm.email}\n希望解約月: ${cancelForm.wishMonth || '未指定'}\n\n【理由】\n${cancelForm.reason || '(記載なし)'}`,
          metadata: { cancelForm },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (e) { alert('送信失敗: ' + e.message); }
    finally { setSending(false); }
  }

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111]">
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-10">
        <div className="max-w-[800px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 戻る
          </Link>
          <h1 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><FileText size={18}/> 利用規約</h1>
          <div className="w-12"/>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 py-10 space-y-8 text-[13px] leading-relaxed text-[#222]">
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA]">
          <p className="text-[11px] text-[#999] mb-3">最終更新: 2026年5月14日</p>
          <h2 className="text-[18px] font-bold text-[#2D4B3E] mb-2">FLORIX 利用規約</h2>
          <p>NocoLde（以下「当社」）が提供する「FLORIX」（以下「本サービス」）の利用規約を定めます。本サービスの利用にあたっては、本規約に同意いただいたものとみなします。</p>
        </div>

        <Section title="第1条（本サービスについて）">
          <p>本サービスは、お花屋さん向けの注文管理・EC・顧客管理・スタッフ管理・決済機能などを提供するクラウド型SaaSです。</p>
          <p>当社は本サービスの内容を予告なく変更・追加・廃止することがあります。</p>
        </Section>

        <Section title="第2条（契約期間とサブスクリプション）">
          <p>本サービスは月額課金制のサブスクリプションです。</p>
          <ul>
            <li>・契約は1ヶ月単位で自動更新されます。</li>
            <li>・利用料金は基本料金 + 有効化された機能ごとの追加料金の合計です。</li>
            <li>・モデル店舗等、特別契約の場合は手動設定された固定料金が適用されます。</li>
          </ul>
        </Section>

        <Section title="第3条（料金の支払い）">
          <p>毎月1日に翌月分の請求書を「請求先メールアドレス」宛にお送りします。</p>
          <p>お支払い期日は <strong>翌月末日</strong> です。期日を過ぎた場合、サービスの一時停止をさせていただく場合があります。</p>
          <p>消費税は別途加算されます。</p>
        </Section>

        <Section title="第4条（解約について）">
          <p>解約をご希望の場合は <strong>解約希望月の前月末日</strong> までに、下記の解約フォーム または marusyou.reishin@gmail.com までご連絡ください。</p>
          <ul>
            <li>・解約は申請月の翌月末で完了し、それまでは通常通りご利用いただけます。</li>
            <li>・月の途中で解約しても、当月分の日割り返金は致しません。</li>
            <li>・解約後、データは <strong>3ヶ月間</strong> 保管されます。期間内は復旧可能です。</li>
            <li>・3ヶ月経過後、データは完全に削除されます。</li>
          </ul>
        </Section>

        <Section title="第5条（機能の追加・解除）">
          <p>機能のオプション追加・解除は <strong>管理者</strong> までお問い合わせください。下記「機能アップグレード」フォームから即時申し込みも可能です。</p>
          <p>月の途中で機能追加のご依頼があった場合は、原則 <strong>即時実装・即時開放</strong> いたします。</p>
          <p>当月分はお試し期間としてサービスし、料金は <strong>翌月分から発生</strong> いたします。</p>
        </Section>

        <Section title="第6条（データの取り扱い）">
          <p>本サービスで保存される注文データ・顧客データ・売上データは、お客様店舗の所有物です。</p>
          <p>当社は法令に基づく場合を除き、データを第三者に開示しません。</p>
          <p>店舗側でお客様情報を取り扱う際は、店舗が独自に定めるプライバシーポリシーに従ってください。</p>
        </Section>

        <Section title="第7条（禁止事項）">
          <ul>
            <li>・本サービスを違法な目的で利用すること</li>
            <li>・他のお客様や第三者の権利を侵害する行為</li>
            <li>・本サービスのリバースエンジニアリング、複製、再配布</li>
            <li>・スパム送信や大量メール送信（法令違反となる態様）</li>
            <li>・その他、当社が不適切と判断する行為</li>
          </ul>
        </Section>

        <Section title="第8条（免責事項）">
          <p>本サービスは「現状有姿」で提供されます。</p>
          <ul>
            <li>・天災・通信障害・システム障害等によるサービス中断について、当社は責任を負いません。</li>
            <li>・本サービスを利用したことで生じた間接損害について、当社は責任を負いません。</li>
            <li>・給与計算機能は概算であり、最終的な給与額の確定は社会保険労務士等専門家にご確認ください。</li>
          </ul>
        </Section>

        <Section title="第9条（規約の変更）">
          <p>当社は本規約を必要に応じて変更することがあります。変更後の規約はオーナーページより通知し、変更後にサービスをご利用いただいた場合、新規約に同意したものとみなします。</p>
        </Section>

        <Section title="第10条（お問い合わせ）">
          <p>本サービスに関するお問い合わせは下記までご連絡ください。</p>
          <p><strong>NocoLde</strong><br/>Email: marusyou.reishin@gmail.com</p>
        </Section>

        {/* ★ 解約申請フォーム */}
        <div className="bg-red-50 p-6 rounded-2xl border-2 border-red-200 space-y-3">
          <h3 className="text-[14px] font-bold text-red-700 flex items-center gap-2"><AlertCircle size={16}/> 解約申請フォーム</h3>
          <p className="text-[11px] text-red-900 leading-relaxed">
            解約をご希望の場合は下記フォームから申請してください。<br/>
            管理者に通知が届き、確認後ご連絡いたします。
          </p>

          {!showCancelForm && !sent && (
            <button onClick={() => setShowCancelForm(true)} className="px-4 py-2 bg-red-600 text-white text-[12px] font-bold rounded-lg hover:bg-red-700">
              解約申請を開く
            </button>
          )}

          {showCancelForm && !sent && (
            <div className="bg-white p-4 rounded-xl border border-red-200 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#555] tracking-widest">店舗名 <span className="text-red-500">*</span></label>
                <input type="text" value={cancelForm.tenantName} onChange={e => setCancelForm({...cancelForm, tenantName: e.target.value})}
                  className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-red-400"/>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#555] tracking-widest">連絡先メールアドレス <span className="text-red-500">*</span></label>
                <input type="email" value={cancelForm.email} onChange={e => setCancelForm({...cancelForm, email: e.target.value})}
                  className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-red-400"/>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#555] tracking-widest">希望解約月（任意）</label>
                <input type="month" value={cancelForm.wishMonth} onChange={e => setCancelForm({...cancelForm, wishMonth: e.target.value})}
                  className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-red-400"/>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#555] tracking-widest">解約理由（任意・差し支えなければ）</label>
                <textarea value={cancelForm.reason} onChange={e => setCancelForm({...cancelForm, reason: e.target.value})}
                  rows={3} placeholder="使い勝手・料金・他社サービスへの移行など、サービス改善の参考にさせていただきます"
                  className="w-full mt-1 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-red-400 leading-relaxed"/>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCancelForm(false)} className="flex-1 h-11 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-lg">キャンセル</button>
                <button onClick={submitCancel} disabled={sending} className="flex-[2] h-11 bg-red-600 text-white text-[12px] font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Send size={14}/> {sending ? '送信中...' : '解約申請を送信'}
                </button>
              </div>
            </div>
          )}

          {sent && (
            <div className="bg-white p-5 rounded-xl border border-green-200 text-center space-y-2">
              <CheckCircle2 size={36} className="mx-auto text-green-600"/>
              <p className="text-[13px] font-bold text-green-700">解約申請を受け付けました</p>
              <p className="text-[11px] text-[#555] leading-relaxed">管理者に通知が届きました。<br/>2営業日以内にご連絡いたします。</p>
            </div>
          )}
        </div>

        <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] text-[11px] text-[#555] text-center">
          以上
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-2">
      <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2">{title}</h3>
      <div className="space-y-2 text-[12px] leading-relaxed">{children}</div>
    </div>
  );
}
