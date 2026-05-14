-- ===============================================================
-- シフト管理 + 休み希望提出
-- ---------------------------------------------------------------
-- shift_schedules: 確定したシフト割当（オーナー手動 or 自動生成）
-- shift_holiday_requests: スタッフからの希望休提出
--
-- 関連設定（app_settings.settings_data）:
--   shiftConfig: { patterns, requiredStaff, holidayRule, ... }
--   staffList[].fixedDayOff: ['mon', 'wed', 'sun', 'holiday'] など
-- ===============================================================

-- 1) シフト割当
CREATE TABLE IF NOT EXISTS public.shift_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  staff_name text NOT NULL,
  date date NOT NULL,                  -- YYYY-MM-DD
  pattern_id text,                     -- shiftConfig.patterns[].id  / null=休み
  pattern_name text,                   -- 表示用（早番/遅番/全日 など）
  start_time text,                     -- 'HH:MM'
  end_time text,                       -- 'HH:MM'
  is_off boolean NOT NULL DEFAULT false,  -- true なら休み
  is_auto_generated boolean NOT NULL DEFAULT false,  -- 自動生成かオーナー手動か
  locked boolean NOT NULL DEFAULT false,   -- ロック=自動生成で上書きされない
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, staff_name, date)
);

CREATE INDEX IF NOT EXISTS idx_shift_tenant_date
  ON public.shift_schedules(tenant_id, date);

CREATE INDEX IF NOT EXISTS idx_shift_tenant_staff_date
  ON public.shift_schedules(tenant_id, staff_name, date);

CREATE OR REPLACE FUNCTION public.update_shift_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shift_updated_at ON public.shift_schedules;
CREATE TRIGGER shift_updated_at
  BEFORE UPDATE ON public.shift_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_shift_updated_at();

ALTER TABLE public.shift_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_service_role_all" ON public.shift_schedules
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- 2) 休み希望
CREATE TABLE IF NOT EXISTS public.shift_holiday_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  staff_name text NOT NULL,
  year_month text NOT NULL,            -- 'YYYY-MM' (対象月)
  date date NOT NULL,                  -- YYYY-MM-DD
  priority int NOT NULL DEFAULT 1,     -- 1=第1希望 2=第2希望...
  status text NOT NULL DEFAULT 'pending',  -- pending|approved|rejected
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, staff_name, date)
);

CREATE INDEX IF NOT EXISTS idx_holiday_req_tenant_month
  ON public.shift_holiday_requests(tenant_id, year_month);

CREATE INDEX IF NOT EXISTS idx_holiday_req_staff
  ON public.shift_holiday_requests(tenant_id, staff_name, year_month);

DROP TRIGGER IF EXISTS holiday_req_updated_at ON public.shift_holiday_requests;
CREATE TRIGGER holiday_req_updated_at
  BEFORE UPDATE ON public.shift_holiday_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_shift_updated_at();

ALTER TABLE public.shift_holiday_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holiday_req_service_role_all" ON public.shift_holiday_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
