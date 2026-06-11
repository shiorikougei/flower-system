-- =============================================================
-- [Phase2.5-#114] 監査ログ改ざん検知（ハッシュチェーン）
-- =============================================================
-- 実行手順:
--   1. Supabase Dashboard → SQL Editor
--   2. New query → 以下をコピペ → Run
--
-- ⚠️ 既存データは変更しない（カラム追加のみ）
-- =============================================================

-- ハッシュチェーン用カラム追加
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS row_hash TEXT,
  ADD COLUMN IF NOT EXISTS prev_hash TEXT;

-- 検証用インデックス（テナント別の連鎖検証を高速化）
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created
  ON audit_log(tenant_id, created_at);

-- 既存レコードに「ヌル状態の説明」を入れておく（後で再ハッシュ可能）
-- NOTE: 既存レコードは未検証扱い。新規挿入分から検証チェーンが始まる

COMMENT ON COLUMN audit_log.row_hash IS '当該レコード全体のSHA256（改ざん検知用）';
COMMENT ON COLUMN audit_log.prev_hash IS '同テナントの直前レコードの row_hash（ハッシュチェーン）';

-- =============================================================
-- 完了！次は /api/staff/audit-log のコードで挿入時にハッシュ計算します
-- =============================================================
