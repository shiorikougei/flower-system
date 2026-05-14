'use client';
// ===============================================================
// 印刷用 操作マニュアル（A4縦・全記事展開）
// ---------------------------------------------------------------
// helpContent.js のすべての記事を1ページに展開して、
// 紙のマニュアル冊子として印刷できるようにする。
// ===============================================================

import { HELP_CATEGORIES } from '@/utils/helpContent';
import { Printer, BookOpen } from 'lucide-react';

export default function ManualPage() {
  return (
    <>
      <style jsx global>{`
        @page {
          size: A4;
          margin: 14mm 12mm 14mm 12mm;
        }
        @media print {
          /* サイドバー・ヘッダー・印刷ボタン等を非表示 */
          aside, header, .no-print, footer { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          body { background: white !important; }
          .manual-page { break-inside: avoid; page-break-inside: avoid; }
          .manual-category { break-before: page; page-break-before: always; }
          .manual-category:first-of-type { break-before: avoid; page-break-before: avoid; }
          .manual-article { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8mm; }
          .manual-cover { break-after: page; page-break-after: always; }
          a { text-decoration: none !important; color: inherit !important; }
        }
        .manual-page { font-size: 11pt; line-height: 1.7; color: #111; }
        .manual-page h1 { font-size: 22pt; color: #2D4B3E; }
        .manual-page h2 { font-size: 15pt; color: #2D4B3E; margin-top: 6mm; }
        .manual-page h3 { font-size: 12pt; color: #2D4B3E; }
      `}</style>

      <main className="manual-page max-w-[210mm] mx-auto p-6 bg-white">
        {/* 印刷ボタン（画面のみ表示） */}
        <div className="no-print mb-6 flex items-center justify-between gap-4 sticky top-2 z-10 bg-white border border-[#EAEAEA] rounded-2xl px-6 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-[#2D4B3E]"/>
            <h1 className="text-[16px] font-bold text-[#2D4B3E]">印刷用マニュアル</h1>
            <span className="text-[11px] text-[#999]">Ctrl+P (Cmd+P) で印刷ダイアログを開きます</span>
          </div>
          <button
            onClick={() => window.print()}
            className="h-11 px-6 bg-[#2D4B3E] hover:bg-[#1f352b] text-white text-[12px] font-bold rounded-xl flex items-center gap-2"
          >
            <Printer size={14}/> 印刷する
          </button>
        </div>

        {/* 表紙 */}
        <section className="manual-cover text-center py-16 border-2 border-[#2D4B3E] rounded-2xl mb-10">
          <p className="text-[11pt] tracking-widest text-[#999] mb-2">USER MANUAL</p>
          <h1 className="font-serif italic font-bold text-[#2D4B3E] mb-4" style={{ fontSize: '36pt' }}>FLORIX</h1>
          <p className="text-[14pt] font-bold text-[#2D4B3E] mb-1">操作マニュアル</p>
          <p className="text-[11pt] text-[#555] mb-12">お花屋さん向けクラウド業務システム</p>

          <div className="max-w-md mx-auto mt-12 space-y-2 text-left bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-6 text-[10pt]">
            <p className="font-bold text-[#2D4B3E] mb-2">目次</p>
            {HELP_CATEGORIES.map((cat, i) => (
              <div key={cat.id} className="flex items-center justify-between text-[#555]">
                <span>{cat.icon} {i + 1}. {cat.name}</span>
                <span className="text-[#999]">{cat.articles.length}記事</span>
              </div>
            ))}
          </div>

          <p className="text-[9pt] text-[#999] mt-12">
            提供: NocoLde<br/>
            お問い合わせ: marusyou.reishin@gmail.com
          </p>
        </section>

        {/* 各カテゴリ */}
        {HELP_CATEGORIES.map((cat, ci) => (
          <section key={cat.id} className="manual-category mb-12">
            <div className="border-b-4 border-[#2D4B3E] pb-3 mb-6">
              <p className="text-[10pt] tracking-widest text-[#999]">CHAPTER {ci + 1}</p>
              <h1 className="text-[24pt] font-bold text-[#2D4B3E]">{cat.icon} {cat.name}</h1>
            </div>

            {cat.articles.map((article, ai) => (
              <article key={article.id} className="manual-article mb-8">
                <h2 className="text-[15pt] font-bold text-[#2D4B3E] border-l-4 border-[#2D4B3E] pl-3 mb-2">
                  {ci + 1}.{ai + 1} {article.title}
                </h2>
                {article.summary && (
                  <p className="text-[10pt] text-[#666] italic mb-3 pl-3">{article.summary}</p>
                )}

                {article.steps && article.steps.length > 0 && (
                  <ol className="space-y-2 mt-3">
                    {article.steps.map((s, si) => (
                      <li key={si} className="border border-[#EAEAEA] rounded-lg p-3 bg-[#FBFAF9]">
                        <p className="text-[10pt] font-bold text-[#2D4B3E]">{s.title}</p>
                        {s.body && <p className="text-[10pt] text-[#444] mt-1 leading-relaxed">{s.body}</p>}
                      </li>
                    ))}
                  </ol>
                )}

                {article.tip && (
                  <div className="mt-3 bg-amber-50 border-l-4 border-amber-400 px-3 py-2 text-[10pt] text-amber-900">
                    💡 <strong>POINT:</strong> {article.tip}
                  </div>
                )}
              </article>
            ))}
          </section>
        ))}

        {/* 巻末 */}
        <section className="border-t-2 border-[#EAEAEA] pt-6 mt-12 text-center text-[10pt] text-[#666]">
          <p className="mb-2">困った時は、各画面の <strong>?マーク</strong> をクリックするとその場でヘルプが開きます。</p>
          <p>本マニュアルに記載のない内容は <strong>marusyou.reishin@gmail.com</strong> までお問い合わせください。</p>
          <p className="text-[9pt] text-[#999] mt-4">— NocoLde —</p>
        </section>
      </main>
    </>
  );
}
