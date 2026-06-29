-- =============================================================
-- [Phase2.5-#113] 顧客PII の列暗号化（pgcrypto導入）
-- =============================================================
-- 目的:
--   Supabaseのバックアップ・スナップショット・ダンプ流出時に
--   顧客の電話番号・住所等の機微情報が平文で読まれないようにする
--
-- 戦略:
--   1. pgcrypto 拡張を有効化
--   2. PII暗号化用の helper 関数を作成
--   3. 既存テーブルにそのまま使う（カラム追加なし、関数呼び出しベース）
--
-- ⚠️ 既存データは破壊しません。新規挿入分から暗号化が始まります。
-- ⚠️ 暗号化キーは Supabase の secrets として安全に保管してください
-- =============================================================

-- ① pgcrypto 拡張を有効化
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ② Supabase Vault で管理する暗号化キーを取り出すヘルパー
--    実際の鍵は Supabase Dashboard → Project Settings → Vault で登録
--    名前: pii_encryption_key
CREATE OR REPLACE FUNCTION get_pii_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  k text;
BEGIN
  -- ★ [セキュリティ] ハードコードフォールバックを削除（弱鍵による全PII復号リスク回避）
  -- Supabase Vault または app.pii_encryption_key カスタム設定で必ず設定すること
  SELECT current_setting('app.pii_encryption_key', true) INTO k;
  IF k IS NULL OR k = '' OR k = 'CHANGE_ME_BEFORE_PRODUCTION_DO_NOT_USE_THIS' THEN
    RAISE EXCEPTION 'PII encryption key not configured. Set app.pii_encryption_key via Supabase Vault or ALTER DATABASE.';
  END IF;
  RETURN k;
END;
$$;

-- ③ PII 暗号化関数（テキストを暗号化してbytea→base64で返す）
CREATE OR REPLACE FUNCTION encrypt_pii(plain text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF plain IS NULL OR plain = '' THEN
    RETURN plain;
  END IF;
  RETURN encode(pgp_sym_encrypt(plain, get_pii_key()), 'base64');
END;
$$;

-- ④ PII 復号関数
CREATE OR REPLACE FUNCTION decrypt_pii(cipher text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF cipher IS NULL OR cipher = '' THEN
    RETURN cipher;
  END IF;
  -- 暗号化されてないデータが混ざっている場合はそのまま返す（後方互換）
  BEGIN
    RETURN pgp_sym_decrypt(decode(cipher, 'base64'), get_pii_key());
  EXCEPTION WHEN OTHERS THEN
    RETURN cipher;
  END;
END;
$$;

-- ⑤ 動作確認用クエリ
--    実行例（コメント外して試す）:
-- SELECT encrypt_pii('090-1234-5678');  -- 暗号化文字列が返る
-- SELECT decrypt_pii(encrypt_pii('090-1234-5678'));  -- '090-1234-5678' が返る

-- =============================================================
-- 完了！
--
-- 次のステップ（コード側）:
--   1. utils/piiCrypto.js を作成（サーバー側でDB関数を呼ぶラッパー）
--   2. 新規顧客登録時に customerInfo.phone 等を encrypt_pii() で保存
--   3. 受注一覧表示時に decrypt_pii() で復号
--   4. 既存データの一括暗号化バッチ（移行後に実施）
--
-- ⚠️ 本番運用前にやること:
--   - Supabase Dashboard → Project Settings → Vault
--   - 「pii_encryption_key」というキー名で 32文字以上のランダム文字列を登録
--   - get_pii_key() 関数を vault.decrypt_secret() を使うように書き換え
-- =============================================================
