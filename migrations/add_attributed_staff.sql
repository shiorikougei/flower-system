-- [業務-3] 担当者個人受付の記録 + 売上分析用
-- orders に attributed_staff_id を追加

-- 既存テーブルへのカラム追加（冪等）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'attributed_staff_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN attributed_staff_id TEXT;
    COMMENT ON COLUMN orders.attributed_staff_id IS '注文を受けた担当者ID（settings_data.staffList[].id を参照）';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'attributed_staff_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN attributed_staff_name TEXT;
    COMMENT ON COLUMN orders.attributed_staff_name IS '注文を受けた担当者名（スナップショット）';
  END IF;
END $$;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_orders_attributed_staff
  ON orders (tenant_id, attributed_staff_id)
  WHERE attributed_staff_id IS NOT NULL;
