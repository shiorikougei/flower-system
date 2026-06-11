// [Phase2-⑥] Sentry サーバー設定（プレースホルダー）
//
// ⚠️ このファイルは @sentry/nextjs が npm install されるまでは何もしません。
// セットアップ手順は docs/SENTRY_SETUP.md を参照。
//
// ↓↓ Sentry 有効化時にコメント解除 ↓↓
// import * as Sentry from '@sentry/nextjs';
// const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
// if (dsn) {
//   Sentry.init({
//     dsn,
//     environment: process.env.NODE_ENV,
//     tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
//     sendDefaultPii: false,
//     beforeSend(event) {
//       if (event.request) {
//         delete event.request.cookies;
//         if (event.request.headers) {
//           delete event.request.headers.authorization;
//           delete event.request.headers.cookie;
//           delete event.request.headers['x-owner-password'];
//         }
//         if (event.request.data) {
//           const data = event.request.data;
//           if (typeof data === 'object') {
//             ['email', 'phone', 'customerEmail', 'customerPhone', 'customerName', 'address', 'pin']
//               .forEach(key => { if (key in data) data[key] = '[redacted]'; });
//           }
//         }
//       }
//       if (event.exception?.values) {
//         event.exception.values.forEach(ex => {
//           if (ex.value) {
//             ex.value = ex.value
//               .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
//               .replace(/0[789]0[\d-]{8,}/g, '[phone]')
//               .replace(/0\d{1,4}[\s-]?\d{1,4}[\s-]?\d{3,4}/g, '[phone]');
//           }
//         });
//       }
//       return event;
//     },
//   });
// }

export {};
