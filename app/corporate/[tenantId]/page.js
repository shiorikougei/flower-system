'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { 
  Building2, Calendar, ShoppingBag, FileText, 
  ChevronRight, Plus, CreditCard, LogOut, Gift, ArrowRight, Download, Package,
  MapPin, Clock, Truck, Store, MessageSquare, AlertCircle, User, Tag, ListChecks, X, Trash2, RefreshCw, Zap, Repeat
} from 'lucide-react';
import Link from 'next/link';

export default function CorporateDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params?.tenantId || 'default';

  const CORPORATE_ORDERS_CACHE_KEY = `florix_corporate_orders_cache_${tenantId}`;
  const SETTINGS_CACHE_KEY = `florix_app_settings_cache_${tenantId}`;

  const [isLoading, setIsLoading] = useState(true);
  
  // ★ デモ用の会社名をリセット（本来はログイン時の情報から取得します）
  const [companyName, setCompanyName] = useState('ゲスト法人'); 
  const [appSettings, setAppSettings] = useState(null);

  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // ★ 架空の請求データをリセット（最初は未入金なし）
  const [billingInfo, setBillingInfo] = useState({
    hasUnpaid: false,
    unpaidMonth: '',
    unpaidAmount: 0,
    dueDate: '',
    currentMonthAmount: 0
  });

  // ★ 架空の行事データをリセット（最初は空っぽ）
  const [events, setEvents] = useState([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', target: '', repeat: '今年のみ', zip: '', address1: '', address2: '' });

  const [omakaseModal, setOmakaseModal] = useState({ isOpen: false, event: null, flowerType: '', budget: '' });

  useEffect(() => {
    async function initData() {
      const cachedOrders = sessionStorage.getItem(CORPORATE_ORDERS_CACHE_KEY);
      const cachedSettings = sessionStorage.getItem(SETTINGS_CACHE_KEY);
      
      if (cachedOrders) {
        try { setOrders(JSON.parse(cachedOrders)); } catch (e) {}
      }
      if (cachedSettings) {
        try { setAppSettings(JSON.parse(cachedSettings)); } catch (e) {}
      }
      if (cachedOrders && cachedSettings) {
        setIsLoading(false);
      }

      try {
        const [ordersRes, settingsRes] = await Promise.all([
          supabase.from('orders').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
          supabase.from('app_settings').select('settings_data').eq('id', tenantId).single()
        ]);

        if (ordersRes.data) {
          setOrders(ordersRes.data);
          sessionStorage.setItem(CORPORATE_ORDERS_CACHE_KEY, JSON.stringify(ordersRes.data));
        }
        if (settingsRes.data?.settings_data) {
          setAppSettings(settingsRes.data.settings_data);
          sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settingsRes.data.settings_data));
        }
      } catch (error) {
        console.error('データ取得に失敗しました', error);
      } finally {
        setIsLoading(false);
      }
    }
    initData();
  }, [tenantId]);

  const handleLogout = async () => {
    router.push(`/corporate/login`); 
  };

  const fetchAddress = async (zip) => {
    if (zip.length !== 7) return;
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      const data = await res.json();
      if (data.results) {
        const fullAddr = `${data.results[0].address1}${data.results[0].address2}${data.results[0].address3}`;
        setNewEvent(prev => ({ ...prev, address1: fullAddr }));
      }
    } catch (error) {}
  };

  const handleAddEvent = (e) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date) return;
    setEvents([...events, { id: Date.now(), ...newEvent, address: `${newEvent.address1} ${newEvent.address2}`.trim() }]);
    setNewEvent({ title: '', date: '', target: '', repeat: '今年のみ', zip: '', address1: '', address2: '' });
    setIsEventModalOpen(false);
  };

  const handleDeleteEvent = (id) => {
    if (confirm('この行事を削除してもよろしいですか？')) {
      setEvents(events.filter(ev => ev.id !== id));
    }
  };

  const handleQuickOrder = (type, event) => {
    if (type === 'repeat') {
      if (confirm(`前回と全く同じ内容（${event.lastOrder.item} / ¥${event.lastOrder.price.toLocaleString()}）で注文を確定しますか？`)) {
        alert('注文が完了しました！\n※実際のシステムではここでバックエンドに送信されます');
      }
    } else if (type === 'omakase') {
      setOmakaseModal({ isOpen: true, event: event, flowerType: '', budget: '' });
    }
  };

  const submitOmakaseOrder = (e) => {
    e.preventDefault();
    alert(`【${omakaseModal.event.title}】\n種類: ${omakaseModal.flowerType}\nご予算: ¥${Number(omakaseModal.budget).toLocaleString()}\nでおまかせ注文を承りました！`);
    setOmakaseModal({ isOpen: false, event: null, flowerType: '', budget: '' });
  };

  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '日時不明';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '日時不明';
      return withTime ? d.toLocaleString('ja-JP') : d.toLocaleDateString('ja-JP');
    } catch (e) { return '日時不明'; }
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

  const modalData = selectedOrder?.order_data || {};
  const modalTargetInfo = modalData.isRecipientDifferent ? (modalData.recipientInfo || {}) : (modalData.customerInfo || {});

  const shopName = appSettings?.generalConfig?.appName || 'FLORIX';

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-serif italic text-[20px] font-black tracking-tight text-[#2D4B3E]">{shopName}</span>
          <span className="hidden sm:inline-block w-[1px] h-4 bg-[#EAEAEA]"></span>
          <span className="hidden sm:inline-block text-[11px] font-bold tracking-widest text-[#999999] uppercase">Corporate Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#555555]">
            <Building2 size={16} className="text-[#2D4B3E]" />
            <span className="hidden sm:inline-block">{companyName} 様</span>
          </div>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FBFAF9] border border-[#EAEAEA] text-[#999999] hover:text-[#111111] hover:bg-[#EAEAEA] transition-all">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto p-6 md:p-8 space-y-8 pt-8">

        {/* 未入金アラートバナー */}
        {billingInfo.hasUnpaid && (
          <div className="bg-red-50 border border-red-200 p-5 rounded-[24px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={24} />
              <div>
                <p className="text-[15px] font-black text-red-800">未入金の請求書があります</p>
                <p className="text-[12px] font-bold text-red-600 mt-1">{billingInfo.unpaidMonth}ご利用分 (¥{billingInfo.unpaidAmount.toLocaleString()}) のお支払いが確認できておりません。至急ご確認をお願いいたします。</p>
              </div>
            </div>
            <button className="shrink-0 flex items-center justify-center gap-2 text-[12px] font-bold text-white bg-red-500 px-5 py-2.5 rounded-xl hover:bg-red-600 transition-all shadow-sm">
              <Download size={16}/> 請求書をダウンロード
            </button>
          </div>
        )}
        
        {/* ウェルカム＆クイックアクション */}
        <div className="bg-[#2D4B3E] rounded-[32px] p-8 md:p-10 shadow-lg text-white relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute -right-20 -top-20 opacity-10 pointer-events-none">
            <Gift size={240} />
          </div>
          
          <div className="relative z-10 space-y-2">
            <h1 className="text-[24px] md:text-[28px] font-black tracking-tight leading-tight">
              いつもご利用ありがとうございます。<br />
              <span className="text-emerald-300">{companyName}</span> 様
            </h1>
            <p className="text-[13px] text-white/80 font-medium pt-2">
              ご請求書のダウンロードや、次回のお祝い花のオーダーをこちらから行えます。
            </p>
          </div>
          
          <div className="relative z-10 shrink-0">
            <Link 
              href={`/corporate/order/${tenantId}`} 
              className="group flex items-center justify-center gap-2 bg-white text-[#2D4B3E] px-8 py-4 rounded-2xl font-black text-[15px] shadow-xl hover:scale-105 transition-all active:scale-95"
            >
              <Plus size={20} />
              新しいお花を注文する
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform ml-1" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 space-y-8">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-black text-[#2D4B3E] flex items-center gap-2">
                  <ShoppingBag size={20} /> 最近のご注文履歴
                </h2>
              </div>

              {isLoading ? (
                <div className="text-center py-20 text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-[24px] border border-dashed border-[#EAEAEA] text-[#999999] font-bold">
                  ご注文履歴はありません。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {orders.slice(0, 5).map(order => {
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
                              {safeFormatDate(order.created_at)} 注文
                            </span>
                            {getReceiveMethodBadge(d.receiveMethod)}
                            <span className="text-[11px] font-bold text-[#555555] border border-[#EAEAEA] px-3 py-1.5 rounded-lg bg-[#FBFAF9] shadow-sm">
                              {d.status === 'new' ? '受付完了' : (d.status || '対応中')}
                            </span>
                          </div>
                          <div className="text-[16px] md:text-[18px] font-black text-[#111111] group-hover:text-[#2D4B3E] transition-colors">
                            {d.flowerType || '商品未設定'}
                          </div>
                          <div className="text-[13px] font-bold text-[#D97C8F] flex items-center gap-1.5">
                            <Calendar size={16} /> お届け: {d.selectedDate || '未指定'} {d.selectedTime && `(${d.selectedTime})`}
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
            </section>
          </div>

          <div className="space-y-8">
            <section className="bg-[#FBFAF9] p-6 rounded-[24px] border border-[#EAEAEA]">
              <h2 className="text-[13px] font-black text-[#555555] flex items-center gap-2 mb-4">
                <CreditCard size={16} /> 請求・お支払い情報
              </h2>
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-[11px] font-bold text-[#999999]">当月ご利用額</span>
                  <span className="text-[20px] font-black text-[#111111]">¥{orders.reduce((sum, o) => sum + getTotals(o.order_data).total, 0).toLocaleString()}</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-[11px] font-bold text-[#999999]">お支払い期限</span>
                  <span className="text-[13px] font-bold text-[#111111]">翌月末日</span>
                </div>
                <button 
                  onClick={() => alert('今月分の請求書PDFを生成してダウンロードします。')}
                  className="w-full mt-2 py-3 bg-white border border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#2D4B3E] hover:border-[#2D4B3E] transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <FileText size={16} /> 今月の請求書を発行する
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-black text-[#2D4B3E] flex items-center gap-2">
                  <Calendar size={20} /> 今後の行事・お祝い
                </h2>
                <button 
                  onClick={() => setIsEventModalOpen(true)}
                  className="text-[11px] font-bold bg-[#2D4B3E] text-white px-3 py-1.5 rounded-full hover:bg-[#1f352b] transition-all flex items-center gap-1 shadow-sm"
                >
                  <Plus size={14}/> 追加
                </button>
              </div>

              <div className="space-y-4">
                {events.length === 0 ? (
                  <div className="text-center p-6 bg-[#FBFAF9] border border-[#EAEAEA] rounded-[20px] text-[12px] font-bold text-[#999999]">登録されている行事はありません</div>
                ) : (
                  events.sort((a, b) => new Date(a.date) - new Date(b.date)).map(ev => (
                    <div key={ev.id} className="bg-white p-5 rounded-[20px] border border-[#EAEAEA] shadow-sm relative overflow-hidden group hover:border-[#D97C8F] transition-all">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#D97C8F]"></div>
                      
                      <div className="flex justify-between items-start pl-2">
                        <div className="space-y-2 w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold bg-[#D97C8F]/10 text-[#D97C8F] px-2 py-0.5 rounded font-mono">{ev.date}</span>
                            <span className="text-[10px] font-bold text-[#999999] bg-[#FBFAF9] px-2 py-0.5 rounded border border-[#EAEAEA] flex items-center gap-1">
                              {ev.repeat === '毎年' ? <RefreshCw size={10}/> : null} {ev.repeat}
                            </span>
                          </div>
                          <p className="text-[14px] font-black text-[#111111] leading-tight">{ev.title}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-bold text-[#555555]">{ev.target || '対象者なし'}</p>
                            <button onClick={() => handleDeleteEvent(ev.id)} className="text-[#EAEAEA] hover:text-red-500 transition-colors p-1"><Trash2 size={14}/></button>
                          </div>
                          {ev.address && (
                            <p className="text-[10px] font-bold text-[#999999] flex items-center gap-1 truncate"><MapPin size={10}/> {ev.address}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-[#F7F7F7] space-y-2 pl-2">
                        <p className="text-[10px] font-bold text-[#999999] mb-2 tracking-widest">この行事のご注文</p>
                        
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => handleQuickOrder('omakase', ev)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#2D4B3E] text-white rounded-xl text-[11px] font-bold hover:bg-[#1f352b] transition-all shadow-sm active:scale-[0.98]"
                          >
                            <Zap size={14}/> 種類と予算を決めておまかせ注文
                          </button>
                          
                          {ev.lastOrder ? (
                            <button 
                              onClick={() => handleQuickOrder('repeat', ev)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-[#EAEAEA] text-[#2D4B3E] rounded-xl text-[11px] font-bold hover:bg-[#F7F7F7] hover:border-[#2D4B3E]/30 transition-all active:scale-[0.98]"
                            >
                              <Repeat size={14}/> 前回と全く同じ内容で注文
                            </button>
                          ) : (
                            <Link href={`/corporate/order/${tenantId}`} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-[#EAEAEA] text-[#555555] rounded-xl text-[11px] font-bold hover:bg-[#F7F7F7] transition-all active:scale-[0.98]">
                              オーダーフォームを開く <ChevronRight size={12}/>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* --- 詳細モーダル (法人用) --- */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-[#111111]/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}></div>
          
          <div className="bg-[#FBFAF9] w-full max-w-[800px] max-h-[90vh] rounded-[32px] shadow-2xl relative flex flex-col overflow-hidden">
            
            <div className="bg-white border-b border-[#EAEAEA] p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 z-10">
              <div>
                <h2 className="text-[20px] font-black text-[#2D4B3E]">注文詳細</h2>
                <p className="text-[11px] text-[#999999] font-bold mt-1">注文日: {safeFormatDate(selectedOrder.created_at, true)} | 注文番号: {selectedOrder.id}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#2D4B3E] hover:border-[#2D4B3E] transition-all shadow-sm">
                  <Download size={14} /> 領収書・納品書 (PDF)
                </button>
                <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 ml-2 bg-[#FBFAF9] rounded-full flex items-center justify-center text-[#999999] hover:text-[#111111] transition-colors border border-[#EAEAEA] hover:bg-[#EAEAEA]">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">
              
              <div className="bg-white p-5 rounded-[24px] border border-[#EAEAEA] shadow-sm flex items-center justify-between gap-4">
                <span className="text-[13px] font-bold text-[#555555] flex items-center gap-2"><ListChecks size={18}/> 現在の状況</span>
                <span className="px-4 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[14px] font-bold text-[#2D4B3E]">
                  {modalData.status === 'new' ? '受付完了・手配中' : (modalData.status || '手配中')}
                </span>
              </div>

              {modalData.receiveMethod === 'sagawa' ? (
                <div className="bg-green-50 border border-green-200 p-6 md:p-8 rounded-[24px] flex flex-col md:flex-row items-center gap-6 justify-center text-center shadow-inner">
                  <div className="space-y-1">
                    <span className="text-[12px] font-bold text-green-700 tracking-widest bg-white/50 px-3 py-1 rounded-full">当店発送予定日</span>
                    <p className="text-[20px] font-black text-green-900 pt-2">
                      {modalData.shippingDate ? `${modalData.shippingDate.split('-')[1]}月${modalData.shippingDate.split('-')[2]}日` : '未設定'}
                    </p>
                  </div>
                  <ChevronRight size={24} className="hidden md:block text-green-300"/>
                  <div className="space-y-1">
                    <span className="text-[12px] font-bold text-green-700 tracking-widest">お届け予定日</span>
                    <p className="text-[24px] font-black text-green-800 flex items-center justify-center gap-2 pt-1">
                      <Calendar size={20} className="text-green-600"/> 
                      {modalData.selectedDate ? `${modalData.selectedDate.split('-')[1]}月${modalData.selectedDate.split('-')[2]}日` : '未指定'}
                    </p>
                    <p className="text-[12px] font-bold text-green-700">{modalData.selectedTime || '時間指定なし'}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-[#FBFAF9] border border-[#EAEAEA] p-6 rounded-[24px] flex flex-col items-center justify-center text-center shadow-inner">
                   <span className="text-[12px] font-bold text-[#999999] tracking-widest mb-1">
                     {modalData.receiveMethod === 'pickup' ? 'ご来店予定日' : 'お届け予定日'}
                   </span>
                   <p className="text-[28px] font-black text-[#2D4B3E] flex items-center gap-2">
                     <Calendar size={24}/> {modalData.selectedDate ? `${modalData.selectedDate.split('-')[1]}月${modalData.selectedDate.split('-')[2]}日` : '未設定'}
                   </p>
                   <p className="text-[14px] font-bold text-[#D97C8F] mt-2">{modalData.selectedTime || '時間指定なし'}</p>
                </div>
              )}

              <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><MapPin size={18}/> お届け先情報</h3>
                <div className="space-y-3 text-[13px]">
                  <div className="flex gap-2 items-center mb-4 bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA] w-fit">
                    {getReceiveMethodBadge(modalData.receiveMethod)}
                  </div>
                  {modalData.receiveMethod === 'pickup' ? (
                    <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                      <p><span className="text-[#999999] text-[10px] block mb-1 tracking-widest">受取店舗</span><span className="font-black text-[16px] text-[#2D4B3E]">{modalData.selectedShop || '未指定'}</span></p>
                    </div>
                  ) : (
                    <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA] space-y-3">
                      <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">宛名</span><span className="font-black text-[16px]">{modalTargetInfo?.name || '未設定'} 様</span></p>
                      <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">住所</span><span className="font-bold text-[14px] block leading-relaxed">〒{modalTargetInfo?.zip}<br/>{modalTargetInfo?.address1} {modalTargetInfo?.address2}</span></p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><Tag size={18}/> ご注文内容</h3>
                <div className="flex flex-col sm:flex-row gap-6">
                  {modalData.referenceImage ? (
                    <img src={modalData.referenceImage} alt="参考" className="w-32 h-32 object-cover rounded-2xl border border-[#EAEAEA] shadow-sm shrink-0" />
                  ) : (
                    <div className="w-32 h-32 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl flex items-center justify-center text-[#999999] text-[11px] font-bold shrink-0">画像なし</div>
                  )}
                  <div className="flex-1 grid grid-cols-2 gap-4 text-[13px]">
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">種類</span><span className="font-black text-[#2D4B3E] text-[14px]">{modalData.flowerType || '未設定'}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">用途</span><span className="font-bold">{modalData.flowerPurpose} {modalData.otherPurpose && `(${modalData.otherPurpose})`}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">カラー</span><span className="font-bold">{modalData.flowerColor}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block tracking-widest mb-1">イメージ</span><span className="font-bold">{modalData.flowerVibe} {modalData.otherVibe && `(${modalData.otherVibe})`}</span></div>
                  </div>
                </div>
              </div>

              {modalData.cardType !== 'なし' && (
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><MessageSquare size={18}/> {modalData.cardType}</h3>
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

              <div className="bg-white p-8 rounded-[32px] border-2 border-[#2D4B3E]/20 shadow-md space-y-6">
                <h3 className="text-[16px] font-black text-[#2D4B3E] border-b border-[#EAEAEA] pb-3 flex items-center gap-2"><CreditCard size={20}/> ご請求額</h3>
                <div className="space-y-3 text-[14px] font-medium text-[#555555]">
                  <div className="flex justify-between items-center"><span>商品代 (税抜):</span><span className="font-black text-[#111111] text-[16px]">¥{getTotals(modalData).item.toLocaleString()}</span></div>
                  {getTotals(modalData).fee > 0 && <div className="flex justify-between items-center text-[#555555]"><span>配送料:</span><span className="font-bold text-[16px]">¥{getTotals(modalData).fee.toLocaleString()}</span></div>}
                  {getTotals(modalData).pickup > 0 && <div className="flex justify-between items-center text-[#555555]"><span>回収・返却費:</span><span className="font-bold text-[16px]">¥{getTotals(modalData).pickup.toLocaleString()}</span></div>}
                  <div className="flex justify-between items-center border-t border-[#EAEAEA] pt-3 text-[#2D4B3E]"><span>消費税 (10%):</span><span className="font-bold text-[16px]">¥{getTotals(modalData).tax.toLocaleString()}</span></div>
                  
                  <div className="flex justify-between border-t-2 border-[#2D4B3E]/20 pt-4 mt-2 items-end">
                    <span className="text-[13px] font-bold text-[#2D4B3E] tracking-widest mb-1">合計 (税込)</span>
                    <span className="text-[36px] font-black text-[#2D4B3E] leading-none">¥{getTotals(modalData).total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- 行事登録モーダル --- */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-[#111111]/40 backdrop-blur-sm" onClick={() => setIsEventModalOpen(false)}></div>
          <div className="bg-[#FBFAF9] w-full max-w-[500px] rounded-[32px] shadow-2xl relative flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 max-h-[90vh]">
            
            <div className="p-6 border-b border-[#EAEAEA] flex justify-between items-center bg-white z-10 shrink-0">
              <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Calendar size={20}/> 行事を登録</h2>
              <button onClick={() => setIsEventModalOpen(false)} className="text-[#999999] hover:text-[#111111] p-2 bg-[#FBFAF9] rounded-full border border-[#EAEAEA] shadow-sm"><X size={18}/></button>
            </div>
            
            <form onSubmit={handleAddEvent} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto flex-1 hide-scrollbar">
                
                <div className="space-y-4 bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#999999] tracking-widest">行事・イベント名 (必須)</label>
                    <input type="text" required value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} placeholder="例: 社長の誕生日、創立記念日" className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold focus:border-[#2D4B3E] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#999999] tracking-widest">日付 (必須)</label>
                    <input type="date" required value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold focus:border-[#2D4B3E] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#999999] tracking-widest">対象者 (任意)</label>
                    <input type="text" value={newEvent.target} onChange={e => setNewEvent({...newEvent, target: e.target.value})} placeholder="例: 山田社長、自社、取引先A社" className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold focus:border-[#2D4B3E] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#999999] tracking-widest">繰り返しの設定</label>
                    <div className="flex gap-2 p-1 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                      <button type="button" onClick={() => setNewEvent({...newEvent, repeat: '今年のみ'})} className={`flex-1 py-2.5 text-[12px] font-bold rounded-lg transition-all ${newEvent.repeat === '今年のみ' ? 'bg-white text-[#2D4B3E] shadow-sm border border-[#EAEAEA]' : 'text-[#999999]'}`}>今年のみ</button>
                      <button type="button" onClick={() => setNewEvent({...newEvent, repeat: '毎年'})} className={`flex-1 py-2.5 text-[12px] font-bold rounded-lg transition-all ${newEvent.repeat === '毎年' ? 'bg-[#2D4B3E] text-white shadow-sm' : 'text-[#999999]'}`}>毎年繰り返す</button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm">
                  <label className="text-[11px] font-bold text-[#2D4B3E] tracking-widest flex items-center gap-1.5"><MapPin size={14}/> お届け先情報の登録 (任意)</label>
                  <p className="text-[10px] text-[#999999] leading-relaxed">ここに住所を登録しておくと、お花を注文する際に入力の手間が省けます。</p>
                  <input type="text" placeholder="郵便番号 (7桁・ハイフンなし)" value={newEvent.zip} onChange={(e) => { setNewEvent({...newEvent, zip: e.target.value}); if(e.target.value.length === 7) fetchAddress(e.target.value); }} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
                  <input type="text" placeholder="都道府県・市区町村 (自動入力)" value={newEvent.address1} className="w-full h-12 bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-xl px-4 text-[13px] text-[#555555] outline-none" readOnly />
                  <input type="text" placeholder="番地・建物名" value={newEvent.address2} onChange={(e) => setNewEvent({...newEvent, address2: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
                </div>

              </div>
              
              <div className="p-6 bg-white border-t border-[#EAEAEA] shrink-0">
                <button type="submit" className="w-full h-14 bg-[#2D4B3E] text-white rounded-2xl font-bold text-[15px] hover:bg-[#1f352b] transition-all shadow-md active:scale-[0.98]">
                  行事を登録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ★ 新規追加：おまかせ注文専用モーダル --- */}
      {omakaseModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-[#111111]/40 backdrop-blur-sm" onClick={() => setOmakaseModal({ ...omakaseModal, isOpen: false })}></div>
          <div className="bg-[#FBFAF9] w-full max-w-[400px] rounded-[32px] shadow-2xl relative flex flex-col overflow-hidden animate-in slide-in-from-bottom-8">
            <div className="p-6 border-b border-[#EAEAEA] flex justify-between items-center bg-white z-10">
              <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Zap size={20}/> おまかせ注文</h2>
              <button onClick={() => setOmakaseModal({ ...omakaseModal, isOpen: false })} className="text-[#999999] hover:text-[#111111] p-2 bg-[#FBFAF9] rounded-full border border-[#EAEAEA] shadow-sm"><X size={18}/></button>
            </div>
            
            <form onSubmit={submitOmakaseOrder} className="p-6 space-y-6">
              <div className="space-y-4 bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm">
                <div className="space-y-1 mb-4">
                  <p className="text-[12px] font-bold text-[#999999]">対象の行事</p>
                  <p className="text-[15px] font-black text-[#111111]">{omakaseModal.event?.title}</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#999999] tracking-widest">お花の種類 (必須)</label>
                  <select required value={omakaseModal.flowerType} onChange={e => setOmakaseModal({...omakaseModal, flowerType: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold focus:border-[#2D4B3E] outline-none">
                    <option value="">種類を選択してください</option>
                    {appSettings?.flowerItems?.map(item => <option key={item.id} value={item.name}>{item.name}</option>) || (
                      <>
                        <option value="スタンド花">スタンド花</option>
                        <option value="胡蝶蘭">胡蝶蘭</option>
                        <option value="アレンジメント">アレンジメント</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#999999] tracking-widest">ご予算 (税抜)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold text-[#111111]">¥</span>
                    <input type="number" required min="3000" step="1000" placeholder="例: 15000" value={omakaseModal.budget} onChange={e => setOmakaseModal({...omakaseModal, budget: e.target.value})} className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[15px] font-bold focus:border-[#2D4B3E] outline-none" />
                  </div>
                </div>
              </div>
              
              <button type="submit" className="w-full h-14 bg-[#2D4B3E] text-white rounded-2xl font-bold text-[15px] hover:bg-[#1f352b] transition-all shadow-md active:scale-[0.98]">
                この内容で注文を確定する
              </button>
            </form>
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