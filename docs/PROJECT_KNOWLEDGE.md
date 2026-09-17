# FLORIX プロジェクトナレッジ

このドキュメントは Claude Projects の Knowledge や新規参加者へのオンボーディング用に、FLORIX（noodleflorix.com）の全体像・仕様・運用ルールをまとめたものです。実装時の判断基準・トーン・優先度を Claude が正しく再現できるよう、決定事項と背景をできるだけ具体的に残しています。

---

## 1. プロジェクト概要

### サービス概要
FLORIX（フローリックス）は、街の花屋さん向けの受注管理・EC・顧客管理を一体化した SaaS です。運営は「nocolde（ノコルデ）」オーナー。旧称は nocolde / noodle でしたが、対外的なブランド名は FLORIX に統一しています。

- 本番 URL: https://www.noodleflorix.com
- ドメイン: noodleflorix.com
- GitHub: shiorikougei/flower-system
- リポジトリのローカルパス: C:\Users\shior\flower-app

### 利用者
1. **お店（テナント／スタッフ）**
   - 花屋の店主・スタッフが日々の受注管理、配達管理、売上管理、顧客対応、EC 販売、ポートフォリオ・ブログ運用などに使用。
2. **お客様（エンドユーザー）**
   - 各店舗のショップページ（`/order/[tenantId]/[shopId]/shop`）から花束や供花、フラワーアレンジ、EC 商品を購入。マイページで注文履歴を確認可能。
3. **NocoLde オーナー（サービス提供者）**
   - `/owner` 配下でテナント管理、サブスクリプション管理、LP 設定、監査ログ確認等を実施。

### ビジネスモデル
- **月額サブスクリプション**：お店が FLORIX を利用するための月額課金。プランごとに機能・上限が変わり、超過分は追加料金またはアップグレード誘導。
- **Stripe Connect Standard**：各テナント（お店）が Stripe アカウントを OAuth 連携し、EC・見積・注文の決済は各店舗の Stripe アカウントに直接入金。プラットフォーム手数料はサブスクとは別で運用可能。
- 収益源はサブスク主体、決済プラットフォーム手数料は最小限に設定して花屋の負担を抑える方針。

---

## 2. 技術スタック

| 種別 | 採用技術 | バージョン |
| --- | --- | --- |
| Framework | Next.js（App Router, Turbopack） | 16.1.6 |
| UI | React | 19.2.3 |
| DB / Auth | Supabase (@supabase/supabase-js) | 2.99 系（PostgreSQL + RLS + Vault） |
| 決済 | Stripe（Connect Standard OAuth） | ^22.1.1 |
| メール送信 | Resend | ^6.12.3 |
| アイコン | lucide-react | ^0.577.0 |
| スタイリング | Tailwind CSS | - |
| エラー監視 | Sentry | ^10.57 |
| ホスティング | Vercel | - |
| 通知 | LINE Messaging API | - |

補足:
- SSR / RSC の恩恵を得つつ、印刷・複雑 UI は Client Component。
- Supabase Vault で `app.pii_encryption_key` を管理。フォールバック無し（未設定なら失敗）。
- Stripe は本番 `sk_live_` / テスト `sk_test_` を環境ごとに切り替え。

---

## 3. リポジトリ構造

```
flower-app/
├── app/
│   ├── page.tsx                        # LP（ランディングページ）
│   ├── order/[tenantId]/[shopId]/     # お客様向け（各店舗ごとに URL）
│   │   ├── shop/                       # 商品一覧
│   │   ├── cart/                       # カート
│   │   ├── custom/                     # カスタムオーダー（花束/アレンジ）
│   │   ├── estimate/                   # 見積依頼
│   │   ├── thanks/                     # 注文完了
│   │   ├── mypage/                     # マイページ
│   │   ├── history/                    # 注文履歴
│   │   └── faq/                        # よくある質問
│   ├── staff/                          # スタッフ管理画面
│   │   ├── orders/                     # 受注一覧（3タブ）
│   │   ├── new-order/                  # 代理入力
│   │   ├── settings/                   # 店舗設定
│   │   ├── sales/                      # 売上
│   │   ├── calendar/                   # カレンダー
│   │   ├── deliveries/                 # 配達管理
│   │   ├── products/                   # 商品管理
│   │   ├── portfolio/                  # 実績・写真
│   │   └── blog/                       # ブログ
│   ├── owner/                          # NocoLde オーナー画面
│   │   ├── （サブスク管理・テナント管理・LP 設定など）
│   ├── api/                            # API ルート
│   ├── blog/ category/ products/       # 公開ページ（EC / SEO）
│   └── corporate/                      # 法人向け（現状未使用）
├── components/                         # 共通 UI（OrderDetailModal.jsx, TatefudaPreview.jsx, UpgradeModal.jsx など）
├── utils/                              # email.js, adminAuth.js, rateLimit.js, stripe.js, staffRole.js など
├── migrations/                         # SQL マイグレーション
├── supabase/                           # RLS ポリシーなど
├── docs/                               # プロジェクトドキュメント（本ファイルを含む）
└── public/
```

