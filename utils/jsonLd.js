// [セキュリティ 2026-10] <script type="application/ld+json"> に入れる JSON
// 商品名・店名などに "</script>" のような文字が入っていても、タグの外に出ないように < > & を \uXXXX にする
export function safeJsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
