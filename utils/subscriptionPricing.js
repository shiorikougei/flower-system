// ===============================================================
// サブスク料金マスター
// ---------------------------------------------------------------
// 各機能（features）に料金を紐付けて、テナントごとの月額を自動計算。
// オーナーページから料金は変更可能（app_settings.id='nocolde_owner' に保存）
// ===============================================================

import { ALL_FEATURE_KEYS } from '@/utils/features';

export const DEFAULT_PRICING = {
  basePrice: 3000,                  // 基本料金（注文管理・カレンダー・配達）
  featurePrices: {
    ec: 2000,                       // EC機能
    sales: 1000,                    // 売上管理
    customers: 1000,                // 顧客管理
    portfolio: 2000,                // 作品管理（AI・インスタ）
    shiftManagement: 1500,          // シフト管理
    attendanceManagement: 1500,     // 勤怠管理
    payroll: 2000,                  // 給与計算
    lineIntegration: 1500,          // LINE公式アカウント連携
    b2b: 3000,                      // 法人ページ
    deliveryOutsource: 5000,        // 配達業務委託
    posRegister: 3000,              // POSレジ
  },
  taxRate: 0.10,                    // 消費税
};

/**
 * 月額自動計算（features ON のものだけ加算）
 * @param {Object} features - { ec: true, sales: false, ... }
 * @param {Object} pricing - DEFAULT_PRICING の上書き
 * @param {Object} overrides - 機能別手動料金 { basePrice?: number, featurePrices?: { ec: 0, sales: 1000 } }
 *                              指定された機能は overrides の値で計算（モデル店舗・特別契約用）
 * @returns { basePrice, featureBreakdown, subTotal, tax, total }
 */
export function calcMonthlyFee(features, pricing = DEFAULT_PRICING, overrides = null) {
  const basePrice = (overrides?.basePrice != null && overrides.basePrice !== '')
    ? Number(overrides.basePrice)
    : (Number(pricing.basePrice) || 0);
  const featurePrices = pricing.featurePrices || {};
  const featureOverrides = overrides?.featurePrices || {};
  const breakdown = [];
  let subTotal = basePrice;

  Object.keys(featurePrices).forEach(key => {
    if (features?.[key]) {
      const overridden = featureOverrides[key];
      const price = (overridden != null && overridden !== '')
        ? Number(overridden)
        : (Number(featurePrices[key]) || 0);
      breakdown.push({ key, price, overridden: overridden != null && overridden !== '' });
      subTotal += price;
    }
  });

  const tax = Math.round(subTotal * (Number(pricing.taxRate) || 0));
  const total = subTotal + tax;
  return { basePrice, featureBreakdown: breakdown, subTotal, tax, total };
}

/**
 * 手動オーバーライド版（モデル店舗用）
 * @param {Object} options - { manualPriceJpy, taxIncluded? }
 */
export function calcWithManualOverride(manualPriceJpy, taxRate = 0.10, taxIncluded = false) {
  const price = Number(manualPriceJpy) || 0;
  if (taxIncluded) {
    const subTotal = Math.floor(price / (1 + taxRate));
    return { subTotal, tax: price - subTotal, total: price, manual: true };
  }
  const tax = Math.round(price * taxRate);
  return { subTotal: price, tax, total: price + tax, manual: true };
}
