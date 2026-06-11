// [Phase1-① PII保護] 個人情報のマスキングユーティリティ
// 一覧表示・スクリーンショット流出時のリスクを下げるための表示用関数

/**
 * 電話番号をマスク表示
 * 08012345678 → 080****5678
 */
export function maskPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 7) return '****';
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

/**
 * メールアドレスをマスク表示
 * shiorikougei@gmail.com → s***i@gmail.com
 */
export function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = String(email).split('@');
  if (!domain) return '****';
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

/**
 * 名前をマスク表示（姓だけ残す）
 * 七社愛希 → 七社 ◯◯
 */
export function maskName(name) {
  if (!name) return '';
  const str = String(name).trim();
  if (str.length <= 2) return `${str[0] || ''}*`;
  // 姓と思われる先頭2文字 + 残りを伏字に
  return `${str.slice(0, 2)} ◯◯`;
}

/**
 * 住所をマスク表示（市区町村まで）
 * 北海道札幌市北区... → 北海道札幌市 ****
 */
export function maskAddress(address) {
  if (!address) return '';
  const str = String(address).trim();
  // 都道府県+市区町村 までを残す
  const match = str.match(/^(.{0,3}[都道府県])?(.+?[市区町村郡])/);
  if (match) {
    return `${match[1] || ''}${match[2]} ****`;
  }
  // パターンに合致しない場合は先頭5文字のみ
  return `${str.slice(0, 5)}****`;
}
