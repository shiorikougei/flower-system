// =============================================================
// FLORIX LP - 花屋専門クラウド業務システム
// プロフェッショナルチーム共同設計 (LP-#43)
// =============================================================
//   Design   : Warm Beige + Sage Green + Terracotta / Soft UI + Glass
//   Marketing: AIDA + PASONA / モバイルファースト
//   SEO      : 構造化データ4種 + 動的メタタグ
//   Engineer : Server Component / 動的料金 / lucide-react
// =============================================================

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LP_PRICING, fetchLpPricing } from "@/utils/lpPricing";
import {
  ArrowRight, Check, ChevronDown, Mail, Phone, Send, Star,
  ShoppingBag, Truck, Calendar as CalendarIcon, Users, Sparkles,
  Lock, Smartphone, MessageCircle, LineChart, Heart, Layers,
  ClipboardList, Package, Zap, ShieldCheck, Bell,
} from "lucide-react";

// =============================================================
// 型定義
// =============================================================
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

// =============================================================
// 画像URL（高品質Unsplash・後から差替可能）
// =============================================================
const IMAGES = {
  hero: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1400&q=85&auto=format&fit=crop",
  heroBg: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=1600&q=80&auto=format&fit=crop",
  problem1: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80&auto=format&fit=crop",
  problem2: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop",
  problem3: "https://images.unsplash.com/photo-1494178270175-e96de2971df9?w=600&q=80&auto=format&fit=crop",
  solution: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=1200&q=85&auto=format&fit=crop",
  feature1: "https://images.unsplash.com/photo-1469259943454-aa100abba749?w=800&q=85&auto=format&fit=crop",
  feature2: "https://images.unsplash.com/photo-1444128395449-09cd8babc8de?w=800&q=85&auto=format&fit=crop",
  feature3: "https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&q=85&auto=format&fit=crop",
  feature4: "https://images.unsplash.com/photo-1457089328389-f7c2837cf7b1?w=800&q=85&auto=format&fit=crop",
  usage: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=85&auto=format&fit=crop",
  testimonial1: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=85&auto=format&fit=crop",
  testimonial2: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=85&auto=format&fit=crop",
  testimonial3: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=85&auto=format&fit=crop",
};

// =============================================================
// SEO メタデータ
// =============================================================
export const revalidate = 3600;

export const metadata = {
  title: "FLORIX｜花屋専門のクラウド業務システム | 受注・EC・配達を1画面で",
  description: "FLORIX（フローリックス）は、花屋さんのために開発された業務支援クラウド。電話・LINE・店頭・ECの受注を一元化、配達ルート最適化、立札自動生成、顧客カルテ、SEO対策EC機能まで。月額¥3,800〜・30日間無料トライアル。",
  keywords: ["花屋", "業務システム", "フラワーショップ", "受注管理", "配達管理", "EC", "顧客管理", "クラウドSaaS", "POS", "立札", "ファミリービジネス", "FLORIX"],
  openGraph: {
    title: "花屋業務を、ひとつに。FLORIX",
    description: "受注・配達・EC・顧客管理を統合した、花屋専門クラウド。月額¥3,800〜・30日無料トライアル。",
    url: "https://www.noodleflorix.com",
    siteName: "FLORIX",
    locale: "ja_JP",
    type: "website",
    images: [{ url: IMAGES.hero, width: 1200, height: 630, alt: "FLORIX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "花屋業務を、ひとつに。FLORIX",
    description: "受注・配達・EC・顧客管理を統合した、花屋専門クラウド。",
    images: [IMAGES.hero],
  },
};

// =============================================================
// 構造化データ
// =============================================================
const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FLORIX",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "花屋専門のクラウド業務管理システム。受注・配達・EC・顧客管理・スタッフ管理を統合。",
    offers: { "@type": "Offer", price: "3800", priceCurrency: "JPY" },
    provider: { "@type": "Organization", name: "NocoLde", url: "https://www.noodleflorix.com" },
    aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: "27" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NocoLde",
    url: "https://www.noodleflorix.com",
    logo: "https://www.noodleflorix.com/og-default.jpg",
    sameAs: [],
  },
];

// =============================================================
// データフェッチ
// =============================================================
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

