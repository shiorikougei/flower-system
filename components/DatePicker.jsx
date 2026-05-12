'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 独自カレンダーUI
 *
 * Props:
 * - value:   "YYYY-MM-DD" 形式の選択中日付（空文字 OK）
 * - onChange: (newValue) => void
 * - minDate: "YYYY-MM-DD" 以前の日付は選択不可
 * - isBlocked: (dateStr) => boolean   休業日などの追加ブロック条件（任意）
 *
 * 特徴:
 * - 選択不可の日（minDate より前 or isBlocked が true）は薄字＆クリック不可
 * - PC・スマホで完全に同じ見た目・動き
 * - タッチ操作しやすい44pxの日付ボタン
 */

function parseDateStr(s) {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DatePicker({ value, onChange, minDate, isBlocked }) {
  // 今日(時刻部分なし)
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  // 表示中の月
  const [displayMonth, setDisplayMonth] = useState(() => {
    const fromValue = parseDateStr(value);
    if (fromValue) return new Date(fromValue.getFullYear(), fromValue.getMonth(), 1);
    const fromMin = parseDateStr(minDate);
    if (fromMin) return new Date(fromMin.getFullYear(), fromMin.getMonth(), 1);
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const minDateObj = useMemo(() => parseDateStr(minDate), [minDate]);
  const selectedDateObj = useMemo(() => parseDateStr(value), [value]);

  // セル一覧（前月分は空セル）
  const cells = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const result = [];
    for (let i = 0; i < startDayOfWeek; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(year, month, d));
    }
    return result;
  }, [displayMonth]);

  const goPrev = () => setDisplayMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNext = () => setDisplayMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const isPastMin = (date) => minDateObj && date < minDateObj;
  const isSelected = (date) => selectedDateObj && date.getTime() === selectedDateObj.getTime();
  const isToday = (date) => date.getTime() === today.getTime();

  const handleClick = (date) => {
    if (isPastMin(date)) return;
    if (isBlocked && isBlocked(formatDateStr(date))) return;
    onChange(formatDateStr(date));
  };

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="bg-white rounded-xl border border-[#EAEAEA] p-3 md:p-4">
      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goPrev}
          aria-label="前の月"
          className="w-10 h-10 rounded-lg hover:bg-[#FBFAF9] flex items-center justify-center text-[#555]"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-[14px] font-bold text-[#111111]">
          {displayMonth.getFullYear()}年 {displayMonth.getMonth() + 1}月
        </p>
        <button
          type="button"
          onClick={goNext}
          aria-label="次の月"
          className="w-10 h-10 rounded-lg hover:bg-[#FBFAF9] flex items-center justify-center text-[#555]"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdays.map((w, i) => (
          <div
            key={w}
            className={`text-center text-[11px] font-bold py-1 ${
              i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[#999]'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 日付セル */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} />;

          const disabled = isPastMin(date);
          const blocked = !disabled && isBlocked && isBlocked(formatDateStr(date));
          const selected = isSelected(date);
          const todayFlag = isToday(date);

          let cls = '';
          if (selected) {
            cls = 'bg-[#2D4B3E] text-white font-bold';
          } else if (disabled) {
            cls = 'text-[#CCC] cursor-not-allowed';
          } else if (blocked) {
            cls = 'text-[#CCC] cursor-not-allowed line-through';
          } else if (todayFlag) {
            cls = 'bg-[#FBFAF9] text-[#2D4B3E] font-bold border border-[#2D4B3E]/30';
          } else {
            cls = 'text-[#333] hover:bg-[#FBFAF9] cursor-pointer';
          }

          return (
            <button
              key={date.getTime()}
              type="button"
              onClick={() => handleClick(date)}
              disabled={disabled || blocked}
              className={`h-11 rounded-lg text-[13px] flex items-center justify-center transition-colors ${cls}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex flex-wrap gap-3 text-[10px] text-[#999]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-[#2D4B3E]" />選択中
        </span>
        <span className="flex items-center gap-1.5 text-[#CCC]">
          <span className="line-through">休</span>休業日
        </span>
        <span className="text-[#CCC]">薄字 = 選択不可</span>
      </div>
    </div>
  );
}
