'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { MapPin, Calendar, ChevronRight, ChevronLeft, Clock, Truck, Phone, Package, AlertCircle, MessageSquare, ListChecks } from 'lucide-react';

export default function DeliveriesPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(null);
  
  // デフォルトは「今日」の日付
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  // 表示する期間（1日、3日、7日）
  const [viewRange, setViewRange] = useState(3); // デフォルトを3日に設定

  // データ取得
  useEffect(() => {
    fetchOrders();
    fetchSettings();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('受注データの取得に失敗しました', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
      if (data) setAppSettings(data.settings_data);
    } catch (error) {
      console.error('設定の取得に失敗しました', error);
    }
  };

  // ステータス更新処理
  const updateOrderStatus = async (id, newStatus) => {
    try {
      const targetOrder = orders.find(o => o.id === id);
      if (!targetOrder) return;
      
      const updatedData = { ...(targetOrder.order_data || {}), status: newStatus };
      
      const { error } = await supabase.from('orders').update({ order_data: updatedData }).eq('id', id);
      if (error) throw error;

      setOrders(orders.map(o => o.id === id ? { ...o, order_data: updatedData } : o));
    } catch (error) {
      alert('ステータスの更新に失敗しました');
    }
  };

  const getCustomLabels = () => {
    const labels = appSettings?.statusConfig?.customLabels;
    return Array.isArray(labels) ? labels : ['制作中', '制作完了', '配達中'];
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

  // 日付の前後移動
  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // 期間内の日付リストを生成する関数
  const getDatesInRange = (startStr, range) => {
    const dates = [];
    const base = new Date(startStr);
    for (let i = 0; i < range; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const datesToShow = getDatesInRange(selectedDate, viewRange);

  // 自社配達のみ抽出
  const deliveryOrders = orders.filter(order => {
    const d = order?.order_data || {};
    return d.receiveMethod === 'delivery' && datesToShow.includes(d.selectedDate);
  });

  // 日付と時間で並び替え
  deliveryOrders.sort((a, b) => {
    const timeA = a.order_data?.selectedTime || '99:99';
    const timeB = b.order_data?.selectedTime || '99:99';
    return timeA.localeCompare(timeB);
  });

  // 日付ごとにグループ化（0件の日もカラムとして残す）
  const groupedOrders = datesToShow.map(dateStr => {
    return {
      date: dateStr,
      orders: deliveryOrders.filter(o => o.order_data?.selectedDate === dateStr)
    };
  });

  // 日付表示を綺麗にする関数
  const formatDateWithDay = (dateStr) => {
    const d = new Date(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#FBFAF9] font-sans overflow-hidden">
      {/* --- ヘッダー領域 --- */}
      <div className="bg-white border-b border-[#EAEAEA] shrink-0 px-4 md:px-6 py-4 shadow-sm z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-[20px] font-black text-[#2D4B3E] tracking-widest flex items-center gap-2 shrink-0">
            <Truck size={22} /> 配達管理
          </h1>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* 表示期間の切り替えトグル */}
            <div className="flex gap-1 bg-[#F7F7F7] p-1.5 rounded-xl border border-[#EAEAEA] shadow-inner">
              {[{val: 1, label: '1日'}, {val: 3, label: '3日間'}, {val: 7, label: '1週間'}].map(t => (
                <button 
                  key={t.val} 
                  onClick={() => setViewRange(t.val)} 
                  className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all ${viewRange === t.val ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 日付操作 */}
            <div className="flex items-center justify-between bg-[#F7F7F7] p-1.5 rounded-xl border border-[#EAEAEA] shadow-inner">
              <button onClick={() => changeDate(-1)} className="p-2 text-[#999999] hover:text-[#2D4B3E] hover:bg-white rounded-lg transition-all"><ChevronLeft size={20}/></button>
              <div className="flex items-center gap-2 px-3">
                <Calendar size={16} className="text-[#2D4B3E]" />
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none font-black text-[14px] text-[#2D4B3E] outline-none cursor-pointer tracking-wider"
                />
              </div>
              <button onClick={() => changeDate(1)} className="p-2 text-[#999999] hover:text-[#2D4B3E] hover:bg-white rounded-lg transition-all"><ChevronRight size={20}/></button>
            </div>
          </div>
        </div>
      </div>

      {/* --- メインコンテンツ (横スクロール対応) --- */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden bg-[#EAEAEA]/30 hide-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>
        ) : (
          <div className="flex gap-4 p-4 md:p-6 h-full items-start w-max">
            
            {/* 各日付ごとのカラム（列） */}
            {groupedOrders.map(group => (
              <div 
                key={group.date} 
                className="w-[85vw] sm:w-[380px] shrink-0 flex flex-col bg-[#F7F7F7] rounded-[32px] border border-[#EAEAEA] shadow-sm max-h-full"
              >
                {/* カラムヘッダー */}
                <div className="p-5 border-b border-[#EAEAEA] flex items-center justify-between bg-white rounded-t-[32px] shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${group.date === new Date().toISOString().split('T')[0] ? 'bg-red-500 animate-pulse' : 'bg-[#2D4B3E]'}`}></div>
                    <h2 className="text-[16px] font-black text-[#2D4B3E] tracking-widest">
                      {formatDateWithDay(group.date)}
                    </h2>
                  </div>
                  <span className="text-[12px] font-bold text-[#999999] bg-[#FBFAF9] border border-[#EAEAEA] px-3 py-1 rounded-lg">
                    {group.orders.length} 件
                  </span>
                </div>

                {/* カラム内のカードリスト（縦スクロール） */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4 hide-scrollbar">
                  {group.orders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#999999] py-10 opacity-60">
                      <Truck size={32} className="mb-2" />
                      <p className="text-[12px] font-bold">配達予定はありません</p>
                    </div>
                  ) : (
                    group.orders.map((order, index) => {
                      const d = order?.order_data || {};
                      const targetInfo = d.isRecipientDifferent ? (d.recipientInfo || {}) : (d.customerInfo || {});

                      return (
                        <div 
                          key={order.id} 
                          className="bg-white p-5 rounded-[24px] border border-[#EAEAEA] shadow-sm hover:border-[#2D4B3E]/30 transition-all flex flex-col gap-4 relative overflow-hidden"
                        >
                          {/* ナンバリング */}
                          <div className="absolute top-0 left-0 bg-[#2D4B3E] text-white w-8 h-8 flex items-center justify-center font-black text-[13px] rounded-br-[16px] shadow-sm z-10">
                            {index + 1}
                          </div>

                          {/* 名前・時間 */}
                          <div className="pl-6 space-y-1.5">
                             <div className="flex items-center gap-2">
                               <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold"><Truck size={12}/> 自社配達</span>
                               <span className="flex items-center gap-1 text-[12px] font-bold text-[#D97C8F]">
                                 <Clock size={14}/> {d.selectedTime || '指定なし'}
                               </span>
                             </div>
                             <div className="text-[18px] font-black text-[#111111]">{targetInfo?.name || '未設定'} 様</div>
                             <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#555555]">
                               <Phone size={14}/> {targetInfo?.phone || '未設定'}
                             </div>
                          </div>

                          {/* 住所とGoogleマップ */}
                          <div className="bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA] space-y-2">
                            <p className="text-[13px] font-bold leading-relaxed text-[#333333]">
                              〒{targetInfo?.zip}<br/>
                              {targetInfo?.address1} {targetInfo?.address2}
                            </p>
                            <a 
                              href={getGoogleMapsUrl(targetInfo)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1.5 mt-1 text-[12px] font-bold text-[#4285F4] bg-white border border-[#4285F4]/30 px-4 py-2.5 rounded-lg hover:bg-[#4285F4] hover:text-white transition-all shadow-sm active:scale-95"
                            >
                              <MapPin size={16} /> マップで開く
                            </a>
                          </div>

                          {/* 商品と特記事項 */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[12px] font-bold text-[#2D4B3E] px-1">
                              <Package size={14}/> {d.flowerType} <span className="text-[#999999]">({d.flowerPurpose})</span>
                            </div>
                            
                            {(d.absenceAction === '置き配' || d.note || d.pickupFee > 0) && (
                              <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 text-[11px] space-y-2 shadow-sm">
                                {d.absenceAction === '置き配' && (
                                  <p className="font-bold text-orange-900 flex items-start gap-1.5">
                                    <span className="shrink-0 text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-[10px]">置き配</span>
                                    <span className="leading-relaxed">{d.absenceNote}</span>
                                  </p>
                                )}
                                {d.pickupFee > 0 && (
                                  <p className="font-bold text-orange-900 flex items-center gap-1.5 pt-1">
                                    <Truck size={14} className="text-orange-600"/> 後日、器の回収が必要です
                                  </p>
                                )}
                                {d.note && (
                                  <p className="font-bold text-orange-900 flex items-start gap-1.5 pt-1">
                                    <MessageSquare size={14} className="shrink-0 text-orange-600"/>
                                    <span className="leading-relaxed">{d.note}</span>
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ステータス */}
                          <div className="pt-3 border-t border-[#EAEAEA]">
                            <select 
                              value={d.status || 'new'} 
                              onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                              className="w-full h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg px-3 text-[12px] font-bold text-[#2D4B3E] outline-none cursor-pointer focus:border-[#2D4B3E]"
                            >
                              <option value="new">未対応 (新規)</option>
                              {getCustomLabels().map(l => <option key={l} value={l}>{l}</option>)}
                              <option value="完了">完了</option>
                              <option value="キャンセル">キャンセル</option>
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); 
        .font-serif { font-family: 'Noto Serif JP', serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}