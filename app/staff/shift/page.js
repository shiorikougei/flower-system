'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, ChevronRight, RefreshCw, Lock, Unlock, X, Save, Sparkles, Heart, BarChart2, CalendarDays, AlertCircle } from 'lucide-react';
import { canCurrent } from '@/utils/staffRole';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = { sun: '日', mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土' };

export default function ShiftPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [shifts, setShifts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [shiftConfig, setShiftConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editCell, setEditCell] = useState(null); // { staff, date, current }
  const [customMode, setCustomMode] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', startTime: '10:00', endTime: '18:00' });
  const [allowed, setAllowed] = useState(true);
  const [holidayRequests, setHolidayRequests] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [viewMode, setViewMode] = useState('shift'); // 'shift' | 'holiday' | 'attendance_check'
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setAllowed(canCurrent('manageStaff'));
  }, []);

  // 設定取得（スタッフリスト・シフト設定）
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (!profile?.tenant_id) return;
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', profile.tenant_id).single();
        const s = data?.settings_data || {};
        setStaffList(s.staffList || []);
        setShiftConfig(s.shiftConfig || { patterns: [], requiredStaff: {}, holidayRule: {} });
      } catch {}
    })();
  }, []);

  async function loadShifts() {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const lastDay = new Date(year, month, 0).getDate();
      const from = `${year}-${String(month).padStart(2,'0')}-01`;
      const to = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      const yearMonth = `${year}-${String(month).padStart(2,'0')}`;
      const headers = { Authorization: `Bearer ${session.access_token}` };
      // ★ 軽量化: シフト+希望休だけ常にロード、attendanceは照合モード時だけ
      const promises = [
        fetch(`/api/staff/shift?from=${from}&to=${to}`, { headers }).then(r => r.json()),
        fetch(`/api/staff/holiday-request?yearMonth=${yearMonth}`, { headers }).then(r => r.json()).catch(() => ({ items: [] })),
      ];
      if (viewMode === 'attendance_check') {
        promises.push(fetch(`/api/staff/attendance?from=${from}&to=${to}`, { headers }).then(r => r.json()).catch(() => ({ items: [] })));
      }
      const results = await Promise.all(promises);
      setShifts(results[0].items || []);
      setHolidayRequests(results[1].items || []);
      if (results[2]) setAttendance(results[2].items || []);
    } finally { setIsLoading(false); }
  }

  async function generateShifts() {
    if (!confirm(`${year}年${month}月のシフトを自動生成しますか？\n（ロック済みのシフトは保持されます）`)) return;
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const yearMonth = `${year}-${String(month).padStart(2,'0')}`;
      const res = await fetch('/api/staff/shift-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ yearMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message + (data.lackingDays?.length > 0 ? `\n\n人手不足の日:\n${data.lackingDays.map(l => `${l.date} (${l.actual}/${l.needed}名)`).join('\n')}` : ''));
      loadShifts();
    } catch (e) { alert(e.message); }
    finally { setIsGenerating(false); }
  }

  useEffect(() => { loadShifts(); }, [year, month, viewMode]);

  // カレンダーの日付配列を生成
  const dates = useMemo(() => {
    const arr = [];
    const lastDay = new Date(year, month, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      arr.push({
        day: d,
        dayKey: DAY_KEYS[dateObj.getDay()],
        dateStr,
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      });
    }
    return arr;
  }, [year, month]);

  // [staff_name][date] = shift
  const shiftMap = useMemo(() => {
    const m = {};
    shifts.forEach(sh => {
      if (!m[sh.staff_name]) m[sh.staff_name] = {};
      m[sh.staff_name][sh.date] = sh;
    });
    return m;
  }, [shifts]);

  // 必要人数 vs 実際の出勤人数
  const dailyCount = useMemo(() => {
    const c = {};
    dates.forEach(d => {
      const working = shifts.filter(s => s.date === d.dateStr && !s.is_off).length;
      const required = shiftConfig?.requiredStaff?.[d.dayKey] ?? 1;
      c[d.dateStr] = { working, required, lacking: working < required };
    });
    return c;
  }, [shifts, dates, shiftConfig]);

  async function saveCell(payload) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/staff/shift', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('保存失敗');
      setEditCell(null);
      loadShifts();
    } catch (e) { alert(e.message); }
  }

  async function clearCell(staffName, date) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/staff/shift', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ staffName, date }),
      });
      setEditCell(null);
      loadShifts();
    } catch (e) { alert(e.message); }
  }

  function changeMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m); setYear(y);
  }

  if (!allowed) {
    return <main className="p-12 text-center"><p className="text-[14px] font-bold text-[#999]">この画面はオーナー権限が必要です</p></main>;
  }

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] px-6 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-[18px] md:text-[20px] font-bold text-[#2D4B3E] tracking-tight">シフト管理</h1>
            <p className="text-[11px] font-bold text-[#999] mt-1">月別シフトの確認・編集・自動生成</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={generateShifts} disabled={isGenerating} className="bg-[#117768] text-white text-[12px] font-bold px-4 h-9 rounded-lg hover:bg-[#0f6a5b] disabled:opacity-50 flex items-center gap-1.5">
              <Sparkles size={14}/> {isGenerating ? '生成中...' : '自動生成'}
            </button>
            <button onClick={() => changeMonth(-1)} className="w-9 h-9 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg flex items-center justify-center hover:bg-[#EAEAEA]"><ChevronLeft size={16}/></button>
            <span className="text-[15px] font-bold text-[#2D4B3E] min-w-[100px] text-center">{year}年{month}月</span>
            <button onClick={() => changeMonth(1)} className="w-9 h-9 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg flex items-center justify-center hover:bg-[#EAEAEA]"><ChevronRight size={16}/></button>
            <button onClick={loadShifts} className="p-2 hover:bg-[#FBFAF9] rounded-full text-[#999]"><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''}/></button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setViewMode('shift')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg ${viewMode === 'shift' ? 'bg-[#2D4B3E] text-white' : 'bg-[#FBFAF9] text-[#555]'}`}>
            <CalendarDays size={11} className="inline mr-1"/> シフト表
          </button>
          <button onClick={() => setViewMode('holiday')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg ${viewMode === 'holiday' ? 'bg-[#2D4B3E] text-white' : 'bg-[#FBFAF9] text-[#555]'}`}>
            <Heart size={11} className="inline mr-1"/> 希望休一覧 ({holidayRequests.length})
          </button>
          <button onClick={() => setViewMode('attendance_check')} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg ${viewMode === 'attendance_check' ? 'bg-[#2D4B3E] text-white' : 'bg-[#FBFAF9] text-[#555]'}`}>
            <BarChart2 size={11} className="inline mr-1"/> 打刻照合
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 md:p-6">
        {staffList.length === 0 ? (
          <p className="p-12 text-center text-[#999] text-[13px]">スタッフが登録されていません。設定→スタッフ管理から追加してください。</p>
        ) : viewMode === 'holiday' ? (
          // ★ 希望休一覧モード
          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm p-5">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] mb-4 flex items-center gap-2">
              <Heart size={14} className="text-amber-500"/> {year}年{month}月の希望休
            </h3>
            {holidayRequests.length === 0 ? (
              <p className="text-[12px] text-[#999] text-center py-8">提出された希望休はありません</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(holidayRequests.reduce((acc, h) => {
                  if (!acc[h.staff_name]) acc[h.staff_name] = [];
                  acc[h.staff_name].push(h);
                  return acc;
                }, {})).map(([name, reqs]) => (
                  <div key={name} className="bg-[#FBFAF9] rounded-xl p-3 border border-[#EAEAEA]">
                    <p className="text-[13px] font-bold text-[#111] mb-2">{name} <span className="text-[10px] text-[#999] font-normal ml-1">{reqs.length}日</span></p>
                    <div className="flex flex-wrap gap-1.5">
                      {reqs.sort((a,b) => a.date.localeCompare(b.date)).map(r => (
                        <span key={r.id} className="bg-amber-100 border border-amber-300 rounded px-2 py-1 text-[11px] font-bold text-amber-900">
                          {new Date(r.date).getDate()}日 ({DAY_LABELS[DAY_KEYS[new Date(r.date).getDay()]]})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : viewMode === 'attendance_check' ? (
          // ★ 打刻 vs シフト 照合モード
          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#EAEAEA]">
              <h3 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2">
                <BarChart2 size={14}/> 予定 vs 実績 ({year}年{month}月)
              </h3>
              <p className="text-[10px] text-[#999] mt-1">遅刻=出勤打刻 &gt; 予定+15分 / 早退=退勤打刻 &lt; 予定-15分 / 欠勤=予定あり打刻なし</p>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-[#FBFAF9] border-b border-[#EAEAEA] text-[10px] font-bold text-[#999]">
                <tr>
                  <th className="px-3 py-2 text-left">日付</th>
                  <th className="px-3 py-2 text-left">スタッフ</th>
                  <th className="px-3 py-2 text-left">予定</th>
                  <th className="px-3 py-2 text-left">実績</th>
                  <th className="px-3 py-2 text-center">判定</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F7F7]">
                {(() => {
                  // シフトと打刻を日付・スタッフでマッチング
                  const rows = [];
                  shifts.filter(s => !s.is_off).forEach(sh => {
                    const att = attendance.find(a =>
                      a.staff_name === sh.staff_name &&
                      a.clock_in_at?.split('T')[0] === sh.date
                    );
                    let status = '正常';
                    let statusClass = 'text-green-600 bg-green-50';
                    if (!att) { status = '欠勤'; statusClass = 'text-red-600 bg-red-50'; }
                    else {
                      const planStart = sh.start_time ? new Date(`${sh.date}T${sh.start_time}:00`) : null;
                      const planEnd = sh.end_time ? new Date(`${sh.date}T${sh.end_time}:00`) : null;
                      const actStart = new Date(att.clock_in_at);
                      const actEnd = att.clock_out_at ? new Date(att.clock_out_at) : null;
                      const issues = [];
                      if (planStart && (actStart - planStart) > 15 * 60000) issues.push('遅刻');
                      if (planEnd && actEnd && (planEnd - actEnd) > 15 * 60000) issues.push('早退');
                      if (planEnd && !actEnd) issues.push('退勤忘れ?');
                      if (issues.length > 0) {
                        status = issues.join('+');
                        statusClass = 'text-amber-600 bg-amber-50';
                      }
                    }
                    rows.push({ sh, att, status, statusClass });
                  });
                  if (rows.length === 0) {
                    return <tr><td colSpan="5" className="text-center py-8 text-[#999]">シフト or 打刻データがありません</td></tr>;
                  }
                  return rows.sort((a,b) => a.sh.date.localeCompare(b.sh.date)).map(({ sh, att, status, statusClass }, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono">{sh.date.slice(5)}</td>
                      <td className="px-3 py-2 font-bold">{sh.staff_name}</td>
                      <td className="px-3 py-2 text-[#555]">{sh.start_time}-{sh.end_time}</td>
                      <td className="px-3 py-2 text-[#555]">{att ? `${new Date(att.clock_in_at).toTimeString().slice(0,5)}-${att.clock_out_at ? new Date(att.clock_out_at).toTimeString().slice(0,5) : '出勤中'}` : '-'}</td>
                      <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusClass}`}>{status}</span></td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm overflow-x-auto">
            <table className="border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#FBFAF9] border border-[#EAEAEA] px-3 py-2 min-w-[120px] text-left font-bold text-[#999]">スタッフ</th>
                  {dates.map(d => (
                    <th key={d.dateStr} className={`border border-[#EAEAEA] px-1 py-2 min-w-[44px] font-bold ${
                      d.dayKey === 'sun' ? 'text-red-500 bg-red-50' : d.dayKey === 'sat' ? 'text-blue-500 bg-blue-50' : 'text-[#555] bg-[#FBFAF9]'
                    }`}>
                      <div>{d.day}</div>
                      <div className="text-[9px] opacity-70">{DAY_LABELS[d.dayKey]}</div>
                    </th>
                  ))}
                </tr>
                {/* 必要人数 vs 実数の行 */}
                <tr>
                  <th className="sticky left-0 z-20 bg-white border border-[#EAEAEA] px-3 py-1.5 text-right text-[9px] font-bold text-[#999]">出勤数 / 必要</th>
                  {dates.map(d => {
                    const c = dailyCount[d.dateStr];
                    return (
                      <th key={d.dateStr} className={`border border-[#EAEAEA] px-0.5 py-1.5 font-bold text-[10px] ${
                        c?.lacking ? 'bg-red-50 text-red-600' : 'bg-white text-[#555]'
                      }`}>
                        {c?.working ?? 0}/{c?.required ?? 0}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staffList.map(s => (
                  <tr key={s.name}>
                    <td className="sticky left-0 z-10 bg-white border border-[#EAEAEA] px-3 py-2 font-bold text-[12px] min-w-[120px]">
                      <div>{s.name}</div>
                      {Array.isArray(s.fixedDayOff) && s.fixedDayOff.length > 0 && (
                        <div className="text-[8px] text-[#D97D54] font-normal mt-0.5">固休: {s.fixedDayOff.map(k => DAY_LABELS[k] || (k === 'holiday' ? '祝' : k)).join('')}</div>
                      )}
                    </td>
                    {dates.map(d => {
                      const sh = shiftMap[s.name]?.[d.dateStr];
                      const isFixedOff = Array.isArray(s.fixedDayOff) && s.fixedDayOff.includes(d.dayKey);
                      return (
                        <td
                          key={d.dateStr}
                          onClick={() => setEditCell({ staff: s, date: d.dateStr, current: sh })}
                          className={`border border-[#EAEAEA] cursor-pointer hover:opacity-80 transition-all p-1 text-center ${
                            sh?.is_off ? 'bg-[#D97D54]/10 text-[#D97D54]' :
                            sh ? '' :
                            isFixedOff ? 'bg-[#D97D54]/5' : 'bg-white'
                          }`}
                          style={sh && !sh.is_off ? { background: shiftConfig?.patterns?.find(p => p.id === sh.pattern_id)?.color + '60' } : {}}
                        >
                          {sh?.is_off ? (
                            <span className="text-[10px] font-bold">休</span>
                          ) : sh ? (
                            <div className="text-[9px] font-bold leading-tight">
                              {sh.pattern_name && <div>{sh.pattern_name}</div>}
                              {sh.start_time && sh.end_time && (
                                <div className="text-[8px] opacity-80">{sh.start_time}-{sh.end_time}</div>
                              )}
                              {sh.locked && <Lock size={8} className="inline"/>}
                            </div>
                          ) : isFixedOff ? (
                            <span className="text-[9px] text-[#D97D54]/60">固休</span>
                          ) : (
                            <span className="text-[#CCC]">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editCell && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setEditCell(null); setCustomMode(false); }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-[#111]">{editCell.staff.name}</h3>
                <p className="text-[11px] text-[#999]">{editCell.date}</p>
              </div>
              <button onClick={() => { setEditCell(null); setCustomMode(false); }} className="text-[#999] hover:text-[#111]"><X size={18}/></button>
            </div>

            {!customMode ? (
              <>
                {/* シフトパターン選択 */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-[#555]">シフトを選択</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(shiftConfig?.patterns || []).map(p => (
                      <button
                        key={p.id}
                        onClick={() => saveCell({
                          staffName: editCell.staff.name,
                          date: editCell.date,
                          patternId: p.id,
                          patternName: p.name,
                          startTime: p.startTime,
                          endTime: p.endTime,
                          isOff: false,
                          locked: editCell.current?.locked || false,
                        })}
                        className="p-3 rounded-xl border border-[#EAEAEA] hover:border-[#2D4B3E] text-left"
                        style={{ background: p.color + '40' }}
                      >
                        <p className="text-[13px] font-bold">{p.name}</p>
                        <p className="text-[10px] text-[#555]">{p.startTime}〜{p.endTime}</p>
                      </button>
                    ))}
                    <button
                      onClick={() => saveCell({
                        staffName: editCell.staff.name,
                        date: editCell.date,
                        isOff: true,
                        locked: editCell.current?.locked || false,
                      })}
                      className="p-3 rounded-xl border border-[#D97D54]/40 bg-[#D97D54]/10 hover:bg-[#D97D54]/20 text-left"
                    >
                      <p className="text-[13px] font-bold text-[#D97D54]">休み</p>
                      <p className="text-[10px] text-[#999]">出勤なし</p>
                    </button>
                    {/* ★ カスタム時間 */}
                    <button
                      onClick={() => {
                        setCustomMode(true);
                        // 既存値があればプリセット
                        setCustomForm({
                          name: editCell.current?.pattern_name || '',
                          startTime: editCell.current?.start_time || '10:00',
                          endTime: editCell.current?.end_time || '18:00',
                        });
                      }}
                      className="p-3 rounded-xl border border-dashed border-[#117768]/50 bg-[#117768]/5 hover:bg-[#117768]/10 text-left"
                    >
                      <p className="text-[13px] font-bold text-[#117768]">⏱ カスタム時間</p>
                      <p className="text-[10px] text-[#999]">時刻を自由入力</p>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* カスタム時間入力 */}
                <div className="space-y-3">
                  <button onClick={() => setCustomMode(false)} className="text-[10px] text-[#999] hover:text-[#2D4B3E]">← パターン選択に戻る</button>
                  <p className="text-[11px] font-bold text-[#117768]">⏱ カスタム時間で登録</p>
                  <div>
                    <label className="text-[10px] font-bold text-[#999] tracking-widest">名称（任意）</label>
                    <input
                      type="text"
                      value={customForm.name}
                      onChange={e => setCustomForm({...customForm, name: e.target.value})}
                      placeholder="例: 研修・短時間・臨時 など"
                      className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-[#999] tracking-widest">開始</label>
                      <input
                        type="time"
                        value={customForm.startTime}
                        onChange={e => setCustomForm({...customForm, startTime: e.target.value})}
                        className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"
                      />
                    </div>
                    <span className="text-[#999] mt-5">〜</span>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-[#999] tracking-widest">終了</label>
                      <input
                        type="time"
                        value={customForm.endTime}
                        onChange={e => setCustomForm({...customForm, endTime: e.target.value})}
                        className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!customForm.startTime || !customForm.endTime) { alert('開始・終了時刻を入力してください'); return; }
                      if (customForm.endTime <= customForm.startTime) { alert('終了時刻は開始時刻より後にしてください'); return; }
                      saveCell({
                        staffName: editCell.staff.name,
                        date: editCell.date,
                        patternId: 'custom',
                        patternName: customForm.name || `${customForm.startTime}-${customForm.endTime}`,
                        startTime: customForm.startTime,
                        endTime: customForm.endTime,
                        isOff: false,
                        locked: editCell.current?.locked || false,
                      });
                      setCustomMode(false);
                    }}
                    className="w-full h-11 bg-[#117768] text-white text-[13px] font-bold rounded-lg hover:bg-[#0f6a5b]"
                  >
                    この時間で登録
                  </button>
                </div>
              </>
            )}

            {/* ロック切替・削除 */}
            <div className="flex gap-2 pt-3 border-t border-[#EAEAEA]">
              {editCell.current && (
                <>
                  <button
                    onClick={() => saveCell({
                      ...editCell.current,
                      staffName: editCell.staff.name,
                      date: editCell.date,
                      patternId: editCell.current.pattern_id,
                      patternName: editCell.current.pattern_name,
                      startTime: editCell.current.start_time,
                      endTime: editCell.current.end_time,
                      isOff: editCell.current.is_off,
                      locked: !editCell.current.locked,
                    })}
                    className="flex-1 h-10 bg-[#FBFAF9] border border-[#EAEAEA] text-[#555] text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 hover:bg-[#EAEAEA]"
                  >
                    {editCell.current.locked ? <><Unlock size={12}/> ロック解除</> : <><Lock size={12}/> ロック</>}
                  </button>
                  <button
                    onClick={() => clearCell(editCell.staff.name, editCell.date)}
                    className="flex-1 h-10 bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold rounded-lg hover:bg-red-100"
                  >
                    クリア（未割当に戻す）
                  </button>
                </>
              )}
            </div>
            <p className="text-[10px] text-[#999] leading-relaxed">
              💡 ロックすると、自動シフト作成（次フェーズで実装予定）で上書きされなくなります
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
