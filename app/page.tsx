// [緊急] ルートページ
// www.noodleflorix.com アクセス時のランディングページ
// Google Search Console の所有権確認にも必要（meta タグは layout.tsx で挿入済み）

import Link from "next/link";

export const metadata = {
  title: "FLORIX | お花屋さん向けクラウド業務システム",
  description: "FLORIXは、お花屋さんの注文管理・EC・顧客管理・スタッフ管理を一括で提供するクラウド型業務システムです。NocoLdeが提供。",
  openGraph: {
    title: "FLORIX | お花屋さん向けクラウド業務システム",
    description: "お花屋さんの業務を、もっとスマートに。NocoLdeが提供するクラウドSaaS。",
    url: "https://www.noodleflorix.com",
    siteName: "FLORIX",
    locale: "ja_JP",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FBFAF9] to-white text-[#111111] font-sans">
      {/* ヒーロー */}
      <section className="max-w-[1100px] mx-auto px-6 py-20 md:py-32 text-center">
        <div className="inline-block bg-[#2D4B3E]/5 text-[#2D4B3E] px-4 py-1.5 rounded-full text-[12px] font-bold tracking-wider mb-6">
          🌸 お花屋さん向けクラウドSaaS
        </div>
        <h1 className="text-[36px] md:text-[60px] font-bold text-[#2D4B3E] leading-tight mb-6">
          お花屋さんの業務を、
          <br className="hidden md:block" />
          もっとスマートに。
        </h1>
        <p className="text-[14px] md:text-[16px] text-[#555555] leading-relaxed max-w-2xl mx-auto mb-10">
          注文管理・EC・顧客管理・スタッフ管理・売上分析・LINE連携。
          <br />
          お花屋さんに必要な機能を、ひとつにまとめたクラウド型業務システム。
        </p>
        <div className="flex flex-col md:flex-row gap-3 justify-center">
          <Link
            href="/staff/login"
            className="inline-block px-8 py-4 bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold hover:bg-[#1f352b] transition-all shadow-md"
          >
            管理画面にログイン
          </Link>
          <a
            href="mailto:marusyou.reishin@gmail.com"
            className="inline-block px-8 py-4 bg-white border border-[#EAEAEA] text-[#2D4B3E] rounded-xl text-[13px] font-bold hover:border-[#2D4B3E] transition-all"
          >
            お問い合わせ
          </a>
        </div>
      </section>

      {/* 機能一覧 */}
      <section className="max-w-[1100px] mx-auto px-6 py-12 md:py-20">
        <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E] text-center mb-12">
          FLORIXでできること
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { emoji: "📦", title: "注文管理", desc: "受注・進捗管理から印刷帳票まで。お客様への通知も自動化。" },
            { emoji: "🛍️", title: "EC機能", desc: "商品カタログ・カート・クレカ決済・在庫管理を標準装備。" },
            { emoji: "💬", title: "見積もり・LINE連携", desc: "お見積もり依頼の受付からLINEでの進捗通知まで。" },
            { emoji: "👥", title: "顧客管理 (CRM)", desc: "リピート促進・記念日マーケ・購入履歴の分析。" },
            { emoji: "📊", title: "売上分析", desc: "月別・日別売上、未入金管理、レポート出力。" },
            { emoji: "🔐", title: "セキュリティ", desc: "2FA・PIN認証・監査ログ・個人情報保護。安心して使えます。" },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white border border-[#EAEAEA] rounded-2xl p-6 hover:shadow-md transition-all"
            >
              <div className="text-[36px] mb-3">{f.emoji}</div>
              <h3 className="text-[16px] font-bold text-[#111111] mb-2">{f.title}</h3>
              <p className="text-[12px] text-[#555555] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* フッター */}
      <footer className="mt-20 border-t border-[#EAEAEA] py-10">
        <div className="max-w-[1100px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="font-bold text-[#2D4B3E] text-[16px]">FLORIX</div>
            <div className="text-[11px] text-[#999]">© 2026 NocoLde. All rights reserved.</div>
          </div>
          <nav className="flex gap-5 text-[12px] text-[#555]" aria-label="フッターメニュー">
            <Link href="/privacy" className="hover:text-[#2D4B3E]">プライバシーポリシー</Link>
            <a href="mailto:marusyou.reishin@gmail.com" className="hover:text-[#2D4B3E]">お問い合わせ</a>
            <Link href="/staff/login" className="hover:text-[#2D4B3E]">管理者ログイン</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
