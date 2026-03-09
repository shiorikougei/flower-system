'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../utils/supabase';
import Link from 'next/link';

export default function CalendarPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('注文の取得に失敗しました:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  // 日付ごとに注文をグループ化
  const ordersByDate = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const dateStr = order.order_data.selectedDate; // "YYYY-MM-DD"
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
    if (method === 'pickup') return '店頭受取';
    if (method === 'delivery') return '自社配達';
    if (method === 'sagawa') return '佐川急便';
    return method;
  };

  const renderDay = (day, index) => {
    if (!day) return <div key={`empty-${index}`} className="min-h-[120px] bg-[#FBFAF9] border-r border-b border-[#EAEAEA]"></div>;

    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOrders = ordersByDate[dateStr] || [];
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    return (
      <div key={day} className={`min-h-[120px] p-2 border-r border-b border-[#EAEAEA] bg-white transition-all ${isToday ? 'bg-[#2D4B3E]/5' : ''}`}>
        <div className={`text-[11px] font-bold mb-2 flex items-center justify-center w-6 h-6 rounded-full mx-auto ${isToday ? 'bg-[#2D4B3E] text-white' : 'text-[#555555]'}`}>{day}</div>
        <div className="space-y-1">
          {dayOrders.map(order => {
             const d = order.order_data;
             // 受取方法で色分け
             let badgeColor = 'bg-gray-100 text-gray-700 hover:border-gray-400'; 
             if(d.receiveMethod === 'delivery') badgeColor = 'bg-[#D97C8F]/10 text-[#D97C8F] hover:border-[#D97C8F]';
             if(d.receiveMethod === 'sagawa') badgeColor = 'bg-blue-50 text-blue-600 hover:border-blue-400';
             
             return (
               <div key={order.id} onClick={() => setSelectedOrder(order)} className={`text-[10px] p-1.5 rounded cursor-pointer truncate transition-all border border-transparent ${badgeColor}`}>
                 <span className="font-bold">{d.selectedTime?.split('-')[0] || ''}</span> {d.customerInfo?.name}
               </div>
             )
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      {/* サイドバー */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">NocoLde</span>
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#999999] pt-1">Workspace</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff/orders" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all">
            <span className="text-[13px] font-bold tracking-wider block">Order List</span>
            <span className="text-[10px] text-[#999999]">受注一覧</span>
          </Link>
          <Link href="/staff/calendar" className="block w-full text-left px-6 py-4 rounded-xl bg-[#2D4B3E] text-white shadow-md transition-all">
            <span className="text-[13px] font-bold tracking-wider block">Calendar</span>
            <span className="text-[10px] text-white/70">カレンダー</span>
          </Link>
          <Link href="/staff/settings" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all">
            <span className="text-[13px] font-bold tracking-wider block">Settings</span>
            <span className="text-[10px] text-[#999999]">店舗・システム設定</span>
          </Link>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 md:ml-64 flex flex-col min-w-0">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">納品カレンダー</h1>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-[#EAEAEA] p-1 shadow-sm">
              <button onClick={prevMonth} className="px-3 py-1 font-bold text-[#555555] hover:bg-[#F7F7F7] rounded">◀</button>
              <span className="px-4 font-bold text-[14px]">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</span>
              <button onClick={nextMonth} className="px-3 py-1 font-bold text-[#555555] hover:bg-[#F7F7F7] rounded">▶</button>
            </div>
          </div>
          <button onClick={fetchOrders} className="px-4 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[11px] font-bold text-[#555555] hover:bg-white transition-all shadow-sm">🔄 更新</button>
        </header>

        <div className="p-8">
          {isLoading ? (
            <div className="text-center py-20 text-[#999999] font-bold animate-pulse tracking-widest">LOADING CALENDAR...</div>
          ) : (
            <div className="bg-white rounded-[32px] border border-[#EAEAEA] shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 border-b border-[#EAEAEA] bg-[#FBFAF9]">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                   <div key={d} className="p-3 text-center text-[10px] font-bold text-[#999999] uppercase tracking-widest border-r border-[#EAEAEA] last:border-0">{d}</div>
                 ))}
              </div>
              <div className="grid grid-cols-7">
                 {calendarDays.map((day, i) => renderDay(day, i))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 詳細モーダル (OrdersPageと同じ) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-10">
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] p-6 flex items-center justify-between z-10">
              <div><h2 className="text-[18px] font-bold text-[#2D4B3E]">注文詳細</h2><p className="text-[11px] text-[#999999] font-mono mt-1">ID: {selectedOrder.id}</p></div>
              <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 bg-[#FBFAF9] rounded-full flex items-center justify-center text-[#555555] font-bold hover:bg-[#EAEAEA] transition-all">✕</button>
            </div>
            <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest border-b border-[#EAEAEA] pb-2">お届け・受取情報</h3>
                  <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA] space-y-3">
                    <div><span className="text-[10px] text-[#999999] block">希望日時</span><span className="text-[15px] font-bold text-[#D97C8F]">{selectedOrder.order_data.selectedDate} {selectedOrder.order_data.selectedTime}</span></div>
                    <div><span className="text-[10px] text-[#999999] block">受取方法</span><span className="text-[14px] font-bold text-[#111111]">{getMethodLabel(selectedOrder.order_data.receiveMethod)} {selectedOrder.order_data.receiveMethod === 'pickup' && `(${selectedOrder.order_data.selectedShop})`}</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest border-b border-[#EAEAEA] pb-2">ご注文者様</h3>
                  <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA] space-y-2 text-[13px] text-[#111111]">
                    <p className="font-bold text-[15px]">{selectedOrder.order_data.customerInfo?.name}</p><p>{selectedOrder.order_data.customerInfo?.phone}</p>
                    {selectedOrder.order_data.receiveMethod !== 'pickup' && (<p className="text-[12px] text-[#555555]">〒{selectedOrder.order_data.customerInfo?.zip}<br/>{selectedOrder.order_data.customerInfo?.address1}{selectedOrder.order_data.customerInfo?.address2}</p>)}
                  </div>
                </div>
              </div>
              {selectedOrder.order_data.isRecipientDifferent && (
                <div className="space-y-4 animate-in fade-in">
                  <h3 className="text-[11px] font-bold text-[#D97C8F] uppercase tracking-widest border-b border-red-100 pb-2">お届け先様（注文者と異なる）</h3>
                  <div className="bg-red-50 p-5 rounded-2xl border border-red-100 space-y-2 text-[13px] text-[#111111]">
                    <p className="font-bold text-[15px]">{selectedOrder.order_data.recipientInfo?.name} 様</p><p>{selectedOrder.order_data.recipientInfo?.phone}</p><p className="text-[12px] text-[#555555]">〒{selectedOrder.order_data.recipientInfo?.zip}<br/>{selectedOrder.order_data.recipientInfo?.address1}{selectedOrder.order_data.recipientInfo?.address2}</p>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest border-b border-[#EAEAEA] pb-2">商品詳細</h3>
                <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div><span className="text-[10px] text-[#999999] block">種類</span><span className="text-[14px] font-bold">{selectedOrder.order_data.flowerType} {selectedOrder.order_data.isBring === 'bring' && <span className="text-orange-500 text-[10px]">(持込)</span>}</span></div>
                    <div><span className="text-[10px] text-[#999999] block">用途</span><span className="text-[14px] font-bold">{selectedOrder.order_data.flowerPurpose} {selectedOrder.order_data.otherPurpose && `(${selectedOrder.order_data.otherPurpose})`}</span></div>
                    <div><span className="text-[10px] text-[#999999] block">カラー</span><span className="text-[14px] font-bold">{selectedOrder.order_data.flowerColor} {selectedOrder.order_data.otherColor && `(${selectedOrder.order_data.otherColor})`}</span></div>
                    <div><span className="text-[10px] text-[#999999] block">イメージ</span><span className="text-[14px] font-bold">{selectedOrder.order_data.flowerVibe} {selectedOrder.order_data.otherVibe && `(${selectedOrder.order_data.otherVibe})`}</span></div>
                  </div>
                  <div className="border-t border-[#FBFAF9] pt-4 space-y-2">
                    <div className="flex justify-between text-[13px]"><span className="text-[#555555]">商品代金 (税抜)</span><span className="font-bold">¥{Number(selectedOrder.order_data.itemPrice).toLocaleString()}</span></div>
                    {selectedOrder.order_data.calculatedFee !== null && (<div className="flex justify-between text-[13px]"><span className="text-[#555555]">配送料・箱代</span><span className="font-bold">¥{Number(selectedOrder.order_data.calculatedFee).toLocaleString()}</span></div>)}
                    <div className="flex justify-between text-[16px] mt-2 pt-2 border-t border-[#FBFAF9]"><span className="font-bold text-[#2D4B3E]">合計金額 (目安)</span><span className="font-bold text-[#2D4B3E]">¥{(Number(selectedOrder.order_data.itemPrice) + Number(selectedOrder.order_data.calculatedFee || 0)).toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest border-b border-[#EAEAEA] pb-2">カード・立札</h3>
                  <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                    <span className="inline-block px-3 py-1 bg-[#2D4B3E] text-white text-[10px] font-bold rounded-md mb-3">{selectedOrder.order_data.cardType}</span>
                    {selectedOrder.order_data.cardType === 'メッセージカード' && (<p className="text-[13px] whitespace-pre-wrap">{selectedOrder.order_data.cardMessage}</p>)}
                    {selectedOrder.order_data.cardType === '立札' && (
                      <div className="space-y-2 text-[12px]"><p><span className="text-[#999999] mr-2">パターン:</span>{selectedOrder.order_data.tatePattern}</p><p><span className="text-[#999999] mr-2">①内容:</span>{selectedOrder.order_data.tateInput1}</p><p><span className="text-[#999999] mr-2">②宛名:</span>{selectedOrder.order_data.tateInput2}</p><p><span className="text-[#999999] mr-2">③贈り主:</span>{selectedOrder.order_data.tateInput3}</p>{(selectedOrder.order_data.tateInput3a || selectedOrder.order_data.tateInput3b) && (<p><span className="text-[#999999] mr-2">③会社名等:</span>{selectedOrder.order_data.tateInput3a} {selectedOrder.order_data.tateInput3b}</p>)}</div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest border-b border-[#EAEAEA] pb-2">備考・要望</h3>
                  <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA] min-h-[100px]"><p className="text-[13px] whitespace-pre-wrap text-[#111111]">{selectedOrder.order_data.note || '特になし'}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; }`}</style>
    </div>
  );
}