-- ===============================================================
-- 顧客のLINEユーザーIDとメールアドレスの紐付け
-- ---------------------------------------------------------------
-- お客様が店舗のLINE公式アカウントを友達追加して
-- 「メールアドレス○○です」と送信すると、自動でリンクされる
--
-- これにより、注文通知/完成写真/入金確認等を「メール + LINE」両方で送れる
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.customer_line_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  line_user_id text NOT NULL,          -- LINEから付与される識別子
  customer_email text NOT NULL,        -- 紐付けたメールアドレス
  display_name text,                   -- LINEプロフィール名（参考保存）
  is_active boolean NOT NULL DEFAULT true,  -- ブロックされたら false
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, line_user_id)
);

CREATE INDEX IF NOT EXISTS idx_line_links_tenant_email
  ON public.customer_line_links(tenant_id, customer_email);

CREATE INDEX IF NOT EXISTS idx_line_links_active
  ON public.customer_line_links(tenant_id, is_active);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION public.update_line_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS line_links_updated_at ON public.customer_line_links;
CREATE TRIGGER line_links_updated_at
  BEFORE UPDATE ON public.customer_line_links
  FOR EACH ROW EXECUTE FUNCTION public.update_line_links_updated_at();

-- RLS: service_role からのみ操作可
ALTER TABLE public.customer_line_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "line_links_service_role_all" ON public.customer_line_links
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
