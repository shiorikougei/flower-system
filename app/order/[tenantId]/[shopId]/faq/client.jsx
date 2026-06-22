// FAQページのクライアントUI
// アコーディオン式で見やすく、SEOにも有利な構造化マークアップ

"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, HelpCircle, Search, Pin, Phone, MessageCircle, ShoppingBag, Sparkles, Home } from "lucide-react";

export default function FaqClient({ grouped, shop, tenantId, shopId }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openIds, setOpenIds] = useState(new Set());

  const shopName = shop.name || "FLORIX";

  // 検索フィルタ
  const filtered = grouped
    .map((group) => {
      const items = group.items.filter((item) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q)
        );
      });
      return { ...group, items };
    })
    .filter((g) => g.items.length > 0);

  function toggleOpen(id) {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  }

  function openAll() {
    const all = new Set();
    grouped.forEach((g, gi) => g.items.forEach((_, ii) => all.add(`${gi}-${ii}`)));
    setOpenIds(all);
  }

  function closeAll() {
    setOpenIds(new Set());
  }

  return (
    <main className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-[900px] mx-auto h-16 px-6 flex items-center justify-between">
          <Link
            href={`/order/${tenantId}/${shopId}`}
            className="flex items-center gap-1 text-[12px] font-bold text-[#555555] hover:text-[#2D4B3E]"
          >
            <ChevronLeft size={16} /> 店舗トップに戻る
          </Link>
          <span className="font-serif font-bold text-[14px] text-[#2D4B3E] truncate">
            {shopName}
          </span>
        </div>
      </header>

      <div className="max-w-[900px] mx-auto p-6 md:p-8">
        {/* タイトル */}
        <div className="mb-8 text-center">
          <HelpCircle size={40} className="mx-auto text-[#2D4B3E] mb-3" />
          <h1 className="text-[24px] md:text-[32px] font-bold text-[#2D4B3E] mb-2">
            よくあるご質問
          </h1>
          <p className="text-[12px] md:text-[13px] text-[#555] leading-relaxed">
            ご注文・配送・お花のお手入れ・お支払いまで、ご質問の多い内容をまとめました
          </p>
        </div>

        {/* 検索 */}
        <div className="bg-white border border-[#EAEAEA] rounded-2xl p-4 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#999]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="質問・答えのキーワードで検索..."
              className="w-full h-11 pl-10 pr-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={openAll}
              className="text-[11px] font-bold text-[#2D4B3E] hover:underline"
            >
              すべて開く
            </button>
            <span className="text-[#CCC]">/</span>
            <button
              onClick={closeAll}
              className="text-[11px] font-bold text-[#999] hover:underline"
            >
              すべて閉じる
            </button>
          </div>
        </div>

        {/* 該当なし */}
        {filtered.length === 0 && (
          <div className="bg-white border border-dashed border-[#EAEAEA] rounded-2xl p-12 text-center">
            <p className="text-[14px] font-bold text-[#999]">該当する質問が見つかりません</p>
            <p className="text-[11px] text-[#CCC] mt-2">別のキーワードでお試しください</p>
          </div>
        )}

        {/* FAQ リスト（カテゴリ別） */}
        {filtered.map((group, groupIdx) => (
          <section key={group.category} className="mb-8">
            <h2 className="text-[16px] md:text-[18px] font-bold text-[#2D4B3E] border-b-2 border-[#2D4B3E] pb-2 mb-3 flex items-center gap-2">
              <Pin size={16}/> {group.category}
            </h2>
            <div className="space-y-2">
              {group.items.map((item, itemIdx) => {
                const id = `${groupIdx}-${itemIdx}`;
                const isOpen = openIds.has(id);
                return (
                  <article
                    key={id}
                    itemScope
                    itemType="https://schema.org/Question"
                    className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden hover:border-[#2D4B3E]/30 transition-all"
                  >
                    <button
                      onClick={() => toggleOpen(id)}
                      className="w-full p-4 flex items-start justify-between gap-3 text-left hover:bg-[#FBFAF9]"
                      aria-expanded={isOpen}
                    >
                      <span
                        itemProp="name"
                        className="text-[13px] md:text-[14px] font-bold text-[#111] leading-relaxed flex-1"
                      >
                        Q. {item.question}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-[#2D4B3E] shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div
                        itemProp="acceptedAnswer"
                        itemScope
                        itemType="https://schema.org/Answer"
                        className="px-4 pb-4 pt-1 border-t border-[#F0F0F0]"
                      >
                        <p
                          itemProp="text"
                          className="text-[12px] md:text-[13px] text-[#555] leading-relaxed whitespace-pre-wrap"
                        >
                          <span className="text-[#2D4B3E] font-bold">A. </span>
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {/* お問い合わせCTA */}
        <div className="mt-12 bg-gradient-to-br from-[#2D4B3E] to-[#1f352b] text-white rounded-2xl p-6 md:p-8 text-center">
          <h3 className="text-[16px] md:text-[18px] font-bold mb-2">
            解決しないご質問は
          </h3>
          <p className="text-[12px] md:text-[13px] opacity-90 mb-5 leading-relaxed">
            上記で解決しない場合は、お気軽にお問い合わせください。<br />
            スタッフが直接ご対応いたします。
          </p>
          <div className="flex flex-col md:flex-row gap-3 justify-center">
            {shop.phone && (
              <a
                href={`tel:${shop.phone}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#2D4B3E] rounded-xl text-[13px] font-bold hover:bg-[#FBFAF9]"
              >
                <Phone size={14}/> {shop.phone}
              </a>
            )}
            <Link
              href={`/order/${tenantId}/${shopId}/estimate`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl text-[13px] font-bold hover:bg-amber-700"
            >
              <MessageCircle size={14}/> お見積もり相談
            </Link>
          </div>
        </div>

        {/* 関連リンク */}
        <nav className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3" aria-label="店舗ページ">
          <Link
            href={`/order/${tenantId}/${shopId}/shop`}
            className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] text-center"
          >
            <p className="text-[12px] font-bold text-[#2D4B3E] flex items-center justify-center gap-1"><ShoppingBag size={13}/> 商品一覧</p>
          </Link>
          <Link
            href={`/order/${tenantId}/${shopId}/custom`}
            className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] text-center"
          >
            <p className="text-[12px] font-bold text-[#2D4B3E] flex items-center justify-center gap-1"><Sparkles size={13}/> カスタム注文</p>
          </Link>
          <Link
            href={`/order/${tenantId}/${shopId}`}
            className="block p-4 bg-white border border-[#EAEAEA] rounded-xl hover:border-[#2D4B3E] text-center"
          >
            <p className="text-[12px] font-bold text-[#2D4B3E] flex items-center justify-center gap-1"><Home size={13}/> 店舗トップ</p>
          </Link>
        </nav>
      </div>
    </main>
  );
}
