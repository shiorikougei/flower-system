// ===============================================================
// AI利用カウンター
// ---------------------------------------------------------------
// テナント別・月別の AI 生成回数を記録し、無料枠/超過料金を管理する
//
// データ構造（app_settings.settings_data 内に保存）:
//   aiUsage: {
//     "2026-05": {
//       caption: 42,         // キャプション生成回数
//       prompt: 1,           // プロンプト自動生成回数
//       total: 43            // 合算（無料枠判定はこの値で行う）
//     },
//     "2026-04": { ... }
//   }
//
// 料金プラン（aiPricingConfig として owner レベルで保存・変更可能）:
//   {
//     freeQuotaPerMonth: 100,     // 月の無料枠
//     pricePerExtraJpy: 5,        // 超過1回あたりの円
//   }
// ===============================================================

import { createClient } from '@supabase/supabase-js';

export const DEFAULT_AI_PRICING = {
  freeQuotaPerMonth: 100,
  pricePerExtraJpy: 5,
};

// 現在の年月キー ("YYYY-MM")
export function currentMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// テナントの料金プラン取得（オーナー全体設定 or デフォルト）
export async function getAiPricing(supabaseAdmin) {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', 'nocolde_owner')
      .single();
    const cfg = data?.settings_data?.aiPricingConfig;
    return {
      freeQuotaPerMonth: Number(cfg?.freeQuotaPerMonth ?? DEFAULT_AI_PRICING.freeQuotaPerMonth),
      pricePerExtraJpy: Number(cfg?.pricePerExtraJpy ?? DEFAULT_AI_PRICING.pricePerExtraJpy),
    };
  } catch (e) {
    return DEFAULT_AI_PRICING;
  }
}

// テナントの利用状況取得（今月分）
export async function getMonthlyUsage(supabaseAdmin, tenantId, monthKey = currentMonthKey()) {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('settings_data')
    .eq('id', tenantId)
    .single();
  const allUsage = data?.settings_data?.aiUsage || {};
  const monthData = allUsage[monthKey] || { caption: 0, prompt: 0, total: 0 };
  return {
    monthKey,
    caption: Number(monthData.caption || 0),
    prompt: Number(monthData.prompt || 0),
    total: Number(monthData.total || 0),
    fullHistory: allUsage,
  };
}

// 利用カウントをインクリメント。「上限超過してたらエラーを返す」モードも
//   kind: 'caption' | 'prompt'
//   allowOverLimit: true なら超過してても記録だけして許可、false なら拒否
// 戻り値: { allowed, usage, pricing, overage }
export async function incrementUsage(supabaseAdmin, tenantId, kind, { allowOverLimit = true } = {}) {
  const monthKey = currentMonthKey();
  const pricing = await getAiPricing(supabaseAdmin);

  // 現在の usage を取得
  const { data: row } = await supabaseAdmin
    .from('app_settings')
    .select('settings_data')
    .eq('id', tenantId)
    .single();
  const settings = row?.settings_data || {};
  const allUsage = { ...(settings.aiUsage || {}) };
  const current = allUsage[monthKey] || { caption: 0, prompt: 0, total: 0 };

  // 上限チェック（incrementする前の値で判定）
  if (!allowOverLimit && current.total >= pricing.freeQuotaPerMonth) {
    return {
      allowed: false,
      reason: 'quota_exceeded',
      usage: current,
      pricing,
      overage: Math.max(0, current.total - pricing.freeQuotaPerMonth),
    };
  }

  // インクリメント
  const next = {
    caption: kind === 'caption' ? current.caption + 1 : current.caption,
    prompt: kind === 'prompt' ? current.prompt + 1 : current.prompt,
    total: current.total + 1,
  };
  allUsage[monthKey] = next;

  // 保存（既存設定は壊さない）
  await supabaseAdmin
    .from('app_settings')
    .upsert({
      id: tenantId,
      settings_data: { ...settings, aiUsage: allUsage },
    });

  return {
    allowed: true,
    usage: next,
    pricing,
    overage: Math.max(0, next.total - pricing.freeQuotaPerMonth),
  };
}

// 全テナントの今月利用状況一括取得（オーナー画面用）
export async function getAllTenantsUsage(supabaseAdmin, monthKey = currentMonthKey()) {
  const { data: rows } = await supabaseAdmin
    .from('app_settings')
    .select('id, settings_data')
    .neq('id', 'nocolde_owner');
  const pricing = await getAiPricing(supabaseAdmin);

  return (rows || []).map(row => {
    const settings = row.settings_data || {};
    const monthData = settings.aiUsage?.[monthKey] || { caption: 0, prompt: 0, total: 0 };
    const total = Number(monthData.total || 0);
    const overage = Math.max(0, total - pricing.freeQuotaPerMonth);
    return {
      tenantId: row.id,
      tenantName: settings.generalConfig?.appName || row.id,
      monthKey,
      caption: Number(monthData.caption || 0),
      prompt: Number(monthData.prompt || 0),
      total,
      overage,
      overageJpy: overage * pricing.pricePerExtraJpy,
    };
  });
}
