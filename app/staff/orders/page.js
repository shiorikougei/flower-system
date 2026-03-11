'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Search, Printer, Clock, Camera, CheckCircle, ChevronRight, X, Calendar as CalendarIcon, User, MapPin, Tag, FileText } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'selectedDate', direction: 'asc' });
  
  const [selectedOrder, setSelectedOrder] = useState(null); // ★詳細モーダル用
  const [uploadingId, setUploadingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: ordersData, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
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

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '佐川急便' };
    return map[method] || method;
  };

  // 受領書UP関数
  const handleUploadReceipt = async (order, e) => {
    e.stopPropagation(); // 行のクリックイベント（詳細表示）を発火させない
    const file = e.target.files[0]; if (!file) return;
    setUploadingId(order.id);
    try {
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
                  <tr 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)} // ★行をクリックで詳細
                    className="hover:bg-[#FBFAF9]/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-14 h-14 bg-[#2D4B3E]/5 rounded-2xl border border-[#2D4B3E]/10">
                          <span className="text-[10px] font-bold text-[#2D4B3E]/60 leading-none mb-1">{d.selectedDate?.split('-')[1]}月</span>
                          <span className="text-[20px] font-black text-[#2D4B3E] leading-none tracking-tighter">{d.selectedDate?.split('-')[2]}</span>
                        </div>
                        <div className="flex flex-col text-[11px] font-bold text-[#2D4B3E]">
                           <div className="text-[13px] text-[#111111]">{d.selectedDate}</div>
                           <div className="flex items-center gap-1 mt-0.5"><Clock size={11} />{d.selectedTime || '終日'}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-[#2D4B3E]/10 text-[#2D4B3E]'}`}>
                          {getMethodLabel(d.receiveMethod)}
                        </span>
                        <span className="text-[14px] font-bold text-[#111111]">{d.flowerType}</span>
                      </div>
                      <div className="text-[14px] font-black text-[#2D4B3E]">¥{(total + tax).toLocaleString()}</div>
                    </td>

                    <td className="px-6 py-6 text-[13px] font-bold text-[#111111]">
                      {d.customerInfo?.name} 様
                      {d.isRecipientDifferent && <div className="text-[10px] text-[#999999] font-medium mt-1 flex items-center gap-1"><ChevronRight size={10} /> {d.recipientInfo?.name} 様 宛</div>}
                    </td>

                    <td className="px-6 py-6 text-center">
                      <div onClick={(e) => e.stopPropagation()}>
                        {uploadingId === order.id ? (
                          <div className="w-10 h-10 rounded-full border-2 border-[#2D4B3E] border-t-transparent animate-spin mx-auto" />
                        ) : d.receiptImage ? (
                          <button onClick={() => setPreviewImage(d.receiptImage)} className="w-10 h-10 rounded-full bg-white border border-[#EAEAEA] text-[#2D4B3E] flex items-center justify-center mx-auto shadow-sm hover:scale-110 transition-all"><CheckCircle size={20} /></button>
                        ) : (
                          <label className="cursor-pointer w-10 h-10 rounded-full bg-[#FBFAF9] border border-[#EAEAEA] text-[#999999] flex items-center justify-center mx-auto hover:bg-[#2D4B3E] hover:text-white transition-all"><Camera size={18} /><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} /></label>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-6 text-center">
                      <div onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => window.open(`/staff/print/${order.id}`, '_blank')} className="w-10 h-10 bg-white border border-[#EAEAEA] text-[#555555] rounded-2xl flex items-center justify-center mx-auto hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm"><Printer size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- 詳細モーダル (CalendarPageと同じUI) --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111111]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[#FBFAF9] rounded-[32px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-10" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] p-6 flex items-center justify-between z-10">
              <div><h2 className="text-[18px] font-bold text-[#2D4B3E]">注文詳細</h2><p className="text-[11px] text-[#999999] font-mono mt-1">Order ID: {selectedOrder.id}</p></div>
              <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 bg-[#FBFAF9] rounded-full flex items-center justify-center text-[#555555] font-bold hover:bg-[#EAEAEA] transition-all">✕</button>
            </div>
            
            <div className="p-8 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><CalendarIcon size={14} /> お届け・受取情報</h3>
                  <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-3">
                    <div><span className="text-[10px] text-[#999999] block font-bold">希望日時</span><span className="text-[16px] font-black text-[#2D4B3E]">{selectedOrder.order_data.selectedDate} {selectedOrder.order_data.selectedTime}</span></div>
                    <div><span className="text-[10px] text-[#999999] block font-bold">受取方法</span><span className="text-[14px] font-bold text-[#111111]">{getMethodLabel(selectedOrder.order_data.receiveMethod)} {selectedOrder.order_data.receiveMethod === 'pickup' && `(${selectedOrder.order_data.selectedShop})`}</span></div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><User size={14} /> ご注文者様</h3>
                  <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-2 text-[13px] text-[#111111]">
                    <p className="font-bold text-[15px]">{selectedOrder.order_data.customerInfo?.name} 様</p>
                    <p className="text-[#555555]">📞 {selectedOrder.order_data.customerInfo?.phone}</p>
                    {selectedOrder.order_data.receiveMethod !== 'pickup' && <p className="text-[12px] text-[#999999] leading-tight">〒{selectedOrder.order_data.customerInfo?.zip}<br/>{selectedOrder.order_data.customerInfo?.address1}{selectedOrder.order_data.customerInfo?.address2}</p>}
                  </div>
                </div>
              </div>

              {selectedOrder.order_data.isRecipientDifferent && (
                <div className="space-y-3 animate-in fade-in">
                  <h3 className="text-[11px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={14} /> お届け先様（別住所）</h3>
                  <div className="bg-red-50/30 p-5 rounded-2xl border border-red-100 space-y-2 text-[13px] text-[#111111]">
                    <p className="font-bold text-[15px] text-red-700">{selectedOrder.order_data.recipientInfo?.name} 様</p>
                    <p className="text-[#555555]">📞 {selectedOrder.order_data.recipientInfo?.phone}</p>
                    <p className="text-[12px] text-red-600/70 leading-tight">〒{selectedOrder.order_data.recipientInfo?.zip}<br/>{selectedOrder.order_data.recipientInfo?.address1}{selectedOrder.order_data.recipientInfo?.address2}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><Tag size={14} /> 商品・金額詳細</h3>
                <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div><span className="text-[10px] text-[#999999] block font-bold">種類</span><span className="text-[14px] font-bold">{selectedOrder.order_data.flowerType} {selectedOrder.order_data.isBring === 'bring' && <span className="text-orange-500 text-[10px]">(持込)</span>}</span></div>
                    <div><span className="text-[10px] text-[#999999] block font-bold">用途</span><span className="text-[14px] font-bold">{selectedOrder.order_data.flowerPurpose}</span></div>
                    <div><span className="text-[10px] text-[#999999] block font-bold">カラー</span><span className="text-[14px] font-bold">{selectedOrder.order_data.flowerColor}</span></div>
                    <div><span className="text-[10px] text-[#999999] block font-bold">イメージ</span><span className="text-[14px] font-bold">{selectedOrder.order_data.flowerVibe}</span></div>
                  </div>
                  <div className="border-t border-[#FBFAF9] pt-4 space-y-1 text-[13px]">
                    <div className="flex justify-between"><span>商品代金 (税抜)</span><span className="font-bold">¥{Number(selectedOrder.order_data.itemPrice).toLocaleString()}</span></div>
                    {selectedOrder.order_data.calculatedFee > 0 && <div className="flex justify-between"><span>配達料・送料</span><span className="font-bold">¥{Number(selectedOrder.order_data.calculatedFee).toLocaleString()}</span></div>}
                    {selectedOrder.order_data.pickupFee > 0 && <div className="flex justify-between text-orange-600"><span>後日回収費用</span><span className="font-bold">¥{Number(selectedOrder.order_data.pickupFee).toLocaleString()}</span></div>}
                    <div className="flex justify-between text-[16px] mt-2 pt-2 border-t border-[#FBFAF9] font-black text-[#2D4B3E]"><span>合計金額 (税込目安)</span><span>¥{( (Number(selectedOrder.order_data.itemPrice) + Number(selectedOrder.order_data.calculatedFee || 0) + Number(selectedOrder.order_data.pickupFee || 0)) * 1.1 ).toLocaleString().split('.')[0]}</span></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><FileText size={14} /> 立札・メッセージ</h3>
                  <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm">
                    <span className="inline-block px-3 py-1 bg-[#2D4B3E] text-white text-[10px] font-bold rounded-md mb-3">{selectedOrder.order_data.cardType}</span>
                    {selectedOrder.order_data.cardType === 'メッセージカード' && <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{selectedOrder.order_data.cardMessage}</p>}
                    {selectedOrder.order_data.cardType === '立札' && (
                      <div className="space-y-2 text-[12px]"><p><span className="text-[#999999] mr-2 font-bold">①内容:</span>{selectedOrder.order_data.tateInput1}</p><p><span className="text-[#999999] mr-2 font-bold">②宛名:</span>{selectedOrder.order_data.tateInput2}</p><p><span className="text-[#999999] mr-2 font-bold">③贈り主:</span>{selectedOrder.order_data.tateInput3}</p></div>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><FileText size={14} /> 備考・要望</h3>
                  <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm min-h-[100px]"><p className="text-[13px] whitespace-pre-wrap text-[#111111] leading-relaxed">{selectedOrder.order_data.note || '特になし'}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 受領書プレビュー用 */}
      {previewImage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-6" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full text-center">
            <img src={previewImage} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl border-4 border-white inline-block" />
            <button className="absolute -top-12 right-0 text-white flex items-center gap-1 font-bold text-lg"><X size={24} /> 閉じる</button>
          </div>
        </div>
      )}
    </main>
  );
}