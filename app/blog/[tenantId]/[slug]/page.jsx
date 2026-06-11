// [SEO-#13] ブログ記事個別ページ
// /blog/[tenantId]/[slug] で記事詳細を表示

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Breadcrumbs from "@/components/Breadcrumbs";

export const revalidate = 3600;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

// 超軽量Markdown→HTML（外部ライブラリ無し）
function renderMarkdown(md) {
  if (!md) return "";
  let html = String(md);

  // エスケープ
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // コードブロック
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-[#F5F2EE] p-4 rounded-xl overflow-x-auto text-[12px] my-4"><code>$1</code></pre>');

  // 見出し
  html = html.replace(/^### (.*)$/gm, '<h3 class="text-[16px] font-bold text-[#2D4B3E] mt-6 mb-2">$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2 class="text-[20px] font-bold text-[#2D4B3E] mt-8 mb-3 pb-2 border-b border-[#EAEAEA]">$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1 class="text-[24px] font-bold text-[#2D4B3E] mt-8 mb-4">$1</h1>');

  // インラインコード
  html = html.replace(/`([^`]+)`/g, '<code class="bg-[#F5F2EE] px-1.5 py-0.5 rounded text-[12px]">$1</code>');

  // 太字・斜体
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // リンク [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#2D4B3E] underline" target="_blank" rel="noopener">$1</a>');

  // 画像 ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl my-4 w-full" loading="lazy" />');

  // 番号付きリスト
  html = html.replace(/(?:^\d+\. .*$\n?)+/gm, (match) => {
    const items = match.trim().split(/\n/).map(l => l.replace(/^\d+\. /, '')).map(i => `<li class="ml-6 list-decimal mb-1">${i}</li>`).join('');
    return `<ol class="my-3 space-y-1">${items}</ol>`;
  });

  // 箇条書きリスト
  html = html.replace(/(?:^[-*] .*$\n?)+/gm, (match) => {
    const items = match.trim().split(/\n/).map(l => l.replace(/^[-*] /, '')).map(i => `<li class="ml-6 list-disc mb-1">${i}</li>`).join('');
    return `<ul class="my-3 space-y-1">${items}</ul>`;
  });

  // 引用
  html = html.replace(/^> (.*)$/gm, '<blockquote class="border-l-4 border-[#2D4B3E] pl-4 py-1 my-4 text-[#555] italic">$1</blockquote>');

  // 段落（連続改行で区切る）
  html = html.split(/\n\n+/).map(para => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    // 既にHTMLタグで始まってる場合はそのまま
    if (/^<(h\d|ul|ol|pre|blockquote|img)/.test(trimmed)) return trimmed;
    return `<p class="my-3 leading-[1.9] text-[14px]">${trimmed.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  return html;
}

async function getPostData(tenantId, slug) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const [settingsRes, postRes] = await Promise.all([
      supabaseAdmin
        .from("app_settings")
        .select("settings_data")
        .eq("id", String(tenantId).toLowerCase())
        .maybeSingle(),
      supabaseAdmin
        .from("blog_posts")
        .select("*")
        .eq("tenant_id", String(tenantId).toLowerCase())
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle(),
    ]);

    if (!postRes.data) return null;

    const settings = settingsRes.data?.settings_data || {};
    const shop = settings.shops?.[0] || {};
    return { settings, shop, post: postRes.data };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { tenantId, slug } = await params;
  const data = await getPostData(tenantId, slug);
  if (!data) return { title: "記事が見つかりません" };

  const { shop, post } = data;
  const shopName = shop.name || "FLORIX";
  const url = `${BASE_URL}/blog/${tenantId}/${slug}`;
  const description = (post.excerpt || post.title).slice(0, 160);
  const image = post.cover_image_url || `${BASE_URL}/og-default.jpg`;

  return {
    title: `${post.title} | ${shopName}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      url,
      siteName: shopName,
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
      locale: "ja_JP",
      type: "article",
      publishedTime: post.published_at,
      authors: post.author_name ? [post.author_name] : undefined,
      tags: post.tags || [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [image],
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { tenantId, slug } = await params;
  const data = await getPostData(tenantId, slug);
  if (!data) notFound();

  const { shop, post } = data;
  const shopName = shop.name || "FLORIX";
  const shopId = String(shop.id ?? "default");
  const url = `${BASE_URL}/blog/${tenantId}/${slug}`;

  // [SEO-#13] BlogPosting JSON-LD
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.title,
    image: post.cover_image_url ? [post.cover_image_url] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: post.author_name ? {
      "@type": "Person",
      name: post.author_name,
    } : {
      "@type": "Organization",
      name: shopName,
    },
    publisher: {
      "@type": "Organization",
      name: shopName,
      logo: shop.logoUrl ? { "@type": "ImageObject", url: shop.logoUrl } : undefined,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: (post.tags || []).join(", "),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <main className="min-h-screen bg-[#FBFAF9] font-sans text-[#111] pb-32">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
          <div className="max-w-[800px] mx-auto h-16 px-6 flex items-center justify-between">
            <Link href={`/blog/${tenantId}`} className="text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
              ← ブログ一覧
            </Link>
            <span className="font-serif font-bold text-[14px] text-[#2D4B3E]">{shopName}</span>
          </div>
        </header>

        <article className="max-w-[800px] mx-auto p-6">
          <Breadcrumbs
            items={[
              { label: shopName, href: `/order/${tenantId}/${shopId}` },
              { label: "ブログ", href: `/blog/${tenantId}` },
              { label: post.title },
            ]}
          />

          {/* タグ */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {post.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-[#F5F2EE] text-[#666] px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* タイトル */}
          <h1 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E] leading-tight mb-3">{post.title}</h1>

          {/* メタ情報 */}
          <div className="flex items-center gap-2 text-[12px] text-[#999] mb-6 pb-6 border-b border-[#EAEAEA]">
            {post.published_at && (
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString("ja-JP", {
                  year: "numeric", month: "long", day: "numeric"
                })}
              </time>
            )}
            {post.author_name && <span>· {post.author_name}</span>}
          </div>

          {/* カバー画像 */}
          {post.cover_image_url && (
            <div className="aspect-[16/9] bg-[#FBFAF9] rounded-2xl overflow-hidden mb-8">
              <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* 本文（Markdownレンダリング） */}
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content_md) }}
          />

          {/* [SEO-#20] CTA - 店舗に戻る/EC */}
          <div className="mt-12 pt-8 border-t border-[#EAEAEA] grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link
              href={`/order/${tenantId}/${shopId}/shop`}
              className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] transition-all text-center"
            >
              <p className="text-[13px] font-bold text-[#2D4B3E]">🌸 商品を見る</p>
            </Link>
            <Link
              href={`/order/${tenantId}/${shopId}/custom`}
              className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] transition-all text-center"
            >
              <p className="text-[13px] font-bold text-[#2D4B3E]">✨ カスタム注文</p>
            </Link>
            <Link
              href={`/blog/${tenantId}`}
              className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] transition-all text-center"
            >
              <p className="text-[13px] font-bold text-[#2D4B3E]">📖 他の記事も読む</p>
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}
