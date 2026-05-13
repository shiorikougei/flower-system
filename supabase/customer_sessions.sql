-- ===============================================================
-- 顧客向け Magic Link セッション管理テーブル
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.customer_sessions (
  token text PRIMARY KEY,
  tenant_id text NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_email ON public.customer_sessions(email);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires ON public.customer_sessions(expires_at);


-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;

-- 公開からはアクセス不可（API Routes 経由のService Roleでのみ操作）
-- 何もポリシーを作らないことで anon/authenticated からのアクセスを全部塞ぐ


-- ----------------------------------------------------------------
-- 期限切れトークンの自動クリーンアップ（任意）
-- ----------------------------------------------------------------
-- 必要なら Supabase Scheduled Functions で定期的に削除:
--   DELETE FROM public.customer_sessions WHERE expires_at < now();
