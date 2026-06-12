// [GEO-5] IndexNow クライアント
// Bing/Yandex の即時索引API
// https://www.indexnow.org/

const INDEXNOW_KEY = process.env.INDEXNOW_API_KEY || "71adc1f2f8fe4a9cbc844b9d3ad3a38f";
const HOST = "www.noodleflorix.com";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;

/**
 * URLを IndexNow に通知（Bing/Yandex で即時索引）
 * @param {string|string[]} urls - 通知するURL（単一 or 配列・最大10000件）
 * @returns {Promise<{ok:boolean, status?:number, error?:string}>}
 */
export async function pingIndexNow(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  const filtered = list.filter(u => typeof u === "string" && u.startsWith("https://"));
  if (filtered.length === 0) {
    return { ok: false, error: "no valid urls" };
  }

  try {
    // 単一URLなら GET、複数なら POST
    if (filtered.length === 1) {
      const params = new URLSearchParams({
        url: filtered[0],
        key: INDEXNOW_KEY,
        keyLocation: KEY_LOCATION,
      });
      const res = await fetch(`https://api.indexnow.org/IndexNow?${params}`, {
        method: "GET",
      });
      return { ok: res.ok, status: res.status };
    } else {
      const res = await fetch("https://api.indexnow.org/IndexNow", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: HOST,
          key: INDEXNOW_KEY,
          keyLocation: KEY_LOCATION,
          urlList: filtered,
        }),
      });
      return { ok: res.ok, status: res.status };
    }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// よく使うURL生成ヘルパー
export const buildUrls = {
  home: () => `https://${HOST}/`,
  shop: (tid, sid) => `https://${HOST}/order/${tid}/${sid}`,
  shopList: (tid, sid) => `https://${HOST}/order/${tid}/${sid}/shop`,
  faq: (tid, sid) => `https://${HOST}/order/${tid}/${sid}/faq`,
  product: (tid, pid) => `https://${HOST}/products/${tid}/${pid}`,
  category: (tid, slug) => `https://${HOST}/category/${tid}/${slug}`,
  blogIndex: (tid) => `https://${HOST}/blog/${tid}`,
  blogPost: (tid, slug) => `https://${HOST}/blog/${tid}/${slug}`,
};
