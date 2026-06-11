# [Phase2.5-#113] PII 列暗号化 移行手順

## 目的

顧客の電話番号・住所・メールアドレス等の機微情報を、DB流出時にも読めない形で保管する。

---

## セットアップ手順

### Step 1: SQL マイグレーション実行

1. Supabase Dashboard → **SQL Editor**
2. `migrations/add_pii_encryption.sql` の内容をコピペ
3. **Run** をクリック
4. `CREATE EXTENSION` `CREATE FUNCTION` が成功する

### Step 2: 暗号化キーを Supabase Vault に登録

⚠️ **本番稼働前に必ず実施。**

1. Supabase Dashboard → **Project Settings** → **Vault**
2. 「**Add new secret**」をクリック
3. 名前: `pii_encryption_key`
4. 値: 32文字以上のランダム文字列（例: `openssl rand -base64 48`）
5. 保存

### Step 3: get_pii_key 関数を Vault 連動に書き換え

Supabase SQL Editor で以下を実行:

```sql
CREATE OR REPLACE FUNCTION get_pii_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k text;
BEGIN
  -- Vault から鍵を取得
  SELECT decrypted_secret INTO k
  FROM vault.decrypted_secrets
  WHERE name = 'pii_encryption_key'
  LIMIT 1;

  IF k IS NULL OR k = '' THEN
    RAISE EXCEPTION 'PII encryption key not configured';
  END IF;

  RETURN k;
END;
$$;
```

### Step 4: 動作確認

SQL Editor で:

```sql
-- 暗号化テスト
SELECT encrypt_pii('090-1234-5678');
-- 結果例: 'wcBNAxYAAAAA...'

-- 復号テスト
SELECT decrypt_pii(encrypt_pii('090-1234-5678'));
-- 結果: '090-1234-5678'
```

---

## アプリケーション側の移行

### 段階的アプローチ（推奨）

#### Phase A: 新規データのみ暗号化（後方互換）

1. `app/api/orders/route.js` でCustomer情報を保存する直前に暗号化:

```js
import { encryptPiiObject } from '@/utils/piiCrypto';

// 既存の orderData.customerInfo をそのまま使う代わりに:
const encryptedCustomerInfo = await encryptPiiObject(supabaseAdmin, orderData.customerInfo);
const orderRecord = {
  ...
  order_data: {
    ...orderData,
    customerInfo: encryptedCustomerInfo,
  },
};
```

2. 読み取り時に復号:

```js
import { decryptPiiObject } from '@/utils/piiCrypto';

// 受注一覧取得後:
for (const order of orders) {
  order.order_data.customerInfo = await decryptPiiObject(supabaseAdmin, order.order_data.customerInfo);
}
```

3. 復号関数は **失敗時に元の値をそのまま返す** ので、既存の平文データも読める

#### Phase B: 既存データの一括暗号化（運用が安定したら）

```sql
-- 既存の全注文の電話番号を暗号化
UPDATE orders
SET order_data = jsonb_set(
  order_data,
  '{customerInfo,phone}',
  to_jsonb(encrypt_pii(order_data->'customerInfo'->>'phone'))
)
WHERE order_data->'customerInfo'->>'phone' IS NOT NULL
  AND length(order_data->'customerInfo'->>'phone') < 50;  -- すでに暗号化済みは除外
```

⚠️ 必ずバックアップを取ってから実施。

---

## 移行を進める際の注意点

- **検索機能との互換性**: 暗号化したフィールドで LIKE 検索はできなくなる
  - 対策: 検索用に正規化したハッシュ列を別途持つ
- **インデックス**: 暗号化済みカラムにインデックスを張っても効果なし
- **パフォーマンス**: 暗号化/復号はCPUを使うので、一覧表示時の影響を計測
- **鍵ローテーション**: 年1回程度の鍵交換手順を用意

---

## 推奨実行タイミング

1. **すぐ**: Step 1〜4 のセットアップ完了
2. **1〜2週**: Phase A（新規データのみ暗号化）を実装
3. **運用安定後（1〜2ヶ月後）**: Phase B（既存データ一括暗号化）

新機能追加（Phase 3）と並行で進めてOK。