// =============================================================
// メインコンポーネント
// =============================================================
export default async function HomePage() {
  const { pricing } = await getLpData();
  const featuredPlan = pricing.plans.find(p => p.recommended) || pricing.plans[0];

  return (
    <>
      {structuredData.map((sd, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(sd) }}
        />
      ))}

      <div className="min-h-screen bg-[#FFFDF9] text-[#2C2C2C] selection:bg-[#D9825B]/20" style={{ fontFamily: "'Inter','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif" }}>

        {/* ============================================== */}
        {/* NAV BAR - Glass morphism */}
        {/* ============================================== */}
        <nav className="sticky top-0 z-50 bg-[#FFFDF9]/80 backdrop-blur-xl border-b border-[#E8DFD0]/50">
          <div className="max-w-[1180px] mx-auto h-[68px] px-6 flex items-center justify-between">
            <Link href="/" className="font-bold text-[22px] text-[#2C2C2C] tracking-[0.18em]">
              FLORIX
            </Link>
            <div className="flex items-center gap-1 md:gap-5">
              <a href="#features" className="hidden md:block text-[13px] font-medium text-[#6B6B6B] hover:text-[#2C2C2C] transition">特長</a>
              <a href="#pricing" className="hidden md:block text-[13px] font-medium text-[#6B6B6B] hover:text-[#2C2C2C] transition">料金</a>
              <a href="#voice" className="hidden md:block text-[13px] font-medium text-[#6B6B6B] hover:text-[#2C2C2C] transition">お客様の声</a>
              <a href="#faq" className="hidden md:block text-[13px] font-medium text-[#6B6B6B] hover:text-[#2C2C2C] transition">よくある質問</a>
              <Link href="/staff/login" className="text-[12px] font-medium text-[#6B6B6B] hover:text-[#2C2C2C] px-3 py-1.5 transition">
                ログイン
              </Link>
              <a
                href="#contact"
                className="text-[13px] font-semibold bg-[#2C2C2C] text-white px-5 py-2.5 rounded-full hover:bg-[#D9825B] transition-all"
              >
                無料で試す
              </a>
            </div>
          </div>
        </nav>

        {/* ============================================== */}
        {/* HERO - AIDA: Attention */}
        {/* ============================================== */}
        <section className="relative overflow-hidden pt-16 md:pt-24 pb-20 md:pb-32 px-6 bg-gradient-to-b from-[#F8F2E8] via-[#FBF6EE] to-[#FFFDF9]">
          {/* 装飾円 */}
          <div className="absolute top-32 -left-32 w-[400px] h-[400px] rounded-full bg-[#AFC6B2]/20 blur-3xl"></div>
          <div className="absolute bottom-0 -right-32 w-[400px] h-[400px] rounded-full bg-[#D9825B]/15 blur-3xl"></div>

          <div className="max-w-[1180px] mx-auto relative">
            <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">

              {/* 左：テキスト */}
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/70 backdrop-blur-md border border-white/80 rounded-full text-[11px] font-semibold text-[#7A9279] mb-6 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-[#AFC6B2] rounded-full animate-pulse"></span>
                  花屋専門 業務クラウド
                </div>

                <h1 className="text-[40px] md:text-[58px] lg:text-[68px] font-bold leading-[1.15] tracking-tight mb-6 text-[#2C2C2C]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                  花屋業務、<br/>
                  <span className="text-[#D9825B]">ぜんぶ</span> FLORIX で。
                </h1>

                <p className="text-[15px] md:text-[17px] text-[#5B5B5B] leading-[2] mb-10 max-w-[520px]">
                  受注・配達・EC・顧客管理・スタッフ管理。<br/>
                  花屋さんの1日を、ひとつのシステムでまるごと支える。<br/>
                  現役の花屋さんと共創する、業務クラウドです。
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <a
                    href="#contact"
                    className="group inline-flex items-center justify-center gap-2 h-14 px-7 bg-[#D9825B] text-white rounded-full text-[14px] font-bold hover:bg-[#B86340] transition-all shadow-lg shadow-[#D9825B]/25"
                  >
                    30日間 無料で始める
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                  </a>
                  <a
                    href="#features"
                    className="inline-flex items-center justify-center h-14 px-7 bg-white/80 backdrop-blur-sm border border-[#E8DFD0] text-[#2C2C2C] rounded-full text-[14px] font-semibold hover:bg-white hover:border-[#AFC6B2] transition-all"
                  >
                    機能を見る
                  </a>
                </div>

                <div className="flex items-center gap-6 text-[11px] text-[#6B6B6B]">
                  <span className="flex items-center gap-1.5"><Check size={14} className="text-[#7A9279]"/> 初期費用 ¥0</span>
                  <span className="flex items-center gap-1.5"><Check size={14} className="text-[#7A9279]"/> クレカ登録不要</span>
                  <span className="flex items-center gap-1.5"><Check size={14} className="text-[#7A9279]"/> いつでも解約OK</span>
                </div>
              </div>

              {/* 右：Glass Photo Card */}
              <div className="relative">
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[#F8E0D0] opacity-70"></div>
                <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-[#E5EDDF] opacity-70"></div>

                <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#D9825B]/20">
                  <img src={IMAGES.hero} alt="美しい花束" className="w-full aspect-[4/5] object-cover"/>

                  {/* Glass overlay card 左下 */}
                  <div className="absolute bottom-6 left-6 right-6 bg-white/85 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#AFC6B2] to-[#7A9279] flex items-center justify-center text-white">
                        <Sparkles size={20}/>
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] text-[#6B6B6B] font-medium">月額（最小プラン）</p>
                        <p className="text-[22px] font-bold text-[#2C2C2C] leading-tight">
                          {featuredPlan?.price
                            ? `¥${featuredPlan.price.toLocaleString()}〜`
                            : "お問い合わせ"}
                          <span className="text-[10px] text-[#6B6B6B] ml-1">/月</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 浮遊バッジ */}
                <div className="absolute -top-5 -right-3 bg-white shadow-xl rounded-2xl px-4 py-3 border border-[#E8DFD0]">
                  <p className="text-[9px] text-[#6B6B6B] font-bold tracking-widest">CAMPAIGN</p>
                  <p className="text-[15px] font-bold text-[#D9825B]">30日 無料</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* PROBLEM - PASONA: Problem + Agitation */}
        {/* ============================================== */}
        <section className="py-24 md:py-32 px-6 bg-[#FFFDF9]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] font-bold text-[#D9825B] tracking-[0.3em] mb-4">PROBLEM</p>
              <h2 className="text-[28px] md:text-[40px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                こんなお悩み、ありませんか？
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {[
                {
                  image: IMAGES.problem1,
                  title: "電話の注文メモが、行方不明",
                  desc: "走り書きのメモが束になって、誰宛か、いつまでか、わからなくなる。",
                },
                {
                  image: IMAGES.problem2,
                  title: "配達ルートの組み立てに、毎朝1時間",
                  desc: "Googleマップで1件ずつ確認しながら、手書きで順番を決める日々。",
                },
                {
                  image: IMAGES.problem3,
                  title: "夜中の問い合わせを、見逃してしまう",
                  desc: "営業時間外の注文に対応できず、お客様を逃しているかもしれない。",
                },
              ].map((p, idx) => (
                <article key={idx} className="group bg-white rounded-[2rem] overflow-hidden shadow-[0_8px_32px_rgba(217,130,91,0.06)] hover:shadow-[0_12px_48px_rgba(217,130,91,0.12)] transition-all border border-[#F0E8DD]">
                  <div className="aspect-[5/4] overflow-hidden">
                    <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
                  </div>
                  <div className="p-7">
                    <h3 className="text-[17px] md:text-[18px] font-bold text-[#2C2C2C] mb-3 leading-[1.5]">{p.title}</h3>
                    <p className="text-[13px] text-[#6B6B6B] leading-[2]">{p.desc}</p>
                  </div>
                </article>
              ))}
            </div>

            <p className="text-center text-[16px] md:text-[20px] font-medium text-[#5B5B5B] mt-16 leading-[1.9]">
              わかります。<br/>
              <span className="text-[#D9825B] font-bold">FLORIX</span> なら、それぞれの悩みが
              <span className="font-bold text-[#2C2C2C]">ひとつの画面</span>で解決します。
            </p>
          </div>
        </section>

        {/* ============================================== */}
        {/* SOLUTION - PASONA: Solution */}
        {/* ============================================== */}
        <section className="py-24 md:py-32 px-6 bg-[#F8F2E8] relative overflow-hidden">
          <div className="absolute top-1/2 -translate-y-1/2 -left-32 w-[500px] h-[500px] rounded-full bg-[#AFC6B2]/10 blur-3xl"></div>

          <div className="max-w-[1180px] mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-[11px] font-bold text-[#7A9279] tracking-[0.3em] mb-4">SOLUTION</p>
              <h2 className="text-[28px] md:text-[44px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                FLORIX ひとつで、<br className="md:hidden"/>
                すべてが変わる。
              </h2>
              <p className="text-[14px] md:text-[15px] text-[#5B5B5B] leading-[2] mt-5 max-w-[600px] mx-auto">
                注文、配達、EC、顧客管理、スタッフ管理。<br/>
                バラバラだった業務が、ひとつのダッシュボードに。
              </p>
            </div>

            <div className="relative max-w-[900px] mx-auto">
              <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/50 backdrop-blur-md"></div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-[#D9825B]/15 backdrop-blur-md"></div>

              <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl shadow-[#AFC6B2]/30">
                <img src={IMAGES.solution} alt="FLORIX ダッシュボード" className="w-full aspect-[16/9] object-cover"/>
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
                <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 bg-white/85 backdrop-blur-xl border border-white/60 rounded-2xl p-5 md:p-7 shadow-xl">
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
                    {[
                      { Icon: ClipboardList, label: "受注" },
                      { Icon: Truck, label: "配達" },
                      { Icon: ShoppingBag, label: "EC" },
                      { Icon: Users, label: "顧客" },
                    ].map((s, idx) => {
                      const I = s.Icon;
                      return (
                        <div key={idx} className={`text-center ${idx === 3 ? "hidden md:block" : ""}`}>
                          <div className="w-10 h-10 md:w-12 md:h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#F8F2E8] to-[#E8DFD0] flex items-center justify-center text-[#D9825B] mb-2">
                            <I size={20}/>
                          </div>
                          <p className="text-[11px] md:text-[12px] font-semibold text-[#2C2C2C]">{s.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* FEATURES - AIDA: Interest */}
        {/* ============================================== */}
        <section id="features" className="py-24 md:py-32 px-6 bg-[#FFFDF9]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] font-bold text-[#D9825B] tracking-[0.3em] mb-4">FEATURES</p>
              <h2 className="text-[28px] md:text-[44px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                花屋業務を、もっと自由に。
              </h2>
              <p className="text-[14px] md:text-[15px] text-[#5B5B5B] leading-[2] mt-5">
                すべての機能が、花屋さんの現場目線で設計されています。
              </p>
            </div>

            <div className="space-y-10 md:space-y-16">
              {[
                {
                  no: "01",
                  Icon: ClipboardList,
                  title: "受注を、一画面で。",
                  subtitle: "電話・LINE・店頭・ECを、ひとつに統合。",
                  desc: "ばらばらだった注文経路が、すべて FLORIX に集約。納期カレンダーで配達日も自動管理。立札・領収書も自動生成されるから、手書きの煩わしさから解放されます。",
                  features: ["カスタムオーダー受付", "納期カレンダー連動", "立札8パターン自動生成", "領収書PDF発行", "インボイス対応"],
                  image: IMAGES.feature1,
                  align: "left",
                },
                {
                  no: "02",
                  Icon: Truck,
                  title: "配達を、最短ルートで。",
                  subtitle: "Googleマップ連携で、配達計画を自動最適化。",
                  desc: "配達順・ドライバー・到着予定時刻を地図ビューで見える化。お客様への通知（LINE・SMS）も自動。配達遅延の連絡漏れも、もうありません。",
                  features: ["配達ルート最適化", "地図ビュー管理", "LINE通知連携", "配達状況リアルタイム"],
                  image: IMAGES.feature2,
                  align: "right",
                },
                {
                  no: "03",
                  Icon: ShoppingBag,
                  title: "ECで、新しいお客様と出会う。",
                  subtitle: "ホームページがなくても、24時間販売開始。",
                  desc: "独自ドメイン対応のオンラインショップを、すぐに開設。Stripe決済・在庫管理・SEO対策（構造化データ・サイトマップ・OG画像）が標準装備。Google検索からの集客も自動でついてきます。",
                  features: ["独自ドメイン対応", "Stripe決済連携", "SEO対策標準装備", "在庫リアルタイム同期", "QR在庫管理"],
                  image: IMAGES.feature3,
                  align: "left",
                },
                {
                  no: "04",
                  Icon: Users,
                  title: "顧客カルテで、リピート促進。",
                  subtitle: "誕生日も、好みのお花も、すべて自動で蓄積。",
                  desc: "ご注文履歴から、お客様の好み傾向を自動分析。記念日リマインダーや誕生日メッセージも自動配信。LINE公式連携で、もっと近くなるお客様との関係。",
                  features: ["顧客カルテ", "好み傾向AI分析", "記念日リマインダー", "LINE公式連携", "誕生日メッセージ"],
                  image: IMAGES.feature4,
                  align: "right",
                },
              ].map((f, idx) => {
                const Icon = f.Icon;
                const isLeft = f.align === "left";
                return (
                  <article key={idx} className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
                    <div className={`${isLeft ? "" : "md:order-2"}`}>
                      <div className="relative">
                        <div className={`absolute ${isLeft ? "-top-6 -left-6" : "-top-6 -right-6"} w-24 h-24 rounded-full bg-[#AFC6B2]/30`}></div>
                        <img src={f.image} alt={f.title} className="relative rounded-[2rem] shadow-xl shadow-[#AFC6B2]/20 w-full aspect-[4/3] object-cover"/>
                      </div>
                    </div>
                    <div className={`${isLeft ? "" : "md:order-1"}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[12px] font-bold text-[#D9825B] tracking-[0.3em]">{f.no}</span>
                        <span className="h-px flex-1 bg-gradient-to-r from-[#D9825B]/40 to-transparent"></span>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F8F2E8] to-[#E8DFD0] flex items-center justify-center text-[#D9825B]">
                          <Icon size={22}/>
                        </div>
                        <h3 className="text-[22px] md:text-[28px] font-bold text-[#2C2C2C] leading-tight" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                          {f.title}
                        </h3>
                      </div>
                      <p className="text-[14px] md:text-[15px] font-semibold text-[#7A9279] mb-4">{f.subtitle}</p>
                      <p className="text-[13.5px] md:text-[14px] text-[#5B5B5B] leading-[2] mb-5">{f.desc}</p>
                      <ul className="flex flex-wrap gap-2">
                        {f.features.map(item => (
                          <li key={item} className="text-[11.5px] font-medium text-[#5B5B5B] bg-[#F8F2E8] px-3.5 py-1.5 rounded-full border border-[#E8DFD0]">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* USAGE FLOW */}
        {/* ============================================== */}
        <section className="py-24 md:py-32 px-6 bg-[#F8F2E8]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] font-bold text-[#7A9279] tracking-[0.3em] mb-4">USAGE</p>
              <h2 className="text-[28px] md:text-[40px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                朝から夜まで、ずっとそばに。
              </h2>
              <p className="text-[14px] text-[#5B5B5B] leading-[2] mt-5">
                花屋さんの1日に、FLORIXが寄り添う実例
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="relative order-2 md:order-1">
                <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-[#D9825B]/15"></div>
                <img src={IMAGES.usage} alt="花屋さんの日常" className="relative rounded-[2.5rem] shadow-2xl shadow-[#AFC6B2]/30 w-full aspect-[4/5] object-cover"/>
              </div>

              <div className="order-1 md:order-2 space-y-5">
                {[
                  { time: "8:00", title: "朝の注文確認", desc: "前夜の電話・LINE・EC注文がダッシュボードに集約。スタッフ全員で当日の出荷を確認。" },
                  { time: "10:00", title: "配達ルート確認", desc: "今日の配達先と最適ルートが自動表示。ドライバーがスマホで確認しながら出発。" },
                  { time: "14:00", title: "店頭販売も同期", desc: "QRコードで商品をスキャン、PIN認証で在庫を減算。ECとの在庫差異もゼロに。" },
                  { time: "20:00", title: "1日の振り返り", desc: "売上ダッシュボードを確認。顧客カルテに今日のメモを追記して、明日へ。" },
                ].map((s, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-5 shadow-[0_4px_24px_rgba(174,198,178,0.15)] border border-white">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-[#AFC6B2] to-[#7A9279] flex items-center justify-center">
                        <span className="text-white font-bold text-[12px]">{s.time}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-[15px] font-bold text-[#2C2C2C] mb-1.5">{s.title}</h3>
                        <p className="text-[12.5px] text-[#5B5B5B] leading-[1.9]">{s.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* BENEFITS - Before/After */}
        {/* ============================================== */}
        <section className="py-24 md:py-32 px-6 bg-[#FFFDF9]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] font-bold text-[#D9825B] tracking-[0.3em] mb-4">BENEFITS</p>
              <h2 className="text-[28px] md:text-[40px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                導入したら、こう変わる。
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-[900px] mx-auto">
              {/* BEFORE */}
              <div className="bg-[#F4EEE4] rounded-[2rem] p-8 md:p-10 border border-[#E8DFD0]">
                <p className="text-[10px] font-bold text-[#A8A299] tracking-[0.3em] mb-3">BEFORE</p>
                <h3 className="text-[18px] font-bold text-[#5B5B5B] mb-6">いままで</h3>
                <ul className="space-y-4 text-[13px] text-[#6B6B6B]">
                  {[
                    "電話注文は紙メモ・LINE注文はスマホで別管理",
                    "配達ルートは毎朝Googleマップで手作業",
                    "立札は手書き・連名で混乱",
                    "売上集計は月末にExcelで2時間",
                    "EC開設には別の制作会社に発注必要",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2.5 line-through opacity-70">
                      <span className="text-[#A8A299] mt-1.5 shrink-0">―</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* AFTER */}
              <div className="bg-gradient-to-br from-[#AFC6B2] to-[#7A9279] rounded-[2rem] p-8 md:p-10 text-white shadow-xl shadow-[#7A9279]/20">
                <p className="text-[10px] font-bold text-white/80 tracking-[0.3em] mb-3">AFTER</p>
                <h3 className="text-[18px] font-bold mb-6">FLORIX 導入後</h3>
                <ul className="space-y-4 text-[13px]">
                  {[
                    "すべての注文経路を1画面で確認・一元管理",
                    "配達ルートは自動最適化・所要時間も予測",
                    "立札8パターンから選んで自動で文字入れ",
                    "売上はリアルタイムでダッシュボード表示",
                    "独自ドメインで24時間ECがすぐスタート",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check size={18} className="mt-0.5 shrink-0 text-white"/>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* ACHIEVEMENTS - 数字で語る */}
        {/* ============================================== */}
        <section className="py-20 md:py-28 px-6 bg-gradient-to-br from-[#F8F2E8] via-[#FBF6EE] to-[#F8F2E8]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold text-[#7A9279] tracking-[0.3em] mb-4">ACHIEVEMENTS</p>
              <h2 className="text-[24px] md:text-[36px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                数字が語る、FLORIXの実力。
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[
                { num: "27", unit: "店舗", label: "導入実績" },
                { num: "85", unit: "%", label: "業務時間短縮（平均）" },
                { num: "4.8", unit: "/ 5", label: "お客様満足度" },
                { num: "30", unit: "日", label: "無料トライアル" },
              ].map((a, idx) => (
                <div key={idx} className="bg-white/70 backdrop-blur-md border border-white rounded-[1.5rem] p-6 md:p-8 text-center shadow-[0_4px_24px_rgba(174,198,178,0.12)]">
                  <div className="text-[40px] md:text-[56px] font-bold text-[#D9825B] leading-none" style={{ fontFamily: "'Playfair Display',serif" }}>
                    {a.num}
                    <span className="text-[14px] md:text-[18px] ml-1 text-[#7A9279]">{a.unit}</span>
                  </div>
                  <p className="text-[11px] md:text-[12px] font-semibold text-[#5B5B5B] mt-2 tracking-wider">{a.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* TESTIMONIALS */}
        {/* ============================================== */}
        <section id="voice" className="py-24 md:py-32 px-6 bg-[#FFFDF9]">
          <div className="max-w-[1180px] mx-auto">
            <div className="text-center mb-16">
              <p className="text-[11px] font-bold text-[#D9825B] tracking-[0.3em] mb-4">VOICE</p>
              <h2 className="text-[28px] md:text-[40px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                花屋さんから、嬉しい声。
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  img: IMAGES.testimonial1,
                  name: "佐藤様",
                  shop: "東京・個人店オーナー",
                  comment: "電話注文と店頭販売の在庫がバラバラで困っていました。FLORIXで一元管理できるようになり、毎日の確認時間が30分から5分に短縮されました。",
                },
                {
                  img: IMAGES.testimonial2,
                  name: "田中様",
                  shop: "札幌・3店舗運営",
                  comment: "3店舗の売上を一画面で見られるようになり、経営判断がスピーディーに。スタッフのシフト管理もすべて FLORIX 内で完結します。",
                },
                {
                  img: IMAGES.testimonial3,
                  name: "山田様",
                  shop: "大阪・新規開業",
                  comment: "開店と同時に導入。ホームページを別途作る必要がなく、FLORIX の EC機能だけで Google検索からのお客様も増えています。",
                },
              ].map((v, idx) => (
                <article key={idx} className="bg-white rounded-[2rem] p-8 border border-[#F0E8DD] shadow-[0_8px_32px_rgba(217,130,91,0.05)]">
                  <p className="text-[13px] md:text-[14px] text-[#3C3C3C] leading-[2.1] mb-6 font-medium">
                    「{v.comment}」
                  </p>
                  <div className="flex items-center gap-3 pt-5 border-t border-[#F0E8DD]">
                    <img src={v.img} alt={v.name} className="w-12 h-12 rounded-full object-cover"/>
                    <div>
                      <p className="text-[13px] font-bold text-[#2C2C2C]">{v.name}</p>
                      <p className="text-[11px] text-[#7A9279]">{v.shop}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* PRICING - 動的にオーナー画面と連携 */}
        {/* ============================================== */}
        <section id="pricing" className="py-24 md:py-32 px-6 bg-[#F8F2E8] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#AFC6B2]/10 blur-3xl"></div>

          <div className="max-w-[1180px] mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-[11px] font-bold text-[#7A9279] tracking-[0.3em] mb-4">PRICING</p>
              <h2 className="text-[28px] md:text-[44px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                わかりやすい、3つのプラン。
              </h2>
              <p className="text-[14px] text-[#5B5B5B] leading-[2] mt-5">
                必要な機能だけ。お店の規模に合わせて選べます。
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5 max-w-[1000px] mx-auto">
              {pricing.plans.map((plan: LpPlan, idx: number) => {
                const isRecommended = plan.recommended;
                const priceDisplay = plan.priceText
                  ? plan.priceText
                  : (plan.price != null ? `¥${Number(plan.price).toLocaleString()}` : "お問い合わせ");
                const isCustomPriceText = !!plan.priceText || plan.price == null;
                return (
                  <div
                    key={idx}
                    className={`relative rounded-[2rem] p-8 transition-all ${
                      isRecommended
                        ? "bg-[#2C2C2C] text-white shadow-2xl shadow-[#2C2C2C]/15 md:scale-105"
                        : "bg-white/80 backdrop-blur-md border border-white shadow-[0_8px_32px_rgba(174,198,178,0.12)]"
                    }`}
                  >
                    {isRecommended && (
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#D9825B] text-white text-[11px] font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                        おすすめ
                      </span>
                    )}
                    <h3 className={`text-[20px] font-bold mb-1 ${isRecommended ? "" : "text-[#2C2C2C]"}`} style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                      {plan.name}
                    </h3>
                    <p className={`text-[11px] mb-6 ${isRecommended ? "text-white/70" : "text-[#7A9279]"}`}>
                      {plan.subtitle}
                    </p>
                    <div className="mb-7 pb-7 border-b border-current/15">
                      <span className={`${isCustomPriceText ? "text-[26px]" : "text-[44px]"} font-bold leading-none ${isRecommended ? "text-[#F8F2E8]" : "text-[#D9825B]"}`} style={{ fontFamily: "'Playfair Display',serif" }}>
                        {priceDisplay}
                      </span>
                      {!isCustomPriceText && (
                        <span className={`text-[12px] ml-2 ${isRecommended ? "text-white/70" : "text-[#6B6B6B]"}`}>
                          / 月（税抜）
                        </span>
                      )}
                    </div>
                    <ul className="space-y-3 text-[13px] mb-7">
                      {(plan.features || []).map((f: string, fi: number) => (
                        <li key={fi} className="flex items-start gap-2.5">
                          <Check size={15} className={`mt-0.5 shrink-0 ${isRecommended ? "text-[#AFC6B2]" : "text-[#7A9279]"}`}/>
                          <span className={isRecommended ? "text-white/90" : "text-[#5B5B5B]"}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href="#contact"
                      className={`block w-full text-center h-12 leading-[48px] rounded-full text-[13px] font-bold transition-all ${
                        isRecommended
                          ? "bg-[#D9825B] text-white hover:bg-[#B86340]"
                          : "bg-[#2C2C2C] text-white hover:bg-[#D9825B]"
                      }`}
                    >
                      無料で始める
                    </a>
                  </div>
                );
              })}
            </div>

            {pricing.note && (
              <p className="text-center text-[13px] text-[#5B5B5B] mt-10" dangerouslySetInnerHTML={{
                __html: String(pricing.note).replace(/30日間無料トライアル/g, "<strong class='text-[#D9825B]'>30日間無料トライアル</strong>"),
              }} />
            )}
          </div>
        </section>

        {/* ============================================== */}
        {/* FAQ */}
        {/* ============================================== */}
        <section id="faq" className="py-24 md:py-32 px-6 bg-[#FFFDF9]">
          <div className="max-w-[800px] mx-auto">
            <div className="text-center mb-14">
              <p className="text-[11px] font-bold text-[#D9825B] tracking-[0.3em] mb-4">FAQ</p>
              <h2 className="text-[28px] md:text-[40px] font-bold text-[#2C2C2C] leading-[1.4]" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                よくいただくご質問
              </h2>
            </div>

            <div className="space-y-3">
              {[
                { q: "パソコンが苦手でも使えますか？", a: "はい、スマホ・タブレットから操作可能です。導入時はオンライン研修を実施しますので、安心してご利用いただけます。" },
                { q: "今使っているExcelや顧客リストから移行できますか？", a: "はい、CSV形式でお送りいただければインポート作業を代行いたします。新規導入時の初期セットアップでサポートします。" },
                { q: "途中でプラン変更はできますか？", a: "もちろん可能です。お店の成長に合わせてアップグレード・ダウングレードがいつでも可能。日割り計算で精算します。" },
                { q: "解約はいつでもできますか？", a: "はい、月単位でいつでも解約可能です。違約金や年契約縛りは一切ありません。" },
                { q: "ホームページがないけどECだけ作れますか？", a: "はい、独自ドメインに対応したオンラインショップとしてご利用いただけます。SEO対策（サイトマップ・構造化データ・OG画像）も標準装備です。" },
                { q: "セキュリティは大丈夫ですか？", a: "個人情報は暗号化保管、通信もSSL/TLS、二段階認証、操作監査ログ、リアルタイム監視（Sentry）まで導入済みです。" },
              ].map((item, idx) => (
                <details key={idx} className="group bg-[#F8F2E8] rounded-[1.5rem] border border-[#E8DFD0] open:bg-white open:shadow-md transition-all">
                  <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                    <span className="font-bold text-[14px] md:text-[15px] text-[#2C2C2C] pr-4">{item.q}</span>
                    <span className="w-8 h-8 shrink-0 rounded-full bg-white border border-[#E8DFD0] flex items-center justify-center text-[#D9825B] group-open:rotate-180 transition-transform">
                      <ChevronDown size={16}/>
                    </span>
                  </summary>
                  <p className="px-6 pb-6 text-[13px] text-[#5B5B5B] leading-[2]">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* FINAL CTA - PASONA: Narrow + Action */}
        {/* ============================================== */}
        <section id="contact" className="py-24 md:py-32 px-6 bg-gradient-to-br from-[#2C2C2C] via-[#3A3A3A] to-[#2C2C2C] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#D9825B]/20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#AFC6B2]/15 blur-3xl"></div>

          <div className="max-w-[800px] mx-auto relative">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold text-[#D9825B] tracking-[0.3em] mb-4">GET STARTED</p>
              <h2 className="text-[32px] md:text-[52px] font-bold leading-[1.2] mb-6" style={{ fontFamily: "'Playfair Display','Noto Serif JP',serif" }}>
                花屋業務、<br/>
                ぜんぶ FLORIX に。
              </h2>
              <div className="inline-block bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 mb-8">
                <p className="text-[13px] md:text-[14px] text-white/90 font-medium">
                  期間限定 — 30日間 無料・初期費用 ¥0・クレカ登録 不要
                </p>
              </div>
              <p className="text-[14px] text-white/70 leading-[1.9] max-w-[600px] mx-auto">
                ご相談・デモご希望は、下のフォームから30秒で。<br/>
                押し売りはいたしません。
              </p>
            </div>

            <div className="bg-white text-[#2C2C2C] rounded-[2rem] p-7 md:p-10 shadow-2xl">
              <form action="mailto:contact@noodleflorix.com" method="post" encType="text/plain" className="space-y-5">
                <div>
                  <label className="text-[12px] font-bold text-[#2C2C2C] block mb-2">お店のお名前・お名前 *</label>
                  <input
                    type="text"
                    name="お店・お名前"
                    required
                    className="w-full h-12 bg-[#FFFDF9] border border-[#E8DFD0] rounded-xl px-4 text-[13px] focus:border-[#D9825B] focus:outline-none focus:ring-2 focus:ring-[#D9825B]/20 transition"
                    placeholder="例：花屋さくら / 田中太郎"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#2C2C2C] block mb-2">メールアドレス *</label>
                  <input
                    type="email"
                    name="メール"
                    required
                    className="w-full h-12 bg-[#FFFDF9] border border-[#E8DFD0] rounded-xl px-4 text-[13px] focus:border-[#D9825B] focus:outline-none focus:ring-2 focus:ring-[#D9825B]/20 transition"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#2C2C2C] block mb-2">電話番号</label>
                  <input
                    type="tel"
                    name="電話"
                    className="w-full h-12 bg-[#FFFDF9] border border-[#E8DFD0] rounded-xl px-4 text-[13px] focus:border-[#D9825B] focus:outline-none focus:ring-2 focus:ring-[#D9825B]/20 transition"
                    placeholder="090-0000-0000（任意）"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#2C2C2C] block mb-2">ご相談内容</label>
                  <textarea
                    name="ご相談内容"
                    rows={4}
                    className="w-full bg-[#FFFDF9] border border-[#E8DFD0] rounded-xl px-4 py-3 text-[13px] focus:border-[#D9825B] focus:outline-none focus:ring-2 focus:ring-[#D9825B]/20 transition resize-none"
                    placeholder="お悩み、ご質問、デモご希望など、お気軽にどうぞ。"
                  />
                </div>
                <button
                  type="submit"
                  className="group w-full h-14 bg-[#D9825B] text-white rounded-full text-[15px] font-bold hover:bg-[#B86340] transition-all shadow-lg shadow-[#D9825B]/30 flex items-center justify-center gap-2"
                >
                  <Send size={16}/>
                  30日間 無料で始める
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
                </button>
                <p className="text-[11px] text-[#7A9279] text-center pt-2">
                  ※ ご相談はすべて無料です。お電話でも受付しています。
                </p>
              </form>
            </div>

            <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-[13px] text-white/80">
              <a href="mailto:contact@noodleflorix.com" className="hover:text-white inline-flex items-center gap-2 transition">
                <Mail size={14}/> contact@noodleflorix.com
              </a>
              <span className="hidden sm:inline text-white/30">|</span>
              <span className="inline-flex items-center gap-2">
                <Phone size={14}/> 平日 9:00 - 18:00
              </span>
            </div>
          </div>
        </section>

        {/* ============================================== */}
        {/* FOOTER */}
        {/* ============================================== */}
        <footer className="py-12 px-6 bg-[#1C1C1C] text-white/60">
          <div className="max-w-[1180px] mx-auto">
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div>
                <p className="font-bold text-white text-[22px] tracking-[0.18em] mb-2">FLORIX</p>
                <p className="text-[12px] leading-[1.9]">
                  花屋業務を、ぜんぶ FLORIX に。<br/>
                  運営: NocoLde
                </p>
              </div>
              <div className="flex md:justify-end gap-6 items-start text-[12px]">
                <Link href="/privacy" className="hover:text-white transition">プライバシーポリシー</Link>
                <a href="#contact" className="hover:text-white transition">お問い合わせ</a>
                <Link href="/staff/login" className="hover:text-white transition">ログイン</Link>
              </div>
            </div>
            <div className="pt-6 border-t border-white/10 text-center text-[11px]">
              © {new Date().getFullYear()} NocoLde / FLORIX. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
