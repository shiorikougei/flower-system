// レート制限ユーティリティ（Upstash Redis 永続化 + インメモリ fallback）
//
// セットアップ:
//   1. https://upstash.com で Redis DB 作成（無料枠あり）
//   2. Vercel に環境変数追加:
//      UPSTASH_REDIS_REST_URL
//      UPSTASH_REDIS_REST_TOKEN
//   3. 未設定の場合はインメモリにフォールバック（開発用・単一インスタンス用）
//
// 使い方:
//   import { rateLimit } from '@/utils/rateLimit';
//   const allowed = await rateLimit({ key: `notify:${ip}`, max: 5, windowSec: 60 });
//   if (!allowed) return NextResponse.json({ error: '...' }, { status: 429 });

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

let redis = null;
const limiterCache = new Map(); // window -> Ratelimit instance

// Redis 初期化（環境変数があれば）
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (e) {
    console.warn('[rateLimit] Upstash Redis 初期化失敗、インメモリにfallback:', e?.message);
  }
}

// インメモリ fallback
const memoryMap = new Map();
function memoryCheck(key, max, windowMs) {
  const now = Date.now();
  const entry = memoryMap.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  memoryMap.set(key, entry);
  return entry.count <= max;
}

/**
 * レート制限チェック
 * @param {Object} opts
 *   - key: ユニークキー (例: 'notify:1.2.3.4')
 *   - max: 上限回数
 *   - windowSec: 期間（秒）
 * @returns {Promise<boolean>} true=許可 / false=拒否
 */
export async function rateLimit({ key, max = 10, windowSec = 60 }) {
  if (!key) return true;

  if (redis) {
    try {
      // Ratelimit インスタンス（同じwindowは使い回し）
      const cacheKey = `${max}@${windowSec}`;
      let limiter = limiterCache.get(cacheKey);
      if (!limiter) {
        limiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
          prefix: 'florix',
        });
        limiterCache.set(cacheKey, limiter);
      }
      const { success } = await limiter.limit(key);
      return success;
    } catch (e) {
      console.warn('[rateLimit] Redis error, fallback to memory:', e?.message);
      return memoryCheck(key, max, windowSec * 1000);
    }
  }

  // Redis 未設定 → インメモリ
  return memoryCheck(key, max, windowSec * 1000);
}

/**
 * IP を request から取得
 */
export function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
