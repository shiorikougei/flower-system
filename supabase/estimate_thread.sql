-- ===============================================================
-- 見積のやり取り無制限化（C7）用の追加
-- 設計: docs/ESTIMATE_THREAD_DESIGN.md
--
-- この SQL は「追加」だけを行います。
--   - 既存の表・列・データの削除、書き換え、型変更はしません
--   - 何度実行しても同じ結果になります（すでにあれば何もしない）
-- ===============================================================

-- ---------------------------------------------------------------
-- 1. 見積案（お店が出した見積。出し直すたびに 1 行増える）
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estimate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL,
  tenant_id text NOT NULL,
  version_no integer NOT NULL,            -- 見積案の番号（1, 2, 3 ...）
  proposed_price integer NOT NULL,        -- 合計（税抜）
  proposed_data jsonb,                    -- 内訳（商品代・送料・箱代・クール便・その他）
  message text,                           -- お店のコメント
  status text NOT NULL DEFAULT 'active',  -- active（有効）| withdrawn（取り下げ）
  created_by uuid,                        -- 作成したスタッフ
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (estimate_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_estimate_versions_estimate
  ON public.estimate_versions(estimate_id, version_no);

ALTER TABLE public.estimate_versions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- 2. やり取り（お客様の変更依頼・お店の返信）
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.estimate_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL,
  tenant_id text NOT NULL,
  sender text NOT NULL,                   -- customer（お客様）| shop（お店）
  body text NOT NULL,
  version_id uuid,                        -- 見積案と一緒に送った場合、その見積案
  created_by uuid,                        -- お店の場合、送信したスタッフ
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_messages_estimate
  ON public.estimate_messages(estimate_id, created_at);

ALTER TABLE public.estimate_messages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- 3. 読み書きはサーバー経由のみ（今の estimates 表と同じ設定）
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'estimate_versions' AND policyname = 'estimate_versions_service_role_all') THEN
    CREATE POLICY "estimate_versions_service_role_all" ON public.estimate_versions
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'estimate_messages' AND policyname = 'estimate_messages_service_role_all') THEN
    CREATE POLICY "estimate_messages_service_role_all" ON public.estimate_messages
      FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ---------------------------------------------------------------
-- 4. 見積の「お客様用の鍵」を入れる列を estimates に追加
--    新しく作る見積だけに入る。今までの見積は空のまま（今のリンクはそのまま使える）
-- ---------------------------------------------------------------
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS access_token text;
