'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase'; 
import {
  ChevronLeft, ChevronRight, RefreshCw, Calendar as CalendarIcon,
} from 'lucide-react';
import HelpTooltip from '@/components/HelpTooltip';
import OrderDetailModal from '@/components/OrderDetailModal'; 

export default function CalendarPage() {
  const [orders, setOrders] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [currentTenantId, setCurrentTenantId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/staff/login';
        return;
      }

      const { data: profile, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
      if (profileError) throw profileError;
      
      const tId = profile.tenant_id;
      setCurrentTenantId(tId);

      const CACHE_KEY_ORDERS = `florix_orders_cache_${tId}`;
      const CACHE_KEY_SETTINGS = `florix_settings_cache_${tId}`;

      if (!forceRefresh) {
        const cachedOrders = sessionStorage.getItem(CACHE_KEY_ORDERS);
        const cachedSettings = sessionStorage.getItem(CACHE_KEY_SETTINGS);
        
        if (cachedOrders && cachedSettings) {
          setOrders(JSON.parse(cachedOrders));
          setAppSettings(JSON.parse(cachedSettings));
          setIsLoading(false);
          fetchLatestDataSilently(tId, CACHE_KEY_ORDERS);
          return;
        }
      }

      const { data: settings } = await supabase.from('app_settings').select('settings_data').eq('id', tId).single();
      if (settings) {
        setAppSettings(settings.settings_data);
        sessionStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(settings.settings_data));
      }

      // ★ セキュリティ修正: tenant_id でフィルタ
      const { data: ordersData, error } = await supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false });
      if (error) throw error;
      
      const latestOrders = ordersData || [];
      setOrders(latestOrders);
      sessionStorage.setItem(CACHE_KEY_ORDERS, JSON.stringify(latestOrders));
      
    } catch (error) {
      console.error('取得エラー:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLatestDataSilently = async (tId, cacheKey) => {
    try {
      // ★ セキュリティ修正: tenant_id でフィルタ
      const { data: ordersData } = await supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false });
      if (ordersData) {
        setOrders(ordersData);
        sessionStorage.setItem(cacheKey, JSON.stringify(ordersData));
      }
    } catch (error) {
      console.error('バックグラウンド更新エラー:', error.message);
    }
  };

  const handleUpdateStatus = async (orderId, newStatus, staffName) => {
    // ★ 担当スタッフは任意化 (未選択でも更新可能)
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const currentHistory = targetOrder.order_data.statusHistory || [];

      const newHistoryEntry = {
        status: newStatus,
        staff: staffName || '-',
        date: new Date().toISOString()
      };

      const updatedData = { 
        ...targetOrder.order_data, 
        currentStatus: newStatus, 
        status: newStatus,
        statusHistory: [newHistoryEntry, ...currentHistory]
      };
      
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);

      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      setSelectedOrder({ ...targetOrder, order_data: updatedData });
    } catch (err) {
      alert('更新に失敗しました。');
    }
  };

  // ★ 新規追加：入金ステータス更新処理
  const handleUpdatePayment = async (orderId, currentData, opts = {}) => {
    if (!opts.skipConfirm) {
      if (!confirm('この注文を「入金済」として処理しますか？')) return;
    }
    try {
      let updatedData;
      if (opts.alreadyUpdated) {
        // モーダル経由：DB更新済みなのでローカル反映だけ
        updatedData = currentData;
      } else {
        const oldStatus = currentData.paymentStatus || '';
        let newStatus = '入金済';
        if (oldStatus.includes('引き取り時')) {
          newStatus = '入金済（引き取り時受領）';
        }
        updatedData = { ...currentData, paymentStatus: newStatus };
        // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
        await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);
      }

      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      setSelectedOrder(prev => ({ ...prev, order_data: updatedData }));
      if (!opts.skipConfirm) alert('入金済みに更新しました！');
    } catch (error) {
      console.error(error);
      alert('更新に失敗しました。');
    }
  };

  const handleArchive = async (orderId, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'new';
    if (!confirm(`この注文を${isArchive ? '完了' : '未完了'}にしますか？`)) return;
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, status: newStatus };
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);
      
      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));
      
      setSelectedOrder(null);
    } catch (err) { alert('更新失敗'); }
  };

  const handleDelete = async (orderId) => {
    const inputPass = prompt('この注文を削除しますか？\n実行するには管理者パスワードを入力してください。');
    if (inputPass === null) return; 

    const systemPass = appSettings?.generalConfig?.systemPassword || '7777';

    if (inputPass !== systemPass) {
      alert('パスワードが違います。');
      return;
    }

    if (!confirm('本当に削除してもよろしいですか？\nこの操作は取り消せません。')) return;

    try {
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      const { error } = await supabase.from('orders').delete().eq('id', orderId).eq('tenant_id', currentTenantId);
      if (error) throw error;

      const newOrders = orders.filter(o => o.id !== orderId);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));
      setSelectedOrder(null); 
      alert('注文を削除しました。');
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました。');
    }
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const calendarEvents = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const d = order.order_data || {};
      if (d.status === 'キャンセル') return;

      const addEvent = (dateStr, type) => {
        if (!dateStr) return;
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({ order, type });
      };

      if (d.receiveMethod === 'sagawa') {
        if (d.shippingDate) addEvent(d.shippingDate, 'dispatch');
        if (d.selectedDate) addEvent(d.selectedDate, 'sagawa_delivery');
      } else if (d.receiveMethod === 'pickup') {
        if (d.selectedDate) addEvent(d.selectedDate, 'pickup');
      } else if (d.receiveMethod === 'delivery') {
        if (d.selectedDate) addEvent(d.selectedDate, 'delivery');
      }
    });
    return map;
  }, [orders]);

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const renderDay = (day, index) => {
    if (!day) return <div key={`empty-${index}`} className="min-h-[80px] md:min-h-[120px] bg-[#FBFAF9]/50 border-r border-b border-[#EAEAEA]"></div>;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayEvents = calendarEvents[dateStr] || []; 
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    dayEvents.sort((a, b) => {
      if (a.type === 'dispatch' && b.type !== 'dispatch') return -1;
      if (a.type !== 'dispatch' && b.type === 'dispatch') return 1;
      const timeA = a.order.order_data.selectedTime || '99:99';
      const timeB = b.order.order_data.selectedTime || '99:99';
      return timeA.localeCompare(timeB);
    });

    return (
      <div key={day} className={`min-h-[80px] md:min-h-[120px] p-1 md:p-2 border-r border-b border-[#EAEAEA] bg-white transition-all hover:bg-gray-50/50 ${isToday ? 'bg-[#2D4B3E]/5' : ''}`}>
        <div className={`text-[10px] md:text-[11px] font-bold mb-1 md:mb-2 flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full mx-auto ${isToday ? 'bg-[#2D4B3E] text-white' : 'text-[#555555]'}`}>{day}</div>
        <div className="space-y-1 max-h-[80px] md:max-h-[100px] overflow-y-auto hide-scrollbar">
          {dayEvents.map((ev, idx) => {
             const d = ev.order.order_data;
             const isCompleted = d.status === 'completed' || d.status === '完了'; 

             let badgeColor = '';
             let timeLabel = '';

             if (ev.type === 'dispatch') {
               badgeColor = 'bg-green-600 text-white hover:bg-green-700 shadow-sm';
               timeLabel = '発送';
             } else if (ev.type === 'sagawa_delivery') {
               badgeColor = 'bg-green-50 border border-green-200 text-green-700 hover:border-green-400';
               timeLabel = 'お届け';
             } else if (ev.type === 'delivery') {
               badgeColor = 'bg-blue-50 border border-blue-200 text-blue-700 hover:border-blue-400';
               timeLabel = d.selectedTime?.split('-')[0] || '配達';
             } else if (ev.type === 'pickup') {
               badgeColor = 'bg-orange-50 border border-orange-200 text-orange-700 hover:border-orange-400';
               timeLabel = d.selectedTime?.split('-')[0] || '来店';
             }
             
             return (
               <div 
                 key={`${ev.order.id}-${idx}`} 
                 onClick={() => setSelectedOrder(ev.order)} 
                 className={`text-[8px] md:text-[10px] p-1 md:p-1.5 rounded cursor-pointer truncate transition-all ${badgeColor} ${isCompleted ? 'opacity-40 line-through' : ''}`}
               >
                 <span className="font-bold">{timeLabel}</span> <span className="hidden sm:inline">{d.customerInfo?.name}</span><span className="sm:hidden">{d.customerInfo?.name?.substring(0,2)}..</span>
               </div>
             )
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-32 font-sans">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 py-3 md:h-20 gap-3 sticky top-0 z-10">
        <div className="flex items-center justify-between w-full md:w-auto">
          <h1 className="text-[16px] md:text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2">納品カレンダー <HelpTooltip articleId="order_status"/></h1>
          <button onClick={() => fetchData(true)} className="md:hidden flex items-center gap-1 px-3 py-1.5 bg-white border border-[#EAEAEA] rounded-lg text-[10px] font-bold text-[#555555] hover:border-[#2D4B3E] transition-all shadow-sm">
            <RefreshCw size={12} /> 更新
          </button>
        </div>
        
        <div className="hidden lg:flex flex-wrap gap-3 text-[10px] font-bold bg-[#FBFAF9] px-4 py-2 rounded-xl border border-[#EAEAEA]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-600 shadow-sm"></span> 発送業務 (箱詰め)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-50 border border-green-200"></span> 業者お届け日</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-50 border border-blue-200"></span> 自社配達</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-50 border border-orange-200"></span> 店頭受取</span>
        </div>

        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-1 md:gap-2 bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] w-full md:w-auto justify-between">
            <button onClick={prevMonth} className="p-2 hover:bg-white rounded-lg transition-all text-[#555555]"><ChevronLeft size={16}/></button>
            <span className="px-2 md:px-3 font-bold text-[12px] md:text-[13px] min-w-[90px] md:min-w-[100px] text-center">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</span>
            <button onClick={nextMonth} className="p-2 hover:bg-white rounded-lg transition-all text-[#555555]"><ChevronRight size={16}/></button>
          </div>
          <button onClick={() => fetchData(true)} className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] transition-all shadow-sm shrink-0">
            <RefreshCw size={14} /> 最新の情報に更新
          </button>
        </div>
      </header>

      <div className="p-2 md:p-8 max-w-[1400px] mx-auto">
        <div className="lg:hidden flex flex-wrap gap-2 text-[9px] font-bold bg-white p-3 rounded-xl border border-[#EAEAEA] mb-3 shadow-sm">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600"></span> 発送</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-50 border border-green-200"></span> お届け</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-50 border border-blue-200"></span> 配達</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-50 border border-orange-200"></span> 店頭</span>
        </div>

        {isLoading ? (
          <div className="p-20 text-center text-[#999999] font-bold animate-pulse">データを読み込み中...</div>
        ) : (
          <div className="bg-white rounded-xl md:rounded-2xl border border-[#EAEAEA] shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-[#EAEAEA] bg-[#FBFAF9]">
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                 <div key={d} className={`p-2 md:p-3 text-center text-[8px] md:text-[10px] font-bold uppercase border-r border-[#EAEAEA] last:border-0 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[#999999]'}`}>{d}</div>
               ))}
            </div>
            <div className="grid grid-cols-7">
               {calendarDays.map((day, i) => renderDay(day, i))}
            </div>
          </div>
        )}
      </div>

      {/* ★ onUpdatePayment を新たに追加！ */}
      <OrderDetailModal 
        order={selectedOrder} 
        appSettings={appSettings} 
        onClose={() => setSelectedOrder(null)} 
        onUpdateStatus={handleUpdateStatus} 
        onUpdatePayment={handleUpdatePayment} 
        onArchive={handleArchive} 
        onDelete={handleDelete} 
      />
      
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}