---

## 4. 主要仕様（実装済み機能一覧・決定事項）

### 4.1 受注一覧の3タブ構成（業務-9）
- **未完了**: お渡し前のもの全部（入金状態問わず）。当日・翌日以降の予定を漏らさず把握。
- **未入金**: お渡し完了かつ未入金。集金漏れ防止。
- **アーカイブ**: お渡し完了かつ入金完了、またはキャンセル済み。

### 4.2 入金ステータスの独立化（業務-8）
- 作業ステータス（受注 → 制作 → 配達 → 片付）と入金ステータス（入金済 / 未入金）は完全独立。
- 店舗設定でテンプレ／カスタム切替可能。
  - `shop.paymentStatusConfig.type = 'template' | 'custom'`
  - `shop.paidStatuses` / `shop.unpaidSubStatuses`（カスタム時のみ有効）
- Stripe webhook のみ自動で「入金済（クレジットカード）」をセット。
- 手動変更は注文詳細モーダルの入金ステータスプルダウンから。

### 4.3 未入金サブステータスの店舗別カスタム（注文-7）
- 「引き取り時支払い」「請求書発行」「後日振込」などを店舗ごとに追加・並び替え可能。

### 4.4 受注書 A4 化（業務-7）
- **Page1**: 受注書。A4 フル、大文字タイトル、担当者記入欄 5 個。
- **Page2 上半分**: お客様控え。
- **Page2 下半分**: 左に納品書、右に受領書。
- 金額は横一列表示（商品代 / 送料 / 消費税 + 合計を強調）。
- 受領書は備考・カード情報を非表示にし、サイン欄を大きく確保。
- メッセージカード / 社内メモ / お客様備考など長文は文字数で自動縮小。

### 4.5 お客様備考（purposeNote）表示（業務-11）
- 注文詳細モーダルに青色ブロックで表示（用途・雰囲気などお客様の希望）。
- 受注書にも印刷して制作担当と共有。

### 4.6 商品バッジ（商品-1）
- `restock_allowed = false` かつ在庫 1 → 「一点物」バッジ
- `restock_allowed = false` かつ在庫 2 以上 → 「限定商品」バッジ
- 再入荷しない前提の商品を明示することで購入意欲を後押し。

### 4.7 スタッフ代理入力（業務-6）
- 店舗スタッフが電話・LINE 受注などをその場で入力できる `/staff/new-order`。
- 「済」「未入金」ボタンで直感的に登録（内部値は互換のため「前払い済み」「引き取り時に支払い」を維持）。

### 4.8 カード決済中のスタッフ通知（注文-6）
- 注文発生時のスタッフ通知に `staffCardPending` フラグを追加。
- お客様には「お支払いがまだ完了していません」ではなく「決済中です」と表示（不安を煽らない）。

### 4.9 その他の一般仕様
- 印刷帳票は老眼でも読める文字サイズを維持。
- 見積・EC・注文はすべて Stripe Connect 経由で店舗アカウントに入金。
- LINE 通知はスタッフ側に注文発生・キャンセル・完了などを配信。

---

## 5. 既知バグと修正履歴

### 5.1 修正済み
- **EC 注文の合計計算バグ**：送料 Stripe 抜け、箱代表示抜けを修正。`ecBoxFee` / `fee` / `pickup` を全計算で網羅。
- **見積依頼 `expires_at` カラム未追加**：マイグレーション実行済み。
- **OWASP ZAP スキャン失敗**：Action を v0.14.0 に更新して復旧。
- **サブスク管理表示エラー**：`hasBasePriceOverride` 未定義変数を修正。
- **new-order の React エラー**：IIFE を `useMemo` に変更して解消。
- **絵文字全削除（Phase 1〜4）**：業務書類・UI・ログの絵文字を lucide-react アイコンに置換。
- **Critical セキュリティ 6 件の即時対応**：
  1. `OWNER_PASSWORD` のハードコード削除
  2. `/api/estimates` GET/DELETE/PATCH に認証追加
  3. `/api/staff/lookup-customer` に認証追加
  4. `/api/owner/attendance-overview` に `requireOwner`
  5. Cron API を fail-close 化
  6. PII 暗号化キーのフォールバック削除

### 5.2 残っている既知の課題
セクション「6. 残タスク」を参照。

