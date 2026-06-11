// [SEO-#2 #5] 各店舗ページの動的メタタグ + LocalBusiness JSON-LD

import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

async function getShopData(tenantId, shopId) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("settings_data")
      .eq("id", String(tenantId).toLowerCase())
      .maybeSingle();
    const settings = data?.settings_data || {};
    const shops = settings.shops || [];
    const shop = shops.find(s => String(s.id) === String(shopId)) || shops[0] || {};
    return { settings, shop };
  } catch {
    return { settings: {}, shop: {} };
  }
}

function extractCity(address) {
  if (!address) return "";
  // 北海道札幌市北区... → 札幌市
  const m = String(address).match(/(.+?[市区町村])/);
  return m ? m[1] : "";
}

// [SEO-#2] 動的メタタグ
export async function generateMetadata({ params }) {
  const { tenantId, shopId } = await params;
  const { shop, settings } = await getShopData(tenantId, shopId);

  const shopName = shop.name || settings.generalConfig?.appName || "FLORIX";
  const city = extractCity(shop.address);
  const title = city
    ? `${shopName} | ${city}の花屋・お花のオーダーメイド`
    : `${shopName} | お花の注文・配達`;
  // [SEO-#12] 店舗が手書きした紹介文を優先（重複コンテンツ判定回避）
  const description = (
    shop.shopIntroduction
      ? String(shop.shopIntroduction).slice(0, 160)
      : `${shopName}${city ? `（${city}）` : ""}のオンラインショップ。誕生日・お祝い・お悔やみのお花を、こだわりのオーダーメイドで承ります。EC商品から見積依頼まで。`
  ).slice(0, 160);
  const url = `${BASE_URL}/order/${tenantId}/${shopId}`;
  const image = settings.generalConfig?.logoUrl || `${BASE_URL}/og-default.jpg`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: shopName,
      images: [{ url: image, width: 1200, height: 630, alt: shopName }],
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

export default async function ShopLayout({ children, params }) {
  const { tenantId, shopId } = await params;
  const { shop, settings } = await getShopData(tenantId, shopId);
  const shopName = shop.name || "FLORIX";

  // [SEO-#5 #12 #18] LocalBusiness（Florist）JSON-LD（店舗紹介文・創業年・店主名を含む）
  const services = shop.shopServices
    ? String(shop.shopServices).split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "Florist",
    name: shopName,
    image: settings.generalConfig?.logoUrl || `${BASE_URL}/og-default.jpg`,
    "@id": `${BASE_URL}/order/${tenantId}/${shopId}`,
    url: `${BASE_URL}/order/${tenantId}/${shopId}`,
    description: shop.shopIntroduction || undefined,
    telephone: shop.phone || "",
    address: shop.address
      ? {
          "@type": "PostalAddress",
          streetAddress: shop.address,
          postalCode: shop.zip || "",
          addressCountry: "JP",
        }
      : undefined,
    openingHoursSpecification:
      shop.openTime && shop.closeTime
        ? [
            {
              "@type": "OpeningHoursSpecification",
              dayOfWeek: [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ],
              opens: shop.openTime,
              closes: shop.closeTime,
            },
          ]
        : undefined,
    priceRange: "¥¥",
    paymentAccepted: "Credit Card, Bank Transfer",
    sameAs: settings.generalConfig?.socialLinks || [],
    // [SEO-#18] E-E-A-T シグナル
    foundingDate: shop.foundedYear ? `${shop.foundedYear}-01-01` : undefined,
    founder: shop.ownerName ? { "@type": "Person", name: shop.ownerName } : undefined,
    knowsAbout: services.length > 0 ? services : undefined,
    award: shop.shopCredentials || undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessJsonLd) }}
      />
      {children}
    </>
  );
}
