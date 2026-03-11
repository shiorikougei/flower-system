'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { Search, Printer, Clock, Camera, CheckCircle, ChevronRight, X, Calendar, User, MapPin, Tag, FileText, Smartphone, Archive, RotateCcw, Inbox, ChevronDown } from 'lucide-react';

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

  // ★ ステータスの選択肢を取得するロジック
  const getStatusOptions = () => {
    const config = appSettings?.statusConfig;
    if (config?.type === 'custom' && config?.customLabels?.length > 0) {
      return config.customLabels;
    }
    // デフォルトテンプレ
    return ['未対応', '制作中', '制作完了', '配達中'];
  };

  // ★ ステータス単体を更新する関数
  const updateStatusValue = async (orderId, newStatusValue) => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, currentStatus: newStatusValue };
      const { error } = await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      if (error) throw error;
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
    } catch (err) {
      alert('ステータスの更新に失敗しました。');
    }
  };

  // アーカイブ機能（既存）
  const updateArchiveStatus = async (orderId, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'active';
    const actionText = isArchive ? '完了' : '未完了に戻す';
    if (!confirm(`この注文を「${actionText}」にしますか？`)) return;
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, status: newStatus };
      const { error } = await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      if (error) throw error;
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      setSelectedOrder(null);
    } catch (err) { alert('更新に失敗しました。'); }
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

  return (
    <main className="pb-32 font-sans">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">
            {viewMode === 'active' ? '受注一覧' : 'アーカイブ'}
          </h1>
          <div className="flex bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA]">
            <button onClick={() => setViewMode('active')} className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${viewMode === 'active' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}><Inbox size={14} /> 未完了</button>
            <button onClick={() => setViewMode('archived')} className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${viewMode === 'archived' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}><Archive size={14} /> 完了済み</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
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
                <th className="px-8 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">お届け日</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase text-center">ステータス</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">内容 / 金額</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest uppercase">顧客</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest text-center">受領書</th>
                <th className="px-6 py-5 text-[11px] font-bold text-[#999999] tracking-widest text-center">伝票</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F7F7F7]">
              {filteredOrders.map((order) => {
                const d = order.order_data || {};
                const total = (Number(d.itemPrice) || 0) + (Number(d.calculatedFee) || 0) + (Number(d.pickupFee) || 0);
                const tax = Math.floor(total * 0.1);

                return (
                  <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-[#FBFAF9]/30 transition-colors group cursor-pointer">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-12 h-12 bg-[#2D4B3E]/5 rounded-xl border border-[#2D4B3E]/10 font-bold text-[#2D4B3E]">
                          <span className="text-[9px] opacity-60 leading-none">{d.selectedDate?.split('-')[1]}月</span>
                          <span className="text-[18px] leading-none tracking-tighter">{d.selectedDate?.split('-')[2]}</span>
                        </div>
                        <div className="text-[12px] font-bold">{d.selectedTime || '終日'}</div>
                      </div>
                    </td>

                    {/* ★ ステータス選択列 */}
                    <td className="px-6 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <select 
                        value={d.currentStatus || getStatusOptions()[0]} 
                        onChange={(e) => updateStatusValue(order.id, e.target.value)}
                        className="text-[11px] font-bold bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg px-3 py-1.5 outline-none focus:border-[#2D4B3E] cursor-pointer appearance-none text-center"
                      >
                        {getStatusOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>

                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : 'bg-[#2D4B3E]/10 text-[#2D4B3E]'}`}>{d.flowerType}</span>
                      </div>
                      <div className="text-[13px] font-black text-[#2D4B3E]">¥{(total + tax).toLocaleString()}</div>
                    </td>

                    <td className="px-6 py-6 font-bold text-[13px]">{d.customerInfo?.name} 様</td>

                    <td className="px-6 py-6 text-center" onClick={(e)=>e.stopPropagation()}>
                        {d.receiptImage ? (
                          <button onClick={() => setPreviewImage(d.receiptImage)} className="w-10 h-10 rounded-full bg-white border border-[#EAEAEA] text-[#2D4B3E] flex items-center justify-center mx-auto shadow-sm"><CheckCircle size={20} /></button>
                        ) : (
                          <label className="cursor-pointer w-10 h-10 rounded-full bg-[#FBFAF9] border border-[#EAEAEA] text-[#999999] flex items-center justify-center mx-auto hover:bg-[#2D4B3E]/5 transition-all"><Camera size={18} /><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} /></label>
                        )}
                    </td>

                    <td className="px-6 py-6 text-center" onClick={(e)=>e.stopPropagation()}>
                      {viewMode === 'archived' ? (
                        <button onClick={() => updateArchiveStatus(order.id, false)} className="px-3 py-2 bg-white border border-[#EAEAEA] text-[#555555] text-[11px] font-bold rounded-xl shadow-sm"><RotateCcw size={14} /></button>
                      ) : (
                        <button onClick={() => window.open(`/staff/print/${order.id}`, '_blank')} className="w-10 h-10 bg-white border border-[#EAEAEA] rounded-2xl flex items-center justify-center mx-auto hover:border-[#2D4B3E] transition-all"><Printer size={18} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- 詳細モーダル (ステータス反映版) --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111111]/40 backdrop-blur-sm p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[#FBFAF9] rounded-[32px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <h2 className="text-[18px] font-bold text-[#2D4B3E]">注文詳細</h2>
                <select 
                  value={selectedOrder.order_data?.currentStatus || getStatusOptions()[0]} 
                  onChange={(e) => updateStatusValue(selectedOrder.id, e.target.value)}
                  className="text-[12px] font-bold bg-[#2D4B3E] text-white rounded-lg px-4 py-1.5 outline-none shadow-sm"
                >
                  {getStatusOptions().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => updateArchiveStatus(selectedOrder.id, selectedOrder.order_data?.status !== 'completed')} 
                  className={`flex items-center gap-2 px-4 py-2 text-[12px] font-bold rounded-xl transition-all shadow-sm ${selectedOrder.order_data?.status === 'completed' ? 'bg-white border border-[#EAEAEA] text-[#555555]' : 'bg-[#2D4B3E] text-white'}`}
                >
                  {selectedOrder.order_data?.status === 'completed' ? <RotateCcw size={16}/> : <Archive size={16}/>}
                  {selectedOrder.order_data?.status === 'completed' ? '未完了に戻す' : '完了としてアーカイブ'}
                </button>
                <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555555] font-bold hover:bg-[#EAEAEA]">✕</button>
              </div>
            </div>
            {/* 以前の詳細コンテンツを継続 */}
            <div className="p-8 space-y-8 text-left">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-2">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><Calendar size={12}/> お届け・受取情報</p>
                  <p className="text-[16px] font-black text-[#2D4B3E]">{selectedOrder.order_data.selectedDate} {selectedOrder.order_data.selectedTime}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-2">
                  <p className="text-[10px] font-bold text-[#999999] uppercase tracking-widest flex items-center gap-2"><User size={12}/> ご注文者様</p>
                  <p className="font-bold text-[15px]">{selectedOrder.order_data.customerInfo?.name} 様</p>
                </div>
              </div>
              {/* 以下、立札等のセクションが続きます... */}
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