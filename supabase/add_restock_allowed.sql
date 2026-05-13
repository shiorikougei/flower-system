-- ===============================================================
-- products テーブルに restock_allowed カラムを追加
-- ---------------------------------------------------------------
-- 目的: ECはドライフラワーがメインで「同じものは作れない」前提のため
--       商品ごとに再入荷可否を設定できるようにする
--
--   restock_allowed = false (デフォルト):
--     一点もの。在庫0になったらお客様画面から自動的に非表示。
--     入荷通知メールの登録対象外。
--
--   restock_allowed = true:
--     継続的に作る商品。在庫0でも「入荷通知に登録」ボタンを表示。
--     入荷したら登録者へ自動メール送信。
--
-- 使い方:
--   Supabase ダッシュボード → SQL Editor → 貼り付け → Run
-- ===============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS restock_allowed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.restock_allowed IS
  '再入荷可否（false=一点もの・ドライフラワー等, true=継続商品。trueのときのみ入荷通知が機能する）';
