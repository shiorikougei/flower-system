// [SEO-#3] sitemap.xml 自動生成（堅牢版）
// 全店舗・全EC商品のURLを含む sitemap を動的生成
// エラーが起きても最低限の静的URLは返す

import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

// 1時間キャッシュ（エラー時のリカバリも早く）
export const revalidate = 3600;

// 静的URLのみのフォールバック
const STATIC_URLS: MetadataRoute.Sitemap = [
  {
    url: BASE_URL,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1.0,
  },
  {
    url: `${BASE_URL}/privacy`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.3,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [...STATIC_URLS];

  // env var チェック（無ければ静的URLだけ返す）
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[sitemap] Supabase env vars not set, returning static URLs only");
    return urls;
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 全テナントの app_settings を取得
    const { data: settingsRows, error: settingsErr } = await supabaseAdmin
      .from("app_settings")
      .select("id, settings_data");

    if (settingsErr) {
      console.warn("[sitemap] app_settings query failed");
    } else {
      for (const row of settingsRows || []) {
        const settings = (row.settings_data || {}) as Record<string, unknown>;
        const shops = Array.isArray((settings as any).shops) ? (settings as any).shops : [];
        const tenantId = row.id;

        for (const shop of shops) {
          if (!shop) continue;
          // isActive が明示的に false の場合のみ除外（undefined はアクティブとみなす）
          if (shop.isActive === false) continue;

          const shopId = String(shop.id ?? "default");
          urls.push(
            {
              url: `${BASE_URL}/order/${tenantId}/${shopId}`,
              lastModified: new Date(),
              changeFrequency: "weekly",
              priority: 0.8,
            },
            {
              url: `${BASE_URL}/order/${tenantId}/${shopId}/shop`,
              lastModified: new Date(),
              changeFrequency: "daily",
              priority: 0.9,
            },
            {
              url: `${BASE_URL}/order/${tenantId}/${shopId}/custom`,
              lastModified: new Date(),
              changeFrequency: "weekly",
              priority: 0.7,
            },
            {
              url: `${BASE_URL}/order/${tenantId}/${shopId}/estimate`,
              lastModified: new Date(),
              changeFrequency: "monthly",
              priority: 0.6,
            },
            {
              url: `${BASE_URL}/order/${tenantId}/${shopId}/faq`,
              lastModified: new Date(),
              changeFrequency: "monthly",
              priority: 0.7,
            },
          );
        }
      }
    }

    // 全EC商品（公開中・[SEO-#17] image sitemap 対応）
    try {
      const { data: products } = await supabaseAdmin
        .from("products")
        .select("id, name, tenant_id, updated_at, stock, restock_allowed, image_url, image_urls")
        .eq("is_active", true);

      for (const p of products || []) {
        // 在庫切れで再入荷不可なら除外
        if (Number(p.stock) === 0 && !p.restock_allowed) continue;

        // [SEO-#17] 商品画像をsitemapに含める（Google画像検索対応）
        const images: { url: string; title?: string }[] = [];
        if (p.image_url) {
          images.push({ url: String(p.image_url), title: p.name || undefined });
        }
        if (Array.isArray(p.image_urls)) {
          for (const img of p.image_urls) {
            if (typeof img === "string" && img) {
              images.push({ url: img, title: p.name || undefined });
            }
          }
        }

        urls.push({
          url: `${BASE_URL}/products/${p.tenant_id}/${p.id}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
          images: images.length > 0 ? images.map(i => i.url) : undefined,
        });
      }
    } catch (e) {
      console.warn("[sitemap] products query failed");
    }

    // [SEO-#13] 公開済みブログ記事
    try {
      const { data: posts } = await supabaseAdmin
        .from("blog_posts")
        .select("tenant_id, slug, published_at, updated_at")
        .eq("is_published", true);

      for (const p of posts || []) {
        urls.push({
          url: `${BASE_URL}/blog/${p.tenant_id}/${p.slug}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : new Date(p.published_at || Date.now()),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    } catch (e) {
      console.warn("[sitemap] blog_posts query failed");
    }

    // テナントごとのブログ一覧ページ
    try {
      const { data: settingsRows } = await supabaseAdmin
        .from("app_settings")
        .select("id");
      for (const row of settingsRows || []) {
        urls.push({
          url: `${BASE_URL}/blog/${row.id}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
    } catch {}
  } catch (e) {
    console.warn("[sitemap] dynamic URL generation failed, returning what we have");
  }

  return urls;
}
