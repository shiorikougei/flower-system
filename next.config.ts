import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// [Phase2-⑩] セキュリティヘッダー
// XSS・クリックジャッキング・MIME sniff・通信盗聴 等の主要攻撃を一括防御
const securityHeaders = [
  // HSTS: HTTPS強制（プリロードリスト登録対応）
  // 注: 本番運用が安定するまでは max-age を短めに設定し、確認後に長期化する
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // クリックジャッキング防止: 自サイト以外のiframe埋め込みを禁止
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  // MIME sniffing 防止
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // リファラ情報を最小限に
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // 不要なブラウザ機能をブロック
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // ★ Content Security Policy
  //   - Next.js が動くため 'unsafe-inline' は一部許可（インラインstyle）
  //   - 外部サービス: Supabase, Stripe, Resend, LINE, Google Fonts, ZipCloud(郵便番号), 写真CDN
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // スクリプト: Next.js + Stripe + Google Analytics/Tag Manager
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com",
      // スタイル: Tailwind/Next.js のインラインスタイル + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // フォント
      "font-src 'self' data: https://fonts.gstatic.com",
      // 画像: 自サイト + Supabase Storage + LINE + GA計測ピクセル + データURL + Unsplash(LP)
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://profile.line-scdn.net https://*.line-scdn.net https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://images.unsplash.com",
      // 接続(API): 自サイト + Supabase + Stripe + Resend + ZipCloud + LINE + Sentry + GA4
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.stripe.com https://api.resend.com https://zipcloud.ibsnet.co.jp https://*.line.me https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net",
      // iframe（Stripe決済UI）
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      // ベース URL を制限（base-uri攻撃対策）
      "base-uri 'self'",
      // フォーム送信先を自サイトのみ
      "form-action 'self'",
      // クリックジャッキング対策（X-Frame-Options相当）
      "frame-ancestors 'self'",
      // 自動アップグレード（HTTPからHTTPSへ）
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // [SEO-#18] Core Web Vitals 最適化
  // 画像の最適化（next/image を使った時に自動でAVIF/WebP変換 → LCP改善）
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "*.line-scdn.net" },
      { protocol: "https", hostname: "profile.line-scdn.net" },
    ],
    // 一般的なEC画像の代表サイズに最適化
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 64, 96, 128, 256, 384],
  },
  // 圧縮を有効化（Vercelでは既定でON、念のため）
  compress: true,
  // 不要なpoweredByヘッダーを削除（軽量化＆セキュリティ）
  poweredByHeader: false,
  async headers() {
    return [
      {
        // 全パスに適用
        source: "/:path*",
        headers: securityHeaders,
      },
      // [SEO-#18] 静的アセット長期キャッシュ
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*\\.(jpg|jpeg|png|webp|avif|gif|svg|ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "0071e7725210",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
