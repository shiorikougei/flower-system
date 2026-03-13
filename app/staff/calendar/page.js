'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  ChevronLeft, ChevronRight, RefreshCw, X, Calendar as CalendarIcon, 
  User, MapPin, Tag, FileText, Smartphone, Archive, RotateCcw, 
  Package, Store, Truck, Send, Printer, ListChecks, AlertCircle,
  MessageSquare, CreditCard
} from 'lucide-react';

export default function CalendarPage() {
  const [orders, setOrders] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: settings } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
      if (settings) setAppSettings(settings.settings_data);

      const { data: ordersData, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      setOrders(ordersData || []);
    } catch (error) {
      console.error('取得エラー:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusOptions = () => {
    const config = appSettings?.statusConfig;
    if (config?.type === 'custom' && config?.customLabels?.length > 0) return config.customLabels;
    return ['未対応', '制作中', '制作完了', '配達中'];
  };

  const updateStatusValue = async (orderId, newStatusValue) => {
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, currentStatus: newStatusValue, status: newStatusValue };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, order_data: updatedData });
    } catch (err) { alert('更新に失敗しました。'); }
  };

  const updateArchiveStatus = async (orderId, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'new';
    if (!confirm(`この注文を${isArchive ? '完了' : '未完了'}にしますか？`)) return;
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, status: newStatus };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId);
      setOrders(orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o));
      setSelectedOrder(null);
    } catch (err) { alert('更新失敗'); }
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const calendarEvents = useMemo(() => {
    const map = {};
    orders.forEach(order => {
      const d = order.order_data || {};
      if (d.status === 'キャンセル') return;

      const addEvent = (dateStr, type) => {
        if (!dateStr) return;
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({ order, type });
      };

      if (d.receiveMethod === 'sagawa') {
        if (d.shippingDate) addEvent(d.shippingDate, 'dispatch');
        if (d.selectedDate) addEvent(d.selectedDate, 'sagawa_delivery');
      } else if (d.receiveMethod === 'pickup') {
        if (d.selectedDate) addEvent(d.selectedDate, 'pickup');
      } else if (d.receiveMethod === 'delivery') {
        if (d.selectedDate) addEvent(d.selectedDate, 'delivery');
      }
    });
    return map;
  }, [orders]);

  const calendarDays = [];
  for (let i = 0; i < startDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '業者配送' };
    return map[method] || method;
  };

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

  const getTotals = (orderData) => {
    if (!orderData) return { item: 0, fee: 0, pickup: 0, subTotal: 0, tax: 0, total: 0 };
    const item = Number(orderData.itemPrice) || 0;
    const fee = Number(orderData.calculatedFee) || 0;
    const pickup = Number(orderData.pickupFee) || 0;
    const subTotal = item + fee + pickup;
    const tax = Math.floor(subTotal * 0.1);
    return { item, fee, pickup, subTotal, tax, total: subTotal + tax };
  };

  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '日時不明';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '日時不明';
      return withTime ? d.toLocaleString('ja-JP') : d.toLocaleDateString('ja-JP');
    } catch (e) { return '日時不明'; }
  };

  // ==========================================
  // ★ 印刷ロジック (PDFのデザインを100%再現・A4 2分割ロック版)
  // ==========================================
  const handlePrint = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedOrder) return;

    try {
      const d = selectedOrder.order_data || {};
      const customer = d.customerInfo || {};
      const recipient = d.isRecipientDifferent ? (d.recipientInfo || {}) : customer;
      const totals = getTotals(d);
      const staffName = d.staffName || "";

      const formatText = (txt) => String(txt || '');
      const safeId = String(selectedOrder.id || '').slice(0, 8);
      const receiveMethodStr = getMethodLabel(d.receiveMethod);
      const datePart = d.selectedDate || '未指定';
      const paymentStatus = d.paymentMethod ? `${d.paymentMethod}${d.paymentStatus ? `(${d.paymentStatus})` : ''}` : '未設定';

      const formatPrice = (price) => `¥${Number(price || 0).toLocaleString()}`;

      // お店情報 (SettingsPageの設定から反映)
      const shop = (appSettings?.shops || [])[0] || {};
      const shopName = appSettings?.generalConfig?.appName || '花・花OHANA！';
      const shopZip = shop.zip || '0010025';
      const shopAddress = shop.address || '北海道札幌市北区北２５条西４丁目３−８ クレアノース25 1階';
      const shopTel = shop.phone || '011-600-1878';
      const shopInvoice = shop.invoiceNumber || 'T1234567891012';

      const renderSlip = (title, type, hidePrice = false, showReceiptNote = false) => {
        const titleColors = { order_store: '#117768', customer: '#1a56a8', delivery: '#333', receipt: '#333' };
        return `
          <div class="slip">
            <div class="slip-header">
              <div class="slip-title" style="color:${titleColors[type]}">${title}</div>
              <div class="meta-area">
                <div>伝票：${safeId}    受付：${safeFormatDate(selectedOrder.created_at, false)}</div>
                <div>お渡し：${receiveMethodStr}    希望日：${datePart}</div>
                <div>入金状況：${paymentStatus}</div>
              </div>
            </div>

            <div class="info-grid">
              <div class="info-box">
                <div class="info-title">【ご依頼主様（ご注文者）】</div>
                <div class="info-main">${formatText(customer.name)} 様</div>
                <div class="info-sub-bottom">
                  <div>〒${formatText(customer.zip)}</div>
                  <div>${formatText(customer.address1)} ${formatText(customer.address2)}</div>
                  <div>TEL: ${formatText(customer.phone)}</div>
                </div>
              </div>
              <div class="info-box">
                <div class="info-title">【お届け先様】</div>
                ${d.isRecipientDifferent ? `
                  <div class="info-main">${formatText(recipient.name)} 様</div>
                  <div class="info-sub-bottom">
                    <div>〒${formatText(recipient.zip)}</div>
                    <div>${formatText(recipient.address1)} ${formatText(recipient.address2)}</div>
                    <div>TEL: ${formatText(recipient.phone)}</div>
                  </div>
                ` : `<div class="same-text">ご依頼主様と同じ</div>`}
              </div>
            </div>

            <div class="items-area">
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="text-align:left;">商品名・内容</th>
                    <th style="width:18mm; text-align:center;">数量</th>
                    <th style="width:26mm; text-align:right;">金額(税抜)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="item-cell">
                      <div class="item-name">${formatText(d.flowerType)}</div>
                      <div class="item-detail">用途: ${formatText(d.flowerPurpose)} / 色: ${formatText(d.flowerColor)} / イメージ: ${formatText(d.flowerVibe)}</div>
                      
                      ${d.cardType && d.cardType !== 'なし' ? `
                        <div class="extra-box">
                          <div class="extra-title">【${d.cardType}の内容】</div>
                          <div class="extra-text">${d.cardType === '立札' ? 
                            (d.tatePattern ? `<span style="color:#d32f2f;">${formatText(d.tatePattern)}</span><br/>` : '') + 
                            [d.tateInput1, d.tateInput2, d.tateInput3, d.tateInput3a, d.tateInput3b].filter(Boolean).join('<br/>') : 
                            formatText(d.cardMessage).replace(/\n/g, '<br/>')}</div>
                        </div>
                      ` : ''}
                      
                      ${d.note ? `<div class="item-detail" style="color:#d97c8f; margin-top:2mm;">備考: ${formatText(d.note)}</div>` : ''}
                    </td>
                    <td class="qty-cell">1</td>
                    <td class="price-cell">${hidePrice ? '' : formatPrice(d.itemPrice)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="display:flex; justify-content:flex-end;">
              <table class="amount-summary">
                <tr><td class="amount-label">商品代</td><td class="amount-val">${hidePrice ? '' : formatPrice(totals.item)}</td></tr>
                <tr><td class="amount-label">送料・手数料</td><td class="amount-val">${hidePrice ? '' : formatPrice(totals.fee + totals.pickup)}</td></tr>
                <tr><td class="amount-label">消費税(10%)</td><td class="amount-val">${hidePrice ? '' : formatPrice(totals.tax)}</td></tr>
                <tr><td class="amount-label-total">合計</td><td class="amount-val-total">${hidePrice ? '' : formatPrice(totals.total)}</td></tr>
              </table>
            </div>

            ${showReceiptNote ? `<div class="receipt-note">上記の商品を確かに受領いたしました。     受領日：    年    月    日      サインまたは印</div>` : ''}

            <div class="footer">
              <div class="shop-block">
                <div class="shop-name">${shopName}</div>
                <div>〒${shopZip} ${shopAddress}</div>
                <div>TEL: ${shopTel} (${shopInvoice})</div>
              </div>
              <div class="footer-actions">
                ${['受注', '配達', '片付', '請求'].map(label => {
                  const isFilled = (label === '受注') || ((type === 'delivery' || type === 'receipt') && label === '配達');
                  return `
                    <div class="check-group">
                      <div class="check-label">${label}</div>
                      <div class="check-box ${isFilled ? 'filled' : ''}">${isFilled ? staffName : ''}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `;
      };

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif; color: #222; }
            * { box-sizing: border-box; }
            .page { width: 210mm; height: 296mm; background: #fff; display: flex; flex-direction: column; position: relative; overflow: hidden; page-break-after: always; }
            .slip { width: 100%; height: 148mm; padding: 12mm 15mm; display: flex; flex-direction: column; position: relative; overflow: hidden; }
            .slip:first-child { border-bottom: 1px dashed #aaa; }
            .cutline { position: absolute; top: 148mm; left: 0; right: 0; text-align: center; z-index: 10; transform: translateY(-50%); }
            .cutline span { background: #fff; padding: 0 5mm; font-size: 8pt; color: #888; letter-spacing: 0.2em; }
            .slip-header { display: flex; justify-content: space-between; margin-bottom: 3mm; }
            .slip-title { font-size: 16pt; font-weight: bold; letter-spacing: 0.3em; }
            .meta-area { font-size: 8pt; text-align: right; font-weight: bold; line-height: 1.4; }
            .info-grid { display: flex; gap: 4mm; height: 24mm; margin-bottom: 4mm; }
            .info-box { flex: 1; border: 0.5pt solid #444; padding: 2mm; display: flex; flex-direction: column; position: relative; }
            .info-title { font-size: 7pt; font-weight: bold; margin-bottom: 1mm; }
            .info-main { font-size: 13pt; font-weight: bold; }
            .info-sub-bottom { margin-top: auto; font-size: 8pt; line-height: 1.2; }
            .same-text { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 12pt; color: #888; font-weight: bold; letter-spacing: 0.1em; }
            .items-area { flex-grow: 1; margin-bottom: 2mm; }
            .items-table { width: 100%; border-collapse: collapse; border-top: 0.5pt solid #444; border-bottom: 0.5pt solid #444; }
            .items-table th { font-size: 8pt; padding: 1.5mm 1mm; background: #fafafa; border-bottom: 0.5pt solid #444; text-align: left; }
            .item-cell { padding: 2mm 1mm; vertical-align: top; }
            .item-name { font-size: 12pt; font-weight: bold; margin-bottom: 1mm; }
            .item-detail { font-size: 8pt; color: #555; }
            .qty-cell, .price-cell { text-align: center; font-weight: bold; padding-top: 2mm; vertical-align: top; font-size: 10pt; }
            .price-cell { text-align: right; width: 26mm; }
            .extra-box { border: 0.5pt dashed #999; padding: 2mm; width: 65mm; margin-top: 2mm; font-size: 9pt; }
            .extra-title { font-size: 7pt; font-weight: bold; color: #666; }
            .extra-text { font-size: 8pt; font-weight: bold; line-height: 1.3; }
            .amount-summary { width: 65mm; border-collapse: collapse; font-size: 8.5pt; }
            .amount-summary td { border: 0.5pt solid #999; padding: 1.2mm 2mm; text-align: right; font-weight: bold; height: 23px; }
            .amount-label { background: #f9f9f9; text-align: left !important; width: 50%; }
            .amount-label-total { background: #f9f9f9; font-weight: bold; color: #117768; }
            .amount-val-total { color: #117768; font-size: 11pt; }
            .receipt-note { margin: 2mm 0; font-size: 8.5pt; border: 1px solid #eee; padding: 2mm; }
            .footer { margin-top: auto; border-top: 0.5pt dashed #bbb; padding-top: 3mm; display: flex; justify-content: space-between; align-items: flex-end; }
            .shop-name { font-size: 13pt; font-weight: 900; margin-bottom: 1mm; }
            .shop-block { font-size: 8pt; line-height: 1.4; color: #444; }
            .footer-actions { display: flex; gap: 2mm; }
            .check-group { display: flex; flex-direction: column; align-items: center; }
            .check-label { font-size: 6.5pt; color: #666; font-weight: bold; margin-bottom: 0.5mm; }
            .check-box { border: 0.5pt solid #666; width: 14mm; height: 6mm; display: flex; align-items: center; justify-content: center; font-size: 7pt; font-weight: bold; border-radius: 1px; }
            .check-box.filled { background: #fff; }
          </style>
        </head>
        <body>
          <div class="page">
            ${renderSlip('受 注 書 (店舗控)', 'order_store')}
            <div class="cutline"><span>✂ 切り取り線</span></div>
            ${renderSlip('ご 注 文 内 容 (お客様控)', 'customer')}
          </div>
          <div class="page">
            ${renderSlip('納 品 書', 'delivery', true)}
            <div class="cutline"><span>✂ 切り取り線</span></div>
            ${renderSlip('受 領 書', 'receipt', true, true)}
          </div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
        </body>
        </html>
      `;

      const p = window.open('', '_blank');
      if (p) {
        p.document.write(html);
        p.document.close();
      }

    } catch (err) {
      console.error("印刷エラー:", err);
      alert("印刷ウィンドウを開けませんでした。ポップアップを許可してください。");
    }
  };

  const handleSendEmail = (e) => {
    e.preventDefault(); e.stopPropagation();
    const d = selectedOrder?.order_data || {};
    if (!d?.customerInfo?.email) { alert("メールアドレスなし"); return; }
    const email = d.customerInfo.email;
    const template = appSettings?.autoReply || { subject: 'ご注文ありがとうございます', body: '{CustomerName} 様' };
    const totals = getTotals(d);
    const subject = encodeURIComponent(template.subject);
    const body = encodeURIComponent(template.body.replace('{CustomerName}', d.customerInfo.name).replace('{OrderDetails}', `商品: ${d.flowerType}\n合計: ¥${totals.total.toLocaleString()}`));
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const renderDay = (day, index) => {
    if (!day) return <div key={`empty-${index}`} className="min-h-[80px] md:min-h-[120px] bg-[#FBFAF9]/50 border-r border-b border-[#EAEAEA]"></div>;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = calendarEvents[dateStr] || []; 
    const isToday = new Date().toISOString().split('T')[0] === dateStr;

    return (
      <div key={day} className={`min-h-[80px] md:min-h-[120px] p-1 md:p-2 border-r border-b border-[#EAEAEA] bg-white transition-all hover:bg-gray-50/50 ${isToday ? 'bg-[#2D4B3E]/5' : ''}`}>
        <div className={`text-[10px] md:text-[11px] font-bold mb-1 md:mb-2 flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full mx-auto ${isToday ? 'bg-[#2D4B3E] text-white' : 'text-[#555555]'}`}>{day}</div>
        <div className="space-y-1 max-h-[80px] md:max-h-[100px] overflow-y-auto hide-scrollbar">
          {dayEvents.map((ev, idx) => (
            <div key={`${ev.order.id}-${idx}`} onClick={() => setSelectedOrder(ev.order)} 
                 className={`text-[8px] md:text-[10px] p-1 md:p-1.5 rounded cursor-pointer truncate transition-all ${ev.type === 'pickup' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-blue-50 text-blue-700 border border-blue-200'} ${ev.order.order_data.status === 'completed' ? 'opacity-40 line-through' : ''}`}>
              <span className="font-bold">{ev.order.order_data.selectedTime?.split('-')[0] || '予定'}</span> {ev.order.order_data.customerInfo?.name}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="pb-32 font-sans">
      <header className="bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 py-3 md:h-20 gap-3 sticky top-0 z-10">
        <div className="flex items-center justify-between w-full md:w-auto">
          <h1 className="text-[16px] md:text-[18px] font-bold tracking-tight text-[#2D4B3E]">納品カレンダー</h1>
          <button onClick={fetchData} className="md:hidden flex items-center gap-1 px-3 py-1.5 bg-white border border-[#EAEAEA] rounded-lg text-[10px] font-bold text-[#555555] hover:border-[#2D4B3E] transition-all shadow-sm"><RefreshCw size={12} /></button>
        </div>
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-1 md:gap-2 bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] w-full md:w-auto justify-between">
            <button onClick={prevMonth} className="p-2 text-[#555555]"><ChevronLeft size={16}/></button>
            <span className="px-2 md:px-3 font-bold text-[12px] md:text-[13px] min-w-[90px] md:min-w-[100px] text-center">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</span>
            <button onClick={nextMonth} className="p-2 text-[#555555]"><ChevronRight size={16}/></button>
          </div>
          <button onClick={fetchData} className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] transition-all shadow-sm shrink-0">表示更新</button>
        </div>
      </header>

      <div className="p-2 md:p-8 max-w-[1400px] mx-auto">
        {isLoading ? (
          <div className="p-20 text-center text-[#999999] font-bold animate-pulse tracking-widest">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-[16px] md:rounded-[32px] border border-[#EAEAEA] shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-[#EAEAEA] bg-[#FBFAF9]">
               {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                 <div key={d} className={`p-2 md:p-3 text-center text-[8px] md:text-[10px] font-bold tracking-widest uppercase border-r border-[#EAEAEA] last:border-0 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[#999999]'}`}>{d}</div>
               ))}
            </div>
            <div className="grid grid-cols-7">
               {calendarDays.map((day, i) => renderDay(day, i))}
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111111]/60 backdrop-blur-sm p-3 md:p-4 animate-in fade-in" onClick={() => setSelectedOrder(null)}>
          <div className="bg-[#FBFAF9] rounded-[24px] md:rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#EAEAEA] p-4 md:p-6 flex flex-wrap items-center justify-between gap-3 z-20 rounded-t-[24px] md:rounded-t-[32px]">
              <div>
                <div className="flex items-center gap-3 text-left">
                  <h2 className="text-[16px] md:text-[18px] font-black text-[#2D4B3E]">注文詳細</h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedOrder.order_data.status === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                    {selectedOrder.order_data.status === 'completed' ? '完了' : '未完了'}
                  </span>
                </div>
                <p className="text-[10px] md:text-[11px] text-[#999999] font-bold mt-1 text-left">受付: {safeFormatDate(selectedOrder.created_at, true)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all shadow-sm">
                  <Printer size={16} /> 印刷 / PDF出力
                </button>
                <button onClick={handleSendEmail} className="w-10 h-10 bg-white border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555] hover:border-[#2D4B3E] transition-all"><Send size={18} /></button>
                <button onClick={() => updateArchiveStatus(selectedOrder.id, selectedOrder.order_data.status !== 'completed')} className="w-10 h-10 bg-white border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555] hover:border-[#2D4B3E] transition-all">{selectedOrder.order_data.status === 'completed' ? <RotateCcw size={18}/> : <Archive size={18}/>}</button>
                <button onClick={() => setSelectedOrder(null)} className="w-8 h-8 md:w-10 md:h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555555] font-bold hover:bg-[#EAEAEA] transition-colors"><X size={18} /></button>
              </div>
            </div>
            
            <div className="p-4 md:p-8 space-y-6 md:space-y-8 text-left">
              <div className="bg-white p-5 rounded-[24px] border border-[#EAEAEA] shadow-sm flex items-center justify-between">
                <div className={`px-3 py-1.5 rounded-lg text-[12px] font-bold ${selectedOrder.order_data.receiveMethod === 'pickup' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                  {getMethodLabel(selectedOrder.order_data.receiveMethod)}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[#999999]">ステータス</span>
                  <select value={selectedOrder.order_data.currentStatus || 'new'} onChange={(e) => updateStatusValue(selectedOrder.id, e.target.value)} className="h-10 bg-white border border-[#EAEAEA] rounded-xl px-3 text-[12px] font-bold outline-none cursor-pointer">
                    <option value="new">未対応</option>
                    {getStatusOptions().map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b pb-2 flex items-center gap-2"><User size={18}/> 注文者</h3>
                  <div className="space-y-1">
                    <p className="font-black text-[18px]">{selectedOrder.order_data.customerInfo?.name} 様</p>
                    <p className="text-[#555] font-bold">{selectedOrder.order_data.customerInfo?.phone}</p>
                    <p className="text-[#999] text-[12px] pt-2 border-t">〒{selectedOrder.order_data.customerInfo?.zip}<br/>{selectedOrder.order_data.customerInfo?.address1} {selectedOrder.order_data.customerInfo?.address2}</p>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b pb-2 flex items-center gap-2"><MapPin size={18}/> お届け先</h3>
                  {selectedOrder.order_data.isRecipientDifferent ? (
                    <div className="space-y-1">
                      <p className="font-black text-[18px]">{modalTargetInfo?.name} 様</p>
                      <p className="text-[#555] font-bold">{modalTargetInfo?.phone}</p>
                      <p className="text-[#999] text-[12px] pt-2 border-t">〒{modalTargetInfo?.zip}<br/>{modalTargetInfo?.address1} {modalTargetInfo?.address2}</p>
                    </div>
                  ) : <div className="h-full flex items-center justify-center text-[#999] font-bold italic">注文者と同じ</div>}
                </div>
              </div>

              <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b pb-2 flex items-center gap-2"><Tag size={18}/> 商品・オーダー詳細</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div><span className="text-[#999] text-[10px] block mb-1">種類</span><span className="font-black text-[16px]">{selectedOrder.order_data.flowerType}</span></div>
                  <div><span className="text-[#999] text-[10px] block mb-1">用途</span><span className="font-bold">{selectedOrder.order_data.flowerPurpose}</span></div>
                  <div><span className="text-[#999] text-[10px] block mb-1">カラー</span><span className="font-bold">{selectedOrder.order_data.flowerColor}</span></div>
                  <div><span className="text-[#999] text-[10px] block mb-1">イメージ</span><span className="font-bold">{selectedOrder.order_data.flowerVibe}</span></div>
                </div>
                {selectedOrder.order_data.cardType !== 'なし' && (
                  <div className="mt-4 p-4 bg-[#FBFAF9] rounded-xl border border-dashed border-[#CCC] space-y-2">
                    <span className="text-[11px] font-bold text-[#2D4B3E] bg-[#2D4B3E]/5 px-2 py-0.5 rounded">{selectedOrder.order_data.cardType}</span>
                    <p className="text-[13px] font-bold whitespace-pre-wrap">{selectedOrder.order_data.cardType === '立札' ? [selectedOrder.order_data.tatePattern, selectedOrder.order_data.tateInput1, selectedOrder.order_data.tateInput2, selectedOrder.order_data.tateInput3].filter(Boolean).join('\n') : selectedOrder.order_data.cardMessage}</p>
                  </div>
                )}
              </div>

              <div className="bg-white p-8 rounded-[32px] border-2 border-[#2D4B3E]/10 shadow-md space-y-4">
                <h3 className="text-[16px] font-black text-[#2D4B3E] flex items-center gap-2"><CreditCard size={20}/> お支払い情報</h3>
                <div className="space-y-2 text-[14px] font-bold text-[#555]">
                  <div className="flex justify-between"><span>商品代(税抜):</span><span>¥{(selectedOrder.order_data.itemPrice || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>送料・手数料:</span><span>¥{(Number(selectedOrder.order_data.calculatedFee || 0) + Number(selectedOrder.order_data.pickupFee || 0)).toLocaleString()}</span></div>
                  <div className="flex justify-between border-t-2 border-[#F7F7F7] pt-4 text-[#2D4B3E] text-[24px] font-black">
                    <span>合計(税込):</span><span>¥{getTotals(selectedOrder.order_data).total.toLocaleString()}</span>
                  </div>
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