---

## 6. 残タスク（優先度順）

現在チャットでは `TaskCreate` / `TaskUpdate` により #1〜#120 のタスクを管理中。深夜タスクとして残っているものを優先度順に整理。

### 優先度: 最高（金銭・セキュリティ直撃）
1. **#108 送料 ¥0 ガード**：配達エリアなのに送料 0 円で決済されるリスク。サーバー側で検証。
2. **#113 correct-amount のロール検証**：クライアント側だけでなくサーバー側でロール検証。
3. **#114 `/api/admin/auto-upgrade` owner ロール限定**：現状は認可不十分。
4. **customer_* テーブル RLS**：現状 RLS が不足しているテーブルの補完。
5. **`err.message` 直返却で DB スキーマ漏洩（40+ 件）**：本番はサニタイズして返す。
6. **webhook idempotency 不完全**：`event.id` の一意性チェックを堅牢化。
7. **`charge.refunded` 部分返金対応**：全額返金前提のロジックを見直し。
8. **Stripe `checkout.session.expired` ハンドリング**：セッション切れ時の在庫戻し・状態遷移。

### 優先度: 高（PII / XSS / SSRF）
9. **#115 メール XSS escape 漏れ 4 件**：Resend HTML テンプレの変数展開を全チェック。
10. **#117〜#119 portfolio/extract-from-url の SSRF**：URL 制限・IP レンジ排除。
11. **customer-login IP レート制限なし**：ブルートフォース対策。
12. **audit_log の staffName 偽装可能**：サーバー側でセッションから確定。
13. **audit_log を danger-clear で消せる**：削除禁止化 or 論理削除に変更。
14. **CSP の `unsafe-inline` / `unsafe-eval`**：nonce ベースへ移行（`docs/CSP_NONCE_MIGRATION.md` 参照）。

### 優先度: 中（運用品質）
15. **完成写真削除で `reload` → state 更新に変更**。
16. **LINE 送信失敗の検知**：エラーハンドリング & Sentry 連携。
17. **メール送信 fire-and-forget の再送 UI**：`emails_log` テーブルを追加し失敗を可視化。
18. **見積期限切れ自動マーク時の顧客通知**：期限切れになった旨をメール。
19. **印刷 CardTemplate 未知 `cardType` で React エラー**：デフォルトフォールバック。
20. **印刷お供え伝票の「祝」ハードコード**：用途に合わせて動的化。

### 優先度: 中（業務要望）
21. **納品書 QR コード**：受領確認をスマホから。
22. **見積参考写真**：見積依頼時にお客様がイメージ写真を添付。
23. **見積承諾フロー刷新**：承諾 → 決済までのフローを一本化。

### 優先度: 低（監視ノイズ）
24. **Sentry の外部要因ノイズフィルタ**：`AbortError`、Instagram、LINE の "Failed to load" を除外。

---

## 7. 環境変数・シークレット

Vercel 本番環境で設定必須の環境変数。

| 変数名 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key（クライアント） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role（サーバーのみ） |
| `STRIPE_SECRET_KEY` | Stripe シークレット（`sk_live_` / `sk_test_`） |
| `STRIPE_PUBLISHABLE_KEY` | Stripe パブリッシャブル |
| `STRIPE_CLIENT_ID` | Stripe Connect OAuth Client ID |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名検証キー |
| `RESEND_API_KEY` | Resend API キー |
| `EMAIL_FROM` | 送信元メール（`order@noodleflorix.com`） |
| `OWNER_PASSWORD` | オーナーログイン用パスワード（2026 年 7 月設定済み） |
| `CRON_SECRET` | Vercel Cron Job の認可トークン（2026 年 7 月設定済み） |

### Supabase Vault
- `app.pii_encryption_key`：PII 暗号化キー。**未設定時のフォールバックは無し（絶対にコードで既定値を入れない）**。

### 運用ルール
- シークレットはリポジトリにコミット禁止。
- 本番 / テストの Stripe キーを取り違えないよう Vercel の環境（Production / Preview / Development）を明確に分離。
- ローテーションが発生したら `docs/PII_ENCRYPTION_MIGRATION.md` の手順に従う。

---

## 8. コーディング規約

### 8.1 UI / トーン
- **絵文字は使わない**（業務書類・UI）。アイコンは lucide-react で表現。
  - 例外: メール HTML テンプレート文字列内の絵文字は Phase 5 対応まで許容。
  - `console.log` / `warn` / `error` 内の絵文字は削除。
- お客様に見える文言は丁寧な日本語（不安を煽らない・断定的すぎない）。
- スタッフに見える内部情報は簡潔で OK。

