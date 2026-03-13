'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { Search, ChevronRight, Package, Truck, Store, Calendar, Filter } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMethodInfo = (method) => {
    if (method === 'pickup') return { icon: Store, label: '店頭受取', color: 'text-orange-600 bg-orange-100' };
    if (method === 'delivery') return { icon: Truck, label: '自社配達', color: 'text-blue-600 bg-blue-100' };
    return { icon: Package, label: '業者配送', color: 'text-green-600 bg-green-100' };
  };

  const filteredOrders = orders.filter(order => {
    const d = order.order_data || {};
    const matchSearch = (d.customerInfo?.name || '').includes(searchTerm) || (d.customerInfo?.phone || '').includes(searchTerm) || (order.id || '').toString().includes(searchTerm);
    
    if (statusFilter === 'all') return matchSearch;
    if (statusFilter === 'uncompleted') return matchSearch && d.status !== '完了' && d.status !== 'キャンセル';
    if (statusFilter === 'completed') return matchSearch && d.status === '完了';
    return matchSearch;
  });

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center text-[#2D4B3E] font-bold tracking-widest animate-pulse">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-32">
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-30 px-6 py-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-[20px] font-black text-[#2D4B3E] tracking-widest">受注一覧</h1>
        
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]"/>
            <input type="text" placeholder="名前・電話番号で検索" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="w-full h-10 bg-[#F7F7F7] border border-[#EAEAEA] rounded-xl pl-9 pr-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E] transition-all"/>
          </div>
          <div className="flex gap-1 bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] w-full md:w-auto">
            {[{id:'all',l:'すべて'},{id:'uncompleted',l:'未対応・作業中'},{id:'completed',l:'完了'}].map(f => (
              <button key={f.id} onClick={()=>setStatusFilter(f.id)} className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all ${statusFilter === f.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>{f.l}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 pt-8 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-20 text-[#999999] font-bold bg-white rounded-[32px] border-2 border-dashed border-[#EAEAEA]">該当する注文がありません</div>
        ) : (
          filteredOrders.map(order => {
            const d = order.order_data || {};
            const method = getMethodInfo(d.receiveMethod);
            const MIcon = method.icon;

            return (
              <Link href={`/staff/orders/${order.id}`} key={order.id} className="block bg-white p-5 md:p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 transition-all group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  <div className="flex items-center gap-5">
                    {/* 日付アイコン (お届け日) */}
                    <div className="w-16 h-16 shrink-0 rounded-2xl bg-[#FBFAF9] border border-[#EAEAEA] flex flex-col items-center justify-center relative">
                      <span className="text-[10px] font-bold text-[#999999] leading-none mb-1">{d.selectedDate?.split('-')[1] || '--'}月</span>
                      <span className="text-[20px] font-black text-[#2D4B3E] leading-none">{d.selectedDate?.split('-')[2] || '--'}</span>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${method.color}`}>
                          <MIcon size={12}/> {method.label}
                        </span>
                        
                        {/* ★ 発送日のバッジをドカンと追加！ */}
                        {d.receiveMethod === 'sagawa' && d.shippingDate && (
                          <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200 shadow-sm">
                            <Package size={12}/> 発送予定: {d.shippingDate.split('-')[1]}/{d.shippingDate.split('-')[2]}
                          </span>
                        )}
                        
                        <span className="text-[11px] font-bold text-[#999999] bg-[#FBFAF9] px-2 py-0.5 rounded border border-[#EAEAEA]">{d.selectedTime || '時間指定なし'}</span>
                      </div>
                      
                      <p className="text-[16px] font-black text-[#111111] group-hover:text-[#2D4B3E] transition-colors">{d.customerInfo?.name} 様</p>
                      
                      <div className="flex items-center gap-2 text-[12px] font-bold text-[#555555]">
                        <span className="bg-[#F7F7F7] px-2 py-0.5 rounded">{d.flowerType}</span>
                        {d.itemPrice && <span>¥{Number(d.itemPrice).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-[#EAEAEA]">
                    <div className="flex flex-col items-start md:items-end gap-1">
                      <span className={`px-3 py-1 rounded-lg text-[11px] font-bold ${d.status === '完了' || d.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                        {d.status === 'completed' ? '完了' : (d.status || '未対応')}
                      </span>
                      <span className="text-[10px] font-bold text-[#999999]">#{order.id.slice(0,8)}</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#FBFAF9] flex items-center justify-center text-[#999999] group-hover:bg-[#2D4B3E] group-hover:text-white transition-colors">
                      <ChevronRight size={20}/>
                    </div>
                  </div>
                  
                </div>
              </Link>
            );
          })
        )}
      </main>
    </div>
  );
}