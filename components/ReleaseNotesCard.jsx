'use client';
// スタッフ画面ダッシュボード上部の「お知らせ（更新情報）」カード
// 「確認しました」を押したお知らせは、この端末では表示しない（ブラウザに記録。記録できない環境では毎回表示）
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Megaphone, ChevronRight } from 'lucide-react';
import { getActiveReleaseNotes } from '@/utils/releaseNotes';

const STORAGE_KEY = 'florix_release_notes_seen';

function readSeenRaw() {
  try { return localStorage.getItem(STORAGE_KEY) || '[]'; } catch { return '[]'; }
}
function readSeen() {
  try { return JSON.parse(readSeenRaw()); } catch { return []; }
}
function subscribe(callback) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}
function writeSeen(ids) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* 記録できなくても表示は続ける */ }
}

export default function ReleaseNotesCard() {
  // サーバー側では何も出さず、ブラウザで「確認済み」の記録を読んでから表示する
  const seenRaw = useSyncExternalStore(subscribe, readSeenRaw, () => null);
  const [hiddenNow, setHiddenNow] = useState([]); // この画面で「確認しました」を押したもの（記録できない環境向け）
  if (seenRaw === null) return null;
  let seen = [];
  try { seen = JSON.parse(seenRaw); } catch { seen = []; }
  const notes = getActiveReleaseNotes().filter((n) => !seen.includes(n.id) && !hiddenNow.includes(n.id));

  if (notes.length === 0) return null;

  const markSeen = (id) => {
    writeSeen([...new Set([...readSeen(), id])]);
    setHiddenNow((prev) => [...prev, id]);
  };

  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <div key={n.id} className="bg-white border-2 border-[#117768]/30 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#117768]/10 text-[#117768] flex items-center justify-center shrink-0">
              <Megaphone size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#117768] tracking-widest">お知らせ（更新情報） {n.date.replace(/-/g, '/')}</p>
              <h2 className="text-[16px] font-bold text-[#2D4B3E] mt-1">{n.title}</h2>
              <ul className="mt-3 space-y-2">
                {n.items.map((item, i) => (
                  <li key={i} className="text-[14px] text-[#333] leading-relaxed flex gap-2">
                    <span className="text-[#117768] font-bold shrink-0">・</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {n.helpArticleId && (
                  <Link href={`/staff/help#${n.helpArticleId}`} className="inline-flex items-center gap-1 text-[13px] font-bold text-[#117768] hover:underline">
                    詳しい使い方を見る <ChevronRight size={14} />
                  </Link>
                )}
                <button
                  onClick={() => markSeen(n.id)}
                  className="ml-auto px-4 h-10 rounded-xl bg-[#2D4B3E] text-white text-[13px] font-bold hover:bg-[#1f352b]"
                >
                  確認しました
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
