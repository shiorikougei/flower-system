// [セキュリティ 2026-10] お客様向けページに渡してよい店舗設定だけにする
// app_settings.settings_data には LINE の鍵・スタッフの PIN・システムパスワード・給与設定・通知先メールなど
// お客様に見せてはいけない項目も入っている。お客様向けのページは /api/public/settings 経由でこれを使う。
// 保存されている設定そのものは変えない（返すときに取り除くだけ）

// まるごと渡さない項目（スタッフ用・内部用）
const DROP_TOP_LEVEL = [
  'staffList', 'staffAuthConfig', 'payrollConfig', 'shiftConfig', 'staffOrderConfig',
  'aiUsage', 'tenantBilling', 'invitations', 'pricingConfig', 'auditLog',
];

// どの階層にあっても取り除く項目名
const DROP_ANY_LEVEL = new Set([
  'channelSecret', 'channelAccessToken', 'channelId',
  'systemPassword', 'password', 'pin', 'pinHash',
  'notifyEmail', 'notifyCcEmails',
  'apiKey', 'api_key', 'secret', 'token', 'accessToken', 'refreshToken',
]);
const SECRETISH = /(secret|token|password|api_?key)/i;

function scrub(value, depth = 0) {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (DROP_ANY_LEVEL.has(k) || SECRETISH.test(k)) continue;
      out[k] = scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function publicSettings(settings) {
  const src = settings && typeof settings === 'object' ? settings : {};
  const copy = { ...src };
  for (const k of DROP_TOP_LEVEL) delete copy[k];
  return scrub(copy);
}

// 公開してよい設定行の ID（テナント本体と、そのギャラリー行）
export function isPublicSettingsId(id) {
  const s = String(id || '');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(s)) return false;
  if (s === 'nocolde_owner' || s.startsWith('nocolde')) return false;
  return true;
}
