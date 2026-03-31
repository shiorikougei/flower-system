'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Search, User, Phone, Mail, MapPin, ShoppingBag, 
  Calendar, ChevronRight, X, Filter, PieChart
} from 'lucide-react';

// ★ キャッシュ用のキーを定義
const CUSTOMERS_ORDERS_CACHE_KEY = 'florix_customers_orders_cache';

export default function CustomersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 新しいフィルター＆ソート状態
  const [sortOption, setSortOption] = useState('recent'); // recent, frequent, spend
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterType, setFilterType] = useState('all'); // all, new, repeat
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    // 1. まずは sessionStorage (キャッシュ) から復元して高速表示
    const cached = sessionStorage.getItem(CUSTOMERS_ORDERS_CACHE_KEY);
    if (cached) {
      try {
        setOrders(JSON.parse(cached));
        setIsLoading(false); // キャッシュがあればローディングを即解除
      } catch (e) {
        console.error("キャッシュパース失敗", e);
      }
    } else {
      setIsLoading(true); // キャッシュがない初回のみローディングを表示
    }

    // 2. バックグラウンドで最新データをDBから取得
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      const fetchedOrders = data || [];
      setOrders(fetchedOrders);
      
      // キャッシュを最新データで上書き保存
      sessionStorage.setItem(CUSTOMERS_ORDERS_CACHE_KEY, JSON.stringify(fetchedOrders));
    } catch (error) {
      console.error('取得エラー:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 注文データから「顧客ごとの名寄せ・集計」を自動で行うロジック
  const customers = useMemo(() => {
    const cmap = {};
    
    orders.forEach(order => {
      const d = order.order_data || {};
      const c = d.customerInfo;
      if (!c || !c.name) return;

      const key = c.phone ? c.phone.replace(/[^0-9]/g, '') : c.name;
      
      const itemPrice = Number(d.itemPrice) || 0;
      const fee = Number(d.calculatedFee) || 0;
      const pickup = Number(d.pickupFee) || 0;
      const subTotal = itemPrice + fee + pickup;
      const tax = Math.floor(subTotal * 0.1);
      const total = subTotal + tax;

      if (!cmap[key]) {
        cmap[key] = {
          id: key,
          name: c.name,
          phone: c.phone || '未登録',
          email: c.email || '',
          zip: c.zip || '',
          address: `${c.address1 || ''} ${c.address2 || ''}`.trim(),
          orderCount: 0,
          totalSpent: 0,
          lastOrderDate: order.created_at,
          orders: []
        };
      }

      cmap[key].orderCount += 1;
      cmap[key].totalSpent += total;
      cmap[key].orders.push({ ...order, computedTotal: total });

      if (new Date(order.created_at) > new Date(cmap[key].lastOrderDate)) {
        cmap[key].lastOrderDate = order.created_at;
        if (c.email) cmap[key].email = c.email;
        if (c.zip) cmap[key].zip = c.zip;
        const newAddr = `${c.address1 || ''} ${c.address2 || ''}`.trim();
        if (newAddr) cmap[key].address = newAddr;
      }
    });

    return Object.values(cmap);
  }, [orders]);

  // 存在する「注文月」のリストを生成（セレクトボックス用）
  const availableMonths = useMemo(() => {
    const months = new Set();
    orders.forEach(o => {
      const d = new Date(o.created_at);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  // 検索 ＋ 月別 ＋ 新規/リピート ＋ 並び替え の複合フィルター
  const filteredAndSortedCustomers = useMemo(() => {
    let result = customers.filter(c => {
      // 1. テキスト検索
      const matchSearch = c.name.includes(searchQuery) || c.phone.includes(searchQuery) || c.email.includes(searchQuery);
      if (!matchSearch) return false;

      // 2. 月別フィルター（その月に注文した人だけを残す）
      if (filterMonth !== 'all') {
        const orderedInMonth = c.orders.some(o => {
          const d = new Date(o.created_at);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === filterMonth;
        });
        if (!orderedInMonth) return false;
      }

      // 3. 新規/リピート フィルター
      if (filterType === 'new' && c.orderCount > 1) return false;
      if (filterType === 'repeat' && c.orderCount < 2) return false;

      return true;
    });

    // 並び替え
    switch (sortOption) {
      case 'recent': result.sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate)); break;
      case 'frequent': result.sort((a, b) => b.orderCount - a.orderCount); break;
      case 'spend': result.sort((a, b) => b.totalSpent - a.totalSpent); break;
    }
    return result;
  }, [customers, searchQuery, sortOption, filterMonth, filterType]);

  // 円グラフ用のデータ計算
  const chartData = useMemo(() => {
    const total = filteredAndSortedCustomers.length;
    const repeatCount = filteredAndSortedCustomers.filter(c => c.orderCount >= 2).length;
    const newCount = total - repeatCount;
    const repeatPercent = total === 0 ? 0 : Math.round((repeatCount / total) * 100);
    const newPercent = total === 0 ? 0 : 100 - repeatPercent;
    
    // SVGの円周計算 (半径40の場合、2 * π * 40 ≈ 251.2)
    const circumference = 251.2;
    const repeatDash = (repeatPercent / 100) * circumference;

    return { total, repeatCount, newCount, repeatPercent, newPercent, circumference, repeatDash };
  }, [filteredAndSortedCustomers]);

  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '-';
      const d = new Date(dateString);
      return withTime ? d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ja-JP');
    } catch (e) { return '-'; }
  };

  // ★ 顧客ランクのタグをテラコッタオレンジ（#D97D54）に変更
  const getCustomerRank = (c) => {
    if (c.orderCount >= 5 || c.totalSpent >= 50000) return { label: 'VIP顧客', color: 'bg-yellow-500 text-white border-transparent' };
    if (c.orderCount >= 2) return { label: 'リピーター', color: 'bg-[#2D4B3E] text-white border-transparent' };
    return { label: '新規顧客', color: 'bg-[#D97D54] text-white border-transparent' };
  };

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center justify-between px-6 md:px-8 py-4 sticky top-0 z-10 gap-4">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-black text-[#2D4B3E] tracking-tight">顧客リスト＆分析</h1>
          <p className="text-[11px] font-bold text-[#999] mt-1 tracking-widest">自動名寄せ・リピート率分析</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* 月別フィルター */}
          <div className="flex items-center bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl overflow-hidden shadow-sm">
            <div className="px-3 text-[#999]"><Calendar size={14}/></div>
            <select 
              value={filterMonth} 
              onChange={(e) => setFilterMonth(e.target.value)}
              className="h-10 pr-4 bg-transparent text-[12px] font-bold text-[#555] outline-none cursor-pointer"
            >
              <option value="all">全期間</option>
              {availableMonths.map(m => <option key={m} value={m}>{m.replace('-', '年')}月</option>)}
            </select>
          </div>

          {/* 検索バー */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" size={16} />
            <input 
              type="text" 
              placeholder="名前・電話番号..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] font-bold outline-none focus:border-[#2D4B3E] focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6">
        
        {/* 分析ダッシュボード（円グラフ付き） */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* 円グラフセクション */}
          <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm flex items-center justify-between col-span-1 md:col-span-2">
            <div className="space-y-4 flex-1">
              <h2 className="text-[14px] font-black text-[#2D4B3E] flex items-center gap-2"><PieChart size={18}/> 新規・リピート比率</h2>
              <div className="flex gap-6">
                <div className="space-y-1">
                  {/* ★ ピンクをテラコッタ(#D97D54)に変更 */}
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#999]"><span className="w-2.5 h-2.5 rounded-full bg-[#D97D54]"></span>新規顧客</div>
                  <div className="text-[20px] font-black text-[#333]">{chartData.newCount}<span className="text-[12px] font-bold text-[#999]">人</span> <span className="text-[12px] text-[#D97D54]">({chartData.newPercent}%)</span></div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-[#999]"><span className="w-2.5 h-2.5 rounded-full bg-[#2D4B3E]"></span>リピーター</div>
                  <div className="text-[20px] font-black text-[#333]">{chartData.repeatCount}<span className="text-[12px] font-bold text-[#999]">人</span> <span className="text-[12px] text-[#2D4B3E]">({chartData.repeatPercent}%)</span></div>
                </div>
              </div>
            </div>
            
            {/* CSSとSVGで作るドーナツチャート */}
            <div className="relative w-28 h-28 shrink-0 mr-4">
              <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
                {/* ★ グラフの背景色をテラコッタに合う淡い色(#F4E0D6)に変更 */}
                <circle cx="50" cy="50" r="40" stroke="#F4E0D6" strokeWidth="16" fill="transparent" />
                <circle 
                  cx="50" cy="50" r="40" 
                  stroke="#2D4B3E" strokeWidth="16" fill="transparent"
                  strokeDasharray={`${chartData.repeatDash} ${chartData.circumference}`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[18px] font-black text-[#2D4B3E] leading-none">{chartData.total}</span>
                <span className="text-[8px] font-bold text-[#999]">Total</span>
              </div>
            </div>
          </div>

          {/* 売上サマリー */}
          <div className="bg-[#2D4B3E] p-6 rounded-[24px] shadow-md flex flex-col justify-center text-white relative overflow-hidden">
            <ShoppingBag size={80} className="absolute -right-4 -bottom-4 text-white/10" />
            <span className="text-[11px] font-bold text-white/70 tracking-widest mb-1 relative z-10">表示中の累計売上</span>
            <span className="text-[32px] font-black relative z-10">¥{filteredAndSortedCustomers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}</span>
          </div>
        </div>

        {/* 顧客リストの上部ツールバー */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-[20px] border border-[#EAEAEA] shadow-sm">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[#999] ml-2"/>
            <div className="flex bg-[#FBFAF9] p-1 rounded-xl border border-[#EAEAEA]">
              <button onClick={() => setFilterType('all')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${filterType === 'all' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999]'}`}>すべて</button>
              {/* ★ ピンクをテラコッタ(#D97D54)に変更 */}
              <button onClick={() => setFilterType('new')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${filterType === 'new' ? 'bg-white shadow-sm text-[#D97D54]' : 'text-[#999]'}`}>新規のみ</button>
              <button onClick={() => setFilterType('repeat')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${filterType === 'repeat' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999]'}`}>リピートのみ</button>
            </div>
          </div>
          
          <select 
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="h-9 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555] outline-none cursor-pointer"
          >
            <option value="recent">最終注文が新しい順</option>
            <option value="frequent">注文回数が多い順</option>
            <option value="spend">累計購入額が高い順</option>
          </select>
        </div>

        {/* 顧客リスト */}
        {isLoading ? (
          <div className="p-20 text-center text-[#999] font-bold animate-pulse tracking-widest">顧客データを集計中...</div>
        ) : filteredAndSortedCustomers.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-[#CCC] p-20 text-center shadow-sm">
            <p className="text-[14px] font-bold text-[#999]">条件に一致する顧客データが見つかりません</p>
          </div>
        ) : (
          <div className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden">
            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-[#FBFAF9] border-b border-[#EAEAEA] text-[11px] font-bold text-[#999] tracking-widest">
                    <th className="px-6 py-4">顧客名</th>
                    <th className="px-6 py-4">連絡先</th>
                    <th className="px-6 py-4">注文実績</th>
                    <th className="px-6 py-4">最終利用日</th>
                    <th className="px-6 py-4 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F7F7F7]">
                  {filteredAndSortedCustomers.map((c) => {
                    const rank = getCustomerRank(c);
                    return (
                      <tr key={c.id} onClick={() => setSelectedCustomer(c)} className="hover:bg-[#FBFAF9]/50 transition-colors cursor-pointer group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#EAEAEA] flex items-center justify-center text-[#999] font-black text-[14px] shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-black text-[14px] text-[#222] group-hover:text-[#2D4B3E] transition-colors">{c.name} <span className="text-[10px] font-normal text-[#999]">様</span></div>
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border mt-1 ${rank.color}`}>{rank.label}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          <div className="flex items-center gap-2 text-[12px] font-bold text-[#555]"><Phone size={12} className="text-[#999]"/> {c.phone}</div>
                          {c.email && <div className="flex items-center gap-2 text-[11px] font-bold text-[#4285F4]"><Mail size={12} className="text-[#999]"/> {c.email}</div>}
                        </td>
                        <td className="px-6 py-4 space-y-1">
                          <div className="text-[14px] font-black text-[#2D4B3E]">¥{c.totalSpent.toLocaleString()}</div>
                          <div className="text-[11px] font-bold text-[#999] flex items-center gap-1"><ShoppingBag size={12}/> {c.orderCount}回利用</div>
                        </td>
                        <td className="px-6 py-4 text-[12px] font-bold text-[#555]">
                          {safeFormatDate(c.lastOrderDate)}
                        </td>
                        <td className="px-6 py-4 text-right text-[#CCC] group-hover:text-[#2D4B3E] transition-colors">
                          <ChevronRight size={20} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 詳細モーダル（注文履歴） */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111111]/60 backdrop-blur-sm p-4 animate-in fade-in text-left" onClick={() => setSelectedCustomer(null)}>
          <div className="bg-[#FBFAF9] rounded-[32px] w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col" onClick={(e) => e.stopPropagation()}>
            
            <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#EAEAEA] p-6 flex items-start justify-between z-20 rounded-t-[32px]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2D4B3E] flex items-center justify-center text-white font-black text-[20px] shadow-md">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-[20px] font-black text-[#2D4B3E]">{selectedCustomer.name} <span className="text-[12px] font-normal text-[#999]">様</span></h2>
                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold border mt-1 ${getCustomerRank(selectedCustomer).color}`}>
                    {getCustomerRank(selectedCustomer).label}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="w-10 h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555] hover:bg-[#EAEAEA] transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-8">
              
              {/* 顧客基本情報 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-3">
                  <h3 className="text-[12px] font-bold text-[#999] tracking-widest flex items-center gap-2"><User size={14}/> 連絡先情報</h3>
                  <div className="space-y-2">
                    <p className="text-[14px] font-black text-[#333] flex items-center gap-2"><Phone size={14} className="text-[#999]"/> {selectedCustomer.phone}</p>
                    {selectedCustomer.email && <p className="text-[13px] font-bold text-[#4285F4] flex items-center gap-2"><Mail size={14} className="text-[#999]"/> {selectedCustomer.email}</p>}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-3">
                  <h3 className="text-[12px] font-bold text-[#999] tracking-widest flex items-center gap-2"><MapPin size={14}/> 最新の住所</h3>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-[#999]">〒{selectedCustomer.zip || '未登録'}</p>
                    <p className="text-[13px] font-bold text-[#333] leading-relaxed">{selectedCustomer.address || '未登録'}</p>
                  </div>
                </div>
              </div>

              {/* 統計サマリー */}
              <div className="flex bg-[#2D4B3E]/5 border border-[#2D4B3E]/20 rounded-2xl p-4 divide-x divide-[#2D4B3E]/10">
                <div className="flex-1 text-center space-y-1">
                  <p className="text-[10px] font-bold text-[#555] tracking-widest">注文回数</p>
                  <p className="text-[20px] font-black text-[#2D4B3E]">{selectedCustomer.orderCount} <span className="text-[12px]">回</span></p>
                </div>
                <div className="flex-1 text-center space-y-1">
                  <p className="text-[10px] font-bold text-[#555] tracking-widest">累計購入額</p>
                  <p className="text-[20px] font-black text-[#2D4B3E]">¥{selectedCustomer.totalSpent.toLocaleString()}</p>
                </div>
                <div className="flex-1 text-center space-y-1">
                  <p className="text-[10px] font-bold text-[#555] tracking-widest">初回来店日</p>
                  <p className="text-[14px] font-bold text-[#555] mt-1">{safeFormatDate(selectedCustomer.orders[selectedCustomer.orders.length - 1].created_at)}</p>
                </div>
              </div>

              {/* 注文履歴タイムライン */}
              <div className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm p-6">
                <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#F7F7F7] pb-3 mb-4 flex items-center gap-2">
                  {/* ★ここです！ CalendarIconじゃなくてCalendarに修正！💥 */}
                  <Calendar size={16} /> 過去の注文履歴
                </h3>
                <div className="space-y-4">
                  {/* ★破壊的変更(sort)を防ぐために [... ] でコピーを作成！ */}
                  {([...selectedCustomer.orders]).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((order, idx) => {
                    const d = order.order_data || {};
                    const methodLabel = d.receiveMethod === 'pickup' ? '店頭受取' : d.receiveMethod === 'delivery' ? '自社配達' : '業者配送';
                    
                    return (
                      <div key={order.id} className="relative pl-6 pb-6 last:pb-0 group">
                        {/* タイムラインの線と点 */}
                        <div className="absolute left-[7px] top-2 bottom-0 w-[2px] bg-[#EAEAEA] group-last:bg-transparent"></div>
                        <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-white border-4 border-[#2D4B3E] z-10 shadow-sm"></div>

                        <div className="bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl p-4 transition-all hover:border-[#2D4B3E] hover:shadow-md">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <span className="text-[12px] font-black text-[#2D4B3E] bg-white px-3 py-1 rounded-lg border border-[#EAEAEA] shadow-sm">{safeFormatDate(order.created_at)}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">{methodLabel}</span>
                              <span className="text-[14px] font-black text-[#222]">¥{order.computedTotal.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px]">
                            <div className="space-y-1">
                              <p><span className="text-[#999] tracking-widest text-[10px] mr-2">お花</span> <span className="font-bold text-[#333]">{d.flowerType || '未設定'}</span></p>
                              <p><span className="text-[#999] tracking-widest text-[10px] mr-2">用途</span> <span className="font-bold text-[#333]">{d.flowerPurpose || '-'}</span></p>
                              <p><span className="text-[#999] tracking-widest text-[10px] mr-2">色合</span> <span className="font-bold text-[#333]">{d.flowerColor || '-'}</span></p>
                            </div>
                            <div className="space-y-1 sm:border-l sm:border-[#EAEAEA] sm:pl-4">
                              <p><span className="text-[#999] tracking-widest text-[10px] mr-2">お届け先</span> <span className="font-bold text-[#333]">{d.isRecipientDifferent ? `${d.recipientInfo?.name} 様` : 'ご自宅/ご本人'}</span></p>
                              {d.cardType && d.cardType !== 'なし' && (
                                <p className="mt-2"><span className="inline-block bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[9px] font-bold mr-1">{d.cardType}</span> <span className="font-bold text-[#333] truncate inline-block align-bottom max-w-[120px]">{d.cardType === '立札' ? d.tateInput1 : d.cardMessage}</span></p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}