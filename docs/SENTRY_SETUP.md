# Sentry エラーモニタリング セットアップ手順

> [Phase2-⑥] 本番環境のエラーを自動収集して可視化する。バグを「気づかず放置」を防ぐ。

---

## なぜ必要か

- 本番でユーザーがエラーに遭遇しても、しーちゃんが気づかない
- console.error は Vercel ログに流れるが、確認しないとわからない
- お客様がエラーを報告してくれるとは限らない（不便を感じて他店へ）

---

## セットアップ手順

### 1. Sentry アカウント作成（無料枠あり）

1. https://sentry.io/signup/ で登録
2. Organization 名・プロジェクト名を設定（例: `florix`）
3. プラットフォームは **Next.js** を選択

### 2. DSN を取得

1. プロジェクトページの「Settings → Client Keys (DSN)」を開く
2. `https://xxxxxx@oXXXXXX.ingest.sentry.io/XXXXXX` のような DSN をコピー

### 3. Vercel に環境変数を追加

Vercel ダッシュボード → プロジェクト → Settings → Environment Variables で以下を追加:

```
NEXT_PUBLIC_SENTRY_DSN = https://xxxxxx@oXXXXXX.ingest.sentry.io/XXXXXX
SENTRY_DSN = （上と同じ値）
```

両方とも Production / Preview / Development の全てにチェック。

### 4. npm パッケージをインストール

```bash
cd C:\Users\shior\flower-app
npm install @sentry/nextjs
```

### 5. 再デプロイ

```bash
git add -A
git commit -m "feat(monitoring): Sentry エラーモニタリング有効化"
git push
```

---

## ✅ 完了確認

1. Sentry ダッシュボードに `florix` プロジェクトが表示される
2. ブラウザのDevToolsで意図的にエラーを発生させる:
   ```js
   throw new Error('Test error from console')
   ```
3. 数分後、Sentry のダッシュボードにそのエラーが表示される

---

## PII（個人情報）保護

設定済みの `sentry.client.config.ts` / `sentry.server.config.ts` が以下を自動でマスクします:

- メールアドレス → `[email]`
- 電話番号 → `[phone]`
- リクエストヘッダーの認証情報・パスワード
- リクエストボディの `email`, `phone`, `customerName`, `pin` 等

**追加でマスクしたい項目がある場合は、両ファイルの `beforeSend` 内で追加できます。**

---

## サンプリング率

エラー数が多すぎてSentry無料枠を超えそうな場合、サンプリング率を下げる:

```ts
// sentry.client.config.ts
tracesSampleRate: 0.05, // 5% に下げる
```

---

## 通知設定（オプション）

Sentry の Alert → Rules で:
- 新しいエラーが発生したら **メール / Slack 通知**
- 1時間に5件以上発生したら **緊急通知**

など設定可能。
