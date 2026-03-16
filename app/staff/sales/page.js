'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  TrendingUp, Calendar, DollarSign, ShoppingBag, 
  CreditCard, BarChart3, AlertCircle, RefreshCw,
  FileText, Printer
} from 'lucide-react';

export default function SalesPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('取得エラー:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ★ 注文データから月別の売上を自動集計
  const monthlySales = useMemo(() => {
    const map = {};

    orders.forEach(order => {
      const d = order.order_data || {};
      // キャンセルされた注文は売上から除外
      if (d.status === 'キャンセル') return;

      // 日付から「YYYY-MM」のキーを作成
      const date = new Date(order.created_at);
      const yearMonth = `${date.getFullYear()}年 ${String(date.getMonth() + 1).padStart(2, '0')}月`;

      // 金額計算
      const itemPrice = Number(d.itemPrice) || 0;
      const fee = Number(d.calculatedFee) || 0;
      const pickup = Number(d.pickupFee) || 0;
      const subTotal = itemPrice + fee + pickup;
      const tax = Math.floor(subTotal * 0.1);
      const total = subTotal + tax;

      if (!map[yearMonth]) {
        map[yearMonth] = {
          month: yearMonth,
          rawDate: date, // 並び替え用
          totalSales: 0,
          orderCount: 0,
          itemSales: 0,
          shippingFees: 0,
          unpaidCount: 0, // 未入金の件数
        };
      }

      map[yearMonth].totalSales += total;
      map[yearMonth].itemSales += itemPrice;
      map[yearMonth].shippingFees += (fee + pickup);
      map[yearMonth].orderCount += 1;

      // 未入金（支払いが完了していない）の判定
      if (!d.paymentStatus || d.paymentStatus.includes('未') || d.paymentStatus === '') {
        map[yearMonth].unpaidCount += 1;
      }
    });

    // 最新の月が一番上に来るように並び替え
    return Object.values(map).sort((a, b) => b.rawDate - a.rawDate);
  }, [orders]);

  // 全期間の合計
  const totalAllTime = monthlySales.reduce((sum, month) => sum + month.totalSales, 0);
  const totalOrdersAllTime = monthlySales.reduce((sum, month) => sum + month.orderCount, 0);

  // ==========================================
  // ★ CSVダウンロード機能
  // ==========================================
  const handleDownloadCSV = () => {
    if (monthlySales.length === 0) {
      alert('出力するデータがありません。');
      return;
    }

    // ヘッダー行
    const headers = ['対象月', '売上合計(税込)', '商品代(税抜)', '送料・手数料(税抜)', '受注件数', '平均客単価(税込)', '未入金件数'];
    
    // データ行
    const rows = monthlySales.map(m => [
      m.month,
      m.totalSales,
      m.itemSales,
      m.shippingFees,
      m.orderCount,
      Math.floor(m.totalSales / m.orderCount),
      m.unpaidCount
    ]);

    // CSV文字列の作成
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Excelで文字化けしないようにBOM(Byte Order Mark)を付与
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // ダウンロード実行
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `売上レポート_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // ★ PDF・印刷出力機能 (A4レポート形式)
  // ==========================================
  const handlePrintPDF = () => {
    if (monthlySales.length === 0) {
      alert('出力するデータがありません。');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>売上レポート_${new Date().toISOString().split('T')[0]}</title>
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
        <h1>月別売上レポート</h1>
        <div class="meta">出力日: ${new Date().toLocaleDateString('ja-JP')}</div>
        
        <div class="summary">
          <div class="summary-item">
            <div class="summary-title">全期間 累計売上(税込)</div>
            <div class="summary-value">¥${totalAllTime.toLocaleString()}</div>
          </div>
          <div class="summary-item">
            <div class="summary-title">累計受注件数</div>
            <div class="summary-value">${totalOrdersAllTime} 件</div>
          </div>
          <div class="summary-item">
            <div class="summary-title">平均客単価</div>
            <div class="summary-value">¥${totalOrdersAllTime > 0 ? Math.floor(totalAllTime / totalOrdersAllTime).toLocaleString() : 0}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>対象月</th>
              <th>売上合計(税込)</th>
              <th>商品代(税抜)</th>
              <th>送料・手数料</th>
              <th>受注件数</th>
              <th>平均客単価</th>
              <th>未入金アラート</th>
            </tr>
          </thead>
          <tbody>
            ${monthlySales.map(m => `
              <tr>
                <td class="text-center font-bold">${m.month}</td>
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
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } else {
      alert('ポップアップがブロックされました。ブラウザの設定を確認してください。');
    }
  };

  return (
    <main className="pb-32 font-sans text-left">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center justify-between px-6 md:px-8 py-4 sticky top-0 z-10 gap-4">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-black text-[#2D4B3E] tracking-tight">売上ダッシュボード</h1>
          <p className="text-[11px] font-bold text-[#999] mt-1 tracking-widest">月ごとの売上・受注件数の自動集計</p>
        </div>
        
        {/* ★ ボタン群の追加 */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button onClick={handlePrintPDF} className="flex items-center gap-2 px-4 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm">
            <Printer size={14} /> PDF / 印刷
          </button>
          <button onClick={handleDownloadCSV} className="flex items-center gap-2 px-4 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm">
            <FileText size={14} /> CSV出力 (Excel用)
          </button>
          
          <div className="w-[1px] h-6 bg-[#EAEAEA] mx-1 hidden md:block"></div>
          
          <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 bg-[#2D4B3E] text-white rounded-xl text-[11px] font-bold hover:bg-[#1f352b] transition-all shadow-sm">
            <RefreshCw size={14} /> 最新の状態に更新
          </button>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-[1000px] mx-auto space-y-8">
        
        {/* 上部：全期間サマリー */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#2D4B3E] text-white p-6 rounded-[24px] shadow-md relative overflow-hidden">
            <TrendingUp size={100} className="absolute -right-4 -bottom-4 text-white/10" />
            <h3 className="text-[12px] font-bold text-white/80 tracking-widest mb-2 flex items-center gap-2"><DollarSign size={16}/> 全期間 累計売上</h3>
            <p className="text-[32px] font-black tracking-tight">¥{totalAllTime.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <h3 className="text-[12px] font-bold text-[#999] tracking-widest mb-1 flex items-center gap-2"><ShoppingBag size={14}/> 累計受注件数</h3>
            <p className="text-[24px] font-black text-[#2D4B3E]">{totalOrdersAllTime} <span className="text-[12px] font-bold text-[#999]">件</span></p>
          </div>
          <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm flex flex-col justify-center">
            <h3 className="text-[12px] font-bold text-[#999] tracking-widest mb-1 flex items-center gap-2"><BarChart3 size={14}/> 平均客単価</h3>
            <p className="text-[24px] font-black text-[#2D4B3E]">
              ¥{totalOrdersAllTime > 0 ? Math.floor(totalAllTime / totalOrdersAllTime).toLocaleString() : 0}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 text-center text-[#999] font-bold animate-pulse tracking-widest">売上データを計算中...</div>
        ) : monthlySales.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-[#CCC] p-20 text-center shadow-sm">
            <p className="text-[14px] font-bold text-[#999]">売上データがありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-[16px] font-black text-[#2D4B3E] flex items-center gap-2 border-b border-[#EAEAEA] pb-2">
              <Calendar size={18} /> 月別売上一覧
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {monthlySales.map((month, index) => (
                <div key={month.month} className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden flex flex-col md:flex-row">
                  
                  {/* 左側：月のタイトルとメイン売上 */}
                  <div className={`p-6 md:w-1/3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#EAEAEA] ${index === 0 ? 'bg-[#FBFAF9]' : ''}`}>
                    <span className="text-[14px] font-black text-[#555] tracking-widest mb-2">{month.month}</span>
                    <span className="text-[28px] font-black text-[#2D4B3E] leading-none mb-1">¥{month.totalSales.toLocaleString()}</span>
                    <span className="text-[11px] font-bold text-[#999]">受注件数: {month.orderCount}件</span>
                  </div>

                  {/* 右側：内訳詳細 */}
                  <div className="p-6 md:w-2/3 grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-[#999] tracking-widest mb-1">商品代（税抜）</p>
                      <p className="text-[16px] font-black text-[#444]">¥{month.itemSales.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#999] tracking-widest mb-1">送料・手数料（税抜）</p>
                      <p className="text-[16px] font-black text-[#444]">¥{month.shippingFees.toLocaleString()}</p>
                    </div>
                    
                    <div className="col-span-2 pt-4 border-t border-[#F7F7F7] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[#999] tracking-widest">月間客単価:</span>
                        <span className="text-[14px] font-black text-[#2D4B3E]">¥{Math.floor(month.totalSales / month.orderCount).toLocaleString()}</span>
                      </div>
                      
                      {/* 未入金アラート（未入金がある月だけ赤く表示） */}
                      {month.unpaidCount > 0 ? (
                        <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg border border-red-100">
                          <AlertCircle size={14} />
                          <span className="text-[11px] font-bold">未入金あり: {month.unpaidCount}件</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <span className="text-[11px] font-bold">未入金なし</span>
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