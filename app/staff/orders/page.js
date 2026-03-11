'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { Search, Printer, Clock, Camera, CheckCircle, ChevronRight, X } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // アップロード中とプレビュー用の状態
  const [uploadingId, setUploadingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
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

  const handlePrint = (orderId) => {
    window.open(`/staff/print/${orderId}`, '_blank');
  };

  // 画像圧縮ロジック
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > 800) { height = Math.round((height * 800) / width); width = 800; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  // 受領書アップロード
  const handleUploadReceipt = async (order, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingId(order.id);
    try {
      const compressedBase64 = await compressImage(file);
      const updatedOrderData = { ...order.order_data, receiptImage: compressedBase64 };
      const { error } = await supabase.from('orders').update({ order_data: updatedOrderData }).eq('id', order.id);
      if (error) throw error;
      setOrders(orders.map(o => o.id === order.id ? { ...o, order_data: updatedOrderData } : o));
    } catch (err) {
      alert('保存に失敗しました。');
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  };

  // 検索フィルタリング
  const filteredOrders = orders.filter(order => {
    const d = order.order_data;
    const searchStr = (d.customerInfo?.name || '') + (d.recipientInfo?.name || '') + (d.flowerType || '') + (d.selectedDate || '');
    return searchStr.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (isLoading) return <div className="p-20 text-center font-bold text-[#2D4B3E] animate-pulse">データを読み込み中...</div>;

  return (
    <main className="pb-32">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">受注一覧・帳票発行</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" size={16} />
          <input 
            type="text" 
            placeholder="お名前、日付、商品名で検索..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 pr-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full text-[13px] outline-none focus:border-[#2D4B3E] w-64 transition-all"
          />
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto w-full p-4 md:p-8">
        <div className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest uppercase">お届け日 / 内容</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest uppercase">ご依頼主 / お届け先</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest uppercase">金額内訳</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest text-center">受領書</th>
                <th className="px-6 py-4 text-[11px] font-bold text-[#999999] tracking-widest text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F7F7F7]">
              {filteredOrders.map((order) => {
                const d = order.order_data;
                const itemPrice = Number(d.itemPrice) || 0;
                const fee = Number(d.calculatedFee) || 0;
                const pickupFee = Number(d.pickupFee) || 0;
                const subTotal = itemPrice + fee + pickupFee;
                const tax = Math.floor(subTotal * 0.1);
                const totalAmount = subTotal + tax;

                return (
                  <tr key={order.id} className="hover:bg-[#FBFAF9] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                          {d.receiveMethod === 'pickup' ? '店頭' : '配達'}
                        </span>
                        <span className="text-[14px] font-bold text-[#111111]">{d.flowerType}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-[#f57f17] font-bold">
                        <Clock size={12} />
                        {d.selectedDate} <span className="text-[10px] text-gray-400 font-normal">{d.selectedTime}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-[13px] font-bold text-[#111111]">{d.customerInfo?.name} 様</p>
                      {d.isRecipientDifferent && (
                        <p className="text-[11px] text-[#999999] mt-1 flex items-center gap-1">
                          <ChevronRight size={10} /> {d.recipientInfo?.name} 様
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-[14px] font-bold text-[#2D4B3E]">¥{totalAmount.toLocaleString()}</div>
                      <div className="text-[9px] text-[#999999] leading-tight mt-1">
                        内訳: ¥{itemPrice.toLocaleString()} + 送¥{fee.toLocaleString()} {pickupFee > 0 && `+ 回¥${pickupFee.toLocaleString()}`}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {uploadingId === order.id ? (
                        <span className="text-[10px] font-bold text-[#999999] animate-pulse">保存中...</span>
                      ) : d.receiptImage ? (
                        <div className="flex flex-col items-center gap-1">
                          <button onClick={() => setPreviewImage(d.receiptImage)} className="p-2 bg-[#2D4B3E]/5 text-[#2D4B3E] rounded-full hover:bg-[#2D4B3E] hover:text-white transition-all">
                            <CheckCircle size={18} />
                          </button>
                          <label className="text-[9px] text-gray-400 underline cursor-pointer hover:text-[#2D4B3E]">
                            再UP<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} />
                          </label>
                        </div>
                      ) : (
                        <label className="cursor-pointer inline-flex flex-col items-center gap-1 group/cam">
                          <div className="p-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full text-[#999999] group-hover/cam:bg-[#2D4B3E] group-hover/cam:text-white transition-all">
                            <Camera size={18} />
                          </div>
                          <span className="text-[9px] font-bold text-[#999999]">受領書UP</span>
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} />
                        </label>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button 
                        onClick={() => handlePrint(order.id)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#EAEAEA] text-[#555555] text-[11px] font-bold rounded-xl shadow-sm hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all active:scale-95"
                      >
                        <Printer size={14} /> 伝票
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="p-20 text-center text-[#999999] font-bold tracking-widest">
              注文データが見つかりません。
            </div>
          )}
        </div>
      </div>

      {/* 受領書プレビューモーダル */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 text-white flex items-center gap-1 font-bold text-sm bg-black/20 px-3 py-1 rounded-full hover:bg-black/40">
              <X size={18} /> 閉じる
            </button>
            <img src={previewImage} alt="受領書" className="w-full h-auto max-h-[80vh] object-contain rounded-2xl shadow-2xl bg-white" />
          </div>
        </div>
      )}
    </main>
  );
}