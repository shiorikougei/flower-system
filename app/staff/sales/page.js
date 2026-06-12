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
import OrderDetailModal from '@/components/OrderDetailModal';
import { getCurrentStaff } from '@/utils/staffRole';

export default function SalesPage() {
  return <FeatureGate feature="sales" label="売上管理"><SalesPageInner/></FeatureGate>;
}

function SalesPageInner() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTenantId, setCurrentTenantId] = useState(null);

  // ★ 表示モードに 'unpaid' (未入金一覧) と 'byStaff' (担当者別) を追加！
  const [viewMode, setViewMode] = useState('monthly'); // 'monthly', 'daily', 'unpaid', 'byStaff'
  // [業務-3] 担当者別売上の閲覧権限（owner/manager のみ）
  const [canViewByStaff, setCanViewByStaff] = useState(false);
  const [targetMonth, setTargetMonth] = useState('');

  // ★ 入金確認モーダル
  const [paymentModalOrder, setPaymentModalOrder] = useState(null); // { id, order_data }
  // ★ ④ 受注詳細モーダル
  const [detailOrder, setDetailOrder] = useState(null);
  const [appSettings, setAppSettings] = useState(null);
  const [confirmDeliveryDate, setConfirmDeliveryDate] = useState('');
  const [confirmDeliveryTime, setConfirmDeliveryTime] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

      const [ordersRes, settingsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false }),
        supabase.from('app_settings').select('settings_data').eq('id', tId).single(),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      setOrders(ordersRes.data || []);
      if (settingsRes.data?.settings_data) setAppSettings(settingsRes.data.settings_data);

      // [業務-3] 権限判定: owner/manager のみ担当者別ビュー可
      try {
        const me = getCurrentStaff();
        const role = me?.role || '';
        if (role === 'owner' || role === 'manager' || me?.isOwner) {
          setCanViewByStaff(true);
        }
      } catch {}
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

  // [業務-3] 担当者別売上集計（attributed_staff_name でグループ化）
  const byStaffData = useMemo(() => {
    if (!targetMonth) return [];
    const groups = {};
    orders.forEach(order => {
      const d = order.order_data || {};
      if (d.status === 'キャンセル') return;
      const date = new Date(order.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey !== targetMonth) return;
      // 担当者個人受付 only（attributed_staff_id がある注文）
      const staffName = order.attributed_staff_name || d.attributedStaffName;
      if (!staffName) return;
      if (!groups[staffName]) {
        groups[staffName] = {
          staffName,
          orderCount: 0,
          totalSales: 0,
          totalItem: 0,
          totalFee: 0,
        };
      }
      groups[staffName].orderCount += 1;
      groups[staffName].totalSales += Number(d.totalAmount || 0);
      groups[staffName].totalItem += Number(d.itemPrice || 0);
      groups[staffName].totalFee += Number(d.calculatedFee || 0) + Number(d.ecBoxFee || 0);
    });
    return Object.values(groups)
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [orders, targetMonth]);

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
  // ★ 入金確認モーダルを開く（受注一覧と同じフロー）
  // ==========================================
  const openPaymentModal = (orderId, currentData) => {
    setPaymentModalOrder({ id: orderId, order_data: currentData });
    setConfirmDeliveryDate(currentData.selectedDate || '');
    setConfirmDeliveryTime(currentData.selectedTime || '');
  };

  const closePaymentModal = () => {
    if (isProcessingPayment) return;
    setPaymentModalOrder(null);
    setConfirmDeliveryDate('');
    setConfirmDeliveryTime('');
  };

  // ★ モーダルで確定 → DB更新 + payment_confirmed メール/LINE自動送信
  const handleConfirmPayment = async () => {
    if (!paymentModalOrder) return;
    if (!confirmDeliveryDate) {
      alert('納品予定日を入力してください');
      return;
    }
    setIsProcessingPayment(true);
    try {
      const currentData = paymentModalOrder.order_data || {};
      const orderId = paymentModalOrder.id;

      // 1. 入金状態 + 納品日を更新
      const oldStatus = currentData.paymentStatus || '';
      let newStatus = '入金済';
      if (oldStatus.includes('引き取り時')) newStatus = '入金済（引き取り時受領）';

      const updatedData = {
        ...currentData,
        paymentStatus: newStatus,
        selectedDate: confirmDeliveryDate,
        selectedTime: confirmDeliveryTime || currentData.selectedTime || '',
      };

      const { error } = await supabase
        .from('orders')
        .update({ order_data: updatedData })
        .eq('id', orderId)
        .eq('tenant_id', currentTenantId);
      if (error) throw error;

      // 2. payment_confirmed メール/LINE自動送信
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch('/api/staff/send-template-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ orderId, triggerId: 'payment_confirmed' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn('入金確認メール送信失敗:', data?.error);
          alert(`入金済みに更新しましたが、メール送信に失敗しました: ${data?.error || ''}`);
        }
      }

      // 3. ローカル State 反映
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      setPaymentModalOrder(null);
      alert('入金済みに更新し、お客様にメール/LINEを送信しました ✉️');
    } catch (err) {
      console.error(err);
      alert(`処理に失敗しました: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
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
            {/* [業務-3] 担当者別タブ（owner/manager のみ表示） */}
            {canViewByStaff && (
              <button onClick={() => setViewMode('byStaff')} className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${viewMode === 'byStaff' ? 'bg-[#2D4B3E] shadow-sm text-white' : 'text-[#999]'}`}>
                <User size={14}/> 担当者別
              </button>
            )}
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
        ) : viewMode === 'byStaff' ? (
          /* ========================================================
             [業務-3] 担当者別売上モード
             ======================================================== */
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-2">
              <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2">
                <User size={18} /> 担当者別売上 ({targetMonth.replace('-', '年')}月)
              </h2>
              <select value={targetMonth} onChange={(e) => setTargetMonth(e.target.value)} className="h-10 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#555] outline-none">
                {availableMonths.map(m => <option key={m} value={m}>{m.replace('-', '年')}月</option>)}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 leading-relaxed">
              📊 受付区分が「担当者個人受付」の注文のみを担当者ごとに集計しています。<br/>
              💡 電話受付・店頭受付は含まれません。担当者が個人で獲得した売上のみが対象です。
            </div>

            {byStaffData.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-[#CCC] p-20 text-center">
                <p className="text-[14px] font-bold text-[#999]">この月の担当者個人受付の注文はありません</p>
                <p className="text-[11px] text-[#CCC] mt-2">新規注文時に「担当者個人受付」を選択すると、ここに集計されます</p>
              </div>
            ) : (
              <div className="space-y-3">
                {byStaffData.map((s, idx) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3;
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
                  return (
                    <div key={s.staffName} className={`bg-white rounded-2xl p-5 border ${isTop3 ? 'border-[#D97D54] shadow-md' : 'border-[#EAEAEA]'} flex items-center gap-4`}>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FBE8DF] to-[#F4D4C4] flex items-center justify-center shrink-0 text-[20px] font-bold text-[#C97D60]">
                        {medal || rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-[#2D4B3E] truncate">{s.staffName}</p>
                        <div className="flex gap-4 mt-1 text-[11px] text-[#666]">
                          <span>受注 <strong className="text-[#2D4B3E]">{s.orderCount}件</strong></span>
                          <span>客単価 <strong className="text-[#2D4B3E]">¥{Math.round(s.totalSales / s.orderCount).toLocaleString()}</strong></span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-[#999] font-bold">売上合計 (税込)</p>
                        <p className="text-[22px] font-bold text-[#C97D60]">¥{s.totalSales.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}

                {/* 合計 */}
                <div className="bg-[#2D4B3E] text-white rounded-2xl p-5 flex items-center justify-between">
                  <span className="text-[14px] font-bold">担当者個人受付 合計</span>
                  <span className="text-[22px] font-bold">¥{byStaffData.reduce((sum, s) => sum + s.totalSales, 0).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
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

                      {/* ★ ④ クリックで詳細モーダルを開く（左2/3エリア） */}
                      <button
                        type="button"
                        onClick={() => setDetailOrder(order)}
                        className="p-6 md:w-1/3 flex flex-col justify-center w-full border-b md:border-b-0 md:border-r border-[#EAEAEA] text-left hover:bg-[#FBFAF9] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold bg-[#D97D54]/10 text-[#D97D54] px-2 py-1 rounded-md">{d.paymentStatus || '未設定'}</span>
                          <span className="text-[12px] font-bold text-[#999]">{safeFormatDate(order.created_at)}</span>
                        </div>
                        <span className="text-[24px] font-bold text-[#D97D54] leading-none mb-1">¥{order.computedTotal.toLocaleString()}</span>
                        <span className="text-[10px] text-[#999] mt-1">タップで詳細を表示 →</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailOrder(order)}
                        className="p-6 md:w-1/3 flex flex-col justify-center w-full space-y-2 border-b md:border-b-0 md:border-r border-[#EAEAEA] text-left hover:bg-[#FBFAF9] transition-colors"
                      >
                        <p className="text-[14px] font-bold text-[#333] flex items-center gap-2"><User size={14} className="text-[#999]"/> {c.name || '名称未設定'} 様</p>
                        <p className="text-[12px] font-bold text-[#555] flex items-center gap-2"><Phone size={14} className="text-[#999]"/> {c.phone || '電話番号なし'}</p>
                        <p className="text-[11px] font-bold text-[#999] pt-1 border-t border-[#F7F7F7] truncate">{d.flowerType} / {d.receiveMethod === 'pickup' ? '店頭受取' : '配送・配達'}</p>
                      </button>

                      <div className="p-6 md:w-1/3 flex flex-col justify-center w-full">
                        <button
                          onClick={() => openPaymentModal(order.id, d)}
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

      {/* ★ ④ 受注詳細モーダル（未入金カードから開く） */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          appSettings={appSettings}
          onClose={() => setDetailOrder(null)}
          onUpdateStatus={async () => {
            await fetchOrders();
          }}
          onDelete={async () => {
            await fetchOrders();
            setDetailOrder(null);
          }}
        />
      )}

      {/* ★ 入金確認モーダル（受注一覧と同じフロー: 納品日確定+メール/LINE送信） */}
      {paymentModalOrder && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111111]/70 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={closePaymentModal}
        >
          <div
            className="bg-white rounded-[24px] w-full max-w-md shadow-2xl p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-[#117768]/10 rounded-full flex items-center justify-center">
                <CheckCircle2 size={22} className="text-[#117768]" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-[#111111]">ご入金確認</h3>
                <p className="text-[11px] text-[#999999] mt-0.5">納品予定日を確定してお客様へ通知します</p>
              </div>
            </div>

            <div className="bg-[#FBFAF9] rounded-xl p-4 mb-4 border border-[#EAEAEA] text-[12px] text-[#555] space-y-1">
              <div><span className="text-[#999]">ご注文者:</span> <span className="font-bold text-[#111]">{paymentModalOrder.order_data?.customerInfo?.name || '-'}</span></div>
              <div><span className="text-[#999]">合計金額:</span> <span className="font-bold text-[#2D4B3E]">¥{(orders.find(o => o.id === paymentModalOrder.id)?.computedTotal || 0).toLocaleString()}</span></div>
              <div><span className="text-[#999]">現在の納品予定日:</span> <span className="font-bold">{paymentModalOrder.order_data?.selectedDate || '未指定'} {paymentModalOrder.order_data?.selectedTime || ''}</span></div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] font-bold text-[#555] mb-1.5 tracking-widest">新しい納品日</label>
                <input
                  type="date"
                  value={confirmDeliveryDate}
                  onChange={(e) => setConfirmDeliveryDate(e.target.value)}
                  className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#555] mb-1.5 tracking-widest">時間（任意）</label>
                <input
                  type="text"
                  value={confirmDeliveryTime}
                  onChange={(e) => setConfirmDeliveryTime(e.target.value)}
                  placeholder="例: 14:00〜16:00"
                  className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-[11px] text-blue-900 leading-relaxed">
              ✉️ 確定すると、お客様に「入金確認・納品日のお知らせ」メール／LINEが自動送信されます
            </div>

            <div className="flex gap-2">
              <button
                onClick={closePaymentModal}
                disabled={isProcessingPayment}
                className="flex-1 h-11 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-xl hover:bg-[#dcdcdc] disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isProcessingPayment}
                className="flex-1 h-11 bg-[#117768] text-white text-[12px] font-bold rounded-xl hover:bg-[#0f6358] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isProcessingPayment ? '送信中...' : <><CheckCircle2 size={15}/>確定 + メール送信</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}