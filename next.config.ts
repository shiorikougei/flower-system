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
      // スクリプト: Next.js（hash/nonce対応するまでは unsafe-inline & unsafe-eval を許可）
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://cdn.jsdelivr.net",
      // スタイル: Tailwind/Next.js のインラインスタイル + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // フォント
      "font-src 'self' data: https://fonts.gstatic.com",
      // 画像: 自サイト + Supabase Storage + LINE プロフィール画像 + データURL
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://profile.line-scdn.net https://*.line-scdn.net",
      // 接続(API): 自サイト + Supabase + Stripe + Resend + ZipCloud(住所検索) + LINE
      "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.stripe.com https://api.resend.com https://zipcloud.ibsnet.co.jp https://*.line.me",
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
  async headers() {
    return [
      {
        // 全パスに適用
        source: "/:path*",
        headers: securityHeaders,
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
