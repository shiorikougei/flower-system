// [業務-2] 住所→郵便番号 ヒント取得 + 住所正規化
//
// 戦略: 国土地理院（GSI）APIで住所を正規化
//      → 都道府県・市区町村を確定 → エリア判定に使用
//
// 郵便番号自体は不確定なので、ユーザーに「住所だけ確認」モードを提供
// 配達伝票の郵便番号は後で電話確認等で取得する想定

import { NextResponse } from "next/server";

/**
 * 住所文字列の正規化
 */
function normalize(s) {
  if (!s) return "";
  return String(s)
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .trim();
}

/**
 * 国土地理院 住所→緯度経度 API
 * 無料・無制限・APIキー不要
 */
async function gsiGeocode(address) {
  try {
    const res = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 5).map((item) => ({
      title: item.properties?.title || "",
      lat: item.geometry?.coordinates?.[1],
      lng: item.geometry?.coordinates?.[0],
    }));
  } catch {
    return [];
  }
}

/**
 * 住所文字列から「都道府県・市区町村・町名・番地」を抽出
 */
function parseAddress(title) {
  const norm = normalize(title);
  // 都道府県
  const prefMatch = norm.match(/^(.+?[都道府県])(.+)$/);
  if (!prefMatch) return null;
  const pref = prefMatch[1];
  const rest = prefMatch[2];
  // 市区町村（郡含む）
  const cityMatch = rest.match(/^(.+?[市区町村郡])(.+)?$/);
  if (!cityMatch) return { pref, city: rest, town: "", banchi: "" };
  const city = cityMatch[1];
  const after = cityMatch[2] || "";
  // 町名（丁目まで）
  const townMatch = after.match(/^(.+?[\d０-９一二三四五六七八九十百]+丁目)(.+)?$/);
  if (townMatch) {
    return {
      pref,
      city,
      town: townMatch[1],
      banchi: townMatch[2] || "",
    };
  }
  // 丁目がない場合は、数字で区切る
  const noTyoumeMatch = after.match(/^(.+?)([\d０-９]+.+)?$/);
  if (noTyoumeMatch) {
    return {
      pref,
      city,
      town: noTyoumeMatch[1] || "",
      banchi: noTyoumeMatch[2] || "",
    };
  }
  return { pref, city, town: after, banchi: "" };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const rawAddress = url.searchParams.get("address");
    if (!rawAddress || rawAddress.length < 4) {
      return NextResponse.json({
        ok: false,
        error: "住所をもう少し詳しく入力してください（4文字以上）",
      }, { status: 400 });
    }

    const candidates = await gsiGeocode(rawAddress);
    if (candidates.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "該当する住所が見つかりませんでした。表記を変えて再試行してください。",
      });
    }

    // 候補それぞれをパース
    const results = candidates
      .map((c) => {
        const parsed = parseAddress(c.title);
        if (!parsed) return null;
        return {
          ...parsed,
          full: c.title,
          lat: c.lat,
          lng: c.lng,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      candidates: results,
      best: results[0] || null,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e?.message || "internal error",
    }, { status: 500 });
  }
}
