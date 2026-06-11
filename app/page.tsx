// [LP-#36/#41/#42/#43] FLORIX LP - 花屋オーナー向けSaaS紹介ページ
// トーン: 親しみ・温かみ（写真豊富）
// CTA: お問い合わせフォーム
// 料金: オーナー管理画面(/owner)から動的反映
// 絵文字不使用・lucide-react アイコンを使用

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LP_PRICING, fetchLpPricing } from "@/utils/lpPricing";
import {
  Flower2, Gift, Star, Check, Mail, Monitor, Settings as SettingsIcon,
  Lock, Shield, Database, FileText, MessageCircle, Sprout, Send, Phone,
  ArrowRight, Sparkles, Heart, Smile, Lightbulb,
} from "lucide-react";

// LP料金プランの型
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

export const revalidate = 3600;

// =============================================================
// LP用 画像URL（差し替え可能）
// → 後で /owner 管理画面から編集できるようにする予定
// → 暫定: Unsplashの無料画像
// =============================================================
const IMAGES = {
  hero: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=1200&q=80&auto=format&fit=crop",
  florist1: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&q=80&auto=format&fit=crop",
  florist2: "https://images.unsplash.com/photo-1469259943454-aa100abba749?w=600&q=80&auto=format&fit=crop",
  florist3: "https://images.unsplash.com/photo-1444128395449-09cd8babc8de?w=600&q=80&auto=format&fit=crop",
  bouquet1: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=600&q=80&auto=format&fit=crop",
  bouquet2: "https://images.unsplash.com/photo-1545241047-6083a3684587?w=600&q=80&auto=format&fit=crop",
  bouquet3: "https://images.unsplash.com/photo-1457089328389-f7c2837cf7b1?w=600&q=80&auto=format&fit=crop",
  shopOwner: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80&auto=format&fit=crop",
  testimonial1: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80&auto=format&fit=crop",
  testimonial2: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80&auto=format&fit=crop",
  testimonial3: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80&auto=format&fit=crop",
};

