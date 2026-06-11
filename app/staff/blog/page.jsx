// [SEO-#13] スタッフ用ブログ管理画面
// 記事の作成・編集・公開・削除

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, ExternalLink, X, Save } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function StaffBlogPage() {
  const [tenantId, setTenantId] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    initData();
  }, []);

  async function initData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/staff/login";
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session.user.id)
        .single();
      const tId = profile?.tenant_id;
      if (!tId) throw new Error("tenant_id が取得できません");
      setTenantId(tId);
      await loadPosts(tId);
    } catch (e) {
      console.error("[blog admin init]", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadPosts(tId) {
    const id = tId || tenantId;
    if (!id) return;
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("tenant_id", String(id).toLowerCase())
      .order("created_at", { ascending: false });
    if (error) console.error("[blog posts load]", error);
    setPosts(data || []);
  }

  async function handleSave(post) {
    const payload = {
      tenant_id: String(tenantId).toLowerCase(),
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content_md: post.content_md,
      cover_image_url: post.cover_image_url || null,
      tags: post.tags || [],
      author_name: post.author_name || null,
      is_published: post.is_published || false,
      published_at: post.is_published ? (post.published_at || new Date().toISOString()) : null,
    };

    if (post.id) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", post.id);
      if (error) return alert(`保存失敗: ${error.message}`);
    } else {
      const { error } = await supabase.from("blog_posts").insert(payload);
      if (error) return alert(`作成失敗: ${error.message}`);
    }
    setEditing(null);
    loadPosts();
  }

  async function handleDelete(id) {
    if (!confirm("この記事を削除します。よろしいですか？")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) return alert(`削除失敗: ${error.message}`);
    loadPosts();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center">
        <p className="text-[#999] text-[13px]">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFAF9] p-6 md:p-10">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-bold text-[#2D4B3E]">📖 ブログ管理</h1>
            <p className="text-[12px] text-[#666] mt-1">SEO対策の月1運用。記事を書くだけでGoogle検索流入が増えます。</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHelp(true)}
              className="px-4 h-10 bg-white border border-[#EAEAEA] text-[#666] rounded-xl text-[12px] font-bold hover:bg-[#FBFAF9]"
            >
              💡 書き方ガイド
            </button>
            <button
              onClick={() => setEditing({ new: true, tags: [], is_published: false })}
              className="px-4 h-10 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold flex items-center gap-1"
            >
              <Plus size={14} /> 新規記事
            </button>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="bg-white border border-dashed border-[#EAEAEA] rounded-2xl p-12 text-center">
            <p className="text-[14px] font-bold text-[#999]">まだ記事がありません</p>
            <p className="text-[11px] text-[#CCC] mt-2">「新規記事」から最初の記事を書いてみましょう</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-5 border border-[#EAEAEA] flex items-center gap-4">
                {p.cover_image_url && (
                  <img src={p.cover_image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {p.is_published ? '公開中' : '下書き'}
                    </span>
                    {p.tags && p.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-[10px] text-[#666]">#{t}</span>
                    ))}
                  </div>
                  <p className="text-[14px] font-bold text-[#111] mt-1 truncate">{p.title}</p>
                  <p className="text-[10px] text-[#999] mt-1">/{p.slug} {p.published_at && `· ${new Date(p.published_at).toLocaleDateString('ja-JP')}`}</p>
                </div>
                <div className="flex gap-1">
                  {p.is_published && tenantId && (
                    <Link
                      href={`/blog/${tenantId}/${p.slug}`}
                      target="_blank"
                      className="w-9 h-9 bg-[#FBFAF9] rounded-lg flex items-center justify-center hover:bg-[#EAEAEA]"
                      title="公開ページを開く"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  )}
                  <button
                    onClick={() => setEditing(p)}
                    className="w-9 h-9 bg-[#FBFAF9] rounded-lg flex items-center justify-center hover:bg-[#EAEAEA]"
                    title="編集"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center hover:bg-red-100"
                    title="削除"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editing && (
        <EditModal
          post={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {/* 書き方ガイド */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl max-w-[600px] w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[18px] font-bold text-[#2D4B3E]">💡 ブログ記事の書き方ガイド</h2>
                <button onClick={() => setShowHelp(false)}><X size={18} /></button>
              </div>
              <div className="space-y-4 text-[13px] leading-relaxed text-[#444]">
                <div>
                  <p className="font-bold text-[#2D4B3E]">🎯 SEOで効く書き方</p>
                  <ul className="ml-5 list-disc space-y-1 mt-1">
                    <li>タイトルは <strong>32文字以内</strong> + <strong>地域名 or 用途</strong> を含む</li>
                    <li>例: 「札幌で人気の母の日ブーケ5選｜FLORIX」</li>
                    <li>本文 <strong>1500文字以上</strong> 推奨（多いほど評価UP）</li>
                    <li>見出し（##）を <strong>3〜5個</strong> 入れる</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-[#2D4B3E]">📝 Markdown記法</p>
                  <pre className="bg-[#F5F2EE] p-3 rounded-lg text-[11px] mt-1 whitespace-pre-wrap">{`## 見出し2
### 見出し3
**太字** *斜体*
- 箇条書き
1. 番号付き
[リンク文字](https://example.com)
![画像説明](https://画像URL)
> 引用文`}</pre>
                </div>
                <div>
                  <p className="font-bold text-[#2D4B3E]">📅 ネタの探し方</p>
                  <ul className="ml-5 list-disc space-y-1 mt-1">
                    <li>季節イベント（バレンタイン・母の日・敬老の日・クリスマス）</li>
                    <li>お花の手入れ方法（「ブーケの長持ちさせ方」等）</li>
                    <li>シチュエーション別ガイド（「開店祝いに失敗しない選び方」等）</li>
                    <li>お客様からよくある質問のまとめ記事</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-[#2D4B3E]">🔁 公開頻度</p>
                  <p>月1記事でOK。続けることが何より大事。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 編集モーダル
function EditModal({ post, onClose, onSave }) {
  const [form, setForm] = useState({
    id: post.id,
    title: post.title || "",
    slug: post.slug || "",
    excerpt: post.excerpt || "",
    content_md: post.content_md || "",
    cover_image_url: post.cover_image_url || "",
    tags: post.tags || [],
    author_name: post.author_name || "",
    is_published: post.is_published || false,
    published_at: post.published_at,
  });
  const [tagInput, setTagInput] = useState("");

  const autoSlug = () => {
    if (!form.title) return;
    const slug = form.title
      .toLowerCase()
      .replace(/[^\w぀-ゟ゠-ヿ一-鿿\-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    setForm({ ...form, slug });
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return alert("タイトルを入力してください");
    if (!form.slug.trim()) return alert("URL(slug)を入力してください");
    if (!form.content_md.trim()) return alert("本文を入力してください");
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-[800px] w-full max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[18px] font-bold text-[#2D4B3E]">{form.id ? "記事を編集" : "新規記事"}</h2>
            <button onClick={onClose}><X size={18} /></button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-[#666]">タイトル *（32文字以内推奨）</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                onBlur={() => !form.slug && autoSlug()}
                className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold"
                placeholder="札幌で人気の母の日ブーケ5選"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#666]">URL（半角英数字・記号は - のみ）</label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#999]">/blog/.../</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm({ ...form, slug: e.target.value })}
                  className="flex-1 h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px]"
                  placeholder="mothers-day-bouquet-2026"
                />
                <button
                  type="button"
                  onClick={autoSlug}
                  className="h-11 px-3 bg-[#F5F2EE] rounded-xl text-[11px] font-bold"
                >
                  自動生成
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#666]">要約（160文字以内・検索結果に表示される）</label>
              <textarea
                value={form.excerpt}
                onChange={e => setForm({ ...form, excerpt: e.target.value.slice(0, 200) })}
                rows={2}
                className="w-full bg-[#FBFAF9] border rounded-xl px-4 py-3 text-[12px]"
                placeholder="今年の母の日にぴったりのブーケを5つ厳選しました。札幌からの即日配達も承ります。"
              />
              <p className="text-[10px] text-[#999] text-right">{form.excerpt.length}/160</p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#666]">カバー画像URL（OG画像にも使用）</label>
              <input
                type="url"
                value={form.cover_image_url}
                onChange={e => setForm({ ...form, cover_image_url: e.target.value })}
                className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px]"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#666]">著者名（信頼性向上）</label>
              <input
                type="text"
                value={form.author_name}
                onChange={e => setForm({ ...form, author_name: e.target.value })}
                className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px]"
                placeholder="店主 田中"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#666]">タグ</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {form.tags.map(t => (
                  <span key={t} className="text-[10px] bg-[#F5F2EE] px-2 py-1 rounded-full flex items-center gap-1">
                    #{t}
                    <button onClick={() => setForm({ ...form, tags: form.tags.filter(x => x !== t) })}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
                      setTagInput("");
                    }
                  }}
                  className="flex-1 h-9 bg-[#FBFAF9] border rounded-lg px-3 text-[12px]"
                  placeholder="母の日, ブーケ など Enterで追加"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#666]">本文（Markdown形式）*</label>
              <textarea
                value={form.content_md}
                onChange={e => setForm({ ...form, content_md: e.target.value })}
                rows={18}
                className="w-full bg-[#FBFAF9] border rounded-xl px-4 py-3 text-[12px] font-mono"
                placeholder={`## はじめに\n\n母の日に贈るお花のおすすめをご紹介します。\n\n## 1位：ピンクのバラブーケ\n\n華やかさNo.1のバラのブーケ...`}
              />
              <p className="text-[10px] text-[#999] mt-1">{form.content_md.length} 文字（1500文字以上推奨）</p>
            </div>

            <div className="flex items-center gap-3 bg-[#FBFAF9] rounded-xl p-4">
              <input
                type="checkbox"
                id="is_published"
                checked={form.is_published}
                onChange={e => setForm({ ...form, is_published: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="is_published" className="text-[13px] font-bold cursor-pointer">
                ✅ 公開する（チェックを外すと下書き）
              </label>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] font-bold"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 h-11 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold flex items-center justify-center gap-1"
            >
              <Save size={14} /> 保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