### 8.2 デザイントークン
- ブランドカラー
  - `#2D4B3E`（深緑・ブランド色）
  - `#117768`（サブ緑）
  - `#D97D54`（オレンジ・警告）
- フォント
  - `Shippori Mincho`（明朝・LP 用）
  - `Zen Kaku Gothic New`（ゴシック・本文）
  - `Outfit`（英字）
- タイトルは「フチナシ大文字」を基本形式に採用（例：`受 注 書`、`letter-spacing: 0.3〜0.4em`）。

### 8.3 実装ルール
- **lucide-react** のインポートは既存の `import` 行に追加。重複禁止。
- `err.message` を UI / API レスポンスにそのまま返さない（スキーマ漏洩防止）。
- API ルートには必ず認証・認可を実装。特に `staff` / `owner` は `requireStaff` / `requireOwner` を通す。
- Stripe / Resend / LINE などの外部通信は fire-and-forget にせず、失敗を検知して `emails_log` などに残せる形が望ましい。
- SQL マイグレーションは `migrations/` に日付付きファイルで追加。RLS は `supabase/` にポリシーとしてまとめる。

### 8.4 タスク管理
- Claude チャット内の `TaskCreate` / `TaskUpdate` で #1〜#120 のタスクを管理中。
- 完了時は必ずタスクをクローズ。関連 PR / コミットへの言及を残す。

---

## 9. お客様・お店への配慮事項

### 9.1 料金トラブル防止
- 料金トラブルは致命的。**過剰なくらい防御**する方針。
  - 例: 送料 0 円ガード、返金部分対応、Stripe セッション期限、二重決済の抑制。
- 決済フローの変更は**必ず Stripe テストモードで E2E 検証してから本番反映**。
- 合計金額の計算は必ず全費目（商品代・送料・箱代・消費税など）を網羅。

### 9.2 UX
- お客様に見える文言は「決済中です」「まもなくお届け予定です」など、状況を優しく伝える表現を優先。
- 印刷書類は老眼でも読める文字サイズ。長文は自動縮小で崩れないようにする。
- スタッフ画面は「済 / 未入金」など短いラベルで素早い操作を可能に。

### 9.3 業務書類ポリシー
- 業務書類（受注書 / 納品書 / 受領書 / 立札 / お供え伝票）に絵文字は使わない。
- 立札・お供え伝票は用途に応じて文言を動的化する（「祝」等のハードコードは避ける）。

### 9.4 セキュリティ
- PII は Supabase Vault のキーで暗号化。フォールバック禁止。
- customer_* テーブルは RLS を厳格に。
- 監査ログ（audit_log）は改ざん・削除ができない設計に。

---

## 10. 深夜作業スコープ

深夜バッチ / 深夜メンテナンスで実施することがある作業を明示。日中の営業時間帯は極力避ける。

### 10.1 対象作業
- Stripe / Supabase の設定変更、キーローテーション。
- SQL マイグレーション（テーブル追加・カラム追加・RLS ポリシー変更）。
- Vercel 環境変数の変更、再デプロイ。
- Sentry 設定変更・アラート閾値変更。
- OWASP ZAP スキャン結果を踏まえたセキュリティ修正。
- 未対応セキュリティタスク（セクション 6 の優先度: 最高／高）。

### 10.2 実施ルール
- 事前に「本日この作業を実施します」と関係者へ通知（お店に影響が出る可能性がある場合）。
- Stripe 決済系の変更は**テストモードで E2E → 本番反映 → 本番でスモークテスト**の 3 段階を厳守。
- SQL マイグレーションは**必ずロールバック手順を用意**。危険な操作前にはバックアップを取る。
- 深夜作業後は Sentry ダッシュボードと Vercel ログを最低 30 分監視。
- 翌朝、お店から問い合わせが来る可能性を想定してレスポンス体制を整える。

### 10.3 デプロイフロー
- `git push main` で Vercel が自動デプロイ。
- 手動でロールバックしたい場合は Vercel Dashboard から Redeploy（前バージョンを指定）。
- OWASP ZAP は月 1 回、毎月 1 日 JST 12:00 に自動実行。結果は GitHub Actions のログを確認。

---

## 参考ドキュメント

- `docs/SENTRY_SETUP.md`
- `docs/CSP_NONCE_MIGRATION.md`
- `docs/PII_ENCRYPTION_MIGRATION.md`
- `docs/CUSTOM_DOMAIN_SETUP.md`
- `docs/GA4_SETUP.md`
- `docs/SEO_RUNBOOK.md`
- `docs/CWV_SETUP.md`
- `docs/LINE運用方針.md`
- `docs/PHASE2_TEST_CHECKLIST.md`
