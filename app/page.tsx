// [LP-#36/#41] FLORIX LP - 花屋オーナー向けSaaS紹介ページ
// トーン: 親しみ・温かみ（中小店舗オーナー向け）
// CTA: お問い合わせフォーム
// 料金: オーナー管理画面(/owner)から動的に反映

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LP_PRICING, fetchLpPricing } from "@/utils/lpPricing";

// LP料金プランの型（lpPricing.jsから来るがTS用に明示）
type LpPlan = {
  name: string;
  subtitle: string;
  price: number | null;
  priceText?: string;
  recommended?: boolean;
  features: string[];
};
type LpPricing = {
  plans: LpPlan[];
  note?: string;
  trialDays?: number;
};

// 1時間ごとに再ビルド（オーナー画面で料金変更したら最大1時間で反映）
export const revalidate = 3600;

export const metadata = {
  title: "FLORIX | 花屋さんのための、やさしいクラウド業務システム",
  description:
    "「もう、紙とExcelに戻れない」現場の花屋さんが作った、花屋さんのための業務システム。ご注文・配達・EC・顧客管理・スタッフ管理を、ひとつに。月額¥3,800〜",
  openGraph: {
    title: "FLORIX | 花屋さんのための、やさしいクラウド業務システム",
    description: "ご注文・配達・EC・顧客管理を、ひとつに。月額¥3,800〜。30日間無料トライアル。",
    url: "https://www.noodleflorix.com",
    siteName: "FLORIX",
    locale: "ja_JP",
    type: "website",
    images: [
      {
        url: "https://www.noodleflorix.com/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "FLORIX - 花屋さんのためのクラウド業務システム",
      },
    ],
  },
};

// SoftwareApplication JSON-LD
const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FLORIX",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "花屋さん向けのクラウド業務管理システム。ご注文・配達・EC・顧客管理・スタッフ管理を統合。",
  offers: {
    "@type": "Offer",
    price: "3800",
    priceCurrency: "JPY",
  },
  provider: {
    "@type": "Organization",
    name: "NocoLde",
    url: "https://www.noodleflorix.com",
  },
};

async function getLpData(): Promise<{ pricing: LpPricing }> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { pricing: DEFAULT_LP_PRICING as LpPricing };
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const pricing = await fetchLpPricing(supabaseAdmin);
    return { pricing: pricing as LpPricing };
  } catch {
    return { pricing: DEFAULT_LP_PRICING as LpPricing };
  }
}

