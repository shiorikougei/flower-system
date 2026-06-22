// [SEO-#16] カテゴリページ
// /category/[tenantId]/[categorySlug] で「○○の商品一覧」を表示
// 例: /category/ohana/bouquet → ブーケ一覧

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import Breadcrumbs from "@/components/Breadcrumbs";
import { Package } from "lucide-react";

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

// カテゴリ slug → 表示名の対応
const CATEGORY_LABELS = {
  bouquet: { name: "花束・ブーケ", desc: "華やかな花束・ブーケのラインナップ。記念日・お祝い・プレゼントに最適です。" },
  arrangement: { name: "アレンジメント", desc: "そのまま飾れる完成形のアレンジメント。お見舞い・お供え・贈り物に。" },
  stand: { name: "スタンド花", desc: "開店祝い・公演祝いに映えるスタンド花。立札・サイズもオーダーメイドで承ります。" },
  orchid: { name: "胡蝶蘭・鉢物", desc: "ビジネスシーンの定番、胡蝶蘭。お祝い・お供えともに対応。" },
  preserved: { name: "プリザーブドフラワー", desc: "枯れずに長く楽しめるプリザーブドフラワー。記念品・ギフトに人気。" },
  dried: { name: "ドライフラワー", desc: "ナチュラルな雰囲気のドライフラワー。インテリアにも最適。" },
  funeral: { name: "お供え花", desc: "故人を偲ぶ静かなお花。立札・カードもご相談ください。" },
};

async function getCategoryData(tenantId, categorySlug) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const [settingsRes, productsRes] = await Promise.all([
      supabaseAdmin
        .from("app_settings")
        .select("settings_data")
        .eq("id", String(tenantId).toLowerCase())
        .maybeSingle(),
      supabaseAdmin
        .from("products")
        .select("*")
        .eq("tenant_id", String(tenantId).toLowerCase())
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

    const settings = settingsRes.data?.settings_data || {};
    const shop = settings.shops?.[0] || {};

    // カテゴリラベル取得（slug ベースでカテゴリ判定）
    const categoryInfo = CATEGORY_LABELS[categorySlug];
    if (!categoryInfo) return null;

    // 商品をカテゴリで絞り込み
    const products = (productsRes.data || []).filter(p => {
      const cat = String(p.category || "").toLowerCase();
      return cat.includes(categoryInfo.name)
        || cat.includes(categorySlug)
        || (categorySlug === "bouquet" && cat.includes("束"))
        || (categorySlug === "arrangement" && cat.includes("アレンジ"))
        || (categorySlug === "stand" && cat.includes("スタンド"))
        || (categorySlug === "orchid" && (cat.includes("胡蝶蘭") || cat.includes("鉢")))
        || (categorySlug === "preserved" && cat.includes("プリザ"))
        || (categorySlug === "dried" && cat.includes("ドライ"))
        || (categorySlug === "funeral" && (cat.includes("供") || cat.includes("仏")));
    });

    return { shop, products, categoryInfo, settings };
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { tenantId, categorySlug } = await params;
  const data = await getCategoryData(tenantId, categorySlug);
  if (!data) return { title: "カテゴリが見つかりません" };

  const { shop, categoryInfo } = data;
  const shopName = shop.name || "FLORIX";
  const title = `${categoryInfo.name} | ${shopName}`;
  const description = `${shopName}の${categoryInfo.name}一覧。${categoryInfo.desc}`;
  const url = `${BASE_URL}/category/${tenantId}/${categorySlug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: shopName,
      locale: "ja_JP",
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }) {
  const { tenantId, categorySlug } = await params;
  const data = await getCategoryData(tenantId, categorySlug);
  if (!data) notFound();

  const { shop, products, categoryInfo } = data;
  const shopName = shop.name || "FLORIX";
  const shopId = String(shop.id ?? "default");

  // ItemList JSON-LD
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${categoryInfo.name} - ${shopName}`,
    description: categoryInfo.desc,
    numberOfItems: products.length,
    itemListElement: products.map((p, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${BASE_URL}/products/${tenantId}/${p.id}`,
      name: p.name,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <main className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
        {/* ヘッダー */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
          <div className="max-w-[1100px] mx-auto h-16 px-6 flex items-center justify-between">
            <Link
              href={`/order/${tenantId}/${shopId}/shop`}
              className="text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]"
            >
              ← 全商品に戻る
            </Link>
            <span className="font-serif font-bold text-[14px] text-[#2D4B3E]">
              {shopName}
            </span>
          </div>
        </header>

        <div className="max-w-[1100px] mx-auto p-6">
          {/* パンくず */}
          <Breadcrumbs
            items={[
              { label: shopName, href: `/order/${tenantId}/${shopId}` },
              { label: "商品一覧", href: `/order/${tenantId}/${shopId}/shop` },
              { label: categoryInfo.name },
            ]}
          />

          {/* タイトル */}
          <div className="mb-8">
            <h1 className="text-[28px] md:text-[36px] font-bold text-[#2D4B3E] mb-2">
              {categoryInfo.name}
            </h1>
            <p className="text-[13px] text-[#555] leading-relaxed">
              {categoryInfo.desc}
            </p>
            <p className="text-[11px] text-[#999] mt-2">{products.length}件の商品</p>
          </div>

          {/* 商品一覧 */}
          {products.length === 0 ? (
            <div className="bg-white border border-dashed border-[#EAEAEA] rounded-2xl p-12 text-center">
              <p className="text-[14px] font-bold text-[#999]">この商品カテゴリは現在準備中です</p>
              <p className="text-[11px] text-[#CCC] mt-2">他のカテゴリをご覧ください</p>
              <Link
                href={`/order/${tenantId}/${shopId}/shop`}
                className="inline-block mt-4 px-5 h-11 leading-[44px] bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold"
              >
                全商品を見る
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map(p => {
                const isOutOfStock = p.stock === 0;
                return (
                  <Link
                    key={p.id}
                    href={`/products/${tenantId}/${p.id}`}
                    className="bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden hover:shadow-md transition-all flex flex-col group"
                  >
                    <div className="aspect-square bg-[#FBFAF9] relative overflow-hidden">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={`${p.name} - ${shopName}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#CCC]"><Package size={32} /></div>
                      )}
                      {isOutOfStock && (
                        <div className="absolute top-3 left-3 bg-[#111]/80 text-white text-[10px] font-bold px-2 py-1 rounded">在庫切れ</div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      {p.category && <p className="text-[10px] text-[#999]">{p.category}</p>}
                      <p className="text-[13px] font-bold text-[#111] line-clamp-2 mt-1">{p.name}</p>
                      <p className="text-[15px] font-bold text-[#2D4B3E] mt-auto pt-2">¥{p.price.toLocaleString()}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* [SEO-#20] 関連カテゴリへの内部リンク */}
          <div className="mt-12 pt-8 border-t border-[#EAEAEA]">
            <h2 className="text-[14px] font-bold text-[#2D4B3E] mb-4">他のカテゴリも見る</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(CATEGORY_LABELS)
                .filter(([slug]) => slug !== categorySlug)
                .slice(0, 6)
                .map(([slug, info]) => (
                  <Link
                    key={slug}
                    href={`/category/${tenantId}/${slug}`}
                    className="block p-3 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] transition-all text-center"
                  >
                    <p className="text-[12px] font-bold text-[#2D4B3E]">{info.name}</p>
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
