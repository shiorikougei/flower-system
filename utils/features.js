// ===============================================================
// サブスク機能の定義
// ---------------------------------------------------------------
// オーナー（NocoLde）が各テナントの features をON/OFFすることで
// サブスクで切り出す機能を制御する。
//
// 保存先: app_settings.settings_data.features = { [key]: boolean }
// ===============================================================

// 機能定義（カテゴリ別）
export const FEATURE_GROUPS = [
  {
    name: '基本機能（標準搭載）',
    items: [
      { key: '_base_orderManagement', label: '注文管理（カスタムオーダー）', description: '基本機能のため常時ON', alwaysOn: true },
      { key: '_base_calendar', label: 'カレンダー・配達管理', description: '基本機能', alwaysOn: true },
    ],
  },
  {
    name: 'EC・売上系（オプション）',
    items: [
      { key: 'ec', label: 'EC機能（商品カタログ・カート）', description: 'オンライン販売・在庫管理' },
      { key: 'sales', label: '売上管理', description: '売上集計・グラフ表示' },
      { key: 'customers', label: '顧客管理', description: '顧客カルテ・好み傾向集計' },
      { key: 'portfolio', label: '作品管理', description: 'インスタ投稿用キャプション生成・類似提案' },
    ],
  },
  {
    name: 'スタッフ・勤怠系（オプション）',
    items: [
      { key: 'shiftManagement', label: 'シフト管理', description: 'シフト表・希望休・自動生成' },
      { key: 'attendanceManagement', label: '勤怠管理', description: '出退勤打刻・休憩・操作履歴' },
      { key: 'payroll', label: '給与計算', description: '時給×時間・控除・出勤簿PDF' },
    ],
  },
  {
    name: '通知・連携系（オプション）',
    items: [
      { key: 'lineIntegration', label: 'LINE公式アカウント連携', description: '注文確認・完成写真・入金確認等を LINE 併送' },
    ],
  },
  {
    name: '法人・拡張系（準備中）',
    items: [
      { key: 'b2b', label: '法人ページ', description: '法人取引・継続発注', comingSoon: true },
      { key: 'deliveryOutsource', label: '配達業務委託', description: '外部ドライバー連携', comingSoon: true },
      { key: 'posRegister', label: 'POSレジ', description: '店頭レジ機能', comingSoon: true },
    ],
  },
];

export const ALL_FEATURE_KEYS = FEATURE_GROUPS.flatMap(g => g.items.filter(i => !i.alwaysOn).map(i => i.key));

// 機能が有効か判定
export function isFeatureEnabled(settings, key) {
  if (!key || key.startsWith('_base_')) return true;  // 基本機能は常時ON
  const features = settings?.features || {};
  return Boolean(features[key]);
}

// 複数features を一括判定
export function checkFeatures(settings, keys) {
  return keys.every(k => isFeatureEnabled(settings, k));
}

// settings から有効features 一覧
export function getEnabledFeatures(settings) {
  const features = settings?.features || {};
  return Object.keys(features).filter(k => features[k]);
}
