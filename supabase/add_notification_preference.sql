-- ===============================================================
-- お客様の通知設定: LINEのみ / メールのみ / 両方
-- ---------------------------------------------------------------
-- マイページの「LINE連携」セクションで設定できるようにする
-- ===============================================================

ALTER TABLE public.customer_line_links
  ADD COLUMN IF NOT EXISTS notification_preference text NOT NULL DEFAULT 'both';

-- 取りうる値: 'both' (メール+LINE) / 'line_only' / 'email_only'
COMMENT ON COLUMN public.customer_line_links.notification_preference IS
  'お客様の通知方法選択: both / line_only / email_only';
