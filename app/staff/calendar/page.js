'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
// ★ エラーの原因：MessageSquare と CreditCard などのアイコン読み込みを追加！
import { 
  ChevronLeft, ChevronRight, RefreshCw, X, Calendar as CalendarIcon, 
  User, MapPin, Tag, FileText, Smartphone, Archive, RotateCcw, 
  Package, Store, Truck, Send, Printer, ListChecks, AlertCircle,
  MessageSquare, CreditCard
} from 'lucide-react';

export default function CalendarPage() {
  const [orders, setOrders] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: settings } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
      if (settings) setAppSettings(settings.settings_data);

      const { data: ordersData, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      setOrders(ordersData || []);
    } catch (error) {
      console.error('取得エラー:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusOptions = () => {
    const config = appSettings?.statusConfig;
    if (config?.type === 'custom' && config?.customLabels?.length > 0) return config.customLabels;
    return ['未対応', '制作中', '制作完了', '配達中'];
  };

  const updateStatusValue = async (orderId, newStatusValue) => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, currentStatus: newStatusValue, status: newStatusValue };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, order_data: updatedData });
    } catch (err) { alert('更新に失敗しました。'); }
  };

  const updateArchiveStatus = async (orderId, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'new';
    if (!confirm(`この注文を${isArchive ? '完了' : '未完了'}にしますか？`)) return;
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, status: newStatus };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      setSelectedOrder(null);
    } catch (err) { alert('更新失敗'); }
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  // ★ 注文データをカレンダーイベントにマッピング（発送日とお届け日を分離）
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
        // 業者配送：発送日(集荷) と お届け日 の両方をカレンダーに出す
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

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '業者配送' };
    return map[method] || method;
  };

  const getGoogleMapsUrl = (info) => {
    try {
      if (!info) return '#';
      const address = `${info.address1 || ''} ${info.address2 || ''}`.trim();
      if (!address) return '#';
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    } catch (e) {
      return '#';
    }
  };

  const getTotals = (orderData) => {
    if (!orderData) return { item: 0, fee: 0, pickup: 0, subTotal: 0, tax: 0, total: 0 };
    const item = Number(orderData.itemPrice) || 0;
    const fee = Number(orderData.calculatedFee) || 0;
    const pickup = Number(orderData.pickupFee) || 0;
    const subTotal = item + fee + pickup;
    const tax = Math.floor(subTotal * 0.1);
    return { item, fee, pickup, subTotal, tax, total: subTotal + tax };
  };

  const renderDay = (day, index) => {
    if (!day) return <div key={`empty-${index}`} className="min-h-[80px] md:min-h-[120px] bg-[#FBFAF9]/50 border-r border-b border-[#EAEAEA]"></div>;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayEvents = calendarEvents[dateStr] || []; 
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    // イベントを並び替え（発送業務を一番上に、その後は時間順）
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

             // ★ バッジのデザインとラベル
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

  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '日時不明';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '日時不明';
      return withTime ? d.toLocaleString('ja-JP') : d.toLocaleDateString('ja-JP');
    } catch (e) { return '日時不明'; }
  };

  const modalData = selectedOrder?.order_data || {};
  const modalTargetInfo = modalData.isRecipientDifferent ? (modalData.recipientInfo || {}) : (modalData.customerInfo || {});
  const isSagawa = modalData.receiveMethod === 'sagawa';
  const isPickup = modalData.receiveMethod === 'pickup';
  const isDelivery = modalData.receiveMethod === 'delivery';

  return (
    <main className="pb-32 font-sans">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 py-3 md:h-20 gap-3 sticky top-0 z-10">
        <div className="flex items-center justify-between w-full md:w-auto">
          <h1 className="text-[16px] md:text-[18px] font-bold tracking-tight text-[#2D4B3E]">納品カレンダー</h1>
          <button onClick={fetchData} className="md:hidden flex items-center gap-1 px-3 py-1.5 bg-white border border-[#EAEAEA] rounded-lg text-[10px] font-bold text-[#555555] hover:border-[#2D4B3E] transition-all shadow-sm">
            <RefreshCw size={12} /> 更新
          </button>
        </div>
        
        {/* ★ 凡例（レジェンド）の追加 */}
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
          <button onClick={fetchData} className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] transition-all shadow-sm shrink-0">
            <RefreshCw size={14} /> 表示更新
          </button>
        </div>
      </header>

      <div className="p-2 md:p-8 max-w-[1400px] mx-auto">
        {/* スマホ用凡例 */}
        <div className="lg:hidden flex flex-wrap gap-2 text-[9px] font-bold bg-white p-3 rounded-xl border border-[#EAEAEA] mb-3 shadow-sm">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600"></span> 発送</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-50 border border-green-200"></span> お届け</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-50 border border-blue-200"></span> 配達</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-50 border border-orange-200"></span> 店頭</span>
        </div>

        {isLoading ? (
          <div className="p-20 text-center text-[#999999] font-bold animate-pulse tracking-widest">データを読み込み中...</div>
        ) : (
          <div className="bg-white rounded-[16px] md:rounded-[32px] border border-[#EAEAEA] shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-[#EAEAEA] bg-[#FBFAF9]">
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                 <div key={d} className={`p-2 md:p-3 text-center text-[8px] md:text-[10px] font-bold tracking-widest uppercase border-r border-[#EAEAEA] last:border-0 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[#999999]'}`}>{d}</div>
               ))}
            </div>
            <div className="grid grid-cols-7">
               {calendarDays.map((day, i) => renderDay(day, i))}
            </div>
          </div>
        )}
      </div>

      {/* --- 詳細モーダル (完全最新版) --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111111]/60 backdrop-blur-sm p-3 md:p-4 animate-in fade-in" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[#FBFAF9] rounded-[24px] md:rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col" onClick={(e) => e.stopPropagation()}>
            
            {/* モーダルヘッダー */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#EAEAEA] p-4 md:p-6 flex flex-wrap items-center justify-between gap-3 z-20 rounded-t-[24px] md:rounded-t-[32px]">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-[16px] md:text-[18px] font-black text-[#2D4B3E]">注文詳細</h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${modalData.status === 'completed' || modalData.status === '完了' ? 'bg-gray-100 text-gray-500' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                    {modalData.status === 'completed' || modalData.status === '完了' ? '完了' : '未完了'}
                  </span>
                </div>
                <p className="text-[10px] md:text-[11px] text-[#999999] font-bold mt-1">受付: {safeFormatDate(selectedOrder.created_at, true)} | ID: {selectedOrder.id}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <button className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[10px] md:text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">
                  <Printer size={14} /> <span className="hidden sm:inline">印刷</span>
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[10px] md:text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">
                  <FileText size={14} /> PDF
                </button>
                {modalData.customerInfo?.email && (
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-[#2D4B3E] text-white rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-[#1f352b] transition-all shadow-sm">
                    <Send size={14} /> <span className="hidden sm:inline">メール</span>
                  </button>
                )}
                
                <div className="w-[1px] h-6 bg-[#EAEAEA] mx-1"></div>

                <button onClick={() => updateArchiveStatus(selectedOrder.id, modalData.status !== 'completed' && modalData.status !== '完了')} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] md:text-[11px] font-bold rounded-xl transition-all shadow-sm ${modalData.status === 'completed' || modalData.status === '完了' ? 'bg-white border border-[#EAEAEA] text-[#555555]' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b]'}`}>
                  {modalData.status === 'completed' || modalData.status === '完了' ? <RotateCcw size={14}/> : <Archive size={14}/>}
                  <span className="hidden sm:inline">{modalData.status === 'completed' || modalData.status === '完了' ? '未完了に戻す' : '完了にする'}</span>
                </button>
                
                <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 md:w-10 md:h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555555] font-bold hover:bg-[#EAEAEA] transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="p-4 md:p-8 space-y-6 md:space-y-8 text-left overflow-x-hidden">
              
              {/* ステータス変更 */}
              <div className="bg-white p-5 rounded-[24px] border border-[#EAEAEA] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1.5 rounded-lg text-[11px] md:text-[12px] font-bold flex items-center gap-1 ${isPickup ? 'bg-orange-100 text-orange-700' : isDelivery ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {isPickup ? <Store size={14}/> : isDelivery ? <Truck size={14}/> : <Package size={14}/>}
                    {isPickup ? '店頭受取' : isDelivery ? '自社配達' : '業者配送'}
                  </span>
                </div>
                <div className="flex items-center gap-3 bg-[#FBFAF9] p-2 rounded-2xl border border-[#EAEAEA]">
                  <span className="text-[11px] font-bold text-[#999999] pl-2 flex items-center gap-1"><ListChecks size={14}/> ステータス</span>
                  <select 
                    value={modalData.currentStatus || modalData.status || 'new'} 
                    onChange={(e) => updateStatusValue(selectedOrder.id, e.target.value)}
                    className="h-10 bg-white border border-[#EAEAEA] rounded-xl px-3 text-[12px] font-bold text-[#2D4B3E] outline-none shadow-sm cursor-pointer"
                  >
                    <option value="new">未対応 (新規)</option>
                    {getStatusOptions().map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* ★ 巨大な発送日パネル（業者配送の場合） */}
              {isSagawa ? (
                <div className="bg-green-50 border-2 border-green-200 p-6 md:p-8 rounded-[24px] flex flex-col md:flex-row items-center gap-6 justify-center text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-bl-[64px] -mr-4 -mt-4"></div>
                  
                  <div className="space-y-1 relative z-10">
                    <span className="text-[12px] font-bold text-green-700 tracking-widest bg-white/50 px-3 py-1 rounded-full">【箱詰め・集荷】発送予定日</span>
                    <p className="text-[28px] md:text-[36px] font-black text-green-900 flex items-center justify-center gap-2 pt-2">
                      <Package size={24} className="text-green-600"/> 
                      {modalData.shippingDate ? `${modalData.shippingDate.split('-')[1]}月${modalData.shippingDate.split('-')[2]}日` : '未設定'}
                    </p>
                  </div>
                  
                  <ChevronRight size={32} className="hidden md:block text-green-300 relative z-10"/>
                  
                  <div className="space-y-1 relative z-10">
                    <span className="text-[12px] font-bold text-green-700 tracking-widest">お客様 お届け日</span>
                    <p className="text-[18px] md:text-[20px] font-bold text-green-800 flex items-center justify-center gap-2 pt-2">
                      <CalendarIcon size={18} className="text-green-600"/> 
                      {modalData.selectedDate ? `${modalData.selectedDate.split('-')[1]}月${modalData.selectedDate.split('-')[2]}日` : '未指定'}
                    </p>
                    <p className="text-[12px] font-bold text-green-700">{modalData.selectedTime || '時間指定なし'}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#FBFAF9] border border-[#EAEAEA] p-6 rounded-[24px] flex flex-col items-center justify-center text-center shadow-inner">
                   <span className="text-[12px] font-bold text-[#999999] tracking-widest mb-1">
                     {isPickup ? 'ご来店予定日' : '配達予定日'}
                   </span>
                   <p className="text-[28px] font-black text-[#2D4B3E] flex items-center gap-2">
                     <CalendarIcon size={24}/> {modalData.selectedDate ? `${modalData.selectedDate.split('-')[1]}月${modalData.selectedDate.split('-')[2]}日` : '未設定'}
                   </p>
                   <p className="text-[14px] font-bold text-[#D97C8F] mt-2">{modalData.selectedTime || '時間指定なし'}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 注文者情報 */}
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><User size={18}/> 注文者情報</h3>
                  <div className="space-y-4 text-[13px] bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                    <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">お名前</span><span className="font-black text-[16px]">{modalData.customerInfo?.name || '未設定'} 様</span></p>
                    <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">電話番号</span><span className="font-bold text-[14px]">{modalData.customerInfo?.phone || '未設定'}</span></p>
                    {modalData.customerInfo?.email && <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">メール</span><span className="font-bold text-[#4285F4]">{modalData.customerInfo?.email}</span></p>}
                    {!isPickup && <p className="pt-2 border-t border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">住所</span><span className="font-bold leading-relaxed">〒{modalData.customerInfo?.zip}<br/>{modalData.customerInfo?.address1} {modalData.customerInfo?.address2}</span></p>}
                  </div>
                </div>

                {/* お届け先情報 ＆ Googleマップ */}
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><MapPin size={18}/> お届け先情報</h3>
                  <div className="space-y-3 text-[13px]">
                    
                    {isPickup ? (
                      <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                        <p><span className="text-[#999999] text-[10px] block mb-1 tracking-widest">受取店舗</span><span className="font-black text-[16px] text-[#2D4B3E]">{modalData.selectedShop || '未指定'}</span></p>
                      </div>
                    ) : (
                      <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA] space-y-3 relative overflow-hidden">
                        {modalData.isRecipientDifferent && <div className="absolute top-0 right-0 bg-[#2D4B3E] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">注文者と別住所</div>}
                        <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">宛名</span><span className="font-black text-[16px]">{modalTargetInfo?.name || '未設定'} 様</span></p>
                        <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">お届け先住所</span><span className="font-bold text-[14px] block leading-relaxed">〒{modalTargetInfo?.zip}<br/>{modalTargetInfo?.address1} {modalTargetInfo?.address2}</span></p>
                        
                        <a 
                          href={getGoogleMapsUrl(modalTargetInfo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-3 text-[12px] font-bold text-white bg-[#4285F4] px-4 py-2.5 rounded-xl hover:bg-[#3367D6] transition-all shadow-md active:scale-95 w-full justify-center"
                        >
                          <MapPin size={16} /> Googleマップで場所を確認
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 置き配設定 */}
              {(isDelivery || isSagawa) && (
                <div className="bg-orange-50 p-6 rounded-[24px] border border-orange-200 shadow-sm space-y-2">
                  <h3 className="text-[12px] font-bold text-orange-800 flex items-center gap-2"><AlertCircle size={16}/> ご不在時の対応</h3>
                  <p className="text-[15px] font-black text-orange-900">
                    {modalData.absenceAction === '置き配' ? `置き配希望: ${modalData.absenceNote}` : '持ち戻り (再配達)'}
                  </p>
                </div>
              )}

              {/* 商品とデザイン詳細 */}
              <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><Tag size={18}/> オーダー内容</h3>
                <div className="flex flex-col sm:flex-row gap-6">
                  {modalData.referenceImage ? (
                    <img src={modalData.referenceImage} alt="参考" className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-2xl border border-[#EAEAEA] shadow-sm shrink-0" />
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl flex items-center justify-center text-[#999999] text-[11px] font-bold shrink-0">画像なし</div>
                  )}
                  <div className="flex-1 grid grid-cols-2 gap-4 text-[13px]">
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">お花の種類</span><span className="font-black text-[#2D4B3E] text-[14px]">{modalData.flowerType || '未設定'}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">用途</span><span className="font-bold">{modalData.flowerPurpose} {modalData.otherPurpose && `(${modalData.otherPurpose})`}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">カラー</span><span className="font-bold">{modalData.flowerColor}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">イメージ</span><span className="font-bold">{modalData.flowerVibe} {modalData.otherVibe && `(${modalData.otherVibe})`}</span></div>
                  </div>
                </div>
                {modalData.isBring === 'bring' && <div className="bg-orange-100 text-orange-700 px-3 py-2 rounded-xl text-[12px] font-bold mt-2 inline-block border border-orange-200">※お客様からのお花/器の持込あり</div>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                {/* メッセージ・立札 */}
                {modalData.cardType !== 'なし' && (
                  <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                    <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><MessageSquare size={18}/> 添付物: {modalData.cardType}</h3>
                    
                    {modalData.cardType === 'メッセージカード' && (
                      <div className="bg-[#FBFAF9] p-5 rounded-2xl text-[13px] font-bold whitespace-pre-wrap border border-[#EAEAEA] text-[#333333] leading-relaxed">
                        {modalData.cardMessage}
                      </div>
                    )}

                    {modalData.cardType === '立札' && (
                      <div className="space-y-1.5 text-[12px] bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                        <span className="inline-block bg-[#2D4B3E] text-white px-2 py-0.5 rounded text-[10px] font-bold mb-2">{modalData.tatePattern}</span>
                        {modalData.tateInput1 && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">内容:</span><span className="font-black">{modalData.tateInput1}</span></div>}
                        {modalData.tateInput2 && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">宛名:</span><span className="font-black">{modalData.tateInput2} 様</span></div>}
                        {modalData.tateInput3 && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">贈り主:</span><span className="font-black">{modalData.tateInput3}</span></div>}
                        {modalData.tateInput3a && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">会社名:</span><span className="font-black">{modalData.tateInput3a}</span></div>}
                        {modalData.tateInput3b && <div className="flex"><span className="w-16 text-[#999999] font-bold">役職・名:</span><span className="font-black">{modalData.tateInput3b}</span></div>}
                      </div>
                    )}
                  </div>
                )}

                {/* お支払い内訳 */}
                <div className="bg-white p-6 md:p-8 rounded-[32px] border-2 border-[#2D4B3E]/20 shadow-md space-y-6">
                  <h3 className="text-[16px] font-black text-[#2D4B3E] border-b border-[#EAEAEA] pb-3 flex items-center gap-2"><CreditCard size={20}/> お支払い情報</h3>
                  <div className="space-y-3 text-[13px] md:text-[14px] font-medium text-[#555555]">
                    <div className="flex justify-between items-center"><span>商品代 (税抜):</span><span className="font-black text-[#111111] text-[16px]">¥{getTotals(modalData).item.toLocaleString()}</span></div>
                    {getTotals(modalData).fee > 0 && <div className="flex justify-between items-center text-blue-600"><span>配送料 (箱・クール含):</span><span className="font-bold">¥{getTotals(modalData).fee.toLocaleString()}</span></div>}
                    {getTotals(modalData).pickup > 0 && <div className="flex justify-between items-center text-orange-600"><span>器回収・返却費:</span><span className="font-bold">¥{getTotals(modalData).pickup.toLocaleString()}</span></div>}
                    <div className="flex justify-between items-center border-t border-[#EAEAEA] pt-3 text-[#2D4B3E]"><span>消費税 (10%):</span><span className="font-bold">¥{getTotals(modalData).tax.toLocaleString()}</span></div>
                    
                    <div className="flex justify-between border-t-2 border-[#2D4B3E]/20 pt-4 mt-2 items-end">
                      <span className="text-[13px] font-bold text-[#2D4B3E] tracking-widest mb-1">合計 (税込)</span>
                      <span className="text-[32px] md:text-[36px] font-black text-[#2D4B3E] leading-none">¥{getTotals(modalData).total.toLocaleString()}</span>
                    </div>
                  </div>
                  {modalData.paymentMethod && (
                    <div className="pt-4 flex justify-end border-t border-[#EAEAEA]">
                      <span className="inline-block bg-[#2D4B3E]/10 text-[#2D4B3E] px-4 py-2 rounded-xl text-[12px] font-bold border border-[#2D4B3E]/20 shadow-sm">
                        支払方法: {modalData.paymentMethod}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* メモ */}
              {modalData.note && (
                <div className="bg-yellow-50 p-6 rounded-[24px] border border-yellow-200 shadow-sm mb-4">
                  <h3 className="text-[12px] font-bold text-yellow-800 mb-2 tracking-widest flex items-center gap-2">社内メモ / お客様要望</h3>
                  <p className="text-[14px] font-bold text-yellow-900 whitespace-pre-wrap leading-relaxed">{modalData.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}