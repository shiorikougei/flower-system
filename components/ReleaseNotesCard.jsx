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

  return (
    <div className="space-y-3">
      {notes.map((g) => (
        <div key={g.date} className="bg-white border-2 border-[#117768]/30 rounded-2xl p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#117768]/10 text-[#117768] flex items-center justify-center shrink-0">
              <Megaphone size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#117768] tracking-widest">お知らせ（更新情報） {g.date.replace(/-/g, '/')}</p>
              <div className="mt-1 divide-y divide-[#EAEAEA]">
                {g.entries.map((n) => (
                  <div key={n.id} className="py-3 first:pt-0 last:pb-0">
                    <h2 className="text-[16px] font-bold text-[#2D4B3E]">{n.title}</h2>
                    <ul className="mt-2 space-y-2">
                      {n.items.map((item, i) => (
                        <li key={i} className="text-[14px] text-[#333] leading-relaxed flex gap-2">
                          <span className="text-[#117768] font-bold shrink-0">・</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    {n.helpArticleId && (
                      <Link href={`/staff/help#${n.helpArticleId}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-bold text-[#117768] hover:underline">
                        詳しい使い方を見る <ChevronRight size={14} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => markSeen(g.ids)}
                  className="px-4 h-10 rounded-xl bg-[#2D4B3E] text-white text-[13px] font-bold hover:bg-[#1f352b]"
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
