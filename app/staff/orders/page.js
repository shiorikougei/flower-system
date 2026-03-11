'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { Search, Printer, Clock, Camera, CheckCircle, ChevronRight, X, Calendar, User, MapPin, Tag, FileText, Smartphone, Archive, RotateCcw, Inbox } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'selectedDate', direction: 'asc' });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [viewMode, setViewMode] = useState('active');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: settings } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
      if (settings) setAppSettings(settings.settings_data);

      const { data, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('データ取得エラー:', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const getStatusOptions = () => {
    const config = appSettings?.statusConfig;
    if (config?.type === 'custom' && config?.customLabels?.length > 0) return config.customLabels;
    return ['未対応', '制作中', '制作完了', '配達中'];
  };

  const updateStatusValue = async (orderId, newStatusValue) => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, currentStatus: newStatusValue };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, order_data: updatedData });
    } catch (err) { alert('更新失敗'); }
  };

  const updateArchiveStatus = async (orderId, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'active';
    if (!confirm(`この注文を${isArchive ? '完了' : '未完了'}にしますか？`)) return;
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, status: newStatus };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      setSelectedOrder(null);
    } catch (err) { alert('更新失敗'); }
  };

  const handleUploadReceipt = async (order, e) => {
    e.stopPropagation();
    const file = e.target.files[0]; if (!file) return;
    setUploadingId(order.id);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (ev) => {
      const updatedData = { ...order.order_data, receiptImage: ev.target.result };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', order.id);
      setOrders(orders.map(o => o.id === order.id ? { ...o, order_data: updatedData } : o));
      setUploadingId(null);
    };
  };

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '佐川急便' };
    return map[method] || method;
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      let valA, valB;
      if (sortConfig.key === 'selectedDate') {
        valA = a.order_data?.selectedDate || '9999-12-31';
        valB = b.order_data?.selectedDate || '9999-12-31';
      } else {
        valA = a.created_at || '';
        valB = b.created_at || '';
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, sortConfig]);

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter(order => {
      const d = order.order_data || {};
      const isArchived = d.status === 'completed';
      if (viewMode === 'active' && isArchived) return false;
      if (viewMode === 'archived' && !isArchived) return false;
      const searchStr = `${d.customerInfo?.name || ''} ${d.recipientInfo?.name || ''} ${d.flowerType || ''} ${d.selectedDate || ''}`;
      return searchStr.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [sortedOrders, searchTerm, viewMode]);

  if (isLoading) return <div className="p-20 text-center font-bold text-[#2D4B3E] animate-pulse">データを読み込み中...</div>;

  return (
    <main className="pb-32 font-sans">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">受注一覧</h1>
          <div className="flex bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA]">
            <button onClick={() => setViewMode('active')} className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${viewMode === 'active' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}><Inbox size={14} /> 未完了</button>
            <button onClick={() => setViewMode('archived')} className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${viewMode === 'archived' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}><Archive size={14} /> 完了済み</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA]">
            <button onClick={() => setSortConfig({key:'selectedDate', direction:'asc'})} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortConfig.key === 'selectedDate' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>お届け日順</button>
            <button onClick={() => setSortConfig({key:'created_at', direction:'desc'})} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sortConfig.key === 'created_at' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>受付順</button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" size={15} />
            <input type="text" placeholder="検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 pl-9 pr-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full text-[13px] outline-none focus:border-[#2D4B3E] w-48 transition-all" />
          </div>
        </div>
      </header>

      <div className="max-w-[1300px] mx-auto w-full p-4 md:p-8">
        <div className="bg-white rounded-[32px] border border-[#EAEAEA] shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                <th className="px-8 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">お届け・引取</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase text-center">状態</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">内容 / 金額</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">顧客名</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest text-center">受領書</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F7F7F7]">
              {filteredOrders.map((order) => {
                const d = order.order_data || {};
                const total = (Number(d.itemPrice) || 0) + (Number(d.calculatedFee) || 0) + (Number(d.pickupFee) || 0);
                const tax = Math.floor(total * 0.1);

                return (
                  <tr key={order.id} onClick={() => setSelectedOrder(order)} className={`hover:bg-[#FBFAF9]/30 transition-colors group cursor-pointer ${viewMode === 'archived' ? 'opacity-70' : ''}`}>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border ${viewMode === 'archived' ? 'bg-gray-100 border-gray-200' : 'bg-[#2D4B3E]/5 border-[#2D4B3E]/10 text-[#2D4B3E]'}`}>
                          <span className="text-[9px] font-bold opacity-60 leading-none">{d.selectedDate?.split('-')[1] || '--'}月</span>
                          <span className="text-[18px] font-black leading-none">{d.selectedDate?.split('-')[2] || '--'}</span>
                        </div>
                        <div className="text-[12px] font-bold">{d.selectedTime || '終日'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <select value={d.currentStatus || getStatusOptions()[0]} onChange={(e) => updateStatusValue(order.id, e.target.value)} className="text-[11px] font-bold bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg px-2 py-1.5 outline-none focus:border-[#2D4B3E] cursor-pointer appearance-none text-center">
                        {getStatusOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2 mb-1"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-[#2D4B3E]/10 text-[#2D4B3E]'}`}>{d.flowerType}</span></div>
                      <div className="text-[14px] font-black text-[#2D4B3E]">¥{(total + tax).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-6 font-bold text-[13px]">{d.customerInfo?.name} 様</td>
                    <td className="px-6 py-6 text-center" onClick={(e)=>e.stopPropagation()}>
                        {uploadingId === order.id ? <div className="w-8 h-8 border-2 border-[#2D4B3E] border-t-transparent animate-spin mx-auto rounded-full" /> : d.receiptImage ? (
                          <button onClick={() => setPreviewImage(d.receiptImage)} className="w-10 h-10 rounded-full bg-white border border-[#EAEAEA] text-[#2D4B3E] flex items-center justify-center mx-auto shadow-sm"><CheckCircle size={20} /></button>
                        ) : (
                          <label className="cursor-pointer w-10 h-10 rounded-full bg-[#FBFAF9] border border-[#EAEAEA] text-[#999999] flex items-center justify-center mx-auto hover:bg-[#2D4B3E]/5 transition-all"><Camera size={18} /><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} /></label>
                        )}
                    </td>
                    <td className="px-6 py-6 text-center" onClick={(e)=>e.stopPropagation()}>
                      {viewMode === 'archived' ? (
                        <button onClick={() => updateArchiveStatus(order.id, false)} className="flex items-center gap-1 px-3 py-2 bg-white border border-[#EAEAEA] text-[#555555] text-[11px] font-bold rounded-xl hover:border-[#2D4B3E] transition-all shadow-sm"><RotateCcw size={14} /> 戻す</button>
                      ) : (
                        <button onClick={() => window.open(`/staff/print/${order.id}`, '_blank')} className="w-10 h-10 bg-white border border-[#EAEAEA] text-[#555555] rounded-2xl flex items-center justify-center mx-auto hover:border-[#2D4B3E] transition-all shadow-sm"><Printer size={18} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- 詳細モーダル --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111111]/40 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[#FBFAF9] rounded-[32px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <h2 className="text-[18px] font-bold text-[#2D4B3E]">注文詳細</h2>
                <select value={selectedOrder.order_data?.currentStatus || getStatusOptions()[0]} onChange={(e) => updateStatusValue(selectedOrder.id, e.target.value)} className="text-[12px] font-bold bg-[#2D4B3E] text-white rounded-lg px-4 py-1.5 outline-none shadow-sm cursor-pointer">
                  {getStatusOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => updateArchiveStatus(selectedOrder.id, selectedOrder.order_data?.status !== 'completed')} className={`flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-xl transition-all shadow-sm ${selectedOrder.order_data?.status === 'completed' ? 'bg-white border border-[#EAEAEA] text-[#555555]' : 'bg-[#2D4B3E] text-white'}`}>
                  {selectedOrder.order_data?.status === 'completed' ? <RotateCcw size={16}/> : <Archive size={16}/>}
                  {selectedOrder.order_data?.status === 'completed' ? '未完了に戻す' : '完了してアーカイブ'}
                </button>
                <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555555] font-bold hover:bg-[#EAEAEA]">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-8 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-2">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> お届け・受取情報</p>
                  <p className="text-[16px] font-black text-[#2D4B3E]">{selectedOrder.order_data.selectedDate} {selectedOrder.order_data.selectedTime}</p>
                  <p className="text-[13px] font-bold">{getMethodLabel(selectedOrder.order_data.receiveMethod)} {selectedOrder.order_data.receiveMethod === 'pickup' && `(${selectedOrder.order_data.selectedShop})`}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-2">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><User size={12}/> ご注文者様</p>
                  <p className="font-bold text-[15px]">{selectedOrder.order_data.customerInfo?.name} 様</p>
                  <p className="text-[12px] text-[#555555] flex items-center gap-1"><Smartphone size={12}/> {selectedOrder.order_data.customerInfo?.phone}</p>
                  {selectedOrder.order_data.receiveMethod !== 'pickup' && <p className="text-[11px] text-[#999999] leading-tight">〒{selectedOrder.order_data.customerInfo?.zip}<br/>{selectedOrder.order_data.customerInfo?.address1}{selectedOrder.order_data.customerInfo?.address2}</p>}
                </div>
              </div>

              {selectedOrder.order_data.isRecipientDifferent && (
                <div className="animate-in fade-in">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-2 mb-2"><MapPin size={12}/> お届け先様（別住所）</p>
                  <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm space-y-2 text-[13px]">
                    <p className="font-bold text-[15px] text-red-700">{selectedOrder.order_data.recipientInfo?.name} 様</p>
                    <p className="text-[#555555]">📞 {selectedOrder.order_data.recipientInfo?.phone}</p>
                    <p className="text-[12px] text-red-600/70 leading-tight">〒{selectedOrder.order_data.recipientInfo?.zip}<br/>{selectedOrder.order_data.recipientInfo?.address1}{selectedOrder.order_data.recipientInfo?.address2}</p>
                  </div>
                </div>
              )}

              {/* ★ 商品詳細・消費税入り */}
              <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm">
                <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest mb-4 flex items-center gap-2"><Tag size={12}/> 商品詳細</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px] font-bold mb-6">
                  <div><span className="text-[10px] block text-[#999999]">種類</span>{selectedOrder.order_data.flowerType}</div>
                  <div><span className="text-[10px] block text-[#999999]">用途</span>{selectedOrder.order_data.flowerPurpose}</div>
                  <div><span className="text-[10px] block text-[#999999]">カラー</span>{selectedOrder.order_data.flowerColor}</div>
                  <div><span className="text-[10px] block text-[#999999]">イメージ</span>{selectedOrder.order_data.flowerVibe}</div>
                </div>
                <div className="border-t border-[#FBFAF9] pt-4 space-y-1.5 text-[13px]">
                  <div className="flex justify-between text-[#555555]"><span>商品代金 (税抜)</span><span className="font-bold">¥{Number(selectedOrder.order_data.itemPrice).toLocaleString()}</span></div>
                  {Number(selectedOrder.order_data.calculatedFee) > 0 && <div className="flex justify-between text-[#555555]"><span>配達・送料</span><span className="font-bold">¥{Number(selectedOrder.order_data.calculatedFee).toLocaleString()}</span></div>}
                  {Number(selectedOrder.order_data.pickupFee) > 0 && <div className="flex justify-between text-orange-600"><span>回収料</span><span className="font-bold">¥{Number(selectedOrder.order_data.pickupFee).toLocaleString()}</span></div>}
                  
                  {/* 消費税表示 */}
                  <div className="flex justify-between text-[#2D4B3E]">
                    <span>消費税 (10%)</span>
                    <span className="font-bold">¥{Math.floor((Number(selectedOrder.order_data.itemPrice) + Number(selectedOrder.order_data.calculatedFee || 0) + Number(selectedOrder.order_data.pickupFee || 0)) * 0.1).toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between text-[16px] mt-2 pt-2 border-t border-[#FBFAF9] font-black text-[#2D4B3E]"><span>合計金額 (税込)</span><span>¥{Math.floor(((Number(selectedOrder.order_data.itemPrice) + Number(selectedOrder.order_data.calculatedFee || 0) + Number(selectedOrder.order_data.pickupFee || 0)) * 1.1)).toLocaleString()}</span></div>
                </div>
              </div>

              {/* 立札・備考 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> 立札・メッセージ</p>
                  <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm min-h-[120px]">
                    <span className="inline-block px-3 py-1 bg-[#2D4B3E] text-white text-[10px] font-bold rounded-md mb-3">{selectedOrder.order_data.cardType}</span>
                    {selectedOrder.order_data.cardType === '立札' ? (
                      <div className="space-y-1 text-[12px] font-bold">
                        <p className="text-[#999999] font-normal">①内容: {selectedOrder.order_data.tateInput1}</p>
                        <p className="text-[#999999] font-normal">②宛名: {selectedOrder.order_data.tateInput2}</p>
                        <p className="text-[#999999] font-normal">③贈り主: {selectedOrder.order_data.tateInput3}</p>
                      </div>
                    ) : <p className="text-[13px] whitespace-pre-wrap leading-relaxed font-bold">{selectedOrder.order_data.cardMessage || 'メッセージなし'}</p>}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><FileText size={12}/> 備考・要望</p>
                  <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm min-h-[120px]">
                    <p className="text-[13px] whitespace-pre-wrap text-[#111111] font-bold leading-relaxed">{selectedOrder.order_data.note || '特になし'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-6" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[85vh] rounded-xl border-4 border-white shadow-2xl" />
        </div>
      )}
    </main>
  );
}