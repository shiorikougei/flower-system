-- ===============================================================
-- staff_attendance に休憩時間カラムを追加
-- 1日合計の休憩時間（分）を記録。複数回休憩しても合算される。
-- 退勤時に勤務時間から休憩時間を差し引いて duration_minutes を更新する想定。
-- ===============================================================

ALTER TABLE public.staff_attendance
  ADD COLUMN IF NOT EXISTS break_minutes int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_start_at timestamptz;  -- 休憩中なら値あり、終了で null

COMMENT ON COLUMN public.staff_attendance.break_minutes IS
  '当該打刻の合計休憩時間（分）。出勤中の途中で休憩を取った場合の累計';
COMMENT ON COLUMN public.staff_attendance.break_start_at IS
  '休憩中の場合、開始時刻。終了時に null に戻して break_minutes に加算';
