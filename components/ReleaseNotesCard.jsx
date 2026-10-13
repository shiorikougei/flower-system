'use client';
// スタッフ画面の「お知らせ（更新情報）」
//   - ReleaseNotesCard  : ダッシュボード上部のカード（内容 + 「確認しました」）
//   - ReleaseNotesBanner: ホーム以外の全画面の上部に出る細い帯（未確認のお知らせがあるときだけ）
//   - useUnseenReleaseNotes: 未確認のお知らせ（サイドバーの件数バッジにも使う）
// 同じ日のお知らせは 1 件にまとめて表示する（件数も日ごと）。「確認しました」はその日の分をまとめて記録する。
// 「確認しました」はこの端末のブラウザに記録する。記録できない環境では、画面を開いている間だけ非表示にする。
import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Megaphone, ChevronRight } from 'lucide-react';
import { getActiveReleaseNotes } from '@/utils/releaseNotes';

const STORAGE_KEY = 'florix_release_notes_seen';
const CHANGE_EVENT = 'florix-release-notes-change';
const memorySeen = new Set();

function readSeenRaw() {
  try { return localStorage.getItem(STORAGE_KEY) || JSON.stringify([...memorySeen]); } catch { return JSON.stringify([...memorySeen]); }
}
function readSeen() {
  try { return JSON.parse(readSeenRaw()); } catch { return []; }
}
function markSeen(ids) {
  ids.forEach((id) => memorySeen.add(id));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...readSeen(), ...ids])])); } catch { /* 記録できなくても続ける */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
function subscribe(callback) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/** お知らせを日付ごとにまとめる（新しい日が先） */
function groupByDate(notes) {
  const groups = [];
  for (const n of notes) {
    let g = groups.find((x) => x.date === n.date);
    if (!g) { g = { date: n.date, ids: [], entries: [] }; groups.push(g); }
    g.ids.push(n.id);
    g.entries.push(n);
  }
  return groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 未確認のお知らせ（日付ごとにまとめたもの）。サーバー側では ready=false（何も表示しない） */
export function useUnseenReleaseNotes() {
  const raw = useSyncExternalStore(subscribe, readSeenRaw, () => null);
  if (raw === null) return { ready: false, notes: [] };
  let seen = [];
  try { seen = JSON.parse(raw); } catch { seen = []; }
  return { ready: true, notes: groupByDate(getActiveReleaseNotes().filter((n) => !seen.includes(n.id))) };
}

export default function ReleaseNotesCard() {
  const { notes } = useUnseenReleaseNotes();
  if (notes.length === 0) return null;

  // [2026-10] 1 枚のカードにまとめ、日付ごとに見出しだけを小さく並べる（押すと内容が開く）
  return (
    <section aria-label="お知らせ（更新情報）" className="bg-white border border-[#117768]/30 rounded-2xl px-4 py-3 md:px-5">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#117768]">
        <Megaphone size={15} aria-hidden="true" /> お知らせ（更新情報）
        <span className="font-normal text-[#5C6660]">・見出しを押すと内容が開きます</span>
      </p>
      <div className="mt-1 divide-y divide-[#E6E2DA]">
        {notes.map((g) => (
          <div key={g.date} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="ui-num text-[13px] font-bold text-[#5C6660]">{g.date.replace(/-/g, '/')}</span>
              <button
                onClick={() => markSeen(g.ids)}
                className="px-3 h-8 rounded-lg border border-[#2D4B3E] text-[#2D4B3E] text-[13px] font-bold hover:bg-[#2D4B3E] hover:text-white"
              >
                確認しました
              </button>
            </div>
            {g.entries.map((n) => (
              <details key={n.id} className="group">
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer min-h-[34px] flex items-center gap-1.5 py-1">
                  <ChevronRight size={15} className="text-[#117768] shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
                  <h2 className="text-[14px] font-bold text-[#2D4B3E] leading-snug">{n.title}</h2>
                </summary>
                <div className="pl-[22px] pb-2">
                  <ul className="space-y-1">
                    {n.items.map((item, i) => (
                      <li key={i} className="text-[14px] text-[#1F2A24] leading-relaxed flex gap-1.5">
                        <span className="text-[#117768] font-bold shrink-0">・</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {n.helpArticleId && (
                    <Link href={`/staff/help#${n.helpArticleId}`} className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-[#117768] hover:underline">
                      詳しい使い方を見る <ChevronRight size={13} />
                    </Link>
                  )}
                </div>
              </details>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** ホーム以外の画面の上部に出る帯。押すとホームのお知らせへ */
export function ReleaseNotesBanner({ pathname }) {
  const { notes } = useUnseenReleaseNotes();
  if (notes.length === 0 || pathname === '/staff') return null;
  return (
    <Link
      href="/staff"
      className="print:hidden flex items-center gap-2 px-4 md:px-8 py-2.5 bg-[#117768] text-white text-[13px] font-bold hover:bg-[#0d5e54]"
    >
      <Megaphone size={15} className="shrink-0" />
      <span className="min-w-0 flex-1">アプリが更新されました。お知らせが {notes.length} 件あります</span>
      <span className="shrink-0 inline-flex items-center gap-0.5 underline">見る <ChevronRight size={14} /></span>
    </Link>
  );
}
