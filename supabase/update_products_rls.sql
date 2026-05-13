-- ===============================================================
-- products テーブルの公開SELECT ポリシーを更新
-- 在庫切れ商品もお客様に見えるようにする（入荷通知機能のため）
-- ===============================================================

DROP POLICY IF EXISTS "products_public_read" ON public.products;

CREATE POLICY "products_public_read" ON public.products
  FOR SELECT
  USING (is_active = true);
