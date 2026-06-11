// [POS-#24] QRコード生成ユーティリティ
//
// 商品ごとに /products/[tenantId]/[productId] のQRコードを生成
// 店頭でスキャン → 商品個別ページが開く（お客様: 商品確認 / スタッフ: 在庫操作）
//
// 使い方:
//   import { getProductQrUrl, getQrCodeDataUrl } from '@/utils/qrcode';
//   const qrUrl = getProductQrUrl(tenantId, productId);
//   const dataUrl = await getQrCodeDataUrl(qrUrl);  // <img src={dataUrl}/> で表示可能

const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

/**
 * QR URLを取得（スタッフ専用スキャンページへ）
 * 未ログインなら /staff/login に飛ばされる
 * 引数 tenantId は後方互換のため受けるが使わない（スタッフ認証時に自動取得）
 */
export function getProductQrUrl(_tenantId, productId) {
  return `${BASE_URL}/staff/scan/${productId}`;
}

/**
 * QRコードをDataURL（image/png）形式で生成（クライアント側）
 * qrcode ライブラリを動的import
 */
export async function getQrCodeDataUrl(text, opts = {}) {
  if (typeof window === "undefined") return ""; // SSR対応
  try {
    const QRCode = (await import("qrcode")).default;
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: opts.width || 300,
      color: {
        dark: opts.dark || "#111111",
        light: opts.light || "#FFFFFF",
      },
    });
  } catch (e) {
    console.warn("[qrcode] generation failed:", e?.message);
    return "";
  }
}

/**
 * QRコードをSVG文字列で生成（高画質印刷向け）
 */
export async function getQrCodeSvg(text, opts = {}) {
  if (typeof window === "undefined") return "";
  try {
    const QRCode = (await import("qrcode")).default;
    return await QRCode.toString(text, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: opts.width || 300,
      color: {
        dark: opts.dark || "#111111",
        light: opts.light || "#FFFFFF",
      },
    });
  } catch (e) {
    console.warn("[qrcode] SVG generation failed:", e?.message);
    return "";
  }
}
