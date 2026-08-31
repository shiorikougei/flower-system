# FLORIX (flower-system)

FLORIX（フローリックス）は、街の花屋さん向けに開発された受注管理・EC・顧客管理を一体化した SaaS です。運営は NocoLde（旧 nocolde / noodle）。花屋のスタッフが日々の受注・配達・売上を一元管理でき、お客様は各店舗のショップページから花束・供花・アレンジ・EC 商品を購入できます。

本番環境: https://www.noodleflorix.com

決済は Stripe Connect Standard により各店舗の Stripe アカウントに直接入金される構成です。NocoLde オーナーは `/owner` 配下でテナント管理・サブスクリプション管理・LP 設定を行います。

---

## 技術スタック

| 種別 | 技術 | バージョン |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack) | 16.1.6 |
| UI | React | 19.2.3 |
| DB / Auth | Supabase (@supabase/supabase-js) | 2.99 (PostgreSQL + RLS + Vault) |
| 決済 | Stripe (Connect Standard OAuth) | ^22.1.1 |
| メール | Resend | ^6.12.3 |
| アイコン | lucide-react | ^0.577.0 |
| スタイル | Tailwind CSS | - |
| エラー監視 | Sentry | ^10.57 |
| ホスティング | Vercel | - |
| 通知 | LINE Messaging API | - |

---

## セットアップ手順

### 前提条件
- Node.js 20 以降
- npm（同梱）
- Supabase / Stripe / Resend / LINE のアカウント（開発用）

### 手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/shiorikougei/flower-system.git
cd flower-system

# 2. 依存関係をインストール
npm install

# 3. 環境変数ファイルを作成
cp .env.example .env.local
# .env.local を編集して各値を設定（下記「環境変数」参照）

# 4. 開発サーバーを起動（Turbopack）
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

### 追加コマンド

```bash
npm run build      # 本番ビルド
npm run start      # 本番モードで起動
npm run lint       # ESLint
```

### Supabase の初期セットアップ
- `migrations/` 配下の SQL を順に実行。
- `supabase/` 配下の RLS ポリシーを適用。
- Supabase Vault で `app.pii_encryption_key` を設定（**フォールバック無し、必ず設定**）。

---

## デプロイ手順（Vercel）

- `main` ブランチへの push で Vercel が自動デプロイします。
- 手動デプロイ・ロールバックは Vercel Dashboard → 対象デプロイの「Redeploy」から実施。
- 環境変数は Vercel Dashboard の Project Settings → Environment Variables で管理（Production / Preview / Development を分離）。
- OWASP ZAP スキャンは毎月 1 日 JST 12:00 に GitHub Actions で自動実行。

### 決済系変更時の注意
Stripe まわりを触るときは必ず以下の順で検証してください。

1. Stripe テストモードで E2E テスト
2. 本番反映
3. 本番でのスモークテスト（少額決済 → 返金）

---

## 主要ディレクトリ構造

```
flower-app/
├── app/
│   ├── page.tsx                       # LP（ランディングページ）
│   ├── order/[tenantId]/[shopId]/    # お客様向け（店舗ごとの URL）
│   │   ├── shop/  cart/  custom/  estimate/  thanks/
│   │   └── mypage/  history/  faq/
│   ├── staff/                         # スタッフ管理画面
│   │   ├── orders/                    # 受注一覧（未完了 / 未入金 / アーカイブ）
│   │   ├── new-order/  settings/  sales/  calendar/
│   │   └── deliveries/  products/  portfolio/  blog/
│   ├── owner/                         # NocoLde オーナー画面
│   ├── api/                           # API ルート
│   ├── blog/  category/  products/    # 公開ページ (EC / SEO)
│   └── corporate/                     # 法人向け（現状未使用）
├── components/                        # 共通 UI (OrderDetailModal, TatefudaPreview, UpgradeModal ほか)
├── utils/                             # email.js, adminAuth.js, rateLimit.js, stripe.js, staffRole.js ほか
├── migrations/                        # SQL マイグレーション
├── supabase/                          # RLS ポリシー
├── docs/                              # 詳細ドキュメント (PROJECT_KNOWLEDGE.md ほか)
└── public/
```

