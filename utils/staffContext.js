// [2026-10] スタッフ画面の「ログイン中の人・お店・お店の設定」の読み込みを 1 回にまとめる
//
// これまでは、左のメニュー・各ページ・部品がそれぞれ
//   ログイン確認 → profiles（お店の ID）→ app_settings（お店の設定）
// を別々に、順番待ちで読み込んでいて、同じ読み込みが 1 画面で 3〜4 回走っていた。
// ここでは、同時に呼ばれても 1 回だけ読み込み、結果を使い回す。
//   - お店の ID: ログイン中は変わらないので、ログインしている人が同じなら使い回す
//   - お店の設定: 少しの間（SETTINGS_TTL_MS）だけ使い回す。設定を保存したら invalidateStaffSettings() で捨てる
// 読み込む中身・権限の確かめ方は、これまでと同じ（ブラウザの supabase と RLS）。

import { supabase } from '@/utils/supabase';

const SETTINGS_TTL_MS = 60 * 1000;

let tenantCache = null;      // { userId, tenantId }
let tenantPromise = null;
let settingsCache = null;    // { tenantId, at, settings }
let settingsPromise = null;

/** ログイン中の情報とお店の ID。ログインしていなければ session は null */
export async function getStaffTenant() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, tenantId: null };
  const userId = session.user.id;
  if (tenantCache && tenantCache.userId === userId) return { session, tenantId: tenantCache.tenantId };
  if (!tenantPromise) {
    tenantPromise = (async () => {
      const { data: profile, error } = await supabase.from('profiles').select('tenant_id').eq('id', userId).single();
      if (error) throw error;
      const tenantId = profile?.tenant_id || null;
      if (tenantId) tenantCache = { userId, tenantId };
      return tenantId;
    })().finally(() => { tenantPromise = null; });
  }
  const tenantId = await tenantPromise;
  return { session, tenantId };
}

/** お店の設定（settings_data）。読めないときは null */
export async function getStaffSettings(tenantId, { fresh = false } = {}) {
  if (!tenantId) return null;
  if (!fresh && settingsCache && settingsCache.tenantId === tenantId && Date.now() - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.settings;
  }
  if (!settingsPromise) {
    settingsPromise = (async () => {
      const { data, error } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      if (error && error.code !== 'PGRST116') throw error;
      const settings = data?.settings_data || null;
      settingsCache = { tenantId, at: Date.now(), settings };
      return settings;
    })().finally(() => { settingsPromise = null; });
  }
  return settingsPromise;
}

/** ログイン中の情報・お店の ID・お店の設定をまとめて */
export async function getStaffContext(opts) {
  const { session, tenantId } = await getStaffTenant();
  if (!session || !tenantId) return { session, tenantId, settings: null };
  const settings = await getStaffSettings(tenantId, opts);
  return { session, tenantId, settings };
}

/** 設定を保存したあとに呼ぶ（次の読み込みで最新の設定を取りに行く） */
export function invalidateStaffSettings() {
  settingsCache = null;
}

// ログアウト・別の人でのログインのときは、使い回しを捨てる
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      tenantCache = null;
      settingsCache = null;
    }
  });
}
