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
  // ★ 新機能：表示する期間（1日、3日、7日）
  const [viewRange, setViewRange] = useState(1); 

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

  // ★ 期間内の日付リストを生成する関数
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

  // ★ フィルタリング（自社配達 ＆ 表示期間内の日付のみ抽出）
  const deliveryOrders = orders.filter(order => {
    const d = order?.order_data || {};
    return d.receiveMethod === 'delivery' && datesToShow.includes(d.selectedDate);
  });

  // 日付と時間で並び替え
  deliveryOrders.sort((a, b) => {
    const dateA = a.order_data?.selectedDate || '9999-99-99';
    const dateB = b.order_data?.selectedDate || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    
    const timeA = a.order_data?.selectedTime || '99:99';
    const timeB = b.order_data?.selectedTime || '99:99';
    return timeA.localeCompare(timeB);
  });

  // 日付ごとにグループ化
  const groupedOrders = datesToShow.map(dateStr => {
    return {
      date: dateStr,
      orders: deliveryOrders.filter(o => o.order_data?.selectedDate === dateStr)
    };
  });

  // 日付表示を綺麗にする関数 (例: 3月12日 (木))
  const formatDateWithDay = (dateStr) => {
    const d = new Date(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`;
  };

  const totalOrdersCount = deliveryOrders.length;

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-32">
      {/* --- ヘッダー領域 --- */}
      <div className="bg-white border-b border-[#EAEAEA] sticky top-0 z-30 px-4 md:px-6 py-4 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-[20px] font-black text-[#2D4B3E] tracking-widest flex items-center gap-2 shrink-0">
            <Truck size={22} /> 配達管理
          </h1>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* ★ 新機能：表示期間の切り替えトグル */}
            <div className="flex gap-1 bg-[#F7F7F7] p-1.5 rounded-xl border border-[#EAEAEA] shadow-inner">
              {[{val: 1, label: '1日分'}, {val: 3, label: '3日間'}, {val: 7, label: '1週間'}].map(t => (
                <button 
                  key={t.val} 
                  onClick={() => setViewRange(t.val)} 
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${viewRange === t.val ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}
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

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 pt-8">

        {isLoading ? (
          <div className="text-center py-20 text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>
        ) : totalOrdersCount === 0 ? (
          <div className="text-center py-24 bg-white rounded-[32px] border-2 border-dashed border-[#EAEAEA] text-[#999999] font-bold flex flex-col items-center gap-3 shadow-sm">
            <Truck size={40} className="text-[#EAEAEA]" />
            <p>指定した期間内に、自社配達の予定はありません。</p>
          </div>
        ) : (
          <div className="space-y-12">
            <p className="text-[13px] font-bold text-[#555555] ml-2 border-b border-[#EAEAEA] pb-2">
              期間中の配達合計: <span className="text-[#2D4B3E] font-black text-[18px]">{totalOrdersCount}</span> 件
            </p>
            
            {/* ★ 日付ごとにグループ分けして表示 */}
            {groupedOrders.map(group => {
              if (group.orders.length === 0) return null; // その日に配達がない場合は非表示
              
              return (
                <div key={group.date} className="space-y-4">
                  <div className="flex items-center gap-3 pl-2">
                    <div className="w-1.5 h-6 bg-[#2D4B3E] rounded-full"></div>
                    <h2 className="text-[18px] font-black text-[#2D4B3E] tracking-widest">
                      {formatDateWithDay(group.date)}
                    </h2>
                    <span className="text-[12px] font-bold text-[#999999] bg-[#EAEAEA]/50 px-2 py-0.5 rounded-md">
                      {group.orders.length}件
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {group.orders.map((order, index) => {
                      const d = order?.order_data || {};
                      const targetInfo = d.isRecipientDifferent ? (d.recipientInfo || {}) : (d.customerInfo || {});

                      return (
                        <div 
                          key={order.id} 
                          className="bg-white p-6 md:p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm hover:shadow-md transition-all flex flex-col gap-6 relative overflow-hidden ml-2 md:ml-4"
                        >
                          {/* ナンバリングバッジ (その日の何件目か) */}
                          <div className="absolute top-0 left-0 bg-[#2D4B3E] text-white w-10 h-10 flex items-center justify-center font-black text-[16px] rounded-br-[24px] shadow-sm">
                            {index + 1}
                          </div>

                          {/* カード上部：基本情報とステータス */}
                          <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-[#EAEAEA] pb-5 pl-6 md:pl-8">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-blue-200"><Truck size={14}/> 自社配達</span>
                                <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#D97C8F] bg-[#FBFAF9] border border-[#EAEAEA] px-4 py-1.5 rounded-lg shadow-sm">
                                  <Clock size={16}/> {d.selectedTime || '時間指定なし'}
                                </span>
                              </div>
                              <div className="text-[20px] font-black text-[#111111] pt-1 tracking-wider">
                                {targetInfo?.name || 'お名前未設定'} 様
                              </div>
                              <div className="flex items-center gap-2 text-[14px] font-bold text-[#555555]">
                                <Phone size={16}/> {targetInfo?.phone || '未設定'}
                              </div>
                            </div>

                            {/* ステータス変更 */}
                            <div className="flex flex-col items-start md:items-end gap-2 bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA]">
                              <span className="text-[10px] font-bold text-[#999999] tracking-widest flex items-center gap-1"><ListChecks size={14}/> 配達ステータス</span>
                              <select 
                                value={d.status || 'new'} 
                                onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                className="h-12 bg-white border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold text-[#2D4B3E] outline-none focus:border-[#2D4B3E] shadow-sm cursor-pointer w-full md:w-[200px]"
                              >
                                <option value="new">未対応 (新規)</option>
                                {getCustomLabels().map(l => <option key={l} value={l}>{l}</option>)}
                                <option value="完了">完了</option>
                                <option value="キャンセル">キャンセル</option>
                              </select>
                            </div>
                          </div>

                          {/* カード下部：住所・地図・要望 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* 左：住所とGoogleマップ */}
                            <div className="space-y-4">
                              <span className="text-[12px] font-bold text-[#999999] tracking-widest block border-b border-[#EAEAEA] pb-2">お届け先住所</span>
                              <p className="text-[15px] font-bold leading-relaxed text-[#333333]">
                                〒{targetInfo?.zip}<br/>
                                {targetInfo?.address1} {targetInfo?.address2}
                              </p>
                              <a 
                                href={getGoogleMapsUrl(targetInfo)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 mt-2 text-[12px] font-bold text-[#4285F4] bg-white border-2 border-[#4285F4]/30 px-6 py-2.5 rounded-xl hover:bg-[#4285F4] hover:text-white transition-all shadow-sm active:scale-95 w-full justify-center"
                              >
                                <MapPin size={16} /> この場所をマップで開く
                              </a>
                            </div>

                            {/* 右：商品と特記事項（置き配など） */}
                            <div className="space-y-4">
                              <span className="text-[12px] font-bold text-[#999999] tracking-widest block border-b border-[#EAEAEA] pb-2">商品・特記事項</span>
                              <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] text-[14px] font-bold text-[#2D4B3E] shadow-sm flex items-center gap-2">
                                <Package size={18} className="text-[#999999]"/> {d.flowerType} ({d.flowerPurpose})
                              </div>
                              
                              {(d.absenceAction === '置き配' || d.note || d.pickupFee > 0) && (
                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-200 text-[13px] space-y-3 shadow-sm">
                                  {d.absenceAction === '置き配' && (
                                    <p className="font-bold text-orange-900 flex items-start gap-2">
                                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-orange-600"/>
                                      <span className="leading-relaxed"><span className="text-orange-600 bg-orange-100 px-2 py-0.5 rounded text-[11px] mr-2">置き配</span>{d.absenceNote}</span>
                                    </p>
                                  )}
                                  {d.pickupFee > 0 && (
                                    <p className="font-bold text-orange-900 flex items-start gap-2 pt-2 border-t border-orange-100">
                                      <Truck size={16} className="shrink-0 mt-0.5 text-orange-600"/>
                                      <span className="leading-relaxed text-orange-700">この注文は後日「器の回収」が必要です</span>
                                    </p>
                                  )}
                                  {d.note && (
                                    <p className="font-bold text-orange-900 flex items-start gap-2 pt-2 border-t border-orange-100">
                                      <MessageSquare size={16} className="shrink-0 mt-0.5 text-orange-600"/>
                                      <span className="leading-relaxed"><span className="text-orange-600 mr-2">メモ:</span>{d.note}</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}