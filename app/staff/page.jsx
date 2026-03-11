'use client';
import { useState, useEffect } from 'react';
import Link from "next/link";
import { supabase } from '../../utils/supabase'; 
import { 
  Truck, 
  AlertCircle, 
  Building2, 
  UserCheck, 
  FileText, 
  PlusCircle, 
  Calendar, 
  Image as ImageIcon, 
  Settings,
  LayoutDashboard
} from "lucide-react";

export default function StaffDashboard() {
  const [todoData, setTodoData] = useState({
    deliveriesToday: 0,
    unpaidOrders: 0,
    corporateEvents: 0,
    pendingDrivers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // ① 設定（ロゴやドライバー情報）を取得
        const { data: settingsData } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (settingsData) setAppSettings(settingsData.settings_data);

        // ② 注文データを取得
        const { data: ordersData } = await supabase.from('orders').select('order_data');
        const orders = ordersData || [];
        
        const drivers = settingsData?.settings_data?.drivers || [];
        
        const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"})).toISOString().split('T')[0];

        let deliveries = 0;
        let unpaid = 0;
        let corporate = 0;

        orders.forEach(order => {
          const d = order.order_data;
          if (!d) return;

          // 本日お届け
          if (d.selectedDate === today && d.receiveMethod === 'delivery') deliveries++;
          // 未入金
          if (d.paymentMethod === '未定' || d.paymentMethod === '銀行振込(請求書)') unpaid++;
          // 法人イベント
          if (d.selectedDate >= today) {
            if (d.flowerPurpose === '開店' || d.tateInput3a || (d.customerInfo?.name || '').includes('株式会社')) corporate++;
          }
        });

        const pendingCount = drivers.filter(d => d.status === 'pending').length;

        setTodoData({
          deliveriesToday: deliveries,
          unpaidOrders: unpaid,
          corporateEvents: corporate,
          pendingDrivers: pendingCount,
        });

      } catch (err) {
        console.error('ダッシュボードのデータ取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest animate-pulse">データ集計中...</div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* サイドバー（他画面と完全同期） */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10 hidden md:block">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {logoUrl ? <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" /> : <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{appName}</span>}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff" className="block px-6 py-4 rounded-xl bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10 text-[13px] font-bold tracking-wider transition-all">🏠 ダッシュボード</Link>
          <Link href="/staff/orders" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">受注一覧</Link>
          <Link href="/staff/new-order" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">店舗注文受付</Link>
          <Link href="/staff/deliveries" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">配達・ルート管理</Link>
          <Link href="/staff/corporate" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">法人・イベント管理</Link>
          <Link href="/staff/portfolio" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">作品・SNS連携</Link>
          <Link href="/staff/settings" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all mt-4 border-t border-[#EAEAEA] pt-4">各種設定</Link>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 md:ml-64 flex flex-col min-w-0 pb-32">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2">
            <LayoutDashboard size={20} /> ダッシュボード
          </h1>
        </header>

        <div className="max-w-[1000px] mx-auto w-full p-4 md:p-8 space-y-10">
          
          {/* やることリスト */}
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-[14px] font-bold text-[#111111] tracking-widest mb-6 border-l-4 border-[#2D4B3E] pl-3">今日のやることリスト</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              
              <Link href="/staff/deliveries" className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold text-[#999999] tracking-widest">本日お届け</p>
                  <div className="w-10 h-10 rounded-full bg-[#f1f8e9] text-[#2e7d32] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Truck size={18} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-[32px] font-sans font-bold text-[#111111] leading-none">{todoData.deliveriesToday}</p>
                  <span className="text-[12px] font-bold text-[#999999]">件</span>
                </div>
              </Link>

              <Link href="/staff/orders" className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold text-[#999999] tracking-widest">未入金確認</p>
                  <div className="w-10 h-10 rounded-full bg-[#ffebee] text-[#c62828] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <AlertCircle size={18} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className={`text-[32px] font-sans font-bold leading-none ${todoData.unpaidOrders > 0 ? 'text-[#c62828]' : 'text-[#111111]'}`}>{todoData.unpaidOrders}</p>
                  <span className="text-[12px] font-bold text-[#999999]">件</span>
                </div>
              </Link>

              <Link href="/staff/corporate" className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#2D4B3E] text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg tracking-widest">B2B</div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold text-[#999999] tracking-widest">法人・イベント予約</p>
                  <div className="w-10 h-10 rounded-full bg-[#e3f2fd] text-[#1565c0] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Building2 size={18} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-[32px] font-sans font-bold text-[#111111] leading-none">{todoData.corporateEvents}</p>
                  <span className="text-[12px] font-bold text-[#999999]">件</span>
                </div>
              </Link>

              <Link href="/staff/settings/drivers" className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-bold text-[#999999] tracking-widest">ドライバー承認</p>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${todoData.pendingDrivers > 0 ? 'bg-[#fff8e1] text-[#f57f17]' : 'bg-gray-50 text-[#999999]'}`}>
                    <UserCheck size={18} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className={`text-[32px] font-sans font-bold leading-none ${todoData.pendingDrivers > 0 ? 'text-[#f57f17]' : 'text-[#111111]'}`}>{todoData.pendingDrivers}</p>
                  <span className="text-[12px] font-bold text-[#999999]">名</span>
                </div>
              </Link>

            </div>
          </section>

          {/* クイックメニュー */}
          <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <h2 className="text-[14px] font-bold text-[#111111] tracking-widest mb-6 border-l-4 border-[#2D4B3E] pl-3">各種メニュー</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              
              <Link href="/staff/orders" className="flex flex-col items-center justify-center p-6 bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group">
                <FileText size={24} className="text-[#555555] mb-3 group-hover:text-[#2D4B3E] transition-colors" />
                <span className="text-[11px] font-bold text-[#555555] tracking-widest group-hover:text-[#2D4B3E] transition-colors">受注一覧</span>
              </Link>
              
              <Link href="/staff/new-order" className="flex flex-col items-center justify-center p-6 bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group">
                <PlusCircle size={24} className="text-[#555555] mb-3 group-hover:text-[#2D4B3E] transition-colors" />
                <span className="text-[11px] font-bold text-[#555555] tracking-widest group-hover:text-[#2D4B3E] transition-colors">注文作成</span>
              </Link>

              <Link href="/staff/calendar" className="flex flex-col items-center justify-center p-6 bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group">
                <Calendar size={24} className="text-[#555555] mb-3 group-hover:text-[#2D4B3E] transition-colors" />
                <span className="text-[11px] font-bold text-[#555555] tracking-widest group-hover:text-[#2D4B3E] transition-colors">カレンダー</span>
              </Link>

              <Link href="/staff/portfolio" className="flex flex-col items-center justify-center p-6 bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group">
                <ImageIcon size={24} className="text-[#555555] mb-3 group-hover:text-[#2D4B3E] transition-colors" />
                <span className="text-[11px] font-bold text-[#555555] tracking-widest group-hover:text-[#2D4B3E] transition-colors">SNS・作品</span>
              </Link>

              <Link href="/staff/settings/drivers" className="flex flex-col items-center justify-center p-6 bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group">
                <UserCheck size={24} className="text-[#555555] mb-3 group-hover:text-[#2D4B3E] transition-colors" />
                <span className="text-[11px] font-bold text-[#555555] tracking-widest group-hover:text-[#2D4B3E] transition-colors">ドライバー</span>
              </Link>

              <Link href="/staff/settings" className="flex flex-col items-center justify-center p-6 bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group">
                <Settings size={24} className="text-[#555555] mb-3 group-hover:rotate-90 transition-transform duration-500" />
                <span className="text-[11px] font-bold text-[#555555] tracking-widest group-hover:text-[#2D4B3E] transition-colors">各種設定</span>
              </Link>

            </div>
          </section>

        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); 
        .font-serif { font-family: 'Noto Serif JP', serif; }
      `}</style>
    </div>
  );
}