// 見積のやり取り（見積案・メッセージ）の共通処理
// 設計: docs/ESTIMATE_THREAD_DESIGN.md
//
// - 見積案は estimate_versions、やり取りは estimate_messages に保存する
// - 新しい表ができる前の見積（表に何も無い見積）は、estimates の proposed_price などを
//   「見積案1」として扱う（データの移し替えはしない）
// - 料金はすべてここで見積案から計算する（ブラウザから送られた金額は使わない）

import crypto from 'crypto';

export const ESTIMATE_VALID_DAYS = 30;

export function newExpiresAt() {
  return new Date(Date.now() + ESTIMATE_VALID_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function newAccessToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// お客様用リンク（お客様用の鍵がある見積は鍵を付ける）
export function customerEstimateUrl(est, baseUrl = 'https://noodleflorix.com') {
  const base = `${baseUrl}/order/${est.tenant_id}/${est.shop_id || 'default'}/estimate/${est.id}`;
  return est.access_token ? `${base}?t=${encodeURIComponent(est.access_token)}` : base;
}

// お客様用の鍵の確認（鍵が無い今までの見積は、今までどおりリンクだけで開ける）
export function isValidCustomerToken(est, token) {
  if (!est?.access_token) return true;
  if (typeof token !== 'string' || token.length !== est.access_token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(est.access_token));
}

// お客様に返してよい項目だけにする（鍵は返さない）
export function publicEstimate(est) {
  if (!est) return est;
  const { access_token, ...rest } = est;
  return rest;
}

// 表に見積案が無い見積の「見積案1」（estimates の列から作る。保存はしない）
function legacyVersion(est) {
  if (!est || est.proposed_price === null || est.proposed_price === undefined) return null;
  if (!est.replied_at && !est.reply_message) return null;
  return {
    id: 'legacy',
    estimate_id: est.id,
    tenant_id: est.tenant_id,
    version_no: 1,
    proposed_price: Number(est.proposed_price) || 0,
    proposed_data: est.proposed_data || null,
    message: est.reply_message || '',
    status: 'active',
    created_at: est.replied_at || est.updated_at || est.created_at,
    legacy: true,
  };
}

// 見積案の一覧（古い順）
export async function loadVersions(supabase, est) {
  const { data, error } = await supabase
    .from('estimate_versions')
    .select('*')
    .eq('estimate_id', est.id)
    .order('version_no', { ascending: true });
  if (error) throw error;
  if (data && data.length > 0) return data;
  const legacy = legacyVersion(est);
  return legacy ? [legacy] : [];
}

export async function loadMessages(supabase, est) {
  const { data, error } = await supabase
    .from('estimate_messages')
    .select('*')
    .eq('estimate_id', est.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// スタッフ一覧用: 複数の見積のやり取りをまとめて読む
export async function loadThreadsFor(supabase, estimates) {
  const ids = (estimates || []).map(e => e.id);
  const byId = {};
  for (const e of estimates || []) byId[e.id] = { versions: [], messages: [] };
  if (ids.length === 0) return byId;
  const [vRes, mRes] = await Promise.all([
    supabase.from('estimate_versions').select('*').in('estimate_id', ids).order('version_no', { ascending: true }),
    supabase.from('estimate_messages').select('*').in('estimate_id', ids).order('created_at', { ascending: true }),
  ]);
  if (vRes.error) throw vRes.error;
  if (mRes.error) throw mRes.error;
  for (const v of vRes.data || []) byId[v.estimate_id]?.versions.push(v);
  for (const m of mRes.data || []) byId[m.estimate_id]?.messages.push(m);
  for (const e of estimates || []) {
    if (byId[e.id].versions.length === 0) {
      const legacy = legacyVersion(e);
      if (legacy) byId[e.id].versions.push(legacy);
    }
  }
  return byId;
}

// 表に見積案が無く、今までの回答がある見積は、今の回答を「見積案1」として表に保存する
// （新しい見積案を足す前や、見積案1を取り下げる前に呼ぶ。estimates の行は書き換えない）
export async function materializeLegacyVersion(supabase, est) {
  const { data: rows, error } = await supabase
    .from('estimate_versions')
    .select('id, version_no')
    .eq('estimate_id', est.id)
    .order('version_no', { ascending: true });
  if (error) throw error;
  if (rows && rows.length > 0) return rows;
  const legacy = legacyVersion(est);
  if (!legacy) return [];
  const { data: inserted, error: insErr } = await supabase
    .from('estimate_versions')
    .insert([{
      estimate_id: est.id,
      tenant_id: est.tenant_id,
      version_no: 1,
      proposed_price: legacy.proposed_price,
      proposed_data: legacy.proposed_data,
      message: legacy.message,
      status: 'active',
      created_at: legacy.created_at,
    }])
    .select('id, version_no');
  if (insErr) throw insErr;
  return inserted || [];
}

// 見積案の料金内訳から、注文に入れる金額を計算する（税抜）
// - 送料・箱代など（calculatedFee）は内訳から
// - 商品代は「合計 - 送料など」（商品代が空欄の古い見積で送料が二重に入らないように）
export function amountsFromVersion(version) {
  const pd = version?.proposed_data || {};
  const total = Math.max(0, Math.floor(Number(version?.proposed_price) || 0));
  const selfDeliveryFee = Number(pd.selfDeliveryFee) || 0;
  const sagawaFee = Number(pd.sagawaFee) || 0;
  const boxFee = Number(pd.boxFee) || 0;
  const coolFee = Number(pd.coolFee) || 0;
  const otherFees = Array.isArray(pd.otherFees)
    ? pd.otherFees.filter(o => Number(o?.amount) > 0).map(o => ({ name: String(o.name || 'その他').slice(0, 50), amount: Math.floor(Number(o.amount)) }))
    : [];
  const otherTotal = otherFees.reduce((s, o) => s + o.amount, 0);
  const calculatedFee = selfDeliveryFee + sagawaFee + boxFee + coolFee + otherTotal;
  const itemPrice = total - calculatedFee;
  return {
    ok: itemPrice >= 0 && total > 0,
    total,
    itemPrice,
    calculatedFee,
    feeBreakdown: {
      baseFee: selfDeliveryFee + sagawaFee,
      boxFee,
      coolFee,
      otherFees,
    },
  };
}
