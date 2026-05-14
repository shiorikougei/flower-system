'use client';
// ===============================================================
// ヘルプツールチップコンポーネント
// ---------------------------------------------------------------
// どこにでも置ける ?アイコン。クリックで吹き出し説明を表示。
//
// 使い方:
//   import HelpTooltip from '@/components/HelpTooltip';
//
//   <HelpTooltip articleId="shift_auto_generate" />          // ヘルプ記事を参照
//   <HelpTooltip text="ここにシンプルな説明" />              // 直接テキスト指定
//   <HelpTooltip title="タイトル" text="内容" linkTo="/staff/help" />
// ===============================================================

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { HelpCircle, ArrowRight, X } from 'lucide-react';
import { getArticle } from '@/utils/helpContent';

export default function HelpTooltip({
  articleId,
  text,
  title,
  linkTo,
  size = 14,
  position = 'auto',  // 'auto' | 'top' | 'bottom' | 'left' | 'right'
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // クリック外で閉じる
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 記事ID指定時はそこから取得
  const article = articleId ? getArticle(articleId) : null;
  const displayTitle = article?.title || title || 'ヒント';
  const displayBody = article?.summary || text || '';
  const helpUrl = articleId ? `/staff/help#${articleId}` : (linkTo || '/staff/help');

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="inline-flex items-center justify-center text-[#999] hover:text-[#2D4B3E] transition-colors align-middle"
        title={displayTitle}
      >
        <HelpCircle size={size} />
      </button>

      {open && (
        <div
          className="absolute z-[300] left-1/2 -translate-x-1/2 top-full mt-2 w-[280px] bg-white border border-[#EAEAEA] rounded-xl shadow-2xl p-4 text-left animate-in fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[12px] font-bold text-[#2D4B3E] leading-tight">{displayTitle}</p>
            <button onClick={() => setOpen(false)} className="text-[#999] hover:text-[#111] -mt-0.5">
              <X size={14}/>
            </button>
          </div>
          {displayBody && <p className="text-[11px] text-[#555] leading-relaxed mb-2 whitespace-pre-line">{displayBody}</p>}
          {article?.steps && (
            <div className="space-y-1 mb-2">
              {article.steps.slice(0, 3).map((s, i) => (
                <div key={i} className="text-[10px] text-[#555] leading-relaxed">
                  <span className="font-bold text-[#117768]">{s.title}</span>
                  {s.body && <span className="text-[#999] ml-1">{s.body}</span>}
                </div>
              ))}
            </div>
          )}
          <Link
            href={helpUrl}
            className="text-[11px] font-bold text-[#117768] hover:underline flex items-center gap-1"
            onClick={() => setOpen(false)}
          >
            詳しく見る <ArrowRight size={11}/>
          </Link>
        </div>
      )}
    </span>
  );
}
