// [SEO-#1] EC商品個別ページ
// 各商品に独自URLを発行: /products/[tenantId]/[productId]
// SEO + ソーシャル + 直リンク用

import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import ProductDetailClient from "./client";

export const revalidate = 3600; // 1時間キャッシュ

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

async function getProductData(tenantId, productId) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const [productRes, settingsRes] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle(),
    supabaseAdmin
      .from("app_settings")
      .select("settings_data")
      .eq("id", tenantId)
      .maybeSingle(),
  ]);

  if (!productRes.data) return null;
  const product = productRes.data;
  const settings = settingsRes.data?.settings_data || {};
  const shop = settings.shops?.[0] || {};

  return { product, settings, shop };
}

// [SEO-#2] 動的メタタグ生成
export async function generateMetadata({ params }) {
  const { tenantId, productId } = await params;
  const data = await getProductData(tenantId, productId);
  if (!data) return { title: "商品が見つかりません" };

  const { product, shop } = data;
  const shopName = shop.name || "FLORIX";
  const priceText = `¥${Number(product.price).toLocaleString()}`;
  const title = `${product.name} - ${priceText} | ${shopName}`;
  const description = (product.description || `${shopName}が手掛ける${product.name}。${priceText}（税抜）。お祝い・記念日・お悔やみまで対応。`).slice(0, 160);
  const url = `${BASE_URL}/products/${tenantId}/${productId}`;
  const image = product.image_url || `${BASE_URL}/og-default.jpg`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: shopName,
      images: [{ url: image, width: 1200, height: 630, alt: product.name }],
      locale: "ja_JP",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({ params }) {
  const { tenantId, productId } = await params;
  const data = await getProductData(tenantId, productId);
  if (!data) notFound();

  const { product, settings, shop } = data;
  const shopName = shop.name || "FLORIX";
  const url = `${BASE_URL}/products/${tenantId}/${productId}`;

  // [SEO-#6] Product JSON-LD（リッチリザルト・Googleショッピング対応）
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || `${shopName}の${product.name}`,
    image: [
      product.image_url,
      ...(Array.isArray(product.image_urls) ? product.image_urls : []),
    ].filter(Boolean),
    sku: product.id,
    brand: { "@type": "Brand", name: shopName },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "JPY",
      price: product.price,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : product.restock_allowed
          ? "https://schema.org/PreOrder"
          : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: shopName },
    },
  };

  // [SEO-#5] LocalBusiness JSON-LD
  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "Florist",
    name: shopName,
    image: settings.generalConfig?.logoUrl || `${BASE_URL}/og-default.jpg`,
    telephone: shop.phone || "",
    address: shop.address
      ? {
          "@type": "PostalAddress",
          streetAddress: shop.address,
          postalCode: shop.zip || "",
          addressCountry: "JP",
        }
      : undefined,
    openingHours:
      shop.openTime && shop.closeTime
        ? `Mo-Su ${shop.openTime}-${shop.closeTime}`
        : undefined,
    url: `${BASE_URL}/order/${tenantId}/${shop.id || "default"}`,
  };

  // パンくず構造化データ
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: shopName,
        item: `${BASE_URL}/order/${tenantId}/${shop.id || "default"}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "商品一覧",
        item: `${BASE_URL}/order/${tenantId}/${shop.id || "default"}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: url,
      },
    ],
  };

  return (
    <>
      {/* SEO 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* 実際のUI */}
      <ProductDetailClient
        product={product}
        shop={shop}
        tenantId={tenantId}
      />
    </>
  );
}
