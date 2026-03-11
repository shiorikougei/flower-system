'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  ChevronLeft, ChevronRight, RefreshCw, X, Calendar as CalendarIcon, 
  User, MapPin, Tag, FileText, Smartphone, Archive, RotateCcw 
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
      const updatedData = { ...targetOrder.order_data, currentStatus: newStatusValue };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, order_data: updatedData });
    } catch (err) { alert('更新に失敗しました。'); }
  };

  const updateArchiveStatus = async (orderId, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'active';
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

  const ordersByDate = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const dateStr = order.order_data.selectedDate;
      if (!dateStr) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(order);
    });
    return map;
  }, [orders]);

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '佐川急便' };
    return map[method] || method;
  };

  const renderDay = (day, index) => {
    if (!day) return <div key={`empty-${index}`} className="min-h-[80px] md:min-h-[120px] bg-[#FBFAF9]/50 border-r border-b border-[#EAEAEA]"></div>;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayOrders = ordersByDate[dateStr] || []; 
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    return (
      <div key={day} className={`min-h-[80px] md:min-h-[120px] p-1 md:p-2 border-r border-b border-[#EAEAEA] bg-white transition-all hover:bg-gray-50/50 ${isToday ? 'bg-[#2D4B3E]/5' : ''}`}>
        <div className={`text-[10px] md:text-[11px] font-bold mb-1 md:mb-2 flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full mx-auto ${isToday ? 'bg-[#2D4B3E] text-white' : 'text-[#555555]'}`}>{day}</div>
        <div className="space-y-1">
          {dayOrders.map(order => {
             const d = order.order_data;
             const isCompleted = d.status === 'completed'; 

             let badgeColor = 'bg-gray-100 text-gray-700 hover:border-gray-400'; 
             if(d.receiveMethod === 'delivery') badgeColor = 'bg-[#D97C8F]/10 text-[#D97C8F] hover:border-[#D97C8F]';
             if(d.receiveMethod === 'sagawa') badgeColor = 'bg-blue-50 text-blue-600 hover:border-blue-400';
             
             return (
               <div 
                 key={order.id} 
                 onClick={() => setSelectedOrder(order)} 
                 className={`text-[8px] md:text-[10px] p-1 md:p-1.5 rounded cursor-pointer truncate transition-all border border-transparent ${badgeColor} ${isCompleted ? 'opacity-40 line-through' : ''}`}
               >
                 <span className="font-bold">{d.selectedTime?.split('-')[0] || ''}</span> <span className="hidden sm:inline">{d.customerInfo?.name}</span><span className="sm:hidden">{d.customerInfo?.name?.substring(0,2)}..</span>
               </div>
             )
          })}
        </div>
      </div>
    );
  };

  return (
    <main className="pb-32 font-sans">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 py-3 md:h-20 gap-3 sticky top-0 z-10">
        <div className="flex items-center justify-between w-full md:w-auto">
          <h1 className="text-[16px] md:text-[18px] font-bold tracking-tight text-[#2D4B3E]">納品カレンダー</h1>
          <button onClick={fetchData} className="md:hidden flex items-center gap-1 px-3 py-1.5 bg-white border border-[#EAEAEA] rounded-lg text-[10px] font-bold text-[#555555] hover:border-[#2D4B3E] transition-all shadow-sm">
            <RefreshCw size={12} /> 更新
          </button>
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

      <div className="p-2 md:p-8">
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

      {/* --- 詳細モーダル (受注一覧と共通・完全レスポンシブ版) --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111111]/60 backdrop-blur-sm p-3 md:p-4 animate-in fade-in" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[#FBFAF9] rounded-[24px] md:rounded-[32px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] p-4 md:p-6 flex flex-wrap items-center justify-between gap-3 z-10 rounded-t-[24px] md:rounded-t-[32px]">
              <div className="flex items-center gap-3 md:gap-4">
                <h2 className="text-[16px] md:text-[18px] font-bold text-[#2D4B3E]">注文詳細</h2>
                <select value={selectedOrder.order_data?.currentStatus || getStatusOptions()[0]} onChange={(e) => updateStatusValue(selectedOrder.id, e.target.value)} className="text-[11px] md:text-[12px] font-bold bg-[#2D4B3E] text-white rounded-lg px-3 py-1.5 outline-none shadow-sm cursor-pointer">
                  {getStatusOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 md:gap-3 ml-auto">
                <button onClick={() => updateArchiveStatus(selectedOrder.id, selectedOrder.order_data?.status !== 'completed')} className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 text-[10px] md:text-[12px] font-bold rounded-xl transition-all shadow-sm ${selectedOrder.order_data?.status === 'completed' ? 'bg-white border border-[#EAEAEA] text-[#555555]' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b]'}`}>
                  {selectedOrder.order_data?.status === 'completed' ? <RotateCcw size={14}/> : <Archive size={14}/>}
                  <span className="hidden sm:inline">{selectedOrder.order_data?.status === 'completed' ? '未完了に戻す' : '完了してアーカイブ'}</span>
                  <span className="sm:hidden">{selectedOrder.order_data?.status === 'completed' ? '戻す' : '完了'}</span>
                </button>
                <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 md:w-10 md:h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555555] font-bold hover:bg-[#EAEAEA] transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="p-4 md:p-8 space-y-6 md:space-y-8 text-left overflow-x-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-2">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><CalendarIcon size={12}/> お届け・受取情報</p>
                  <p className="text-[15px] md:text-[16px] font-black text-[#2D4B3E]">{selectedOrder.order_data.selectedDate} {selectedOrder.order_data.selectedTime}</p>
                  <p className="text-[12px] md:text-[13px] font-bold">{getMethodLabel(selectedOrder.order_data.receiveMethod)} {selectedOrder.order_data.receiveMethod === 'pickup' && `(${selectedOrder.order_data.selectedShop})`}</p>
                </div>
                <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-2">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><User size={12}/> ご注文者様</p>
                  <p className="font-bold text-[14px] md:text-[15px]">{selectedOrder.order_data.customerInfo?.name} 様</p>
                  <p className="text-[11px] md:text-[12px] text-[#555555] flex items-center gap-1"><Smartphone size={12}/> {selectedOrder.order_data.customerInfo?.phone}</p>
                  {selectedOrder.order_data.receiveMethod !== 'pickup' && <p className="text-[10px] md:text-[11px] text-[#999999] leading-tight">〒{selectedOrder.order_data.customerInfo?.zip}<br/>{selectedOrder.order_data.customerInfo?.address1}{selectedOrder.order_data.customerInfo?.address2}</p>}
                </div>
              </div>

              {selectedOrder.order_data.isRecipientDifferent && (
                <div className="animate-in fade-in">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 mb-2"><MapPin size={12}/> お届け先様（別住所）</p>
                  <div className="bg-white p-4 md:p-5 rounded-2xl border border-red-100 shadow-sm space-y-2 text-[12px] md:text-[13px]">
                    <p className="font-bold text-[14px] md:text-[15px] text-red-700">{selectedOrder.order_data.recipientInfo?.name} 様</p>
                    <p className="text-[#555555]">📞 {selectedOrder.order_data.recipientInfo?.phone}</p>
                    <p className="text-[11px] md:text-[12px] text-red-600/70 leading-tight">〒{selectedOrder.order_data.recipientInfo?.zip}<br/>{selectedOrder.order_data.recipientInfo?.address1}{selectedOrder.order_data.recipientInfo?.address2}</p>
                  </div>
                </div>
              )}

              <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEAEA] shadow-sm">
                <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest mb-4 flex items-center gap-2"><Tag size={12}/> 商品詳細</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-[12px] md:text-[13px] font-bold mb-4 md:mb-6">
                  <div><span className="text-[9px] md:text-[10px] block text-[#999999] mb-0.5">種類</span>{selectedOrder.order_data.flowerType}</div>
                  <div><span className="text-[9px] md:text-[10px] block text-[#999999] mb-0.5">用途</span>{selectedOrder.order_data.flowerPurpose}</div>
                  <div><span className="text-[9px] md:text-[10px] block text-[#999999] mb-0.5">カラー</span>{selectedOrder.order_data.flowerColor}</div>
                  <div><span className="text-[9px] md:text-[10px] block text-[#999999] mb-0.5">イメージ</span>{selectedOrder.order_data.flowerVibe}</div>
                </div>
                <div className="border-t border-[#FBFAF9] pt-4 space-y-2 text-[12px] md:text-[13px]">
                  <div className="flex justify-between text-[#555555]"><span>商品代金 (税抜)</span><span className="font-bold font-mono">¥{Number(selectedOrder.order_data.itemPrice).toLocaleString()}</span></div>
                  {Number(selectedOrder.order_data.calculatedFee) > 0 && <div className="flex justify-between text-[#555555]"><span>配達・送料</span><span className="font-bold font-mono">¥{Number(selectedOrder.order_data.calculatedFee).toLocaleString()}</span></div>}
                  {Number(selectedOrder.order_data.pickupFee) > 0 && <div className="flex justify-between text-orange-600"><span>回収料</span><span className="font-bold font-mono">¥{Number(selectedOrder.order_data.pickupFee).toLocaleString()}</span></div>}
                  <div className="flex justify-between text-[#2D4B3E]"><span>消費税 (10%)</span><span className="font-bold font-mono">¥{Math.floor((Number(selectedOrder.order_data.itemPrice) + Number(selectedOrder.order_data.calculatedFee || 0) + Number(selectedOrder.order_data.pickupFee || 0)) * 0.1).toLocaleString()}</span></div>
                  <div className="flex justify-between text-[15px] md:text-[16px] mt-3 pt-3 border-t border-[#FBFAF9] font-black text-[#2D4B3E]"><span>合計金額 (税込)</span><span className="font-mono tracking-tight">¥{Math.floor(((Number(selectedOrder.order_data.itemPrice) + Number(selectedOrder.order_data.calculatedFee || 0) + Number(selectedOrder.order_data.pickupFee || 0)) * 1.1)).toLocaleString()}</span></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-4">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> 立札・メッセージ</p>
                  <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#EAEAEA] shadow-sm min-h-[100px] md:min-h-[120px]">
                    <span className="inline-block px-2 md:px-3 py-1 bg-[#2D4B3E] text-white text-[9px] md:text-[10px] font-bold rounded-md mb-3">{selectedOrder.order_data.cardType}</span>
                    {selectedOrder.order_data.cardType === '立札' ? (
                      <div className="space-y-1.5 text-[11px] md:text-[12px] font-bold">
                        <p className="text-[#999999] font-normal text-[10px]">①内容</p><p>{selectedOrder.order_data.tateInput1}</p>
                        <p className="text-[#999999] font-normal text-[10px] pt-1">②宛名</p><p>{selectedOrder.order_data.tateInput2}</p>
                        <p className="text-[#999999] font-normal text-[10px] pt-1">③贈り主</p><p>{selectedOrder.order_data.tateInput3}</p>
                      </div>
                    ) : <p className="text-[12px] md:text-[13px] whitespace-pre-wrap leading-relaxed font-bold">{selectedOrder.order_data.cardMessage || 'メッセージなし'}</p>}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> 備考・要望</p>
                  <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#EAEAEA] shadow-sm min-h-[100px] md:min-h-[120px]">
                    <p className="text-[12px] md:text-[13px] whitespace-pre-wrap text-[#111111] font-bold leading-relaxed">{selectedOrder.order_data.note || '特になし'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}