export const metadata = {
  title: "FLORIX | 花屋さんのための、やさしいクラウド業務システム",
  description:
    "現役の花屋さんが作った、花屋さんのための業務システム。ご注文・配達・EC・顧客管理を、ひとつに。月額¥3,800〜・30日間無料トライアル。",
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
      <div className="min-h-screen bg-[#FFFAF3] text-[#3B2A1F]" style={{ fontFamily: "'Hiragino Maru Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif" }}>
        {/* ナビゲーション */}
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F4D4C4]">
          <div className="max-w-[1100px] mx-auto h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[22px] text-[#D97D54] tracking-[0.15em]">FLORIX</span>
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
          {/* 装飾（色つきの円） */}
          <div className="absolute top-12 left-8 w-24 h-24 rounded-full bg-[#F4D4C4] opacity-40 blur-sm"></div>
          <div className="absolute top-32 right-14 w-32 h-32 rounded-full bg-[#F9E4A4] opacity-30 blur-sm"></div>
          <div className="absolute bottom-16 left-1/4 w-40 h-40 rounded-full bg-[#FFD9C2] opacity-25 blur-md"></div>
          <div className="absolute bottom-24 right-1/4 w-28 h-28 rounded-full bg-[#FCE2D1] opacity-30 blur-sm"></div>

          <div className="max-w-[1000px] mx-auto relative">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F9E4A4] rounded-full text-[11px] font-bold text-[#8B6F2C] mb-5 shadow-sm">
                  <Sparkles size={12} />
                  花屋さんのため、だけ、に作りました
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

                {/* お試しプラン バッジ（強調版） */}
                <div className="relative bg-gradient-to-br from-[#FFF8E1] to-[#FFEBC2] rounded-3xl p-6 shadow-2xl border-4 border-[#F9C846] mb-6 inline-block max-w-full">
                  <div className="absolute -top-3 -left-3 bg-[#D97D54] text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1">
                    <Gift size={12}/> 期間限定キャンペーン
                  </div>
                  <div className="text-center md:text-left mt-1">
                    <div className="text-[28px] md:text-[36px] font-bold text-[#D97D54] leading-tight">
                      <span className="text-[18px] md:text-[22px]">いまだけ</span><br className="md:hidden"/>
                      <span className="bg-[#FFF] px-2 py-0.5 rounded shadow-sm">30日間</span> 無料お試し
                    </div>
                    <div className="text-[13px] text-[#8B6F2C] font-bold mt-2 leading-relaxed">
                      クレジットカード登録 不要 ・ 初期費用 ¥0<br/>
                      気に入らなければ自動解約 → リスクなし
                    </div>
                    {featuredPlan?.price && (
                      <div className="mt-3 pt-3 border-t border-[#F9C846]/50 text-[11px] text-[#8B6F2C]">
                        トライアル後は月額 <span className="font-bold text-[16px] text-[#D97D54]">¥{featuredPlan.price.toLocaleString()}〜</span>（税抜）
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="#contact"
                    className="px-6 h-14 bg-[#D97D54] text-white rounded-full text-[14px] font-bold hover:bg-[#c66a44] transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    お気軽にご相談ください
                    <ArrowRight size={16}/>
                  </a>
                  <a
                    href="#features"
                    className="px-6 h-14 bg-white border-2 border-[#D97D54] text-[#D97D54] rounded-full text-[14px] font-bold hover:bg-[#FFF1E6] transition-all flex items-center justify-center"
                  >
                    特長を見る
                  </a>
                </div>
              </div>

              {/* HERO画像 */}
              <div className="relative">
                <div className="absolute -top-6 -left-6 w-24 h-24 bg-[#F9E4A4] rounded-full opacity-60"></div>
                <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-[#F4D4C4] rounded-full opacity-70"></div>
                <img
                  src={IMAGES.hero}
                  alt="美しい花束"
                  className="relative rounded-3xl shadow-2xl w-full aspect-[4/5] object-cover"
                />
                <div className="absolute -top-3 -right-3 bg-[#D97D54] text-white text-[11px] font-bold px-3 py-2 rounded-2xl rotate-6 shadow-lg leading-tight">
                  30日間<br/>無料お試し
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
                  title: "迷わず使えるシンプル設計",
                  desc: "PCやスマホが苦手でも安心。直感的なUIで、説明書なしでもすぐに使い始められます。現場の花屋さんと一緒に磨き上げた、やさしい操作性です。",
                  image: IMAGES.shopOwner,
                  tags: ["直感的UI", "スマホ対応", "教育コスト低"],
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

        {/* FLORIXが大切にしていること */}
        <section className="py-16 md:py-24 px-6 bg-[#FCF3DF] relative">
          <div className="max-w-[1000px] mx-auto relative">
            <div className="text-center mb-12">
              <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- OUR PROMISES -</p>
              <h2 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E] leading-[1.5]">
                FLORIXが<br className="md:hidden"/>
                大切にしている<br className="md:hidden"/>
                <span className="text-[#D97D54]">3つのこと</span>
              </h2>
              <p className="text-[13px] text-[#666] mt-4 leading-[1.9]">
                花屋さんと、お客様と、毎日の業務に。<br/>
                FLORIXが約束する、3つの軸です。
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  no: "01",
                  title: "花屋さんの毎日に、寄り添う",
                  desc: "毎日忙しい花屋さんが、もっと自分らしく働けるように。便利さよりも先に、まず気持ちに寄り添うシステムを目指しています。",
                  Icon: Heart,
                  bg: "bg-white",
                  accent: "bg-[#F4A5A5]",
                  textColor: "text-[#2D4B3E]",
                },
                {
                  no: "02",
                  title: "お店とお客様を、もっと近くに",
                  desc: "ご注文から配達、その後のリピートまで。花屋さんとお客様の距離を、もっと近づける仕組みをつくります。",
                  Icon: Smile,
                  bg: "bg-white",
                  accent: "bg-[#F9E4A4]",
                  textColor: "text-[#2D4B3E]",
                },
                {
                  no: "03",
                  title: "現場の声で、進化し続ける",
                  desc: "実際に使う花屋さんの声を聞いて、毎月アップデート。一緒に未来の花屋業務をつくっていきます。",
                  Icon: Lightbulb,
                  bg: "bg-white",
                  accent: "bg-[#A8C8A0]",
                  textColor: "text-[#2D4B3E]",
                },
              ].map((c, idx) => {
                const Icon = c.Icon;
                return (
                  <div key={idx} className={`${c.bg} rounded-3xl shadow-md border border-[#F4D4C4]/50 overflow-hidden flex flex-col`}>
                    <div className={`${c.accent} p-5 flex items-center gap-3`}>
                      <div className="w-12 h-12 rounded-full bg-white/40 flex items-center justify-center text-white">
                        <Icon size={22}/>
                      </div>
                      <span className="text-[32px] font-bold text-white leading-none">{c.no}</span>
                    </div>
                    <div className="p-6 flex-1">
                      <h3 className={`text-[16px] md:text-[17px] font-bold mb-3 leading-tight ${c.textColor}`}>
                        {c.title}
                      </h3>
                      <p className="text-[12.5px] text-[#555] leading-[2]">
                        {c.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
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
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#F9E4A4] text-[#8B6F2C] text-[11px] font-bold px-4 py-1.5 rounded-full shadow-md flex items-center gap-1">
                        <Star size={11} fill="currentColor"/> 人気No.1
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
                          <Check size={14} className={`mt-0.5 shrink-0 ${isRecommended ? "text-[#F9E4A4]" : "text-[#D97D54]"}`}/>
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
                  .replace(/30日間無料トライアル/g, "<strong class='text-[#D97D54]'>30日間無料トライアル</strong>"),
              }} />
            )}
          </div>
        </section>

        {/* 30日無料お試し 強調バナー */}
        <section className="py-12 md:py-16 px-6 bg-gradient-to-br from-[#F9C846] via-[#F9E4A4] to-[#FFF1E6] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/20 -mt-32 -mr-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/15 -mb-24 -ml-24"></div>

          <div className="max-w-[900px] mx-auto relative text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#D97D54] text-white text-[11px] font-bold rounded-full mb-5 shadow-md">
              <Gift size={14}/> いまならキャンペーン中
            </div>
            <h2 className="text-[32px] md:text-[48px] font-bold text-[#3B2A1F] mb-3 leading-[1.3]">
              まずは <span className="text-[#D97D54] underline decoration-wavy decoration-[#D97D54]/40 underline-offset-[10px]">30日間</span> 無料で<br/>
              すべての機能を試せます
            </h2>
            <p className="text-[14px] md:text-[16px] text-[#5B4632] leading-[2] mb-8">
              クレジットカード登録 <strong>不要</strong>・初期費用 <strong>¥0</strong>・<br className="md:hidden"/>
              気に入らなければ <strong>自動解約</strong>。<br/>
              続けるか決めるのは、お試しの後でOKです。
            </p>

            <div className="grid grid-cols-3 gap-3 md:gap-5 max-w-[600px] mx-auto mb-8">
              {[
                { num: "0", label: "初期費用" },
                { num: "0", label: "クレカ登録" },
                { num: "30", label: "日間無料" },
              ].map((item, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-4 shadow-md">
                  <div className="text-[36px] md:text-[48px] font-bold text-[#D97D54] leading-none">
                    {item.num}
                    {idx === 0 || idx === 1 ? <span className="text-[16px] ml-0.5">円</span> : <span className="text-[14px] ml-1">日</span>}
                  </div>
                  <p className="text-[11px] md:text-[12px] text-[#666] mt-2 font-bold">{item.label}</p>
                </div>
              ))}
            </div>

            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-8 h-16 bg-[#D97D54] text-white rounded-full text-[15px] md:text-[16px] font-bold hover:bg-[#c66a44] transition-all shadow-xl"
            >
              いますぐ無料で試してみる
              <ArrowRight size={18}/>
            </a>
            <p className="text-[11px] text-[#8B6F2C] mt-4">
              30秒で完了するお問い合わせフォームへ
            </p>
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
                  comment: "電話注文と店頭販売の在庫がバラバラで困っていました。FLORIXで一元管理できるようになり、毎日の確認時間が30分から5分に！",
                },
                {
                  img: IMAGES.testimonial2,
                  name: "田中様（札幌・3店舗運営）",
                  comment: "3店舗の売上を一画面で見られるようになり、経営判断がスピーディーに。スタッフのシフト管理も楽になりました。",
                },
                {
                  img: IMAGES.testimonial3,
                  name: "山田様（大阪・新規開業）",
                  comment: "開店と同時に導入。ホームページがなくてもECが始められて、Google検索からのお客様も増えました。",
                },
              ].map((v, idx) => (
                <div key={idx} className="bg-white rounded-3xl p-6 shadow-md border border-[#F4D4C4]/50">
                  <div className="flex items-center gap-3 mb-4">
                    <img src={v.img} alt={v.name} className="w-14 h-14 rounded-full object-cover border-2 border-[#F4D4C4]" />
                    <div>
                      <p className="text-[12px] font-bold text-[#2D4B3E]">{v.name}</p>
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
              <p className="text-[13px] text-[#666] mt-3">最短3日でスタート</p>
            </div>

            <div className="space-y-4">
              {[
                { step: "STEP 01", title: "お問い合わせ", desc: "下のフォームからご相談ください。電話・メールでもOK。", Icon: Mail },
                { step: "STEP 02", title: "オンラインデモ（30分）", desc: "Zoomで実際の画面をお見せしながら、ご質問にお答えします。", Icon: Monitor },
                { step: "STEP 03", title: "初期セットアップ", desc: "お店の情報・スタッフ・商品データをご一緒に登録します。", Icon: SettingsIcon },
                { step: "STEP 04", title: "30日間無料トライアル開始", desc: "全機能をお試しいただけます。気に入らなければそのまま自動解約。", Icon: Flower2 },
              ].map((s, idx) => {
                const I = s.Icon;
                return (
                  <div key={idx} className="bg-white rounded-2xl p-5 shadow-md border border-[#F4D4C4]/50 flex items-center gap-4">
                    <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-[#FFF1E6] flex items-center justify-center shrink-0 text-[#D97D54]">
                      <I size={28}/>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-[#D97D54] tracking-widest">{s.step}</p>
                      <h3 className="text-[14px] md:text-[16px] font-bold text-[#2D4B3E] mt-1">{s.title}</h3>
                      <p className="text-[12px] text-[#666] mt-1 leading-[1.8]">{s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 安心のポイント */}
        <section className="py-16 md:py-20 px-6 bg-[#FCF3DF]">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-10">
              <p className="text-[12px] font-bold text-[#D97D54] tracking-widest mb-3">- SAFETY -</p>
              <h2 className="text-[20px] md:text-[28px] font-bold text-[#2D4B3E]">
                花屋さんの大事なものを、しっかり守ります
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
              {[
                { Icon: Lock, title: "お客様情報の暗号化" },
                { Icon: Shield, title: "二段階認証" },
                { Icon: Database, title: "自動バックアップ" },
                { Icon: FileText, title: "操作履歴・監査ログ" },
                { Icon: Sprout, title: "現場の声で進化" },
                { Icon: Sparkles, title: "毎月アップデート" },
              ].map((s, idx) => {
                const I = s.Icon;
                return (
                  <div key={idx} className="bg-white rounded-2xl p-4 text-center shadow-sm">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-[#FFF1E6] flex items-center justify-center text-[#D97D54]">
                      <I size={22}/>
                    </div>
                    <p className="text-[11px] md:text-[12px] font-bold text-[#2D4B3E]">{s.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA / お問い合わせフォーム */}
        <section id="contact" className="py-16 md:py-24 px-6 bg-gradient-to-b from-[#D97D54] to-[#c66a44] text-white relative overflow-hidden">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-white/10"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 rounded-full bg-white/5"></div>

          <div className="max-w-[700px] mx-auto text-center relative">
            <p className="text-[12px] font-bold text-[#F9E4A4] tracking-widest mb-3">- CONTACT -</p>
            <h2 className="text-[26px] md:text-[36px] font-bold mb-5">
              まずは、お気軽に<br className="md:hidden"/>ご相談ください
            </h2>
            <p className="text-[13px] md:text-[14px] text-white/90 leading-[2] mb-10">
              現場の花屋さんと一緒に作ったシステムです。<br/>
              「うちの店でも使えるかな？」というご相談、ぜひ。<br/>
              <strong>無理な営業はいたしません。</strong>
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
                    placeholder="お悩み、ご質問、デモご希望など、お気軽にどうぞ。"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-14 bg-[#D97D54] text-white rounded-full text-[15px] font-bold hover:bg-[#c66a44] transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Send size={16}/> 送信する
                </button>
                <p className="text-[11px] text-[#999] text-center">
                  ※ ご相談はすべて無料です。お電話でもどうぞ。
                </p>
              </form>
            </div>

            <p className="text-[12px] text-white/80 mt-8 flex items-center justify-center gap-2 flex-wrap">
              <Mail size={14}/> メールでも受付：
              <a href="mailto:contact@noodleflorix.com" className="underline font-bold">contact@noodleflorix.com</a>
            </p>
          </div>
        </section>

        {/* フッター */}
        <footer className="py-10 px-6 bg-[#3B2A1F] text-white/80 text-[12px]">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-white text-[20px] tracking-[0.15em]">FLORIX</span>
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
