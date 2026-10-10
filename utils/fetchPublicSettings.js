// [セキュリティ 2026-10] お客様向けページ（ブラウザ）で店舗設定を読むときはこれを使う
// データベースを直接読まず、秘密の項目を取り除いた /api/public/settings から受け取る。
// 戻り値は supabase の .single() と同じ形 { data: { settings_data } | null, error } にしてある

export async function fetchPublicSettings(id) {
  try {
    const res = await fetch(`/api/public/settings?id=${encodeURIComponent(String(id || '').toLowerCase())}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.settings_data) return { data: null, error: { message: 'settings not found' } };
    return { data: { settings_data: json.settings_data }, error: null };
  } catch (e) {
    return { data: null, error: { message: e?.message || 'fetch failed' } };
  }
}
