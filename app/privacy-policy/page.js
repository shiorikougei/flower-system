'use client';
import Link from 'next/link';
import { ChevronLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111]">
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-10">
        <div className="max-w-[800px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 戻る
          </Link>
          <h1 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><Shield size={18}/> プライバシーポリシー</h1>
          <div className="w-12"/>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 py-10 space-y-8 text-[13px] leading-relaxed text-[#222]">
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA]">
          <p className="text-[11px] text-[#999] mb-3">最終更新: 2026年5月14日</p>
          <h2 className="text-[18px] font-bold text-[#2D4B3E] mb-2">プライバシーポリシー</h2>
          <p>NocoLde（以下「当社」といいます）が提供する「FLORIX」（以下「本サービス」）における、お客様の個人情報の取り扱いについて、以下のとおり定めます。</p>
        </div>

        <Section title="第1条（個人情報の定義）">
          <p>本プライバシーポリシーにおける「個人情報」とは、個人情報保護法に定める「個人情報」を指し、生存する個人に関する情報であって、氏名・生年月日・住所・電話番号・連絡先その他により特定の個人を識別できる情報、および顔写真・指紋・声紋などの個人識別符号を含むものをいいます。</p>
        </Section>

        <Section title="第2条（取得する個人情報）">
          <p>当社は、本サービスの提供にあたり、以下の個人情報を取得することがあります。</p>
          <ul>
            <li>・氏名、店舗名、屋号</li>
            <li>・メールアドレス、電話番号、住所</li>
            <li>・お支払いに関する情報（請求先情報、振込先情報、決済代行会社を経由した決済情報）</li>
            <li>・本サービス内で登録・送信されたお客様情報（注文者氏名・連絡先・配達先・記念日・LINE ID等）</li>
            <li>・本サービスの利用状況・操作ログ・IPアドレス・Cookie情報</li>
          </ul>
        </Section>

        <Section title="第3条（個人情報の利用目的）">
          <p>取得した個人情報は、以下の目的のために利用します。</p>
          <ul>
            <li>・本サービスの提供、運営、改善のため</li>
            <li>・ご利用料金のご請求、お支払いに関するご案内のため</li>
            <li>・本サービスに関するお知らせ・ご案内の送信のため</li>
            <li>・お客様からのお問い合わせへの対応のため</li>
            <li>・利用規約に違反した場合の対応のため</li>
            <li>・統計データの作成・分析のため（個人を特定しない形に加工した上で）</li>
          </ul>
        </Section>

        <Section title="第4条（第三者提供）">
          <p>当社は、次の場合を除き、お客様の同意なしに個人情報を第三者に提供しません。</p>
          <ul>
            <li>・法令に基づく場合</li>
            <li>・人の生命、身体または財産の保護のために必要がある場合</li>
            <li>・公衆衛生の向上または児童の健全な育成の推進のために必要がある場合</li>
            <li>・国の機関等の法令に基づく事務遂行に協力する必要がある場合</li>
            <li>・利用目的の達成に必要な範囲で個人情報の取り扱いを業務委託先に委託する場合（決済代行会社・メール送信サービス・クラウドインフラ等）</li>
          </ul>
          <p className="pt-2 text-[12px] text-[#555]">なお、本サービスでは以下の外部サービスを利用しています:</p>
          <ul>
            <li>・<strong>Supabase（データベース・認証）</strong>: 米国法人による提供。本サービスのデータが保管されます。</li>
            <li>・<strong>Vercel（アプリケーション配信）</strong>: 米国法人による提供。</li>
            <li>・<strong>Stripe（決済処理）</strong>: アイルランド法人による提供。クレジットカード決済時のカード情報を取り扱います。</li>
            <li>・<strong>Resend（メール配信）</strong>: 米国法人による提供。メール送信を行います。</li>
            <li>・<strong>OpenAI（AI機能）</strong>: 米国法人による提供。キャプション自動生成等で利用するテキストデータを処理します。</li>
            <li>・<strong>LINE Messaging API（LINE株式会社）</strong>: LINE連携時の通知送信に利用します。</li>
          </ul>
        </Section>

        <Section title="第5条（個人情報の管理）">
          <p>当社は、個人情報の漏洩、滅失または毀損の防止その他の個人情報の安全管理のため、必要かつ適切な措置を講じます。</p>
          <p>個人情報の保管にあたっては、SSL/TLSによる通信暗号化、データベースのアクセス制御（RLS）、業務上必要な担当者以外のアクセス制限などを行います。</p>
        </Section>

        <Section title="第6条（個人情報の開示・訂正・削除）">
          <p>お客様は、当社が保有するご自身の個人情報の開示・訂正・利用停止・削除を請求することができます。</p>
          <p>ご請求は下記お問い合わせ先までご連絡ください。本人確認の上、合理的な期間内に対応いたします。</p>
        </Section>

        <Section title="第7条（Cookie等の利用）">
          <p>本サービスではセッション管理・ログイン状態の維持・利便性向上のため Cookie および類似技術（localStorage、sessionStorage 等）を利用します。Cookie の受け入れは、お使いのブラウザの設定で拒否することも可能ですが、一部機能が利用できなくなる場合があります。</p>
        </Section>

        <Section title="第8条（解約後のデータ取り扱い）">
          <p>本サービスを解約された場合、お客様データは <strong>3ヶ月間</strong> 保管され、その後完全に削除いたします。3ヶ月以内であれば、ご請求によりデータの返却・復旧が可能です。</p>
        </Section>

        <Section title="第9条（プライバシーポリシーの変更）">
          <p>当社は、必要に応じて本プライバシーポリシーを変更することがあります。重要な変更がある場合は、本サービス内またはメールにてお知らせします。</p>
        </Section>

        <Section title="第10条（お問い合わせ窓口）">
          <p>個人情報の取り扱いに関するお問い合わせは、下記までご連絡ください。</p>
          <p><strong>NocoLde</strong><br/>Email: marusyou.reishin@gmail.com</p>
        </Section>

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