---

## 環境変数

以下を `.env.local`（開発時）および Vercel の Environment Variables（本番）に設定します。`.env.example` として一覧化：

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...           # サーバー専用

# Stripe（Connect Standard）
STRIPE_SECRET_KEY=sk_test_xxx                     # 本番は sk_live_
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_CLIENT_ID=ca_xxx                           # Stripe Connect OAuth Client ID
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Resend（メール）
RESEND_API_KEY=re_xxx
EMAIL_FROM=order@noodleflorix.com

# 認証・Cron
OWNER_PASSWORD=xxxxxxxx                           # オーナーログイン
CRON_SECRET=xxxxxxxx                              # Vercel Cron 認可
```

### Supabase Vault
- `app.pii_encryption_key`：PII 暗号化キー。**未設定時のフォールバックは無し**（コードで既定値を入れないでください）。

### セキュリティ運用
- シークレットのコミット禁止。
- Stripe テストキーと本番キーの取り違え防止のため、Vercel の環境を明確に分ける。
- キーローテーション時は `docs/PII_ENCRYPTION_MIGRATION.md` の手順に従う。

---

## コーディング規約（要約）

- **絵文字は使わない**（業務書類・UI・ログ）。アイコンは `lucide-react` を利用。
  - メール HTML テンプレート内の絵文字は Phase 5 対応まで例外的に許容。
  - `console.log` / `warn` / `error` 内の絵文字は削除。
- ブランドカラー
  - `#2D4B3E`（深緑・メイン）
  - `#117768`（サブ緑）
  - `#D97D54`（オレンジ・警告）
- 日本語フォント
  - `Shippori Mincho`（明朝、LP 用）
  - `Zen Kaku Gothic New`（ゴシック、本文）
  - `Outfit`（英字）
- タイトルは「フチナシ大文字」を基本形式（例：`受 注 書`、`letter-spacing: 0.3〜0.4em`）。
- `lucide-react` のインポートは既存の `import` 行に追加。重複禁止。
- `err.message` を UI / API レスポンスにそのまま返さない（DB スキーマ漏洩防止）。
- API ルートには必ず認証・認可を実装（`requireStaff` / `requireOwner` を通す）。
- お客様向け文言は丁寧な日本語、スタッフ向け UI は簡潔なラベルで OK。
- 印刷書類は老眼でも読める文字サイズを維持。

---

## 詳細ドキュメント

プロジェクトの全体像、実装済み機能の背景、既知バグ、残タスク（優先度順）、深夜作業スコープなどの詳細は以下を参照してください。

- [`docs/PROJECT_KNOWLEDGE.md`](./docs/PROJECT_KNOWLEDGE.md)（オンボーディング用・全体ナレッジ）
- [`docs/SENTRY_SETUP.md`](./docs/SENTRY_SETUP.md)
- [`docs/CSP_NONCE_MIGRATION.md`](./docs/CSP_NONCE_MIGRATION.md)
- [`docs/PII_ENCRYPTION_MIGRATION.md`](./docs/PII_ENCRYPTION_MIGRATION.md)
- [`docs/CUSTOM_DOMAIN_SETUP.md`](./docs/CUSTOM_DOMAIN_SETUP.md)
- [`docs/GA4_SETUP.md`](./docs/GA4_SETUP.md)
- [`docs/SEO_RUNBOOK.md`](./docs/SEO_RUNBOOK.md)
- [`docs/CWV_SETUP.md`](./docs/CWV_SETUP.md)
- [`docs/LINE運用方針.md`](./docs/LINE運用方針.md)

---

## ライセンス

Proprietary. All rights reserved. NocoLde.
