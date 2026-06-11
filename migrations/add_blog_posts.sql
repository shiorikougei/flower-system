-- [SEO-#13] ブログ機能用テーブル
-- 月1運用想定。タイトル・本文・タグ・公開日・OG画像のみのシンプル構造

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL,                       -- URL用 (例: spring-bouquet-2026)
  title TEXT NOT NULL,
  excerpt TEXT,                              -- 一覧表示用の要約 (160文字以内)
  content_md TEXT NOT NULL,                  -- 本文（Markdown）
  cover_image_url TEXT,                      -- カバー画像（OG用も兼ねる）
  tags TEXT[] DEFAULT '{}',                  -- ['母の日', 'ブーケ'] 等
  author_name TEXT,                          -- 著者名（E-E-A-T用）
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,                  -- 公開日（published時にセット）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_blog_posts_tenant_published ON blog_posts(tenant_id, is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(tenant_id, slug);

-- RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- 公開記事は誰でも読める
CREATE POLICY "blog_posts_public_read" ON blog_posts
  FOR SELECT
  USING (is_published = true);

-- Service Role は全権限（API経由の編集はSR使用）
-- 通常のanon/authenticatedからは編集不可

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blog_posts_updated_at_trigger ON blog_posts;
CREATE TRIGGER blog_posts_updated_at_trigger
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();
