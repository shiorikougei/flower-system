'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Search, Printer, Clock, Camera, CheckCircle, ChevronRight, X, ArrowUpDown } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'selectedDate', direction: 'asc' }); // デフォルトはお届け日順
  
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

  // 並び替えロジック
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedOrders = [...orders].sort((a, b) => {
    let valA, valB;
    if (sortConfig.key === 'selectedDate') {
      valA = a.order_data.selectedDate || '';
      valB = b.order_data.selectedDate || '';
    } else if (sortConfig.key === 'created_at') {
      valA = a.created_at;
      valB = b.created_at;
    }
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  // 検索フィルタリング
  const filteredOrders = sortedOrders.filter(order => {
    const d = order.order_data;
    const searchStr = (d.customerInfo?.name || '') + (d.recipientInfo?.name || '') + (d.flowerType || '') + (d.selectedDate || '');
    return searchStr.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // 受領書アップロード等の関数は維持（省略せずに記述）
  const compressImage = (file) => { /* ...前回のコードと同じ... */ 
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width; let h = img.height;
          if (w > 800) { h = Math.round((h * 800) / w); w = 800; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  const handleUploadReceipt = async (order, e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploadingId(order.id);
    try {
      const compressedBase64 = await compressImage(file);
      const updatedData = { ...order.order_data, receiptImage: compressedBase64 };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', order.id);
      setOrders(orders.map(o => o.id === order.id ? { ...o, order_data: updatedData } : o));
    } finally { setUploadingId(null); }
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
        <div className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest uppercase">お届け・引取日時</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest uppercase">注文内容</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest uppercase">顧客情報</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest uppercase text-center">受領書</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest text-center">伝票</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F7F7F7]">
              {filteredOrders.map((order) => {
                const d = order.order_data;
                const total = (Number(d.itemPrice) || 0) + (Number(d.calculatedFee) || 0) + (Number(d.pickupFee) || 0);
                const tax = Math.floor(total * 0.1);

                return (
                  <tr key={order.id} className="hover:bg-[#FBFAF9]/50 transition-colors group">
                    {/* お届け日：ここを強化 */}
                    <td className="px-6 py-5">
                      <div className="inline-flex flex-col bg-[#2D4B3E] text-white px-4 py-2 rounded-2xl shadow-sm">
                        <span className="text-[10px] font-bold opacity-80 leading-none mb-1">SCHEDULE</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[15px] font-black tracking-tighter">{d.selectedDate}</span>
                          <span className="text-[12px] font-bold border-l border-white/30 pl-1.5">{d.selectedTime || '終日'}</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#999999] font-bold px-1">
                        <CheckCircle size={12} className="text-[#2D4B3E]" /> 
                        受付: {new Date(order.created_at).toLocaleDateString('ja-JP')}
                      </div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-[#2D4B3E]/10 text-[#2D4B3E]'}`}>
                          {d.receiveMethod === 'pickup' ? '店頭' : '配達'}
                        </span>
                        <span className="text-[14px] font-bold text-[#111111]">{d.flowerType}</span>
                      </div>
                      <div className="text-[13px] font-bold text-[#2D4B3E]">¥{(total + tax).toLocaleString()}</div>
                    </td>

                    <td className="px-6 py-5">
                      <p className="text-[13px] font-bold text-[#111111]">{d.customerInfo?.name} 様</p>
                      {d.isRecipientDifferent && (
                        <p className="text-[11px] text-[#999999] mt-1 flex items-center gap-1">
                          <ChevronRight size={10} /> {d.recipientInfo?.name} 様 宛
                        </p>
                      )}
                    </td>

                    <td className="px-6 py-5 text-center">
                      {uploadingId === order.id ? (
                        <span className="text-[10px] font-bold text-[#999999] animate-pulse">UP中</span>
                      ) : d.receiptImage ? (
                        <button onClick={() => setPreviewImage(d.receiptImage)} className="w-10 h-10 rounded-full bg-[#2D4B3E] text-white flex items-center justify-center mx-auto shadow-md hover:scale-110 transition-transform">
                          <CheckCircle size={20} />
                        </button>
                      ) : (
                        <label className="cursor-pointer w-10 h-10 rounded-full bg-[#F7F7F7] border border-[#EAEAEA] text-[#999999] flex items-center justify-center mx-auto hover:bg-[#2D4B3E] hover:text-white transition-all group-hover:border-transparent">
                          <Camera size={18} /><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} />
                        </label>
                      )}
                    </td>

                    <td className="px-6 py-5 text-center">
                      <button onClick={() => window.open(`/staff/print/${order.id}`, '_blank')} className="p-3 bg-white border border-[#EAEAEA] text-[#555555] rounded-xl hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">
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
          <img src={previewImage} className="max-w-full max-h-[85vh] rounded-xl shadow-2xl border-4 border-white" />
          <button className="absolute top-8 right-8 text-white"><X size={32} /></button>
        </div>
      )}
    </main>
  );
}