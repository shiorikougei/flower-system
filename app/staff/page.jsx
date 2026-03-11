'use client';
import { useState, useEffect } from 'react';
import Link from "next/link";
import { supabase } from '@/utils/supabase'; 
import { Truck, AlertCircle, Building2, UserCheck, FileText, PlusCircle, Calendar, Image as ImageIcon, Settings, LayoutDashboard } from "lucide-react";

export default function StaffDashboard() {
  const [todoData, setTodoData] = useState({ deliveriesToday: 0, unpaidOrders: 0, corporateEvents: 0, pendingDrivers: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: settingsData } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        const { data: ordersData } = await supabase.from('orders').select('order_data');
        const orders = ordersData || [];
        const drivers = settingsData?.settings_data?.drivers || [];
        const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"})).toISOString().split('T')[0];
        let deliveries = 0; let unpaid = 0; let corporate = 0;

        orders.forEach(order => {
          const d = order.order_data;
          if (!d) return;
          if (d.selectedDate === today && d.receiveMethod === 'delivery') deliveries++;
          if (d.paymentMethod === '未定' || d.paymentMethod === '銀行振込(請求書)') unpaid++;
          if (d.selectedDate >= today && (d.flowerPurpose === '開店' || d.tateInput3a || (d.customerInfo?.name || '').includes('株式会社'))) corporate++;
        });

        setTodoData({ deliveriesToday: deliveries, unpaidOrders: unpaid, corporateEvents: corporate, pendingDrivers: drivers.filter(d => d.status === 'pending').length });
      } catch (err) { console.error(err); } finally { setIsLoading(false); }
    }
    fetchDashboardData();
  }, []);

  if (isLoading) return <div className="p-20 text-center font-bold text-[#2D4B3E] animate-pulse">データ集計中...</div>;

  return (
    <main className="pb-32">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2"><LayoutDashboard size={20} /> ダッシュボード</h1>
      </header>

      <div className="max-w-[1000px] mx-auto w-full p-4 md:p-8 space-y-10">
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-[14px] font-bold text-[#111111] tracking-widest mb-6 border-l-4 border-[#2D4B3E] pl-3">今日のやることリスト</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <DashboardCard href="/staff/deliveries" label="本日お届け" count={todoData.deliveriesToday} unit="件" icon={Truck} color="#2e7d32" bgColor="#f1f8e9" />
            <DashboardCard href="/staff/orders" label="未入金確認" count={todoData.unpaidOrders} unit="件" icon={AlertCircle} color="#c62828" bgColor="#ffebee" isAlert={todoData.unpaidOrders > 0} />
            <DashboardCard href="/staff/corporate" label="法人・イベント予約" count={todoData.corporateEvents} unit="件" icon={Building2} color="#1565c0" bgColor="#e3f2fd" tag="B2B" />
            <DashboardCard href="/staff/settings/drivers" label="ドライバー承認" count={todoData.pendingDrivers} unit="名" icon={UserCheck} color="#f57f17" bgColor="#fff8e1" isAlert={todoData.pendingDrivers > 0} />
          </div>
        </section>

        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <h2 className="text-[14px] font-bold text-[#111111] tracking-widest mb-6 border-l-4 border-[#2D4B3E] pl-3">各種メニュー</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MenuButton href="/staff/orders" label="受注一覧" icon={FileText} />
            <MenuButton href="/staff/new-order" label="注文作成" icon={PlusCircle} />
            <MenuButton href="/staff/calendar" label="カレンダー" icon={Calendar} />
            <MenuButton href="/staff/portfolio" label="SNS・作品" icon={ImageIcon} />
            <MenuButton href="/staff/settings/drivers" label="ドライバー" icon={UserCheck} />
            <MenuButton href="/staff/settings" label="各種設定" icon={Settings} />
          </div>
        </section>
      </div>
    </main>
  );
}

// 内部コンポーネント（カードとボタン）
function DashboardCard({ href, label, count, unit, icon: Icon, color, bgColor, isAlert, tag }) {
  return (
    <Link href={href} className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group flex flex-col justify-between relative overflow-hidden">
      {tag && <div className="absolute top-0 right-0 bg-[#2D4B3E] text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg tracking-widest">{tag}</div>}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold text-[#999999] tracking-widest">{label}</p>
        <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{ backgroundColor: bgColor, color: color }}><Icon size={18} /></div>
      </div>
      <div className="flex items-baseline gap-1">
        <p className={`text-[32px] font-sans font-bold leading-none ${isAlert ? '' : 'text-[#111111]'}`} style={isAlert ? {color: color} : {}}>{count}</p>
        <span className="text-[12px] font-bold text-[#999999]">{unit}</span>
      </div>
    </Link>
  );
}

function MenuButton({ href, label, icon: Icon }) {
  return (
    <Link href={href} className="flex flex-col items-center justify-center p-6 bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group">
      <Icon size={24} className="text-[#555555] mb-3 group-hover:text-[#2D4B3E] transition-colors" />
      <span className="text-[11px] font-bold text-[#555555] tracking-widest group-hover:text-[#2D4B3E] transition-colors">{label}</span>
    </Link>
  );
}