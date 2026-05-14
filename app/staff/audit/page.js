'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { ACTION_LABELS } from '@/utils/auditLog';
import { canCurrent } from '@/utils/staffRole';
import { History, RefreshCw, User, Filter } from 'lucide-react';

export default function AuditPage() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', staff: '' });
  const [allowed, setAllowed] = useState(true);

  useEffect(() => { setAllowed(canCurrent('manageStaff')); }, []);

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

  useEffect(() => { loadAudit(); }, [filter]);

  function fmtDate(s) {
    if (!s) return '-';
    return new Date(s).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  if (!allowed) {
    return <main className="p-12 text-center"><p className="text-[14px] font-bold text-[#999]">この画面はオーナー権限が必要です</p></main>;
  }

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] px-6 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-bold text-[#2D4B3E] tracking-tight">操作履歴</h1>
          <p className="text-[11px] font-bold text-[#999] mt-1">スタッフの操作証跡（誰がいつ何をしたか）</p>
        </div>
        <button onClick={loadAudit} className="p-2 hover:bg-[#FBFAF9] rounded-full text-[#999]">
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/>
        </button>
      </header>

      <div className="max-w-[1100px] mx-auto p-6 md:p-8 space-y-6">
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
      </div>
    </main>
  );
}
