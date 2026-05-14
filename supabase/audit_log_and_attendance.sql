-- ===============================================================
-- 操作履歴(audit_log) と 出退勤打刻(staff_attendance)
-- ---------------------------------------------------------------
-- audit_log: 「誰がいつ何を操作したか」を記録
-- staff_attendance: スタッフの出勤・退勤を記録（スタッフ切替と連動）
-- ===============================================================

-- 1) 操作履歴
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  staff_name text,                    -- 操作者（スタッフ名・未選択時は'未選択'）
  staff_role text,                    -- 操作者のrole（owner/staff/parttime）
  action text NOT NULL,               -- 例: 'order_status_change', 'order_delete', 'payment_confirm', 'settings_save'
  target_type text,                   -- 例: 'order', 'product', 'settings', 'staff'
  target_id text,                     -- 対象のID（注文IDや商品IDなど）
  description text,                   -- 人が読める説明文
  metadata jsonb,                     -- 追加情報（変更前後の値など）
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created
  ON public.audit_log(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_staff
  ON public.audit_log(tenant_id, staff_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_target
  ON public.audit_log(tenant_id, target_type, target_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_service_role_all" ON public.audit_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- 2) 出退勤打刻
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  staff_name text NOT NULL,
  clock_in_at timestamptz NOT NULL DEFAULT now(),
  clock_out_at timestamptz,           -- nullなら出勤中
  duration_minutes int,               -- 退勤時に自動計算
  notes text,                         -- 任意メモ
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_staff
  ON public.staff_attendance(tenant_id, staff_name, clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_open
  ON public.staff_attendance(tenant_id, staff_name, clock_out_at)
  WHERE clock_out_at IS NULL;

CREATE OR REPLACE FUNCTION public.update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- 退勤時に勤務時間を自動計算
  IF NEW.clock_out_at IS NOT NULL AND OLD.clock_out_at IS NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.clock_out_at - NEW.clock_in_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_updated_at ON public.staff_attendance;
CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_attendance_updated_at();

ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_service_role_all" ON public.staff_attendance
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
