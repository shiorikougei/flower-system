-- ===============================================================
-- products テーブルに box_size カラム追加（EC箱代計算用）
-- ===============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS box_size text;

-- 既存商品はデフォルトで M
UPDATE public.products SET box_size = 'M' WHERE box_size IS NULL;

-- インデックス（任意）
CREATE INDEX IF NOT EXISTS idx_products_box_size ON public.products(tenant_id, box_size);
