'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Search, User, Phone, Mail, MapPin, ShoppingBag, 
  Calendar, Star, ChevronRight, X, ArrowUpDown, Gift
} from 'lucide-react';

export default function CustomersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('recent'); // recent, frequent, spend
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('取得エラー:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ★ 注文データから「顧客ごとの名寄せ・集計」を自動で行う賢いロジック
  const customers = useMemo(() => {
    const cmap = {};
    
    orders.forEach(order => {
      const d = order.order_data || {};
      const c = d.customerInfo;
      if (!c || !c.name) return; // 顧客情報がないものはスキップ

      // 電話番号をキーにして名寄せ（無い場合は名前）
      const key = c.phone ? c.phone.replace(/[^0-9]/g, '') : c.name;
      
      // 合計金額の計算
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

      // 集計の更新
      cmap[key].orderCount += 1;
      cmap[key].totalSpent += total;
      cmap[key].orders.push({ ...order, computedTotal: total });

      // 最新の注文日と最新の住所情報に更新
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

  // ★ 検索と並び替え
  const filteredAndSortedCustomers = useMemo(() => {
    let result = customers.filter(c => 
      c.name.includes(searchQuery) || 
      c.phone.includes(searchQuery) || 
      c.email.includes(searchQuery)
    );

    switch (sortOption) {
      case 'recent': // 最終注文日が新しい順
        result.sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));
        break;
      case 'frequent': // 注文回数が多い順
        result.sort((a, b) => b.orderCount - a.orderCount);
        break;
      case 'spend': // 累計金額が高い順
        result.sort((a, b) => b.totalSpent - a.totalSpent);
        break;
    }
    return result;
  }, [customers, searchQuery, sortOption]);

  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '-';
      const d = new Date(dateString);
      return withTime ? d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ja-JP');
    } catch (e) { return '-'; }
  };

  // 顧客のランク判定（例：3回以上or3万円以上で優良顧客など）
  const getCustomerRank = (c) => {
    if (c.orderCount >= 5 || c.totalSpent >= 50000) return { label: 'VIP顧客', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    if (c.orderCount >= 2) return { label: 'リピーター', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    return { label: '新規顧客', color: 'bg-green-100 text-green-800 border-green-200' };
  };

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center justify-between px-6 md:px-8 py-4 sticky top-0 z-10 gap-4">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-black text-[#2D4B3E] tracking-tight">顧客管理リスト</h1>
          <p className="text-[11px] font-bold text-[#999] mt-1 tracking-widest">これまでの全注文データから自動集計</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999]" size={16} />
            <input 
              type="text" 
              placeholder="名前・電話番号で検索..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] font-bold outline-none focus:border-[#2D4B3E] focus:bg-white transition-all shadow-sm"
            />
          </div>
          <select 
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="h-10 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#555] outline-none shadow-sm cursor-pointer"
          >
            <option value="recent">最終注文が新しい順</option>
            <option value="frequent">注文回数が多い順</option>
            <option value="spend">累計購入額が高い順</option>
          </select>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6">
        
        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <span className="text-[11px] font-bold text-[#999] tracking-widest mb-1">登録顧客総数</span>
            <span className="text-[24px] font-black text-[#2D4B3E]">{customers.length} <span className="text-[12px] font-bold text-[#999]">人</span></span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <span className="text-[11px] font-bold text-[#999] tracking-widest mb-1">リピート顧客</span>
            <span className="text-[24px] font-black text-blue-600">{customers.filter(c => c.orderCount >= 2).length} <span className="text-[12px] font-bold text-[#999]">人</span></span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <span className="text-[11px] font-bold text-[#999] tracking-widest mb-1">総受注件数</span>
            <span className="text-[24px] font-black text-orange-600">{orders.length} <span className="text-[12px] font-bold text-[#999]">件</span></span>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <span className="text-[11px] font-bold text-[#999] tracking-widest mb-1">累計売上高</span>
            <span className="text-[20px] font-black text-[#2D4B3E]">¥{customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}</span>
          </div>
        </div>

        {/* 顧客リスト */}
        {isLoading ? (
          <div className="p-20 text-center text-[#999] font-bold animate-pulse tracking-widest">顧客データを集計中...</div>
        ) : filteredAndSortedCustomers.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-[#CCC] p-20 text-center shadow-sm">
            <p className="text-[14px] font-bold text-[#999]">顧客データが見つかりません</p>
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
                  <CalendarIcon size={16} /> 過去の注文履歴
                </h3>
                <div className="space-y-4">
                  {selectedCustomer.orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((order, idx) => {
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