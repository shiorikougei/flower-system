'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { MapPin, Calendar, ChevronRight, ChevronLeft, X, Clock, Truck, Phone, Package, AlertCircle, MessageSquare, ListChecks } from 'lucide-react';

export default function DeliveriesPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(null);
  
  // デフォルトは「今日」の日付
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // データ取得
  useEffect(() => {
    fetchOrders();
    fetchSettings();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      // 最新の注文から取得
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

  // カスタムステータスの取得
  const getCustomLabels = () => {
    const labels = appSettings?.statusConfig?.customLabels;
    return Array.isArray(labels) ? labels : ['制作中', '制作完了', '配達中'];
  };

  // 📍 Googleマップ用URL生成
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

  // ★ フィルタリング（自社配達 ＆ 選択された日付のみ抽出）
  const deliveryOrders = orders.filter(order => {
    const d = order?.order_data || {};
    return d.receiveMethod === 'delivery' && d.selectedDate === selectedDate;
  });

  // 時間帯で並び替え
  deliveryOrders.sort((a, b) => {
    const timeA = a.order_data?.selectedTime || '99:99';
    const timeB = b.order_data?.selectedTime || '99:99';
    return timeA.localeCompare(timeB);
  });

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-32">
      {/* --- ヘッダー領域 --- */}
      <div className="bg-white border-b border-[#EAEAEA] sticky top-0 z-30 px-4 md:px-6 py-4 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-[20px] font-black text-[#2D4B3E] tracking-widest flex items-center gap-2">
            <Truck size={22} /> 配達・ルート管理
          </h1>
          
          <div className="flex items-center justify-between bg-[#F7F7F7] p-1.5 rounded-2xl border border-[#EAEAEA] w-full sm:w-auto shadow-inner">
            <button onClick={() => changeDate(-1)} className="p-2 text-[#999999] hover:text-[#2D4B3E] hover:bg-white rounded-lg transition-all"><ChevronLeft size={20}/></button>
            <div className="flex items-center gap-2 px-4">
              <Calendar size={16} className="text-[#2D4B3E]" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none font-black text-[15px] text-[#2D4B3E] outline-none cursor-pointer tracking-widest"
              />
            </div>
            <button onClick={() => changeDate(1)} className="p-2 text-[#999999] hover:text-[#2D4B3E] hover:bg-white rounded-lg transition-all"><ChevronRight size={20}/></button>
          </div>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 space-y-4 pt-8">
        {isLoading ? (
          <div className="text-center py-20 text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>
        ) : deliveryOrders.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[32px] border-2 border-dashed border-[#EAEAEA] text-[#999999] font-bold flex flex-col items-center gap-3 shadow-sm">
            <Truck size={40} className="text-[#EAEAEA]" />
            <p>この日の自社配達の予定はありません。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {deliveryOrders.map(order => {
              const d = order?.order_data || {};
              const targetInfo = d.isRecipientDifferent ? (d.recipientInfo || {}) : (d.customerInfo || {});

              return (
                <div 
                  key={order.id} 
                  className="bg-white p-6 md:p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm hover:shadow-md transition-all flex flex-col gap-6"
                >
                  {/* カード上部：基本情報とステータス */}
                  <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-[#EAEAEA] pb-5">
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
                        className="inline-flex items-center gap-2 mt-2 text-[13px] font-bold text-white bg-[#4285F4] px-6 py-3 rounded-xl hover:bg-[#3367D6] transition-all shadow-md active:scale-95 w-full justify-center"
                      >
                        <MapPin size={18} /> Googleマップで開く
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
        )}
      </main>
    </div>
  );
}