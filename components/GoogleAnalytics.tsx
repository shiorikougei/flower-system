// [SEO-#14] Google Analytics 4
// NEXT_PUBLIC_GA_ID が設定されている場合のみ有効化
// 個人情報を含まないイベントのみ送信（プライバシー配慮）

import Script from "next/script";

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  // GA_ID が設定されていなければ何も表示しない
  if (!gaId) return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            // ★ プライバシー配慮: IP匿名化
            anonymize_ip: true,
            // ★ Cookie寿命を短く
            cookie_expires: 60 * 60 * 24 * 90,
            // ★ PII送信ブロック
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            // ★ 管理画面はトラッキング除外
            send_page_view: !window.location.pathname.startsWith('/staff')
              && !window.location.pathname.startsWith('/owner')
              && !window.location.pathname.startsWith('/api'),
          });
        `}
      </Script>
    </>
  );
}
