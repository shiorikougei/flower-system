'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { 
  Calendar, ShoppingBag, PlusCircle, Settings, 
  Clock, Package, ChevronRight, Truck, Store 
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    todayOrders: 0,
    uncompletedOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // 今日の日付を YYYY-MM-DD 形式で取得
        const todayStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        
        // 注文データを取得（最新順）
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const orders = data || [];

        let todayCount = 0;
        let uncompletedCount = 0;
        const recent = [];

        orders.forEach(order => {
          const d = order.order_data || {};
          
          // 未完了のものをカウント
          if (d.status !== 'completed') {
            uncompletedCount++;
          }

          // 今日の日付で、かつ未完了のものをカウント
          if (d.selectedDate === todayStr && d.status !== 'completed') {
            todayCount++;
          }

          // 最近の注文を5件まで抽出
          if (recent.length < 5) {
            recent.push(order);
          }
        });

        setStats({
          todayOrders: todayCount,
          uncompletedOrders: uncompletedCount,
        });
        setRecentOrders(recent);

      } catch (error) {
        console.error('データ取得エラー:', error.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const getMethodIcon = (method) => {
    if (method === 'pickup') return <Store size={14} className="text-blue-500" />;
    if (method === 'delivery') return <Truck size={14} className="text-[#D97C8F]" />;
    return <Package size={14} className="text-[#2D4B3E]" />;
  };

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '佐川急便' };
    return map[method] || method;
  };

  return (
    <main className="pb-32 font-sans">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">ダッシュボード</h1>
      </header>

      <div className="max-w-[1200px] mx-auto w-full p-4 md:p-8 space-y-10">
        
        {/* ウェルカムメッセージ */}
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
          <h2 className="text-[28px] font-black text-[#111111]">お疲れ様です！</h2>
          <p className="text-[14px] font-bold text-[#999999]">本日の業務状況と最新の注文状況を確認しましょう。</p>
        </div>

        {/* 統計サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-[24px] p-6 border border-[#EAEAEA] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2D4B3E]/5 rounded-bl-[64px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-[#2D4B3E]/10 text-[#2D4B3E] flex items-center justify-center"><Calendar size={20}/></div>
              <span className="text-[12px] font-bold text-[#999999] uppercase tracking-widest">本日 (お届け/受取)</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-[48px] font-black text-[#2D4B3E] leading-none">{isLoading ? '-' : stats.todayOrders}</span>
              <span className="text-[14px] font-bold text-[#999999]">件</span>
            </div>
          </div>
          
          <div className="bg-white rounded-[24px] p-6 border border-[#EAEAEA] shadow-sm flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-[64px] -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Clock size={20}/></div>
              <span className="text-[12px] font-bold text-[#999999] uppercase tracking-widest">未完了の注文総数</span>
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <span className="text-[48px] font-black text-[#111111] leading-none">{isLoading ? '-' : stats.uncompletedOrders}</span>
              <span className="text-[14px] font-bold text-[#999999]">件</span>
            </div>
          </div>
        </div>

        {/* クイックアクション */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <h3 className="text-[14px] font-bold text-[#2D4B3E] border-l-4 border-[#2D4B3E] pl-3">クイックメニュー</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/staff/new-order" className="bg-[#2D4B3E] text-white rounded-[24px] p-6 flex flex-col items-center justify-center gap-4 hover:bg-[#1f352b] hover:shadow-lg transition-all shadow-md group">
              <PlusCircle size={32} className="group-hover:scale-110 transition-transform duration-300"/>
              <span className="text-[13px] font-bold tracking-widest">新規注文</span>
            </Link>
            <Link href="/staff/orders" className="bg-white border border-[#EAEAEA] text-[#555555] rounded-[24px] p-6 flex flex-col items-center justify-center gap-4 hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm group">
              <ShoppingBag size={32} className="group-hover:scale-110 transition-transform duration-300"/>
              <span className="text-[13px] font-bold tracking-widest">受注一覧</span>
            </Link>
            <Link href="/staff/calendar" className="bg-white border border-[#EAEAEA] text-[#555555] rounded-[24px] p-6 flex flex-col items-center justify-center gap-4 hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm group">
              <Calendar size={32} className="group-hover:scale-110 transition-transform duration-300"/>
              <span className="text-[13px] font-bold tracking-widest">カレンダー</span>
            </Link>
            <Link href="/staff/settings" className="bg-white border border-[#EAEAEA] text-[#555555] rounded-[24px] p-6 flex flex-col items-center justify-center gap-4 hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm group">
              <Settings size={32} className="group-hover:scale-110 transition-transform duration-300"/>
              <span className="text-[13px] font-bold tracking-widest">各種設定</span>
            </Link>
          </div>
        </div>

        {/* 最近受付した注文 */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] border-l-4 border-[#2D4B3E] pl-3">最近受付した注文</h3>
            <Link href="/staff/orders" className="text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] flex items-center gap-1 bg-white px-4 py-2 rounded-full border border-[#EAEAEA] shadow-sm transition-colors">すべて見る <ChevronRight size={14}/></Link>
          </div>
          
          <div className="bg-white border border-[#EAEAEA] rounded-[32px] shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-16 text-center text-[#999999] font-bold animate-pulse tracking-widest">読み込み中...</div>
            ) : recentOrders.length === 0 ? (
              <div className="p-16 text-center text-[#999999] font-bold tracking-widest">最近の注文はありません</div>
            ) : (
              <div className="divide-y divide-[#F7F7F7]">
                {recentOrders.map(order => {
                  const d = order.order_data || {};
                  return (
                    <div key={order.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#FBFAF9]/50 transition-colors group">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-[#2D4B3E]/5 text-[#2D4B3E] flex flex-col items-center justify-center border border-[#2D4B3E]/10">
                          <span className="text-[9px] font-bold opacity-60 leading-none mb-1">{d.selectedDate?.split('-')[1] || '--'}月</span>
                          <span className="text-[18px] font-black leading-none">{d.selectedDate?.split('-')[2] || '--'}</span>
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-[#111111]">{d.customerInfo?.name} 様</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="flex items-center gap-1 text-[11px] font-bold text-[#555555] bg-gray-100 px-2 py-0.5 rounded-md">
                              {getMethodIcon(d.receiveMethod)} {getMethodLabel(d.receiveMethod)}
                            </span>
                            <span className="text-[12px] font-bold text-[#999999]">{d.flowerType}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 justify-between md:justify-end">
                        <span className={`px-4 py-1.5 rounded-lg text-[11px] font-bold ${d.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-50 text-orange-600'}`}>
                          {d.status === 'completed' ? '完了済み' : (d.currentStatus || '未対応')}
                        </span>
                        <Link href="/staff/orders" className="w-10 h-10 rounded-full bg-white border border-[#EAEAEA] flex items-center justify-center text-[#999999] group-hover:border-[#2D4B3E] group-hover:text-[#2D4B3E] transition-all shadow-sm">
                          <ChevronRight size={18}/>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}