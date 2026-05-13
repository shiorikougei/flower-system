-- ===============================================================
-- 顧客マイページ用 記念日リマインダーテーブル
-- ---------------------------------------------------------------
-- お客様が自分のマイページから記念日を登録できる
-- 毎日チェックして「1週間前」のものに自動でリマインドメールを送信
--
-- 使い方:
--   Supabase ダッシュボード → SQL Editor → 貼り付け → Run
-- ===============================================================

CREATE TABLE IF NOT EXISTS public.customer_anniversaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_email text NOT NULL,
  customer_name text,
  title text NOT NULL,           -- 例: "母の誕生日", "結婚記念日", "おばあちゃん月命日"
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  day int NOT NULL CHECK (day BETWEEN 1 AND 31),
  notes text,                    -- "毎年ピンク系" など好みメモ
  last_notified_at timestamptz,  -- 最後にリマインド送信した日時（重複送信防止）
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anniversaries_tenant_email
  ON public.customer_anniversaries(tenant_id, customer_email);

CREATE INDEX IF NOT EXISTS idx_anniversaries_month_day
  ON public.customer_anniversaries(month, day);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION public.update_anniversaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS anniversaries_updated_at ON public.customer_anniversaries;
CREATE TRIGGER anniversaries_updated_at
  BEFORE UPDATE ON public.customer_anniversaries
  FOR EACH ROW EXECUTE FUNCTION public.update_anniversaries_updated_at();

-- RLS: API Route から service role key で操作するため、SELECT/INSERT/UPDATE/DELETE は
-- service role のみ。お客様クライアントから直接アクセスはさせない（マジックリンク経由のAPIのみ）。
ALTER TABLE public.customer_anniversaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anniversaries_service_role_all" ON public.customer_anniversaries
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
