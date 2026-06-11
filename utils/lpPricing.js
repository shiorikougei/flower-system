// [LP-#41] LP用 料金プラン定義
// オーナー管理画面から編集 → app_settings.nocolde_owner.lpPricing に保存
// LPトップページ(/)で表示

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
  note: "🌸 すべてのプランに 30日間無料トライアルつき・導入サポート無料",
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
