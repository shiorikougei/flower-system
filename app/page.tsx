// =============================================================
// FLORIX LP - 花屋専用 受注クラウド
// プロチーム共同設計（最終版）
// =============================================================
//   コンセプト: 花屋のブランド価値を上げる、上質な業務OS
//   配色      : Sage Green #A7B8A1 / Terracotta #C97D60 / BG #FAF7F2
//   フォント  : Shippori Mincho（見出し）/ Zen Kaku Gothic New（本文）/ Outfit（英字）
//   構成      : Hero → Problem → Solution → Features → CTA → Usage
//             → Benefits → CTA → Pricing → FAQ → Final CTA → Footer
//   CTA       : 4箇所配置 + モバイルSticky
//   実績/声   : 削除（架空訴求しない）
// =============================================================

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LP_PRICING, fetchLpPricing } from "@/utils/lpPricing";
import {
  ArrowRight, Check, ChevronDown, Mail, Phone, Send,
  ShoppingBag, Truck, Users, ClipboardList,
  Clock, AlertCircle, Inbox, GraduationCap, MessageSquare,
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
// 画像（キュレーション済み・水揚げ/制作/陳列フォーカス）
// =============================================================
const IMG = {
  hero: "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=1600&q=90&auto=format&fit=crop",
  problem1: "https://images.unsplash.com/photo-1487070183336-b863922373d4?w=900&q=85&auto=format&fit=crop",
  problem2: "https://images.unsplash.com/photo-1602940659805-770d1b3b9911?w=900&q=85&auto=format&fit=crop",
  solution: "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1400&q=90&auto=format&fit=crop",
  f1: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1000&q=85&auto=format&fit=crop",
  f2: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=1000&q=85&auto=format&fit=crop",
  f3: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1000&q=85&auto=format&fit=crop",
  f4: "https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=1000&q=85&auto=format&fit=crop",
  usage: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=1200&q=90&auto=format&fit=crop",
};

// =============================================================
// SEO メタデータ
// =============================================================
export const revalidate = 3600;

export const metadata = {
  title: "FLORIX｜花屋専用 受注クラウド | 電話注文を減らし、営業時間外の売上を増やす",
  description: "FLORIX（フローリックス）は、花屋さんのために開発された受注クラウド。電話・LINE・店頭・ECの受注を一画面に統合。配達ルート最適化、立札自動生成、独自ドメインEC、顧客カルテまで。月額¥3,800〜・30日間無料。",
  keywords: ["花屋", "受注管理", "業務システム", "フラワーショップ", "EC", "配達管理", "顧客管理", "クラウド", "SaaS", "FLORIX"],
  openGraph: {
    title: "電話注文を減らし、営業時間外の売上を増やす花屋専用システム",
    description: "受注・配達・EC・顧客管理を、ひとつの画面に。FLORIX は花屋さんの日常を変える業務OSです。",
    url: "https://www.noodleflorix.com",
    siteName: "FLORIX",
    locale: "ja_JP",
    type: "website",
    images: [{ url: IMG.hero, width: 1200, height: 630, alt: "FLORIX" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "電話注文を減らし、営業時間外の売上を増やす花屋専用システム",
    description: "FLORIX | 花屋専用 受注クラウド",
    images: [IMG.hero],
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FLORIX",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "花屋専用のクラウド受注・業務管理システム。",
    offers: { "@type": "Offer", price: "3800", priceCurrency: "JPY" },
    provider: { "@type": "Organization", name: "NocoLde", url: "https://www.noodleflorix.com" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "NocoLde",
    url: "https://www.noodleflorix.com",
  },
];

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
      {structuredData.map((sd, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sd) }}/>
      ))}

      <div
        className="min-h-screen bg-[#FAF7F2] text-[#2F2F2F] selection:bg-[#C97D60]/15"
        style={{ fontFamily: "var(--font-zen-kaku), 'Hiragino Kaku Gothic ProN', system-ui, sans-serif" }}
      >

        {/* ============================================ */}
        {/* NAV */}
        {/* ============================================ */}
        <nav className="sticky top-0 z-50 bg-[#FAF7F2]/85 backdrop-blur-xl border-b border-[#E5DED2]/60">
          <div className="max-w-[1140px] mx-auto h-[68px] px-6 flex items-center justify-between">
            <Link
              href="/"
              className="text-[24px] tracking-[0.18em] font-medium text-[#2F2F2F]"
              style={{ fontFamily: "var(--font-outfit), system-ui" }}
            >
              FLORIX
            </Link>
            <div className="flex items-center gap-1 md:gap-6">
              <a href="#problem" className="hidden md:block text-[13px] text-[#6B6B6B] hover:text-[#2F2F2F] transition">花屋の課題</a>
              <a href="#features" className="hidden md:block text-[13px] text-[#6B6B6B] hover:text-[#2F2F2F] transition">機能</a>
              <a href="#pricing" className="hidden md:block text-[13px] text-[#6B6B6B] hover:text-[#2F2F2F] transition">料金</a>
              <a href="#faq" className="hidden md:block text-[13px] text-[#6B6B6B] hover:text-[#2F2F2F] transition">FAQ</a>
              <Link href="/staff/login" className="text-[12px] text-[#6B6B6B] hover:text-[#2F2F2F] px-3 py-1.5 transition">ログイン</Link>
              <a
                href="#contact"
                className="text-[12px] font-medium bg-[#2F2F2F] text-white px-5 py-2.5 rounded-full hover:bg-[#C97D60] transition-all"
              >
                無料相談
              </a>
            </div>
          </div>
        </nav>

        {/* ============================================ */}
        {/* HERO（CTA #1） */}
        {/* ============================================ */}
        <section className="relative overflow-hidden pt-14 md:pt-24 pb-20 md:pb-28 px-6">
          <div className="absolute top-32 -left-40 w-[480px] h-[480px] rounded-full bg-[#A7B8A1]/15 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 -right-40 w-[420px] h-[420px] rounded-full bg-[#C97D60]/10 blur-3xl pointer-events-none"></div>

          <div className="max-w-[1140px] mx-auto relative">
            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">

              <div>
                <p
                  className="inline-block text-[11px] tracking-[0.4em] text-[#7E9279] font-medium mb-6 pb-2 border-b border-[#A7B8A1]/50"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  FOR FLORISTS — RECEIVING ORDERS, REIMAGINED
                </p>

                <h1
                  className="text-[34px] md:text-[48px] lg:text-[58px] font-medium leading-[1.4] mb-8 tracking-[0.01em]"
                  style={{ fontFamily: "var(--font-shippori), 'Noto Serif JP', serif" }}
                >
                  電話注文を減らし、<br/>
                  営業時間外の売上を<br/>
                  <span className="text-[#C97D60]">増やす</span>。
                </h1>

                <p
                  className="text-[14px] md:text-[16px] text-[#5B5B5B] leading-[2] mb-10 max-w-[520px]"
                  style={{ fontFamily: "var(--font-zen-kaku)" }}
                >
                  花屋専用の受注クラウド、FLORIX。<br/>
                  電話・LINE・EC・店頭の注文を、ひとつの画面に。<br/>
                  花仕事に集中できる毎日を、つくります。
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <a
                    href="#contact"
                    className="group inline-flex items-center justify-center gap-2 h-14 px-8 bg-[#C97D60] text-white rounded-full text-[14px] font-medium hover:bg-[#A8624A] transition-all shadow-[0_12px_36px_-12px_rgba(201,125,96,0.5)]"
                  >
                    30日間 無料で試してみる
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
                  </a>
                  <a
                    href="#features"
                    className="inline-flex items-center justify-center h-14 px-7 bg-white/60 backdrop-blur-md border border-[#E5DED2] text-[#2F2F2F] rounded-full text-[14px] font-medium hover:bg-white transition-all"
                  >
                    機能を見る
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-[#6B6B6B]" style={{ fontFamily: "var(--font-zen-kaku)" }}>
                  <span className="flex items-center gap-1.5"><Check size={13} className="text-[#7E9279]"/> 初期費用 0円</span>
                  <span className="flex items-center gap-1.5"><Check size={13} className="text-[#7E9279]"/> クレカ登録 不要</span>
                  <span className="flex items-center gap-1.5"><Check size={13} className="text-[#7E9279]"/> いつでも解約OK</span>
                </div>
              </div>

              {/* 右：写真 */}
              <div className="relative">
                <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#A7B8A1]/30"></div>
                <div className="absolute -bottom-10 -left-10 w-52 h-52 rounded-full bg-[#C97D60]/15"></div>

                <div className="relative rounded-[36px] overflow-hidden shadow-[0_24px_64px_-24px_rgba(168,98,74,0.25)]">
                  <img src={IMG.hero} alt="花屋の手仕事" className="w-full aspect-[4/5] object-cover"/>
                </div>

                <div className="absolute bottom-8 -left-4 md:-left-12 bg-white/95 backdrop-blur-xl border border-[#E5DED2] rounded-2xl px-5 py-4 shadow-[0_16px_48px_-12px_rgba(126,146,121,0.2)]">
                  <p className="text-[10px] tracking-[0.25em] text-[#7E9279] font-medium mb-1" style={{ fontFamily: "var(--font-outfit)" }}>MONTHLY</p>
                  <p
                    className="text-[26px] text-[#2F2F2F] leading-none"
                    style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
                  >
                    {featuredPlan?.price ? `¥${featuredPlan.price.toLocaleString()}` : "お問い合わせ"}
                    {featuredPlan?.price && <span className="text-[11px] text-[#6B6B6B] ml-1">/月〜</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* PROBLEM */}
        {/* ============================================ */}
        <section id="problem" className="py-24 md:py-36 px-6 bg-[#FAF7F2]">
          <div className="max-w-[1140px] mx-auto">
            <div className="max-w-[640px] mb-16">
              <p className="text-[11px] tracking-[0.35em] text-[#C97D60] font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                PROBLEM
              </p>
              <h2
                className="text-[28px] md:text-[40px] leading-[1.5] mb-6 text-[#2F2F2F]"
                style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
              >
                花屋の現場には、<br/>
                見えない 5 つの負担があります。
              </h2>
              <p className="text-[14px] text-[#5B5B5B] leading-[2]">
                毎日の業務に追われ、本当はやりたい花仕事に時間が割けない。<br/>
                その悩み、システムで解けるものが意外と多いのです。
              </p>
            </div>

            {/* 大きな1枚 + 5項目 */}
            <div className="grid md:grid-cols-[1fr_1fr] gap-10 md:gap-16 items-start">
              <div className="relative">
                <div className="rounded-[32px] overflow-hidden shadow-[0_24px_64px_-24px_rgba(168,98,74,0.2)]">
                  <img src={IMG.problem1} alt="店内の電話受付" className="w-full aspect-[4/5] object-cover"/>
                </div>
              </div>

              <ul className="space-y-3">
                {[
                  { Icon: Phone, title: "電話が止まらず、制作の手が止まる", desc: "1日の3割を電話対応に費やしているかもしれません。" },
                  { Icon: MessageSquare, title: "LINE・メール・店頭で注文が散在", desc: "確認漏れ・転記ミスが、ご注文ミスの温床に。" },
                  { Icon: Clock, title: "営業時間外の注文を、取りこぼしている", desc: "深夜・早朝の問い合わせの多くは、翌朝には別店舗へ。" },
                  { Icon: AlertCircle, title: "立札の文字・宛名で、ヒヤッとする", desc: "手書きの煩雑さが、ミスのリスクをつくります。" },
                  { Icon: GraduationCap, title: "新人教育に、毎回1ヶ月以上", desc: "業務を覚えるまで、人件費と機会損失が重なります。" },
                ].map(({ Icon, title, desc }, idx) => (
                  <li
                    key={idx}
                    className="bg-white/80 backdrop-blur-sm border border-[#E5DED2] rounded-[20px] p-5 md:p-6 hover:bg-white hover:shadow-[0_8px_32px_-8px_rgba(126,146,121,0.15)] transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 shrink-0 rounded-2xl bg-[#F4EFE6] flex items-center justify-center text-[#C97D60]">
                        <Icon size={18}/>
                      </div>
                      <div className="flex-1 pt-0.5">
                        <h3
                          className="text-[15px] md:text-[16px] font-medium text-[#2F2F2F] mb-1.5"
                          style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
                        >
                          {title}
                        </h3>
                        <p className="text-[12.5px] text-[#6B6B6B] leading-[1.9]">{desc}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* SOLUTION */}
        {/* ============================================ */}
        <section className="py-24 md:py-36 px-6 bg-[#F4EFE6] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#A7B8A1]/10 blur-3xl"></div>

          <div className="max-w-[1140px] mx-auto relative">
            <div className="text-center max-w-[700px] mx-auto mb-16">
              <p className="text-[11px] tracking-[0.35em] text-[#7E9279] font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                SOLUTION
              </p>
              <h2
                className="text-[28px] md:text-[44px] leading-[1.5] mb-6 text-[#2F2F2F]"
                style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
              >
                すべての受注を、<br/>
                ひとつの画面に。
              </h2>
              <p className="text-[14px] text-[#5B5B5B] leading-[2]">
                電話・LINE・EC・店頭。注文経路がいくつあっても、<br/>
                FLORIX のダッシュボードに集約されます。<br/>
                聞き間違いゼロ、確認時間ゼロを目指せます。
              </p>
            </div>

            <div className="relative max-w-[960px] mx-auto">
              <div className="rounded-[40px] overflow-hidden shadow-[0_32px_80px_-24px_rgba(126,146,121,0.3)]">
                <img src={IMG.solution} alt="作業デスク" className="w-full aspect-[16/9] object-cover"/>
              </div>

              {/* Floating glass cards */}
              <div className="absolute -left-3 md:-left-8 top-1/4 hidden sm:block">
                <div className="bg-white/90 backdrop-blur-xl border border-[#E5DED2] rounded-2xl p-4 shadow-xl max-w-[220px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A7B8A1] animate-pulse"></span>
                    <p className="text-[10px] tracking-[0.2em] text-[#7E9279] font-medium" style={{ fontFamily: "var(--font-outfit)" }}>LIVE</p>
                  </div>
                  <p className="text-[12px] font-medium text-[#2F2F2F]">LINE経由の注文</p>
                  <p className="text-[20px] font-medium text-[#C97D60]" style={{ fontFamily: "var(--font-shippori), serif" }}>3 件</p>
                </div>
              </div>
              <div className="absolute -right-3 md:-right-8 bottom-1/4 hidden sm:block">
                <div className="bg-white/90 backdrop-blur-xl border border-[#E5DED2] rounded-2xl p-4 shadow-xl max-w-[220px]">
                  <p className="text-[10px] tracking-[0.2em] text-[#7E9279] font-medium mb-1" style={{ fontFamily: "var(--font-outfit)" }}>TODAY</p>
                  <p className="text-[12px] font-medium text-[#2F2F2F]">本日の配達</p>
                  <p className="text-[20px] font-medium text-[#C97D60]" style={{ fontFamily: "var(--font-shippori), serif" }}>12 件</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* FEATURES */}
        {/* ============================================ */}
        <section id="features" className="py-24 md:py-36 px-6 bg-[#FAF7F2]">
          <div className="max-w-[1140px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-20">
              <p className="text-[11px] tracking-[0.35em] text-[#C97D60] font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                FEATURES
              </p>
              <h2
                className="text-[28px] md:text-[44px] leading-[1.5] mb-6 text-[#2F2F2F]"
                style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
              >
                花仕事に、戻る時間を。
              </h2>
              <p className="text-[14px] text-[#5B5B5B] leading-[2]">
                4 つの主軸機能が、花屋の 1 日を支えます。
              </p>
            </div>

            <div className="space-y-24 md:space-y-32">
              {[
                {
                  no: "01",
                  category: "ORDER",
                  title: "受注を、ひとつの画面に。",
                  lead: "電話・LINE・EC・店頭。すべての注文経路を統合管理。",
                  desc: "ばらばらだった注文情報が、FLORIX に集約されます。納期カレンダーで配達日を自動管理、立札と領収書も自動生成。手書きの煩わしさから、解放されます。",
                  tags: ["カスタムオーダー", "納期カレンダー", "立札 8 パターン自動生成", "領収書 PDF", "インボイス対応"],
                  image: IMG.f1,
                  Icon: ClipboardList,
                },
                {
                  no: "02",
                  category: "DELIVERY",
                  title: "配達を、最短ルートで。",
                  lead: "Google マップ連携で、配達計画を自動最適化。",
                  desc: "配達順・ドライバー・到着予定時刻を地図ビューで一目に。お客様への完成通知と配達連絡は LINE で自動送信。遅延の連絡漏れも、もうありません。",
                  tags: ["ルート最適化", "地図ビュー", "LINE 自動通知", "配達状況リアルタイム"],
                  image: IMG.f2,
                  Icon: Truck,
                },
                {
                  no: "03",
                  category: "ECOMMERCE",
                  title: "EC で、24 時間営業に。",
                  lead: "独自ドメインのオンラインショップを、すぐに開設。",
                  desc: "Stripe 決済・在庫管理・SEO 対策（構造化データ・サイトマップ・OG 画像）まで標準装備。深夜・早朝の検索流入も、売上に変えていきます。",
                  tags: ["独自ドメイン対応", "Stripe 決済", "SEO 標準装備", "QR 在庫管理", "FAQ・ブログ機能"],
                  image: IMG.f3,
                  Icon: ShoppingBag,
                },
                {
                  no: "04",
                  category: "CRM",
                  title: "顧客を、一生のお客様に。",
                  lead: "誕生日も、好みも、自動で蓄積。",
                  desc: "ご注文履歴からお客様の好み傾向を自動分析。記念日リマインダー・誕生日メッセージは自動配信。LINE 公式連携で、もっと近くなるお客様との関係。",
                  tags: ["顧客カルテ", "好み傾向分析", "記念日リマインダー", "LINE 公式連携"],
                  image: IMG.f4,
                  Icon: Users,
                },
              ].map((f, idx) => {
                const Icon = f.Icon;
                const isLeft = idx % 2 === 0;
                return (
                  <article key={f.no} className="grid md:grid-cols-2 gap-10 md:gap-20 items-center">
                    <div className={`${isLeft ? "" : "md:order-2"} relative`}>
                      <div className={`absolute ${isLeft ? "-top-6 -left-6" : "-top-6 -right-6"} w-32 h-32 rounded-full bg-[#A7B8A1]/20`}></div>
                      <div className="relative rounded-[32px] overflow-hidden shadow-[0_24px_64px_-24px_rgba(168,98,74,0.18)]">
                        <img src={f.image} alt={f.title} className="w-full aspect-[5/4] object-cover"/>
                      </div>
                    </div>

                    <div className={isLeft ? "" : "md:order-1"}>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[11px] tracking-[0.35em] text-[#7E9279] font-medium" style={{ fontFamily: "var(--font-outfit)" }}>
                          {f.no}　/　{f.category}
                        </span>
                      </div>
                      <div className="flex items-start gap-3 mb-5">
                        <div className="w-11 h-11 shrink-0 rounded-2xl bg-[#F4EFE6] flex items-center justify-center text-[#C97D60]">
                          <Icon size={20}/>
                        </div>
                        <h3
                          className="text-[24px] md:text-[32px] leading-[1.4] text-[#2F2F2F] pt-1"
                          style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
                        >
                          {f.title}
                        </h3>
                      </div>
                      <p className="text-[14px] md:text-[15px] font-medium text-[#7E9279] mb-4 leading-relaxed">
                        {f.lead}
                      </p>
                      <p className="text-[13.5px] md:text-[14px] text-[#5B5B5B] leading-[2] mb-6">
                        {f.desc}
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {f.tags.map(tag => (
                          <li key={tag} className="text-[11.5px] font-medium text-[#5B5B5B] bg-white border border-[#E5DED2] px-3.5 py-1.5 rounded-full">
                            {tag}
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

        {/* ============================================ */}
        {/* CTA #2 - 機能後 */}
        {/* ============================================ */}
        <section className="py-20 px-6 bg-[#FAF7F2]">
          <div className="max-w-[900px] mx-auto">
            <div className="relative rounded-[32px] overflow-hidden bg-gradient-to-br from-[#A7B8A1] to-[#7E9279] p-10 md:p-16 text-white">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 blur-2xl -mt-32 -mr-32"></div>

              <div className="relative text-center">
                <p className="text-[11px] tracking-[0.35em] text-white/70 font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                  YOUR FLOWER SHOP, REIMAGINED
                </p>
                <h2
                  className="text-[24px] md:text-[36px] leading-[1.5] mb-6"
                  style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
                >
                  いまの業務、見直してみませんか。
                </h2>
                <p className="text-[14px] text-white/85 leading-[2] mb-8 max-w-[560px] mx-auto">
                  まずは 30 分のオンラインデモから。<br/>
                  実際の画面をお見せしながら、ご質問にお答えします。
                </p>
                <a
                  href="#contact"
                  className="group inline-flex items-center justify-center gap-2 h-14 px-8 bg-white text-[#2F2F2F] rounded-full text-[14px] font-medium hover:bg-[#C97D60] hover:text-white transition-all shadow-xl"
                >
                  無料相談・デモを申し込む
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* USAGE FLOW */}
        {/* ============================================ */}
        <section className="py-24 md:py-36 px-6 bg-[#F4EFE6]">
          <div className="max-w-[1140px] mx-auto">
            <div className="text-center max-w-[600px] mx-auto mb-16">
              <p className="text-[11px] tracking-[0.35em] text-[#7E9279] font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                USAGE
              </p>
              <h2
                className="text-[28px] md:text-[40px] leading-[1.5] mb-6 text-[#2F2F2F]"
                style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
              >
                ご注文の流れ
              </h2>
              <p className="text-[14px] text-[#5B5B5B] leading-[2]">
                お客様のご注文が、お届けに変わるまでの 5 ステップ
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
              <div className="relative md:sticky md:top-24">
                <div className="rounded-[32px] overflow-hidden shadow-[0_24px_64px_-24px_rgba(168,98,74,0.2)]">
                  <img src={IMG.usage} alt="店舗陳列" className="w-full aspect-[4/5] object-cover"/>
                </div>
              </div>

              <ol className="space-y-3">
                {[
                  { step: "01", title: "お客様がご注文", desc: "電話・LINE・EC・店頭、どの経路でも FLORIX に集約。" },
                  { step: "02", title: "スタッフが受注確認", desc: "ダッシュボードで全注文が一覧。配達日・立札・支払方法も即時確認。" },
                  { step: "03", title: "制作・立札準備", desc: "立札は 8 パターンから自動生成。連名・縦書きも対応。" },
                  { step: "04", title: "配達・受渡", desc: "配達ルート最適化。完成と配達状況を LINE で自動通知。" },
                  { step: "05", title: "次回への蓄積", desc: "顧客カルテに自動記録。記念日リマインダーで次の機会へ。" },
                ].map((s) => (
                  <li
                    key={s.step}
                    className="bg-white/80 backdrop-blur-sm border border-[#E5DED2] rounded-[24px] p-6 hover:bg-white transition-all"
                  >
                    <div className="flex items-start gap-5">
                      <span
                        className="text-[24px] text-[#C97D60] leading-none shrink-0"
                        style={{ fontFamily: "var(--font-outfit)", fontWeight: 500 }}
                      >
                        {s.step}
                      </span>
                      <div className="flex-1">
                        <h3
                          className="text-[16px] md:text-[18px] text-[#2F2F2F] mb-2"
                          style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
                        >
                          {s.title}
                        </h3>
                        <p className="text-[13px] text-[#5B5B5B] leading-[1.95]">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* BENEFITS */}
        {/* ============================================ */}
        <section className="py-24 md:py-36 px-6 bg-[#FAF7F2]">
          <div className="max-w-[1140px] mx-auto">
            <div className="text-center max-w-[700px] mx-auto mb-16">
              <p className="text-[11px] tracking-[0.35em] text-[#C97D60] font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                BENEFITS
              </p>
              <h2
                className="text-[28px] md:text-[40px] leading-[1.5] mb-6 text-[#2F2F2F]"
                style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
              >
                導入で、こう変わる。
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { before: "30 分", after: "5 分", label: "1日の注文確認時間" },
                { before: "取り逃し", after: "受注確保", label: "営業時間外の注文" },
                { before: "手書き", after: "自動生成", label: "立札の文字入れ" },
                { before: "1 ヶ月", after: "1 週間", label: "新人スタッフの教育期間" },
              ].map((b, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-[#E5DED2] rounded-[28px] p-7 md:p-8 hover:shadow-[0_16px_48px_-16px_rgba(126,146,121,0.18)] transition-all"
                >
                  <p className="text-[10px] tracking-[0.25em] text-[#7E9279] font-medium mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
                    BEFORE
                  </p>
                  <p className="text-[20px] text-[#A8A299] line-through mb-4" style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 500 }}>
                    {b.before}
                  </p>

                  <p className="text-[10px] tracking-[0.25em] text-[#C97D60] font-medium mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
                    AFTER
                  </p>
                  <p className="text-[34px] md:text-[40px] text-[#C97D60] leading-none mb-4" style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}>
                    {b.after}
                  </p>

                  <div className="pt-4 border-t border-[#E5DED2]">
                    <p className="text-[12px] text-[#6B6B6B] leading-[1.7]">
                      {b.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* CTA #3 - 料金前 */}
        {/* ============================================ */}
        <section className="py-16 px-6 bg-[#FAF7F2]">
          <div className="max-w-[900px] mx-auto text-center">
            <p className="text-[11px] tracking-[0.35em] text-[#C97D60] font-medium mb-4" style={{ fontFamily: "var(--font-outfit)" }}>
              GET STARTED FREE
            </p>
            <h2
              className="text-[24px] md:text-[32px] leading-[1.5] mb-6 text-[#2F2F2F]"
              style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
            >
              まずは 30 日間、<br className="md:hidden"/>無料で試してみませんか。
            </h2>
            <p className="text-[13px] text-[#5B5B5B] leading-[2] mb-8 max-w-[560px] mx-auto">
              クレジットカードのご登録は不要です。<br/>
              気に入らなければ、自動で解約されます。
            </p>
            <a
              href="#contact"
              className="group inline-flex items-center justify-center gap-2 h-14 px-8 bg-[#C97D60] text-white rounded-full text-[14px] font-medium hover:bg-[#A8624A] transition-all shadow-[0_12px_36px_-12px_rgba(201,125,96,0.5)]"
            >
              無料トライアルを申し込む
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
            </a>
          </div>
        </section>

        {/* ============================================ */}
        {/* PRICING */}
        {/* ============================================ */}
        <section id="pricing" className="py-24 md:py-36 px-6 bg-[#F4EFE6] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#A7B8A1]/15 blur-3xl"></div>

          <div className="max-w-[1140px] mx-auto relative">
            <div className="text-center max-w-[600px] mx-auto mb-16">
              <p className="text-[11px] tracking-[0.35em] text-[#7E9279] font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                PRICING
              </p>
              <h2
                className="text-[28px] md:text-[44px] leading-[1.5] mb-6 text-[#2F2F2F]"
                style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
              >
                必要な機能だけ、選べる3プラン。
              </h2>
              <p className="text-[14px] text-[#5B5B5B] leading-[2]">
                お店の規模・運営スタイルに合わせて、ご検討ください。
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
                    className={`relative rounded-[28px] p-8 transition-all ${
                      isRecommended
                        ? "bg-[#2F2F2F] text-white md:scale-105 shadow-2xl"
                        : "bg-white border border-[#E5DED2]"
                    }`}
                  >
                    {isRecommended && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C97D60] text-white text-[10px] font-medium px-4 py-1.5 rounded-full tracking-[0.2em]"
                        style={{ fontFamily: "var(--font-outfit)" }}
                      >
                        RECOMMENDED
                      </span>
                    )}
                    <h3
                      className={`text-[20px] mb-1 ${isRecommended ? "" : "text-[#2F2F2F]"}`}
                      style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
                    >
                      {plan.name}
                    </h3>
                    <p className={`text-[11px] mb-7 ${isRecommended ? "text-white/60" : "text-[#7E9279]"}`}>
                      {plan.subtitle}
                    </p>
                    <div className="mb-7 pb-7 border-b border-current/15">
                      <span
                        className={`${isCustomPriceText ? "text-[26px]" : "text-[42px]"} leading-none ${isRecommended ? "text-white" : "text-[#C97D60]"}`}
                        style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
                      >
                        {priceDisplay}
                      </span>
                      {!isCustomPriceText && (
                        <span className={`text-[11px] ml-2 ${isRecommended ? "text-white/60" : "text-[#6B6B6B]"}`}>
                          / 月（税抜）
                        </span>
                      )}
                    </div>
                    <ul className="space-y-3 text-[13px] mb-7 min-h-[160px]">
                      {(plan.features || []).map((f: string, fi: number) => (
                        <li key={fi} className="flex items-start gap-2.5">
                          <Check size={14} className={`mt-1 shrink-0 ${isRecommended ? "text-[#A7B8A1]" : "text-[#7E9279]"}`}/>
                          <span className={isRecommended ? "text-white/85" : "text-[#5B5B5B]"}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href="#contact"
                      className={`block w-full text-center h-12 leading-[48px] rounded-full text-[13px] font-medium transition-all ${
                        isRecommended
                          ? "bg-[#C97D60] text-white hover:bg-[#A8624A]"
                          : "bg-[#2F2F2F] text-white hover:bg-[#C97D60]"
                      }`}
                    >
                      無料相談する
                    </a>
                  </div>
                );
              })}
            </div>

            {pricing.note && (
              <p className="text-center text-[12px] text-[#6B6B6B] mt-10" dangerouslySetInnerHTML={{
                __html: String(pricing.note).replace(/30日間無料トライアル/g, "<strong class='text-[#C97D60]'>30日間無料トライアル</strong>"),
              }} />
            )}
          </div>
        </section>

        {/* ============================================ */}
        {/* FAQ */}
        {/* ============================================ */}
        <section id="faq" className="py-24 md:py-36 px-6 bg-[#FAF7F2]">
          <div className="max-w-[840px] mx-auto">
            <div className="text-center mb-14">
              <p className="text-[11px] tracking-[0.35em] text-[#C97D60] font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                FAQ
              </p>
              <h2
                className="text-[28px] md:text-[40px] leading-[1.5] text-[#2F2F2F]"
                style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
              >
                よくいただくご質問
              </h2>
            </div>

            <div className="space-y-3">
              {[
                { q: "パソコンが苦手でも使えますか。", a: "スマホ・タブレットからも操作できます。導入時のオンライン研修（30〜60分）もご用意しているため、安心してお試しいただけます。" },
                { q: "今使っている Excel から移行できますか。", a: "CSV 形式でお送りいただければ、商品・顧客データのインポート作業を導入時に代行いたします。" },
                { q: "途中でプラン変更はできますか。", a: "いつでも可能です。お店の成長に合わせて、アップグレード・ダウングレードともに日割り計算で対応します。" },
                { q: "解約はいつでもできますか。", a: "月単位でいつでも解約可能です。違約金や年契約縛りは一切ありません。" },
                { q: "ホームページがなくても EC は始められますか。", a: "FLORIX のオンラインショップは独自ドメインに対応しているため、これがそのまま貴店の EC サイトになります。SEO 対策も標準装備です。" },
                { q: "セキュリティは大丈夫ですか。", a: "個人情報はデータベース上で暗号化、通信は SSL/TLS、二段階認証、操作監査ログ、リアルタイム監視まで装備しています。" },
                { q: "電話注文の受付件数は、本当に減りますか。", a: "EC・LINE 注文に流れることで、繁忙期の電話本数が減ったというお声を多くいただいています。お試し中の効果測定もご相談ください。" },
                { q: "導入までの期間はどれくらいですか。", a: "最短 3 日でご利用開始いただけます。データ移行を含めても、通常 1〜2 週間です。" },
              ].map((item, idx) => (
                <details key={idx} className="group bg-white border border-[#E5DED2] rounded-[20px] open:shadow-[0_8px_32px_-8px_rgba(126,146,121,0.15)] transition-all">
                  <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                    <span
                      className="font-medium text-[14px] md:text-[15px] text-[#2F2F2F] pr-4"
                      style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
                    >
                      {item.q}
                    </span>
                    <span className="w-9 h-9 shrink-0 rounded-full bg-[#F4EFE6] flex items-center justify-center text-[#C97D60] group-open:rotate-180 transition-transform">
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

        {/* ============================================ */}
        {/* CTA #4 (FINAL) */}
        {/* ============================================ */}
        <section id="contact" className="py-24 md:py-36 px-6 bg-[#2F2F2F] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#C97D60]/15 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#A7B8A1]/15 blur-3xl"></div>

          <div className="max-w-[760px] mx-auto relative">
            <div className="text-center mb-12">
              <p className="text-[11px] tracking-[0.35em] text-[#C97D60] font-medium mb-5" style={{ fontFamily: "var(--font-outfit)" }}>
                CONTACT
              </p>
              <h2
                className="text-[32px] md:text-[48px] leading-[1.4] mb-7"
                style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}
              >
                花屋業務、<br/>
                ぜんぶ FLORIX に。
              </h2>
              <div className="inline-flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-5 py-2.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#A7B8A1] animate-pulse"></span>
                <p className="text-[12px] text-white/85 font-medium">
                  30日間 無料・初期費用 0円・クレカ登録 不要
                </p>
              </div>
              <p className="text-[13px] md:text-[14px] text-white/70 leading-[2] max-w-[560px] mx-auto">
                ご相談・無料デモのご希望は、下のフォームから。<br/>
                押し売りはいたしません。
              </p>
            </div>

            <div className="bg-[#FAF7F2] text-[#2F2F2F] rounded-[32px] p-7 md:p-12 shadow-2xl">
              <form action="mailto:contact@noodleflorix.com" method="post" encType="text/plain" className="space-y-5">
                <div>
                  <label className="text-[12px] font-medium text-[#2F2F2F] block mb-2">お店のお名前・お名前 <span className="text-[#C97D60]">*</span></label>
                  <input
                    type="text"
                    name="お店・お名前"
                    required
                    className="w-full h-12 bg-white border border-[#E5DED2] rounded-xl px-4 text-[13px] focus:border-[#C97D60] focus:outline-none focus:ring-2 focus:ring-[#C97D60]/15 transition"
                    placeholder="例：花屋さくら／田中太郎"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#2F2F2F] block mb-2">メールアドレス <span className="text-[#C97D60]">*</span></label>
                  <input
                    type="email"
                    name="メール"
                    required
                    className="w-full h-12 bg-white border border-[#E5DED2] rounded-xl px-4 text-[13px] focus:border-[#C97D60] focus:outline-none focus:ring-2 focus:ring-[#C97D60]/15 transition"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#2F2F2F] block mb-2">電話番号</label>
                  <input
                    type="tel"
                    name="電話"
                    className="w-full h-12 bg-white border border-[#E5DED2] rounded-xl px-4 text-[13px] focus:border-[#C97D60] focus:outline-none focus:ring-2 focus:ring-[#C97D60]/15 transition"
                    placeholder="090-0000-0000（任意）"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#2F2F2F] block mb-2">ご相談内容</label>
                  <textarea
                    name="ご相談内容"
                    rows={4}
                    className="w-full bg-white border border-[#E5DED2] rounded-xl px-4 py-3 text-[13px] focus:border-[#C97D60] focus:outline-none focus:ring-2 focus:ring-[#C97D60]/15 transition resize-none"
                    placeholder="ご質問・デモご希望など、お気軽にどうぞ。"
                  />
                </div>
                <button
                  type="submit"
                  className="group w-full h-14 bg-[#C97D60] text-white rounded-full text-[14px] font-medium hover:bg-[#A8624A] transition-all shadow-[0_12px_36px_-12px_rgba(201,125,96,0.5)] flex items-center justify-center gap-2"
                >
                  <Send size={15}/>
                  30日間 無料で始める
                  <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform"/>
                </button>
                <p className="text-[11px] text-[#7E9279] text-center pt-1">
                  ご相談は無料です。お電話でも受付しています。
                </p>
              </form>
            </div>

            <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-[12px] text-white/70">
              <a href="mailto:contact@noodleflorix.com" className="hover:text-white inline-flex items-center gap-2 transition">
                <Mail size={13}/> contact@noodleflorix.com
              </a>
              <span className="hidden sm:inline text-white/30">|</span>
              <span className="inline-flex items-center gap-2">
                <Phone size={13}/> 平日 9:00 - 18:00
              </span>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* FOOTER */}
        {/* ============================================ */}
        <footer className="py-12 px-6 bg-[#1E1E1E] text-white/55">
          <div className="max-w-[1140px] mx-auto">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <p
                  className="font-medium text-white text-[24px] tracking-[0.18em] mb-3"
                  style={{ fontFamily: "var(--font-outfit)" }}
                >
                  FLORIX
                </p>
                <p
                  className="text-[12px] leading-[2]"
                  style={{ fontFamily: "var(--font-zen-kaku)" }}
                >
                  花屋業務、ぜんぶ FLORIX に。<br/>
                  運営: NocoLde
                </p>
              </div>
              <div className="flex md:justify-end gap-6 items-start text-[12px]">
                <Link href="/privacy" className="hover:text-white transition">プライバシーポリシー</Link>
                <a href="#contact" className="hover:text-white transition">お問い合わせ</a>
                <Link href="/staff/login" className="hover:text-white transition">ログイン</Link>
              </div>
            </div>
            <div className="pt-6 border-t border-white/10 text-center text-[11px]" style={{ fontFamily: "var(--font-outfit)" }}>
              © {new Date().getFullYear()} NocoLde / FLORIX. All rights reserved.
            </div>
          </div>
        </footer>

        {/* ============================================ */}
        {/* MOBILE STICKY CTA */}
        {/* ============================================ */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-3 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/95 to-transparent">
          <a
            href="#contact"
            className="block w-full text-center h-14 leading-[56px] bg-[#C97D60] text-white rounded-full text-[14px] font-medium shadow-[0_8px_28px_-8px_rgba(201,125,96,0.6)]"
          >
            30日間 無料ではじめる
          </a>
        </div>
      </div>
    </>
  );
}
