'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { canCurrent } from '@/utils/staffRole';
import { calcPayroll, getPayrollWarnings, DEFAULT_PAYROLL_CONFIG } from '@/utils/payroll';
import { Clock, RefreshCw, Edit2, Trash2, Plus, X, FileText, AlertCircle } from 'lucide-react';

export default function AttendancePage() {
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allowed, setAllowed] = useState(true);

  // 編集モーダル
  const [editForm, setEditForm] = useState(null);
  const [staffList, setStaffList] = useState([]);

  // 給与計算
  const [payrollConfig, setPayrollConfig] = useState(DEFAULT_PAYROLL_CONFIG);
  const [allYearAttendance, setAllYearAttendance] = useState([]);
  const [appName, setAppName] = useState('');

  useEffect(() => { setAllowed(canCurrent('manageStaff')); }, []);

  async function loadAttendance() {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/staff/attendance', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setAttendance(data.items || []);
      setSummary(data.summary || []);
    } finally { setIsLoading(false); }
  }

  // 設定取得（軽量）
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
        if (s.payrollConfig) setPayrollConfig({...DEFAULT_PAYROLL_CONFIG, ...s.payrollConfig});
        setAppName(s.generalConfig?.appName || '');
      } catch {}
    })();
    loadAttendance();
  }, []);

  // 年間勤怠は給与計算ON時のみ
  useEffect(() => {
    if (!payrollConfig.enabled || allYearAttendance.length > 0) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const yearStart = `${new Date().getFullYear()}-01-01`;
        const yearRes = await fetch(`/api/staff/attendance?from=${yearStart}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then(r => r.json()).catch(() => ({ items: [] }));
        setAllYearAttendance(yearRes.items || []);
      } catch {}
    })();
  }, [payrollConfig.enabled, allYearAttendance.length]);

  function fmtDate(s) {
    if (!s) return '-';
    return new Date(s).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function toLocalInput(s) {
    if (!s) return '';
    const d = new Date(s);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromLocalInput(v) { return v ? new Date(v).toISOString() : null; }

  async function saveAttendance() {
    if (!editForm?.staffName || !editForm?.clockInAt) {
      alert('スタッフと出勤時刻を入力してください');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        ...editForm,
        clockInAt: fromLocalInput(editForm.clockInAt),
        clockOutAt: fromLocalInput(editForm.clockOutAt),
      };
      const res = await fetch('/api/staff/attendance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditForm(null);
      loadAttendance();
    } catch (e) { alert(e.message); }
  }

  async function deleteAttendance(id) {
    if (!confirm('この打刻記録を削除しますか？')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/staff/attendance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('削除失敗');
      loadAttendance();
    } catch (e) { alert(e.message); }
  }

  // 出勤簿PDF（A4横・余白圧縮・休憩+給与）
  function printAttendanceSheet(staffName, monthKey) {
    const [yyyy, mm] = monthKey.split('-').map(Number);
    const lastDay = new Date(yyyy, mm, 0).getDate();
    const monthAttendance = attendance.filter(a => a.staff_name === staffName && a.clock_in_at?.startsWith(monthKey));
    const staff = staffList.find(s => s.name === staffName);
    let payroll = null;
    if (staff?.payrollEnabled && payrollConfig.enabled) {
      payroll = calcPayroll(staff, monthAttendance, payrollConfig);
    }

    const dayMap = {};
    let totalBreakMinutes = 0;
    monthAttendance.forEach(a => {
      const d = new Date(a.clock_in_at).getDate();
      if (!dayMap[d]) dayMap[d] = [];
      dayMap[d].push(a);
      totalBreakMinutes += (a.break_minutes || 0);
    });

    const fmtT = (s) => s ? new Date(s).toTimeString().slice(0, 5) : '-';
    const dayLabels = ['日','月','火','水','木','金','土'];

    const rows = [];
    for (let d = 1; d <= lastDay; d++) {
      const records = dayMap[d] || [];
      const dayObj = new Date(yyyy, mm - 1, d);
      const dayLabel = dayLabels[dayObj.getDay()];
      const isWeek = dayObj.getDay() === 0 || dayObj.getDay() === 6;

      if (records.length === 0) {
        rows.push(`<tr><td>${d}</td><td class="day ${isWeek ? 'holiday' : ''}">${dayLabel}</td><td colspan="5" class="empty">-</td></tr>`);
      } else {
        records.forEach((r, idx) => {
          const workedMin = (r.duration_minutes || 0) - (r.break_minutes || 0);
          rows.push(`<tr>
            <td>${idx === 0 ? d : ''}</td>
            <td class="day ${isWeek ? 'holiday' : ''}">${idx === 0 ? dayLabel : ''}</td>
            <td>${fmtT(r.clock_in_at)}</td>
            <td>${fmtT(r.clock_out_at)}</td>
            <td>${r.break_minutes ? `${r.break_minutes}分` : '-'}</td>
            <td>${workedMin > 0 ? `${Math.floor(workedMin/60)}:${String(workedMin%60).padStart(2,'0')}` : '-'}</td>
            <td class="notes">${r.notes || ''}</td>
          </tr>`);
        });
      }
    }

    const totalWorkedMin = (payroll?.hours.totalMinutes || 0);
    const totalH = totalWorkedMin > 0 ? `${Math.floor(totalWorkedMin/60)}時間${totalWorkedMin%60}分` : '-';

    // 複数打刻を1セルに集約（行が増えないように）
    const rowsCompact = [];
    for (let d = 1; d <= lastDay; d++) {
      const records = dayMap[d] || [];
      const dayObj = new Date(yyyy, mm - 1, d);
      const dayLabel = dayLabels[dayObj.getDay()];
      const isWeek = dayObj.getDay() === 0 || dayObj.getDay() === 6;

      if (records.length === 0) {
        rowsCompact.push(`<tr><td>${d}</td><td class="day ${isWeek ? 'holiday' : ''}">${dayLabel}</td><td colspan="5" class="empty">-</td></tr>`);
      } else {
        const ins = records.map(r => fmtT(r.clock_in_at)).join('<br/>');
        const outs = records.map(r => fmtT(r.clock_out_at)).join('<br/>');
        const breaks = records.map(r => r.break_minutes ? `${r.break_minutes}分` : '-').join('<br/>');
        const works = records.map(r => {
          const w = (r.duration_minutes || 0) - (r.break_minutes || 0);
          return w > 0 ? `${Math.floor(w/60)}:${String(w%60).padStart(2,'0')}` : '-';
        }).join('<br/>');
        const notes = records.map(r => r.notes || '').filter(Boolean).join(' / ');
        rowsCompact.push(`<tr>
          <td>${d}</td>
          <td class="day ${isWeek ? 'holiday' : ''}">${dayLabel}</td>
          <td>${ins}</td>
          <td>${outs}</td>
          <td>${breaks}</td>
          <td>${works}</td>
          <td class="notes">${notes}</td>
        </tr>`);
      }
    }

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/>
      <title>出勤簿_${staffName}_${monthKey}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; color: #222; font-size: 7.5pt; }
        h1 { text-align: center; font-size: 12pt; margin: 0 0 2mm; letter-spacing: 0.3em; border-bottom: 1pt double #222; padding-bottom: 1.5mm; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 8pt; }
        .meta strong { font-size: 10pt; }
        .layout { display: grid; grid-template-columns: 1fr 60mm; gap: 3mm; }
        table { width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: fixed; }
        th, td { border: 0.3pt solid #999; padding: 0.4mm 1mm; text-align: center; vertical-align: middle; line-height: 1.2; }
        th { background: #f4f4f4; font-weight: bold; font-size: 6.5pt; padding: 1mm 1mm; }
        td.day.holiday { color: #c00; }
        td.empty { color: #ccc; }
        td.notes { text-align: left; font-size: 6.5pt; color: #555; overflow: hidden; }
        .right-panel { display: flex; flex-direction: column; gap: 1.5mm; }
        .summary, .payroll { padding: 1.5mm 2mm; border: 0.4pt solid #999; font-size: 7.5pt; }
        .summary { background: #fafafa; }
        .payroll { border: 0.6pt solid #117768; background: #f4faf8; }
        .summary-row, .payroll-row { display: flex; justify-content: space-between; padding: 0.3mm 0; }
        .payroll-title { font-weight: bold; color: #117768; margin-bottom: 0.5mm; font-size: 8pt; }
        .payroll-row.total { border-top: 0.8pt solid #117768; margin-top: 0.5mm; padding-top: 1mm; font-weight: bold; font-size: 9pt; color: #117768; }
        .signature { display: flex; gap: 2mm; }
        .signature-box { flex: 1; border: 0.3pt solid #999; padding: 1mm; min-height: 10mm; font-size: 6pt; }
        .signature-box .label { color: #999; font-size: 5.5pt; }
        .footer-note { font-size: 5.5pt; color: #999; line-height: 1.3; }
      </style></head><body>
        <h1>出 勤 簿</h1>
        <div class="meta">
          <div>店舗: <strong>${appName || ''}</strong></div>
          <div>対象月: <strong>${yyyy}年${mm}月</strong></div>
          <div>氏名: <strong>${staffName}</strong></div>
        </div>
        <div class="layout">
          <table>
            <colgroup>
              <col style="width:5mm;"/>
              <col style="width:5mm;"/>
              <col style="width:13mm;"/>
              <col style="width:13mm;"/>
              <col style="width:10mm;"/>
              <col style="width:13mm;"/>
              <col/>
            </colgroup>
            <thead><tr>
              <th>日</th><th>曜</th>
              <th>出勤</th><th>退勤</th>
              <th>休憩</th><th>勤務時間</th>
              <th>備考</th>
            </tr></thead>
            <tbody>${rowsCompact.join('')}</tbody>
          </table>
          <div class="right-panel">
            <div class="summary">
              <div class="summary-row"><span>勤務日数</span><strong>${Object.keys(dayMap).length} 日</strong></div>
              <div class="summary-row"><span>合計勤務時間</span><strong>${totalH}</strong></div>
              <div class="summary-row"><span>合計休憩時間</span><strong>${totalBreakMinutes > 0 ? `${Math.floor(totalBreakMinutes/60)}時間${totalBreakMinutes%60}分` : '-'}</strong></div>
              ${payroll ? `<div class="summary-row"><span>うち残業</span><strong>${Math.floor(payroll.hours.overtimeMinutes/60)}h${payroll.hours.overtimeMinutes%60}m</strong></div>` : ''}
            </div>

            ${payroll ? `
              <div class="payroll">
                <div class="payroll-title">💰 給与計算</div>
                <div class="payroll-row"><span>時給</span><span>¥${payroll.hourlyWage.toLocaleString()}</span></div>
                <div class="payroll-row"><span>基本給</span><span>¥${payroll.baseAmount.toLocaleString()}</span></div>
                <div class="payroll-row"><span>残業手当(${payrollConfig.overtimePremiumRate}%増)</span><span>¥${payroll.overtimeAmount.toLocaleString()}</span></div>
                <div class="payroll-row" style="font-weight:bold; border-top:0.4pt solid #999; margin-top:0.5mm; padding-top:1mm;"><span>支給合計</span><span>¥${payroll.grossAmount.toLocaleString()}</span></div>
                ${payroll.deductions.employmentInsurance > 0 ? `<div class="payroll-row"><span>雇用保険(${payrollConfig.employmentInsuranceRate}%)</span><span>− ¥${payroll.deductions.employmentInsurance.toLocaleString()}</span></div>` : ''}
                ${payroll.deductions.socialInsurance > 0 ? `<div class="payroll-row"><span>社会保険(${payrollConfig.socialInsuranceRate}%)</span><span>− ¥${payroll.deductions.socialInsurance.toLocaleString()}</span></div>` : ''}
                ${payroll.deductions.incomeTax > 0 ? `<div class="payroll-row"><span>所得税(${payrollConfig.incomeTaxRate}%)</span><span>− ¥${payroll.deductions.incomeTax.toLocaleString()}</span></div>` : ''}
                <div class="payroll-row total"><span>差引支給額</span><span>¥${payroll.netAmount.toLocaleString()}</span></div>
              </div>
            ` : ''}

            <div class="signature">
              <div class="signature-box"><div class="label">本人サイン</div></div>
              <div class="signature-box"><div class="label">承認</div></div>
            </div>

            <div class="footer-note">
              ※給与額は設定された料率で計算されています。最終的な給与計算は社労士または専門ソフトでご確認ください。<br/>
              発行日: ${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
        <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  if (!allowed) {
    return <main className="p-12 text-center"><p className="text-[14px] font-bold text-[#999]">この画面はオーナー権限が必要です</p></main>;
  }

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] px-6 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-bold text-[#2D4B3E] tracking-tight">勤怠管理</h1>
          <p className="text-[11px] font-bold text-[#999] mt-1">出退勤・休憩記録の管理 + 給与計算</p>
        </div>
        <button onClick={loadAttendance} className="p-2 hover:bg-[#FBFAF9] rounded-full text-[#999]">
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/>
        </button>
      </header>

      <div className="max-w-[1100px] mx-auto p-6 md:p-8 space-y-6">
        {/* 月別サマリー */}
        <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm">
          <h3 className="text-[14px] font-bold text-[#2D4B3E] mb-3">月別サマリー</h3>
          {summary.length === 0 ? (
            <p className="text-[12px] text-[#999]">勤怠記録がありません</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.sort((a, b) => b.monthKey.localeCompare(a.monthKey)).map(s => {
                const staffInfo = staffList.find(st => st.name === s.staffName);
                const monthAttendance = attendance.filter(a => a.staff_name === s.staffName && a.clock_in_at?.startsWith(s.monthKey));
                const payroll = (staffInfo?.payrollEnabled && payrollConfig.enabled)
                  ? calcPayroll(staffInfo, monthAttendance, payrollConfig) : null;
                const ytdAttendance = allYearAttendance.filter(a => a.staff_name === s.staffName);
                const ytdGross = (staffInfo?.payrollEnabled && payrollConfig.enabled)
                  ? calcPayroll(staffInfo, ytdAttendance, payrollConfig).grossAmount : 0;
                const warnings = staffInfo ? getPayrollWarnings(staffInfo, ytdGross, s.totalHours) : [];
                const totalBreakMin = monthAttendance.reduce((sum, a) => sum + (a.break_minutes || 0), 0);

                return (
                  <div key={`${s.staffName}_${s.monthKey}`} className="bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA] space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-[#999]">{s.monthKey}</p>
                        <p className="text-[14px] font-bold text-[#111] mt-0.5">{s.staffName}</p>
                      </div>
                      <button
                        onClick={() => printAttendanceSheet(s.staffName, s.monthKey)}
                        className="text-[10px] font-bold text-[#117768] border border-[#117768]/40 bg-white px-2 py-1 rounded-lg hover:bg-[#117768]/10 flex items-center gap-1 shrink-0 ml-2"
                      >
                        <FileText size={11}/> 出勤簿
                      </button>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-[20px] font-bold text-[#2D4B3E]">{s.totalHours}<span className="text-[10px] ml-1">時間</span></p>
                      <p className="text-[10px] text-[#999]">{s.days}日勤務</p>
                    </div>
                    {totalBreakMin > 0 && (
                      <p className="text-[10px] text-[#555]">休憩: {Math.floor(totalBreakMin/60)}h{totalBreakMin%60}m</p>
                    )}
                    {payroll && (
                      <div className="pt-2 border-t border-[#EAEAEA] space-y-0.5">
                        <div className="flex justify-between text-[10px] text-[#555]">
                          <span>支給総額</span><span className="font-bold">¥{payroll.grossAmount.toLocaleString()}</span>
                        </div>
                        {payroll.deductions.total > 0 && (
                          <div className="flex justify-between text-[10px] text-red-500">
                            <span>控除合計</span><span>− ¥{payroll.deductions.total.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[12px] font-bold text-[#117768] pt-0.5 border-t border-[#EAEAEA]">
                          <span>差引支給</span><span>¥{payroll.netAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {warnings.map((w, i) => (
                          <div key={i} className={`flex items-start gap-1 text-[10px] font-bold p-1.5 rounded ${
                            w.severity === 'high' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <AlertCircle size={11} className="shrink-0 mt-0.5"/>
                            <span className="leading-tight">{w.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 直近の打刻記録 */}
        <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#EAEAEA] flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#2D4B3E]">直近の打刻記録</h3>
            <button
              onClick={() => setEditForm({ staffName: staffList[0]?.name || '', clockInAt: toLocalInput(new Date()), clockOutAt: '', notes: '' })}
              className="flex items-center gap-1 bg-[#117768] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#0f6a5b]"
            >
              <Plus size={12}/> 手動で追加
            </button>
          </div>
          {attendance.length === 0 ? (
            <p className="p-8 text-center text-[12px] text-[#999]">記録がありません</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-[#FBFAF9] border-b border-[#EAEAEA] text-[10px] font-bold text-[#999]">
                <tr>
                  <th className="px-4 py-2 text-left">スタッフ</th>
                  <th className="px-4 py-2 text-left">出勤</th>
                  <th className="px-4 py-2 text-left">退勤</th>
                  <th className="px-4 py-2 text-right">休憩</th>
                  <th className="px-4 py-2 text-right">勤務時間</th>
                  <th className="px-4 py-2 text-right w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F7F7]">
                {attendance.slice(0, 100).map(a => {
                  const workedMin = (a.duration_minutes || 0) - (a.break_minutes || 0);
                  return (
                    <tr key={a.id} className="hover:bg-[#FBFAF9]/50">
                      <td className="px-4 py-3 font-bold text-[#111]">{a.staff_name}</td>
                      <td className="px-4 py-3 text-[#555] font-mono text-[11px]">{fmtDate(a.clock_in_at)}</td>
                      <td className="px-4 py-3 text-[#555] font-mono text-[11px]">{a.clock_out_at ? fmtDate(a.clock_out_at) : <span className="text-[#117768] font-bold">出勤中{a.break_start_at && '（休憩中）'}</span>}</td>
                      <td className="px-4 py-3 text-right text-[#555] text-[11px]">{a.break_minutes ? `${a.break_minutes}分` : '-'}</td>
                      <td className="px-4 py-3 text-right text-[#2D4B3E] font-bold">{workedMin > 0 ? `${Math.floor(workedMin/60)}時間${workedMin%60}分` : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditForm({ id: a.id, staffName: a.staff_name, clockInAt: toLocalInput(a.clock_in_at), clockOutAt: toLocalInput(a.clock_out_at), notes: a.notes || '' })} className="text-[#999] hover:text-[#2D4B3E] p-1"><Edit2 size={12}/></button>
                          <button onClick={() => deleteAttendance(a.id)} className="text-red-300 hover:text-red-600 p-1"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 編集モーダル */}
      {editForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditForm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-[#111]">{editForm.id ? '打刻を編集' : '打刻を手動追加'}</h3>
              <button onClick={() => setEditForm(null)} className="text-[#999] hover:text-[#111]"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">スタッフ</label>
                <select value={editForm.staffName} onChange={(e) => setEditForm({...editForm, staffName: e.target.value})} className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none">
                  <option value="">選択...</option>
                  {staffList.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">出勤日時</label>
                <input type="datetime-local" value={editForm.clockInAt} onChange={(e) => setEditForm({...editForm, clockInAt: e.target.value})} className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"/>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">退勤日時（空欄=出勤中）</label>
                <input type="datetime-local" value={editForm.clockOutAt} onChange={(e) => setEditForm({...editForm, clockOutAt: e.target.value})} className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"/>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">メモ</label>
                <input type="text" value={editForm.notes} onChange={(e) => setEditForm({...editForm, notes: e.target.value})} placeholder="例: 退勤忘れ修正" className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"/>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditForm(null)} className="flex-1 h-11 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-lg">キャンセル</button>
                <button onClick={saveAttendance} className="flex-1 h-11 bg-[#117768] text-white text-[12px] font-bold rounded-lg hover:bg-[#0f6a5b]">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
