'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import {
  TrendingUp, Calendar, DollarSign, ShoppingBag,
  BarChart3, AlertCircle, RefreshCw, FileText, Printer,
  CalendarDays, CalendarRange, CheckCircle2, User, Phone
} from 'lucide-react';
import FeatureGate from '@/components/FeatureGate';
import HelpTooltip from '@/components/HelpTooltip';

export default function SalesPage() {
  return <FeatureGate feature="sales" label="売上管理"><SalesPageInner/></FeatureGate>;
}

function SalesPageInner() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenantId, setCurrentTenantId] = useState(null);

  // ★ 表示モードに 'unpaid' (未入金一覧) を追加！
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly', 'daily', or 'unpaid'
  const [targetMonth, setTargetMonth] = useState('');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      // ★ セキュリティ修正: tenant_id を取得
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/staff/login';
        return;
      }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
      if (profileError) throw profileError;
      const tId = profile.tenant_id;
      if (!tId) throw new Error('tenant_id が取得できませんでした');
      setCurrentTenantId(tId);

      const { data, error } = await supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('取得エラー:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const availableMonths = useMemo(() => {
    const months = new Set();
    orders.forEach(o => {
      const d = o.order_data || {};
      if (d.status === 'キャンセル') return;
      const date = new Date(o.created_at);
      months.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  }, [orders]);

  useEffect(() => {
    if (availableMonths.length > 0 && !targetMonth) {
      setTargetMonth(availableMonths[0]);
    }
  }, [availableMonths, targetMonth]);

  // ==========================================
  // ★ 新規追加：未入金オーダーのみを抽出するロジック
  // ==========================================
  const unpaidOrders = useMemo(() => {
    return orders.filter(o => {
      const d = o.order_data || {};
      if (d.status === 'キャンセル') return false;
      // ★ Stripe決済反映: DB の payment_status='paid' は除外（入金済扱い）
      if (o.payment_status === 'paid') return false;
      // 支払いステータスが空、または「未」という文字が含まれている場合を未入金とする
      return !d.paymentStatus || d.paymentStatus.includes('未') || d.paymentStatus === '';
    }).map(o => {
      const d = o.order_data || {};
      const itemPrice = Number(d.itemPrice) || 0;
      const fee = Number(d.calculatedFee) || 0;
      const pickup = Number(d.pickupFee) || 0;
      const subTotal = itemPrice + fee + pickup;
      const total = subTotal + Math.floor(subTotal * 0.1);
      return { ...o, computedTotal: total };
    });
  }, [orders]);


  // 月別・日別の売上集計
  const displayedSales = useMemo(() => {
    if (viewMode === 'unpaid') return []; // 未入金モードの時はこの集計は使わない

    const map = {};
    orders.forEach(order => {
      const d = order.order_data || {};
      if (d.status === 'キャンセル') return;

      const date = new Date(order.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      let key = '';
      let displayLabel = '';

      if (viewMode === 'monthly') {
        key = monthKey;
        displayLabel = `${date.getFullYear()}年 ${String(date.getMonth() + 1).padStart(2, '0')}月`;
      } else {
        if (monthKey !== targetMonth) return;
        key = `${monthKey}-${String(date.getDate()).padStart(2, '0')}`;
        displayLabel = `${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
      }

      const itemPrice = Number(d.itemPrice) || 0;
      const fee = Number(d.calculatedFee) || 0;
      const pickup = Number(d.pickupFee) || 0;
      const subTotal = itemPrice + fee + pickup;
      const tax = Math.floor(subTotal * 0.1);
      const total = subTotal + tax;

      if (!map[key]) {
        map[key] = {
          key: key,
          label: displayLabel,
          rawDate: date,
          totalSales: 0,
          orderCount: 0,
          itemSales: 0,
          shippingFees: 0,
          unpaidCount: 0, 
        };
      }

      map[key].totalSales += total;
      map[key].itemSales += itemPrice;
      map[key].shippingFees += (fee + pickup);
      map[key].orderCount += 1;

      // ★ Stripe決済反映: payment_status='paid' は未入金カウントに含めない
      if (order.payment_status !== 'paid' && (!d.paymentStatus || d.paymentStatus.includes('未') || d.paymentStatus === '')) {
        map[key].unpaidCount += 1;
      }
    });

    return Object.values(map).sort((a, b) => b.rawDate - a.rawDate);
  }, [orders, viewMode, targetMonth]);


  // 画面上部のサマリー用（表示されているリストの合計を動的に計算）
  const currentTotalSales = viewMode === 'unpaid' 
    ? unpaidOrders.reduce((sum, item) => sum + item.computedTotal, 0)
    : displayedSales.reduce((sum, item) => sum + item.totalSales, 0);
    
  const currentTotalOrders = viewMode === 'unpaid'
    ? unpaidOrders.length
    : displayedSales.reduce((sum, item) => sum + item.orderCount, 0);


  // ==========================================
  // ★ 新規追加：入金済に更新する関数
  // ==========================================
  const handleUpdatePayment = async (orderId, currentData) => {
    if (!confirm('この注文を「入金済」として処理しますか？')) return;
    
    try {
      // ★ 入金済への遷移ロジック（"未入金（引き取り時）"→"入金済（引き取り時受領）"）
      const oldStatus = currentData.paymentStatus || '';
      let newStatus = '入金済';
      if (oldStatus.includes('引き取り時')) {
        newStatus = '入金済（引き取り時受領）';
      }

      const updatedData = { ...currentData, paymentStatus: newStatus };
      
      // Supabaseを更新（★ tenant_id でも絞り込み）
      const { error } = await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);
      if (error) throw error;

      // ローカルのStateも更新して画面を即座に反映させる
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      
      alert('入金済みに更新しました！');
    } catch (error) {
      console.error(error);
      alert('更新に失敗しました。時間をおいて再度お試しください。');
    }
  };

  const safeFormatDate = (dateString) => {
    try {
      if (!dateString) return '-';
      const d = new Date(dateString);
      return d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '-'; }
  };

  // CSVダウンロード機能
  const handleDownloadCSV = () => {
    if (viewMode === 'unpaid') {
      alert('未入金一覧のCSV出力は現在準備中です。');
      return;
    }
    if (displayedSales.length === 0) {
      alert('出力するデータがありません。');
      return;
    }
    const headers = ['対象', '売上合計(税込)', '商品代(税抜)', '送料・手数料(税抜)', '受注件数', '平均客単価(税込)', '未入金件数'];
    const rows = displayedSales.map(m => [
      m.label, m.totalSales, m.itemSales, m.shippingFees, m.orderCount, Math.floor(m.totalSales / m.orderCount), m.unpaidCount
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const fileName = viewMode === 'monthly' ? '月別_売上レポート' : `${targetMonth}_日別売上レポート`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF・印刷出力機能
  const handlePrintPDF = () => {
    if (viewMode === 'unpaid') {
      alert('未入金一覧の印刷出力は現在準備中です。');
      return;
    }
    if (displayedSales.length === 0) {
      alert('出力するデータがありません。');
      return;
    }
    const reportTitle = viewMode === 'monthly' ? '月別 売上レポート' : `${targetMonth.replace('-', '年')}月 日別売上レポート`;
    
    const html = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; color: #333; margin: 0; }
          h1 { text-align: center; color: #2D4B3E; border-bottom: 2px solid #2D4B3E; padding-bottom: 10px; margin-bottom: 20px; font-size: 24px; }
          .meta { text-align: right; font-size: 12px; color: #666; margin-bottom: 10px; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #ddd; }
          .summary-item { text-align: center; flex: 1; border-right: 1px solid #ddd; }
          .summary-item:last-child { border-right: none; }
          .summary-title { font-size: 12px; color: #666; margin-bottom: 8px; font-weight: bold; }
          .summary-value { font-size: 24px; font-weight: bold; color: #2D4B3E; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 12px 8px; text-align: right; font-size: 13px; }
          th { background: #2D4B3E; color: white; text-align: center; font-weight: bold; }
          .text-center { text-align: center; }
          .alert { color: #d32f2f; font-weight: bold; }
          .total-sales-col { font-weight: bold; font-size: 14px; background: #fdfdfd; }
        </style>
      </head>
      <body>
        <h1>${reportTitle}</h1>
        <div class="meta">出力日: ${new Date().toLocaleDateString('ja-JP')}</div>
        <div class="summary">
          <div class="summary-item">
            <div class="summary-title">リスト合計 売上(税込)</div>
            <div class="summary-value">¥${currentTotalSales.toLocaleString()}</div>
          </div>
          <div class="summary-item">
            <div class="summary-title">リスト合計 受注件数</div>
            <div class="summary-value">${currentTotalOrders} 件</div>
          </div>
          <div class="summary-item">
            <div class="summary-title">平均客単価</div>
            <div class="summary-value">¥${currentTotalOrders > 0 ? Math.floor(currentTotalSales / currentTotalOrders).toLocaleString() : 0}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>対象</th>
              <th>売上合計(税込)</th>
              <th>商品代(税抜)</th>
              <th>送料・手数料</th>
              <th>受注件数</th>
              <th>平均客単価</th>
              <th>未入金アラート</th>
            </tr>
          </thead>
          <tbody>
            ${displayedSales.map(m => `
              <tr>
                <td class="text-center font-bold">${m.label}</td>
                <td class="total-sales-col">¥${m.totalSales.toLocaleString()}</td>
                <td>¥${m.itemSales.toLocaleString()}</td>
                <td>¥${m.shippingFees.toLocaleString()}</td>
                <td class="text-center">${m.orderCount}</td>
                <td>¥${Math.floor(m.totalSales / m.orderCount).toLocaleString()}</td>
                <td class="${m.unpaidCount > 0 ? 'alert' : ''} text-center">
                  ${m.unpaidCount > 0 ? `${m.unpaidCount}件の未入金` : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>
          window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); }
        </script>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center justify-between px-6 md:px-8 py-4 sticky top-0 z-10 gap-4">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-bold text-[#2D4B3E] tracking-tight flex items-center gap-2">売上ダッシュボード <HelpTooltip articleId="order_payment"/></h1>
          <p className="text-[11px] font-bold text-[#999] mt-1">月別・日別 売上の自動集計・入金管理</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          {/* 表示切り替えトグル */}
          <div className="flex bg-[#FBFAF9] p-1 rounded-xl border border-[#EAEAEA]">
            <button onClick={() => setViewMode('monthly')} className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${viewMode === 'monthly' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999]'}`}>
              <CalendarRange size={14}/> 月別
            </button>
            <button onClick={() => setViewMode('daily')} className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${viewMode === 'daily' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999]'}`}>
              <CalendarDays size={14}/> 日別
            </button>
            {/* ★ 追加：未入金タブ */}
            <button onClick={() => setViewMode('unpaid')} className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${viewMode === 'unpaid' ? 'bg-[#D97D54] shadow-sm text-white' : 'text-[#999]'}`}>
              <AlertCircle size={14}/> 未入金一覧
              {unpaidOrders.length > 0 && <span className={`ml-1 px-1.5 rounded-full text-[10px] ${viewMode === 'unpaid' ? 'bg-white text-[#D97D54]' : 'bg-[#D97D54] text-white'}`}>{unpaidOrders.length}</span>}
            </button>
          </div>

          {/* 日別モードの時の月セレクター */}
          {viewMode === 'daily' && (
            <select 
              value={targetMonth} 
              onChange={(e) => setTargetMonth(e.target.value)}
              className="h-10 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#555] outline-none shadow-sm cursor-pointer"
            >
              {availableMonths.map(m => <option key={m} value={m}>{m.replace('-', '年')}月 の日別売上</option>)}
            </select>
          )}

          <div className="w-[1px] h-6 bg-[#EAEAEA] mx-1 hidden lg:block"></div>

          <button onClick={handlePrintPDF} className="flex items-center gap-2 px-3 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555] hover:border-[#2D4B3E] transition-all shadow-sm disabled:opacity-50">
            <Printer size={14} /> <span className="hidden sm:inline">印刷 / PDF</span>
          </button>
          <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555] hover:border-[#2D4B3E] transition-all shadow-sm disabled:opacity-50">
            <FileText size={14} /> <span className="hidden sm:inline">CSV出力</span>
          </button>
          <button onClick={fetchOrders} className="flex items-center gap-2 px-3 py-2 bg-[#2D4B3E] text-white rounded-xl text-[11px] font-bold hover:bg-[#1f352b] transition-all shadow-sm">
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-[1000px] mx-auto space-y-8">
        
        {/* 上部サマリー（現在表示中のリスト合計） */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`text-white p-6 rounded-2xl shadow-md relative overflow-hidden transition-colors ${viewMode === 'unpaid' ? 'bg-[#D97D54]' : 'bg-[#2D4B3E]'}`}>
            <TrendingUp size={100} className="absolute -right-4 -bottom-4 text-white/10" />
            <h3 className="text-[12px] font-bold text-white/80 mb-2 flex items-center gap-2">
              <DollarSign size={16}/> {viewMode === 'monthly' ? '全期間 累計売上' : viewMode === 'daily' ? `${targetMonth.replace('-','年')}月 合計売上` : '未回収 合計金額'}
            </h3>
            <p className="text-[32px] font-bold tracking-tight">¥{currentTotalSales.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <h3 className="text-[12px] font-bold text-[#999] mb-1 flex items-center gap-2">
              <ShoppingBag size={14}/> {viewMode === 'unpaid' ? '未入金 件数' : '合計受注件数'}
            </h3>
            <p className={`text-[24px] font-bold ${viewMode === 'unpaid' ? 'text-[#D97D54]' : 'text-[#2D4B3E]'}`}>{currentTotalOrders} <span className="text-[12px] font-bold text-[#999]">件</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <h3 className="text-[12px] font-bold text-[#999] mb-1 flex items-center gap-2"><BarChart3 size={14}/> 平均客単価</h3>
            <p className={`text-[24px] font-bold ${viewMode === 'unpaid' ? 'text-[#D97D54]' : 'text-[#2D4B3E]'}`}>
              ¥{currentTotalOrders > 0 ? Math.floor(currentTotalSales / currentTotalOrders).toLocaleString() : 0}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 text-center text-[#999] font-bold animate-pulse">データを計算中...</div>
        ) : viewMode === 'unpaid' ? (
          /* ========================================================
             ★ 未入金一覧モード の表示
             ======================================================== */
          <div className="space-y-4 animate-in fade-in">
            <h2 className="text-[16px] font-bold text-[#D97D54] flex items-center gap-2 border-b border-[#EAEAEA] pb-2">
              <AlertCircle size={18} /> 未入金オーダー一覧
            </h2>
            
            {unpaidOrders.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-[#CCC] p-20 text-center shadow-sm">
                <div className="flex justify-center mb-4 text-green-500"><CheckCircle2 size={40} /></div>
                <p className="text-[14px] font-bold text-[#2D4B3E]">未入金のオーダーはありません！素晴らしいです👏</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {unpaidOrders.map(order => {
                  const d = order.order_data || {};
                  const c = d.customerInfo || {};
                  return (
                    <div key={order.id} className="bg-white rounded-2xl border border-[#D97D54]/30 shadow-sm overflow-hidden flex flex-col md:flex-row items-center relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D97D54]"></div>
                      
                      <div className="p-6 md:w-1/3 flex flex-col justify-center w-full border-b md:border-b-0 md:border-r border-[#EAEAEA]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold bg-[#D97D54]/10 text-[#D97D54] px-2 py-1 rounded-md">{d.paymentStatus || '未設定'}</span>
                          <span className="text-[12px] font-bold text-[#999]">{safeFormatDate(order.created_at)}</span>
                        </div>
                        <span className="text-[24px] font-bold text-[#D97D54] leading-none mb-1">¥{order.computedTotal.toLocaleString()}</span>
                      </div>

                      <div className="p-6 md:w-1/3 flex flex-col justify-center w-full space-y-2 border-b md:border-b-0 md:border-r border-[#EAEAEA]">
                        <p className="text-[14px] font-bold text-[#333] flex items-center gap-2"><User size={14} className="text-[#999]"/> {c.name || '名称未設定'} 様</p>
                        <p className="text-[12px] font-bold text-[#555] flex items-center gap-2"><Phone size={14} className="text-[#999]"/> {c.phone || '電話番号なし'}</p>
                        <p className="text-[11px] font-bold text-[#999] pt-1 border-t border-[#F7F7F7] truncate">{d.flowerType} / {d.receiveMethod === 'pickup' ? '店頭受取' : '配送・配達'}</p>
                      </div>

                      <div className="p-6 md:w-1/3 flex flex-col justify-center w-full">
                        <button 
                          onClick={() => handleUpdatePayment(order.id, d)}
                          className="w-full py-4 bg-[#2D4B3E] hover:bg-[#1f352b] text-white rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                        >
                          <CheckCircle2 size={18} /> 入金済にする
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : displayedSales.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-[#CCC] p-20 text-center shadow-sm">
            <p className="text-[14px] font-bold text-[#999]">売上データがありません</p>
          </div>
        ) : (
          /* ========================================================
             ★ 通常の 月別・日別 モードの表示
             ======================================================== */
          <div className="space-y-4 animate-in fade-in">
            <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2 border-b border-[#EAEAEA] pb-2">
              {viewMode === 'monthly' ? <><Calendar size={18} /> 月別売上一覧</> : <><CalendarDays size={18} /> 日別売上一覧</>}
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {displayedSales.map((item, index) => (
                <div key={item.key} className="bg-white rounded-2xl border border-[#EAEAEA] shadow-sm overflow-hidden flex flex-col md:flex-row">
                  
                  {/* 左側：タイトルとメイン売上 */}
                  <div className={`p-6 md:w-1/3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#EAEAEA] ${index === 0 ? 'bg-[#FBFAF9]' : ''}`}>
                    <span className="text-[14px] font-bold text-[#555] mb-2">{item.label}</span>
                    <span className="text-[28px] font-bold text-[#2D4B3E] leading-none mb-1">¥{item.totalSales.toLocaleString()}</span>
                    <span className="text-[11px] font-bold text-[#999]">受注件数: {item.orderCount}件</span>
                  </div>

                  {/* 右側：内訳詳細 */}
                  <div className="p-6 md:w-2/3 grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-[#999] mb-1">商品代（税抜）</p>
                      <p className="text-[16px] font-bold text-[#444]">¥{item.itemSales.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#999] mb-1">送料・手数料（税抜）</p>
                      <p className="text-[16px] font-bold text-[#444]">¥{item.shippingFees.toLocaleString()}</p>
                    </div>
                    
                    <div className="col-span-2 pt-4 border-t border-[#F7F7F7] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[#999]">客単価:</span>
                        <span className="text-[14px] font-bold text-[#2D4B3E]">¥{Math.floor(item.totalSales / item.orderCount).toLocaleString()}</span>
                      </div>
                      
                      {/* 未入金アラート */}
                      {item.unpaidCount > 0 ? (
                        <div className="flex items-center gap-1.5 bg-[#D97D54]/10 text-[#D97D54] px-3 py-1.5 rounded-lg border border-[#D97D54]/20 cursor-pointer hover:bg-[#D97D54]/20 transition-colors" onClick={() => setViewMode('unpaid')}>
                          <AlertCircle size={14} />
                          <span className="text-[11px] font-bold">未入金あり: {item.unpaidCount}件</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 size={14} />
                          <span className="text-[11px] font-bold">回収完了</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}