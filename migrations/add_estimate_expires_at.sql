-- [見積-1] 見積有効期限 + 催促通知用カラム追加

DO $$
BEGIN
  -- 有効期限
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE estimates ADD COLUMN expires_at TIMESTAMPTZ;
    COMMENT ON COLUMN estimates.expires_at IS '見積有効期限（通常30日）';
  END IF;

  -- 催促通知送信履歴（同じ見積に何度も送らない用）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'reminder_sent_at'
  ) THEN
    ALTER TABLE estimates ADD COLUMN reminder_sent_at TIMESTAMPTZ;
    COMMENT ON COLUMN estimates.reminder_sent_at IS '未回答催促をスタッフへ送信した日時';
  END IF;

  -- 期限切れ通知送信履歴（顧客へ送信した日時：店舗が手動送信時に更新）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'expiry_warning_sent_at'
  ) THEN
    ALTER TABLE estimates ADD COLUMN expiry_warning_sent_at TIMESTAMPTZ;
    COMMENT ON COLUMN estimates.expiry_warning_sent_at IS '期限切れ間近を顧客へリマインド送信した日時(店舗手動)';
  END IF;

  -- 期限切れアラート（スタッフ側へ通知した日時：Cron自動）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'staff_expiry_alert_sent_at'
  ) THEN
    ALTER TABLE estimates ADD COLUMN staff_expiry_alert_sent_at TIMESTAMPTZ;
    COMMENT ON COLUMN estimates.staff_expiry_alert_sent_at IS '期限切れ間近をスタッフへ通知した日時(Cron自動)';
  END IF;
END $$;

-- 既存データには created_at + 30日 をセット（後方互換）
UPDATE estimates
SET expires_at = COALESCE(created_at, NOW()) + INTERVAL '30 days'
WHERE expires_at IS NULL;

-- インデックス（cron検索用）
CREATE INDEX IF NOT EXISTS idx_estimates_status_expires
  ON estimates (status, expires_at)
  WHERE status IN ('pending', 'replied');
