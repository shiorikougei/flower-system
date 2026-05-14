import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FLORIX | お花屋さん向け業務システム",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
