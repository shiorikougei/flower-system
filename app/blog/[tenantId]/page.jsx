// [SEO-#13] ブログ一覧ページ
// /blog/[tenantId] でテナントの公開済みブログ記事一覧を表示

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Breadcrumbs from "@/components/Breadcrumbs";

export const revalidate = 3600;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

async function getBlogData(tenantId) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const [settingsRes, postsRes] = await Promise.all([
      supabaseAdmin
        .from("app_settings")
        .select("settings_data")
        .eq("id", String(tenantId).toLowerCase())
        .maybeSingle(),
      supabaseAdmin
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_image_url, tags, published_at, author_name")
        .eq("tenant_id", String(tenantId).toLowerCase())
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(50),
    ]);

    const settings = settingsRes.data?.settings_data || {};
    const shop = settings.shops?.[0] || {};
    const posts = postsRes.data || [];
    return { settings, shop, posts };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { tenantId } = await params;
  const data = await getBlogData(tenantId);
  const shopName = data?.shop?.name || "FLORIX";
  return {
    title: `お花のブログ | ${shopName}`,
    description: `${shopName}が綴るお花のコラム。季節の花・贈り物のヒント・お手入れ方法など、お役立ち情報をお届けします。`,
    alternates: { canonical: `${BASE_URL}/blog/${tenantId}` },
  };
}

export default async function BlogIndexPage({ params }) {
  const { tenantId } = await params;
  const data = await getBlogData(tenantId);
  if (!data) notFound();

  const { shop, posts } = data;
  const shopName = shop.name || "FLORIX";
  const shopId = String(shop.id ?? "default");

  // Blog ItemList JSON-LD
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${shopName} ブログ`,
    numberOfItems: posts.length,
    itemListElement: posts.map((p, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${BASE_URL}/blog/${tenantId}/${p.slug}`,
      name: p.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <main className="min-h-screen bg-[#FBFAF9] font-sans text-[#111] pb-32">
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
          <div className="max-w-[900px] mx-auto h-16 px-6 flex items-center justify-between">
            <Link href={`/order/${tenantId}/${shopId}`} className="text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
              ← 店舗トップ
            </Link>
            <span className="font-serif font-bold text-[14px] text-[#2D4B3E]">{shopName}</span>
          </div>
        </header>

        <div className="max-w-[900px] mx-auto p-6">
          <Breadcrumbs
            items={[
              { label: shopName, href: `/order/${tenantId}/${shopId}` },
              { label: "ブログ" },
            ]}
          />

          <div className="mb-10">
            <h1 className="text-[28px] md:text-[36px] font-bold text-[#2D4B3E] mb-2">📖 お花のブログ</h1>
            <p className="text-[13px] text-[#555]">季節の花・贈り物のヒント・お手入れ方法など、{shopName}が綴るお役立ち情報です。</p>
          </div>

          {posts.length === 0 ? (
            <div className="bg-white border border-dashed border-[#EAEAEA] rounded-2xl p-12 text-center">
              <p className="text-[14px] font-bold text-[#999]">まだ記事がありません</p>
              <p className="text-[11px] text-[#CCC] mt-2">近日公開予定です。お楽しみに🌸</p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map(p => (
                <Link
                  key={p.id}
                  href={`/blog/${tenantId}/${p.slug}`}
                  className="block bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden hover:shadow-md transition-all md:flex"
                >
                  {p.cover_image_url && (
                    <div className="md:w-[280px] aspect-[16/10] md:aspect-square bg-[#FBFAF9] overflow-hidden flex-shrink-0">
                      <img
                        src={p.cover_image_url}
                        alt={p.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-5 md:p-6 flex-1">
                    {p.tags && p.tags.length > 0 && (
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {p.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] bg-[#F5F2EE] text-[#666] px-2 py-0.5 rounded-full">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <h2 className="text-[16px] md:text-[18px] font-bold text-[#111] leading-snug">{p.title}</h2>
                    {p.excerpt && (
                      <p className="text-[12px] text-[#666] mt-2 leading-relaxed line-clamp-3">{p.excerpt}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3 text-[11px] text-[#999]">
                      {p.published_at && (
                        <time dateTime={p.published_at}>
                          {new Date(p.published_at).toLocaleDateString("ja-JP", {
                            year: "numeric", month: "long", day: "numeric"
                          })}
                        </time>
                      )}
                      {p.author_name && <span>· {p.author_name}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
