'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { ACTION_LABELS } from '@/utils/auditLog';
import { canCurrent } from '@/utils/staffRole';
import { History, Clock, RefreshCw, User, Filter, Edit2, Trash2, Plus, X } from 'lucide-react';

export default function AuditPage() {
  const [tab, setTab] = useState('audit'); // 'audit' | 'attendance'
  const [auditLogs, setAuditLogs] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', staff: '' });
  const [allowed, setAllowed] = useState(true);

  // 打刻編集モーダル
  const [editForm, setEditForm] = useState(null); // null | { id?, staffName, clockInAt, clockOutAt, notes }
  const [staffList, setStaffList] = useState([]);

  // スタッフ名リスト取得（編集UI用）
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (!profile?.tenant_id) return;
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', profile.tenant_id).single();
        setStaffList(data?.settings_data?.staffList || []);
      } catch {}
    })();
  }, []);

  // 打刻保存（新規 or 編集）
  async function saveAttendance() {
    if (!editForm?.staffName || !editForm?.clockInAt) {
      alert('スタッフと出勤時刻を入力してください');
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // datetime-local 形式 → ISO 文字列に変換して送信
      const payload = {
        ...editForm,
        clockInAt: fromLocalInput(editForm.clockInAt),
        clockOutAt: fromLocalInput(editForm.clockOutAt),
      };
      const res = await fetch('/api/staff/attendance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditForm(null);
      loadAttendance();
    } catch (e) {
      alert(e.message);
    }
  }

  // 打刻削除
  async function deleteAttendance(id) {
    if (!confirm('この打刻記録を削除しますか？')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/staff/attendance', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('削除失敗');
      loadAttendance();
    } catch (e) {
      alert(e.message);
    }
  }

  // datetime-local用の値整形
  function toLocalInput(s) {
    if (!s) return '';
    const d = new Date(s);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromLocalInput(v) {
    if (!v) return null;
    return new Date(v).toISOString();
  }

  useEffect(() => {
    setAllowed(canCurrent('manageStaff'));  // 履歴確認はオーナー権限相当
  }, []);

  async function loadAudit() {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const params = new URLSearchParams({ limit: '200' });
      if (filter.action) params.set('action', filter.action);
      if (filter.staff) params.set('staff', filter.staff);
      const res = await fetch(`/api/staff/audit-log?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setAuditLogs(data.items || []);
    } finally { setIsLoading(false); }
  }

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

  useEffect(() => {
    if (tab === 'audit') loadAudit();
    else loadAttendance();
    // eslint-disable-next-line
  }, [tab, filter]);

  function fmtDate(s) {
    if (!s) return '-';
    return new Date(s).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  if (!allowed) {
    return (
      <main className="p-12 text-center">
        <p className="text-[14px] font-bold text-[#999]">この画面はオーナー権限が必要です</p>
      </main>
    );
  }

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] px-6 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] md:text-[20px] font-bold text-[#2D4B3E] tracking-tight">操作履歴・勤怠</h1>
            <p className="text-[11px] font-bold text-[#999] mt-1">スタッフの操作証跡と出退勤記録</p>
          </div>
          <button onClick={() => tab === 'audit' ? loadAudit() : loadAttendance()} className="p-2 hover:bg-[#FBFAF9] rounded-full text-[#999]">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/>
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setTab('audit')} className={`px-4 py-2 text-[12px] font-bold rounded-lg ${tab === 'audit' ? 'bg-[#2D4B3E] text-white' : 'bg-[#FBFAF9] text-[#555]'}`}>
            <History size={13} className="inline mr-1"/> 操作履歴
          </button>
          <button onClick={() => setTab('attendance')} className={`px-4 py-2 text-[12px] font-bold rounded-lg ${tab === 'attendance' ? 'bg-[#2D4B3E] text-white' : 'bg-[#FBFAF9] text-[#555]'}`}>
            <Clock size={13} className="inline mr-1"/> 勤怠
          </button>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto p-6 md:p-8 space-y-6">
        {tab === 'audit' && (
          <>
            <div className="bg-white p-4 rounded-2xl border border-[#EAEAEA] shadow-sm flex flex-wrap gap-2 items-center">
              <Filter size={14} className="text-[#999]"/>
              <select value={filter.action} onChange={(e) => setFilter({...filter, action: e.target.value})} className="h-9 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] font-bold outline-none">
                <option value="">操作種別すべて</option>
                {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="text" value={filter.staff} onChange={(e) => setFilter({...filter, staff: e.target.value})} placeholder="スタッフ名で絞込" className="h-9 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none w-48"/>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-12 text-center text-[#999] text-[13px] font-bold">記録がありません</div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#FBFAF9] border-b border-[#EAEAEA] text-[10px] font-bold text-[#999]">
                    <tr>
                      <th className="px-4 py-3 text-left">日時</th>
                      <th className="px-4 py-3 text-left">スタッフ</th>
                      <th className="px-4 py-3 text-left">操作</th>
                      <th className="px-4 py-3 text-left">対象</th>
                      <th className="px-4 py-3 text-left">詳細</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F7F7F7]">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-[#FBFAF9]/50">
                        <td className="px-4 py-3 text-[#555] font-mono text-[11px]">{fmtDate(log.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${
                              log.staff_role === 'owner' ? 'bg-[#2D4B3E]' :
                              log.staff_role === 'staff' ? 'bg-[#117768]' :
                              log.staff_role === 'parttime' ? 'bg-[#D97D54]' : 'bg-[#999]'
                            }`}><User size={11}/></div>
                            <span className="font-bold text-[12px]">{log.staff_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#2D4B3E] font-bold">{ACTION_LABELS[log.action] || log.action}</td>
                        <td className="px-4 py-3 text-[#999] font-mono text-[10px]">{log.target_type}{log.target_id ? `:${log.target_id.slice(0, 8)}` : ''}</td>
                        <td className="px-4 py-3 text-[#555]">{log.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'attendance' && (
          <>
            <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm">
              <h3 className="text-[14px] font-bold text-[#2D4B3E] mb-3">月別サマリー</h3>
              {summary.length === 0 ? (
                <p className="text-[12px] text-[#999]">勤怠記録がありません</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {summary.sort((a, b) => b.monthKey.localeCompare(a.monthKey)).map(s => (
                    <div key={`${s.staffName}_${s.monthKey}`} className="bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA]">
                      <p className="text-[11px] text-[#999]">{s.monthKey}</p>
                      <p className="text-[14px] font-bold text-[#111] mt-0.5">{s.staffName}</p>
                      <div className="flex items-baseline justify-between mt-2">
                        <p className="text-[20px] font-bold text-[#2D4B3E]">{s.totalHours}<span className="text-[10px] ml-1">時間</span></p>
                        <p className="text-[10px] text-[#999]">{s.days}日勤務</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                      <th className="px-4 py-2 text-right">勤務時間</th>
                      <th className="px-4 py-2 text-right w-24">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F7F7F7]">
                    {attendance.slice(0, 100).map(a => (
                      <tr key={a.id} className="hover:bg-[#FBFAF9]/50">
                        <td className="px-4 py-3 font-bold text-[#111]">{a.staff_name}</td>
                        <td className="px-4 py-3 text-[#555] font-mono text-[11px]">{fmtDate(a.clock_in_at)}</td>
                        <td className="px-4 py-3 text-[#555] font-mono text-[11px]">{a.clock_out_at ? fmtDate(a.clock_out_at) : <span className="text-[#117768] font-bold">出勤中</span>}</td>
                        <td className="px-4 py-3 text-right text-[#2D4B3E] font-bold">{a.duration_minutes ? `${Math.floor(a.duration_minutes / 60)}時間${a.duration_minutes % 60}分` : '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditForm({
                                id: a.id,
                                staffName: a.staff_name,
                                clockInAt: toLocalInput(a.clock_in_at),
                                clockOutAt: toLocalInput(a.clock_out_at),
                                notes: a.notes || '',
                              })}
                              className="text-[#999] hover:text-[#2D4B3E] p-1"
                              title="編集"
                            >
                              <Edit2 size={12}/>
                            </button>
                            <button
                              onClick={() => deleteAttendance(a.id)}
                              className="text-red-300 hover:text-red-600 p-1"
                              title="削除"
                            >
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                      <select
                        value={editForm.staffName}
                        onChange={(e) => setEditForm({...editForm, staffName: e.target.value})}
                        className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"
                      >
                        <option value="">選択...</option>
                        {staffList.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#999] tracking-widest">出勤日時</label>
                      <input
                        type="datetime-local"
                        value={editForm.clockInAt}
                        onChange={(e) => setEditForm({...editForm, clockInAt: e.target.value})}
                        className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#999] tracking-widest">退勤日時（空欄=出勤中）</label>
                      <input
                        type="datetime-local"
                        value={editForm.clockOutAt}
                        onChange={(e) => setEditForm({...editForm, clockOutAt: e.target.value})}
                        className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#999] tracking-widest">メモ</label>
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        placeholder="例: 退勤忘れ修正"
                        className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setEditForm(null)} className="flex-1 h-11 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-lg">キャンセル</button>
                      <button
                        onClick={saveAttendance}
                        className="flex-1 h-11 bg-[#117768] text-white text-[12px] font-bold rounded-lg hover:bg-[#0f6a5b]"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
