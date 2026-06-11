# [SEO-#18] Core Web Vitals 計測セットアップ

## 1. パッケージインストール（しーちゃん作業・1分）

```powershell
cd C:\Users\shior\flower-app
npm install web-vitals --save
```

> ⚠️ もしSSL証明書エラーが出たら:
> ```powershell
> $env:NODE_OPTIONS="--use-system-ca"
> npm install web-vitals --save
> ```

## 2. デプロイ

GitHubにpushすればVercelが自動デプロイ。
完了後、サイトを開いて F12 → コンソール で gtag イベントが飛んでるか確認可能。

## 3. GA4で確認（48時間後）

GA4 → 「レポート → エンゲージメント → イベント」
- `LCP`（Largest Contentful Paint）
- `INP`（Interaction to Next Paint）
- `CLS`（Cumulative Layout Shift）
- `FCP`（First Contentful Paint）
- `TTFB`（Time to First Byte）

の5つが計測されるようになります。

## 4. 目標値（Google基準）

| 指標 | Good | Needs Improvement | Poor |
|------|------|--------------------|------|
| LCP | < 2.5s | 2.5s〜4.0s | > 4.0s |
| INP | < 200ms | 200ms〜500ms | > 500ms |
| CLS | < 0.1 | 0.1〜0.25 | > 0.25 |

## 5. PageSpeed Insightsで詳細分析

https://pagespeed.web.dev/ にサイトURLを入力 → 改善点が具体的に出る。

主要URLをチェック:
- https://www.noodleflorix.com/
- https://www.noodleflorix.com/order/[テナントID]/[shopID]
- https://www.noodleflorix.com/products/[テナントID]/[商品ID]
