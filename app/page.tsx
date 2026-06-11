// [LP-#36/#41/#42] FLORIX LP - 花屋オーナー向けSaaS紹介ページ
// トーン: 親しみ・温かみ（日本のLP風・写真豊富）
// CTA: お問い合わせフォーム
// 料金: オーナー管理画面(/owner)から動的反映

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

// 1時間ごとに再ビルド
export const revalidate = 3600;

// =============================================================
// 📸 LP用 画像URL（差し替え可能）
// → 後で /owner 管理画面から編集できるようにする予定
// → 暫定: Unsplashの無料画像を使用
// =============================================================
const IMAGES = {
  hero: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=1200&q=80&auto=format&fit=crop", // 花束
  florist1: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&q=80&auto=format&fit=crop", // 花屋さん
  florist2: "https://images.unsplash.com/photo-1469259943454-aa100abba749?w=600&q=80&auto=format&fit=crop", // 花のアレンジ
  florist3: "https://images.unsplash.com/photo-1444128395449-09cd8babc8de?w=600&q=80&auto=format&fit=crop", // 花のディスプレイ
  bouquet1: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&q=80&auto=format&fit=crop", // ピンクの花
  bouquet2: "https://images.unsplash.com/photo-1545241047-6083a3684587?w=600&q=80&auto=format&fit=crop", // 白い花
  bouquet3: "https://images.unsplash.com/photo-1457089328389-f7c2837cf7b1?w=600&q=80&auto=format&fit=crop", // 色とりどり
  shopOwner: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80&auto=format&fit=crop", // 笑顔の女性
  testimonial1: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80&auto=format&fit=crop", // 女性スマイル
  testimonial2: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80&auto=format&fit=crop", // 男性
  testimonial3: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80&auto=format&fit=crop", // 女性
};

