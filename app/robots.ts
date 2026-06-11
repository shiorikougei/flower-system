// [SEO-#4] robots.txt
// クロール許可範囲を明示。管理画面はクロール禁止、EC関連は許可

import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/order/",
          "/shop/",
          "/corporate/",
          "/privacy",
        ],
        disallow: [
          "/staff/",       // スタッフ管理画面
          "/owner/",       // オーナー管理画面
          "/api/",         // APIエンドポイント
          "/mypage/",      // 顧客マイページ（個人情報）
          "/admin/",       // 管理者
          "/*/mypage/",    // tenant配下のマイページ
          "/*/history/",   // 注文履歴
        ],
      },
      // Bing/Google の AI クローラもセキュリティ重視で同条件
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "CCBot",
        disallow: "/",
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
