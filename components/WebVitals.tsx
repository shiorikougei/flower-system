// [SEO-#18] Core Web Vitals 計測 → GA4 に送信
// CLS / INP / LCP / FCP / TTFB を自動測定し、GA4 のカスタムイベントとして送る

"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default function WebVitals() {
  useEffect(() => {
    // GA4 が未導入なら何もしない
    if (typeof window === "undefined" || !window.gtag) return;

    // /staff /owner などは計測しない（公開ページのみ）
    const path = window.location.pathname;
    if (path.startsWith("/staff") || path.startsWith("/owner") || path.startsWith("/api")) return;

    // 動的importでバンドルサイズ影響を最小化
    import("web-vitals").then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      const send = (metric: any) => {
        if (!window.gtag) return;
        // GA4 にカスタムイベント送信
        window.gtag("event", metric.name, {
          // 数値（INP/LCP/FCP/TTFBはms、CLSは無次元）
          value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
          metric_id: metric.id,
          metric_value: metric.value,
          metric_delta: metric.delta,
          metric_rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
          page_path: path,
          non_interaction: true,
        });
      };

      onCLS(send);
      onINP(send);
      onLCP(send);
      onFCP(send);
      onTTFB(send);
    }).catch(() => {
      // web-vitals 未インストールでもエラーで落とさない
    });
  }, []);

  return null;
}
