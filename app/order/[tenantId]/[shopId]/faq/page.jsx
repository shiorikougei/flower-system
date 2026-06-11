// [SEO-#10] 店舗ごとのFAQページ + FAQ Schema
// /order/[tenantId]/[shopId]/faq

import { createClient } from "@supabase/supabase-js";
import { DEFAULT_FAQ_ITEMS, groupByCategory, buildFaqJsonLd } from "@/utils/faqData";
import FaqClient from "./client";

export const revalidate = 3600;

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
    const shop = shops.find((s) => String(s.id) === String(shopId)) || shops[0] || {};
    return { settings, shop };
  } catch {
    return { settings: {}, shop: {} };
  }
}

export async function generateMetadata({ params }) {
  const { tenantId, shopId } = await params;
  const { shop } = await getShopData(tenantId, shopId);
  const shopName = shop.name || "FLORIX";
  const title = `よくあるご質問（FAQ） | ${shopName}`;
  const description = `${shopName}のよくあるご質問。お花の保存方法・配送・立札・キャンセル・領収書・店頭販売についてのお問い合わせをまとめています。`;
  const url = `${BASE_URL}/order/${tenantId}/${shopId}/faq`;

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

export default async function FaqPage({ params }) {
  const { tenantId, shopId } = await params;
  const { settings, shop } = await getShopData(tenantId, shopId);

  // 店舗ごとにカスタマイズされたFAQ or デフォルト
  const customFaq = Array.isArray(settings.faqItems) ? settings.faqItems : null;
  const faqItems = customFaq && customFaq.length > 0 ? customFaq : DEFAULT_FAQ_ITEMS;

  const grouped = groupByCategory(faqItems);
  const jsonLd = buildFaqJsonLd(faqItems);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FaqClient
        grouped={grouped}
        shop={shop}
        tenantId={tenantId}
        shopId={shopId}
      />
    </>
  );
}