export default async function HomePage() {
  const { pricing } = await getLpData();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111]">
        {/* ナビゲーション */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
          <div className="max-w-[1100px] mx-auto h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[20px]">🌸</span>
              <span className="font-serif font-bold text-[20px] text-[#2D4B3E]">FLORIX</span>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <a href="#features" className="hidden md:block text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">機能</a>
              <a href="#pricing" className="hidden md:block text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">料金</a>
              <a href="#faq" className="hidden md:block text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">よくある質問</a>
              <Link href="/staff/login" className="text-[11px] font-bold text-[#555] hover:text-[#2D4B3E] px-3 py-1.5">
                ログイン
              </Link>
              <a
                href="#contact"
                className="text-[12px] font-bold bg-[#2D4B3E] text-white px-4 py-2 rounded-xl hover:bg-[#1f352b] transition-all"
              >
                お問い合わせ
              </a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="py-16 md:py-24 px-6">
          <div className="max-w-[900px] mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#FCEDD4] rounded-full text-[11px] font-bold text-[#8B6F2C] mb-6">
              🌷 花屋さんのため "だけ" に作りました
            </div>
            <h1 className="text-[32px] md:text-[48px] font-bold text-[#2D4B3E] leading-[1.3] mb-5 font-serif">
              紙とExcelで、もう<br className="md:hidden"/>消耗しない。<br/>
              <span className="text-[#D97D54]">花屋さんのための</span><br className="md:hidden"/>
              やさしい業務システム。
            </h1>
            <p className="text-[14px] md:text-[16px] text-[#555] leading-[1.9] mb-8 max-w-[640px] mx-auto">
              ご注文・配達・EC販売・顧客管理・スタッフ管理を、ひとつに。<br/>
              現場の花屋さんと一緒に作った、迷わず使えるクラウドシステムです。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a
                href="#contact"
                className="w-full sm:w-auto px-8 h-14 bg-[#2D4B3E] text-white rounded-2xl text-[14px] font-bold hover:bg-[#1f352b] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2D4B3E]/20"
              >
                🌸 お気軽にご相談ください
              </a>
              <a
                href="#features"
                className="w-full sm:w-auto px-8 h-14 bg-white border-2 border-[#2D4B3E] text-[#2D4B3E] rounded-2xl text-[14px] font-bold hover:bg-[#FBFAF9] transition-all flex items-center justify-center"
              >
                できることを見る ↓
              </a>
            </div>
            <p className="text-[11px] text-[#999] mt-6">
              ✓ 30日間無料トライアル ✓ クレジットカード不要 ✓ 導入サポート付き
            </p>
          </div>
        </section>

        {/* 課題提起 */}
        <section className="py-16 md:py-20 px-6 bg-white">
          <div className="max-w-[900px] mx-auto">
            <p className="text-center text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">CONCERNS</p>
            <h2 className="text-[24px] md:text-[32px] font-bold text-center text-[#2D4B3E] mb-12 font-serif">
              こんなお悩み、ありませんか？
            </h2>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { emoji: "📝", title: "電話の受注メモが、行方不明", text: "走り書きのメモが束になって、誰宛か、いつまでか、わからなくなる…" },
                { emoji: "🚛", title: "配達ルートの組み立てが、大変", text: "毎朝、地図を見ながら手書きで配達順を決めている。ミスも多い…" },
                { emoji: "💐", title: "立札の文字入れが、毎回めんどう", text: "「祝 御開店」「ご贈答」と何度も手書き。連名も間違えやすい…" },
                { emoji: "📞", title: "営業時間外のお問い合わせ、取りこぼし", text: "夜中の注文に対応できず、お客様を逃しているかも…" },
                { emoji: "📊", title: "売上の集計、月末に毎回ヒイヒイ", text: "Excelに転記して、計算して、確定申告も大変。" },
                { emoji: "👥", title: "スタッフ間の情報共有、できてない", text: "シフトも勤怠も、口頭で確認。誰がいつ働いたか、覚えていない。" },
              ].map((c, idx) => (
                <div key={idx} className="bg-[#FBFAF9] rounded-2xl p-6 border border-[#EAEAEA]">
                  <div className="text-[36px] mb-3">{c.emoji}</div>
                  <h3 className="text-[15px] font-bold text-[#2D4B3E] mb-2">{c.title}</h3>
                  <p className="text-[12px] text-[#555] leading-[1.8]">{c.text}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-[14px] font-bold text-[#2D4B3E] mt-10 leading-[1.8]">
              わかります。<br className="md:hidden"/>
              <span className="text-[#D97D54]">FLORIX</span>なら、ぜんぶ <span className="underline decoration-[#D97D54] decoration-2 underline-offset-4">ひとつに</span>。
            </p>
          </div>
        </section>

        {/* 機能セクション */}
        <section id="features" className="py-16 md:py-24 px-6">
          <div className="max-w-[1100px] mx-auto">
            <p className="text-center text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">FEATURES</p>
            <h2 className="text-[24px] md:text-[32px] font-bold text-center text-[#2D4B3E] mb-3 font-serif">
              できること、ぜんぶ盛り込みました
            </h2>
            <p className="text-center text-[13px] text-[#555] mb-12 leading-[1.8]">
              花屋さんの1日の業務を、まるごとサポートします。
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: "📥", title: "ご注文管理", desc: "電話・LINE・店頭・ECなど、複数チャネルのご注文を一元管理。納期カレンダー付き。", tags: ["納期管理", "立札自動生成", "領収書発行"] },
                { icon: "🛒", title: "オンラインショップ（EC）", desc: "ホームページがなくても、すぐにEC開設。クレジット決済・在庫管理つき。SEO対策も自動。", tags: ["EC", "Stripe決済", "SEO最適化"] },
                { icon: "🚚", title: "配達管理", desc: "配達順・ドライバー・到着予定時刻を地図ビューで管理。お客様への通知も自動。", tags: ["ルート最適化", "Googleマップ連携", "LINE通知"] },
                { icon: "👤", title: "顧客管理", desc: "ご注文履歴・お誕生日・記念日も自動で蓄積。リピート促進メッセージも送れます。", tags: ["記念日リマインダー", "誕生日メッセージ"] },
                { icon: "👨‍🍳", title: "スタッフ・シフト管理", desc: "シフト調整・出退勤打刻・PIN認証で安全に。役割ごとのアクセス権限管理。", tags: ["勤怠記録", "PIN認証", "役割別権限"] },
                { icon: "📊", title: "売上・経営分析", desc: "日次・月次の売上を自動集計。商品別・店舗別・スタッフ別の分析も簡単に。", tags: ["売上ダッシュボード", "売上集計"] },
                { icon: "📱", title: "QRコード在庫管理", desc: "店頭の商品にQR貼付。スキャンで在庫確認・販売登録（PIN認証）。", tags: ["QR印刷", "リアルタイム在庫"] },
                { icon: "📖", title: "ブログ・FAQ", desc: "SEO対策のためのブログ機能・よくある質問ページ。Google検索からの集客に。", tags: ["SEO対策", "ブログ", "FAQ"] },
              ].map((f, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-6 border border-[#EAEAEA] hover:border-[#2D4B3E] transition-all">
                  <div className="flex items-start gap-4">
                    <div className="text-[40px] shrink-0">{f.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-[16px] font-bold text-[#2D4B3E] mb-2">{f.title}</h3>
                      <p className="text-[12px] text-[#555] leading-[1.8] mb-3">{f.desc}</p>
                      <div className="flex gap-2 flex-wrap">
                        {f.tags.map(t => (
                          <span key={t} className="text-[10px] bg-[#FBFAF9] text-[#666] px-2 py-0.5 rounded-full">#{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 安心ポイント */}
        <section className="py-16 md:py-20 px-6 bg-[#FCF8F3]">
          <div className="max-w-[900px] mx-auto">
            <p className="text-center text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">SAFETY</p>
            <h2 className="text-[24px] md:text-[32px] font-bold text-center text-[#2D4B3E] mb-12 font-serif">
              花屋さんの "大事なもの"、しっかり守ります
            </h2>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: "🔐", title: "お客様情報の暗号化", desc: "電話番号・住所等の個人情報は、データベース上で暗号化して保管。" },
                { icon: "🛡️", title: "二段階認証 / セキュリティ強化", desc: "ログインに2FA対応。第三者からの不正アクセスを防ぎます。" },
                { icon: "💾", title: "自動バックアップ", desc: "データは毎日自動でバックアップ。万が一の操作ミスでも復元可能。" },
                { icon: "📜", title: "操作履歴 / 監査ログ", desc: "誰がいつ何をしたか、すべて記録。トラブル時の原因追跡もスムーズ。" },
                { icon: "💬", title: "日本語サポート", desc: "わからないことは、いつでもチャット・電話でご相談ください。" },
                { icon: "🌱", title: "現場の声で進化", desc: "実際に使う花屋さんの意見で改善し続けます。" },
              ].map((s, idx) => (
                <div key={idx} className="text-center">
                  <div className="text-[40px] mb-3">{s.icon}</div>
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] mb-2">{s.title}</h3>
                  <p className="text-[12px] text-[#555] leading-[1.8]">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 料金 */}
        <section id="pricing" className="py-16 md:py-24 px-6">
          <div className="max-w-[900px] mx-auto">
            <p className="text-center text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">PRICING</p>
            <h2 className="text-[24px] md:text-[32px] font-bold text-center text-[#2D4B3E] mb-3 font-serif">
              わかりやすい料金プラン
            </h2>
            <p className="text-center text-[13px] text-[#555] mb-12 leading-[1.8]">
              小さなお店から、複数店舗の事業者さままで。
            </p>

            <div className="grid md:grid-cols-3 gap-5">
              {pricing.plans.map((plan: LpPlan, idx: number) => {
                const isRecommended = plan.recommended;
                const priceDisplay = plan.priceText
                  ? plan.priceText
                  : (plan.price != null ? `¥${Number(plan.price).toLocaleString()}` : "お問い合わせ");
                const isCustomPriceText = !!plan.priceText || plan.price == null;
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl p-6 relative ${
                      isRecommended
                        ? "bg-[#2D4B3E] text-white border border-[#2D4B3E] scale-105 shadow-xl shadow-[#2D4B3E]/20"
                        : "bg-white border border-[#EAEAEA]"
                    }`}
                  >
                    {isRecommended && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D97D54] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                        ⭐ 人気No.1
                      </span>
                    )}
                    <h3 className={`text-[16px] font-bold mb-1 ${isRecommended ? "" : "text-[#2D4B3E]"}`}>
                      {plan.name}
                    </h3>
                    <p className={`text-[11px] mb-4 ${isRecommended ? "text-white/70" : "text-[#999]"}`}>
                      {plan.subtitle}
                    </p>
                    <div className="mb-5">
                      <span className={`${isCustomPriceText ? "text-[24px]" : "text-[36px]"} font-bold ${isRecommended ? "" : "text-[#2D4B3E]"}`}>
                        {priceDisplay}
                      </span>
                      {!isCustomPriceText && (
                        <span className={`text-[12px] ${isRecommended ? "text-white/70" : "text-[#555]"}`}>
                          /月（税抜）
                        </span>
                      )}
                    </div>
                    <ul className={`space-y-2 mb-5 text-[12px] ${isRecommended ? "" : "text-[#555]"}`}>
                      {(plan.features || []).map((f: string, fi: number) => (
                        <li key={fi}>✓ {f}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {pricing.note && (
              <p className="text-center text-[12px] text-[#666] mt-8" dangerouslySetInnerHTML={{
                __html: String(pricing.note)
                  .replace(/30日間無料トライアル/g, "<strong>30日間無料トライアル</strong>")
                  .replace(/導入サポート無料/g, "<strong>導入サポート無料</strong>"),
              }} />
            )}
          </div>
        </section>

        {/* 開発ストーリー */}
        <section className="py-16 md:py-24 px-6 bg-white">
          <div className="max-w-[800px] mx-auto text-center">
            <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">OUR STORY</p>
            <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E] mb-8 font-serif">
              花屋さんの、となりで。
            </h2>
            <div className="text-[14px] text-[#444] leading-[2] text-left space-y-4">
              <p>
                FLORIXは、現役の花屋さんと一緒につくっています。
              </p>
              <p>
                「立札の文字入れ、毎回手書きで大変…」<br/>
                「配達ルート、Googleマップで一個ずつ確認しないと…」<br/>
                「夜中の問い合わせ、見逃して常連さんを失う…」
              </p>
              <p>
                そういった『現場の声』を、ひとつずつ機能にしてきました。
              </p>
              <p>
                大きなSaaSベンダーが作る、誰のものでもないシステムではなく、<br/>
                <strong className="text-[#2D4B3E]">花屋さんが「自分のお店のために作られた」と感じる</strong>システムを。
              </p>
              <p>
                それが、FLORIXです。
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 md:py-24 px-6 bg-[#FCF8F3]">
          <div className="max-w-[800px] mx-auto">
            <p className="text-center text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">FAQ</p>
            <h2 className="text-[24px] md:text-[32px] font-bold text-center text-[#2D4B3E] mb-12 font-serif">
              よくいただくご質問
            </h2>
            <div className="space-y-4">
              {[
                { q: "パソコンが苦手でも使えますか？", a: "はい、もちろんです。スマホ・タブレットからも使えますし、導入時には1〜2時間のオンライン研修もご用意しています。導入後のチャット・電話サポートも無料です。" },
                { q: "今使っているExcelや顧客リストから移行できますか？", a: "はい、CSV形式の顧客リスト・商品リストをお送りいただければ、当社でインポート作業を代行します。初期導入無料で対応しています。" },
                { q: "途中でプラン変更はできますか？", a: "もちろん可能です。お店の成長に合わせてスターター→プロフェッショナルへのアップグレードも、ダウングレードもいつでもどうぞ。" },
                { q: "解約はいつでもできますか？", a: "はい、月単位でいつでも解約可能です。違約金や年契約縛りはありません。安心してお試しください。" },
                { q: "ホームページがないけどECだけ作れますか？", a: "はい、FLORIXのオンラインショップは独自ドメインにも対応しているので、これがあなたのお店の『公式オンラインショップ』になります。Google検索対策（SEO）も自動でついてきます。" },
                { q: "セキュリティは大丈夫ですか？", a: "はい、お客様の個人情報はデータベース上で暗号化保管、通信もSSL/TLS、二段階認証、操作監査ログ、Sentry監視を導入しています。法的なプライバシーポリシーも完備。" },
              ].map((item, idx) => (
                <details key={idx} className="bg-white rounded-2xl p-5 border border-[#EAEAEA] group">
                  <summary className="font-bold text-[14px] text-[#2D4B3E] cursor-pointer list-none flex items-center justify-between">
                    <span>Q. {item.q}</span>
                    <span className="text-[#D97D54] group-open:rotate-45 transition-transform text-[20px] leading-none">+</span>
                  </summary>
                  <p className="text-[13px] text-[#555] leading-[1.9] mt-3 pt-3 border-t border-[#EAEAEA]">
                    A. {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA / お問い合わせ */}
        <section id="contact" className="py-16 md:py-24 px-6 bg-[#2D4B3E] text-white">
          <div className="max-w-[700px] mx-auto text-center">
            <p className="text-[12px] font-bold text-[#FCEDD4] tracking-widest mb-3">CONTACT</p>
            <h2 className="text-[26px] md:text-[36px] font-bold mb-5 font-serif">
              まずは、お気軽にご相談ください
            </h2>
            <p className="text-[13px] md:text-[14px] text-white/80 leading-[1.9] mb-10">
              現場の花屋さんと一緒に作ったシステムです。<br/>
              「うちの店でも使えるかな？」というご相談、ぜひ。<br/>
              無理な営業はいたしません🌸
            </p>

            <div className="bg-white text-[#111] rounded-2xl p-6 md:p-8 text-left">
              <form
                action="mailto:contact@noodleflorix.com"
                method="post"
                encType="text/plain"
                className="space-y-4"
              >
                <div>
                  <label className="text-[12px] font-bold text-[#555] block mb-1">お店のお名前・お名前 *</label>
                  <input
                    type="text"
                    name="お店・お名前"
                    required
                    className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none"
                    placeholder="例：花屋さくら / 田中太郎"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#555] block mb-1">メールアドレス *</label>
                  <input
                    type="email"
                    name="メール"
                    required
                    className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#555] block mb-1">電話番号</label>
                  <input
                    type="tel"
                    name="電話"
                    className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none"
                    placeholder="090-0000-0000（任意）"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#555] block mb-1">ご相談内容</label>
                  <textarea
                    name="ご相談内容"
                    rows={4}
                    className="w-full bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 py-3 text-[13px] focus:border-[#2D4B3E] outline-none"
                    placeholder="お悩み、ご質問、デモご希望など、お気軽にどうぞ🌸"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-14 bg-[#2D4B3E] text-white rounded-2xl text-[14px] font-bold hover:bg-[#1f352b] transition-all flex items-center justify-center gap-2"
                >
                  🌸 送信する
                </button>
                <p className="text-[11px] text-[#999] text-center">
                  ※ ご相談はすべて無料です。お電話での相談もお気軽にどうぞ。
                </p>
              </form>
            </div>

            <p className="text-[12px] text-white/70 mt-8">
              📧 メールでも受付：<a href="mailto:contact@noodleflorix.com" className="underline">contact@noodleflorix.com</a>
            </p>
          </div>
        </section>

        {/* フッター */}
        <footer className="py-10 px-6 bg-[#1f352b] text-white/70 text-[12px]">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span>🌸</span>
                  <span className="font-serif font-bold text-white text-[18px]">FLORIX</span>
                </div>
                <p>花屋さんのための、やさしいクラウド業務システム</p>
              </div>
              <div className="flex gap-6">
                <Link href="/privacy" className="hover:text-white">プライバシーポリシー</Link>
                <a href="#contact" className="hover:text-white">お問い合わせ</a>
                <Link href="/staff/login" className="hover:text-white">ログイン</Link>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/10 text-center text-[11px]">
              © {new Date().getFullYear()} NocoLde / FLORIX. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
