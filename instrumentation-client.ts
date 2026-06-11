// [Phase2-⑥] Sentry クライアント設定（Next.js 15+ instrumentation pattern）
// Wizard生成のファイルに [Phase1-①] PII保護スクラブを追加

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://c1d36121db424022d3bd8c7811c02741@o4511544338153472.ingest.us.sentry.io/4511544343003136",

  // 本番ではサンプリング率10%（料金抑制）
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // セッションリプレイ: エラー時のみキャプチャ
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,

  // ログ送信
  enableLogs: true,

  // ★ PIIマスクで個別管理するため OFF
  sendDefaultPii: false,

  // ★ [Phase1-①] 送信前にPIIをスクラブ
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers["x-owner-password"];
      }
    }
    if (event.exception?.values) {
      event.exception.values.forEach((ex) => {
        if (ex.value) {
          ex.value = ex.value
            .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
            .replace(/0[789]0[\d-]{8,}/g, "[phone]")
            .replace(/0\d{1,4}[\s-]?\d{1,4}[\s-]?\d{3,4}/g, "[phone]");
        }
      });
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
