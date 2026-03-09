'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import Link from 'next/link';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // 設定の取得（アプリ名用）
        const { data: settingsData } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (settingsData) setAppSettings(settingsData.settings_data);

        // 注文データの取得
        const { data: ordersData, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setOrders(ordersData || []);
      } catch (err) {
        console.error('データ取得エラー:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';

  const handlePrint = (orderId) => {
    // 伝票印刷専用ページを新しいタブで開く
    window.open(`/staff/print/${orderId}`, '_blank');
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest animate-pulse">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* サイドバー */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {logoUrl ? <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" /> : <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{appName}</span>}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff/orders" className="block w-full text-left px-6 py-4 rounded-xl bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10 transition-all">
            <span className="text-[13px] font-bold tracking-wider block">受注一覧</span>
          </Link>
          <Link href="/staff/new-order" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all">
            <span className="text-[13px] font-bold tracking-wider block">店舗注文受付</span>
          </Link>
          <Link href="/staff/calendar" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all">
            <span className="text-[13px] font-bold tracking-wider block">カレンダー</span>
          </Link>
          <Link href="/staff/settings" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all mt-4 border-t border-[#EAEAEA] pt-4">
            <span className="text-[13px] font-bold tracking-wider block">各種設定</span>
          </Link>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 md:ml-64 flex flex-col min-w-0 pb-32">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">受注一覧・帳票発行</h1>
        </header>

        <div className="max-w-[1000px] mx-auto w-full p-8">
          <div className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                <tr>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">注文日時</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">お渡し日</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">注文者様</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">商品</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">受取方法</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F7F7]">
                {orders.map((order) => {
                  const d = order.order_data;
                  const date = new Date(order.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={order.id} className="hover:bg-[#FBFAF9] transition-all">
                      <td className="p-4 text-[#555555] font-mono">{date}</td>
                      <td className="p-4 font-bold text-[#2D4B3E]">{d.selectedDate} {d.selectedTime && <span className="text-[10px] text-[#999999] block">{d.selectedTime}</span>}</td>
                      <td className="p-4 font-bold">{d.customerInfo?.name}</td>
                      <td className="p-4">{d.flowerType} <span className="text-[#999999] text-[11px]">/ ¥{Number(d.itemPrice).toLocaleString()}</span></td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-md ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : d.receiveMethod === 'delivery' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                          {d.receiveMethod === 'pickup' ? '店頭受取' : d.receiveMethod === 'delivery' ? '自社配達' : '配送'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {/* ★伝票発行ボタン */}
                        <button 
                          onClick={() => handlePrint(order.id)}
                          className="px-4 py-2 bg-[#2D4B3E] text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-[#1f352b] transition-all"
                        >
                          伝票発行
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr><td colSpan="6" className="p-8 text-center text-[#999999]">注文データがありません。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}