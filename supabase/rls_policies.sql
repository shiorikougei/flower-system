-- ===============================================================
-- flower-app マルチテナント分離のための RLS (Row Level Security) ポリシー
-- ---------------------------------------------------------------
-- 使い方:
--   1. Supabase ダッシュボード → 左メニュー [SQL Editor] を開く
--   2. このファイルの内容をコピーして貼り付け
--   3. 上の "Run" ボタンを押す
--
-- 注意:
--   - profiles テーブルに、ユーザーID(id) と tenant_id のカラムが
--     ある前提で書いています。違うカラム名なら下の参照箇所を直してください。
--   - すでに存在するポリシーがあるとエラーになります。その場合は
--     一旦 DROP POLICY してから再実行してください（コメント参照）。
-- ===============================================================


-- ----------------------------------------------------------------
-- 共通: ログインユーザーの tenant_id を返すヘルパー関数
-- ----------------------------------------------------------------
-- SECURITY DEFINER で動かして RLS の無限ループを防ぐ（推奨）
-- ★ profiles.tenant_id が text 型のため、戻り値も text にしている
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;


-- ===============================================================
-- 1) profiles テーブル
-- ===============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーがある場合は先に DROP（必要なら）
-- DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
-- DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

-- SELECT: 自分のプロフィールだけ見える
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- UPDATE: 自分のプロフィールだけ更新できる。ただし tenant_id 自体は変更不可
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- tenant_id を勝手に書き換えられないようにする
    AND tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- INSERT は通常サインアップ時にトリガーで作るので、ここでは付けない


-- ===============================================================
-- 2) orders テーブル
-- ===============================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "orders_tenant_select" ON public.orders;
-- DROP POLICY IF EXISTS "orders_tenant_insert" ON public.orders;
-- DROP POLICY IF EXISTS "orders_tenant_update" ON public.orders;
-- DROP POLICY IF EXISTS "orders_tenant_delete" ON public.orders;

-- SELECT: 自分のテナントのデータだけ見える
CREATE POLICY "orders_tenant_select" ON public.orders
  FOR SELECT
  USING (tenant_id = public.current_tenant_id());

-- INSERT: 自分のテナントとしてのみ作成可能
CREATE POLICY "orders_tenant_insert" ON public.orders
  FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

-- UPDATE: 自分のテナントのデータのみ。tenant_id 自体を別店舗に書き換えるのもブロック
CREATE POLICY "orders_tenant_update" ON public.orders
  FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- DELETE: 自分のテナントのデータのみ削除可能
CREATE POLICY "orders_tenant_delete" ON public.orders
  FOR DELETE
  USING (tenant_id = public.current_tenant_id());

-- お客様向け注文フォーム（未ログイン）からの INSERT を許可する場合は、
-- 上記の INSERT ポリシーを使わず、別途 anon 用ポリシーを定義する必要があります。
-- 例（必要なら有効化）:
-- CREATE POLICY "orders_public_insert" ON public.orders
--   FOR INSERT TO anon
--   WITH CHECK (tenant_id IS NOT NULL);


-- ===============================================================
-- 3) app_settings テーブル
-- ===============================================================
-- id カラム = tenant_id（または `${tenant_id}_gallery` のような派生キー）が
-- 入っているテーブルとして扱います。
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "app_settings_tenant_select" ON public.app_settings;
-- DROP POLICY IF EXISTS "app_settings_tenant_write" ON public.app_settings;

-- SELECT: 自分の tenant_id か、その派生キー（例: `${tId}_gallery`）だけ見える
-- 加えて、共通の 'nocolde_owner' レコードは認証済みなら誰でも読めるようにする
CREATE POLICY "app_settings_tenant_select" ON public.app_settings
  FOR SELECT
  USING (
    id::text = public.current_tenant_id()::text
    OR id::text LIKE public.current_tenant_id()::text || '\_%' ESCAPE '\'
    OR id::text = 'nocolde_owner'  -- オーナー宛フィードバック等の共有レコード
  );

-- INSERT/UPDATE/DELETE: 自分のテナントの id（または派生キー）のみ
CREATE POLICY "app_settings_tenant_write" ON public.app_settings
  FOR ALL
  USING (
    id::text = public.current_tenant_id()::text
    OR id::text LIKE public.current_tenant_id()::text || '\_%' ESCAPE '\'
    OR id::text = 'nocolde_owner'
  )
  WITH CHECK (
    id::text = public.current_tenant_id()::text
    OR id::text LIKE public.current_tenant_id()::text || '\_%' ESCAPE '\'
    OR id::text = 'nocolde_owner'
  );

-- 'nocolde_owner' を全テナントから書き込めるのは要件次第なので、
-- もしオーナーロールだけが書けるようにしたい場合は、profiles.role などで
-- 制限するポリシーに差し替えてください。


-- ===============================================================
-- 4) Storage バケット (portfolio) のポリシー
-- ===============================================================
-- ファイルパスを `${tenant_id}/xxx.jpg` で保存する前提のポリシー。
-- Supabase Dashboard の [Storage] → [Policies] からも設定可能ですが、
-- SQL でやる場合は以下のように書きます。
--
-- ※ Storage の RLS は storage.objects テーブルに対して設定します。

-- SELECT は公開（バケットを Public にしている前提）なら不要。
-- アップロード/上書き/削除はテナント自身のみに制限する例:

-- DROP POLICY IF EXISTS "portfolio_tenant_upload" ON storage.objects;
-- DROP POLICY IF EXISTS "portfolio_tenant_modify" ON storage.objects;

CREATE POLICY "portfolio_tenant_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'portfolio'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

CREATE POLICY "portfolio_tenant_modify" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'portfolio'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

CREATE POLICY "portfolio_tenant_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'portfolio'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  );


-- ===============================================================
-- 5) 動作確認用クエリ
-- ===============================================================
-- 適用後、Supabase の SQL Editor で以下を実行して動作確認してください。
--
-- A) ヘルパー関数が動くか:
--    SELECT public.current_tenant_id();
--    → ログイン中ユーザーの tenant_id が返るはず
--
-- B) RLS が効いているか:
--    SELECT count(*) FROM public.orders;
--    → 自分のテナントの件数だけが返るはず（全件ではない）
--
-- C) 他テナントのデータが見えないか:
--    SELECT count(*) FROM public.orders WHERE tenant_id <> public.current_tenant_id();
--    → 0 になるはず


-- ===============================================================
-- 6) ロールバック（万一に備えて）
-- ===============================================================
-- 何か問題が起きた場合、以下で RLS を一旦無効化できます。
-- ※ ただし無効化中はデータが全員に見える状態になるので、
--   緊急時以外は使わないでください。
--
-- ALTER TABLE public.profiles      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.orders        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.app_settings  DISABLE ROW LEVEL SECURITY;
