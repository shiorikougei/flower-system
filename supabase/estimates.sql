-- ===============================================================
-- 見積依頼テーブル
-- お客様：見積依頼を出す → 店舗：回答 → お客様：承諾で正式注文に変換
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  shop_id text,
  -- お客様情報
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  -- 見積内容（自由記述+構造化）
  request_content text NOT NULL,       -- 例「赤いバラ12本、ピンク混ぜて、明日17時受取」
  request_data jsonb,                  -- 構造化（flowerType, color, quantity, deadline等）
  reference_images text[],             -- 参考画像URL（任意）
  -- 店舗回答
  reply_message text,                  -- 店舗からのメッセージ
  proposed_price integer,              -- 提案価格（税抜）
  proposed_data jsonb,                 -- 詳細（feeBreakdown等）
  replied_at timestamptz,
  -- ステータス
  status text NOT NULL DEFAULT 'pending',  -- pending|replied|accepted|rejected|converted
  -- 確定後の注文ID（converted時に紐付け）
  order_id uuid,
  -- メタ
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_tenant ON public.estimates(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_email ON public.estimates(tenant_id, customer_email);

CREATE OR REPLACE FUNCTION public.update_estimates_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estimates_updated_at ON public.estimates;
CREATE TRIGGER estimates_updated_at BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_estimates_updated_at();

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

-- API 経由のみ（service_role）
CREATE POLICY "estimates_service_role_all" ON public.estimates
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
