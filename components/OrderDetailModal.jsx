'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase'; 
import { 
  X, Printer, Send, Archive, RotateCcw, Trash2, 
  Store, Truck, Package, ListChecks, ChevronRight, 
  Calendar as CalendarIcon, User, MapPin, AlertCircle, 
  Tag, MessageSquare, CreditCard, CheckCircle2, Upload, ImageIcon 
} from 'lucide-react';
import TatefudaPreview from '@/components/TatefudaPreview';

export default function OrderDetailModal({ 
  order, 
  appSettings, 
  onClose, 
  onUpdateStatus, 
  onUpdatePayment, 
  onArchive, 
  onDelete 
}) {
  const [updateForm, setUpdateForm] = useState({ 
    status: order?.order_data?.currentStatus || order?.order_data?.status || 'new', 
    staff: '' 
  });
  
  const [isUploading, setIsUploading] = useState(false);

  // ★ 新規追加：メールテンプレート選択メニューの表示状態
  const [showMailTemplates, setShowMailTemplates] = useState(false);

  // ★ 入金確認モーダル（銀行振込の手動入金確認 + 納品日変更 + 自動メール送信）
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [confirmDeliveryDate, setConfirmDeliveryDate] = useState('');
  const [confirmDeliveryTime, setConfirmDeliveryTime] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    setUpdateForm({
      status: order?.order_data?.currentStatus || order?.order_data?.status || 'new',
      staff: ''
    });
    setShowMailTemplates(false);
    // ★ モーダル開閉時に納品日初期値をセット
    setConfirmDeliveryDate(order?.order_data?.selectedDate || '');
    setConfirmDeliveryTime(order?.order_data?.selectedTime || '');
    setShowPaymentConfirmModal(false);
  }, [order]);

  if (!order) return null;

  const modalData = order.order_data || {};
  const modalTargetInfo = modalData.isRecipientDifferent ? (modalData.recipientInfo || {}) : (modalData.customerInfo || {});
  const isSagawa = modalData.receiveMethod === 'sagawa';
  const isPickup = modalData.receiveMethod === 'pickup';
  const isDelivery = modalData.receiveMethod === 'delivery';

  // ★ Stripe決済反映: DB の payment_status カラムが 'paid' なら入金済として扱う
  //    （Webhook で自動更新される）order_data.paymentStatus が空でも自動で「入金済（クレジットカード）」と表示
  const dbPaymentStatus = order?.payment_status;
  const isPaidByCard = dbPaymentStatus === 'paid';
  const orderDataStatus = modalData.paymentStatus;
  const isUnpaid = !isPaidByCard && (!orderDataStatus || orderDataStatus.includes('未') || orderDataStatus === '');
  const currentPaymentStatus = (isPaidByCard && (!orderDataStatus || orderDataStatus.includes('未')))
    ? '入金済（クレジットカード）'
    : (orderDataStatus || '未設定');

  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '日時不明';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '日時不明';
      return withTime ? d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ja-JP');
    } catch (e) { return '日時不明'; }
  };

  const getMethodLabel = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '業者配送' };
    return map[method] || method;
  };

  // ★ 支払方法のラベル変換
  const getPaymentLabel = (method) => {
    const map = {
      card: 'クレジットカード決済',
      bank_transfer: '銀行振込',
      cash: '現金',
      cod: '代金引換',
      paid_card: '前払い済み（カード）',
      paid_cash: '前払い済み（現金）',
    };
    return map[method] || method || '未設定';
  };

  const getGoogleMapsUrl = (info) => {
    try {
      if (!info) return '#';
      const address = `${info.address1 || ''} ${info.address2 || ''}`.trim();
      if (!address) return '#';
      return `http://maps.google.com/maps?q=${encodeURIComponent(address)}`;
    } catch (e) { return '#'; }
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

  const getStatusOptions = () => {
    const config = appSettings?.statusConfig;
    // ★ EC注文 → ecLabels を優先
    if (modalData?.isEc || modalData?.cartItems?.length > 0) {
      if (config?.ecLabels?.length > 0) return config.ecLabels;
      return ['受注', '発送準備中', '発送済み', '完了'];
    }
    // ★ 花の種類別ステータス（オーダー商品）
    const ft = modalData?.flowerType;
    if (ft && config?.orderTypeLabels?.[ft]?.length > 0) {
      return config.orderTypeLabels[ft];
    }
    // ★ オーダー共通
    if (config?.type === 'custom' && config?.customLabels?.length > 0) return config.customLabels;
    return ['受注', '制作', '配達', '片付', '請求'];
  };

  const isOsonae = modalData.flowerPurpose?.includes('供') || modalData.flowerPurpose?.includes('悔') || modalData.flowerPurpose?.includes('葬') || modalData.flowerPurpose?.includes('忌');
  const allTateOptions = isOsonae ? [
    { id: 'p1', label: '① 御供｜横型 (背景あり)', needs: ['3'], layout: 'horizontal' },
    { id: 'p3', label: '② 御供｜縦型 (シンプル)', needs: ['3'], layout: 'vertical' },
    { id: 'p4', label: '③ 御供｜縦型 (会社名入)', needs: ['3a', '3b'], layout: 'vertical' }
  ] : [
    { id: 'p5', label: '⑤ 祝｜横型 (スタンダード)', needs: ['1', '3'], layout: 'horizontal' },
    { id: 'p6', label: '⑥ 祝｜横型 (様へ構成)', needs: ['1', '2', '3'], layout: 'horizontal' },
    { id: 'p7', label: '⑦ 祝｜縦型 (二列構成)', needs: ['1', '3'], layout: 'vertical' },
    { id: 'p8', label: '⑧ 祝｜縦型 (三列完成版)', needs: ['1', '2', '3'], layout: 'vertical' }
  ];
  const selectedTateOpt = allTateOptions.find(opt => opt.id === modalData.tatePattern);

  const handleUploadCompletionImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `completion_${order.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`; 

      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(filePath);

      const updatedData = { ...modalData, completionImage: publicUrl };
      const { error: dbError } = await supabase.from('orders')
        .update({ order_data: updatedData })
        .eq('id', order.id);

      if (dbError) throw dbError;

      order.order_data.completionImage = publicUrl;

      // ★ 完成写真メールを自動送信（お客様メアド + テンプレート設定がある場合のみ）
      let mailMessage = '';
      const customerEmail = modalData.customerInfo?.email;
      if (customerEmail) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const res = await fetch('/api/staff/send-template-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ orderId: order.id, triggerId: 'completion_photo' }),
            });
            const data = await res.json();
            if (res.ok && data.sent) {
              mailMessage = `\n📧 お客様（${customerEmail}）に完成写真メールを自動送信しました！`;
            } else {
              mailMessage = `\n⚠️ メール送信できませんでした: ${data.error || '原因不明'}`;
            }
          }
        } catch (e) {
          mailMessage = `\n⚠️ メール送信に失敗: ${e.message}`;
        }
      } else {
        mailMessage = '\n（お客様のメアドが登録されてないため、メール送信スキップ）';
      }

      alert(`完成写真をアップロードしました 🎉${mailMessage}`);

    } catch (error) {
      console.error('Upload Error:', error);
      alert('画像のアップロードに失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePrint = (e) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const customer = modalData.customerInfo || {};
      const recipient = modalData.isRecipientDifferent ? (modalData.recipientInfo || {}) : customer;
      const totals = getTotals(modalData);
      const history = modalData.statusHistory || [];
      const activeStatuses = getStatusOptions();

      const formatText = (txt) => String(txt || '');
      const safeId = String(order.id || '').slice(0, 8);
      const receiveMethodStr = getMethodLabel(modalData.receiveMethod);
      const datePart = modalData.selectedDate || '未指定';
      
      let paymentStatus = currentPaymentStatus;  // ★ 上で計算した実効値を使う
      if (modalData.paymentMethod) {
        paymentStatus = modalData.paymentMethod;
        if (modalData.paymentStatus) paymentStatus += ' (' + modalData.paymentStatus + ')';
      }

      const formatPrice = (price) => `¥${Number(price || 0).toLocaleString()}`;

      // ★ 注文の shopId に一致する店舗を優先で取得。なければ先頭店舗
      const shop = (appSettings?.shops || []).find(s => String(s.id) === String(modalData.shopId)) || (appSettings?.shops || [])[0] || {};
      const shopName = shop.name || appSettings?.generalConfig?.appName || '花・花OHANA！';
      const shopLogoUrl = appSettings?.generalConfig?.logoUrl || '';
      const shopZip = shop.zip || '0010025';
      const shopAddress = shop.address || '北海道札幌市北区北２５条西４丁目３−８ クレアノース25 1階';
      const shopTel = shop.phone || '011-600-1878';
      const shopInvoice = shop.invoiceNumber || 'T1234567891012';

      const getTitleColor = (type) => {
        const map = { order_store: '#117768', customer: '#1a56a8', delivery: '#444444', receipt: '#444444' };
        return map[type] || '#444444';
      };

      const renderHeaderMeta = () => `<div class="meta-area"><div>伝票：${safeId}    受付：${safeFormatDate(order.created_at, false)}</div><div>お渡し：${receiveMethodStr}    希望日：${datePart}</div><div>入金状況：${paymentStatus}</div></div>`;

      const renderClientBoxes = (hidePrice) => `
        <div class="info-grid">
          <div class="info-box" style="border-color:${hidePrice ? '#888' : '#444'}">
            <div class="info-title">【ご依頼主様（ご注文者）】</div>
            <div class="info-main">${formatText(customer.name)} <span style="font-size:9pt; font-weight:normal;">様</span></div>
            <div class="info-sub-bottom">
              <div>〒${formatText(customer.zip)}</div>
              <div>${formatText(customer.address1)} ${formatText(customer.address2)}</div>
              <div>TEL: ${formatText(customer.phone)}</div>
            </div>
          </div>
          <div class="info-box" style="border-color:${hidePrice ? '#888' : '#444'}">
            <div class="info-title">【お届け先様】</div>
            ${modalData.isRecipientDifferent ? `
              <div class="info-main">${formatText(recipient.name)} <span style="font-size:9pt; font-weight:normal;">様</span></div>
              <div class="info-sub-bottom">
                <div>〒${formatText(recipient.zip)}</div>
                <div>${formatText(recipient.address1)} ${formatText(recipient.address2)}</div>
                <div>TEL: ${formatText(recipient.phone)}</div>
              </div>
            ` : `<div class="same-text">ご依頼主様と同じ</div>`}
          </div>
        </div>
      `;

      const renderCardBlock = () => {
        if (modalData.cardType === '立札' && (modalData.tatePattern || modalData.tateInput1 || modalData.tateInput2 || modalData.tateInput3)) {
          return `<div class="simple-card-text">${modalData.tatePattern ? `<span style="color:#d32f2f; font-weight:bold;">[${formatText(modalData.tatePattern)}]</span> ` : ''}${[modalData.tateInput1, modalData.tateInput2, modalData.tateInput3].filter(Boolean).join(' / ')}</div>`;
        }
        if (modalData.cardType === 'メッセージカード') return `<div class="simple-card-text">${formatText(modalData.cardMessage).replace(/\n/g, ' ')}</div>`;
        return '';
      };

      // ★ EC注文判定
      const isEcOrder = modalData.orderType === 'ec' && Array.isArray(modalData.cartItems) && modalData.cartItems.length > 0;

      const renderItemsBlock = (hidePrice = false, slipType = 'order_store') => {
        // ★ EC注文: cartItems を商品行ごとに表示
        let itemRows = '';
        if (isEcOrder) {
          itemRows = modalData.cartItems.map(c => `
              <tr>
                <td class="item-cell">
                  <div class="item-name">${formatText(c.name)}</div>
                </td>
                <td class="qty-cell">${formatText(c.qty)}</td>
                <td class="price-cell">${hidePrice ? '' : formatPrice(Number(c.price) * Number(c.qty))}</td>
              </tr>
          `).join('');
        } else {
          itemRows = `
              <tr>
                <td class="item-cell">
                  <div class="item-name">${formatText(modalData.flowerType) || '未設定'}</div>
                  <div class="item-detail">用途: ${formatText(modalData.flowerPurpose) || '-'}${modalData.otherPurpose ? ` (${formatText(modalData.otherPurpose)})` : ''} / 色: ${formatText(modalData.flowerColor) || '-'}${modalData.otherColor ? ` (${formatText(modalData.otherColor)})` : ''} / イメージ: ${formatText(modalData.flowerVibe) || '-'}${modalData.otherVibe ? ` (${formatText(modalData.otherVibe)})` : ''}</div>
                  ${renderCardBlock()}
                  ${modalData.note ? `<div class="item-detail" style="color:#d97c8f; margin-top:2mm;">備考: ${formatText(modalData.note)}</div>` : ''}
                </td>
                <td class="qty-cell">1</td>
                <td class="price-cell">${hidePrice ? '' : formatPrice(modalData.itemPrice)}</td>
              </tr>
          `;
        }

        // ★ EC注文 かつ お客様向け伝票（customer/delivery）にはサンキューメッセージ
        const thankYouMessage = (isEcOrder && (slipType === 'customer' || slipType === 'delivery')) ? `
          <div style="border:1px solid #117768; background:#f4faf8; padding:4mm; margin-top:3mm; text-align:center; border-radius:2mm;">
            <div style="font-size:11pt; font-weight:bold; color:#117768; margin-bottom:1mm;">Thank you for your order</div>
            <div style="font-size:8.5pt; color:#333; line-height:1.5;">
              この度はご注文いただき、誠にありがとうございました。<br/>
              またのご利用を心よりお待ちしております。
            </div>
          </div>
        ` : '';

        return `
        <div class="items-area">
          <table class="items-table" style="border-color:${hidePrice ? '#888' : '#444'}">
            <thead>
              <tr style="background:${hidePrice ? '#f4f4f4' : '#fafafa'}">
                <th style="text-align:left;">商品名・内容</th>
                <th style="width:18mm; text-align:center;">数量</th>
                <th style="width:26mm; text-align:right;">金額(税抜)</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        ${thankYouMessage}
        <div style="display:flex; justify-content:flex-end;">
          ${!hidePrice ? `
            <table class="amount-summary">
              <tbody>
                <tr><td class="amount-label">商品代</td><td class="amount-val">${formatPrice(totals.item)}</td></tr>
                <tr><td class="amount-label">送料・手数料</td><td class="amount-val">${formatPrice(totals.fee + totals.pickup)}</td></tr>
                <tr><td class="amount-label">消費税(10%)</td><td class="amount-val">${formatPrice(totals.tax)}</td></tr>
                <tr><td class="amount-label-total">合計</td><td class="amount-val-total">${formatPrice(totals.total)}</td></tr>
              </tbody>
            </table>
          ` : `<div style="height:23.5mm;"></div>`}
        </div>
      `;
      };

      const renderFooter = (type, hidePrice) => {
        let footerActionsHtml = '';
        // ★ EC注文の納品書・店舗案内 → 配達者/サイン枠を出さない（同梱物に手書き枠は不要）
        if (isEcOrder && (type === 'delivery' || type === 'enclosed_card')) {
          footerActionsHtml = '';
        } else if (type === 'customer') {
          const firstStatus = activeStatuses[0] || '受注';
          const entry = history.find(h => h.status === firstStatus || h.status === 'new') || history[history.length - 1];
          const staff = entry ? entry.staff : (modalData.staffName || '');
          footerActionsHtml = `<div class="check-group"><div class="check-label">受付</div><div class="check-box ${staff ? 'filled' : ''}">${staff}</div></div>`;
        } else if (type === 'delivery' || type === 'receipt') {
          const deliveryEntry = history.find(h => h.status.includes('配達'));
          const staff = deliveryEntry ? deliveryEntry.staff : '';
          footerActionsHtml = `<div class="check-group"><div class="check-label">配達</div><div class="check-box ${staff ? 'filled' : ''}" style="border-color:#888;">${staff}</div></div>`;
        } else {
          footerActionsHtml = activeStatuses.slice(0, 6).map(statusLabel => {
            const entry = history.find(h => h.status === statusLabel);
            const staff = entry ? entry.staff : '';
            const shortLabel = statusLabel.length > 4 ? statusLabel.substring(0, 4) : statusLabel;
            return `<div class="check-group"><div class="check-label">${shortLabel}</div><div class="check-box ${staff ? 'filled' : ''}">${staff}</div></div>`;
          }).join('');
        }
        return `
          <div class="footer" style="border-top-color:${hidePrice ? '#888' : '#bbb'}">
            <div class="shop-block">
              <div class="shop-name">${shopName}</div>
              <div>〒${shopZip} ${shopAddress}</div>
              <div>TEL: ${shopTel} (${shopInvoice})</div>
            </div>
            <div class="footer-actions">${footerActionsHtml}</div>
          </div>
        `;
      };

      const renderSlip = ({ title, type, hidePrice = false, showReceiptNote = false, fullPage = false }) => `
        <div class="${fullPage ? 'slip-full' : 'slip'}" style="color: ${hidePrice ? '#333' : 'inherit'}">
          <div class="slip-header">
            <div class="slip-title" style="color:${getTitleColor(type)}">${title}${isEcOrder ? ` <span style="font-size:9pt; background:#e3f2fd; color:#1565c0; padding:1mm 2mm; border-radius:1mm; font-weight:bold; vertical-align:middle;">EC注文</span>` : ''}</div>
            ${renderHeaderMeta()}
          </div>
          ${renderClientBoxes(hidePrice)}
          ${renderItemsBlock(hidePrice, type)}
          ${showReceiptNote ? `
            <div class="receipt-note" style="margin-top: 3mm; margin-bottom: 2mm;">
              <div style="font-size: 8.5pt; margin-bottom: 4mm;">上記の商品を確かに受領いたしました。</div>
              <div style="display: flex; justify-content: flex-end; gap: 8mm; font-size: 10pt;">
                <div>受領日：<span style="display:inline-block; width:12mm; border-bottom:1px solid #555;"></span>年<span style="display:inline-block; width:8mm; border-bottom:1px solid #555;"></span>月<span style="display:inline-block; width:8mm; border-bottom:1px solid #555;"></span>日</div>
                <div>サインまたは印：<span style="display:inline-block; width:45mm; border-bottom:1px solid #555;"></span></div>
              </div>
            </div>
          ` : ''}
          ${renderFooter(type, hidePrice)}
        </div>
      `;

      // ★ EC贈り物用：店舗案内チラシ（金額なし。お届け先様への同梱物）
      const renderEnclosedCard = ({ fullPage = true }) => {
        const itemRows = (modalData.cartItems || []).map(c => `
          <tr>
            <td style="padding:2mm 1mm; font-size:11pt; font-weight:bold;">${formatText(c.name)}</td>
            <td style="padding:2mm 1mm; text-align:center; font-size:10pt;">× ${formatText(c.qty)}</td>
          </tr>
        `).join('');
        return `
          <div class="${fullPage ? 'slip-full' : 'slip'}" style="color:#222;">
            <!-- 上部：タイトル -->
            <div style="text-align:center; padding-top:4mm;">
              <div style="font-size:11pt; letter-spacing:0.4em; color:#117768; font-weight:bold;">Thank you for choosing us</div>
              <div style="font-size:22pt; font-weight:bold; letter-spacing:0.3em; margin-top:3mm; color:#222;">贈り物のご案内</div>
            </div>

            <!-- タイトル下：ロゴ（大きめ・中央） -->
            ${shopLogoUrl ? `
              <div style="text-align:center; margin-top:8mm; padding-bottom:6mm; border-bottom:0.5pt dashed #bbb;">
                <img src="${shopLogoUrl}" alt="${formatText(shopName)}" style="max-height:25mm; max-width:90mm; object-fit:contain; margin:0 auto; display:block;" />
              </div>
            ` : `<div style="margin-top:8mm; padding-bottom:6mm; border-bottom:0.5pt dashed #bbb;"></div>`}

            <!-- 中部：お届け先 + メッセージ -->
            <div style="margin:10mm auto 0 auto; max-width:130mm; text-align:center;">
              <div style="font-size:13pt; font-weight:bold;">${formatText(recipient.name)} <span style="font-size:10pt; font-weight:normal;">様</span></div>
              <div style="margin-top:6mm; font-size:10.5pt; color:#333; line-height:2;">
                この度は <strong style="color:#117768;">${formatText(customer.name)}</strong> 様より<br/>
                心のこもったお贈り物が届きました🌸<br/>
                <span style="font-size:10pt; color:#555;">心を込めてお作りしたお花をお届けいたします。</span>
              </div>
            </div>

            <!-- お届け内容 -->
            <div style="margin:8mm auto 0 auto; max-width:120mm; border-top:0.5pt solid #ddd; border-bottom:0.5pt solid #ddd; padding:4mm 0;">
              <div style="font-size:8.5pt; color:#888; text-align:center; margin-bottom:2mm; letter-spacing:0.3em;">お届け内容</div>
              <table style="width:100%; border-collapse:collapse;">
                <tbody>${itemRows}</tbody>
              </table>
            </div>

            <div style="margin:6mm auto 0 auto; max-width:130mm; text-align:center; font-size:9pt; color:#555; line-height:1.7;">
              お花のお手入れ方法やご不明な点がございましたら、<br/>
              下記の店舗までお気軽にお問い合わせください。
            </div>

            <!-- 下部：店舗情報（左にロゴ + 店名） -->
            <div style="margin-top:auto; padding-top:8mm; border-top:0.5pt dashed #bbb; text-align:center;">
              <div style="display:flex; align-items:center; justify-content:center; gap:3mm; margin-bottom:3mm;">
                ${shopLogoUrl ? `<img src="${shopLogoUrl}" alt="" style="height:8mm; max-width:18mm; object-fit:contain;" />` : ''}
                <div style="font-size:14pt; font-weight:900; color:#222; letter-spacing:0.15em;">${formatText(shopName)}</div>
              </div>
              <div style="font-size:9pt; color:#555; line-height:1.7;">
                <div>〒${formatText(shopZip)} ${formatText(shopAddress)}</div>
                <div>TEL: ${formatText(shopTel)}</div>
              </div>
            </div>
          </div>
        `;
      };

      const html = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8" />
          <style>
            @page { size: A4 portrait; margin: 0; }
            @media print {
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page { box-shadow: none !important; margin: 0 !important; page-break-after: always !important; break-after: page !important; }
              .page:last-child { page-break-after: auto !important; break-after: auto !important; }
            }
            * { box-sizing: border-box; }
            body { margin: 0; background-color: #f3f4f6; font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif; color: #222; }
            .page { width: 210mm; height: 296mm; background: #fff; margin: 0 auto 10mm auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; flex-direction: column; position: relative; overflow: hidden; }
            .slip { width: 100%; height: 148mm; padding: 7mm 15mm; display: flex; flex-direction: column; position: relative; overflow: hidden; }
            .slip:first-child { border-bottom: 1px dashed #aaa; }
            /* ★ EC注文用: 1ページ全面（A4フルサイズ） */
            .slip-full { width: 100%; height: 296mm; padding: 15mm 20mm; display: flex; flex-direction: column; position: relative; overflow: hidden; }
            .cutline { position: absolute; top: 148mm; left: 10mm; right: 10mm; transform: translateY(-50%); display: flex; justify-content: center; align-items: center; z-index: 10; pointer-events: none; }
            .cutline span { background: #fff; padding: 0 5mm; font-size: 8pt; color: #888; letter-spacing: 0.2em; }
            .slip-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3mm; }
            .slip-title { font-size: 16pt; font-weight: bold; letter-spacing: 0.3em; }
            .meta-area { font-size: 8pt; text-align: right; line-height: 1.4; font-weight: bold; }
            .info-grid { display: flex; gap: 4mm; min-height: 28mm; margin-bottom: 3mm; }
            .info-box { flex: 1; border: 0.5pt solid #444; padding: 2mm; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
            .info-title { font-size: 7.5pt; font-weight: bold; color: #444; margin-bottom: 1mm; }
            .info-main { font-size: 12pt; font-weight: bold; }
            .info-sub-bottom { margin-top: 1mm; font-size: 8pt; line-height: 1.25; }
            .same-text { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 12pt; color: #888; font-weight: bold; letter-spacing: 0.1em; }
            .items-area { flex-grow: 1; display: flex; flex-direction: column; margin-bottom: 1mm; }
            .items-table { width: 100%; border-collapse: collapse; }
            .items-table thead th { font-size: 8pt; border-top: 0.5pt solid #444; border-bottom: 0.5pt solid #444; padding: 1.5mm 1mm; text-align: left; }
            .item-cell { padding: 2mm 1mm; vertical-align: top; }
            .qty-cell { text-align: center; font-size: 10pt; font-weight: bold; vertical-align: top; padding-top: 2mm; }
            .price-cell { text-align: right; font-size: 10pt; font-weight: bold; vertical-align: top; padding-top: 2mm; }
            .item-name { font-size: 12pt; font-weight: bold; margin-bottom: 1mm; }
            .item-detail { font-size: 8pt; color: #555; }
            .simple-card-text { font-size: 9pt; font-weight: bold; margin-top: 1.5mm; border-top: 1px dotted #ccc; padding-top: 1mm; line-height: 1.3; }
            .amount-summary { width: 65mm; border-collapse: collapse; font-size: 8.5pt; }
            .amount-summary td { border: 0.5pt solid #999; padding: 1.2mm 2mm; text-align: right; font-weight: bold; height: 23px; }
            .amount-label { background: #f9f9f9; text-align: left !important; width: 50%; color:#666; }
            .amount-label-total { background: #f9f9f9; font-weight: bold; color: #117768; text-align: left !important; }
            .amount-val-total { color: #117768; font-size: 11pt; }
            .receipt-note { margin-top: 2mm; margin-bottom: 2mm; font-size: 8.5pt; color: #333; }
            .footer { margin-top: auto; border-top: 0.5pt dashed #bbb; padding-top: 2mm; display: flex; justify-content: space-between; align-items: flex-end; }
            .shop-block { font-size: 8pt; line-height: 1.4; color: #444; }
            .shop-name { font-size: 12pt; font-weight: 900; color: #222; margin-bottom: 1mm; }
            .footer-actions { display: flex; gap: 2mm; }
            .check-group { display: flex; flex-direction: column; align-items: center; gap: 0.5mm; }
            .check-label { font-size: 6.5pt; color: #666; font-weight: bold; }
            .check-box { border: 0.5pt solid #666; width: 14mm; height: 6mm; display: flex; align-items: center; justify-content: center; font-size: 7pt; font-weight: bold; border-radius: 1px; }
            .check-box.filled { background: #fff; }
          </style>
        </head>
        <body>
          ${isEcOrder ? `
            ${modalData.isRecipientDifferent ? `
              <!-- EC注文（贈り物）: 1ページ目=受注書控（店舗保管）, 2ページ目=お届け物のご案内（同梱用・金額なし） -->
              <div class="page">
                ${renderSlip({ title: '受 注 書 控', type: 'order_store', hidePrice: false, fullPage: true })}
              </div>
              <div class="page">
                ${renderEnclosedCard({ fullPage: true })}
              </div>
            ` : `
              <!-- EC注文（ご依頼主=お届け先）: 1ページ目=受注書控, 2ページ目=納品書 -->
              <div class="page">
                ${renderSlip({ title: '受 注 書 控', type: 'order_store', hidePrice: false, fullPage: true })}
              </div>
              <div class="page">
                ${renderSlip({ title: '納 品 書', type: 'delivery', hidePrice: false, fullPage: true })}
              </div>
            `}
          ` : `
            <!-- カスタム注文: 各ページ2分割（既存） -->
            <div class="page">
              ${renderSlip({ title: '受 注 書 控', type: 'order_store', hidePrice: false })}
              ${renderSlip({ title: 'お 客 様 控', type: 'customer', hidePrice: false })}
              <div class="cutline"><span>✂ 切り取り線</span></div>
            </div>
            <div class="page">
              ${renderSlip({ title: '納 品 書', type: 'delivery', hidePrice: true })}
              ${renderSlip({ title: '受 領 書', type: 'receipt', hidePrice: true, showReceiptNote: true })}
              <div class="cutline"><span>✂ 切り取り線</span></div>
            </div>
          `}
          <script>
            window.onload = function() { setTimeout(function() { window.print(); }, 400); };
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
    } catch (err) {
      console.error("伝票生成エラー:", err);
      alert(`エラーが発生しました: ${err.message}`);
    }
  };

  // ★ 修正：テンプレートを選択してメールを作成する関数
  const handleSendEmail = (template) => {
    setShowMailTemplates(false); // ドロップダウンを閉じる
    if (!modalData?.customerInfo?.email) return alert("この注文にはお客様のメールアドレスが登録されていません。");
    
    try {
      const email = modalData.customerInfo.email;
      const subject = encodeURIComponent(template.subject || '');
      const totals = getTotals(modalData);
      
      const orderDetails = `【ご注文内容】\n商品: ${modalData.flowerType || '未設定'}\n合計金額: ¥${totals.total.toLocaleString()} (税込)\n受取方法: ${getMethodLabel(modalData.receiveMethod)}\n予定日: ${modalData.selectedDate || '未定'} ${modalData.selectedTime || ''}`;
      
      const shopPhone = appSettings?.shops?.[0]?.phone || '未設定';
      const shopName = appSettings?.shops?.[0]?.name || appSettings?.generalConfig?.appName || '店舗名未設定';
      const completionImageUrl = modalData.completionImage || '※完成写真は現在準備中です。';

      // ★ すべてのタグを置換する処理
      const bodyText = (template.body || '')
        .replace(/\{CustomerName\}/g, modalData.customerInfo?.name || 'お客様')
        .replace(/\{OrderDetails\}/g, orderDetails)
        .replace(/\{CompletionImage\}/g, completionImageUrl)
        .replace(/\{ShopName\}/g, shopName)
        .replace(/\{TotalAmount\}/g, `¥${totals.total.toLocaleString()}`)
        .replace(/\{ShopPhone\}/g, shopPhone);

      const body = encodeURIComponent(bodyText);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    } catch (err) {
      alert(`メールの起動に失敗しました: ${err.message}`);
    }
  };

  // ★ 銀行振込の入金確認 → 納品日確定 → 自動メール送信
  const handleConfirmPayment = async () => {
    if (!confirmDeliveryDate) {
      alert('納品予定日を入力してください');
      return;
    }
    setIsProcessingPayment(true);
    try {
      // 1. 入金状態 + 納品日を更新
      const oldStatus = modalData.paymentStatus || '';
      let newStatus = '入金済';
      if (oldStatus.includes('引き取り時')) newStatus = '入金済（引き取り時受領）';

      const updatedData = {
        ...modalData,
        paymentStatus: newStatus,
        selectedDate: confirmDeliveryDate,
        selectedTime: confirmDeliveryTime || modalData.selectedTime || '',
      };

      // 親コンポーネントの onUpdatePayment は paymentStatus のみ更新するので
      // ここで直接 supabase を呼んで両方更新
      const { error } = await supabase
        .from('orders')
        .update({ order_data: updatedData })
        .eq('id', order.id);
      if (error) throw error;

      // 2. payment_confirmed メール自動送信
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const res = await fetch('/api/staff/send-template-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ orderId: order.id, triggerId: 'payment_confirmed' }),
        });
        const data = await res.json();
        if (!res.ok) {
          console.warn('入金確認メール送信失敗:', data.error);
          alert(`入金済みに更新しましたが、メール送信に失敗しました: ${data.error || ''}`);
        }
      }

      // 3. UI 更新（親へ反映してもらう）
      if (onUpdatePayment) {
        await onUpdatePayment(order.id, updatedData, { skipConfirm: true, alreadyUpdated: true });
      }

      setShowPaymentConfirmModal(false);
      alert('入金済みに更新し、お客様にメールを送信しました ✉️');
    } catch (err) {
      console.error(err);
      alert(`処理に失敗しました: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ★ テンプレートメールをサーバー側から実際に送信（Resend経由）
  const handleSendTemplateEmail = async (template) => {
    try {
      setShowMailTemplates(false);
      const triggerLabel = {
        restock_notification: '入荷のお知らせ',
        delivery_completion: 'お渡し・配達完了',
        custom: 'カスタム',
      };
      if (!confirm(`「${triggerLabel[template.trigger] || template.trigger}」のメールを送信しますか？\n宛先: ${modalData.customerInfo?.email}`)) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      const res = await fetch('/api/staff/send-template-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orderId: order.id, triggerId: template.trigger }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '送信に失敗しました');
      alert('メールを送信しました ✉️');
    } catch (err) {
      alert(`メール送信に失敗しました: ${err.message}`);
    }
  };

  return (
    // ★ モーダルクリック時にドロップダウンを閉じる処理を追加
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#111111]/60 backdrop-blur-sm p-3 md:p-4 animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-[#FBFAF9] rounded-[24px] md:rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative flex flex-col" 
        onClick={(e) => { e.stopPropagation(); setShowMailTemplates(false); }}
      >
        
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#EAEAEA] p-4 md:p-6 flex flex-wrap items-center justify-between gap-3 z-20 rounded-t-[24px] md:rounded-t-[32px]">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] md:text-[18px] font-black text-[#2D4B3E]">注文詳細</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${modalData.status === 'completed' || modalData.status === '完了' ? 'bg-gray-100 text-gray-500' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                {modalData.status === 'completed' || modalData.status === '完了' ? '完了' : '未完了'}
              </span>
              
              {isUnpaid ? (
                <span className="text-[10px] font-bold bg-[#D97D54]/10 text-[#D97D54] px-2 py-0.5 rounded border border-[#D97D54]/20 flex items-center gap-1">
                  <AlertCircle size={12}/> {currentPaymentStatus}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200 flex items-center gap-1">
                  <CheckCircle2 size={12}/> {currentPaymentStatus}
                </span>
              )}
            </div>
            <p className="text-[10px] md:text-[11px] text-[#999999] font-bold mt-1">
              受付: {safeFormatDate(order.created_at, true)}
              {modalData.managementNo && <span className="ml-2 px-2 py-0.5 bg-[#2D4B3E]/10 text-[#2D4B3E] rounded-full font-mono">管理番号: {modalData.managementNo}</span>}
              <span className="ml-2 text-[#bbb]">ID: {order.id.slice(0, 8)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {modalData.customerInfo?.email && (
              <a
                href={`/staff/customers?email=${encodeURIComponent(modalData.customerInfo.email)}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[10px] md:text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all"
                title="このお客様の顧客カルテを開く"
              >
                <User size={14} /> <span className="hidden sm:inline">顧客カルテ</span>
              </a>
            )}
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[10px] md:text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">
              <Printer size={14} /> <span className="hidden sm:inline">印刷 / PDF出力</span>
            </button>
            
            {/* ★ 新規追加：メール作成ボタン＆ドロップダウンメニュー */}
            {modalData.customerInfo?.email && (
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowMailTemplates(!showMailTemplates); }} 
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#2D4B3E] text-white rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-[#1f352b] transition-all shadow-sm"
                >
                  <Send size={14} /> <span className="hidden sm:inline">メール作成</span>
                </button>
                
                {showMailTemplates && (
                  <div className="absolute top-full right-0 mt-2 w-56 md:w-72 bg-white border border-[#EAEAEA] rounded-xl shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-[#FBFAF9] px-4 py-2 border-b border-[#EAEAEA] text-[10px] font-bold text-[#999999]">
                      手動送信する案内文を選択
                    </div>
                    <div className="max-h-60 overflow-y-auto hide-scrollbar">
                      {(() => {
                        // ★ 手動送信用 (auto: false) のテンプレートだけ表示
                        const manualTriggers = ['restock_notification', 'delivery_completion', 'custom'];
                        const manualTemplates = (appSettings?.autoReplyTemplates || []).filter(t =>
                          manualTriggers.includes(t.trigger) && t.enabled !== false
                        );
                        if (manualTemplates.length === 0) {
                          return <div className="px-4 py-3 text-[11px] text-[#999999]">設定画面で「手動送信」テンプレートを追加してください</div>;
                        }
                        const triggerLabel = {
                          restock_notification: '入荷のお知らせ',
                          delivery_completion: 'お渡し・配達完了',
                          custom: 'カスタム',
                        };
                        return manualTemplates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => handleSendTemplateEmail(t)}
                            className="w-full text-left px-4 py-3 hover:bg-[#FBFAF9] border-b border-[#EAEAEA] last:border-0 transition-colors"
                          >
                            <div className="text-[12px] font-bold text-[#2D4B3E] mb-1">{triggerLabel[t.trigger] || t.trigger}</div>
                            <div className="text-[10px] text-[#555555] truncate">{t.subject}</div>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="w-[1px] h-6 bg-[#EAEAEA] mx-1"></div>

            <button onClick={() => onArchive(order.id, modalData.status !== 'completed' && modalData.status !== '完了')} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] md:text-[11px] font-bold rounded-xl transition-all shadow-sm ${modalData.status === 'completed' || modalData.status === '完了' ? 'bg-white border border-[#EAEAEA] text-[#555555]' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b]'}`}>
              {modalData.status === 'completed' || modalData.status === '完了' ? <RotateCcw size={14}/> : <Archive size={14}/>}
              <span className="hidden sm:inline">{modalData.status === 'completed' || modalData.status === '完了' ? '未完了に戻す' : '完了にする'}</span>
            </button>

            <button onClick={() => onDelete(order.id)} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-[10px] md:text-[11px] font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm ml-1">
              <Trash2 size={14} /> 削除
            </button>
            
            <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-full flex items-center justify-center text-[#555555] font-bold hover:bg-[#EAEAEA] transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 text-left overflow-x-hidden">
          
          <div className="bg-white p-5 rounded-[24px] border border-[#EAEAEA] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className={`px-3 py-1.5 rounded-lg text-[11px] md:text-[12px] font-bold flex items-center gap-1 w-fit ${isPickup ? 'bg-orange-100 text-orange-700' : isDelivery ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
              {isPickup ? <Store size={14}/> : isDelivery ? <Truck size={14}/> : <Package size={14}/>}
              {isPickup ? '店頭受取' : isDelivery ? '自社配達' : '業者配送'}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 bg-[#FBFAF9] p-2 rounded-2xl border border-[#EAEAEA]">
              <span className="text-[11px] font-bold text-[#999999] px-2 flex items-center gap-1 hidden sm:flex"><ListChecks size={14}/> ステータス更新</span>
              <select 
                value={updateForm.status}
                onChange={(e) => setUpdateForm({...updateForm, status: e.target.value})}
                className="h-10 bg-white border border-[#EAEAEA] rounded-xl px-3 text-[12px] font-bold outline-none shadow-sm cursor-pointer"
              >
                <option value="new">未対応 (新規)</option>
                {getStatusOptions().map(l => <option key={l} value={l}>{l}</option>)}
                <option value="完了">完了</option>
                <option value="キャンセル">キャンセル</option>
              </select>
              {/* 担当者選択は廃止：現在ログイン中のスタッフを自動使用 */}
              <button onClick={() => {
                const currentStaff = (typeof window !== 'undefined') ? JSON.parse(localStorage.getItem('florix_currentStaff') || 'null') : null;
                const autoStaff = currentStaff?.name || '';
                onUpdateStatus(order.id, updateForm.status, autoStaff);
              }} className="h-10 px-4 bg-[#2D4B3E] text-white text-[12px] font-bold rounded-xl hover:bg-[#1f352b] transition-all shadow-sm">
                更新
              </button>
            </div>
          </div>

          {isSagawa ? (
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
                  <CalendarIcon size={18} className="text-green-600"/> 
                  {modalData.selectedDate ? `${modalData.selectedDate.split('-')[1]}月${modalData.selectedDate.split('-')[2]}日` : '未指定'}
                </p>
                <p className="text-[12px] font-bold text-green-700">{modalData.selectedTime || '時間指定なし'}</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#FBFAF9] border border-[#EAEAEA] p-6 rounded-[24px] flex flex-col items-center justify-center text-center shadow-inner">
               <span className="text-[12px] font-bold text-[#999999] tracking-widest mb-1">
                 {isPickup ? 'ご来店予定日' : '配達予定日'}
               </span>
               <p className="text-[28px] font-black text-[#2D4B3E] flex items-center gap-2">
                 <CalendarIcon size={24}/> {modalData.selectedDate ? `${modalData.selectedDate.split('-')[1]}月${modalData.selectedDate.split('-')[2]}日` : '未設定'}
               </p>
               <p className="text-[14px] font-bold text-[#D97C8F] mt-2">{modalData.selectedTime || '時間指定なし'}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
              <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><User size={18}/> 注文者情報</h3>
              <div className="space-y-4 text-[13px] bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">お名前</span><span className="font-black text-[16px]">{modalData.customerInfo?.name || '未設定'} 様</span></p>
                <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">電話番号</span><span className="font-bold text-[14px]">{modalData.customerInfo?.phone || '未設定'}</span></p>
                {modalData.customerInfo?.email && <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">メール</span><span className="font-bold text-[#4285F4]">{modalData.customerInfo?.email}</span></p>}
                {!isPickup && <p className="pt-2 border-t border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">住所</span><span className="font-bold leading-relaxed">〒{modalData.customerInfo?.zip}<br/>{modalData.customerInfo?.address1} {modalData.customerInfo?.address2}</span></p>}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
              <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><MapPin size={18}/> お届け先情報</h3>
              <div className="space-y-3 text-[13px]">
                {isPickup ? (
                  <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                    <p><span className="text-[#999999] text-[10px] block mb-1 tracking-widest">受取店舗</span><span className="font-black text-[16px] text-[#2D4B3E]">{modalData.selectedShop || '未指定'}</span></p>
                  </div>
                ) : (
                  <div className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA] space-y-3 relative overflow-hidden">
                    {modalData.isRecipientDifferent && <div className="absolute top-0 right-0 bg-[#2D4B3E] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">注文者と別住所</div>}
                    <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">宛名</span><span className="font-black text-[16px]">{modalTargetInfo?.name || '未設定'} 様</span></p>
                    <p><span className="text-[#999999] text-[10px] block mb-0.5 tracking-widest">お届け先住所</span><span className="font-bold text-[14px] block leading-relaxed">〒{modalTargetInfo?.zip}<br/>{modalTargetInfo?.address1} {modalTargetInfo?.address2}</span></p>
                    
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

          {/* 置き配ご案内セクションは廃止（持ち戻りのみ運用） */}

          <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><Tag size={18}/> オーダー内容</h3>
            <div className="flex flex-col sm:flex-row gap-6">
              
              <div className="flex flex-col gap-2 shrink-0">
                {modalData.completionImage ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[#2D4B3E] bg-[#2D4B3E]/10 px-2 py-0.5 rounded inline-block">完成写真</span>
                    <img src={modalData.completionImage} alt="完成写真" className="w-full sm:w-40 h-32 sm:h-40 object-cover rounded-2xl border border-[#EAEAEA] shadow-sm" />
                  </div>
                ) : modalData.referenceImage ? (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[#999999] bg-[#F7F7F7] px-2 py-0.5 rounded inline-block">お客様からの参考画像</span>
                    <img src={modalData.referenceImage} alt="参考画像" className="w-full sm:w-40 h-32 sm:h-40 object-cover rounded-2xl border border-[#EAEAEA] shadow-sm" />
                  </div>
                ) : (
                  <div className="w-full sm:w-40 h-32 sm:h-40 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl flex flex-col items-center justify-center text-[#999999] text-[11px] font-bold gap-2">
                    <ImageIcon size={24}/> 画像なし
                  </div>
                )}
                
                <div className="relative mt-2">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleUploadCompletionImage}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  />
                  <div className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-[11px] font-bold transition-all border ${isUploading ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-[#2D4B3E] border-[#2D4B3E]/30 hover:bg-[#2D4B3E]/5 shadow-sm'}`}>
                    <Upload size={14} />
                    {isUploading ? '送信中...' : '完成写真を登録'}
                  </div>
                </div>
              </div>

              <div className="flex-1 text-[13px]">
                {/* ★ EC注文の場合: 商品画像付きカート内訳を表示 */}
                {modalData.orderType === 'ec' && Array.isArray(modalData.cartItems) && modalData.cartItems.length > 0 ? (
                  <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#EAEAEA]">
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded">🛒 EC注文</span>
                      <span className="text-[10px] text-[#999999]">{modalData.cartItems.length} 商品 / 合計 {modalData.cartItems.reduce((s, c) => s + (Number(c.qty) || 0), 0)} 点</span>
                    </div>
                    <div className="space-y-3">
                      {modalData.cartItems.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-[#EAEAEA]">
                          {/* 商品画像 */}
                          <div className="w-14 h-14 shrink-0 bg-[#FBFAF9] rounded-lg overflow-hidden">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#CCC] text-[10px]">No Img</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-[#111111] truncate">{c.name}</p>
                            <p className="text-[10px] text-[#999999] mt-0.5">¥{Number(c.price).toLocaleString()} × {c.qty}</p>
                          </div>
                          <span className="text-[13px] text-[#2D4B3E] font-bold shrink-0">
                            ¥{(Number(c.price) * Number(c.qty)).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* カスタム注文の場合: 従来通り */
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block mb-1">お花の種類</span><span className="font-bold text-[#2D4B3E] text-[14px]">{modalData.flowerType || '未設定'}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block mb-1">用途</span><span className="font-bold">{modalData.flowerPurpose} {modalData.otherPurpose && `(${modalData.otherPurpose})`}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block mb-1">カラー</span><span className="font-bold">{modalData.flowerColor} {modalData.otherColor && `(${modalData.otherColor})`}</span></div>
                    <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]"><span className="text-[#999999] text-[10px] block mb-1">イメージ</span><span className="font-bold">{modalData.flowerVibe} {modalData.otherVibe && `(${modalData.otherVibe})`}</span></div>
                  </div>
                )}
              </div>
            </div>
            {modalData.isBring === 'bring' && <div className="bg-orange-100 text-orange-700 px-3 py-2 rounded-xl text-[12px] font-bold mt-2 inline-block border border-orange-200">※お客様からのお花/器の持込あり</div>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
            {modalData.cardType && modalData.cardType !== 'なし' && (
              <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                <h3 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2"><MessageSquare size={18}/> 添付物: {modalData.cardType}</h3>
                
                {modalData.cardType === 'メッセージカード' && (
                  <div className="bg-[#FBFAF9] p-5 rounded-2xl text-[13px] font-bold whitespace-pre-wrap border border-[#EAEAEA] text-[#333333] leading-relaxed">
                    {modalData.cardMessage}
                  </div>
                )}

                {modalData.cardType === '立札' && (
                  <div className="space-y-1.5 text-[12px] bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA]">
                    <span className="inline-block bg-[#2D4B3E] text-white px-2 py-0.5 rounded text-[10px] font-bold mb-2">{modalData.tatePattern}</span>
                    {modalData.tateInput1 && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">内容:</span><span className="font-black">{modalData.tateInput1}</span></div>}
                    {modalData.tateInput2 && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">宛名:</span><span className="font-black">{modalData.tateInput2} 様</span></div>}
                    {modalData.tateInput3 && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">贈り主:</span><span className="font-black">{modalData.tateInput3}</span></div>}
                    {modalData.tateInput3a && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">会社名:</span><span className="font-black">{modalData.tateInput3a}</span></div>}
                    {modalData.tateInput3b && <div className="flex"><span className="w-16 text-[#999999] font-bold">役職・名:</span><span className="font-black">{modalData.tateInput3b}</span></div>}
                    
                    <p className="text-[10px] font-bold text-[#999999] tracking-widest text-center pt-4 mb-2">仕上がりプレビュー</p>
                    <TatefudaPreview 
                      tatePattern={modalData.tatePattern}
                      layout={selectedTateOpt?.layout}
                      isOsonae={isOsonae}
                      input1={modalData.tateInput1}
                      input2={modalData.tateInput2}
                      input3={modalData.tateInput3}
                      input3a={modalData.tateInput3a}
                      input3b={modalData.tateInput3b}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="bg-white p-6 md:p-8 rounded-[32px] border-2 border-[#2D4B3E]/20 shadow-md space-y-6">
              <h3 className="text-[16px] font-black text-[#2D4B3E] border-b border-[#EAEAEA] pb-3 flex items-center gap-2"><CreditCard size={20}/> お支払い情報</h3>
              <div className="space-y-3 text-[13px] md:text-[14px] font-medium text-[#555555]">
                <div className="flex justify-between items-center"><span>商品代 (税抜):</span><span className="font-black text-[#111111] text-[16px]">¥{getTotals(modalData).item.toLocaleString()}</span></div>
                {/* ★ 内訳: feeBreakdown があれば各内訳を別行で、なければ従来通り合算 */}
                {modalData.feeBreakdown ? (
                  <>
                    {Number(modalData.feeBreakdown.baseFee) > 0 && (
                      <div className="flex justify-between items-center text-blue-600">
                        <span>{modalData.receiveMethod === 'delivery' ? '配達料:' : '送料:'}</span>
                        <span className="font-bold text-[16px]">¥{Number(modalData.feeBreakdown.baseFee).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(modalData.feeBreakdown.boxFee) > 0 && (
                      <div className="flex justify-between items-center text-blue-600">
                        <span>箱代:</span>
                        <span className="font-bold text-[16px]">¥{Number(modalData.feeBreakdown.boxFee).toLocaleString()}</span>
                      </div>
                    )}
                    {Number(modalData.feeBreakdown.coolFee) > 0 && (
                      <div className="flex justify-between items-center text-blue-600">
                        <span>クール便代:</span>
                        <span className="font-bold text-[16px]">¥{Number(modalData.feeBreakdown.coolFee).toLocaleString()}</span>
                      </div>
                    )}
                  </>
                ) : (
                  getTotals(modalData).fee > 0 && <div className="flex justify-between items-center text-blue-600"><span>配送料:</span><span className="font-bold text-[16px]">¥{getTotals(modalData).fee.toLocaleString()}</span></div>
                )}
                {getTotals(modalData).pickup > 0 && <div className="flex justify-between items-center text-orange-600"><span>器回収・返却費:</span><span className="font-bold text-[16px]">¥{getTotals(modalData).pickup.toLocaleString()}</span></div>}
                <div className="flex justify-between items-center border-t border-[#EAEAEA] pt-3 text-[#2D4B3E]"><span>消費税 (10%):</span><span className="font-bold text-[16px]">¥{getTotals(modalData).tax.toLocaleString()}</span></div>
                
                <div className="flex justify-between border-t-2 border-[#2D4B3E]/20 pt-4 mt-2 items-end">
                  <span className="text-[13px] font-bold text-[#2D4B3E] tracking-widest mb-1">合計 (税込)</span>
                  <span className="text-[32px] md:text-[36px] font-black text-[#2D4B3E] leading-none">¥{getTotals(modalData).total.toLocaleString()}</span>
                </div>
              </div>
              
              {modalData.paymentMethod && (
                <div className="pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-t border-[#EAEAEA]">
                  <div className="flex items-center gap-2 bg-[#F7F7F7] px-4 py-2.5 rounded-xl border border-[#EAEAEA] shadow-sm">
                    <span className="text-[10px] font-bold text-[#999999] tracking-widest">支払方法</span>
                    <span className="text-[13px] font-bold text-[#2D4B3E]">{getPaymentLabel(modalData.paymentMethod)}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {isUnpaid ? (
                      <>
                        <span className="text-[12px] font-bold text-[#D97D54] flex items-center gap-1">
                          <AlertCircle size={16}/> {currentPaymentStatus}
                        </span>
                        {onUpdatePayment && (
                          <button
                            onClick={() => {
                              // ★ 銀行振込の場合は確認モーダル経由（納品日確認+メール送信）
                              if (modalData.paymentMethod === 'bank_transfer') {
                                setShowPaymentConfirmModal(true);
                              } else {
                                onUpdatePayment(order.id, modalData);
                              }
                            }}
                            className="px-4 py-2 bg-[#D97D54] text-white text-[12px] font-bold rounded-xl hover:bg-[#c26d48] transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                          >
                            <CheckCircle2 size={16}/> 入金済にする
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-[12px] font-bold text-green-600 bg-green-50 px-3 py-2 rounded-xl border border-green-200 flex items-center gap-1">
                        <CheckCircle2 size={16}/> {currentPaymentStatus}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {modalData.statusHistory && modalData.statusHistory.length > 0 && (
            <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm mb-4">
              <h3 className="text-[13px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-2 flex items-center gap-2">
                <ListChecks size={16}/> 対応履歴
              </h3>
              <div className="space-y-2 mt-4 text-[12px]">
                {modalData.statusHistory.map((h, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-dashed border-[#EAEAEA] pb-2 last:border-0">
                    <span className="text-[#999999] font-mono">{safeFormatDate(h.date, true)}</span>
                    <span className="font-bold text-[#2D4B3E] px-3">{h.status}</span>
                    <span className="bg-[#FBFAF9] border border-[#EAEAEA] px-2 py-1 rounded text-[#555] font-bold">{h.staff}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modalData.note && (
            <div className="bg-yellow-50 p-6 rounded-[24px] border border-yellow-200 shadow-sm mb-4">
              <h3 className="text-[12px] font-bold text-yellow-800 mb-2 tracking-widest flex items-center gap-2">社内メモ / お客様要望</h3>
              <p className="text-[14px] font-bold text-yellow-900 whitespace-pre-wrap leading-relaxed">{modalData.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* ★ 銀行振込 入金確認モーダル */}
      {showPaymentConfirmModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111111]/70 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={(e) => { e.stopPropagation(); setShowPaymentConfirmModal(false); }}
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
              <div><span className="text-[#999]">ご注文者:</span> <span className="font-bold text-[#111]">{modalData.customerInfo?.name || '-'}</span></div>
              <div><span className="text-[#999]">合計金額:</span> <span className="font-bold text-[#2D4B3E]">¥{getTotals(modalData).total.toLocaleString()}</span></div>
              <div><span className="text-[#999]">現在の納品予定日:</span> <span className="font-bold">{modalData.selectedDate || '未指定'} {modalData.selectedTime || ''}</span></div>
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
              ✉️ 確定すると、お客様に「入金確認・納品日のお知らせ」メールが自動送信されます
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPaymentConfirmModal(false)}
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
    </div>
  );
}