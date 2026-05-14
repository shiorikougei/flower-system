// ===============================================================
// 給与計算ヘルパー（簡易版・見積もり目安）
// ---------------------------------------------------------------
// 法令上の正確な計算ではなく「目安」として扱うこと。
// 正確な給与計算は社労士または給与計算ソフト推奨。
//
// データ構造（settings.payrollConfig）:
//   {
//     enabled: true,                // 給与計算機能を有効化
//     employmentInsuranceRate: 0.6, // 雇用保険率（%）労働者負担分
//     socialInsuranceRate: 14.5,    // 社会保険合計（健保+厚年）労働者負担分
//     incomeTaxThreshold: 88000,    // 月給これ未満なら所得税源泉徴収なし
//     incomeTaxRate: 3.063,         // 簡易源泉徴収率（%）
//     overtimePremiumRate: 25,      // 残業割増率（%）
//     overtimeThresholdHours: 8,    // 1日この時間超で残業扱い
//   }
//
// staff にこれらのフィールドを追加:
//   { hourlyWage, payrollEnabled, insurance: { employment, social, incomeTax },
//     dependencyLimitYen, monthlyHourLimit }
// ===============================================================

export const DEFAULT_PAYROLL_CONFIG = {
  enabled: false,
  employmentInsuranceRate: 0.6,    // %
  socialInsuranceRate: 14.5,       // % （健保 + 厚生年金合計の労働者負担分目安）
  incomeTaxThreshold: 88000,       // 円/月
  incomeTaxRate: 3.063,            // %
  overtimePremiumRate: 25,         // % (法定: 25%以上)
  overtimeThresholdHours: 8,       // 時間/日
};

export const DEPENDENCY_LIMITS = [
  { value: 0, label: '対象外（適用しない）' },
  { value: 1030000, label: '103万円（所得税扶養）' },
  { value: 1300000, label: '130万円（社会保険扶養）' },
  { value: 1500000, label: '150万円（配偶者特別控除）' },
  { value: 2010000, label: '201万円（配偶者特別控除上限）' },
];

/**
 * 月の労働時間を計算（残業含む）
 * @param {Array} attendanceRecords - その月のスタッフの打刻記録
 * @param {Object} payrollConfig
 * @returns {{ totalMinutes, regularMinutes, overtimeMinutes, days }}
 */
export function calcMonthlyHours(attendanceRecords, payrollConfig = DEFAULT_PAYROLL_CONFIG) {
  let totalMinutes = 0;
  let overtimeMinutes = 0;
  const dayMap = {};

  attendanceRecords.forEach(rec => {
    if (!rec.duration_minutes) return;
    const dateKey = rec.clock_in_at?.split('T')[0];
    if (!dayMap[dateKey]) dayMap[dateKey] = 0;
    dayMap[dateKey] += rec.duration_minutes;
    totalMinutes += rec.duration_minutes;
  });

  // 1日 overtimeThresholdHours 超過分を残業扱い
  const overtimeThresholdMin = (payrollConfig.overtimeThresholdHours || 8) * 60;
  Object.values(dayMap).forEach(min => {
    if (min > overtimeThresholdMin) overtimeMinutes += (min - overtimeThresholdMin);
  });

  const regularMinutes = totalMinutes - overtimeMinutes;
  return {
    totalMinutes,
    regularMinutes,
    overtimeMinutes,
    days: Object.keys(dayMap).length,
  };
}

/**
 * 給与計算
 * @returns 詳細内訳付きオブジェクト
 */
export function calcPayroll(staff, attendanceRecords, payrollConfig = DEFAULT_PAYROLL_CONFIG) {
  const hourlyWage = Number(staff.hourlyWage) || 0;
  const hours = calcMonthlyHours(attendanceRecords, payrollConfig);

  const baseAmount = Math.round((hours.regularMinutes / 60) * hourlyWage);
  const overtimeAmount = Math.round(
    (hours.overtimeMinutes / 60) * hourlyWage * (1 + (payrollConfig.overtimePremiumRate || 25) / 100)
  );
  const grossAmount = baseAmount + overtimeAmount;

  // 控除計算
  const insurance = staff.insurance || {};
  let employmentInsurance = 0;
  let socialInsurance = 0;
  let incomeTax = 0;

  if (insurance.employment) {
    employmentInsurance = Math.round(grossAmount * (payrollConfig.employmentInsuranceRate || 0.6) / 100);
  }
  if (insurance.social) {
    socialInsurance = Math.round(grossAmount * (payrollConfig.socialInsuranceRate || 14.5) / 100);
  }
  if (insurance.incomeTax && grossAmount >= (payrollConfig.incomeTaxThreshold || 88000)) {
    incomeTax = Math.round((grossAmount - employmentInsurance - socialInsurance) * (payrollConfig.incomeTaxRate || 3.063) / 100);
  }

  const totalDeductions = employmentInsurance + socialInsurance + incomeTax;
  const netAmount = grossAmount - totalDeductions;

  return {
    hours,
    hourlyWage,
    baseAmount,
    overtimeAmount,
    grossAmount,
    deductions: {
      employmentInsurance,
      socialInsurance,
      incomeTax,
      total: totalDeductions,
    },
    netAmount,
  };
}

/**
 * 警告判定
 * @param {Object} staff
 * @param {number} ytdGrossYen - 年初からの累計給与額
 * @param {number} monthHours - 当月の労働時間
 * @returns 警告メッセージの配列
 */
export function getPayrollWarnings(staff, ytdGrossYen, monthHours) {
  const warnings = [];

  // 扶養限度警告
  const limit = Number(staff.dependencyLimitYen) || 0;
  if (limit > 0) {
    const remaining = limit - ytdGrossYen;
    const usagePct = Math.round((ytdGrossYen / limit) * 100);
    if (ytdGrossYen >= limit) {
      warnings.push({ type: 'dependency_over', severity: 'high', message: `⚠️ 扶養限度 ¥${limit.toLocaleString()} を超過しました（年初累計 ¥${ytdGrossYen.toLocaleString()}）` });
    } else if (usagePct >= 90) {
      warnings.push({ type: 'dependency_near', severity: 'high', message: `⚠️ 扶養限度の${usagePct}%に到達（残り ¥${remaining.toLocaleString()}）` });
    } else if (usagePct >= 75) {
      warnings.push({ type: 'dependency_warn', severity: 'medium', message: `🔔 扶養限度の${usagePct}%（残り ¥${remaining.toLocaleString()}）` });
    }
  }

  // 月間労働時間警告
  const hourLimit = Number(staff.monthlyHourLimit) || 0;
  if (hourLimit > 0 && monthHours >= hourLimit) {
    warnings.push({
      type: 'hours_over',
      severity: 'high',
      message: `⚠️ 月間労働時間上限 ${hourLimit}h を超過（当月 ${Math.round(monthHours * 10) / 10}h）`,
    });
  } else if (hourLimit > 0 && monthHours >= hourLimit * 0.9) {
    warnings.push({
      type: 'hours_near',
      severity: 'medium',
      message: `🔔 月間労働時間が上限の${Math.round((monthHours / hourLimit) * 100)}%（${Math.round(monthHours * 10) / 10}/${hourLimit}h）`,
    });
  }

  return warnings;
}
