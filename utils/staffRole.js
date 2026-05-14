// スタッフ権限管理ユーティリティ
// ---------------------------------------------------------------
// 各スタッフは settings.staffList[].role で割り当てられる
//   'owner'    : 全機能アクセス可（オーナー・店長クラス）
//   'staff'    : 注文管理 + 売上閲覧可、設定変更不可
//   'parttime' : 注文一覧の閲覧・対応のみ（売上・設定見えない）
//
// 「現在ログインしているスタッフ」は localStorage に保存
// （簡易版。本格的なログインは将来実装）

const STORAGE_KEY = 'florix_current_staff';

export const ROLES = ['owner', 'staff', 'parttime'];

export const ROLE_LABELS = {
  owner: 'オーナー',
  staff: 'スタッフ',
  parttime: 'バイト',
};

export const ROLE_DESCRIPTIONS = {
  owner: '全機能アクセス可（設定変更・売上・スタッフ管理）',
  staff: '注文管理 + 売上閲覧 + 顧客管理',
  parttime: '注文一覧の閲覧・対応のみ',
};

// 権限テーブル: 各 role がアクセスできる機能
export const PERMISSIONS = {
  owner: {
    settings: true,        // 各種設定
    sales: true,           // 売上管理
    customers: true,       // 顧客管理
    products: true,        // 商品管理（EC）
    portfolio: true,       // 作品管理
    deliveries: true,      // 配達管理
    orders: true,          // 注文管理
    newOrder: true,        // 店舗注文受付
    calendar: true,        // 受注カレンダー
    home: true,            // ホーム
    manageStaff: true,     // スタッフ追加/削除
    deleteOrder: true,     // 注文削除
    editPrice: true,       // 価格・金額の編集
    audit: true,           // 操作履歴・勤怠閲覧
    shift: true,           // 自分のシフト確認
    manageShift: true,     // シフト管理（他人のシフト編集）
  },
  staff: {
    settings: false,
    sales: true,
    customers: true,
    products: true,
    portfolio: true,
    deliveries: true,
    orders: true,
    newOrder: true,
    calendar: true,
    home: true,
    manageStaff: false,
    deleteOrder: false,
    editPrice: true,
    audit: false,
    shift: true,           // 自分のシフト確認は可
    manageShift: false,    // 他人のシフト編集は不可
  },
  parttime: {
    settings: false,
    sales: false,
    customers: false,
    products: false,
    portfolio: false,
    deliveries: true,      // 配達管理は見える
    orders: true,
    newOrder: true,
    calendar: true,
    home: true,
    manageStaff: false,
    deleteOrder: false,
    editPrice: false,
    audit: false,
    shift: true,           // 自分のシフト確認は可
    manageShift: false,    // 他人のシフト編集は不可
  },
};

// 指定の role でアクセス可能か
export function can(role, action) {
  if (!role) return false;
  return Boolean(PERMISSIONS[role]?.[action]);
}

// localStorage から現在のスタッフを取得
export function getCurrentStaff() {
  if (typeof window === 'undefined') return null;
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

// 現在のスタッフを保存
export function setCurrentStaff(staff) {
  if (typeof window === 'undefined') return;
  if (!staff) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: staff.name,
      role: staff.role || 'staff',
      store: staff.store,
    }));
  }
}

// 現在のスタッフのrole（未設定なら 'owner' を返す＝後方互換、既存運用を壊さない）
export function getCurrentRole() {
  const s = getCurrentStaff();
  return s?.role || 'owner';
}

// 現在のスタッフが指定の操作を行えるか
export function canCurrent(action) {
  return can(getCurrentRole(), action);
}
