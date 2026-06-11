// [Phase2-⑥] Sentry クライアント設定
// NEXT_PUBLIC_SENTRY_DSN が設定されている場合のみ有効化

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 環境（development/production）
    environment: process.env.NODE_ENV,
    // サンプリングレート: 本番は10%、開発は100%
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // セッションリプレイ: エラー時のみ
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,

    // ★ PIIマスキング: 個人情報を Sentry に送信しない
    sendDefaultPii: false,

    // beforeSend: 送信前にPIIをスクラブ
    beforeSend(event, hint) {
      // クッキー・ヘッダー類を削除
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers['x-owner-password'];
        }
      }
      // 例外メッセージ内の PII っぽいパターンを伏字
      if (event.exception?.values) {
        event.exception.values.forEach(ex => {
          if (ex.value) {
            ex.value = ex.value
              .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')      // メアド
              .replace(/0[789]0[\d-]{8,}/g, '[phone]')              // 携帯
              .replace(/0\d{1,4}[\s-]?\d{1,4}[\s-]?\d{3,4}/g, '[phone]'); // 固定電話
          }
        });
      }
      return event;
    },
  });
}
