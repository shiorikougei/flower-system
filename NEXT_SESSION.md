# 明日やること

## ✅ 昨日（〜2026/05/13）までに完了したこと

- セキュリティ強化（RLS適用、クライアント側tenant_idフィルタ）
- バグ修正（カレンダー休業日、お見積り内訳、送料計算、営業時間外スロット 等）
- 機能追加（お急ぎ電話案内、カラーその他、事前連絡同意、独自カレンダー、立札変更）
- AI感削減のUI改修（全画面）
- Stripe決済 完全統合（Connect Express + Standard、Webhook、verify-session）
- EC機能フルセット（商品カタログ、カート、在庫管理、注文履歴）
- 入金状況の2択化（前払い済み / 引き取り時に支払い）
- **git commit + git push 済み**
- **Vercel自動デプロイ成功**

---

## 🚨 明日の最優先タスク

### 1️⃣ 本番サイトで動作確認（5分）

ブラウザで以下にアクセスして表示されるか確認：

- [ ] https://www.noodleflorix.com/staff/login → ログイン
- [ ] サイドバーに「**商品管理（EC）**」が追加されてる
- [ ] https://www.noodleflorix.com/staff/products が開ける
- [ ] 各種設定に「**決済設定**」タブがある
- [ ] https://www.noodleflorix.com/order/OHANA/1773760782503/shop が開ける

### 2️⃣ Vercelに環境変数を追加（10分）

Vercel ダッシュボード → プロジェクト → **Settings → Environment Variables**

以下を Production + Preview 両方に追加:

```
SUPABASE_SERVICE_ROLE_KEY=（Supabase ダッシュボード → Project Settings → API → service_role）
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_CLIENT_ID=ca_...
NEXT_PUBLIC_APP_URL=https://www.noodleflorix.com
```

⚠️ `STRIPE_WEBHOOK_SECRET` は次のステップで取得して追加

### 3️⃣ 本番Stripe Webhook 作成（5分）

1. Stripeダッシュボード → **開発者 → Webhooks** → **エンドポイントを追加**
2. **エンドポイントURL**: `https://www.noodleflorix.com/api/stripe/webhook`
3. **イベントを選択** で以下を選ぶ:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `account.updated`
4. 作成後、**署名シークレット** （`whsec_...`）を表示してコピー
5. Vercelの環境変数に追加: `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`

### 4️⃣ 再デプロイ（自動 or 手動）

環境変数追加後、**再デプロイが必要**:
- Vercel → Deployments → 最新の「...」→ **Redeploy**
- もしくは何か小さな変更を git push でもOK

### 5️⃣ 本番でEC注文テスト（10分）

1. `https://www.noodleflorix.com/staff/products` で商品登録
2. `https://www.noodleflorix.com/order/OHANA/1773760782503/shop` でEC注文
3. クレカ決済（テストカード `4242 4242 4242 4242`）
4. `/staff/orders` で確認 → 「✓ 入金済（クレジットカード）」バッジ
5. `/staff/products` で在庫が減ったか確認

---

## 🟡 動作OKならやる細かい改善

### A. EC商品カタログへの導線
- `noodleflorix.com` のホームから `/shop` リンク
- カスタム注文ページに「商品から選ぶ」ボタン
- スマホからのアクセス導線を整理

### B. 注文確認メール
- Resend or SendGrid 等のメールサービス導入
- 注文確定時にお客様へ自動送信
- 銀行振込なら振込先情報を含める
- スタッフ通知メールも

### C. UX磨き込み
- カートアイコンを商品ページ全体で常時表示
- 「ご注文の確認」リンクをサンクスページにも追加
- 在庫切れ通知機能

---

## 🟢 本番運用前のチェック

### D. テスト→本番モード切替
- StripeダッシュボードをLiveモードに切替
- 本番用APIキー取得（sk_live_, pk_live_）
- Vercelの環境変数を Live キーに更新
- **これは「お店が本物のお金を受け取る準備ができたら」のみ**

### E. セキュリティ最終確認
- 全テーブルでRLSが効いてるか
- ANON ユーザーで意図的にAPI叩いてみる
- レート制限の追加検討

### F. ドキュメント整理
- 店舗オーナー向けの使い方マニュアル
- スタッフ向けの操作ガイド

---

## 💡 困ったときのリファレンス

### プロジェクト構造

```
flower-app/
├── app/
│   ├── api/
│   │   ├── orders/           # 注文確定API
│   │   ├── order-lookup/     # 注文照会API
│   │   └── stripe/           # Stripe関連API群
│   ├── order/[tenantId]/[shopId]/
│   │   ├── page.js           # カスタム注文
│   │   ├── shop/             # EC商品カタログ
│   │   ├── cart/             # カート
│   │   ├── history/          # 注文履歴
│   │   └── thanks/           # サンクス
│   └── staff/
│       ├── products/         # 商品管理（EC）
│       └── ... (他)
├── components/
│   ├── DatePicker.jsx
│   ├── OrderDetailModal.jsx
│   ├── TatefudaPreview.jsx
│   └── settings/PaymentTab.jsx
├── utils/
│   ├── supabase.js
│   ├── stripe.js
│   └── cart.js
└── supabase/
    ├── rls_policies.sql       # 適用済み ✅
    ├── stripe_columns.sql     # 適用済み ✅
    └── products_table.sql     # 適用済み ✅
```

### Stripe Connect 接続済みテナント

- **OHANA**: Express アカウント `acct_1TWHmqKLrBzJfG8V`
- プラットフォーム: ZEROICHI (acct_1TUKfo4GiagGR8f6)
- すべて **テストモード**

### よく使うURL

| 用途 | URL |
|---|---|
| スタッフログイン | `/staff/login` |
| ダッシュボード | `/staff` |
| 商品管理（EC） | `/staff/products` |
| 受注一覧 | `/staff/orders` |
| 決済設定 | `/staff/settings` → 決済設定タブ |
| カスタム注文 | `/order/[tenantId]/[shopId]` |
| EC商品カタログ | `/order/[tenantId]/[shopId]/shop` |
| カート | `/order/[tenantId]/[shopId]/cart` |
| 注文履歴照会 | `/order/[tenantId]/[shopId]/history` |
| サンクスページ | `/order/[tenantId]/[shopId]/thanks` |
