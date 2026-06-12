// [SEO-#4 / GEO-#1] robots.txt
// 通常クローラ + AI検索クローラ向けの公開範囲
//
// 戦略:
//   - 公開ページ（EC・ブログ・カテゴリ等）→ 全クローラに許可（AI検索に乗せる）
//   - 管理画面・個人情報ページ → 全クローラ拒否
//   - 商用AI訓練クローラの一部 → 別途制御
//
// ※ AI検索（ChatGPT search / Perplexity / Brave AI 等）で
//    EC商品がヒットしてほしいので、公開ページのクロールは許可する

import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

// 公開対象パス（全クローラに許可）
const PUBLIC_ALLOW = [
  "/",
  "/order/",
  "/shop/",
  "/products/",
  "/category/",
  "/blog/",
  "/corporate/",
  "/privacy",
  "/about",
];

// 非公開パス（全クローラ禁止）
const PRIVATE_DISALLOW = [
  "/staff/",       // スタッフ管理画面
  "/owner/",       // オーナー管理画面
  "/api/",         // APIエンドポイント
  "/mypage/",      // 顧客マイページ（個人情報）
  "/admin/",       // 管理者
  "/*/mypage/",    // tenant配下のマイページ
  "/*/history/",   // 注文履歴
  "/*/cart/",      // カート
  "/*/thanks/",    // 注文完了
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // === 通常検索クローラ（Google/Bing等） ===
      {
        userAgent: "*",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },

      // === AI 検索クローラ（公開ページのみ許可） ===
      // ChatGPT Search が使う（OpenAI）
      {
        userAgent: "OAI-SearchBot",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      // Perplexity AI
      {
        userAgent: "PerplexityBot",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      // Anthropic (Claude search)
      {
        userAgent: "ClaudeBot",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: "Claude-Web",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      // Google AI Overviews用
      {
        userAgent: "Google-Extended",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      // Brave Search AI
      {
        userAgent: "Bravebot",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      // DuckDuckGo (Brave Search経由でAIに乗る)
      {
        userAgent: "DuckDuckBot",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      // You.com
      {
        userAgent: "YouBot",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },

      // === AI 訓練クローラ（拒否したい場合はここで制御） ===
      // ※ AI訓練に使われたくないが、AI検索には出てほしい場合は分けて設定
      // GPTBot は OpenAI の「訓練用」クローラ。公開しても問題なければ allow
      // 今回はEC流入優先で全て許可、訓練転用が気になる場合は disallow に変更
      {
        userAgent: "GPTBot",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: "CCBot",  // Common Crawl - 多くのAIが学習に使用
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: "anthropic-ai",  // Anthropic 訓練用
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