export const metadata = {
  title: "FLORIX | 花屋さんのための、やさしいクラウド業務システム",
  description:
    "「もう、紙とExcelに戻れない」現役の花屋さんが作った、花屋さんのための業務システム。ご注文・配達・EC・顧客管理を、ひとつに。月額¥3,800〜・30日間無料トライアル。",
  openGraph: {
    title: "FLORIX | 花屋さんのための、やさしいクラウド業務システム",
    description: "ご注文・配達・EC・顧客管理を、ひとつに。月額¥3,800〜。30日間無料トライアル。",
    url: "https://www.noodleflorix.com",
    siteName: "FLORIX",
    locale: "ja_JP",
    type: "website",
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FLORIX",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "花屋さん向けのクラウド業務管理システム。",
  offers: { "@type": "Offer", price: "3800", priceCurrency: "JPY" },
  provider: { "@type": "Organization", name: "NocoLde", url: "https://www.noodleflorix.com" },
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
  const featuredPlan = pricing.plans.find(p => p.recommended) || pricing.plans[0];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <div className="min-h-screen bg-[#FFFAF3] font-sans text-[#3B2A1F]" style={{ fontFamily: "'Hiragino Maru Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif" }}>
        {/* ナビゲーション */}
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F4D4C4]">
          <div className="max-w-[1100px] mx-auto h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[22px]">🌸</span>
              <span className="font-bold text-[20px] text-[#D97D54]">FLORIX</span>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <a href="#features" className="hidden md:block text-[12px] font-bold text-[#666] hover:text-[#D97D54]">特長</a>
              <a href="#pricing" className="hidden md:block text-[12px] font-bold text-[#666] hover:text-[#D97D54]">料金</a>
              <a href="#voice" className="hidden md:block text-[12px] font-bold text-[#666] hover:text-[#D97D54]">お客様の声</a>
              <Link href="/staff/login" className="text-[11px] font-bold text-[#666] hover:text-[#D97D54] px-3 py-1.5">
                ログイン
              </Link>
              <a
                href="#contact"
                className="text-[12px] font-bold bg-[#D97D54] text-white px-4 py-2 rounded-full hover:bg-[#c66a44] transition-all shadow-md"
              >
                お問い合わせ
              </a>
            </div>
          </div>
        </nav>

        {/* HERO セクション */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#FFF1E6] via-[#FFEAD9] to-[#FFFAF3] py-16 md:py-20 px-6">
          {/* 装飾 */}
          <div className="absolute top-10 left-10 text-[60px] opacity-20">🌷</div>
          <div className="absolute top-20 right-16 text-[40px] opacity-20">🌹</div>
          <div className="absolute bottom-10 left-1/4 text-[50px] opacity-15">🌺</div>
          <div className="absolute bottom-20 right-1/4 text-[35px] opacity-20">💐</div>

          <div className="max-w-[1000px] mx-auto relative">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F9E4A4] rounded-full text-[11px] font-bold text-[#8B6F2C] mb-5 shadow-sm">
                  🌷 花屋さんのため "だけ" に作りました
                </div>
                <h1 className="text-[26px] md:text-[40px] font-bold text-[#D97D54] leading-[1.5] mb-4">
                  花屋さんが、<br/>
                  <span className="text-[#2D4B3E]">自分らしく</span>
                  <span className="bg-[#F9E4A4] px-2 rounded">働ける毎日</span>を、<br/>
                  応援します。
                </h1>
                <p className="text-[13px] md:text-[15px] text-[#555] leading-[2] mb-8">
                  ご注文・配達・EC・顧客管理・スタッフ管理を、ひとつに。<br/>
                  現場の花屋さんと一緒に作った、<br className="hidden md:inline"/>
                  迷わず使えるやさしいクラウドシステムです。
                </p>

                {/* お試しプラン バッジ */}
                <div className="bg-white rounded-3xl p-5 shadow-xl border-2 border-[#F4D4C4] mb-6 inline-block">
                  <div className="text-[10px] font-bold text-[#D97D54] mb-1">📌 まずはお試し！</div>
                  <div className="flex items-baseline gap-2 justify-center md:justify-start">
                    <span className="text-[12px] text-[#666]">月額</span>
                    {featuredPlan?.price ? (
                      <>
                        <span className="text-[32px] font-bold text-[#D97D54]">¥{featuredPlan.price.toLocaleString()}</span>
                        <span className="text-[12px] text-[#666]">〜（税抜）</span>
                      </>
                    ) : (
                      <span className="text-[24px] font-bold text-[#D97D54]">お問い合わせ</span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#999] mt-2">30日間無料トライアル / クレジットカード不要</div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="#contact"
                    className="px-6 h-14 bg-[#D97D54] text-white rounded-full text-[14px] font-bold hover:bg-[#c66a44] transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    🌸 お気軽にご相談ください
                  </a>
                  <a
                    href="#features"
                    className="px-6 h-14 bg-white border-2 border-[#D97D54] text-[#D97D54] rounded-full text-[14px] font-bold hover:bg-[#FFF1E6] transition-all flex items-center justify-center"
                  >
                    特長を見る ↓
                  </a>
                </div>
              </div>

              {/* HERO画像 */}
              <div className="relative">
                <div className="absolute -top-4 -left-4 w-20 h-20 bg-[#F9E4A4] rounded-full opacity-50"></div>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[#F4D4C4] rounded-full opacity-60"></div>
                <img
                  src={IMAGES.hero}
                  alt="美しい花束"
                  className="relative rounded-3xl shadow-2xl w-full aspect-[4/5] object-cover"
                />
                <div className="absolute -top-3 -right-3 bg-[#D97D54] text-white text-[10px] font-bold px-3 py-2 rounded-full rotate-12 shadow-lg">
                  🎁 30日間<br/>無料お試し
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTRO セクション */}
        <section className="py-16 md:py-20 px-6 bg-[#FFFAF3] relative overflow-hidden">
          <div className="max-w-[900px] mx-auto text-center">
            <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- INTRODUCTION -</p>
            <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E] mb-3 leading-[1.5]">
              <span className="bg-[#F9E4A4] px-3 rounded">FLORIX</span><br className="md:hidden"/>
              を使ってみませんか？
            </h2>
            <p className="text-[13px] text-[#666] mb-10 leading-[2]">
              現役の花屋さんと一緒につくった、<br/>
              花屋さんのための業務システムです。
            </p>

            <div className="grid grid-cols-3 gap-3 md:gap-5 mb-10">
              {[IMAGES.florist1, IMAGES.bouquet1, IMAGES.florist2].map((src, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden shadow-md transform hover:scale-105 transition-transform">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4つのメリット */}
        <section id="features" className="py-16 md:py-24 px-6 bg-gradient-to-b from-[#FFF1E6] to-[#FFFAF3]">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-12">
              <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- FEATURES -</p>
              <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E] leading-[1.5]">
                花屋さんに嬉しい<br className="md:hidden"/>
                <span className="text-[#D97D54]">4つのメリット</span>
              </h2>
            </div>

            <div className="space-y-6">
              {[
                {
                  no: "01",
                  title: "入会金不要・まずはお試し",
                  desc: "初期費用ゼロ。30日間無料で全機能をお試しいただけます。気に入らなければ自動で解約。リスクなく始められます。",
                  image: IMAGES.florist3,
                  tags: ["入会金 ¥0", "クレカ不要", "30日無料"],
                  bg: "bg-[#FFF8F0]",
                },
                {
                  no: "02",
                  title: "オールインワン業務管理",
                  desc: "電話・LINE・店頭・ECのご注文を一元管理。配達ルートも自動最適化。立札・領収書も自動生成。1日の業務をまるごと支えます。",
                  image: IMAGES.bouquet2,
                  tags: ["ご注文管理", "配達管理", "立札自動生成", "EC販売"],
                  bg: "bg-[#FFFAF3]",
                },
                {
                  no: "03",
                  title: "安心のセキュリティ",
                  desc: "お客様の個人情報は暗号化保管。二段階認証・操作監査ログ・自動バックアップで、大切な情報をしっかり守ります。",
                  image: IMAGES.bouquet3,
                  tags: ["暗号化", "2FA対応", "自動バックアップ"],
                  bg: "bg-[#FFF8F0]",
                },
                {
                  no: "04",
                  title: "現役花屋による日本語サポート",
                  desc: "わからないことは、いつでもチャット・電話でご相談ください。導入時の研修・データ移行もすべて無料で対応します。",
                  image: IMAGES.shopOwner,
                  tags: ["無料サポート", "導入研修", "データ移行代行"],
                  bg: "bg-[#FFFAF3]",
                },
              ].map((f, idx) => (
                <div key={idx} className={`${f.bg} rounded-3xl overflow-hidden shadow-md border border-[#F4D4C4]/50`}>
                  <div className="grid md:grid-cols-2 gap-0">
                    <div className={`${idx % 2 === 0 ? "md:order-1" : "md:order-2"} aspect-[4/3] md:aspect-auto overflow-hidden`}>
                      <img src={f.image} alt={f.title} className="w-full h-full object-cover" />
                    </div>
                    <div className={`${idx % 2 === 0 ? "md:order-2" : "md:order-1"} p-6 md:p-8 flex flex-col justify-center`}>
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-[36px] md:text-[48px] font-bold text-[#D97D54] leading-none">{f.no}</span>
                        <div className="flex-1 pt-2">
                          <h3 className="text-[17px] md:text-[20px] font-bold text-[#2D4B3E] leading-tight">
                            {f.title}
                          </h3>
                        </div>
                      </div>
                      <p className="text-[13px] text-[#555] leading-[2] mb-4">{f.desc}</p>
                      <div className="flex gap-2 flex-wrap">
                        {f.tags.map(t => (
                          <span key={t} className="text-[10px] bg-white text-[#D97D54] border border-[#F4D4C4] px-3 py-1 rounded-full font-bold">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* サービス指針 3C */}
        <section className="py-16 md:py-24 px-6 bg-[#FCF3DF] relative">
          <div className="absolute top-5 left-5 text-[100px] opacity-5 font-bold text-[#D97D54]">FLOWER</div>
          <div className="absolute bottom-5 right-5 text-[100px] opacity-5 font-bold text-[#D97D54]">SHOP</div>

          <div className="max-w-[900px] mx-auto relative">
            <div className="text-center mb-12">
              <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- OUR VALUES -</p>
              <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E]">
                サービス指針 <span className="text-[#D97D54]">3C</span>
              </h2>
              <p className="text-[12px] text-[#666] mt-3">花屋さんに向き合う、3つの大切なこと</p>
            </div>

            <div className="space-y-3">
              {[
                { letter: "C", word: "ARE", title: "花屋さんの気持ちに寄り添う", desc: "毎日忙しい花屋さんが、もっと自分らしく働けるように。技術より、まずは「気持ち」を大切に。", bg: "bg-[#F4A5A5]", text: "text-white" },
                { letter: "C", word: "ONNECT", title: "花屋さんとお客様をつなぐ", desc: "ご注文も配達もスムーズに。お客様とのつながりを深める仕組みを、ご提供します。", bg: "bg-[#F9E4A4]", text: "text-[#8B6F2C]" },
                { letter: "C", word: "REATE", title: "新しい花屋業務を、共に創る", desc: "現場の声を聞いて、毎月アップデート。花屋さんと一緒に、新しい働き方をつくります。", bg: "bg-[#A8C8A0]", text: "text-white" },
              ].map((c, idx) => (
                <div key={idx} className={`${c.bg} ${c.text} rounded-2xl p-5 md:p-6 shadow-md`}>
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="text-[40px] md:text-[56px] font-bold leading-none">
                      {c.letter}<span className="text-[24px] md:text-[32px] opacity-80">{c.word}</span>
                    </div>
                    <div className="flex-1 border-l-2 border-current/30 pl-4 md:pl-6">
                      <h3 className="font-bold text-[14px] md:text-[16px] mb-2">{c.title}</h3>
                      <p className="text-[11.5px] md:text-[12.5px] leading-[1.9] opacity-90">{c.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 料金プラン */}
        <section id="pricing" className="py-16 md:py-24 px-6 bg-[#FFFAF3]">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-12">
              <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- PRICING -</p>
              <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E] mb-3">
                わかりやすい<br className="md:hidden"/>
                <span className="text-[#D97D54]">料金プラン</span>
              </h2>
              <p className="text-[13px] text-[#666]">小さなお店から、複数店舗の事業者さままで。</p>
            </div>

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
                    className={`rounded-3xl p-6 relative ${
                      isRecommended
                        ? "bg-gradient-to-br from-[#D97D54] to-[#c66a44] text-white scale-105 shadow-2xl"
                        : "bg-white border-2 border-[#F4D4C4] shadow-md"
                    }`}
                  >
                    {isRecommended && (
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#F9E4A4] text-[#8B6F2C] text-[11px] font-bold px-4 py-1.5 rounded-full shadow-md">
                        ⭐ 人気No.1
                      </span>
                    )}
                    <h3 className={`text-[18px] font-bold mb-1 ${isRecommended ? "" : "text-[#2D4B3E]"}`}>
                      {plan.name}
                    </h3>
                    <p className={`text-[11px] mb-5 ${isRecommended ? "text-white/80" : "text-[#999]"}`}>
                      {plan.subtitle}
                    </p>
                    <div className="mb-6 pb-6 border-b border-current/20">
                      <span className={`${isCustomPriceText ? "text-[24px]" : "text-[40px]"} font-bold ${isRecommended ? "" : "text-[#D97D54]"}`}>
                        {priceDisplay}
                      </span>
                      {!isCustomPriceText && (
                        <span className={`text-[12px] ml-1 ${isRecommended ? "text-white/80" : "text-[#666]"}`}>
                          /月（税抜）
                        </span>
                      )}
                    </div>
                    <ul className={`space-y-2.5 text-[12.5px] ${isRecommended ? "" : "text-[#555]"}`}>
                      {(plan.features || []).map((f: string, fi: number) => (
                        <li key={fi} className="flex items-start gap-2">
                          <span className={isRecommended ? "text-[#F9E4A4]" : "text-[#D97D54]"}>✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {pricing.note && (
              <p className="text-center text-[13px] text-[#666] mt-10" dangerouslySetInnerHTML={{
                __html: String(pricing.note)
                  .replace(/30日間無料トライアル/g, "<strong class='text-[#D97D54]'>30日間無料トライアル</strong>")
                  .replace(/導入サポート無料/g, "<strong class='text-[#D97D54]'>導入サポート無料</strong>"),
              }} />
            )}
          </div>
        </section>

        {/* お客様の声 */}
        <section id="voice" className="py-16 md:py-24 px-6 bg-gradient-to-b from-[#FFF1E6] to-[#FFFAF3]">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-12">
              <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- VOICE -</p>
              <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E]">
                お客様の<br className="md:hidden"/>
                <span className="text-[#D97D54]">嬉しい声</span>、届いています
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  img: IMAGES.testimonial1,
                  name: "佐藤様（東京・個人店）",
                  rating: "⭐⭐⭐⭐⭐",
                  comment: "電話注文と店頭販売の在庫がバラバラで困っていました。FLORIXで一元管理できるようになり、毎日の確認時間が30分→5分に！",
                  color: "bg-white",
                },
                {
                  img: IMAGES.testimonial2,
                  name: "田中様（札幌・3店舗運営）",
                  rating: "⭐⭐⭐⭐⭐",
                  comment: "3店舗の売上を一画面で見られるようになり、経営判断がスピーディーに。スタッフのシフト管理も楽になりました。",
                  color: "bg-white",
                },
                {
                  img: IMAGES.testimonial3,
                  name: "山田様（大阪・新規開業）",
                  rating: "⭐⭐⭐⭐⭐",
                  comment: "開店と同時に導入。ホームページがなくてもECが始められて、Google検索からのお客様も増えました🌸",
                  color: "bg-white",
                },
              ].map((v, idx) => (
                <div key={idx} className={`${v.color} rounded-3xl p-6 shadow-md border border-[#F4D4C4]/50`}>
                  <div className="flex items-center gap-3 mb-4">
                    <img src={v.img} alt={v.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#F4D4C4]" />
                    <div>
                      <p className="text-[12px] font-bold text-[#2D4B3E]">{v.name}</p>
                      <p className="text-[11px]">{v.rating}</p>
                    </div>
                  </div>
                  <p className="text-[12.5px] text-[#555] leading-[2]">
                    「{v.comment}」
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ご利用までの流れ */}
        <section className="py-16 md:py-24 px-6 bg-[#FFFAF3]">
          <div className="max-w-[900px] mx-auto">
            <div className="text-center mb-12">
              <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- FLOW -</p>
              <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E]">
                ご利用までの<br className="md:hidden"/>
                <span className="text-[#D97D54]">流れ</span>
              </h2>
              <p className="text-[13px] text-[#666] mt-3">最短3日でスタート！</p>
            </div>

            <div className="space-y-4">
              {[
                { step: "STEP 01", title: "お問い合わせ", desc: "下のフォームからご相談ください。電話・メールでもOK。", icon: "✉️" },
                { step: "STEP 02", title: "オンラインデモ（30分）", desc: "Zoomで実際の画面をお見せしながら、ご質問にお答えします。", icon: "💻" },
                { step: "STEP 03", title: "初期セットアップ", desc: "お店の情報・スタッフ・商品データをご一緒に登録します。", icon: "🛠️" },
                { step: "STEP 04", title: "30日間無料トライアル開始", desc: "全機能をお試しいただけます。気に入らなければそのまま自動解約。", icon: "🌸" },
              ].map((s, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-5 shadow-md border border-[#F4D4C4]/50 flex items-center gap-4">
                  <div className="text-[36px] md:text-[48px] shrink-0">{s.icon}</div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-[#D97D54] tracking-widest">{s.step}</p>
                    <h3 className="text-[14px] md:text-[16px] font-bold text-[#2D4B3E] mt-1">{s.title}</h3>
                    <p className="text-[12px] text-[#666] mt-1 leading-[1.8]">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 安心のポイント */}
        <section className="py-16 md:py-20 px-6 bg-[#FCF3DF]">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-10">
              <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- SAFETY -</p>
              <h2 className="text-[20px] md:text-[28px] font-bold text-[#2D4B3E]">
                花屋さんの "大事なもの" を、しっかり守ります
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
              {[
                { icon: "🔐", title: "お客様情報の暗号化" },
                { icon: "🛡️", title: "二段階認証" },
                { icon: "💾", title: "自動バックアップ" },
                { icon: "📜", title: "操作履歴・監査ログ" },
                { icon: "💬", title: "日本語サポート" },
                { icon: "🌱", title: "現場の声で進化" },
              ].map((s, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-4 text-center shadow-sm">
                  <div className="text-[28px] md:text-[36px] mb-1">{s.icon}</div>
                  <p className="text-[11px] md:text-[12px] font-bold text-[#2D4B3E]">{s.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA / お問い合わせフォーム */}
        <section id="contact" className="py-16 md:py-24 px-6 bg-gradient-to-b from-[#D97D54] to-[#c66a44] text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 text-[120px] opacity-10">🌸</div>
          <div className="absolute bottom-0 right-0 text-[120px] opacity-10">🌷</div>

          <div className="max-w-[700px] mx-auto text-center relative">
            <p className="text-[12px] font-bold text-[#F9E4A4] tracking-widest mb-3">- CONTACT -</p>
            <h2 className="text-[26px] md:text-[36px] font-bold mb-5">
              まずは、お気軽に<br className="md:hidden"/>ご相談ください
            </h2>
            <p className="text-[13px] md:text-[14px] text-white/90 leading-[2] mb-10">
              現場の花屋さんと一緒に作ったシステムです。<br/>
              「うちの店でも使えるかな？」というご相談、ぜひ。<br/>
              <strong>無理な営業はいたしません🌸</strong>
            </p>

            <div className="bg-white text-[#3B2A1F] rounded-3xl p-6 md:p-8 text-left shadow-2xl">
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
                    className="w-full h-12 bg-[#FFFAF3] border-2 border-[#F4D4C4] rounded-xl px-4 text-[13px] focus:border-[#D97D54] outline-none"
                    placeholder="例：花屋さくら / 田中太郎"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#555] block mb-1">メールアドレス *</label>
                  <input
                    type="email"
                    name="メール"
                    required
                    className="w-full h-12 bg-[#FFFAF3] border-2 border-[#F4D4C4] rounded-xl px-4 text-[13px] focus:border-[#D97D54] outline-none"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#555] block mb-1">電話番号</label>
                  <input
                    type="tel"
                    name="電話"
                    className="w-full h-12 bg-[#FFFAF3] border-2 border-[#F4D4C4] rounded-xl px-4 text-[13px] focus:border-[#D97D54] outline-none"
                    placeholder="090-0000-0000（任意）"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#555] block mb-1">ご相談内容</label>
                  <textarea
                    name="ご相談内容"
                    rows={4}
                    className="w-full bg-[#FFFAF3] border-2 border-[#F4D4C4] rounded-xl px-4 py-3 text-[13px] focus:border-[#D97D54] outline-none"
                    placeholder="お悩み、ご質問、デモご希望など、お気軽にどうぞ🌸"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-14 bg-[#D97D54] text-white rounded-full text-[15px] font-bold hover:bg-[#c66a44] transition-all shadow-lg"
                >
                  🌸 送信する
                </button>
                <p className="text-[11px] text-[#999] text-center">
                  ※ ご相談はすべて無料です。お電話でもどうぞ。
                </p>
              </form>
            </div>

            <p className="text-[12px] text-white/80 mt-8">
              📧 メールでも受付：<a href="mailto:contact@noodleflorix.com" className="underline font-bold">contact@noodleflorix.com</a>
            </p>
          </div>
        </section>

        {/* フッター */}
        <footer className="py-10 px-6 bg-[#3B2A1F] text-white/80 text-[12px]">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span>🌸</span>
                  <span className="font-bold text-white text-[18px]">FLORIX</span>
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
