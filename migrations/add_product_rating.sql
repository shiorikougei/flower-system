-- =============================================================
-- [SEO-#10] AggregateRating（星評価）対応のための列追加
-- =============================================================
-- 商品テーブルに rating_value（平均評価1〜5）と
-- rating_count（レビュー件数）を追加
--
-- 実行手順:
--   Supabase Dashboard → SQL Editor → 下記をコピペ → Run
--
-- ⚠️ 既存データは変更しません（カラム追加のみ）
-- =============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS rating_value NUMERIC(2, 1),
  ADD COLUMN IF NOT EXISTS rating_count INTEGER;

-- 制約: rating_value は 1.0〜5.0 のみ
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_rating_value_range;
ALTER TABLE products
  ADD CONSTRAINT products_rating_value_range
  CHECK (rating_value IS NULL OR (rating_value >= 1.0 AND rating_value <= 5.0));

-- 制約: rating_count は 0以上
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_rating_count_positive;
ALTER TABLE products
  ADD CONSTRAINT products_rating_count_positive
  CHECK (rating_count IS NULL OR rating_count >= 0);

COMMENT ON COLUMN products.rating_value IS '平均評価（1.0〜5.0）。SEOのAggregateRatingに使用';
COMMENT ON COLUMN products.rating_count IS 'レビュー件数。SEOのAggregateRatingに使用';

-- =============================================================
-- 完了！商品管理画面の星評価セクションで入力できるようになります
-- =============================================================
