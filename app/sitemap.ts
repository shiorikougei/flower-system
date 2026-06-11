// [SEO-#3] sitemap.xml 自動生成
// 全店舗・全EC商品のURLを含む sitemap を動的生成
// Google Search Console に登録して新規ページを発見してもらう

import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

// 24時間キャッシュ（動的生成だがビルド時にスナップショット）
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls: MetadataRoute.Sitemap = [
    // 静的ページ
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

  // 動的ページ: 全テナント・全店舗・全EC商品
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 全テナントの app_settings を取得（公開店舗のみ）
    const { data: settingsRows } = await supabaseAdmin
      .from("app_settings")
      .select("id, settings_data");

    for (const row of settingsRows || []) {
      const settings = row.settings_data || {};
      const shops = settings.shops || [];
      const tenantId = row.id;

      for (const shop of shops) {
        if (!shop.isActive) continue;

        const shopId = String(shop.id);
        // 店舗トップページ
        urls.push({
          url: `${BASE_URL}/order/${tenantId}/${shopId}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.8,
        });
        // ECショップ一覧ページ
        urls.push({
          url: `${BASE_URL}/order/${tenantId}/${shopId}/shop`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.9,
        });
        // カスタム注文ページ
        urls.push({
          url: `${BASE_URL}/order/${tenantId}/${shopId}/custom`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        });
        // 見積依頼ページ
        urls.push({
          url: `${BASE_URL}/order/${tenantId}/${shopId}/estimate`,
          lastModified: new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }

    // 全EC商品（公開中・在庫あり または再入荷可能なもの）
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, tenant_id, updated_at, is_active, stock, restock_allowed")
      .eq("is_active", true);

    for (const p of products || []) {
      // 在庫切れで再入荷不可なら除外
      if (Number(p.stock) === 0 && !p.restock_allowed) continue;

      // 商品ページのURLは tenantId 単位（shopId は default で代表）
      urls.push({
        url: `${BASE_URL}/products/${p.tenant_id}/${p.id}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (e) {
    // 生成失敗時も静的ページだけは返す（サイト全体のクロールを止めない）
    console.warn("[sitemap] dynamic URL generation failed");
  }

  return urls;
}
