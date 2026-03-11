'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { Search, Filter, Printer, MoreVertical, ChevronRight, Clock } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchOrders() {
      try {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error('データ取得エラー:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchOrders();
  }, []);

  // 検索フィルタリング
  const filteredOrders = orders.filter(order => {
    const d = order.order_data;
    const searchStr = (d.customerInfo?.name || '') + (d.recipientInfo?.name || '') + (d.flowerType || '');
    return searchStr.includes(searchTerm);
  });

  if (isLoading) return <div className="p-20 text-center font-bold text-[#2D4B3E] animate-pulse">データを読み込み中...</div>;

  return (
    <main className="pb-32">
      {/* ヘッダー */}
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">受注一覧</h1>
        <div className="flex items-center gap-4">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" size={16} />
             <input 
               type="text" 
               placeholder="注文者、お届け先名で検索..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="h-10 pl-10 pr-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full text-[13px] outline-none focus:border-[#2D4B3E] w-64 transition-all"
             />
           </div>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto w-full p-4 md:p-8">
        {/* ステータスサマリー */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-[#EAEAEA] text-center">
            <p className="text-[10px] font-bold text-[#999999] tracking-widest uppercase mb-1">Total</p>
            <p className="text-[24px] font-bold">{orders.length}</p>
          </div>
          {/* 他のステータスが必要ならここに追加 */}
        </div>

        {/* 注文リスト */}
        <div className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest">注文内容 / お届け日</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest">ご依頼主 / お届け先</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest">合計金額</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest text-center">伝票</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F7F7F7]">
              {filteredOrders.map((order) => {
                const d = order.order_data;
                const isRecipientDifferent = d.isRecipientDifferent;
                const total = (Number(d.itemPrice) || 0) + (Number(d.calculatedFee) || 0) + (Number(d.pickupFee) || 0);
                const tax = Math.floor(total * 0.1);
                
                return (
                  <tr key={order.id} className="hover:bg-[#FBFAF9] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[14px] font-bold text-[#111111]">{d.flowerType}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                          {d.receiveMethod === 'pickup' ? '店頭' : '配達'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-[#f57f17] font-bold">
                        <Clock size={12} />
                        {d.selectedDate} {d.selectedTime}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-[13px] font-bold text-[#111111]">{d.customerInfo?.name} 様</p>
                      {isRecipientDifferent && (
                        <p className="text-[11px] text-[#999999] mt-0.5 flex items-center gap-1">
                          <ChevronRight size={10} /> お届け先: {d.recipientInfo?.name} 様
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-[14px] font-bold text-[#2D4B3E]">¥{(total + tax).toLocaleString()}</p>
                      <p className="text-[10px] text-[#999999]">内税 ¥{tax.toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <Link 
                        href={`/staff/print/${order.id}`}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#EAEAEA] text-[#555555] hover:bg-[#2D4B3E] hover:text-white hover:border-[#2D4B3E] transition-all shadow-sm"
                      >
                        <Printer size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="p-20 text-center text-[#999999] font-bold">
              注文データが見つかりません。
            </div>
          )}
        </div>
      </div>
    </main>
  );
}