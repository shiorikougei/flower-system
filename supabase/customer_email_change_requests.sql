-- ===============================================================
-- 顧客メールアドレス変更リクエスト
-- ---------------------------------------------------------------
-- マイページで「メアド変更」をリクエストすると、
-- 新メアド宛に確認メールが送られ、リンクをクリックすると切り替わる
--
-- セキュリティ:
--   - 新メアドの所有確認（クリックされた = 本人）
--   - 旧メアドにも「変更されました」通知（不正検知）
--   - 有効期限 24時間
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.customer_email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  tenant_id text NOT NULL,
  old_email text NOT NULL,
  new_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_change_token
  ON public.customer_email_change_requests(token);

CREATE INDEX IF NOT EXISTS idx_email_change_tenant_old
  ON public.customer_email_change_requests(tenant_id, old_email);

ALTER TABLE public.customer_email_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_change_service_role_all" ON public.customer_email_change_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
