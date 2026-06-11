// [Phase2.5-#115] オーナー画面のIPホワイトリスト
// /owner ページへのアクセスを限定IPからのみ許可
//
// 環境変数 OWNER_ALLOWED_IPS にカンマ区切りでIPを列挙:
//   OWNER_ALLOWED_IPS="203.0.113.10,198.51.100.20,2001:db8::1"
//
// 設定しない場合は全IPを許可（後方互換）
//
// [Phase2.5-#116] CSP nonce 生成
// リクエストごとに nonce を生成して Response Header に付与
// 将来 next.config.ts の CSP から unsafe-inline を削除する際の準備

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 保護対象のパス（オーナー専用）
const PROTECTED_PATHS = ["/owner"];

// [Phase2.5-#116] nonce生成（リクエストごとにランダム16バイト）
function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString("base64");
}

// 環境変数からホワイトリストを取得
function getAllowedIps(): string[] | null {
  const raw = process.env.OWNER_ALLOWED_IPS;
  if (!raw) return null; // 未設定なら全許可
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// クライアントIPを抽出（Vercel/Cloudflare等のプロキシ経由対応）
function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const firstIp = xff.split(",")[0]?.trim();
  if (firstIp) return firstIp;
  return req.headers.get("x-real-ip") || "";
}

// IPがホワイトリストに含まれるかチェック
function isAllowed(ip: string, list: string[]): boolean {
  if (!ip) return false;
  return list.includes(ip);
}

// [SEO-#7] 独自ドメインのテナント/店舗マッピング
// 環境変数 CUSTOM_DOMAIN_MAP に JSON でマップを定義:
//   CUSTOM_DOMAIN_MAP='{"ohanaflowershop.com":{"tenantId":"令真商事","shopId":"1"}}'
//
// または将来的にDBから動的取得する設計に拡張可能
function getCustomDomainTarget(host: string): { tenantId: string; shopId: string } | null {
  if (!host) return null;
  // www. 除去
  const normalized = host.replace(/^www\./, "").toLowerCase();
  try {
    const raw = process.env.CUSTOM_DOMAIN_MAP || "{}";
    const map = JSON.parse(raw);
    return map[normalized] || null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") || "";

  // [SEO-#7] 独自ドメインからのアクセスを店舗ページにリライト
  // ※ /staff, /owner, /api, _next 等はリライトしない
  const isNonShopPath = pathname.startsWith("/staff")
    || pathname.startsWith("/owner")
    || pathname.startsWith("/api")
    || pathname.startsWith("/_next")
    || pathname === "/favicon.ico"
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml";

  if (!isNonShopPath) {
    const target = getCustomDomainTarget(host);
    if (target) {
      // ルートアクセス → /order/[tenantId]/[shopId]
      if (pathname === "/") {
        const url = req.nextUrl.clone();
        url.pathname = `/order/${target.tenantId}/${target.shopId}`;
        return NextResponse.rewrite(url);
      }
      // /shop → /order/[tenantId]/[shopId]/shop
      if (pathname === "/shop" || pathname.startsWith("/shop/")) {
        const url = req.nextUrl.clone();
        url.pathname = `/order/${target.tenantId}/${target.shopId}${pathname}`;
        return NextResponse.rewrite(url);
      }
      // /products/[productId] → /products/[tenantId]/[productId]
      if (pathname.startsWith("/products/")) {
        const url = req.nextUrl.clone();
        const productId = pathname.replace("/products/", "");
        url.pathname = `/products/${target.tenantId}/${productId}`;
        return NextResponse.rewrite(url);
      }
    }
  }

  // [Phase2.5-#115] /owner 配下: IP制限チェック
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (isProtected) {
    const allowed = getAllowedIps();
    if (allowed && allowed.length > 0) {
      const clientIp = getClientIp(req);
      if (!isAllowed(clientIp, allowed)) {
        return new NextResponse(
          `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>Access Denied</title><style>body{font-family:sans-serif;text-align:center;padding:50px;background:#FBFAF9;color:#2D4B3E}</style></head><body><h1>403 Access Denied</h1><p>このページへのアクセスは許可されていません。</p><p style="font-size:11px;color:#999;margin-top:24px;">ご担当者の方は IT 管理者にお問い合わせください。</p></body></html>`,
          { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }
    }
  }

  // [Phase2.5-#116] CSP nonce をリクエストごとに生成
  // 将来 next.config.ts の CSP から unsafe-inline を削除する際の準備
  const nonce = generateNonce();
  const response = NextResponse.next({
    request: {
      headers: new Headers(req.headers),
    },
  });
  // Server Components から読み取れるよう x-nonce ヘッダに格納
  response.headers.set("x-nonce", nonce);
  return response;
}

// マッチャー設定: /owner はIP制限、その他全体は CSP nonce生成のために通す
// （ただし next.config.ts のCSPヘッダはそのまま適用される）
export const config = {
  matcher: [
    /*
     * 静的ファイルとAPI Route以外の全パスにマッチ
     * - api/ はミドルウェア対象外（個別のAPIで認証等を実施）
     * - _next/static, _next/image, favicon.ico は除外
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
