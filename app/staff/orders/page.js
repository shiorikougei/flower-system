'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase'; // ★ パス階層を修正
import { 
  MapPin, Calendar, ChevronRight, X, Clock, Truck, Store, Package, 
  CreditCard, MessageSquare, AlertCircle, ListChecks, User, Tag, 
  Printer, FileText, Send, Trash2
} from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('未完了'); // '未完了' or 'アーカイブ'
  const [selectedOrder, setSelectedOrder] = useState(null); // モーダル用
  const [appSettings, setAppSettings] = useState(null);

  // ★ 新規: ログイン中のテナントIDを保持する
  const [currentTenantId, setCurrentTenantId] = useState(null);

  // ★ キャッシュ対応＆SaaS仕様のデータ取得ロジック
  useEffect(() => {
    async function initData() {
      try {
        // 1. ログインチェック
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = '/staff/login';
          return;
        }

        // 2. プロフィールからテナントIDを取得
        const { data: profile, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (profileError) throw profileError;
        
        const tId = profile.tenant_id;
        setCurrentTenantId(tId);

        // テナント専用のキャッシュキーを生成
        const CACHE_KEY_ORDERS = `florix_orders_cache_${tId}`;
        const CACHE_KEY_SETTINGS = `florix_settings_cache_${tId}`;

        // 3. まずは sessionStorage (キャッシュ) から復元して高速表示
        const cachedOrders = sessionStorage.getItem(CACHE_KEY_ORDERS);
        const cachedSettings = sessionStorage.getItem(CACHE_KEY_SETTINGS);

        if (cachedOrders) {
          try {
            setOrders(JSON.parse(cachedOrders));
            setIsLoading(false); // キャッシュがあれば即座にローディング解除
          } catch (e) {
            console.error("注文キャッシュのパース失敗", e);
          }
        }
        if (cachedSettings) {
          try {
            setAppSettings(JSON.parse(cachedSettings));
          } catch (e) {
            console.error("設定キャッシュのパース失敗", e);
          }
        }

        // 4. バックグラウンドで最新データを一括取得 (RLSにより自動的に自店舗のデータのみ取得される)
        const [ordersRes, settingsRes] = await Promise.all([
          supabase.from('orders').select('*').order('created_at', { ascending: false }),
          supabase.from('app_settings').select('settings_data').eq('id', tId).single()
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (settingsRes.error && settingsRes.error.code !== 'PGRST116') throw settingsRes.error;

        // 最新の注文データをセット＆キャッシュ更新
        if (ordersRes.data) {
          setOrders(ordersRes.data);
          sessionStorage.setItem(CACHE_KEY_ORDERS, JSON.stringify(ordersRes.data));
        }
        
        // 最新の設定データをセット＆キャッシュ更新
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

  // ステータス更新処理
  const updateOrderStatus = async (id, newStatus) => {
    try {
      const targetOrder = orders.find(o => o.id === id);
      if (!targetOrder) return;
      
      const updatedData = { ...(targetOrder.order_data || {}), status: newStatus };
      
      const { error } = await supabase.from('orders').update({ order_data: updatedData }).eq('id', id);
      if (error) throw error;

      // Stateを更新
      const newOrders = orders.map(o => o.id === id ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      
      // ★ 変更をキャッシュにも即座に同期
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder({ ...selectedOrder, order_data: updatedData });
      }
    } catch (error) {
      alert('ステータスの更新に失敗しました');
    }
  };

  // ★ 注文の削除処理
  const handleDeleteOrder = async (id) => {
    const inputPass = prompt('この注文を削除しますか？\n実行するには管理者パスワードを入力してください。');
    if (inputPass === null) return; // キャンセル時

    // 設定からパスワードを取得（未設定時は初期値 '7777'）
    const systemPass = appSettings?.generalConfig?.systemPassword || '7777';

    if (inputPass !== systemPass) {
      alert('パスワードが違います。');
      return;
    }

    if (!confirm('本当に削除してもよろしいですか？\nこの操作は取り消せません。')) return;

    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;

      // 画面とキャッシュから削除
      const newOrders = orders.filter(o => o.id !== id);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));
      setSelectedOrder(null); // モーダルを閉じる
      alert('注文を削除しました。');
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました。');
    }
  };

  // 表示用のフィルタリング（安全に）
  const filteredOrders = orders.filter(order => {
    const status = order?.order_data?.status || 'new';
    if (filterMode === '未完了') {
      return status !== '完了' && status !== 'キャンセル';
    } else {
      return status === '完了' || status === 'キャンセル';
    }
  });

  // 安全な日付フォーマット
  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '日時不明';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '日時不明';
      return withTime ? d.toLocaleString('ja-JP') : d.toLocaleDateString('ja-JP');
    } catch (e) {
      return '日時不明';
    }
  };

  // カスタムステータスの取得
  const getCustomLabels = () => {
    const labels = appSettings?.statusConfig?.customLabels;
    return Array.isArray(labels) ? labels : ['制作中', '制作完了', '配達中'];
  };

  // 受取方法のデザインバッジ取得（色分け）
  const getReceiveMethodBadge = (method) => {
    switch (method) {
      case 'pickup': return <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-orange-200"><Store size={14}/> 店頭受取</span>;
      case 'delivery': return <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-blue-200"><Truck size={14}/> 自社配達</span>;
      case 'sagawa': return <span className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-green-200"><Package size={14}/> 業者配送</span>;
      default: return <span className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-sm border border-gray-200">未定</span>;
    }
  };

  // 📍 Googleマップ用URL生成
  const getGoogleMapsUrl = (info) => {
    try {
      if (!info) return '#';
      const address = `${info.address1 || ''} ${info.address2 || ''}`.trim();
      if (!address) return '#';
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    } catch (e) {
      return '#';
    }
  };

  // 料金計算ロジック
  const getTotals = (orderData) => {
    if (!orderData || typeof orderData !== 'object') return { item: 0, fee: 0, pickup: 0, subTotal: 0, tax: 0, total: 0 };
    const item = Number(orderData.itemPrice) || 0;
    const fee = Number(orderData.calculatedFee) || 0;
    const pickup = Number(orderData.pickupFee) || 0;
    const subTotal = item + fee + pickup;
    const tax = Math.floor(subTotal * 0.1);
    return { item, fee, pickup, subTotal, tax, total: subTotal + tax };
  };

  // モーダル用の安全なデータ取得
  const modalData = selectedOrder?.order_data || {};
  const modalTargetInfo = modalData.isRecipientDifferent ? (modalData.recipientInfo || {}) : (modalData.customerInfo || {});

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-32">
      {/* --- ヘッダー領域 --- */}
      <div className="bg-white border-b border-[#EAEAEA] sticky top-0 z-30 px-6 py-4 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-[20px] font-black text-[#2D4B3E] tracking-widest">受注一覧</h1>
          
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
          <div className="text-center py-20 bg-white rounded-[24px] border border-dashed border-[#EAEAEA] text-[#999999] font-bold">
            表示する注文データがありません。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredOrders.map(order => {
              const d = order?.order_data || {};
              return (
                <div 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white p-5 md:p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm hover:shadow-md hover:border-[#2D4B3E]/30 cursor-pointer transition-all flex flex-col md:flex-row md:items-center gap-4 group"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-white bg-[#2D4B3E] px-3 py-1.5 rounded-lg tracking-wider shadow-sm">
                        {safeFormatDate(order.created_at)} 受付
                      </span>
                      {getReceiveMethodBadge(d.receiveMethod)}

                      {/* 発送日バッジ */}
                      {d.receiveMethod === 'sagawa' && d.shippingDate && (
                        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-green-200 shadow-sm">
                          <Package size={12}/> 発送日: {d.shippingDate.split('-')[1]}/{d.shippingDate.split('-')[2]}
                        </span>
                      )}

                      <span className="text-[11px] font-bold text-[#555555] border border-[#EAEAEA] px-3 py-1.5 rounded-lg bg-[#FBFAF9] shadow-sm">
                        {d.status === 'new' ? '未対応' : (d.status || '未対応')}
                      </span>
                    </div>
                    <div className="text-[16px] md:text-[18px] font-black text-[#111111] group-hover:text-[#2D4B3E] transition-colors">
                      {d.customerInfo?.name || 'お名前未設定'} 様 <span className="text-[12px] text-[#999999] font-medium ml-2">({d.flowerType || '商品未設定'})</span>
                    </div>
                    <div className="text-[13px] font-bold text-[#D97C8F] flex items-center gap-1.5">
                      <Calendar size={16} /> 納品日: {d.selectedDate || '未指定'} {d.selectedTime && `(${d.selectedTime})`}
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end justify-between border-t md:border-t-0 md:border-l border-[#EAEAEA] pt-4 md:pt-0 md:pl-6">
                    <p className="text-[11px] text-[#999999] font-bold mb-1">合計金額(税込)</p>
                    <p className="text-[24px] font-black text-[#2D4B3E]">¥{getTotals(d).total.toLocaleString()}</p>
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

      {/* --- 詳細モーダル --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-[#111111]/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
          
          <div className="bg-[#FBFAF9] w-full max-w-[800px] max-h-[90vh] rounded-[32px] shadow-2xl relative flex flex-col overflow-hidden">
            
            {/* モーダルヘッダー */}
            <div className="bg-white border-b border-[#EAEAEA] p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 z-10">
              <div>
                <h2 className="text-[20px] font-black text-[#2D4B3E]">注文詳細</h2>
                <p className="text-[11px] text-[#999999] font-bold mt-1">受付日: {safeFormatDate(selectedOrder.created_at, true)} | ID: {selectedOrder.id}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">
                  <Printer size={14} /> 印刷
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">
                  <FileText size={14} /> PDF
                </button>
                {modalData.customerInfo?.email && (
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-[#2D4B3E] text-white rounded-xl text-[11px] font-bold hover:bg-[#1f352b] transition-all shadow-md">
                    <Send size={14} /> メール
                  </button>
                )}
                {/* ★ 削除ボタンを追加 */}
                <button 
                  onClick={() => handleDeleteOrder(selectedOrder.id)} 
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-[11px] font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm ml-1"
                >
                  <Trash2 size={14} /> 削除
                </button>

                <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 ml-1 bg-[#FBFAF9] rounded-full flex items-center justify-center text-[#999999] hover:text-[#111111] transition-colors border border-[#EAEAEA] hover:bg-[#EAEAEA]">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* モーダルコンテンツ (スクロール) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">
              
              {/* ステータス変更 */}
              <div className="bg-white p-5 rounded-[24px] border border-[#EAEAEA] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-[13px] font-bold text-[#555555] flex items-center gap-2"><ListChecks size={18}/> 現在のステータス</span>
                <select 
                  value={modalData.status || 'new'} 
                  onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                  className="h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold text-[#2D4B3E] outline-none focus:border-[#2D4B3E] min-w-[200px] shadow-inner cursor-pointer"
                >
                  <option value="new">未対応 (新規)</option>
                  {getCustomLabels().map(l => <option key={l} value={l}>{l}</option>)}
                  <option value="完了">完了</option>
                  <option value="キャンセル">キャンセル</option>
                </select>
              </div>

              {/* 巨大な発送日パネル（業者配送の場合） */}
              {modalData.receiveMethod === 'sagawa' ? (
                <div className="bg-green-50 border-2 border-green-200 p-6 md:p-8 rounded-[24px] flex flex-col md:flex-row items-center gap-6 justify-center text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-bl-[64px] -mr-4 -mt-4"></div>
                  
                  <div className="space-y-1 relative z-10">
                    <span className="text-[12px] font-bold text-green-700 tracking-widest bg-white/50 px-3 py-1 rounded-full">【箱詰め・集荷】発送予定日</span>
                    <p className="text-[28px] md:text-[36px] font-black text-green-900 flex items-center justify-center gap-2 pt-2">
                      <Package size={24} className="text-green-600"/> 
                      {modalData.shippingDate ? `${modalData.shippingDate.split('-')[1]}月${modalData.shippingDate.split('-')[2]}日` : '未設定'}
                    </p>
                  </div>
                  
                  <ChevronRight size={32} className="hidden md:block text-green-300 relative z-10"/>
                  
                  <div className="space-y-1 relative z-10">
                    <span className="text-[12px] font-bold text-green-700 tracking-widest">お客様 お届け日</span>
                    <p className="text-[18px] md:text-[20px] font-bold text-green-800 flex items-center justify-center gap-2 pt-2">
                      <Calendar size={18} className="text-green-600"/> 
                      {modalData.selectedDate ? `${modalData.selectedDate.split('-')[1]}月${modalData.selectedDate.split('-')[2]}日` : '未指定'}
                    </p>
                    <p className="text-[12px] font-bold text-green-700">{modalData.selectedTime || '時間指定なし'}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#FBFAF9] border border-[#EAEAEA] p-6 rounded-[24px] flex flex-col items-center justify-center text-center shadow-inner">
                   <span className="text-[12px] font-bold text-[#999999] tracking-widest mb-1">
                     {modalData.receiveMethod === 'pickup' ? 'ご来店予定日' : '配達予定日'}
                   </span>
                   <p className="text-[28px] font-black text-[#2D4B3E] flex items-center gap-2">
                     <Calendar size={24}/> {modalData.selectedDate ? `${modalData.selectedDate.split('-')[1]}月${modalData.selectedDate.split('-')[2]}日` : '未設定'}
                   </p>
                   <p className="text-[14px] font-bold text-[#D97C8F] mt-2">{modalData.selectedTime || '時間指定なし'}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 注文者情報 */}
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><User size={18}/> 注文者情報</h3>
                  <div className="space-y-4 text-[13px] bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                    <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">お名前</span><span className="font-black text-[16px]">{modalData.customerInfo?.name || '未設定'} 様</span></p>
                    <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">電話番号</span><span className="font-bold text-[14px]">{modalData.customerInfo?.phone || '未設定'}</span></p>
                    {modalData.customerInfo?.email && <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">メール</span><span className="font-bold text-[#4285F4]">{modalData.customerInfo?.email}</span></p>}
                  </div>
                </div>

                {/* お届け先情報 ＆ Googleマップ */}
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><MapPin size={18}/> お届け先情報</h3>
                  <div className="space-y-3 text-[13px]">
                    <div className="flex gap-2 items-center mb-4 bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA]">
                      {getReceiveMethodBadge(modalData.receiveMethod)}
                    </div>
                    
                    {modalData.receiveMethod === 'pickup' ? (
                      <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                        <p><span className="text-[#999999] text-[10px] block mb-1 tracking-widest">受取店舗</span><span className="font-black text-[16px] text-[#2D4B3E]">{modalData.selectedShop || '未指定'}</span></p>
                      </div>
                    ) : (
                      <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA] space-y-3 relative overflow-hidden">
                        {modalData.isRecipientDifferent && <div className="absolute top-0 right-0 bg-[#2D4B3E] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">注文者と別住所</div>}
                        <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">宛名</span><span className="font-black text-[16px]">{modalTargetInfo?.name || '未設定'} 様</span></p>
                        <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">お届け先住所</span><span className="font-bold text-[14px] block leading-relaxed">〒{modalTargetInfo?.zip}<br/>{modalTargetInfo?.address1} {modalTargetInfo?.address2}</span></p>
                        
                        {/* 📍 Googleマップボタン */}
                        <a 
                          href={getGoogleMapsUrl(modalTargetInfo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-3 text-[12px] font-bold text-white bg-[#4285F4] px-4 py-2.5 rounded-xl hover:bg-[#3367D6] transition-all shadow-md active:scale-95 w-full justify-center"
                        >
                          <MapPin size={16} /> Googleマップで場所を確認
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 置き配設定 */}
              {(modalData.receiveMethod === 'delivery' || modalData.receiveMethod === 'sagawa') && (
                <div className="bg-orange-50 p-6 rounded-[24px] border border-orange-200 shadow-sm space-y-2">
                  <h3 className="text-[12px] font-bold text-orange-800 flex items-center gap-2"><AlertCircle size={16}/> ご不在時の対応</h3>
                  <p className="text-[15px] font-black text-orange-900">
                    {modalData.absenceAction === '置き配' ? `置き配希望: ${modalData.absenceNote}` : '持ち戻り (再配達)'}
                  </p>
                </div>
              )}

              {/* 商品とデザイン詳細 */}
              <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><Tag size={18}/> オーダー内容</h3>
                <div className="flex flex-col sm:flex-row gap-6">
                  {modalData.referenceImage ? (
                    <img src={modalData.referenceImage} alt="参考" className="w-32 h-32 object-cover rounded-2xl border border-[#EAEAEA] shadow-sm shrink-0" />
                  ) : (
                    <div className="w-32 h-32 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl flex items-center justify-center text-[#999999] text-[11px] font-bold shrink-0">画像なし</div>
                  )}
                  <div className="flex-1 grid grid-cols-2 gap-4 text-[13px]">
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">お花の種類</span><span className="font-black text-[#2D4B3E] text-[14px]">{modalData.flowerType || '未設定'}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">用途</span><span className="font-bold">{modalData.flowerPurpose} {modalData.otherPurpose && `(${modalData.otherPurpose})`}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">カラー</span><span className="font-bold">{modalData.flowerColor}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">イメージ</span><span className="font-bold">{modalData.flowerVibe} {modalData.otherVibe && `(${modalData.otherVibe})`}</span></div>
                  </div>
                </div>
              </div>

              {/* メッセージ・立札 */}
              {modalData.cardType !== 'なし' && (
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><MessageSquare size={18}/> {modalData.cardType}の内容</h3>
                  
                  {modalData.cardType === 'メッセージカード' && (
                    <div className="bg-[#FBFAF9] p-6 rounded-2xl text-[14px] font-bold whitespace-pre-wrap border border-[#EAEAEA] text-[#333333] leading-relaxed">
                      {modalData.cardMessage}
                    </div>
                  )}

                  {modalData.cardType === '立札' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] bg-[#FBFAF9] p-6 rounded-2xl border border-[#EAEAEA]">
                      {modalData.tateInput1 && <p><span className="text-[#999999] text-[10px] block tracking-widest mb-0.5">① 内容</span><span className="font-black text-[15px]">{modalData.tateInput1}</span></p>}
                      {modalData.tateInput2 && <p><span className="text-[#999999] text-[10px] block tracking-widest mb-0.5">② 宛名</span><span className="font-black text-[15px]">{modalData.tateInput2} 様</span></p>}
                      {modalData.tateInput3 && <p><span className="text-[#999999] text-[10px] block tracking-widest mb-0.5">③ 贈り主</span><span className="font-black text-[15px]">{modalData.tateInput3}</span></p>}
                      {modalData.tateInput3a && <p><span className="text-[#999999] text-[10px] block tracking-widest mb-0.5">③-1 会社名</span><span className="font-black text-[15px]">{modalData.tateInput3a}</span></p>}
                      {modalData.tateInput3b && <p><span className="text-[#999999] text-[10px] block tracking-widest mb-0.5">③-2 役職・氏名</span><span className="font-black text-[15px]">{modalData.tateInput3b}</span></p>}
                    </div>
                  )}
                </div>
              )}

              {/* お支払い内訳 */}
              <div className="bg-white p-8 rounded-[32px] border-2 border-[#2D4B3E]/20 shadow-md space-y-6">
                <h3 className="text-[16px] font-black text-[#2D4B3E] border-b border-[#EAEAEA] pb-3 flex items-center gap-2"><CreditCard size={20}/> お支払い情報</h3>
                <div className="space-y-3 text-[14px] font-medium text-[#555555]">
                  <div className="flex justify-between items-center"><span>商品代 (税抜):</span><span className="font-black text-[#111111] text-[16px]">¥{getTotals(modalData).item.toLocaleString()}</span></div>
                  {getTotals(modalData).fee > 0 && <div className="flex justify-between items-center text-blue-600"><span>配送料 (箱・クール含):</span><span className="font-bold text-[16px]">¥{getTotals(modalData).fee.toLocaleString()}</span></div>}
                  {getTotals(modalData).pickup > 0 && <div className="flex justify-between items-center text-orange-600"><span>器回収・返却費:</span><span className="font-bold text-[16px]">¥{getTotals(modalData).pickup.toLocaleString()}</span></div>}
                  <div className="flex justify-between items-center border-t border-[#EAEAEA] pt-3 text-[#2D4B3E]"><span>消費税 (10%):</span><span className="font-bold text-[16px]">¥{getTotals(modalData).tax.toLocaleString()}</span></div>
                  
                  <div className="flex justify-between border-t-2 border-[#2D4B3E]/20 pt-4 mt-2 items-end">
                    <span className="text-[13px] font-bold text-[#2D4B3E] tracking-widest mb-1">合計金額 (税込)</span>
                    <span className="text-[36px] font-black text-[#2D4B3E] leading-none">¥{getTotals(modalData).total.toLocaleString()}</span>
                  </div>
                </div>
                {modalData.paymentMethod && (
                  <div className="pt-4 flex justify-end border-t border-[#EAEAEA]">
                    <span className="inline-block bg-[#2D4B3E]/10 text-[#2D4B3E] px-4 py-2 rounded-xl text-[13px] font-bold border border-[#2D4B3E]/20 shadow-sm">
                      支払方法: {modalData.paymentMethod}
                    </span>
                  </div>
                )}
              </div>

              {/* メモ */}
              {modalData.note && (
                <div className="bg-yellow-50 p-6 rounded-[24px] border border-yellow-200 shadow-sm">
                  <h3 className="text-[12px] font-bold text-yellow-800 mb-2 tracking-widest flex items-center gap-2">社内メモ / お客様要望</h3>
                  <p className="text-[14px] font-bold text-yellow-900 whitespace-pre-wrap leading-relaxed">{modalData.note}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}