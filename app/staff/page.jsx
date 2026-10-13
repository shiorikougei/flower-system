'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar, ShoppingBag, PlusCircle, Settings,
  Clock, Package, ChevronRight, Truck, Store, LogIn, LogOut, UserCheck, Coffee, Pause, Play, AlertCircle, Bell
} from 'lucide-react';
import { getCurrentStaff } from '@/utils/staffRole';
import { clockIn, clockOut, breakStart, breakEnd } from '@/utils/attendance';
import HelpTooltip from '@/components/HelpTooltip';
import ReleaseNotesCard from '@/components/ReleaseNotesCard';
// [2026-10 C2] カード決済が終わらないまま 20 分たった注文は表示しない（データはそのまま）
import { visibleOrders } from '@/utils/orderVisibility';
import SettingsReminderCard from '@/components/SettingsReminderCard';
import { isFeatureEnabled } from '@/utils/features';
import { getStaffContext } from '@/utils/staffContext';
import { orderTabOf } from '@/utils/orderTabs';

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ todayOrders: 0, uncompletedOrders: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pendingEstimates, setPendingEstimates] = useState([]); // ★ 未回答の見積依頼
  const [isLoading, setIsLoading] = useState(true);

  // ★ 勤怠
  const [currentStaff, setCurrentStaffState] = useState(null);
  const [openAttendance, setOpenAttendance] = useState([]); // 現在出勤中のスタッフ
  const [myMonthSummary, setMyMonthSummary] = useState(null);
  const [isClocking, setIsClocking] = useState(false);
  // [2026-10] 勤怠管理の機能がオンのお店だけ「あなたの勤怠」を出す（左のメニューと同じ判定）
  const [attendanceEnabled, setAttendanceEnabled] = useState(false);

  async function loadAttendanceData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 現在出勤中のメンバーと、今月の自分の集計（同時に読み込む）
      const staff = getCurrentStaff();
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const [openRes, sumRes] = await Promise.all([
        fetch('/api/staff/attendance?openOnly=true', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then(r => r.json()).catch(() => ({ items: [] })),
        staff?.name
          ? fetch(`/api/staff/attendance?staff=${encodeURIComponent(staff.name)}&from=${from}`, {
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).then(r => r.json()).catch(() => ({ summary: [] }))
          : Promise.resolve(null),
      ]);
      setOpenAttendance(openRes.items || []);
      if (sumRes) {
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setMyMonthSummary(sumRes.summary?.find(s => s.monthKey === monthKey) || null);
      }
    } catch (e) {
      console.warn('attendance load failed', e);
    }
  }

  useEffect(() => {
    setCurrentStaffState(getCurrentStaff());
  }, []);
  // 勤怠管理がオンのお店だけ読み込む
  useEffect(() => {
    if (attendanceEnabled) loadAttendanceData();
  }, [attendanceEnabled]);

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

  const handleBreakStart = async () => {
    if (!currentStaff?.name) return;
    setIsClocking(true);
    try {
      await breakStart(currentStaff.name);
      await loadAttendanceData();
    } finally { setIsClocking(false); }
  };

  const handleBreakEnd = async () => {
    if (!currentStaff?.name) return;
    setIsClocking(true);
    try {
      await breakEnd(currentStaff.name);
      await loadAttendanceData();
    } finally { setIsClocking(false); }
  };

  // 自分が出勤中か
  const myOpenRecord = currentStaff?.name && openAttendance.find(a => a.staff_name === currentStaff.name);
  const isOnBreak = myOpenRecord?.break_start_at;

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // ★ セキュリティ修正: ログインユーザーのtenant_idを取得して、自店舗のデータだけを引く
        // [2026-10] ログイン・お店・設定の読み込みは左のメニューと共通（utils/staffContext.js）
        const { session, tenantId: tId, settings } = await getStaffContext();
        if (!session) {
          window.location.href = '/staff/login';
          return;
        }
        if (!tId) throw new Error('tenant_id が取得できませんでした');
        setAttendanceEnabled(isFeatureEnabled(settings, 'attendanceManagement'));

        const todayStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

        // ★ 未回答の見積依頼（失敗してもダッシュボード自体は表示。注文の読み込みと同時に）
        // ★ [セキュリティ] /api/estimates GET は認証必須化済みのため Bearer 必須
        const estimatesPromise = fetch(`/api/estimates?tenantId=${encodeURIComponent(tId)}&status=pending`, {
          headers: { Authorization: `Bearer ${session.access_token || ''}` },
        }).then(async (estRes) => {
          if (estRes.ok) {
            const estData = await estRes.json();
            setPendingEstimates(estData.estimates || []);
          }
        }).catch((e) => console.warn('見積依頼取得失敗:', e));

        const [recentRes, allRes] = await Promise.all([
          // ★ 最近の注文・新規注文・遅れている注文: 最新100件（中身つき）
          supabase
            .from('orders')
            .select('id, tenant_id, created_at, payment_status, order_data')
            .eq('tenant_id', tId)
            .order('created_at', { ascending: false })
            .limit(100),
          // [2026-10] 件数（本日・未完了）は全部の注文から数える。数えるのに要る項目だけを読む
          //   未完了の数え方は受注一覧の「未完了」と同じ（utils/orderTabs.js）
          supabase
            .from('orders')
            .select('id, created_at, payment_status, status:order_data->>status, paymentStatus:order_data->>paymentStatus, paymentMethod:order_data->>paymentMethod, isStaffEntered:order_data->isStaffEntered, phoneConfirmation:order_data->phoneConfirmation, statusHistory:order_data->statusHistory, receiveMethod:order_data->>receiveMethod, shippingDate:order_data->>shippingDate, selectedDate:order_data->>selectedDate')
            .eq('tenant_id', tId),
        ]);
        if (recentRes.error) throw recentRes.error;

        const fetchedOrders = visibleOrders(recentRes.data || []);
        setOrders(fetchedOrders);
        setRecentOrders(fetchedOrders.slice(0, 5));

        let todayCount = 0;
        let uncompletedCount = 0;
        // 件数用の読み込みに失敗したときは、これまでどおり最新100件で数える
        const countRows = allRes.error
          ? fetchedOrders
          : (allRes.data || []).map(r => ({
              id: r.id, created_at: r.created_at, payment_status: r.payment_status,
              order_data: {
                status: r.status, paymentStatus: r.paymentStatus, paymentMethod: r.paymentMethod,
                isStaffEntered: r.isStaffEntered, phoneConfirmation: r.phoneConfirmation, statusHistory: r.statusHistory,
                receiveMethod: r.receiveMethod, shippingDate: r.shippingDate, selectedDate: r.selectedDate,
              },
            }));
        countRows.forEach(order => {
          const d = order.order_data || {};
          if (orderTabOf(order) === '未完了') uncompletedCount++;
          // 業者配送なら「発送日」、それ以外は「納品日」を今日のタスク基準にする（決済が終わっていないカード払いは数えない）
          const targetDate = d.receiveMethod === 'sagawa' ? (d.shippingDate || d.selectedDate) : d.selectedDate;
          if (targetDate === todayStr && d.status !== 'キャンセル' && orderTabOf(order) !== null) {
            todayCount++;
          }
        });

        setStats({ todayOrders: todayCount, uncompletedOrders: uncompletedCount });
        setIsLoading(false);
        await estimatesPromise;
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
    if (method === 'delivery') return <Truck size={14} className="text-[#B9562F]" />;
    return <Package size={14} className="text-[#2D4B3E]" />;
  };

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '佐川急便' };
    return map[method] || method;
  };

  // ★ 新規注文（直近1時間以内 + 未着手）
  const recentNewOrders = useMemo(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return orders.filter(o => {
      const created = new Date(o.created_at);
      const status = o.order_data?.status || 'new';
      const currentStatus = o.order_data?.currentStatus || '';
      // 1時間以内 + 受注/new ステータス
      return created > oneHourAgo &&
        (status === 'new' || currentStatus === '受注' || currentStatus === '');
    });
  }, [orders]);

  // ★ 進捗悪い注文（納品予定3日以内 + 未対応 or 未制作）
  const delayedOrders = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    return orders.filter(o => {
      const d = o.order_data || {};
      const status = d.status || 'new';
      const cur = d.currentStatus || '';
      // 完了・キャンセルは除外
      if (status === 'completed' || status === '完了' || status === 'キャンセル') return false;
      const dateStr = d.receiveMethod === 'sagawa' ? (d.shippingDate || d.selectedDate) : d.selectedDate;
      if (!dateStr) return false;
      const targetDate = new Date(dateStr);
      if (isNaN(targetDate.getTime())) return false;
      // 3日以内 + 未制作
      const inDanger = targetDate >= today && targetDate <= threeDaysLater;
      const notProgressed = !cur || cur === '受注' || cur === '受付' || cur === 'new';
      return inDanger && notProgressed;
    }).sort((a, b) => {
      const da = new Date(a.order_data?.receiveMethod === 'sagawa' ? (a.order_data?.shippingDate || a.order_data?.selectedDate) : a.order_data?.selectedDate);
      const db = new Date(b.order_data?.receiveMethod === 'sagawa' ? (b.order_data?.shippingDate || b.order_data?.selectedDate) : b.order_data?.selectedDate);
      return da - db;
    });
  }, [orders]);

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

  // [2026-10] 画面全体を「読み込み中」にせず、枠を先に出して数字は届いてから表示する
  const num = (v) => (isLoading ? '…' : v);

  // [2026-10 画面リニューアル] 経過時間の表示（見積依頼）
  const agoText = (iso) => {
    const diff = Math.round((Date.now() - new Date(iso)) / 60000);
    if (diff < 60) return `${diff}分前`;
    if (diff < 1440) return `${Math.round(diff / 60)}時間前`;
    return `${Math.round(diff / 1440)}日前`;
  };
  const hasTodo = pendingEstimates.length > 0 || recentNewOrders.length > 0 || delayedOrders.length > 0;
  const statusLabel = (st) => st === 'completed' ? '完了' : (st === 'new' || !st ? '未対応' : st);

  return (
    <main className="pb-32">
      <header className="bg-[#F6F4EF]/95 backdrop-blur border-b border-[#E0DCD3] px-4 md:px-10 pt-5 pb-4 sticky top-0 z-10">
        <h1 className="text-[24px] md:text-[28px] font-bold tracking-[0.02em] text-[#1F2A24]">ダッシュボード</h1>
        <p className="text-[14px] text-[#5C6660] mt-0.5">本日の業務状況と最新の注文状況を確認しましょう。</p>
      </header>

      <div className="w-full px-4 md:px-10 py-6 space-y-6">

        {/* 件数 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* ★ 本日（お届け/受取/発送）→ カレンダーへ */}
          <button type="button" onClick={() => router.push('/staff/calendar')} className="text-left bg-white rounded-2xl p-5 border border-[#E6E2DA] hover:border-[#2D4B3E]/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[14px] font-bold text-[#3B4640]"><Calendar size={18} className="text-[#2D4B3E]" aria-hidden="true"/>本日 (お届け/受取/発送)</span>
              <ChevronRight size={18} className="text-[#5C6660] group-hover:text-[#2D4B3E]" aria-hidden="true"/>
            </div>
            <div className="mt-2 flex items-end justify-between gap-4 flex-wrap">
              <p className="flex items-baseline gap-1"><span className="ui-num text-[44px] font-bold leading-none text-[#1F2A24]">{num(stats.todayOrders)}</span><span className="text-[15px] text-[#5C6660]">件</span></p>
              <div className="flex gap-4 text-[14px] text-[#3B4640]">
                <span className="inline-flex items-center gap-1"><Store size={15} aria-hidden="true"/>店頭 <span className="ui-num font-bold text-[16px] text-[#1F2A24]">{num(todayPickup)}</span></span>
                <span className="inline-flex items-center gap-1"><Truck size={15} aria-hidden="true"/>配達 <span className="ui-num font-bold text-[16px] text-[#1F2A24]">{num(todayDelivery)}</span></span>
                <span className="inline-flex items-center gap-1"><Package size={15} aria-hidden="true"/>発送 <span className="ui-num font-bold text-[16px] text-[#1F2A24]">{num(todaySagawa)}</span></span>
              </div>
            </div>
          </button>
          {/* ★ 未完了の注文総数 → 受注一覧へ */}
          <button type="button" onClick={() => router.push('/staff/orders?filter=uncompleted')} className="text-left bg-white rounded-2xl p-5 border border-[#E6E2DA] hover:border-[#2D4B3E]/50 transition-all group">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[14px] font-bold text-[#3B4640]"><Clock size={18} className="text-[#2D4B3E]" aria-hidden="true"/>未完了の注文総数</span>
              <ChevronRight size={18} className="text-[#5C6660] group-hover:text-[#2D4B3E]" aria-hidden="true"/>
            </div>
            <p className="mt-2 flex items-baseline gap-1"><span className="ui-num text-[44px] font-bold leading-none text-[#1F2A24]">{num(stats.uncompletedOrders)}</span><span className="text-[15px] text-[#5C6660]">件</span></p>
          </button>
        </div>

        {/* 今日やること（見積の回答・新しい注文・遅れている注文）。色は「対応が必要」の赤茶だけ */}
        <section aria-labelledby="todo-title" className="bg-white rounded-2xl border border-[#E6E2DA]">
          <h2 id="todo-title" className="px-5 pt-4 pb-2 text-[17px] font-bold text-[#1F2A24]">今日やること</h2>
          {isLoading ? (
            <p className="px-5 pb-5 text-[15px] text-[#5C6660] animate-pulse">読み込み中...</p>
          ) : !hasTodo ? (
            <p className="px-5 pb-5 text-[15px] text-[#5C6660]">いま対応が必要なものはありません。</p>
          ) : (
            <div className="divide-y divide-[#E6E2DA]">
              {/* ★ 未回答の見積依頼 */}
              {pendingEstimates.length > 0 && (
                <button type="button" onClick={() => router.push('/staff/estimates')} className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-[#FAFAF7] group">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-[#B9562F] shrink-0" aria-hidden="true"></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold text-[#1F2A24]">未回答のお見積もり依頼 <span className="ui-num text-[#A2471F]">{pendingEstimates.length}件</span></p>
                    <p className="text-[14px] text-[#5C6660]">お客様が金額の見積もりを待っています。回答してください。</p>
                    <p className="mt-1 text-[14px] text-[#3B4640]">
                      {pendingEstimates.slice(0, 3).map((e, i) => (
                        <span key={e.id}>{i > 0 && <span className="text-[#C9C3B8] mx-1.5" aria-hidden="true">|</span>}{e.customer_name || 'お客様'}（{agoText(e.created_at)}）</span>
                      ))}
                      {pendingEstimates.length > 3 && <span className="text-[#5C6660]">　+ {pendingEstimates.length - 3}件</span>}
                    </p>
                  </div>
                  <ChevronRight size={20} className="mt-1 text-[#5C6660] group-hover:text-[#2D4B3E] shrink-0" aria-hidden="true"/>
                </button>
              )}
              {/* ★ 新規注文（直近1時間以内 + 未対応） */}
              {recentNewOrders.length > 0 && (
                <button type="button" onClick={() => router.push('/staff/orders')} className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-[#FAFAF7] group">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-[#B9562F] shrink-0" aria-hidden="true"></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold text-[#1F2A24]">新規注文 <span className="ui-num text-[#A2471F]">{recentNewOrders.length}件</span></p>
                    <p className="text-[14px] text-[#5C6660]">直近1時間以内に入った未対応の注文です。確認してください。</p>
                    <p className="mt-1 text-[14px] text-[#3B4640]">
                      {recentNewOrders.slice(0, 3).map((o, i) => {
                        const d = o.order_data || {};
                        return (
                          <span key={o.id}>{i > 0 && <span className="text-[#C9C3B8] mx-1.5" aria-hidden="true">|</span>}<span className="font-bold">{d.orderType === 'ec' ? 'EC' : 'カスタム'}</span> {d.customerInfo?.name || 'お客様'}（{Math.round((Date.now() - new Date(o.created_at)) / 60000)}分前）</span>
                        );
                      })}
                      {recentNewOrders.length > 3 && <span className="text-[#5C6660]">　+ {recentNewOrders.length - 3}件</span>}
                    </p>
                  </div>
                  <ChevronRight size={20} className="mt-1 text-[#5C6660] group-hover:text-[#2D4B3E] shrink-0" aria-hidden="true"/>
                </button>
              )}
              {/* ★ 進捗が遅れている注文（納品予定3日以内 + 未着手） */}
              {delayedOrders.length > 0 && (
                <button type="button" onClick={() => router.push('/staff/orders')} className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-[#FAFAF7] group">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-[#B9562F] shrink-0" aria-hidden="true"></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold text-[#1F2A24]">進捗が遅れている注文 <span className="ui-num text-[#A2471F]">{delayedOrders.length}件</span></p>
                    <p className="text-[14px] text-[#5C6660]">納品予定が3日以内なのに未着手です。早めの対応を！</p>
                    <ul className="mt-1 space-y-0.5">
                      {delayedOrders.slice(0, 3).map(o => {
                        const d = o.order_data || {};
                        const dateStr = d.receiveMethod === 'sagawa' ? (d.shippingDate || d.selectedDate) : d.selectedDate;
                        const daysLeft = Math.ceil((new Date(dateStr) - new Date()) / (24 * 60 * 60 * 1000));
                        return (
                          <li key={o.id} className="text-[14px] text-[#3B4640] flex items-center gap-3">
                            <span><span className="font-bold text-[#1F2A24]">{d.customerInfo?.name || 'お客様'}</span>{d.flowerType ? `・${d.flowerType}` : ''}</span>
                            <span className="font-bold text-[#A2471F]">{daysLeft <= 0 ? '本日!!' : `あと${daysLeft}日`}</span>
                          </li>
                        );
                      })}
                      {delayedOrders.length > 3 && <li className="text-[14px] text-[#5C6660]">+ {delayedOrders.length - 3}件</li>}
                    </ul>
                  </div>
                  <ChevronRight size={20} className="mt-1 text-[#5C6660] group-hover:text-[#2D4B3E] shrink-0" aria-hidden="true"/>
                </button>
              )}
            </div>
          )}
        </section>

        {/* [2026-10] 設定が足りないときのお知らせ（お問い合わせ用メールアドレスなど）。入力すると消える */}
        <SettingsReminderCard />

        {/* ★ 勤怠カード（TOP配置）。勤怠管理の機能がオンのお店だけ */}
        {attendanceEnabled && (
        <div className="bg-white border border-[#E6E2DA] rounded-2xl p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* 自分の打刻 */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 ${myOpenRecord ? 'bg-[#117768]' : 'bg-[#5C6660]'}`}>
                <Clock size={22}/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-[#3B4640] tracking-widest flex items-center gap-1">あなたの勤怠 <HelpTooltip articleId="punch_clock" size={12}/></p>
                {currentStaff?.name ? (
                  <>
                    <p className="text-[16px] font-bold text-[#1F2A24]">{currentStaff.name}</p>
                    {myOpenRecord ? (
                      <>
                        <p className="text-[15px] text-[#117768] font-bold mt-0.5">
                          ✓ {new Date(myOpenRecord.clock_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} から出勤中
                        </p>
                        {isOnBreak && (
                          <p className="text-[14px] text-amber-600 font-bold mt-0.5 flex items-center gap-1">
                            <Coffee size={12}/> 休憩中（{new Date(myOpenRecord.break_start_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}〜）
                          </p>
                        )}
                        {myOpenRecord.break_minutes > 0 && (
                          <p className="text-[13px] text-[#4A544E] mt-0.5">本日の休憩累計: {myOpenRecord.break_minutes}分</p>
                        )}
                      </>
                    ) : (
                      <p className="text-[14px] text-[#5C6660] mt-0.5">未打刻</p>
                    )}
                    {myMonthSummary && (
                      <p className="text-[13px] text-[#3B4640] mt-1">今月: {myMonthSummary.totalHours}時間 / {myMonthSummary.days}日</p>
                    )}
                  </>
                ) : (
                  <p className="text-[14px] text-[#5C6660] mt-1">左サイドバーからスタッフを選択してください</p>
                )}
              </div>
            </div>

            {/* 打刻ボタン */}
            <div className="flex flex-wrap gap-2 shrink-0">
              {currentStaff?.name && (
                <>
                  {!myOpenRecord ? (
                    <button onClick={handleClockIn} disabled={isClocking} className="px-5 h-12 bg-[#117768] text-white rounded-xl font-bold text-[15px] hover:bg-[#0f6a5b] disabled:opacity-50 flex items-center gap-2 shadow-sm">
                      <LogIn size={16}/> 出勤
                    </button>
                  ) : (
                    <>
                      {/* 休憩ボタン */}
                      {!isOnBreak ? (
                        <button onClick={handleBreakStart} disabled={isClocking} className="px-4 h-12 bg-amber-500 text-white rounded-xl font-bold text-[15px] hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2 shadow-sm">
                          <Coffee size={16}/> 休憩開始
                        </button>
                      ) : (
                        <button onClick={handleBreakEnd} disabled={isClocking} className="px-4 h-12 bg-amber-700 text-white rounded-xl font-bold text-[15px] hover:bg-amber-800 disabled:opacity-50 flex items-center gap-2 shadow-sm animate-pulse">
                          <Play size={16}/> 休憩終了
                        </button>
                      )}
                      <button onClick={handleClockOut} disabled={isClocking || isOnBreak} className="px-5 h-12 bg-[#B9562F] text-white rounded-xl font-bold text-[15px] hover:bg-[#A2471F] disabled:opacity-50 flex items-center gap-2 shadow-sm" title={isOnBreak ? '休憩を終了してから退勤してください' : ''}>
                        <LogOut size={16}/> 退勤
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 現在出勤中のメンバー */}
          {openAttendance.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#117768]/15">
              <p className="text-[12px] font-bold text-[#117768] tracking-widest mb-2">いま出勤中（{openAttendance.length}名）</p>
              <div className="flex flex-wrap gap-2">
                {openAttendance.map(a => (
                  <div key={a.id} className="bg-white border border-[#117768]/30 rounded-full px-3 py-1.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#117768] text-white flex items-center justify-center">
                      <UserCheck size={12}/>
                    </div>
                    <span className="text-[13px] font-bold text-[#1F2A24]">{a.staff_name}</span>
                    <span className="text-[12px] text-[#5C6660]">{new Date(a.clock_in_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}〜</span>
                    {a.break_start_at && <span className="text-[12px] font-bold text-amber-600 flex items-center gap-0.5"><Coffee size={10}/>休憩中</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        )}

        {/* 最近受付した注文 */}
        <section aria-labelledby="recent-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="recent-title" className="text-[17px] font-bold text-[#1F2A24]">最近受付した注文</h2>
            <Link href="/staff/orders" className="inline-flex items-center gap-1 h-10 px-4 rounded-full bg-white border border-[#D5D0C6] text-[14px] font-bold text-[#2D4B3E] hover:border-[#2D4B3E]">すべて見る <ChevronRight size={15} aria-hidden="true"/></Link>
          </div>
          <div className="bg-white border border-[#E6E2DA] rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-[15px] text-[#5C6660] font-bold animate-pulse">読み込み中...</div>
            ) : recentOrders.length === 0 ? (
              <div className="p-12 text-center text-[15px] text-[#5C6660] font-bold">最近の注文はありません</div>
            ) : (
              <div className="divide-y divide-[#E6E2DA]">
                {recentOrders.map(order => {
                  const d = order.order_data || {};
                  const parts = (d.selectedDate || '').split('-');
                  return (
                    <Link key={order.id} href={`/staff/orders/${order.id}`} className="px-5 py-3.5 flex items-center gap-4 hover:bg-[#FAFAF7] group">
                      <div className="w-14 shrink-0 text-center">
                        <span className="block text-[12px] text-[#5C6660]">{parts[1] ? `${Number(parts[1])}月` : '--月'}</span>
                        <span className="ui-num block text-[22px] font-bold leading-tight text-[#1F2A24]">{parts[2] ? Number(parts[2]) : '--'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-bold text-[#1F2A24] truncate">{d.customerInfo?.name} 様</p>
                        <p className="text-[14px] text-[#3B4640] flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-bold text-[#2D4B3E]">{getMethodIcon(d.receiveMethod)}{getMethodLabel(d.receiveMethod)}</span>
                          <span>{d.flowerType}</span>
                        </p>
                      </div>
                      <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-[#F1EEE7] text-[#3B4640] text-[13px] font-bold shrink-0">{statusLabel(d.status)}</span>
                      <ChevronRight size={18} className="text-[#5C6660] group-hover:text-[#2D4B3E] shrink-0" aria-hidden="true"/>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* クイックメニュー */}
        <section aria-labelledby="quick-title" className="space-y-3">
          <h2 id="quick-title" className="text-[17px] font-bold text-[#1F2A24]">クイックメニュー</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/staff/new-order" className="h-14 rounded-xl bg-[#2D4B3E] text-white flex items-center justify-center gap-2 text-[15px] font-bold hover:bg-[#1f352b]"><PlusCircle size={20} aria-hidden="true"/>新規注文</Link>
            <Link href="/staff/orders" className="h-14 rounded-xl bg-white border border-[#D5D0C6] text-[#1F2A24] flex items-center justify-center gap-2 text-[15px] font-bold hover:border-[#2D4B3E]"><ShoppingBag size={20} aria-hidden="true"/>受注一覧</Link>
            <Link href="/staff/calendar" className="h-14 rounded-xl bg-white border border-[#D5D0C6] text-[#1F2A24] flex items-center justify-center gap-2 text-[15px] font-bold hover:border-[#2D4B3E]"><Calendar size={20} aria-hidden="true"/>カレンダー</Link>
            <Link href="/staff/settings" className="h-14 rounded-xl bg-white border border-[#D5D0C6] text-[#1F2A24] flex items-center justify-center gap-2 text-[15px] font-bold hover:border-[#2D4B3E]"><Settings size={20} aria-hidden="true"/>各種設定</Link>
          </div>
        </section>

        {/* ★ お知らせ（更新情報）: utils/releaseNotes.js に追加すると表示される */}
        <ReleaseNotesCard />

      </div>
    </main>
  );
}