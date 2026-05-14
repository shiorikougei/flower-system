'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, ChevronRight, RefreshCw, AlertCircle, Heart } from 'lucide-react';
import { getCurrentStaff } from '@/utils/staffRole';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = { sun: '日', mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土' };

export default function MyShiftPage() {
  const today = new Date();
  // 翌月をデフォルトで開く（休み希望提出用）
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const [year, setYear] = useState(nextMonth.getFullYear());
  const [month, setMonth] = useState(nextMonth.getMonth() + 1);
  const [shifts, setShifts] = useState([]);
  const [holidayRequests, setHolidayRequests] = useState([]);
  const [shiftConfig, setShiftConfig] = useState(null);
  const [staffInfo, setStaffInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStaff, setCurrentStaffState] = useState(null);

  useEffect(() => {
    setCurrentStaffState(getCurrentStaff());
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (!profile?.tenant_id) return;
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', profile.tenant_id).single();
        const s = data?.settings_data || {};
        setShiftConfig(s.shiftConfig || {});
        const me = (s.staffList || []).find(x => x.name === getCurrentStaff()?.name);
        setStaffInfo(me);
      } catch {}
    })();
  }, []);

  async function loadData() {
    if (!currentStaff?.name) return;
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const lastDay = new Date(year, month, 0).getDate();
      const from = `${year}-${String(month).padStart(2,'0')}-01`;
      const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      const yearMonth = `${year}-${String(month).padStart(2,'0')}`;
      const [sRes, hRes] = await Promise.all([
        fetch(`/api/staff/shift?from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
        fetch(`/api/staff/holiday-request?yearMonth=${yearMonth}&staff=${encodeURIComponent(currentStaff.name)}`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
      ]);
      setShifts((sRes.items || []).filter(s => s.staff_name === currentStaff.name));
      setHolidayRequests(hRes.items || []);
    } finally { setIsLoading(false); }
  }

  useEffect(() => { loadData(); }, [year, month, currentStaff]);

  const dates = useMemo(() => {
    const arr = [];
    const lastDay = new Date(year, month, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      arr.push({ day: d, dayKey: DAY_KEYS[dateObj.getDay()], dateStr });
    }
    return arr;
  }, [year, month]);

  const shiftMap = useMemo(() => Object.fromEntries(shifts.map(s => [s.date, s])), [shifts]);
  const holidayMap = useMemo(() => Object.fromEntries(holidayRequests.map(h => [h.date, h])), [holidayRequests]);

  // 〆切判定
  const deadlineDay = shiftConfig?.holidayRule?.submitDeadlineDay || 20;
  const yearMonth = `${year}-${String(month).padStart(2,'0')}`;
  const deadlinePassed = (() => {
    // 提出対象月の前月の deadlineDay を過ぎてるかどうか
    const targetFirstDay = new Date(year, month - 1, 1);
    const prevMonth = new Date(targetFirstDay.getFullYear(), targetFirstDay.getMonth() - 1, deadlineDay);
    return today > prevMonth && today < targetFirstDay;
  })();

  async function toggleHoliday(dateStr) {
    if (!currentStaff?.name) {
      alert('左サイドバーからスタッフを選択してください');
      return;
    }
    const existing = holidayMap[dateStr];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (existing) {
        // 削除
        await fetch('/api/staff/holiday-request', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ id: existing.id }),
        });
      } else {
        // 追加
        await fetch('/api/staff/holiday-request', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ staffName: currentStaff.name, yearMonth, date: dateStr }),
        });
      }
      loadData();
    } catch (e) { alert(e.message); }
  }

  function changeMonth(delta) {
    let m = month + delta; let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  if (!currentStaff?.name) {
    return (
      <main className="p-12 text-center">
        <p className="text-[14px] font-bold text-[#999]">左サイドバーから自分のスタッフ名を選択してください</p>
      </main>
    );
  }

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] px-6 md:px-8 py-4 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-bold text-[#2D4B3E] tracking-tight">{currentStaff.name} のシフト</h1>
          <p className="text-[11px] font-bold text-[#999] mt-1">確定シフトの確認 + 希望休の提出</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="w-9 h-9 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg flex items-center justify-center"><ChevronLeft size={16}/></button>
          <span className="text-[15px] font-bold text-[#2D4B3E] min-w-[100px] text-center">{year}年{month}月</span>
          <button onClick={() => changeMonth(1)} className="w-9 h-9 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg flex items-center justify-center"><ChevronRight size={16}/></button>
          <button onClick={loadData} className="ml-2 p-2 hover:bg-[#FBFAF9] rounded-full text-[#999]"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
        </div>
      </header>

      <div className="max-w-[800px] mx-auto p-6 space-y-6">
        {/* 案内 */}
        <div className={`p-4 rounded-2xl border ${deadlinePassed ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'} text-[12px] leading-relaxed`}>
          <p className="font-bold mb-1">
            {deadlinePassed
              ? '⚠️ 提出〆切を過ぎているため、優先度が下がる可能性があります'
              : `📅 ${month}月分の希望休を提出してください（毎月${deadlineDay}日まで）`}
          </p>
          <p className="text-[11px] opacity-80">
            日付をクリックで休み希望を登録/解除できます。確定シフトが表示されている日は変更できません。
          </p>
        </div>

        {/* 月カレンダー */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['日','月','火','水','木','金','土'].map((d, i) => (
              <div key={i} className={`text-center text-[11px] font-bold py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-[#555]'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {/* 月初の空セル */}
            {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {dates.map(d => {
              const sh = shiftMap[d.dateStr];
              const hr = holidayMap[d.dateStr];
              const isFixedOff = staffInfo?.fixedDayOff?.includes(d.dayKey);
              const isLocked = sh && (sh.locked || sh.is_off || !sh.is_off);  // シフト確定済は変更不可
              return (
                <button
                  key={d.dateStr}
                  onClick={() => !sh && toggleHoliday(d.dateStr)}
                  disabled={!!sh}
                  className={`aspect-square rounded-lg border-2 transition-all p-1 text-left flex flex-col ${
                    sh?.is_off ? 'bg-[#D97D54]/10 border-[#D97D54]/30 cursor-not-allowed' :
                    sh ? 'border-[#2D4B3E]/30 cursor-not-allowed' :
                    hr ? 'bg-amber-100 border-amber-400 hover:border-amber-600' :
                    isFixedOff ? 'bg-[#D97D54]/5 border-[#D97D54]/20 cursor-not-allowed' :
                    'bg-white border-[#EAEAEA] hover:border-[#2D4B3E]/40'
                  }`}
                  style={sh && !sh.is_off ? { background: shiftConfig?.patterns?.find(p => p.id === sh.pattern_id)?.color + '40' } : {}}
                >
                  <span className={`text-[12px] font-bold ${
                    d.dayKey === 'sun' ? 'text-red-500' : d.dayKey === 'sat' ? 'text-blue-500' : 'text-[#555]'
                  }`}>{d.day}</span>
                  {sh?.is_off ? (
                    <span className="text-[8px] font-bold text-[#D97D54] mt-auto">確定休</span>
                  ) : sh ? (
                    <div className="text-[8px] mt-auto">
                      <div className="font-bold">{sh.pattern_name}</div>
                      {sh.start_time && <div className="opacity-80">{sh.start_time}-{sh.end_time}</div>}
                    </div>
                  ) : hr ? (
                    <span className="text-[8px] font-bold text-amber-700 mt-auto">🌙 希望休</span>
                  ) : isFixedOff ? (
                    <span className="text-[8px] text-[#D97D54]/60 mt-auto">固休</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* 提出済みリスト */}
        {holidayRequests.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-5">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] mb-3 flex items-center gap-2">
              <Heart size={14} className="text-amber-500"/> 提出済みの希望休 ({holidayRequests.length}日)
            </h3>
            <div className="flex flex-wrap gap-2">
              {holidayRequests.map(h => (
                <div key={h.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-amber-900">
                  {new Date(h.date).getDate()}日 ({DAY_LABELS[DAY_KEYS[new Date(h.date).getDay()]]})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
