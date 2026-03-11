'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import Link from 'next/link';
import { MapPin, Truck, CheckCircle, Navigation, Clock, ExternalLink } from 'lucide-react';

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(null);
  
  // 今日の日付を初期値に設定（YYYY-MM-DD）
  const [targetDate, setTargetDate] = useState(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}).split('T')[0]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // 設定を取得（サイドバーのロゴ用など）
        const { data: settingsData } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (settingsData) setAppSettings(settingsData.settings_data);

        // 注文データを取得
        const { data: ordersData, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        
        // 「自社配達」かつ「指定した日付」の注文だけを抽出
        const filteredDeliveries = (ordersData || []).filter(order => {
          const d = order.order_data;
          return d && d.receiveMethod === 'delivery' && d.selectedDate === targetDate;
        });

        // 時間帯順に並び替え（例: 9:00-12:00 が先に来るように）
        filteredDeliveries.sort((a, b) => {
          const timeA = a.order_data.selectedTime || '23:59';
          const timeB = b.order_data.selectedTime || '23:59';
          return timeA.localeCompare(timeB);
        });

        setDeliveries(filteredDeliveries);
      } catch (err) {
        console.error('データ取得エラー:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [targetDate]);

  // ★ 配達完了ステータスの切り替え機能
  const toggleDeliveryStatus = async (order) => {
    const isCompleted = order.order_data.deliveryStatus === 'completed';
    const newStatus = isCompleted ? 'pending' : 'completed';
    
    // 画面の表示を先に更新（サクサク動くように）
    setDeliveries(deliveries.map(d => d.id === order.id ? { ...d, order_data: { ...d.order_data, deliveryStatus: newStatus } } : d));

    try {
      // データベースを更新
      const updatedOrderData = { ...order.order_data, deliveryStatus: newStatus };
      await supabase.from('orders').update({ order_data: updatedOrderData }).eq('id', order.id);
    } catch (error) {
      console.error('ステータス更新エラー:', error);
      alert('ステータスの更新に失敗しました。');
    }
  };

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';

  // 統計の計算
  const totalCount = deliveries.length;
  const completedCount = deliveries.filter(d => d.order_data.deliveryStatus === 'completed').length;
  const pendingCount = totalCount - completedCount;

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* サイドバー */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10 hidden md:block">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {logoUrl ? <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" /> : <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{appName}</span>}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff/orders" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">受注一覧</Link>
          <Link href="/staff/new-order" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">店舗注文受付</Link>
          <Link href="/staff/calendar" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">カレンダー</Link>
          <Link href="/staff/deliveries" className="block px-6 py-4 rounded-xl bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10 text-[13px] font-bold tracking-wider transition-all">配達・ルート管理</Link>
          <Link href="/staff/settings" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all mt-4 border-t border-[#EAEAEA] pt-4">各種設定</Link>
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 flex flex-col min-w-0 pb-32">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2">
            <Truck size={20} /> 配達・ルート管理
          </h1>
          {/* 日付選択 */}
          <input 
            type="date" 
            value={targetDate} 
            onChange={(e) => setTargetDate(e.target.value)}
            className="h-10 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg font-bold text-[14px] text-[#2D4B3E] outline-none focus:border-[#2D4B3E] shadow-sm"
          />
        </header>

        <div className="max-w-[1000px] mx-auto w-full p-4 md:p-8 space-y-6">
          
          {/* 進捗パネル */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#EAEAEA] shadow-sm text-center">
              <p className="text-[11px] font-bold text-[#999999] tracking-widest mb-1">配達予定</p>
              <p className="text-[28px] font-bold text-[#111111]">{totalCount}<span className="text-[12px] font-normal ml-1">件</span></p>
            </div>
            <div className="bg-[#2D4B3E]/5 p-4 rounded-2xl border border-[#2D4B3E]/20 shadow-sm text-center">
              <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest mb-1">配達完了</p>
              <p className="text-[28px] font-bold text-[#2D4B3E]">{completedCount}<span className="text-[12px] font-normal ml-1">件</span></p>
            </div>
            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 shadow-sm text-center">
              <p className="text-[11px] font-bold text-orange-600 tracking-widest mb-1">残り</p>
              <p className="text-[28px] font-bold text-orange-600">{pendingCount}<span className="text-[12px] font-normal ml-1">件</span></p>
            </div>
          </div>

          {/* 配達リスト */}
          {isLoading ? (
            <div className="py-20 text-center text-[#2D4B3E] font-bold animate-pulse">リストを読み込み中...</div>
          ) : deliveries.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-[#EAEAEA] text-[#999999] font-bold">
              指定された日の配達予定はありません。
            </div>
          ) : (
            <div className="space-y-4">
              {deliveries.map((order, index) => {
                const d = order.order_data;
                const isCompleted = d.deliveryStatus === 'completed';
                
                // 住所の組み立て（Googleマップ用）
                const targetInfo = d.isRecipientDifferent ? d.recipientInfo : d.customerInfo;
                const fullAddress = `${targetInfo?.address1 || ''} ${targetInfo?.address2 || ''}`.trim();
                const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

                return (
                  <div key={order.id} className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all duration-500 ${isCompleted ? 'border-green-200 opacity-70' : 'border-[#EAEAEA] hover:shadow-md'}`}>
                    <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-6 items-start sm:items-center relative">
                      
                      {/* 左側：時間とステータス */}
                      <div className="flex sm:flex-col items-center justify-between sm:justify-start w-full sm:w-24 shrink-0 gap-4 sm:gap-2">
                        <div className="flex items-center gap-1 text-[#f57f17] font-bold">
                          <Clock size={16} />
                          <span className="text-[15px]">{d.selectedTime || '指定なし'}</span>
                        </div>
                        <button 
                          onClick={() => toggleDeliveryStatus(order)}
                          className={`flex items-center justify-center gap-1 w-full sm:w-24 py-2 rounded-lg font-bold text-[11px] transition-all ${isCompleted ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-[#EAEAEA] text-[#555555] hover:bg-gray-200'}`}
                        >
                          {isCompleted ? <><CheckCircle size={14} /> 完了</> : '未配達'}
                        </button>
                      </div>

                      {/* 中央：お届け先情報 */}
                      <div className="flex-1 space-y-3 w-full">
                        <div className="flex flex-wrap items-end gap-2">
                          <span className={`text-[16px] font-bold ${isCompleted ? 'text-gray-500 line-through' : 'text-[#111111]'}`}>
                            {targetInfo?.name} 様
                          </span>
                          <span className="text-[11px] text-[#999999] bg-[#FBFAF9] px-2 py-0.5 rounded-md border border-[#EAEAEA]">
                            {d.flowerType}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-[12px] text-[#555555] flex items-start gap-1">
                            <MapPin size={14} className="mt-0.5 shrink-0 text-[#999999]" />
                            <span className="leading-tight">{fullAddress}</span>
                          </p>
                          <p className="text-[12px] text-[#555555] pl-5">📞 {targetInfo?.phone}</p>
                        </div>
                      </div>

                      {/* 右側：ナビ開始ボタン（スマホでタップするとGoogleマップが起動！） */}
                      <div className="w-full sm:w-auto shrink-0 flex sm:flex-col gap-2 mt-2 sm:mt-0">
                        <a 
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 md:py-4 rounded-xl font-bold text-[13px] shadow-sm transition-all active:scale-95 ${isCompleted ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b]'}`}
                        >
                          <Navigation size={16} />
                          ナビ開始
                        </a>
                        <Link 
                          href={`/staff/orders`} // ※後で詳細画面へのリンクに書き換え推奨
                          className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-[#EAEAEA] text-[#555555] font-bold text-[11px] hover:bg-[#FBFAF9] transition-all"
                        >
                          <ExternalLink size={14} /> 詳細
                        </Link>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>

    </div>
  );
}