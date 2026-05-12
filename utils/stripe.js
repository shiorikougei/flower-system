// サーバー側専用 Stripe クライアント初期化
// ⚠️ このファイルは API Route からのみ import すること
// （Stripe Secret Key を含むので、クライアントコードでは絶対に使わない）

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('[stripe.js] STRIPE_SECRET_KEY is not set in .env.local');
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',  // 必要に応じて更新
    })
  : null;

// アプリのベースURL（オンボーディング戻り先などに使う）
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Stripe Connect ClientID（Standard OAuth用）
export const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID || '';
