-- shift_holiday_requests に時間単位の休み希望対応を追加
-- start_time / end_time が NULL なら終日休み、値があれば時間単位の希望

ALTER TABLE public.shift_holiday_requests
  ADD COLUMN IF NOT EXISTS start_time text,  -- 'HH:MM' / null=終日
  ADD COLUMN IF NOT EXISTS end_time text;

COMMENT ON COLUMN public.shift_holiday_requests.start_time IS '時間指定休み希望の開始時刻（HH:MM）。null=終日休み';
COMMENT ON COLUMN public.shift_holiday_requests.end_time IS '時間指定休み希望の終了時刻（HH:MM）。null=終日休み';
