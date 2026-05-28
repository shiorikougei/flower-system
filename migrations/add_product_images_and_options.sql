-- =============================================================
-- EC商品: 複数画像 + オプション機能 のためのカラム追加
-- =============================================================
-- 実行手順:
--   1. Supabase Dashboard を開く
--   2. 左メニュー「SQL Editor」
--   3. New query
--   4. 下記SQLを全選択してコピペ
--   5. 「Run」ボタンをクリック
--
-- ⚠️ このSQLは既存データを破壊しません（カラム追加のみ）
-- =============================================================

-- ① 追加画像URL配列（メイン画像は既存の image_url を継続使用）
--   image_urls = ['url1', 'url2', ...]   最大5枚（うちメインは image_url）
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- ② オプション設定（商品ごとに個別設定）
--   options = {
--     wrapping:      { enabled: bool, price: 220 },
--     messageCard:   { enabled: bool, price: 0 },
--     textInsertion: {
--       enabled: bool,
--       price: 4400,
--       maxLength: 30,
--       allowKanji: false,
--       positions: ['真ん中', '右下', '下']
--     }
--   }
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '{}'::jsonb;

-- 既存データには空配列・空オブジェクトをセット（NULL対策）
UPDATE products SET image_urls = '[]'::jsonb WHERE image_urls IS NULL;
UPDATE products SET options    = '{}'::jsonb WHERE options    IS NULL;

-- =============================================================
-- 完了！既存の商品データはそのまま、新機能が使えるようになります
-- =============================================================
