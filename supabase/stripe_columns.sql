-- ===============================================================
-- Stripe決済連携用のカラム追加
-- ---------------------------------------------------------------
-- 使い方:
--   1. Supabase ダッシュボード → SQL Editor
--   2. このファイルの内容をコピーして貼り付け
--   3. Run
--
-- ※ 既にカラムがある場合は IF NOT EXISTS で安全にスキップされます
-- ===============================================================


-- ----------------------------------------------------------------
-- 1) orders テーブルに Stripe 関連カラムを追加
-- ----------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- payment_status の取りうる値（コメントとして残しておく）
-- 'unpaid'      : 未決済（注文のみ）
-- 'processing'  : 決済処理中（Checkoutセッション作成済み）
-- 'paid'        : 決済完了
-- 'failed'      : 決済失敗
-- 'refunded'    : 返金済み


-- ----------------------------------------------------------------
-- 2) Webhook処理を高速化するためのインデックス
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent
  ON public.orders(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_orders_stripe_checkout_session
  ON public.orders(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders(payment_status);


-- ----------------------------------------------------------------
-- 3) app_settings には新カラム追加せず、既存の settings_data (jsonb) を活用
-- ----------------------------------------------------------------
-- 各店舗の Stripe 接続情報は app_settings.settings_data の中に保存する想定:
--   {
--     "stripe": {
--       "accountId": "acct_xxxxxxxxxxxxx",
--       "type": "express" | "standard",
--       "chargesEnabled": true,
--       "payoutsEnabled": true,
--       "detailsSubmitted": true,
--       "connectedAt": "2026-05-12T10:00:00Z"
--     },
--     "generalConfig": { ... },
--     ...
--   }
--
-- これにより既存のSettings保存ロジックを変えずに済む。


-- ----------------------------------------------------------------
-- 4) 動作確認用クエリ
-- ----------------------------------------------------------------
-- 適用後、以下で確認できます:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'orders'
--     AND column_name IN ('stripe_payment_intent_id','stripe_checkout_session_id','payment_status','paid_at');
