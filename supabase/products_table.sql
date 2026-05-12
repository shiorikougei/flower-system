-- ===============================================================
-- EC機能用 products テーブル
-- ---------------------------------------------------------------
-- 使い方:
--   Supabase ダッシュボード → SQL Editor → 貼り付け → Run
-- ===============================================================


-- ----------------------------------------------------------------
-- 1) products テーブル作成
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  shop_id text,                                 -- 店舗単位で出し分けたい場合に使用（NULLで全店舗共通）
  name text NOT NULL,
  description text,
  price integer NOT NULL,                       -- 税抜き、円
  image_url text,
  stock integer NOT NULL DEFAULT 0,             -- 在庫数
  is_active boolean NOT NULL DEFAULT true,      -- 販売中フラグ（一時停止用）
  category text,                                -- 任意のカテゴリ名
  display_order integer NOT NULL DEFAULT 0,     -- 並び順
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON public.products(tenant_id, is_active);


-- ----------------------------------------------------------------
-- 2) updated_at の自動更新トリガー
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_updated_at();


-- ----------------------------------------------------------------
-- 3) RLS（マルチテナント分離）
-- ----------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 公開: お客様向け商品カタログのため、is_activeかつstock>0の商品は誰でも閲覧可
-- ※ anon, authenticated 両方からアクセス可
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT
  USING (is_active = true AND stock > 0);

-- スタッフ: 自分のテナントの全商品（非公開・在庫切れ含む）を閲覧可
CREATE POLICY "products_staff_read_all" ON public.products
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- スタッフ: 自分のテナントの商品のみ作成可
CREATE POLICY "products_staff_insert" ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- スタッフ: 自分のテナントの商品のみ更新可
CREATE POLICY "products_staff_update" ON public.products
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- スタッフ: 自分のテナントの商品のみ削除可
CREATE POLICY "products_staff_delete" ON public.products
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());


-- ----------------------------------------------------------------
-- 4) Storage バケット (products用) のポリシー（既存のportfolioバケットを流用OK）
-- ----------------------------------------------------------------
-- Supabase の Storage で 'portfolio' バケットの下に 'products/' プレフィックス
-- でファイルを置く前提で、portfolio バケットのRLSポリシー（rls_policies.sql に追加済み）
-- がそのまま使える。


-- ----------------------------------------------------------------
-- 5) 動作確認用
-- ----------------------------------------------------------------
-- 自分のテナントの商品を確認
--   SELECT * FROM public.products WHERE tenant_id = public.current_tenant_id();
--
-- 公開状態の商品を確認（在庫あり・販売中のみ）
--   SELECT * FROM public.products WHERE is_active = true AND stock > 0;
