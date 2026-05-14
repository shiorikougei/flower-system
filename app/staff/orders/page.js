'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Calendar, ChevronRight, Truck, Store, Package, AlertCircle, CheckCircle2
} from 'lucide-react';
import OrderDetailModal from '@/components/OrderDetailModal';
import { logAction } from '@/utils/auditLog';
import HelpTooltip from '@/components/HelpTooltip';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('未完了'); 
  const [selectedOrder, setSelectedOrder] = useState(null); 
  const [appSettings, setAppSettings] = useState(null);
  const [currentTenantId, setCurrentTenantId] = useState(null);

  useEffect(() => {
    async function initData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = '/staff/login';
          return;
        }

        const { data: profile, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (profileError) throw profileError;
        
        const tId = profile.tenant_id;
        setCurrentTenantId(tId);

        const CACHE_KEY_ORDERS = `florix_orders_cache_${tId}`;
        const CACHE_KEY_SETTINGS = `florix_settings_cache_${tId}`;

        const cachedOrders = sessionStorage.getItem(CACHE_KEY_ORDERS);
        const cachedSettings = sessionStorage.getItem(CACHE_KEY_SETTINGS);

        if (cachedOrders) {
          try {
            setOrders(JSON.parse(cachedOrders));
            setIsLoading(false); 
          } catch (e) {}
        }
        if (cachedSettings) {
          try {
            setAppSettings(JSON.parse(cachedSettings));
          } catch (e) {}
        }

        const [ordersRes, settingsRes] = await Promise.all([
          // ★ セキュリティ修正: tenant_id でフィルタ
          supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false }),
          supabase.from('app_settings').select('settings_data').eq('id', tId).single()
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;

        if (ordersRes.data) {
          setOrders(ordersRes.data);
          sessionStorage.setItem(CACHE_KEY_ORDERS, JSON.stringify(ordersRes.data));
        }
        
        if (settingsRes.data?.settings_data) {
          setAppSettings(settingsRes.data.settings_data);
          sessionStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(settingsRes.data.settings_data));
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
      } finally {
        setIsLoading(false);
      }
    }

    initData();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus, staffName) => {
    if (!staffName) {
      alert('ステータスを更新する担当スタッフを選択してください。');
      return;
    }
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const currentHistory = targetOrder.order_data.statusHistory || [];
      
      const newHistoryEntry = {
        status: newStatus,
        staff: staffName,
        date: new Date().toISOString()
      };

      const updatedData = { 
        ...targetOrder.order_data, 
        currentStatus: newStatus, 
        status: newStatus,
        statusHistory: [newHistoryEntry, ...currentHistory]
      };
      
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);

      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      setSelectedOrder({ ...targetOrder, order_data: updatedData });
      // ★ 操作履歴記録
      logAction({ action: 'order_status_change', targetType: 'order', targetId: orderId, description: `ステータスを「${newStatus}」に変更` });
    } catch (err) {
      alert('更新に失敗しました。');
    }
  };

  // ★ 新規追加：入金ステータス更新処理
  //   opts.skipConfirm: 確認ダイアログをスキップ（モーダル経由で確認済みの場合）
  //   opts.alreadyUpdated: currentData が既に最新（モーダル側でDB更新済み）
  const handleUpdatePayment = async (orderId, currentData, opts = {}) => {
    if (!opts.skipConfirm) {
      if (!confirm('この注文を「入金済」として処理しますか？')) return;
    }
    try {
      let updatedData;
      if (opts.alreadyUpdated) {
        // モーダル経由：DB更新済みなのでローカル反映だけ
        updatedData = currentData;
      } else {
        const oldStatus = currentData.paymentStatus || '';
        let newStatus = '入金済';
        if (oldStatus.includes('引き取り時')) {
          newStatus = '入金済（引き取り時受領）';
        }
        updatedData = { ...currentData, paymentStatus: newStatus };
        // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
        await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);
      }

      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      setSelectedOrder(prev => ({ ...prev, order_data: updatedData }));
      if (!opts.skipConfirm) alert('入金済みに更新しました！');
      // ★ 操作履歴記録
      logAction({ action: 'order_payment_confirm', targetType: 'order', targetId: orderId, description: '入金済みに更新' });
    } catch (error) {
      console.error(error);
      alert('更新に失敗しました。');
    }
  };

  const handleArchive = async (orderId, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'new';
    if (!confirm(`この注文を${isArchive ? '完了' : '未完了'}にしますか？`)) return;
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, status: newStatus };
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);

      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      setSelectedOrder(null);
      // ★ 操作履歴記録
      logAction({ action: 'order_archive', targetType: 'order', targetId: orderId, description: isArchive ? '注文を完了' : '注文を未完了に戻す' });
    } catch (err) { alert('更新失敗'); }
  };

  const handleDelete = async (orderId) => {
    const inputPass = prompt('この注文を削除しますか？\n実行するには管理者パスワードを入力してください。');
    if (inputPass === null) return; 

    const systemPass = appSettings?.generalConfig?.systemPassword || '7777';

    if (inputPass !== systemPass) {
      alert('パスワードが違います。');
      return;
    }

    if (!confirm('本当に削除してもよろしいですか？\nこの操作は取り消せません。')) return;

    try {
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      const { error } = await supabase.from('orders').delete().eq('id', orderId).eq('tenant_id', currentTenantId);
      if (error) throw error;

      const newOrders = orders.filter(o => o.id !== orderId);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));
      setSelectedOrder(null);
      alert('注文を削除しました。');
      // ★ 操作履歴記録（重要な削除操作）
      logAction({ action: 'order_delete', targetType: 'order', targetId: orderId, description: '注文を削除' });
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました。');
    }
  };

  const filteredOrders = orders.filter(order => {
    const status = order?.order_data?.status || 'new';
    if (filterMode === '未完了') {
      return status !== 'completed' && status !== '完了' && status !== 'キャンセル';
    } else {
      return status === 'completed' || status === '完了' || status === 'キャンセル';
    }
  });

  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '日時不明';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '日時不明';
      return withTime ? d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ja-JP');
    } catch (e) {
      return '日時不明';
    }
  };

  const getReceiveMethodBadge = (method) => {
    switch (method) {
      case 'pickup': return <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-orange-200"><Store size={14}/> 店頭受取</span>;
      case 'delivery': return <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-blue-200"><Truck size={14}/> 自社配達</span>;
      case 'sagawa': return <span className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-green-200"><Package size={14}/> 業者配送</span>;
      default: return <span className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-gray-200">未定</span>;
    }
  };

  const getTotals = (orderData) => {
    if (!orderData || typeof orderData !== 'object') return { item: 0, fee: 0, pickup: 0, subTotal: 0, tax: 0, total: 0 };
    const item = Number(orderData.itemPrice) || 0;
    const fee = Number(orderData.calculatedFee) || 0;
    const pickup = Number(orderData.pickupFee) || 0;
    const subTotal = item + fee + pickup;
    const tax = Math.floor(subTotal * 0.1);
    return { item, fee, pickup, subTotal, tax, total: subTotal + tax };
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-32">
      <div className="bg-white border-b border-[#EAEAEA] sticky top-0 z-30 px-6 py-4 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-[20px] font-bold text-[#2D4B3E] flex items-center gap-2">受注一覧 <HelpTooltip articleId="order_status"/> <HelpTooltip articleId="order_payment" size={14}/></h1>
          
          <div className="flex bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] w-fit">
            <button 
              onClick={() => setFilterMode('未完了')} 
              className={`px-6 py-2 rounded-lg text-[12px] font-bold transition-all ${filterMode === '未完了' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}
            >
              未完了
            </button>
            <button 
              onClick={() => setFilterMode('アーカイブ')} 
              className={`px-6 py-2 rounded-lg text-[12px] font-bold transition-all ${filterMode === 'アーカイブ' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}
            >
              アーカイブ
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto p-6 space-y-4 pt-8">
        {isLoading ? (
          <div className="text-center py-20 text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#EAEAEA] text-[#999999] font-bold">
            表示する注文データがありません。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredOrders.map(order => {
              const d = order?.order_data || {};
              // ★ Stripe決済反映: DB の payment_status='paid' (Webhookで自動更新) を優先
              const isPaidByCard = order?.payment_status === 'paid';
              const isUnpaid = !isPaidByCard && (!d.paymentStatus || d.paymentStatus.includes('未') || d.paymentStatus === '');
              const displayStatus = (isPaidByCard && (!d.paymentStatus || d.paymentStatus.includes('未')))
                ? '入金済（クレジットカード）'
                : (d.paymentStatus || '未設定');

              return (
                <div 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white p-5 md:p-6 rounded-2xl border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 cursor-pointer transition-all flex flex-col md:flex-row md:items-center gap-4 group"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-white bg-[#2D4B3E] px-3 py-1.5 rounded-lg tracking-wider shadow-sm">
                        {safeFormatDate(order.created_at)} 受付
                      </span>
                      {getReceiveMethodBadge(d.receiveMethod)}

                      {d.receiveMethod === 'sagawa' && d.shippingDate && (
                        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-green-200 shadow-sm">
                          <Package size={12}/> 発送日: {d.shippingDate.split('-')[1]}/{d.shippingDate.split('-')[2]}
                        </span>
                      )}

                      <span className="text-[11px] font-bold text-[#555555] border border-[#EAEAEA] px-3 py-1.5 rounded-lg bg-[#FBFAF9] shadow-sm">
                        {d.status === 'new' ? '未対応' : (d.status || '未対応')}
                      </span>
                      
                      {/* ★ 入金ステータスバッジ（クレカ決済はDBカラムを優先） */}
                      {isUnpaid ? (
                        <span className="text-[10px] font-bold bg-[#D97D54]/10 text-[#D97D54] px-2 py-1 rounded border border-[#D97D54]/20 flex items-center gap-1">
                          <AlertCircle size={12}/> {displayStatus}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1">
                          <CheckCircle2 size={12}/> {displayStatus}
                        </span>
                      )}

                      {/* ★ EC注文の場合のバッジ */}
                      {d.orderType === 'ec' && (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded flex items-center gap-1">
                          🛒 EC注文
                        </span>
                      )}
                    </div>
                    <div className="text-[16px] md:text-[18px] font-bold text-[#111111] group-hover:text-[#2D4B3E] transition-colors">
                      {d.customerInfo?.name || 'お名前未設定'} 様
                      <span className="text-[12px] text-[#999999] font-medium ml-2">
                        ({d.orderType === 'ec' && Array.isArray(d.cartItems) && d.cartItems.length > 0
                          ? `${d.cartItems[0].name}${d.cartItems.length > 1 ? ` ほか${d.cartItems.length - 1}点` : ''}`
                          : (d.flowerType || '商品未設定')})
                      </span>
                    </div>
                    <div className="text-[13px] font-bold text-[#D97D54] flex items-center gap-1.5">
                      <Calendar size={16} /> 納品日: {d.selectedDate || '未指定'} {d.selectedTime && `(${d.selectedTime})`}
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end justify-between border-t md:border-t-0 md:border-l border-[#EAEAEA] pt-4 md:pt-0 md:pl-6">
                    <p className="text-[11px] text-[#999999] font-bold mb-1">合計金額(税込)</p>
                    <p className="text-[24px] font-bold text-[#2D4B3E]">¥{getTotals(d).total.toLocaleString()}</p>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 group-hover:bg-blue-500 group-hover:text-white transition-all">
                      詳細を見る <ChevronRight size={14}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ★ onUpdatePayment を新たに追加！ */}
      <OrderDetailModal 
        order={selectedOrder} 
        appSettings={appSettings} 
        onClose={() => setSelectedOrder(null)} 
        onUpdateStatus={handleUpdateStatus} 
        onUpdatePayment={handleUpdatePayment} 
        onArchive={handleArchive} 
        onDelete={handleDelete} 
      />

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}