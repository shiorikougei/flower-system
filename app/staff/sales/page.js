'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  TrendingUp, Calendar, DollarSign, ShoppingBag, 
  CreditCard, BarChart3, AlertCircle, RefreshCw
} from 'lucide-react';

export default function SalesPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
      console.error('取得エラー:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ★ 注文データから月別の売上を自動集計
  const monthlySales = useMemo(() => {
    const map = {};

    orders.forEach(order => {
      const d = order.order_data || {};
      // キャンセルされた注文は売上から除外
      if (d.status === 'キャンセル') return;

      // 日付から「YYYY-MM」のキーを作成
      const date = new Date(order.created_at);
      const yearMonth = `${date.getFullYear()}年 ${String(date.getMonth() + 1).padStart(2, '0')}月`;

      // 金額計算
      const itemPrice = Number(d.itemPrice) || 0;
      const fee = Number(d.calculatedFee) || 0;
      const pickup = Number(d.pickupFee) || 0;
      const subTotal = itemPrice + fee + pickup;
      const tax = Math.floor(subTotal * 0.1);
      const total = subTotal + tax;

      if (!map[yearMonth]) {
        map[yearMonth] = {
          month: yearMonth,
          rawDate: date, // 並び替え用
          totalSales: 0,
          orderCount: 0,
          itemSales: 0,
          shippingFees: 0,
          unpaidCount: 0, // 未入金の件数
        };
      }

      map[yearMonth].totalSales += total;
      map[yearMonth].itemSales += itemPrice;
      map[yearMonth].shippingFees += (fee + pickup);
      map[yearMonth].orderCount += 1;

      // 未入金（支払いが完了していない）の判定
      if (!d.paymentStatus || d.paymentStatus.includes('未') || d.paymentStatus === '') {
        map[yearMonth].unpaidCount += 1;
      }
    });

    // 最新の月が一番上に来るように並び替え
    return Object.values(map).sort((a, b) => b.rawDate - a.rawDate);
  }, [orders]);

  // 全期間の合計
  const totalAllTime = monthlySales.reduce((sum, month) => sum + month.totalSales, 0);
  const totalOrdersAllTime = monthlySales.reduce((sum, month) => sum + month.orderCount, 0);

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 py-4 sticky top-0 z-10">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-black text-[#2D4B3E] tracking-tight">売上ダッシュボード</h1>
          <p className="text-[11px] font-bold text-[#999] mt-1 tracking-widest">月ごとの売上・受注件数の自動集計</p>
        </div>
        <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] transition-all shadow-sm">
          <RefreshCw size={14} /> 更新
        </button>
      </header>

      <div className="p-4 md:p-8 max-w-[1000px] mx-auto space-y-8">
        
        {/* 上部：全期間サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#2D4B3E] text-white p-6 rounded-[24px] shadow-md relative overflow-hidden">
            <TrendingUp size={100} className="absolute -right-4 -bottom-4 text-white/10" />
            <h3 className="text-[12px] font-bold text-white/80 tracking-widest mb-2 flex items-center gap-2"><DollarSign size={16}/> 全期間 累計売上</h3>
            <p className="text-[32px] font-black tracking-tight">¥{totalAllTime.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <h3 className="text-[12px] font-bold text-[#999] tracking-widest mb-1 flex items-center gap-2"><ShoppingBag size={14}/> 累計受注件数</h3>
            <p className="text-[24px] font-black text-[#2D4B3E]">{totalOrdersAllTime} <span className="text-[12px] font-bold text-[#999]">件</span></p>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <h3 className="text-[12px] font-bold text-[#999] tracking-widest mb-1 flex items-center gap-2"><BarChart3 size={14}/> 平均客単価</h3>
            <p className="text-[24px] font-black text-[#2D4B3E]">
              ¥{totalOrdersAllTime > 0 ? Math.floor(totalAllTime / totalOrdersAllTime).toLocaleString() : 0}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 text-center text-[#999] font-bold animate-pulse tracking-widest">売上データを計算中...</div>
        ) : monthlySales.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-[#CCC] p-20 text-center shadow-sm">
            <p className="text-[14px] font-bold text-[#999]">売上データがありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-[16px] font-black text-[#2D4B3E] flex items-center gap-2 border-b border-[#EAEAEA] pb-2">
              <Calendar size={18} /> 月別売上一覧
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {monthlySales.map((month, index) => (
                <div key={month.month} className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden flex flex-col md:flex-row">
                  
                  {/* 左側：月のタイトルとメイン売上 */}
                  <div className={`p-6 md:w-1/3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#EAEAEA] ${index === 0 ? 'bg-[#FBFAF9]' : ''}`}>
                    <span className="text-[14px] font-black text-[#555] tracking-widest mb-2">{month.month}</span>
                    <span className="text-[28px] font-black text-[#2D4B3E] leading-none mb-1">¥{month.totalSales.toLocaleString()}</span>
                    <span className="text-[11px] font-bold text-[#999]">受注件数: {month.orderCount}件</span>
                  </div>

                  {/* 右側：内訳詳細 */}
                  <div className="p-6 md:w-2/3 grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-[#999] tracking-widest mb-1">商品代（税抜）</p>
                      <p className="text-[16px] font-black text-[#444]">¥{month.itemSales.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#999] tracking-widest mb-1">送料・手数料（税抜）</p>
                      <p className="text-[16px] font-black text-[#444]">¥{month.shippingFees.toLocaleString()}</p>
                    </div>
                    
                    <div className="col-span-2 pt-4 border-t border-[#F7F7F7] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[#999] tracking-widest">月間客単価:</span>
                        <span className="text-[14px] font-black text-[#2D4B3E]">¥{Math.floor(month.totalSales / month.orderCount).toLocaleString()}</span>
                      </div>
                      
                      {/* 未入金アラート（未入金がある月だけ赤く表示） */}
                      {month.unpaidCount > 0 ? (
                        <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100">
                          <AlertCircle size={14} />
                          <span className="text-[11px] font-bold">未入金あり: {month.unpaidCount}件</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <span className="text-[11px] font-bold">未入金なし</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}