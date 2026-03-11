'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Search, Printer, Clock, Camera, CheckCircle, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'selectedDate', direction: 'asc' });
  
  const [uploadingId, setUploadingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    async function fetchData() {
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
    fetchData();
  }, []);

  // 並び替え・フィルタリングロジック（前回と同じ）
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedOrders = [...orders].sort((a, b) => {
    let valA, valB;
    if (sortConfig.key === 'selectedDate') {
      valA = a.order_data.selectedDate || '';
      valB = b.order_data.selectedDate || '';
    } else {
      valA = a.created_at;
      valB = b.created_at;
    }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const filteredOrders = sortedOrders.filter(order => {
    const d = order.order_data;
    const searchStr = (d.customerInfo?.name || '') + (d.recipientInfo?.name || '') + (d.flowerType || '') + (d.selectedDate || '');
    return searchStr.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // 受領書UP関数
  const handleUploadReceipt = async (order, e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingId(order.id);
    try {
      // 簡易的な圧縮処理（詳細は前述通り）
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async (ev) => {
        const updatedData = { ...order.order_data, receiptImage: ev.target.result };
        await supabase.from('orders').update({ order_data: updatedData }).eq('id', order.id);
        setOrders(orders.map(o => o.id === order.id ? { ...o, order_data: updatedData } : o));
        setUploadingId(null);
      };
    } catch (err) { setUploadingId(null); }
  };

  if (isLoading) return <div className="p-20 text-center font-bold text-[#2D4B3E] animate-pulse">データを読み込み中...</div>;

  return (
    <main className="pb-32">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">受注一覧</h1>
        <div className="flex items-center gap-4">
          <div className="flex bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA]">
            <button onClick={() => requestSort('selectedDate')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortConfig.key === 'selectedDate' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>お届け日順</button>
            <button onClick={() => requestSort('created_at')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortConfig.key === 'created_at' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>受付順</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" size={15} />
            <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 pl-9 pr-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full text-[13px] outline-none focus:border-[#2D4B3E] w-48 transition-all" />
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto w-full p-4 md:p-8">
        <div className="bg-white rounded-[32px] border border-[#EAEAEA] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                <th className="px-8 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">お届け・引取日時</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">注文内容 / 金額</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">顧客情報</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase text-center">受領書</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest text-center">伝票</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F7F7F7]">
              {filteredOrders.map((order) => {
                const d = order.order_data;
                const total = (Number(d.itemPrice) || 0) + (Number(d.calculatedFee) || 0) + (Number(d.pickupFee) || 0);
                const tax = Math.floor(total * 0.1);

                return (
                  <tr key={order.id} className="hover:bg-[#FBFAF9]/30 transition-colors group">
                    {/* お届け日時：洗練された新しいデザイン */}
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-14 h-14 bg-[#2D4B3E]/5 rounded-2xl border border-[#2D4B3E]/10">
                          <span className="text-[10px] font-bold text-[#2D4B3E]/60 leading-none mb-1">
                            {d.selectedDate?.split('-')[1]}月
                          </span>
                          <span className="text-[20px] font-black text-[#2D4B3E] leading-none tracking-tighter">
                            {d.selectedDate?.split('-')[2]}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1 text-[13px] font-bold text-[#111111]">
                            <CalendarIcon size={12} className="text-[#2D4B3E]" />
                            {d.selectedDate}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-bold text-[#2D4B3E] mt-0.5">
                            <Clock size={11} />
                            {d.selectedTime || '終日指定なし'}
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] text-[#999999] font-medium flex items-center gap-1 pl-1">
                        受付: {new Date(order.created_at).toLocaleDateString('ja-JP')}
                      </p>
                    </td>
                    
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-[#2D4B3E]/10 text-[#2D4B3E]'}`}>
                          {d.receiveMethod === 'pickup' ? '店頭' : '配達'}
                        </span>
                        <span className="text-[14px] font-bold text-[#111111]">{d.flowerType}</span>
                      </div>
                      <div className="text-[14px] font-black text-[#2D4B3E] tracking-tight">
                        ¥{(total + tax).toLocaleString()}
                        <span className="text-[10px] font-normal text-[#999999] ml-1">(税込)</span>
                      </div>
                    </td>

                    <td className="px-6 py-6">
                      <p className="text-[13px] font-bold text-[#111111]">{d.customerInfo?.name} 様</p>
                      {d.isRecipientDifferent && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-[#999999] font-medium">
                          <ChevronRight size={10} /> 宛: {d.recipientInfo?.name} 様
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-6 text-center">
                      {uploadingId === order.id ? (
                        <div className="w-10 h-10 rounded-full border-2 border-[#2D4B3E] border-t-transparent animate-spin mx-auto" />
                      ) : d.receiptImage ? (
                        <button onClick={() => setPreviewImage(d.receiptImage)} className="w-10 h-10 rounded-full bg-white border border-[#EAEAEA] text-[#2D4B3E] flex items-center justify-center mx-auto shadow-sm hover:shadow-md transition-all active:scale-95">
                          <CheckCircle size={20} />
                        </button>
                      ) : (
                        <label className="cursor-pointer w-10 h-10 rounded-full bg-[#FBFAF9] border border-[#EAEAEA] text-[#999999] flex items-center justify-center mx-auto hover:bg-[#2D4B3E]/5 hover:text-[#2D4B3E] hover:border-[#2D4B3E]/20 transition-all">
                          <Camera size={18} /><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} />
                        </label>
                      )}
                    </td>

                    <td className="px-6 py-6 text-center">
                      <button onClick={() => window.open(`/staff/print/${order.id}`, '_blank')} className="w-10 h-10 bg-white border border-[#EAEAEA] text-[#555555] rounded-2xl flex items-center justify-center mx-auto shadow-sm hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all active:scale-95">
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full">
            <img src={previewImage} className="w-full h-auto max-h-[85vh] rounded-2xl shadow-2xl border-4 border-white" />
            <button className="absolute -top-12 right-0 text-white flex items-center gap-1 font-bold"><X size={24} /> 閉じる</button>
          </div>
        </div>
      )}
    </main>
  );
}