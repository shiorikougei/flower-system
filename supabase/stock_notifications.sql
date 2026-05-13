-- ===============================================================
-- 在庫切れ入荷通知 用テーブル
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.stock_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email text NOT NULL,
  customer_name text,
  notified_at timestamptz,        -- 通知メール送信日時
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, email)       -- 同じ商品・同じメアドの重複登録防止
);

CREATE INDEX IF NOT EXISTS idx_stock_notifications_product ON public.stock_notifications(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_notifications_pending ON public.stock_notifications(product_id) WHERE notified_at IS NULL;


-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
ALTER TABLE public.stock_notifications ENABLE ROW LEVEL SECURITY;

-- 公開: 誰でも登録できる（お客様が在庫切れ商品に対して通知登録）
CREATE POLICY "stock_notif_public_insert" ON public.stock_notifications
  FOR INSERT
  WITH CHECK (true);

-- スタッフ: 自分のテナントの通知登録一覧を見れる
CREATE POLICY "stock_notif_staff_read" ON public.stock_notifications
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- スタッフ: 自分のテナントの登録を削除可能
CREATE POLICY "stock_notif_staff_delete" ON public.stock_notifications
  FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- システム（Service Role）が notified_at を更新する想定なのでスタッフUPDATE不要
