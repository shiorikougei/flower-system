-- ===============================================================
-- 顧客マイページ用 パスワード認証テーブル
-- ---------------------------------------------------------------
-- 任意設定。Magic Link でログイン後、お客様が希望すればパスワードを設定可能。
-- 設定後は「メアド + パスワード」でログインできるようになる。
-- パスワードを忘れた場合は Magic Link でリセット可能（既存の customer_magiclink を流用）。
--
-- セキュリティ:
--   - bcrypt でハッシュ化して保存（生パスワードは保存しない）
--   - tenant_id + email でユニーク
--   - 失敗回数を記録（ブルートフォース対策）
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.customer_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,           -- 5回失敗で30分ロック
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_credentials_tenant_email
  ON public.customer_credentials(tenant_id, email);

CREATE OR REPLACE FUNCTION public.update_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credentials_updated_at ON public.customer_credentials;
CREATE TRIGGER credentials_updated_at
  BEFORE UPDATE ON public.customer_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_credentials_updated_at();

-- RLS: service_role からのみ操作可
ALTER TABLE public.customer_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credentials_service_role_all" ON public.customer_credentials
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
