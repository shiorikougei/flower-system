'use client';
import { useState, useMemo, useEffect } from 'react';
import { HELP_CATEGORIES, getAllArticles } from '@/utils/helpContent';
import { Search, ChevronDown, ChevronRight, BookOpen, Printer } from 'lucide-react';

export default function HelpCenterPage() {
  const [query, setQuery] = useState('');
  const [openArticle, setOpenArticle] = useState(null);

  // URL hash でスクロール対象を取得
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash?.slice(1);
    if (hash) {
      setOpenArticle(hash);
      setTimeout(() => {
        const el = document.getElementById(`article-${hash}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, []);

  // 検索結果
  const allArticles = useMemo(() => getAllArticles(), []);
  const filteredArticles = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return allArticles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.summary?.toLowerCase().includes(q) ||
      a.steps?.some(s => s.title.toLowerCase().includes(q) || s.body?.toLowerCase().includes(q))
    );
  }, [query, allArticles]);

  function printGuide() {
    window.print();
  }

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] px-6 md:px-8 py-4 sticky top-0 z-10 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-[18px] md:text-[20px] font-bold text-[#2D4B3E] tracking-tight flex items-center gap-2">
              <BookOpen size={20}/> ヘルプセンター
            </h1>
            <p className="text-[11px] font-bold text-[#999] mt-1">機能の使い方・設定方法・トラブル対処</p>
          </div>
          <button onClick={printGuide} className="flex items-center gap-1.5 bg-[#FBFAF9] border border-[#EAEAEA] text-[#555] text-[11px] font-bold px-3 py-2 rounded-lg hover:bg-[#EAEAEA]">
            <Printer size={14}/> マニュアル印刷
          </button>
        </div>

        {/* 検索バー */}
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]"/>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="機能名・操作・困りごとなどで検索..."
            className="w-full h-10 pl-9 pr-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
          />
        </div>
      </header>

      <div className="max-w-[900px] mx-auto p-6 md:p-8 space-y-8">
        {/* 検索結果モード */}
        {filteredArticles ? (
          <div>
            <p className="text-[12px] text-[#999] mb-4">「{query}」の検索結果: {filteredArticles.length}件</p>
            {filteredArticles.length === 0 ? (
              <p className="text-center py-12 text-[13px] text-[#999]">該当する記事がありません</p>
            ) : (
              <div className="space-y-3">
                {filteredArticles.map(a => (
                  <ArticleCard key={a.id} article={a} isOpen={openArticle === a.id} onToggle={() => setOpenArticle(openArticle === a.id ? null : a.id)}/>
                ))}
              </div>
            )}
          </div>
        ) : (
          // カテゴリ別表示モード
          <>
            {/* カテゴリ目次 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 print:hidden">
              {HELP_CATEGORIES.map(c => (
                <a key={c.id} href={`#cat-${c.id}`} className="bg-white border border-[#EAEAEA] rounded-xl p-3 hover:border-[#2D4B3E] hover:shadow-md transition-all">
                  <div className="text-[20px]">{c.icon}</div>
                  <div className="text-[12px] font-bold text-[#2D4B3E] mt-1">{c.name}</div>
                  <div className="text-[10px] text-[#999] mt-0.5">{c.articles.length}件の記事</div>
                </a>
              ))}
            </div>

            {/* カテゴリ別記事一覧 */}
            {HELP_CATEGORIES.map(c => (
              <section key={c.id} id={`cat-${c.id}`}>
                <h2 className="text-[16px] font-bold text-[#2D4B3E] mb-3 flex items-center gap-2 pb-2 border-b border-[#EAEAEA]">
                  <span className="text-[22px]">{c.icon}</span>
                  {c.name}
                </h2>
                <div className="space-y-3">
                  {c.articles.map(a => (
                    <ArticleCard
                      key={a.id}
                      article={{ ...a, category: c.name, categoryId: c.id, categoryIcon: c.icon }}
                      isOpen={openArticle === a.id}
                      onToggle={() => setOpenArticle(openArticle === a.id ? null : a.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          aside { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          /* 全記事を開いた状態で印刷 */
          [data-article-detail] { display: block !important; }
        }
      `}</style>
    </main>
  );
}

function ArticleCard({ article, isOpen, onToggle }) {
  return (
    <div id={`article-${article.id}`} className="bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between gap-3 hover:bg-[#FBFAF9] transition-colors text-left print:hidden"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#111]">{article.title}</p>
          {article.summary && <p className="text-[11px] text-[#999] mt-1">{article.summary}</p>}
        </div>
        {isOpen ? <ChevronDown size={18} className="text-[#999] shrink-0"/> : <ChevronRight size={18} className="text-[#999] shrink-0"/>}
      </button>
      {/* 印刷時は常に展開 */}
      <div className="print:block" data-article-detail style={{ display: isOpen ? 'block' : 'none' }}>
        {/* 印刷時のタイトル */}
        <div className="hidden print:block px-4 pt-4">
          <p className="text-[13pt] font-bold">{article.title}</p>
          {article.summary && <p className="text-[10pt] text-[#666] mt-1">{article.summary}</p>}
        </div>

        <div className="px-4 pb-4 pt-1 space-y-3">
          {article.steps?.length > 0 && (
            <div className="bg-[#FBFAF9] rounded-xl p-3 space-y-2">
              {article.steps.map((s, i) => (
                <div key={i} className="text-[12px]">
                  <p className="font-bold text-[#117768]">{s.title}</p>
                  {s.body && <p className="text-[#555] mt-0.5 ml-3 leading-relaxed">{s.body}</p>}
                </div>
              ))}
            </div>
          )}
          {article.tip && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
              💡 <strong>ヒント:</strong> {article.tip}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
