'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar, ShoppingBag, PlusCircle, Settings,
  Clock, Package, ChevronRight, Truck, Store, LogIn, LogOut, UserCheck
} from 'lucide-react';
import { getCurrentStaff } from '@/utils/staffRole';
import { clockIn, clockOut } from '@/utils/attendance';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ todayOrders: 0, uncompletedOrders: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // ★ 勤怠
  const [currentStaff, setCurrentStaffState] = useState(null);
  const [openAttendance, setOpenAttendance] = useState([]); // 現在出勤中のスタッフ
  const [myMonthSummary, setMyMonthSummary] = useState(null);
  const [isClocking, setIsClocking] = useState(false);

  async function loadAttendanceData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 現在出勤中のメンバー
      const openRes = await fetch('/api/staff/attendance?openOnly=true', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(r => r.json()).catch(() => ({ items: [] }));
      setOpenAttendance(openRes.items || []);

      // 今月の自分の集計
      const staff = getCurrentStaff();
      if (staff?.name) {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const sumRes = await fetch(`/api/staff/attendance?staff=${encodeURIComponent(staff.name)}&from=${from}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then(r => r.json()).catch(() => ({ summary: [] }));
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setMyMonthSummary(sumRes.summary?.find(s => s.monthKey === monthKey) || null);
      }
    } catch (e) {
      console.warn('attendance load failed', e);
    }
  }

  useEffect(() => {
    setCurrentStaffState(getCurrentStaff());
    loadAttendanceData();
  }, []);

  const handleClockIn = async () => {
    if (!currentStaff?.name) {
      alert('左サイドバーからスタッフを選択してから打刻してください');
      return;
    }
    setIsClocking(true);
    try {
      await clockIn(currentStaff.name);
      await loadAttendanceData();
    } finally { setIsClocking(false); }
  };

  const handleClockOut = async () => {
    if (!currentStaff?.name) return;
    setIsClocking(true);
    try {
      await clockOut(currentStaff.name);
      await loadAttendanceData();
    } finally { setIsClocking(false); }
  };

  // 自分が出勤中か
  const myOpenRecord = currentStaff?.name && openAttendance.find(a => a.staff_name === currentStaff.name);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // ★ セキュリティ修正: ログインユーザーのtenant_idを取得して、自店舗のデータだけを引く
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = '/staff/login';
          return;
        }
        const { data: profile, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (profileError) throw profileError;
        const tId = profile.tenant_id;
        if (!tId) throw new Error('tenant_id が取得できませんでした');

        const todayStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        // ★ tenant_id でフィルタ
        const { data, error } = await supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false });
        if (error) throw error;

        const fetchedOrders = data || [];
        setOrders(fetchedOrders);

        let todayCount = 0;
        let uncompletedCount = 0;
        const recent = [];

        fetchedOrders.forEach(order => {
          const d = order.order_data || {};
          
          if (d.status !== '完了' && d.status !== 'キャンセル' && d.status !== 'completed') {
            uncompletedCount++;
          }

          // 業者配送なら「発送日」、それ以外は「納品日」を今日のタスク基準にする
          const targetDate = d.receiveMethod === 'sagawa' ? (d.shippingDate || d.selectedDate) : d.selectedDate;

          if (targetDate === todayStr && d.status !== 'キャンセル') {
            todayCount++;
          }

          if (recent.length < 5) recent.push(order);
        });

        setStats({ todayOrders: todayCount, uncompletedOrders: uncompletedCount });
        setRecentOrders(recent);
      } catch (error) {
        console.error('データ取得エラー:', error.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const getMethodIcon = (method) => {
    if (method === 'pickup') return <Store size={14} className="text-blue-500" />;
    if (method === 'delivery') return <Truck size={14} className="text-[#D97D54]" />;
    return <Package size={14} className="text-[#2D4B3E]" />;
  };

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '佐川急便' };
    return map[method] || method;
  };

  // 本日の受取方法別の内訳（配送は発送日基準）
  const todayStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  const todayOrdersList = orders.filter(o => {
    const d = o.order_data || {};
    const tDate = d.receiveMethod === 'sagawa' ? (d.shippingDate || d.selectedDate) : d.selectedDate;
    return tDate === todayStr && d.status !== 'キャンセル';
  });

  const todayPickup = todayOrdersList.filter(o => o.order_data?.receiveMethod === 'pickup').length;
  const todayDelivery = todayOrdersList.filter(o => o.order_data?.receiveMethod === 'delivery').length;
  const todaySagawa = todayOrdersList.filter(o => o.order_data?.receiveMethod === 'sagawa').length;

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-sans text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>;

  return (
    <main className="pb-32 font-sans">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">ダッシュボード</h1>
      </header>

      <div className="max-w-[1200px] mx-auto w-full p-4 md:p-8 space-y-10">
        
        <div className="flex flex-col gap-2">
          <p className="text-[14px] text-[#555555]">本日の業務状況と最新の注文状況を確認しましょう。</p>
        </div>

        {/* ★ 勤怠カード（TOP配置） */}
        <div className="bg-gradient-to-br from-[#117768]/5 to-[#2D4B3E]/10 border border-[#117768]/20 rounded-2xl p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* 自分の打刻 */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 ${myOpenRecord ? 'bg-[#117768]' : 'bg-[#999]'}`}>
                <Clock size={22}/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-[#999] tracking-widest">あなたの勤怠</p>
                {currentStaff?.name ? (
                  <>
                    <p className="text-[15px] font-bold text-[#111]">{currentStaff.name}</p>
                    {myOpenRecord ? (
                      <p className="text-[11px] text-[#117768] font-bold mt-0.5">
                        ✓ {new Date(myOpenRecord.clock_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} から出勤中
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#999] mt-0.5">未打刻</p>
                    )}
                    {myMonthSummary && (
                      <p className="text-[10px] text-[#555] mt-1">今月: {myMonthSummary.totalHours}時間 / {myMonthSummary.days}日</p>
                    )}
                  </>
                ) : (
                  <p className="text-[12px] text-[#999] mt-1">左サイドバーからスタッフを選択してください</p>
                )}
              </div>
            </div>

            {/* 打刻ボタン */}
            <div className="flex gap-2 shrink-0">
              {currentStaff?.name && (
                <>
                  {!myOpenRecord ? (
                    <button onClick={handleClockIn} disabled={isClocking} className="px-5 h-12 bg-[#117768] text-white rounded-xl font-bold text-[13px] hover:bg-[#0f6a5b] disabled:opacity-50 flex items-center gap-2 shadow-sm">
                      <LogIn size={16}/> 出勤
                    </button>
                  ) : (
                    <button onClick={handleClockOut} disabled={isClocking} className="px-5 h-12 bg-[#D97D54] text-white rounded-xl font-bold text-[13px] hover:bg-[#c26d48] disabled:opacity-50 flex items-center gap-2 shadow-sm">
                      <LogOut size={16}/> 退勤
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 現在出勤中のメンバー */}
          {openAttendance.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#117768]/15">
              <p className="text-[10px] font-bold text-[#117768] tracking-widest mb-2">いま出勤中（{openAttendance.length}名）</p>
              <div className="flex flex-wrap gap-2">
                {openAttendance.map(a => (
                  <div key={a.id} className="bg-white border border-[#117768]/30 rounded-full px-3 py-1.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#117768] text-white flex items-center justify-center">
                      <UserCheck size={12}/>
                    </div>
                    <span className="text-[11px] font-bold text-[#111]">{a.staff_name}</span>
                    <span className="text-[9px] text-[#999]">{new Date(a.clock_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}〜</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* ★ 修正: クリック時の遷移先を /staff/calendar に変更しました！ */}
          <div onClick={() => router.push('/staff/calendar')} className="bg-white rounded-2xl p-6 border border-[#EAEAEA] shadow-sm flex flex-col gap-4 relative overflow-hidden group cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-[#4285F4]/40 transition-all duration-300">
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2D4B3E]/10 text-[#2D4B3E] flex items-center justify-center"><Calendar size={20}/></div>
                <span className="text-[12px] font-bold text-[#999999] uppercase">本日 (お届け/受取/発送)</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#FBFAF9] flex items-center justify-center group-hover:bg-[#4285F4] transition-colors"><ChevronRight size={16} className="text-[#999999] group-hover:text-white" /></div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 pt-2">
              <span className="text-[48px] font-bold text-[#2D4B3E] leading-none group-hover:text-[#4285F4] transition-colors">{stats.todayOrders}</span>
              <span className="text-[14px] font-bold text-[#999999]">件</span>
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-3 relative z-10">
              <div className="bg-orange-50 text-orange-700 flex flex-col items-center justify-center p-3 rounded-2xl border border-orange-100 shadow-inner">
                <span className="flex items-center gap-1.5 text-[11px] font-bold mb-1"><Store size={14}/> 店頭</span>
                <span className="text-[20px] font-bold">{todayPickup}</span>
              </div>
              <div className="bg-blue-50 text-blue-700 flex flex-col items-center justify-center p-3 rounded-2xl border border-blue-100 shadow-inner">
                <span className="flex items-center gap-1.5 text-[11px] font-bold mb-1"><Truck size={14}/> 配達</span>
                <span className="text-[20px] font-bold">{todayDelivery}</span>
              </div>
              <div className="bg-green-50 text-green-700 flex flex-col items-center justify-center p-3 rounded-2xl border border-green-100 shadow-inner">
                <span className="flex items-center gap-1.5 text-[11px] font-bold mb-1"><Package size={14}/> 発送</span>
                <span className="text-[20px] font-bold">{todaySagawa}</span>
              </div>
            </div>
          </div>
          
          <div onClick={() => router.push('/staff/orders')} className="bg-white rounded-2xl p-6 border border-[#EAEAEA] shadow-sm flex flex-col gap-4 relative overflow-hidden group cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-[#E74C3C]/40 transition-all duration-300">
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Clock size={20}/></div>
                <span className="text-[12px] font-bold text-[#999999] uppercase">未完了の注文総数</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#FBFAF9] flex items-center justify-center group-hover:bg-[#E74C3C] transition-colors"><ChevronRight size={16} className="text-[#999999] group-hover:text-white" /></div>
            </div>
            <div className="flex items-baseline gap-2 relative z-10 pt-2">
              <span className="text-[48px] font-bold text-[#111111] leading-none group-hover:text-[#E74C3C] transition-colors">{stats.uncompletedOrders}</span>
              <span className="text-[14px] font-bold text-[#999999]">件</span>
            </div>
          </div>

        </div>

        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <h3 className="text-[14px] font-bold text-[#2D4B3E] border-l-4 border-[#2D4B3E] pl-3">クイックメニュー</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/staff/new-order" className="bg-[#2D4B3E] text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-[#1f352b] hover:shadow-lg transition-all shadow-md group"><PlusCircle size={32} className="group-hover:scale-110 transition-transform duration-300"/><span className="text-[13px] font-bold">新規注文</span></Link>
            <Link href="/staff/orders" className="bg-white border border-[#EAEAEA] text-[#555555] rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm group"><ShoppingBag size={32} className="group-hover:scale-110 transition-transform duration-300"/><span className="text-[13px] font-bold">受注一覧</span></Link>
            <Link href="/staff/calendar" className="bg-white border border-[#EAEAEA] text-[#555555] rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm group"><Calendar size={32} className="group-hover:scale-110 transition-transform duration-300"/><span className="text-[13px] font-bold">カレンダー</span></Link>
            <Link href="/staff/settings" className="bg-white border border-[#EAEAEA] text-[#555555] rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm group"><Settings size={32} className="group-hover:scale-110 transition-transform duration-300"/><span className="text-[13px] font-bold">各種設定</span></Link>
          </div>
        </div>

        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] border-l-4 border-[#2D4B3E] pl-3">最近受付した注文</h3>
            <Link href="/staff/orders" className="text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] flex items-center gap-1 bg-white px-4 py-2 rounded-full border border-[#EAEAEA] shadow-sm transition-colors">すべて見る <ChevronRight size={14}/></Link>
          </div>
          
          <div className="bg-white border border-[#EAEAEA] rounded-2xl shadow-sm overflow-hidden">
            {recentOrders.length === 0 ? (
              <div className="p-16 text-center text-[#999999] font-bold">最近の注文はありません</div>
            ) : (
              <div className="divide-y divide-[#F7F7F7]">
                {recentOrders.map(order => {
                  const d = order.order_data || {};
                  return (
                    <div key={order.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FBFAF9]/50 transition-colors group">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[#2D4B3E]/5 text-[#2D4B3E] flex flex-col items-center justify-center border border-[#2D4B3E]/10">
                          <span className="text-[9px] font-bold opacity-60 leading-none mb-1">{d.selectedDate?.split('-')[1] || '--'}月</span>
                          <span className="text-[18px] font-bold leading-none">{d.selectedDate?.split('-')[2] || '--'}</span>
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-[#111111]">{d.customerInfo?.name} 様</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="flex items-center gap-1 text-[11px] font-bold text-[#555555] bg-gray-100 px-2 py-0.5 rounded-md">
                              {getMethodIcon(d.receiveMethod)} {getMethodLabel(d.receiveMethod)}
                            </span>
                            <span className="text-[12px] font-bold text-[#999999]">{d.flowerType}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 justify-between md:justify-end">
                        <span className={`px-4 py-1.5 rounded-lg text-[11px] font-bold ${d.status === '完了' || d.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-50 text-orange-600'}`}>
                          {d.status === 'completed' ? '完了' : (d.status || '未対応')}
                        </span>
                        <Link href="/staff/orders" className="w-10 h-10 rounded-full bg-white border border-[#EAEAEA] flex items-center justify-center text-[#999999] group-hover:border-[#2D4B3E] group-hover:text-[#2D4B3E] transition-all shadow-sm">
                          <ChevronRight size={18}/>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}