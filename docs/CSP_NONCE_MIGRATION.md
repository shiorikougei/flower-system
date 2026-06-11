# [Phase2.5-#116] CSP nonce 移行ロードマップ

## 現状

`middleware.ts` でリクエストごとに `x-nonce` ヘッダーに base64 ナンスを生成済み。  
ただし `next.config.ts` の CSP では未だ `'unsafe-inline'` `'unsafe-eval'` を許可しているため、**実質的な XSS 防御効果は次のステップでのみ発現する**。

## 段階的移行プラン

### Step 1（現状）✅
- middleware で nonce 生成
- レスポンスヘッダ `x-nonce` に格納
- next.config.ts の CSP は変更せず（unsafe-inline 残存）

### Step 2（次の改善）
1. `app/layout.tsx` で `headers()` から `x-nonce` を読み取る
2. `<Script nonce={nonce}>` で Next.js が自動挿入するスクリプトを保護
3. 既存の `<script>` タグに `nonce={nonce}` を付与（OrderDetailModal の印刷ウィンドウ等）

### Step 3（最終形）
1. `next.config.ts` の CSP から:
   - `script-src` から `'unsafe-inline' 'unsafe-eval'` を削除
   - `style-src` から `'unsafe-inline'` を削除
2. 代わりに `'nonce-XXX'` を動的に挿入する仕組みに切替
   - これは静的 CSP では実現できないため、CSP も middleware で動的に設定する必要あり
3. 影響範囲を本番でテスト（ステージング環境推奨）

## 既知の制約

- **Stripe 決済 UI**: Stripe.js は CSP nonce を必要とする場合あり → Stripeドキュメント参照
- **Google Fonts**: `style-src 'unsafe-inline'` が必要なケースあり → CSS変数化で回避
- **インラインstyle属性**: Tailwind の動的クラスは問題なし、`style="..."` 属性は要見直し

## 検証方法

実装後、ブラウザ DevTools の Console で CSP 違反警告がないことを確認:
```
[Report Only] Refused to execute inline script because it violates the following Content Security Policy directive:
```

## 推奨実行タイミング

- 現状(Step 1)は **準備段階**
- Step 2 / 3 の実装は **#119〜#125 (Phase 3) と並行して、新機能追加のついで** に少しずつ進める
- 重要な販促期（年末年始など）の直前は避ける

## 参考

- [Next.js CSP Documentation](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
