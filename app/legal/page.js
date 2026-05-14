'use client';
import Link from 'next/link';
import { ChevronLeft, ScrollText } from 'lucide-react';

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111]">
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-10">
        <div className="max-w-[800px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1 text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 戻る
          </Link>
          <h1 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><ScrollText size={18}/> 特定商取引法に基づく表記</h1>
          <div className="w-12"/>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 py-10 space-y-6 text-[13px] leading-relaxed text-[#222]">
        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA]">
          <p className="text-[11px] text-[#999] mb-3">最終更新: 2026年5月14日</p>
          <h2 className="text-[18px] font-bold text-[#2D4B3E] mb-2">特定商取引法に基づく表記</h2>
          <p>「FLORIX」（以下「本サービス」）の特定商取引法（特定商取引に関する法律）に基づく表記を下記のとおり明示いたします。</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA]">
          <table className="w-full text-[12px] leading-relaxed">
            <tbody className="divide-y divide-[#FBFAF9]">
              <Row label="販売事業者">NocoLde（ノコルデ）</Row>
              <Row label="運営責任者">齋藤 玲心（さいとう れいしん）</Row>
              <Row label="所在地">
                ご請求があった場合は遅滞なく開示いたします。<br/>
                <span className="text-[11px] text-[#999]">下記お問い合わせ先までご連絡ください。</span>
              </Row>
              <Row label="電話番号">
                ご請求があった場合は遅滞なく開示いたします。<br/>
                <span className="text-[11px] text-[#999]">お問い合わせは原則メールにてお願いいたします。</span>
              </Row>
              <Row label="メールアドレス">marusyou.reishin@gmail.com</Row>
              <Row label="販売価格">
                各機能の利用料金は、サブスクリプション管理画面および「機能アップグレード」フォーム内に表示します。<br/>
                基本料金 + 選択した機能ごとの月額料金の合計となります（税込）。
              </Row>
              <Row label="商品代金以外の必要料金">
                インターネット接続費用、通信費、その他本サービスのご利用にあたって発生する費用はお客様のご負担となります。<br/>
                銀行振込でお支払いの場合の振込手数料はお客様のご負担となります。
              </Row>
              <Row label="お支払い方法">
                銀行振込<br/>
                <span className="text-[11px] text-[#999]">（クレジットカード決済は今後対応予定）</span>
              </Row>
              <Row label="お支払い時期">
                毎月1日に翌月分の請求書をメールにてお送りいたします。お支払い期日は<strong>請求書送付月の末日</strong>です。
              </Row>
              <Row label="商品の引渡時期">
                本サービスは月額サブスクリプション型のクラウドサービスです。アカウント発行後、即時ご利用いただけます。
                ご契約中の機能追加は、原則として即時実装・即時開放いたします。
              </Row>
              <Row label="返品・解約について">
                本サービスは月額サブスクリプションのため、原則として返金はいたしません。<br/>
                解約をご希望の場合は、<Link href="/terms" className="text-[#117768] underline">利用規約</Link>に従って解約申請をお願いいたします。<br/>
                <span className="text-[11px] text-[#999]">月の途中で解約された場合の日割り返金は行っておりません。</span>
              </Row>
              <Row label="動作環境">
                推奨ブラウザ: Google Chrome、Safari、Microsoft Edge の各最新版。<br/>
                インターネットに接続されたPC・タブレット・スマートフォンでご利用いただけます。
              </Row>
            </tbody>
          </table>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[11px] text-amber-900 leading-relaxed">
          ※ ご利用前に必ず <Link href="/terms" className="underline font-bold">利用規約</Link> および <Link href="/privacy-policy" className="underline font-bold">プライバシーポリシー</Link> をご確認ください。
        </div>
      </main>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <tr>
      <th className="py-3 px-2 text-left align-top w-[35%] md:w-[28%] text-[11px] font-bold text-[#555] tracking-widest">{label}</th>
      <td className="py-3 px-2 align-top text-[#222] leading-relaxed">{children}</td>
    </tr>
  );
}
