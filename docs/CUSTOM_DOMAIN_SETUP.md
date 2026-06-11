# 独自ドメイン セットアップ手順（店舗オーナー向け）

> [SEO-#7] 各店舗が独自ドメイン（例: `ohanaflowershop.com`）で運営できる仕組み

## 全体の流れ

```
[店舗オーナー] 独自ドメインを購入
       ↓
[しーちゃん] Vercelプロジェクトにドメイン追加
       ↓
[店舗オーナー] DNS設定（Aレコード or CNAME）
       ↓
[しーちゃん] CUSTOM_DOMAIN_MAP に追加 + デプロイ
       ↓
✅ https://ohanaflowershop.com から店舗ページ表示
```

---

## Step 1: ドメイン購入（店舗オーナー）

お名前.com / Google Domains / ムームードメイン などで購入。

**おすすめ命名:**
- 店舗名そのまま: `ohanaohana.com`
- 店舗名+地名: `hanahana-sapporo.com`
- .jp/.co.jp は信頼性高い（少し高い）

**避けるべき:**
- ハイフン多すぎる名前
- 数字混じり
- 紛らわしい綴り

## Step 2: Vercel にドメイン追加（しーちゃんの作業）

1. Vercel ダッシュボード → flower-system プロジェクト
2. **Settings** → **Domains**
3. **Add Domain** → 購入したドメイン入力（例: `ohanaflowershop.com`）
4. Vercel が DNS設定の指示を表示する → 店舗オーナーに伝える

## Step 3: DNS 設定（店舗オーナー）

ドメインを購入したサービス（お名前.com 等）の管理画面で:

### Aレコード方式（推奨）
```
タイプ: A
ホスト名: @
値: 76.76.21.21
TTL: 3600
```

### www. も使う場合（推奨）
```
タイプ: CNAME
ホスト名: www
値: cname.vercel-dns.com
TTL: 3600
```

設定後、**反映まで最大24時間**（通常は1〜2時間）。

## Step 4: 店舗マッピング登録（しーちゃんの作業）

Vercel ダッシュボード → **Settings** → **Environment Variables** で:

```
CUSTOM_DOMAIN_MAP = {"ohanaflowershop.com":{"tenantId":"令真商事","shopId":"1"},"hanahana-sapporo.com":{"tenantId":"七社商事","shopId":"2"}}
```

複数店舗の場合はJSONをそのまま伸ばす。

**変更後は再デプロイ必須:**
- Vercel → Deployments → 最新の「・・・」 → Redeploy

## Step 5: 動作確認

```
https://ohanaflowershop.com/          → 店舗トップページ表示 ✅
https://ohanaflowershop.com/shop      → EC商品一覧 ✅
https://ohanaflowershop.com/products/[id] → 商品個別ページ ✅
https://ohanaflowershop.com/staff     → リライトされずスタッフ画面 ✅
```

---

## ⚠️ 注意点

### HTTPS証明書
- Vercel が自動で **Let's Encrypt 証明書を発行**
- 設定後 5〜10分で有効化

### SEO 影響
- 既存の noodleflorix.com/order/... のURLは引き続き機能
- canonical タグを **独自ドメイン側** に設定しておくと SEOで分散リスク回避
  - `app/order/[tenantId]/[shopId]/layout.jsx` の `alternates.canonical` を独自ドメインに変更

### メール送信
- Resend 等の送信元 `from` アドレスは noodleflorix.com のまま
- 将来的に各店舗が独自ドメインでメール送信したい場合は、Resend で **Verified Domain** を追加

### 料金
- Vercel のドメイン追加は **無料**（Vercel Pro プランの場合は無制限）
- Hobby プランの場合は ドメイン数に制限あり → Pro 推奨

---

## 既存テナントの自動マッピング機能（将来対応）

現状は環境変数で手動マッピング。将来は:

1. 設定画面で店舗オーナーが「独自ドメイン」欄に入力
2. Supabase の app_settings に保存
3. Middleware が DB から取得して動的にリライト

実装は **Phase 4 の技術的負債整理** と合わせて検討。

---

## トラブルシューティング

### 「DNS_PROBE_FINISHED_NXDOMAIN」エラー
→ DNS設定がまだ反映されていない。1〜2時間待つ

### 「This Domain is being used by another team」
→ Vercel の別プロジェクトで使われている。先方に解放を依頼

### Vercel に「Invalid Configuration」
→ DNS設定が間違っている。お名前.com の管理画面を再確認
