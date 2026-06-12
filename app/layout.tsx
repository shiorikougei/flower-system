import type { Metadata } from "next";
import { Geist, Geist_Mono, Shippori_Mincho, Zen_Kaku_Gothic_New, Outfit } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import WebVitals from "@/components/WebVitals";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// LP用 上質和フォント
const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});
const zenKakuGothic = Zen_Kaku_Gothic_New({
  variable: "--font-zen-kaku",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});
const outfit = Outfit({
  variable: "--font-outfit",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // [SEO] 検索エンジン所有権確認
  verification: {
    google: "l1ygH1P4VAAO2KR8XB4w7Oe-EPGyNQxXV9gpYe9HDfI",
    // [GEO-3] Bing Webmaster Tools（ChatGPT searchはBing索引使用）
    other: {
      "msvalidate.01": "5861F320892618FB3809343F278737DA",
    },
  },
  title: {
    default: "FLORIX",
    template: "%s | FLORIX",
  },
  description: "お花屋さんの注文管理・EC・顧客管理・スタッフ管理を一括で。NocoLde が提供するクラウド型業務システム。",
  applicationName: "FLORIX",
  authors: [{ name: "NocoLde" }],
  keywords: ["お花屋さん", "花屋", "業務システム", "EC", "注文管理"],
  openGraph: {
    title: "FLORIX",
    description: "お花屋さん向けクラウド業務システム",
    siteName: "FLORIX",
    locale: "ja_JP",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${shipporiMincho.variable} ${zenKakuGothic.variable} ${outfit.variable} antialiased`}
      >
        <GoogleAnalytics />
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
