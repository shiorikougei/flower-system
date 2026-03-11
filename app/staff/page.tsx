'use client';
import { useState, useEffect } from 'react';
import Link from "next/link";
import { supabase } from '@/utils/supabase';
import { 
  Truck, 
  AlertCircle, 
  Building2, 
  UserCheck, 
  FileText, 
  PlusCircle, 
  Calendar, 
  Image as ImageIcon, 
  Settings 
} from "lucide-react";

export default function StaffDashboard() {
  const [todoData, setTodoData] = useState({
    deliveriesToday: 0,
    unpaidOrders: 0,
    corporateEvents: 0,
    pendingDrivers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // ① 注文データを取得
        const { data: ordersData } = await supabase.from('orders').select('order_data');
        const orders = ordersData || [];
        
        // ② 設定（ドライバー情報）を取得
        const { data: settingsData } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        const drivers = settingsData?.settings_data?.drivers || [];
        
        const today = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"})).toISOString().split('T')[0];

        let deliveries = 0;
        let unpaid = 0;
        let corporate = 0;

        orders.forEach(order => {
          const d = order.order_data;
          if (!d) return;

          // 本日お届け
          if (d.selectedDate === today && d.receiveMethod === 'delivery') {
            deliveries++;
          }
          // 未入金
          if (d.paymentMethod === '未定' || d.paymentMethod === '銀行振込(請求書)') {
            unpaid++;
          }
          // 直近の法人イベント（本来は法人名簿DBから取りますが、今回は仮で注文データから）
          if (d.selectedDate >= today) {
            if (d.flowerPurpose === '開店' || d.tateInput3a || (d.customerInfo?.name || '').includes('株式会社')) {
              corporate++;
            }
          }
        });

        // 承認待ちドライバーの数をカウント
        const pendingCount = drivers.filter(d => d.status === 'pending').length;

        setTodoData({
          deliveriesToday: deliveries,
          unpaidOrders: unpaid,
          corporateEvents: corporate,
          pendingDrivers: pendingCount, // ★ DBと連動！
        });

      } catch (err) {
        console.error('ダッシュボードのデータ取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest animate-pulse">データ集計中...</div>;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 bg-[#FBFAF9] min-h-screen font-sans text-[#111111]">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-2xl font-bold text-[#2D4B3E]">ダッシュボード</h1>
        <p className="text-gray-500 mt-1 text-sm tracking-wide">今日のやることと、各機能へのアクセス</p>
      </div>

      <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
          🔥 今日のやることリスト
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <Link href="/staff/deliveries" className="block bg-white p-6 rounded-2xl shadow-sm border border-[#EAEAEA] hover:shadow-md hover:border-[#2D4B3E]/30 transition-all hover:-translate-y-1 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-gray-500 font-bold tracking-widest">本日お届け</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{todoData.deliveriesToday}<span className="text-[12px] font-normal text-gray-400 ml-1">件</span></p>
              </div>
              <div className="bg-blue-50 p-3 rounded-full text-blue-600 group-hover:scale-110 transition-transform">
                <Truck size={24} />
              </div>
            </div>
          </Link>

          <Link href="/staff/orders" className="block bg-white p-6 rounded-2xl shadow-sm border border-[#EAEAEA] hover:shadow-md hover:border-[#2D4B3E]/30 transition-all hover:-translate-y-1 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-gray-500 font-bold tracking-widest">未入金（要確認）</p>
                <p className="text-3xl font-bold text-red-500 mt-2">{todoData.unpaidOrders}<span className="text-[12px] font-normal text-gray-400 ml-1">件</span></p>
              </div>
              <div className="bg-red-50 p-3 rounded-full text-red-500 group-hover:scale-110 transition-transform">
                <AlertCircle size={24} />
              </div>
            </div>
          </Link>

          {/* ★ リンク先を法人ページに変更 */}
          <Link href="/staff/corporate" className="block bg-white p-6 rounded-2xl shadow-sm border border-[#EAEAEA] hover:shadow-md hover:border-[#2D4B3E]/30 transition-all hover:-translate-y-1 group relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#2D4B3E] text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg">TEST</div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-gray-500 font-bold tracking-widest">法人・イベント予約</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{todoData.corporateEvents}<span className="text-[12px] font-normal text-gray-400 ml-1">件</span></p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-full text-emerald-600 group-hover:scale-110 transition-transform">
                <Building2 size={24} />
              </div>
            </div>
          </Link>

          {/* ★ リンクを有効化 */}
          <Link href="/staff/settings/drivers" className="block bg-white p-6 rounded-2xl shadow-sm border border-[#EAEAEA] hover:shadow-md hover:border-[#2D4B3E]/30 transition-all hover:-translate-y-1 group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-gray-500 font-bold tracking-widest">ドライバー承認待ち</p>
                <p className={`text-3xl font-bold mt-2 ${todoData.pendingDrivers > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {todoData.pendingDrivers}<span className="text-[12px] font-normal text-gray-400 ml-1">名</span>
                </p>
              </div>
              <div className={`p-3 rounded-full group-hover:scale-110 transition-transform ${todoData.pendingDrivers > 0 ? 'bg-orange-50 text-orange-500' : 'bg-gray-50 text-gray-400'}`}>
                <UserCheck size={24} />
              </div>
            </div>
          </Link>

        </div>
      </section>

      <hr className="border-[#EAEAEA]" />

      <section className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
        <h2 className="text-lg font-bold text-gray-700 mb-4">メニュー</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Link href="/staff/orders" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-[#EAEAEA] hover:bg-[#2D4B3E]/5 hover:border-[#2D4B3E]/30 transition-all group">
            <FileText size={32} className="text-gray-700 mb-3 group-hover:text-[#2D4B3E] transition-colors" />
            <span className="text-sm font-bold text-gray-700 group-hover:text-[#2D4B3E] transition-colors">注文管理</span>
          </Link>
          <Link href="/staff/new-order" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-[#EAEAEA] hover:bg-[#2D4B3E]/5 hover:border-[#2D4B3E]/30 transition-all group">
            <PlusCircle size={32} className="text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold text-gray-700">店舗注文作成</span>
          </Link>
          <Link href="/staff/calendar" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-[#EAEAEA] hover:bg-[#2D4B3E]/5 hover:border-[#2D4B3E]/30 transition-all group">
            <Calendar size={32} className="text-indigo-500 mb-3 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold text-gray-700">カレンダー</span>
          </Link>
          <Link href="/staff/deliveries" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-[#EAEAEA] hover:bg-[#2D4B3E]/5 hover:border-[#2D4B3E]/30 transition-all group">
            <Truck size={32} className="text-[#f57f17] mb-3 group-hover:translate-x-2 transition-transform" />
            <span className="text-sm font-bold text-gray-700">ルート管理</span>
          </Link>
          <Link href="/staff/corporate" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-[#EAEAEA] hover:bg-[#2D4B3E]/5 hover:border-[#2D4B3E]/30 transition-all group">
            <Building2 size={32} className="text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold text-gray-700">法人管理</span>
          </Link>
          <Link href="/staff/settings" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-[#EAEAEA] hover:bg-[#2D4B3E]/5 hover:border-[#2D4B3E]/30 transition-all group">
            <Settings size={32} className="text-gray-500 mb-3 group-hover:rotate-90 transition-transform duration-500" />
            <span className="text-sm font-bold text-gray-700">設定</span>
          </Link>
        </div>
      </section>
    </div>
  );
}