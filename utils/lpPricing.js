// [LP-#41/#45] LP用 料金プラン + 画像定義
// オーナー管理画面から編集 → app_settings.nocolde_owner.lpPricing / lpImages に保存
// LPトップページ(/)で表示

// LPの画像キー（page.tsx の IMG オブジェクトと一致）
export const LP_IMAGE_KEYS = [
  // === Hero ===
  { key: "hero", label: "ヒーロー画像（PC+スマホ+タブレット合成）", recommend: "横長 16:10・1600px〜・FLORIX画面が映る合成画像推奨" },
  // === 5枚ギャラリー（Hero下） ===
  { key: "gallery1", label: "ギャラリー1（制作風景）", recommend: "正方形 1:1・800px〜" },
  { key: "gallery2", label: "ギャラリー2（ブーケ）", recommend: "正方形 1:1・800px〜" },
  { key: "gallery3", label: "ギャラリー3（店内陳列）", recommend: "正方形 1:1・800px〜" },
  { key: "gallery4", label: "ギャラリー4（PC作業）", recommend: "正方形 1:1・800px〜" },
  { key: "gallery5", label: "ギャラリー5（受け渡し）", recommend: "正方形 1:1・800px〜" },
  // === セクション内画像 ===
  { key: "problem1", label: "課題セクション 写真", recommend: "縦長 4:5・900px〜" },
  { key: "solution", label: "解決策セクション 写真", recommend: "横長 16:9・1400px〜" },
  { key: "f1", label: "機能01 受注管理 写真", recommend: "5:4・1000px〜" },
  { key: "f2", label: "機能02 配達管理 写真", recommend: "5:4・1000px〜" },
  { key: "f3", label: "機能03 EC機能 写真", recommend: "5:4・1000px〜" },
  { key: "f4", label: "機能04 顧客管理 写真", recommend: "5:4・1000px〜" },
  { key: "usage", label: "ご利用フロー 写真", recommend: "縦長 4:5・1200px〜" },
];

// デフォルトのLP画像URL（Unsplash仮素材）
export const DEFAULT_LP_IMAGES = {
  hero: "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=1600&q=90&auto=format&fit=crop",
  gallery1: "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=800&q=85&auto=format&fit=crop",
  gallery2: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&q=85&auto=format&fit=crop",
  gallery3: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=800&q=85&auto=format&fit=crop",
  gallery4: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=85&auto=format&fit=crop",
  gallery5: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=800&q=85&auto=format&fit=crop",
  problem1: "https://images.unsplash.com/photo-1487070183336-b863922373d4?w=900&q=85&auto=format&fit=crop",
  solution: "https://images.unsplash.com/photo-1493612276216-ee3925520721?w=1400&q=90&auto=format&fit=crop",
  f1: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1000&q=85&auto=format&fit=crop",
  f2: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=1000&q=85&auto=format&fit=crop",
  f3: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1000&q=85&auto=format&fit=crop",
  f4: "https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=1000&q=85&auto=format&fit=crop",
  usage: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=1200&q=90&auto=format&fit=crop",
};

/**
 * LPの画像を取得（DBから or デフォルト）
 */
export async function fetchLpImages(supabaseAdmin) {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("settings_data")
      .eq("id", "nocolde_owner")
      .maybeSingle();
    const stored = data?.settings_data?.lpImages || {};
    return { ...DEFAULT_LP_IMAGES, ...stored };
  } catch {
    return DEFAULT_LP_IMAGES;
  }
}

export const DEFAULT_LP_PRICING = {
  plans: [
    {
      name: "スターター",
      subtitle: "個人店・1店舗",
      price: 3800,
      priceText: "", // 空なら ¥{price} 表示。お問い合わせ等のときに使う
      recommended: false,
      features: [
        "ご注文管理",
        "配達管理",
        "顧客管理",
        "立札自動生成",
        "操作履歴",
      ],
    },
    {
      name: "プロフェッショナル",
      subtitle: "EC・SEO対策を本格化",
      price: 7800,
      priceText: "",
      recommended: true,
      features: [
        "スタータープランすべて",
        "オンラインショップ（EC）",
        "SEO対策（ブログ・FAQ）",
        "QRコード在庫管理",
        "売上分析ダッシュボード",
        "独自ドメイン対応",
      ],
    },
    {
      name: "エンタープライズ",
      subtitle: "複数店舗・法人",
      price: null,
      priceText: "お問い合わせ",
      recommended: false,
      features: [
        "プロフェッショナルすべて",
        "複数店舗管理",
        "法人請求書発行",
        "専任サポート",
        "カスタマイズ対応",
        "オンプレ・SLA対応可",
      ],
    },
  ],
  note: "すべてのプランに 30日間無料トライアル付き。リスクなく始められます。",
  trialDays: 30,
};

/**
 * LP用の料金設定を取得（DBから or デフォルト）
 * サーバーコンポーネントから呼ぶ
 */
export async function fetchLpPricing(supabaseAdmin) {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("settings_data")
      .eq("id", "nocolde_owner")
      .maybeSingle();
    const stored = data?.settings_data?.lpPricing;
    if (!stored || !Array.isArray(stored.plans) || stored.plans.length === 0) {
      return DEFAULT_LP_PRICING;
    }
    // 部分マージ（足りないフィールドはデフォルトで補完）
    return {
      ...DEFAULT_LP_PRICING,
      ...stored,
      plans: stored.plans.map((p, idx) => ({
        ...DEFAULT_LP_PRICING.plans[idx] || {},
        ...p,
      })),
    };
  } catch {
    return DEFAULT_LP_PRICING;
  }
}
