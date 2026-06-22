'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase'; 
import {
  X, Printer, Send, Archive, RotateCcw, Trash2,
  Store, Truck, Package, ListChecks, ChevronRight,
  Calendar as CalendarIcon, User, MapPin, AlertCircle,
  Tag, MessageSquare, CreditCard, CheckCircle2, Upload, ImageIcon,
  Edit3, ArrowRight, TrendingUp, TrendingDown, FileText, Bell, BellOff,
  Wallet, RefreshCw, Mail, Camera, Plus, Clock, ShoppingBag, History,
  Save, ArrowDown, Gift, Pen, Lightbulb
} from 'lucide-react';
import TatefudaPreview from '@/components/TatefudaPreview';
import { ensureOperationAllowed, getCurrentRole, getCurrentStaff } from '@/utils/staffRole';
import { getTateOptions } from '@/utils/tateMaster';

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
  // ★ 完成写真メール送信前の確認モーダル用 state
  const [completionMailPreview, setCompletionMailPreview] = useState(null); // { images, customerEmail } | null
  const [isSendingMail, setIsSendingMail] = useState(false);
  // ★ 完成写真送信時の納品日確認・編集
  const [completionDeliveryDate, setCompletionDeliveryDate] = useState('');
  const [completionDeliveryTime, setCompletionDeliveryTime] = useState('');

  // [注文-4] 金額訂正モーダル（オーナー権限）
  const [showAmountCorrection, setShowAmountCorrection] = useState(false);
  const [correctionItemPrice, setCorrectionItemPrice] = useState('');
  const [correctionFee, setCorrectionFee] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  // [通知モード] 'correction' | 'payment_received' | 'none'
  const [correctionNotifyMode, setCorrectionNotifyMode] = useState('correction');
  const [correctionNotifyStore, setCorrectionNotifyStore] = useState(true);
  // [入金済みマーク] 訂正と同時に入金完了扱いにする
  const [correctionMarkAsPaid, setCorrectionMarkAsPaid] = useState(false);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const isOwner = (() => {
    if (typeof window === 'undefined') return false;
    try { return getCurrentRole() === 'owner'; } catch { return false; }
  })();

  // ★ 新規追加：メールテンプレート選択メニューの表示状態
  const [showMailTemplates, setShowMailTemplates] = useState(false);

  // ★ 入金確認モーダル（銀行振込の手動入金確認 + 納品日変更 + 自動メール送信）
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);
  const [confirmDeliveryDate, setConfirmDeliveryDate] = useState('');
  const [confirmDeliveryTime, setConfirmDeliveryTime] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // ★ 編集モーダル（オーダー内容・日程の変更）
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null); // 編集用の作業データ
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
    setShowEditModal(false);
    setEditForm(null);
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
    let labels = [];

    // ★ EC注文 → ecLabels を優先
    if (modalData?.isEc || modalData?.cartItems?.length > 0) {
      labels = (config?.ecLabels?.length > 0) ? [...config.ecLabels] : ['受注', '発送準備中', '発送済み'];
    } else {
      // ★ 花の種類別ステータス（オーダー商品）
      const ft = modalData?.flowerType;
      if (ft && config?.orderTypeLabels?.[ft]?.length > 0) {
        labels = [...config.orderTypeLabels[ft]];
      } else if (config?.type === 'custom' && config?.customLabels?.length > 0) {
        labels = [...config.customLabels];
      } else {
        // ★ 標準モードのデフォルト（設定画面の表示と揃える）
        labels = ['受注', '制作', '配達', '片付', '請求'];
      }
    }

    // ★ 受取方法に応じた完了ステータスを末尾に自動追加（共通システムステータス）
    const rm = modalData?.receiveMethod;
    const completionStatus = rm === 'pickup' ? '店頭お渡し完了'
      : rm === 'delivery' ? '配達完了'
      : rm === 'sagawa' ? '配送業者引き渡し完了'
      : null;
    if (completionStatus && !labels.includes(completionStatus)) {
      labels.push(completionStatus);
    }
    return labels;
  };

  const isOsonae = modalData.flowerPurpose?.includes('供') || modalData.flowerPurpose?.includes('悔') || modalData.flowerPurpose?.includes('葬') || modalData.flowerPurpose?.includes('忌');
  // [Phase2-⑦] 共通モジュール utils/tateMaster から取得
  const allTateOptions = getTateOptions(isOsonae);
  const selectedTateOpt = allTateOptions.find(opt => opt.id === modalData.tatePattern);

  const handleUploadCompletionImage = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `completion_${order.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('portfolio').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      // ★ 配列に追加（既存写真も保持）
      const existing = Array.isArray(modalData.completionImages)
        ? modalData.completionImages
        : (modalData.completionImage ? [modalData.completionImage] : []);
      const allImages = [...existing, ...uploadedUrls];

      const updatedData = {
        ...modalData,
        completionImages: allImages,
        completionImage: allImages[0], // 後方互換: 1枚目を従来のフィールドにも入れる
      };
      const { error: dbError } = await supabase.from('orders')
        .update({ order_data: updatedData })
        .eq('id', order.id);

      if (dbError) throw dbError;

      order.order_data.completionImages = allImages;
      order.order_data.completionImage = allImages[0];

      // ★ 完成写真メールは自動送信せず、確認モーダルでプレビュー → 送信
      const customerEmail = modalData.customerInfo?.email;
      if (customerEmail) {
        // ★ 納品日初期値をセット
        setCompletionDeliveryDate(modalData.selectedDate || '');
        setCompletionDeliveryTime(modalData.selectedTime || '');
        setCompletionMailPreview({ images: allImages, customerEmail });
      } else {
        alert('完成写真をアップロードしました\n（お客様のメアドが登録されてないため、メール送信はスキップされます）');
      }

    } catch (error) {
      console.error('Upload Error:', error);
      alert('画像のアップロードに失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  // ★ 完成写真メール送信を実行 (確認モーダルから呼ばれる)
  //    納品日・時間を更新してからメール送信（変更があれば反映）
  const sendCompletionPhotoMail = async () => {
    if (!completionMailPreview) return;
    if (!completionDeliveryDate) {
      alert('納品予定日を入力してください');
      return;
    }
    setIsSendingMail(true);
    try {
      // 1. 納品日・時間を先にDB更新（メール本文に反映するため）
      const updatedData = {
        ...modalData,
        selectedDate: completionDeliveryDate,
        selectedTime: completionDeliveryTime || modalData.selectedTime || '',
      };
      const { error: updErr } = await supabase
        .from('orders')
        .update({ order_data: updatedData })
        .eq('id', order.id);
      if (updErr) throw updErr;

      // 2. 親へ反映
      if (onUpdatePayment) {
        await onUpdatePayment(order.id, updatedData, { skipConfirm: true, alreadyUpdated: true });
      }

      // 3. メール送信
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('セッションが切れています。再ログインしてください。');
        return;
      }
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
        alert(`お客様（${completionMailPreview.customerEmail}）に完成写真メールを送信しました`);
        setCompletionMailPreview(null);
      } else {
        alert(`メール送信できませんでした: ${data.error || '原因不明'}`);
      }
    } catch (e) {
      alert(`メール送信に失敗: ${e.message}`);
    } finally {
      setIsSendingMail(false);
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

      // ★ [Phase1-③ XSS対策] HTMLエンティティをエスケープ。帳票HTMLに顧客入力を埋め込む際は必ずこの関数経由で
      const formatText = (txt) => String(txt || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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
      // ★ ④ インボイス番号: 未登録なら空欄（フェイク番号を出さない）
      const shopInvoice = (shop.invoiceNumber || '').trim();

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
          // ★ 立札に連名が含まれる場合 (\n) は ・ で繋いで1行にコンパクト化
          const compact = (s) => formatText(s || '').split(/\n+/).filter(Boolean).join(' ・ ');
          return `<div class="simple-card-text">${modalData.tatePattern ? `<span style="color:#d32f2f; font-weight:bold;">[${formatText(modalData.tatePattern)}]</span> ` : ''}${[compact(modalData.tateInput1), compact(modalData.tateInput2), compact(modalData.tateInput3)].filter(Boolean).join(' / ')}</div>`;
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
          itemRows = modalData.cartItems.map(c => {
            const opt = c.selectedOptions || {};
            const optTotal = Number(c.optionsTotal) || 0;
            // ★ オプションの詳細を商品名の下に表示
            const optLines = [];
            if (opt.wrapping)      optLines.push(`🎁 ラッピング (+¥${(Number(opt.wrapping.price)||0).toLocaleString()})`);
            if (opt.messageCard)   optLines.push(`💌 メッセージカード${opt.messageCard.text ? ` 「${formatText(opt.messageCard.text)}」` : ''} ${Number(opt.messageCard.price) > 0 ? `(+¥${Number(opt.messageCard.price).toLocaleString()})` : '(無料)'}`);
            if (opt.textInsertion) optLines.push(`✍️ 文字入れ「${formatText(opt.textInsertion.text)}」(${formatText(opt.textInsertion.position)}) (+¥${(Number(opt.textInsertion.price)||0).toLocaleString()})`);
            const optBlock = optLines.length > 0
              ? `<div class="item-detail" style="color:#b8588a; margin-top:1mm;">${optLines.join('<br/>')}</div>`
              : '';
            const lineTotal = (Number(c.price) + optTotal) * Number(c.qty);
            return `
              <tr>
                <td class="item-cell">
                  <div class="item-name">${formatText(c.name)}</div>
                  ${optBlock}
                </td>
                <td class="qty-cell">${formatText(c.qty)}</td>
                <td class="price-cell">${hidePrice ? '' : formatPrice(lineTotal)}</td>
              </tr>
            `;
          }).join('');
        } else {
          // ★ ⑤ 納品書(delivery)は商品名のみ、用途・色・イメージ・備考は出さない
          const isDeliverySlip = slipType === 'delivery';
          itemRows = `
              <tr>
                <td class="item-cell">
                  <div class="item-name">${formatText(modalData.flowerType) || '未設定'}</div>
                  ${isDeliverySlip ? '' : `<div class="item-detail">用途: ${formatText(modalData.flowerPurpose) || '-'}${modalData.otherPurpose ? ` (${formatText(modalData.otherPurpose)})` : ''} / 色: ${formatText(modalData.flowerColor) || '-'}${modalData.otherColor ? ` (${formatText(modalData.otherColor)})` : ''} / イメージ: ${formatText(modalData.flowerVibe) || '-'}${modalData.otherVibe ? ` (${formatText(modalData.otherVibe)})` : ''}</div>`}
                  ${isDeliverySlip ? '' : renderCardBlock()}
                  ${isDeliverySlip || !modalData.note ? '' : `<div class="item-detail" style="color:#d97c8f; margin-top:2mm;">備考: ${formatText(modalData.note)}</div>`}
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
        ${!hidePrice ? `
          <div style="display:flex; justify-content:flex-end;">
            <table class="amount-summary">
              <tbody>
                <tr><td class="amount-label">商品代</td><td class="amount-val">${formatPrice(totals.item)}</td></tr>
                <tr><td class="amount-label">送料・手数料</td><td class="amount-val">${formatPrice(totals.fee + totals.pickup)}</td></tr>
                <tr><td class="amount-label">消費税(10%)</td><td class="amount-val">${formatPrice(totals.tax)}</td></tr>
                <tr><td class="amount-label-total">合計</td><td class="amount-val-total">${formatPrice(totals.total)}</td></tr>
              </tbody>
            </table>
          </div>
        ` : ''}
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
          // [印刷修正] 自動追加された完了系ステータスは署名欄から除外（受領証の方に分かれているため）
          //   + 最大4個までに制限（横スペースに収めるため）
          const workflowStatuses = activeStatuses
            .filter(s => !/完了|引き渡し|発送済/.test(s))
            .slice(0, 4);
          footerActionsHtml = workflowStatuses.map(statusLabel => {
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
              <div>TEL: ${shopTel}${shopInvoice ? ` (${shopInvoice})` : ''}</div>
            </div>
            <div class="footer-actions">${footerActionsHtml}</div>
          </div>
        `;
      };

      const renderSlip = ({ title, type, hidePrice = false, showReceiptNote = false, fullPage = false }) => `
        <div class="${fullPage ? 'slip-full' : 'slip'}" style="color: ${hidePrice ? '#333' : 'inherit'}">
          <div class="slip-header">
            <div class="slip-title" style="color:${getTitleColor(type)}">${title}${isEcOrder ? ` <span style="font-size:9pt; background:#e3f2fd; color:#1565c0; padding:1mm 2mm; border-radius:1mm; font-weight:bold; vertical-align:middle;">EC注文</span>` : ''}</div>
            ${type === 'delivery' ? '' /* ★ ⑥ 納品書はヘッダー右上の伝票番号・受付日・お渡し方法・希望日・入金状況を出さない */ : renderHeaderMeta()}
          </div>
          ${renderClientBoxes(hidePrice)}
          ${renderItemsBlock(hidePrice, type)}
          ${showReceiptNote ? `
            <div class="receipt-note" style="margin-top: 2mm; margin-bottom: 1mm;">
              <div style="font-size: 8pt; margin-bottom: 2mm;">上記の商品を確かに受領いたしました。</div>
              <div style="display: flex; justify-content: flex-end; gap: 6mm; font-size: 9pt;">
                <div>受領日：<span style="display:inline-block; width:10mm; border-bottom:1px solid #555;"></span>年<span style="display:inline-block; width:7mm; border-bottom:1px solid #555;"></span>月<span style="display:inline-block; width:7mm; border-bottom:1px solid #555;"></span>日</div>
                <div>サインまたは印：<span style="display:inline-block; width:40mm; border-bottom:1px solid #555;"></span></div>
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
            /* ★ ③ A4そのまま。プリンター非印刷領域を考慮して内側に safety padding を確保 */
            @page { size: A4 portrait; margin: 0; }
            @media print {
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .page { box-shadow: none !important; margin: 0 !important; page-break-after: always !important; break-after: page !important; page-break-inside: avoid !important; }
              .page:last-child { page-break-after: auto !important; break-after: auto !important; }
            }
            * { box-sizing: border-box; }
            body { margin: 0; background-color: #f3f4f6; font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif; color: #222; }
            /* ★ ③ A4 = 210x297mm。プリンター非印刷領域分の safety を確保 */
            .page { width: 210mm; height: 297mm; background: #fff; margin: 0 auto 10mm auto; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: flex; flex-direction: column; position: relative; overflow: hidden; padding: 6mm 0 14mm 0; }
            /* 2分割伝票: A4の印刷可能領域 277mm ÷ 2 = 138.5mm/slip */
            .slip { width: 100%; height: 138mm; padding: 3mm 14mm 3mm 14mm; display: flex; flex-direction: column; position: relative; overflow: hidden; }
            .slip:first-child { border-bottom: 1px dashed #aaa; }
            /* EC注文用: 1ページ全面（277mm） */
            .slip-full { width: 100%; height: 277mm; padding: 4mm 14mm 6mm 14mm; display: flex; flex-direction: column; position: relative; overflow: hidden; }
            .cutline { position: absolute; top: calc(6mm + 138mm); left: 10mm; right: 10mm; transform: translateY(-50%); display: flex; justify-content: center; align-items: center; z-index: 10; pointer-events: none; }
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

            /* ★ [印刷修正] 全要素の長文折り返し強制 - プリンター差・長文での崩れ完全防止 */
            .slip *, .slip-full *, .info-box *, .items-table * {
              word-break: break-word !important;
              overflow-wrap: anywhere !important;
            }
            /* 数量・金額セルは折り返しさせない */
            .qty-cell, .price-cell, .amount-summary td {
              white-space: nowrap !important;
              word-break: keep-all !important;
            }
            /* 備考・詳細セルは適度に折り返し */
            .item-detail, .simple-card-text {
              line-height: 1.4 !important;
              max-height: 18mm;
              overflow: hidden;
            }
            /* 住所セルが多段になっても枠内で収まる */
            .info-box .info-sub-bottom {
              max-height: 16mm;
              overflow: hidden;
            }
            /* slip 内の overflow を厳密に */
            .slip, .slip-full {
              overflow: hidden !important;
            }
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
      alert('入金済みに更新し、お客様にメールを送信しました');
    } catch (err) {
      console.error(err);
      alert(`処理に失敗しました: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ★ 編集モーダルを開く（現在の注文データを編集フォームにロード）
  const openEditModal = () => {
    setEditForm({
      selectedDate: modalData.selectedDate || '',
      selectedTime: modalData.selectedTime || '',
      flowerType: modalData.flowerType || '',
      flowerPurpose: modalData.flowerPurpose || '',
      flowerColor: modalData.flowerColor || '',
      flowerVibe: modalData.flowerVibe || '',
      otherPurpose: modalData.otherPurpose || '',
      otherVibe: modalData.otherVibe || '',
      cardType: modalData.cardType || '',
      cardMessage: modalData.cardMessage || '',
      tatePattern: modalData.tatePattern || '',
      tateInput1: modalData.tateInput1 || '',
      tateInput2: modalData.tateInput2 || '',
      tateInput3: modalData.tateInput3 || '',
      receiveMethod: modalData.receiveMethod || '',
      selectedShop: modalData.selectedShop || '',
      isRecipientDifferent: !!modalData.isRecipientDifferent,
      recipientInfo: { ...(modalData.recipientInfo || {}) },
      customerInfo: { ...(modalData.customerInfo || {}) },
      note: modalData.note || '',
    });
    setShowEditModal(true);
  };

  // ★ 編集内容を保存
  const handleSaveEdit = async () => {
    if (!editForm) return;
    setIsSavingEdit(true);
    try {
      const updatedData = {
        ...modalData,
        selectedDate: editForm.selectedDate,
        selectedTime: editForm.selectedTime,
        flowerType: editForm.flowerType,
        flowerPurpose: editForm.flowerPurpose,
        flowerColor: editForm.flowerColor,
        flowerVibe: editForm.flowerVibe,
        otherPurpose: editForm.otherPurpose,
        otherVibe: editForm.otherVibe,
        cardType: editForm.cardType,
        cardMessage: editForm.cardMessage,
        tatePattern: editForm.tatePattern,
        tateInput1: editForm.tateInput1,
        tateInput2: editForm.tateInput2,
        tateInput3: editForm.tateInput3,
        receiveMethod: editForm.receiveMethod,
        selectedShop: editForm.selectedShop,
        isRecipientDifferent: editForm.isRecipientDifferent,
        recipientInfo: editForm.recipientInfo,
        customerInfo: editForm.customerInfo,
        note: editForm.note,
        // 編集履歴を残す
        statusHistory: [
          ...(Array.isArray(modalData.statusHistory) ? modalData.statusHistory : []),
          { date: new Date().toISOString(), status: '内容を編集', staff: 'スタッフ' },
        ],
      };
      const { error } = await supabase
        .from('orders')
        .update({ order_data: updatedData })
        .eq('id', order.id);
      if (error) throw error;

      // 親へ反映
      if (onUpdatePayment) {
        await onUpdatePayment(order.id, updatedData, { skipConfirm: true, alreadyUpdated: true });
      }
      setShowEditModal(false);
      alert('注文内容を更新しました');
    } catch (err) {
      console.error(err);
      alert(`更新に失敗しました: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
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
      alert('メールを送信しました');
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

            {/* [注文-4] 金額訂正ボタン（オーナーのみ） */}
            {isOwner && (
              <button
                onClick={() => {
                  setCorrectionItemPrice(String(modalData.itemPrice || ''));
                  setCorrectionFee(String((Number(modalData.calculatedFee) || 0) + (Number(modalData.pickupFee) || 0)));
                  setCorrectionReason('');
                  setCorrectionNotifyMode('correction');
                  setCorrectionNotifyStore(true);
                  setCorrectionMarkAsPaid(false);
                  setShowAmountCorrection(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[10px] md:text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all"
                title="注文金額を訂正（オーナー権限）"
              >
                <Edit3 size={14}/> <span className="hidden sm:inline">金額訂正</span>
              </button>
            )}

            {/* [業務-5] 完成写真メール 後から送信ボタン（既に写真がアップロード済みの注文のみ） */}
            {(() => {
              const hasImages = (Array.isArray(modalData.completionImages) && modalData.completionImages.length > 0) || !!modalData.completionImage;
              const customerEmail = modalData.customerInfo?.email;
              if (!hasImages || !customerEmail) return null;
              const allImages = Array.isArray(modalData.completionImages) && modalData.completionImages.length > 0
                ? modalData.completionImages
                : [modalData.completionImage];
              return (
                <button
                  onClick={() => {
                    setCompletionDeliveryDate(modalData.selectedDate || '');
                    setCompletionDeliveryTime(modalData.selectedTime || '');
                    setCompletionMailPreview({ images: allImages, customerEmail });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#FFF8E1] border border-[#F9C846] rounded-xl text-[10px] md:text-[11px] font-bold text-[#8B6F2C] hover:bg-[#FFEFC2] transition-all"
                  title="完成写真メールを今から送信"
                >
                  <Send size={14} /> <span className="hidden sm:inline">完成写真メール送信</span>
                </button>
              );
            })()}
            
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

            {/* ★ 注文内容・日程の編集ボタン */}
            <button onClick={openEditModal} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] md:text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition-all shadow-sm">
              <Edit3 size={14}/> <span className="hidden sm:inline">内容を編集</span>
            </button>

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
                <option value="キャンセル">キャンセル</option>
              </select>
              {/* 担当者選択は廃止：現在ログイン中のスタッフを自動使用 */}
              <button onClick={async () => {
                // ★ ① PIN必須なのにスタッフ未選択 → 操作拒否
                const guard = ensureOperationAllowed('ステータス更新');
                if (!guard.allowed) { alert(guard.message); return; }
                const currentStaff = (typeof window !== 'undefined') ? JSON.parse(localStorage.getItem('florix_currentStaff') || 'null') : null;
                const autoStaff = currentStaff?.name || '';

                // ★ 完了系ステータスの場合、メール送信を確認
                //   キーワードベースで判定（カスタムラベルにも対応）
                const detectCompletionTrigger = (statusText) => {
                  const s = String(statusText || '');
                  // 店頭お渡し系
                  if (/お渡し完了|店頭|引き取り完了/.test(s)) {
                    return { trigger: 'status_pickup_done', label: '店頭お渡し完了' };
                  }
                  // 配達完了系（自社配達）
                  if (/配達完了/.test(s)) {
                    return { trigger: 'status_delivery_done', label: '配達完了' };
                  }
                  // 配送・発送系（業者配送）
                  if (/発送済|発送完了|配送業者|引き渡し完了|発送$/.test(s)) {
                    return { trigger: 'status_shipping_done', label: '発送完了' };
                  }
                  return null;
                };
                const completionInfo = detectCompletionTrigger(updateForm.status);
                const customerEmail = modalData.customerInfo?.email;

                if (completionInfo && customerEmail) {
                  // ★ 発送完了の場合は佐川追跡番号を入力できる
                  let trackingNo = '';
                  if (completionInfo.trigger === 'status_shipping_done') {
                    trackingNo = window.prompt(
                      `佐川急便のお問い合わせ番号 (任意)\n\n` +
                      `入力した場合、追跡URLが自動でメール本文に含まれます。\n` +
                      `わからない・後で送る場合は空欄のままOKしてください。\n\n` +
                      `お問い合わせ番号:`,
                      ''
                    );
                    // promptキャンセル時は null → 送信中止
                    if (trackingNo === null) return;
                    trackingNo = String(trackingNo).trim();
                  }

                  const trackingInfoLine = trackingNo
                    ? `\n佐川追跡番号: ${trackingNo}（メール本文に追跡URLも自動挿入）`
                    : '';
                  const sendMail = window.confirm(
                    `ステータスを「${completionInfo.label}」に更新します。\n\n` +
                    `お客様（${customerEmail}）に「${completionInfo.label} のお知らせ」メールを自動送信しますか？` +
                    trackingInfoLine + `\n\n` +
                    `[OK] 更新＋メール送信\n[キャンセル] 更新のみ（メール送信なし）`
                  );

                  if (sendMail) {
                    // メール送信API呼び出し
                    try {
                      const { supabase } = await import('@/utils/supabase');
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch('/api/staff/send-template-email', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${session?.access_token || ''}`,
                        },
                        body: JSON.stringify({
                          orderId: order.id,
                          triggerId: completionInfo.trigger,
                          extraVars: trackingNo ? { shippingTrackingNumber: trackingNo } : undefined,
                        }),
                      });
                      const result = await res.json();
                      if (res.ok) {
                        alert(`${completionInfo.label}のお知らせメールを送信しました${trackingNo ? '\n（佐川追跡番号も同送）' : ''}`);
                      } else {
                        alert('メール送信失敗: ' + (result.error || '不明なエラー'));
                      }
                    } catch (e) {
                      alert('メール送信エラー: ' + e.message);
                    }
                  }
                }

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
                {(() => {
                  const allImages = Array.isArray(modalData.completionImages)
                    ? modalData.completionImages
                    : (modalData.completionImage ? [modalData.completionImage] : []);
                  if (allImages.length > 0) {
                    return (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[#2D4B3E] bg-[#2D4B3E]/10 px-2 py-0.5 rounded inline-block">完成写真 ({allImages.length}枚)</span>
                        <div className="grid grid-cols-2 gap-2 w-full sm:w-40">
                          {allImages.map((url, i) => (
                            <div key={i} className="relative group">
                              <img src={url} alt={`完成写真${i+1}`} className="w-full aspect-square object-cover rounded-lg border border-[#EAEAEA] shadow-sm"/>
                              <button
                                onClick={async () => {
                                  if (!confirm('この写真を削除しますか？')) return;
                                  const next = allImages.filter((_, idx) => idx !== i);
                                  const updated = { ...modalData, completionImages: next, completionImage: next[0] || null };
                                  await supabase.from('orders').update({ order_data: updated }).eq('id', order.id);
                                  order.order_data.completionImages = next;
                                  order.order_data.completionImage = next[0] || null;
                                  // 表示更新のためモーダル閉じて再オープン推奨
                                  window.location.reload();
                                }}
                                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                title="削除"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (modalData.referenceImage) {
                    return (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-[#999999] bg-[#F7F7F7] px-2 py-0.5 rounded inline-block">お客様からの参考画像</span>
                        <img src={modalData.referenceImage} alt="参考画像" className="w-full sm:w-40 h-32 sm:h-40 object-cover rounded-2xl border border-[#EAEAEA] shadow-sm" />
                      </div>
                    );
                  }
                  return (
                    <div className="w-full sm:w-40 h-32 sm:h-40 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl flex flex-col items-center justify-center text-[#999999] text-[11px] font-bold gap-2">
                      <ImageIcon size={24}/> 画像なし
                    </div>
                  );
                })()}

                <div className="relative mt-2">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
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
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded inline-flex items-center gap-1"><ShoppingBag size={10}/> EC注文</span>
                      <span className="text-[10px] text-[#999999]">{modalData.cartItems.length} 商品 / 合計 {modalData.cartItems.reduce((s, c) => s + (Number(c.qty) || 0), 0)} 点</span>
                    </div>
                    <div className="space-y-3">
                      {modalData.cartItems.map((c, idx) => {
                        const opt = c.selectedOptions || {};
                        const optTotal = Number(c.optionsTotal) || 0;
                        const lineTotal = (Number(c.price) + optTotal) * Number(c.qty);
                        return (
                          <div key={idx} className="bg-white p-2 rounded-lg border border-[#EAEAEA] space-y-2">
                            <div className="flex items-center gap-3">
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
                                <p className="text-[10px] text-[#999999] mt-0.5">¥{Number(c.price).toLocaleString()}{optTotal > 0 && <span className="text-pink-700"> + オプション¥{optTotal.toLocaleString()}</span>} × {c.qty}</p>
                              </div>
                              <span className="text-[13px] text-[#2D4B3E] font-bold shrink-0">
                                ¥{lineTotal.toLocaleString()}
                              </span>
                            </div>
                            {/* ★ 選択オプションの詳細表示 */}
                            {(opt.wrapping || opt.messageCard || opt.textInsertion) && (
                              <div className="ml-[68px] bg-pink-50 rounded-lg p-2 space-y-1 border border-pink-100">
                                {opt.wrapping && (
                                  <p className="text-[10px] text-pink-900 font-bold flex items-center gap-1"><Gift size={10}/> ラッピング (+¥{(Number(opt.wrapping.price)||0).toLocaleString()})</p>
                                )}
                                {opt.messageCard && (
                                  <div className="text-[10px] text-pink-900">
                                    <p className="font-bold flex items-center gap-1"><Mail size={10}/> メッセージカード {Number(opt.messageCard.price) > 0 ? `(+¥${Number(opt.messageCard.price).toLocaleString()})` : '(無料)'}</p>
                                    {opt.messageCard.text && (
                                      <p className="ml-3 text-[10px] text-[#555555] whitespace-pre-wrap mt-0.5">「{opt.messageCard.text}」</p>
                                    )}
                                  </div>
                                )}
                                {opt.textInsertion && (
                                  <p className="text-[10px] text-pink-900 font-bold flex items-center gap-1"><Pen size={10}/> 文字入れ「{opt.textInsertion.text}」({opt.textInsertion.position}) (+¥{(Number(opt.textInsertion.price)||0).toLocaleString()})</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                    {modalData.tateInput3 && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold shrink-0">贈り主:</span><span className="font-black whitespace-pre-line">{modalData.tateInput3}</span></div>}
                    {modalData.tateInput3a && <div className="flex border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold shrink-0">会社名:</span><span className="font-black whitespace-pre-line">{modalData.tateInput3a}</span></div>}
                    {modalData.tateInput3b && <div className="flex"><span className="w-16 text-[#999999] font-bold shrink-0">役職・名:</span><span className="font-black whitespace-pre-line">{modalData.tateInput3b}</span></div>}
                    
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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-[11px] text-blue-900 leading-relaxed flex items-start gap-1.5">
              <Mail size={12} className="shrink-0 mt-0.5"/>
              <span>確定すると、お客様に「入金確認・納品日のお知らせ」メールが自動送信されます</span>
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

      {/* ★ 注文内容編集モーダル */}
      {showEditModal && editForm && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#111]/70 backdrop-blur-sm p-3 md:p-4"
          onClick={() => !isSavingEdit && setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#EAEAEA] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h3 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><Pen size={16}/> 注文内容の編集</h3>
              <button onClick={() => !isSavingEdit && setShowEditModal(false)} className="text-[#999] hover:text-[#111] text-[20px] font-bold">✕</button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-blue-900 flex items-start gap-1.5">
                <Lightbulb size={12} className="shrink-0 mt-0.5"/>
                <span>日程変更・内容変更は電話受付前提。変更内容は対応履歴に記録されます。</span>
              </div>

              {/* 納品日・時間 */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 flex items-center gap-1.5"><CalendarIcon size={14}/> 納品日・時間</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">納品日</label>
                    <input type="date" value={editForm.selectedDate} onChange={(e) => setEditForm({...editForm, selectedDate: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">時間（任意）</label>
                    <input type="text" placeholder="例: 14:00〜16:00" value={editForm.selectedTime} onChange={(e) => setEditForm({...editForm, selectedTime: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                </div>
              </div>

              {/* お花の種類・用途・色・イメージ */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2">お花の種類・用途・色・イメージ</h4>
                <div>
                  <label className="text-[11px] font-bold text-[#555] block mb-1">お花の種類</label>
                  <input type="text" value={editForm.flowerType} onChange={(e) => setEditForm({...editForm, flowerType: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">用途</label>
                    <input type="text" value={editForm.flowerPurpose} onChange={(e) => setEditForm({...editForm, flowerPurpose: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">用途（その他）</label>
                    <input type="text" value={editForm.otherPurpose} onChange={(e) => setEditForm({...editForm, otherPurpose: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">メインカラー</label>
                    <input type="text" value={editForm.flowerColor} onChange={(e) => setEditForm({...editForm, flowerColor: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">イメージ</label>
                    <input type="text" value={editForm.flowerVibe} onChange={(e) => setEditForm({...editForm, flowerVibe: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#555] block mb-1">イメージ（その他）</label>
                  <input type="text" value={editForm.otherVibe} onChange={(e) => setEditForm({...editForm, otherVibe: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                </div>
              </div>

              {/* 立札・カード */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2">立札・カード</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">カードタイプ</label>
                    <select value={editForm.cardType} onChange={(e) => setEditForm({...editForm, cardType: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]">
                      <option value="">指定なし</option>
                      <option value="立札">立札</option>
                      <option value="メッセージカード">メッセージカード</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">立札パターン</label>
                    <input type="text" placeholder="例: 御祝、御供" value={editForm.tatePattern} onChange={(e) => setEditForm({...editForm, tatePattern: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="立札 1行目" value={editForm.tateInput1} onChange={(e) => setEditForm({...editForm, tateInput1: e.target.value})} className="h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#2D4B3E]"/>
                  <input type="text" placeholder="立札 2行目" value={editForm.tateInput2} onChange={(e) => setEditForm({...editForm, tateInput2: e.target.value})} className="h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#2D4B3E]"/>
                  <textarea placeholder="立札 3行目（連名はEnter改行）" value={editForm.tateInput3} onChange={(e) => setEditForm({...editForm, tateInput3: e.target.value})} rows={2} className="px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[12px] outline-none focus:border-[#2D4B3E] resize-y"/>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#555] block mb-1">メッセージカード本文</label>
                  <textarea value={editForm.cardMessage} onChange={(e) => setEditForm({...editForm, cardMessage: e.target.value})} rows={3} className="w-full px-3 py-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                </div>
              </div>

              {/* 受取方法・配送先 */}
              <div className="space-y-3">
                <h4 className="text-[13px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 flex items-center gap-1.5"><Package size={14}/> 受取方法・配送先</h4>
                <div>
                  <label className="text-[11px] font-bold text-[#555] block mb-1">受取方法</label>
                  <select value={editForm.receiveMethod} onChange={(e) => setEditForm({...editForm, receiveMethod: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]">
                    <option value="">指定なし</option>
                    <option value="pickup">店頭受取</option>
                    <option value="delivery">自社配達</option>
                    <option value="sagawa">業者配送</option>
                  </select>
                </div>
                {editForm.receiveMethod === 'pickup' && (
                  <div>
                    <label className="text-[11px] font-bold text-[#555] block mb-1">受取店舗</label>
                    <input type="text" value={editForm.selectedShop} onChange={(e) => setEditForm({...editForm, selectedShop: e.target.value})} className="w-full h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.isRecipientDifferent} onChange={(e) => setEditForm({...editForm, isRecipientDifferent: e.target.checked})} className="accent-[#2D4B3E]"/>
                  <span className="text-[12px] font-bold text-[#555]">注文者と別住所に届ける</span>
                </label>
                {editForm.isRecipientDifferent && (
                  <div className="space-y-2 bg-[#FBFAF9] p-3 rounded-lg border border-[#EAEAEA]">
                    <input type="text" placeholder="お届け先 お名前" value={editForm.recipientInfo.name || ''} onChange={(e) => setEditForm({...editForm, recipientInfo: {...editForm.recipientInfo, name: e.target.value}})} className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                    <input type="text" placeholder="郵便番号" value={editForm.recipientInfo.zip || ''} onChange={(e) => setEditForm({...editForm, recipientInfo: {...editForm.recipientInfo, zip: e.target.value}})} className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                    <input type="text" placeholder="住所1（都道府県・市区町村）" value={editForm.recipientInfo.address1 || ''} onChange={(e) => setEditForm({...editForm, recipientInfo: {...editForm.recipientInfo, address1: e.target.value}})} className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                    <input type="text" placeholder="住所2（番地・建物）" value={editForm.recipientInfo.address2 || ''} onChange={(e) => setEditForm({...editForm, recipientInfo: {...editForm.recipientInfo, address2: e.target.value}})} className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                    <input type="text" placeholder="電話番号" value={editForm.recipientInfo.phone || ''} onChange={(e) => setEditForm({...editForm, recipientInfo: {...editForm.recipientInfo, phone: e.target.value}})} className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] outline-none focus:border-[#2D4B3E]"/>
                  </div>
                )}
              </div>

              {/* 社内メモ */}
              <div className="space-y-2">
                <h4 className="text-[13px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 flex items-center gap-1.5"><FileText size={14}/> 社内メモ</h4>
                <textarea value={editForm.note} onChange={(e) => setEditForm({...editForm, note: e.target.value})} rows={3} placeholder="変更内容のメモ等" className="w-full px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-[13px] outline-none focus:border-yellow-500"/>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#EAEAEA] px-6 py-4 flex gap-2 rounded-b-2xl">
              <button onClick={() => !isSavingEdit && setShowEditModal(false)} disabled={isSavingEdit} className="flex-1 h-12 bg-[#EAEAEA] text-[#555] text-[13px] font-bold rounded-xl hover:bg-[#dcdcdc] disabled:opacity-50">キャンセル</button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 h-12 bg-[#2D4B3E] text-white text-[13px] font-bold rounded-xl hover:bg-[#1f352b] disabled:opacity-50 flex items-center justify-center gap-1.5">
                {isSavingEdit ? '保存中...' : <><CheckCircle2 size={15}/>変更を保存</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [注文-4] 金額訂正モーダル（オーナーのみ） */}
      {showAmountCorrection && (() => {
        const newItem = Number(correctionItemPrice) || 0;
        const newFee = Number(correctionFee) || 0;
        const newSubtotal = newItem + newFee;
        const newTax = Math.floor(newSubtotal * 0.1);
        const newTotal = newSubtotal + newTax;
        // 訂正前の値も用意（比較表用）
        const oldItem = Number(modalData.itemPrice) || 0;
        const oldFee = (Number(modalData.calculatedFee) || 0) + (Number(modalData.pickupFee) || 0);
        const oldSubtotal = oldItem + oldFee;
        const oldTax = Math.floor(oldSubtotal * 0.1);
        const oldTotal = oldSubtotal + oldTax;
        const diff = newTotal - oldTotal;
        const corrections = Array.isArray(modalData.amountCorrections) ? modalData.amountCorrections : [];

        // [入金状況] 訂正前の入金状況判定
        const jpPS = String(modalData.paymentStatus || '');
        const dbPS = order?.payment_status;
        const wasPaid = dbPS === 'paid' || jpPS.includes('前払い済み') || jpPS.includes('入金済み');
        const paidAmount = wasPaid ? (modalData.paidAmount != null ? Number(modalData.paidAmount) : oldTotal) : 0;
        const balance = newTotal - paidAmount;
        let paymentSituation;
        if (wasPaid) {
          if (balance === 0) paymentSituation = 'fully_paid';
          else if (balance > 0) paymentSituation = 'additional_required';
          else paymentSituation = 'refund_required';
        } else {
          paymentSituation = 'unpaid';
        }
        const situationConfig = {
          unpaid: {
            accent: 'border-l-[#A85A3A] bg-[#FDF6F2]', text: 'text-[#A85A3A]',
            statusLabel: '未入金',
            actionTitle: '訂正後の金額を回収予定',
            actionDesc: `お客様へ ¥${newTotal.toLocaleString()} のお支払い案内メールをお送りします。`,
          },
          fully_paid: {
            accent: 'border-l-[#2F6B43] bg-[#F1F9F3]', text: 'text-[#2F6B43]',
            statusLabel: '入金済み（過不足なし）',
            actionTitle: '追加対応は不要',
            actionDesc: `お支払い済み額が訂正後の合計と一致するため、追加振込・返金は発生しません。`,
          },
          additional_required: {
            accent: 'border-l-[#A85A3A] bg-[#FDF6F2]', text: 'text-[#A85A3A]',
            statusLabel: '入金済み（追加お支払いが必要）',
            actionTitle: `追加で ¥${balance.toLocaleString()} のお支払いが必要`,
            actionDesc: `既にお支払い済みの額に対して、訂正後の差額をご案内します。`,
          },
          refund_required: {
            accent: 'border-l-[#3A6BA8] bg-[#F2F6FD]', text: 'text-[#3A6BA8]',
            statusLabel: '入金済み（返金処理が必要）',
            actionTitle: `¥${Math.abs(balance).toLocaleString()} の返金が必要`,
            actionDesc: `お客様へ返金のご案内をお送りします（振込先口座のご連絡を依頼）。`,
          },
        };
        const sc = situationConfig[paymentSituation];

        return (
          <div
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => { e.stopPropagation(); if (!isSavingCorrection) setShowAmountCorrection(false); }}
          >
            <div
              className="bg-white max-w-xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[#FAF7F2] border-b border-[#E5DED2]/60 px-7 py-5 flex items-start justify-between rounded-t-[20px] z-10">
                <div>
                  <p className="text-[10px] tracking-[0.3em] font-medium text-[#7E9279] mb-1" style={{ fontFamily: "var(--font-outfit), system-ui" }}>
                    AMOUNT CORRECTION
                  </p>
                  <h3 className="text-[18px] text-[#2F2F2F]" style={{ fontFamily: "var(--font-shippori), 'Noto Serif JP', serif", fontWeight: 500 }}>
                    注文金額の訂正
                  </h3>
                </div>
                <button
                  onClick={() => setShowAmountCorrection(false)}
                  disabled={isSavingCorrection}
                  className="w-9 h-9 rounded-full bg-white border border-[#E5DED2] hover:border-[#C97D60] flex items-center justify-center text-[#999] hover:text-[#C97D60] disabled:opacity-50 transition"
                >
                  <X size={16}/>
                </button>
              </div>
              <div className="bg-[#FAF7F2] p-7 space-y-6">

                <div className="bg-white border border-[#E5DED2] px-5 py-4 rounded-2xl">
                  <p className="text-[11.5px] text-[#5B5B5B] leading-[1.9]">
                    オーナー権限による金額訂正です。訂正履歴は監査ログとして残り、お客様への通知方法も選択できます。
                  </p>
                </div>

                {/* 既存の訂正履歴 */}
                {corrections.length > 0 && (
                  <details className="bg-white border border-[#E5DED2] rounded-2xl overflow-hidden">
                    <summary className="cursor-pointer px-5 py-4 text-[11.5px] text-[#5B5B5B] flex items-center justify-between hover:bg-[#FAF7F2]/50 transition list-none">
                      <span className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-full bg-[#FBE8DF] flex items-center justify-center">
                          <History size={12} className="text-[#C97D60]"/>
                        </span>
                        <span className="font-medium text-[#2F2F2F]">訂正履歴</span>
                        <span className="text-[10px] tracking-[0.15em] text-[#999]" style={{ fontFamily: "var(--font-outfit)" }}>
                          {corrections.length} ITEMS
                        </span>
                      </span>
                      <ChevronRight size={14} className="text-[#999]"/>
                    </summary>
                    <div className="px-5 pb-5 pt-1 space-y-3 border-t border-[#E5DED2]">
                      {corrections.slice().reverse().map((c, i) => (
                        <div key={i} className="py-3 border-b border-[#F0EAE0] last:border-0">
                          <div className="flex items-center gap-2 text-[10px] text-[#7E9279] mb-1.5" style={{ fontFamily: "var(--font-outfit)" }}>
                            <Clock size={10}/>
                            <span>{new Date(c.at).toLocaleString('ja-JP')}</span>
                            <span className="text-[#CCC]">/</span>
                            <span className="font-medium text-[#5B5B5B]" style={{ fontFamily: "var(--font-zen-kaku)" }}>{c.operatorName}</span>
                          </div>
                          <p className="text-[12px] font-mono text-[#5B5B5B] mb-1">
                            ¥{c.before?.totalAmount?.toLocaleString()}
                            <ArrowRight size={11} className="inline mx-1.5 text-[#C97D60]"/>
                            <span className="font-semibold text-[#2F2F2F]">¥{c.after?.totalAmount?.toLocaleString()}</span>
                          </p>
                          <p className="text-[11px] text-[#777] leading-relaxed">{c.reason}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* 入力フォーム */}
                <div className="bg-white border border-[#E5DED2] rounded-2xl p-5">
                  <p className="text-[10px] tracking-[0.3em] font-medium text-[#7E9279] mb-4" style={{ fontFamily: "var(--font-outfit)" }}>
                    NEW AMOUNT
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] text-[#5B5B5B] block mb-2">
                        商品代（税抜） <span className="text-[#C97D60]">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-[#999]">¥</span>
                        <input
                          type="number"
                          value={correctionItemPrice}
                          onChange={(e) => setCorrectionItemPrice(e.target.value)}
                          disabled={isSavingCorrection}
                          className="w-full h-12 pl-9 pr-4 bg-[#FAF7F2] border border-[#E5DED2] rounded-xl text-[15px] font-medium text-[#2F2F2F] focus:border-[#C97D60] focus:bg-white outline-none transition"
                          placeholder="4000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#5B5B5B] block mb-2">配送料・手数料（税抜）</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-[#999]">¥</span>
                        <input
                          type="number"
                          value={correctionFee}
                          onChange={(e) => setCorrectionFee(e.target.value)}
                          disabled={isSavingCorrection}
                          className="w-full h-12 pl-9 pr-4 bg-[#FAF7F2] border border-[#E5DED2] rounded-xl text-[15px] font-medium text-[#2F2F2F] focus:border-[#C97D60] focus:bg-white outline-none transition"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 計算結果 - 訂正前 / 訂正後 比較 */}
                <div className="bg-white border border-[#E5DED2] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E5DED2] flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-[#FBE8DF] flex items-center justify-center">
                      <FileText size={12} className="text-[#C97D60]"/>
                    </span>
                    <p className="text-[12px] font-medium text-[#2F2F2F]" style={{ fontFamily: "var(--font-zen-kaku)" }}>訂正内容</p>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
                    {/* 訂正前 */}
                    <div className="p-5">
                      <p className="text-[9px] tracking-[0.3em] text-[#999] mb-3" style={{ fontFamily: "var(--font-outfit)" }}>BEFORE</p>
                      <div className="space-y-2 text-[11.5px]">
                        <div className="flex justify-between text-[#777]"><span>商品代</span><span className="font-mono">¥{oldItem.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[#777]"><span>送料等</span><span className="font-mono">¥{oldFee.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[#777]"><span>消費税</span><span className="font-mono">¥{oldTax.toLocaleString()}</span></div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#F0EAE0]">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-[#999] tracking-wider">TOTAL</span>
                          <span className="text-[17px] text-[#5B5B5B] font-mono" style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 500 }}>¥{oldTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* 矢印 */}
                    <div className="flex items-center justify-center px-3 border-l border-r border-[#E5DED2] bg-[#FAF7F2]">
                      <div className="w-8 h-8 rounded-full bg-white border border-[#E5DED2] flex items-center justify-center">
                        <ArrowRight size={14} className="text-[#C97D60]"/>
                      </div>
                    </div>

                    {/* 訂正後 */}
                    <div className="p-5 bg-[#FFFDF9]">
                      <p className="text-[9px] tracking-[0.3em] text-[#C97D60] mb-3" style={{ fontFamily: "var(--font-outfit)" }}>AFTER</p>
                      <div className="space-y-2 text-[11.5px]">
                        <div className="flex justify-between text-[#5B5B5B]"><span>商品代</span><span className="font-mono">¥{newItem.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[#5B5B5B]"><span>送料等</span><span className="font-mono">¥{newFee.toLocaleString()}</span></div>
                        <div className="flex justify-between text-[#5B5B5B]"><span>消費税</span><span className="font-mono">¥{newTax.toLocaleString()}</span></div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#F0EAE0]">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-[#999] tracking-wider">TOTAL</span>
                          <span className="text-[19px] text-[#C97D60] font-mono" style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}>¥{newTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 差額 */}
                  {diff !== 0 && (
                    <div className={`flex items-center justify-center gap-2 py-3 text-[11.5px] font-medium border-t ${diff > 0 ? 'border-[#EFCCC0] bg-[#FDF6F2] text-[#A85A3A]' : 'border-[#C5E0CD] bg-[#F1F9F3] text-[#2F6B43]'}`} style={{ fontFamily: "var(--font-zen-kaku)" }}>
                      {diff > 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
                      <span>{diff > 0 ? '増額' : '減額'}　{diff > 0 ? '+' : ''}¥{diff.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* 入金状況とアクション */}
                <div className="bg-white border border-[#E5DED2] rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E5DED2] flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-[#FBE8DF] flex items-center justify-center">
                      <Wallet size={12} className="text-[#C97D60]"/>
                    </span>
                    <p className="text-[12px] font-medium text-[#2F2F2F]" style={{ fontFamily: "var(--font-zen-kaku)" }}>入金状況とお客様への対応</p>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* 現在の入金状況 */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] tracking-[0.3em] text-[#999] mb-1.5" style={{ fontFamily: "var(--font-outfit)" }}>CURRENT STATUS</p>
                        <p className={`text-[13.5px] font-medium ${sc.text}`} style={{ fontFamily: "var(--font-zen-kaku)" }}>{sc.statusLabel}</p>
                      </div>
                      {wasPaid && (
                        <div className="text-right">
                          <p className="text-[9px] tracking-[0.3em] text-[#999] mb-1.5" style={{ fontFamily: "var(--font-outfit)" }}>PAID</p>
                          <p className="text-[16px] text-[#7E9279] font-mono" style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 500 }}>¥{paidAmount.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* 訂正後のアクション */}
                    <div className={`border-l-[3px] ${sc.accent} px-4 py-3 rounded-r-lg`}>
                      <p className={`text-[12.5px] font-medium ${sc.text} mb-1`} style={{ fontFamily: "var(--font-zen-kaku)" }}>{sc.actionTitle}</p>
                      <p className="text-[11.5px] text-[#5B5B5B] leading-relaxed">{sc.actionDesc}</p>
                    </div>

                    {/* お支払い済み + 追加/返金の場合のみ差額詳細 */}
                    {wasPaid && balance !== 0 && (
                      <div className="bg-[#FAF7F2] border border-[#E5DED2] rounded-xl p-4">
                        <div className="space-y-2 text-[11.5px]">
                          <div className="flex justify-between text-[#777]">
                            <span>お支払い済み</span>
                            <span className="font-mono">¥{paidAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[#777]">
                            <span>訂正後の合計</span>
                            <span className="font-mono">¥{newTotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-baseline pt-2 border-t border-[#E5DED2]">
                            <span className="text-[11px] font-medium text-[#2F2F2F]">{balance > 0 ? '追加お支払い額' : '返金額'}</span>
                            <span className={`text-[16px] font-mono ${balance > 0 ? 'text-[#A85A3A]' : 'text-[#3A6BA8]'}`} style={{ fontFamily: "var(--font-shippori), serif", fontWeight: 600 }}>
                              ¥{Math.abs(balance).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 訂正理由 */}
                <div className="bg-white border border-[#E5DED2] rounded-2xl p-5">
                  <p className="text-[10px] tracking-[0.3em] font-medium text-[#7E9279] mb-3" style={{ fontFamily: "var(--font-outfit)" }}>
                    REASON <span className="text-[#C97D60]">*</span>
                  </p>
                  <textarea
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    disabled={isSavingCorrection}
                    rows={3}
                    className="w-full bg-[#FAF7F2] border border-[#E5DED2] rounded-xl px-4 py-3 text-[12.5px] text-[#2F2F2F] focus:border-[#C97D60] focus:bg-white outline-none resize-none leading-relaxed transition"
                    placeholder="例: 商品数量の追加にて金額調整、配達エリア変更による送料追加 など"
                  />
                  <p className="text-[10.5px] text-[#999] mt-2 leading-relaxed">監査ログとお客様へのメール本文にこの理由が含まれます。</p>
                </div>

                {/* 通知モード 3択 */}
                <div className="bg-white border border-[#E5DED2] rounded-2xl p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-7 h-7 rounded-full bg-[#FBE8DF] flex items-center justify-center">
                      <Bell size={12} className="text-[#C97D60]"/>
                    </span>
                    <p className="text-[12px] font-medium text-[#2F2F2F]" style={{ fontFamily: "var(--font-zen-kaku)" }}>お客様への通知</p>
                  </div>
                  <div className="space-y-2">
                    {/* 訂正通知 */}
                    <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${correctionNotifyMode === 'correction' ? 'border-[#C97D60] bg-[#FFFDF9]' : 'border-[#E5DED2] hover:border-[#C97D60]/50 bg-[#FAF7F2]/30'}`}>
                      <input
                        type="radio"
                        name="notifyMode"
                        checked={correctionNotifyMode === 'correction'}
                        onChange={() => setCorrectionNotifyMode('correction')}
                        disabled={isSavingCorrection || !modalData.customerInfo?.email}
                        className="mt-1 w-4 h-4 accent-[#C97D60]"
                      />
                      <div className="flex-1">
                        <p className="text-[12.5px] font-medium text-[#2F2F2F]" style={{ fontFamily: "var(--font-zen-kaku)" }}>訂正のお知らせを送る</p>
                        <p className="text-[11px] text-[#777] leading-relaxed mt-1">訂正前後の金額・理由・必要なアクションを詳細にメールで送信</p>
                        {!modalData.customerInfo?.email && <p className="text-[10.5px] text-[#A85A3A] mt-1.5 flex items-center gap-1.5"><AlertCircle size={11}/> メールアドレス未登録のため選択不可</p>}
                      </div>
                    </label>

                    {/* 入金完了通知のみ */}
                    <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${correctionNotifyMode === 'payment_received' ? 'border-[#C97D60] bg-[#FFFDF9]' : 'border-[#E5DED2] hover:border-[#C97D60]/50 bg-[#FAF7F2]/30'}`}>
                      <input
                        type="radio"
                        name="notifyMode"
                        checked={correctionNotifyMode === 'payment_received'}
                        onChange={() => { setCorrectionNotifyMode('payment_received'); setCorrectionMarkAsPaid(true); }}
                        disabled={isSavingCorrection || !modalData.customerInfo?.email}
                        className="mt-1 w-4 h-4 accent-[#C97D60]"
                      />
                      <div className="flex-1">
                        <p className="text-[12.5px] font-medium text-[#2F2F2F]" style={{ fontFamily: "var(--font-zen-kaku)" }}>お支払い完了通知のみ送る</p>
                        <p className="text-[11px] text-[#777] leading-relaxed mt-1">電話・LINEで案内済みの場合に。訂正の話には触れず、入金確認の通知のみ</p>
                        {!modalData.customerInfo?.email && <p className="text-[10.5px] text-[#A85A3A] mt-1.5 flex items-center gap-1.5"><AlertCircle size={11}/> メールアドレス未登録のため選択不可</p>}
                      </div>
                    </label>

                    {/* 通知しない */}
                    <label className={`flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${correctionNotifyMode === 'none' ? 'border-[#C97D60] bg-[#FFFDF9]' : 'border-[#E5DED2] hover:border-[#C97D60]/50 bg-[#FAF7F2]/30'}`}>
                      <input
                        type="radio"
                        name="notifyMode"
                        checked={correctionNotifyMode === 'none'}
                        onChange={() => setCorrectionNotifyMode('none')}
                        disabled={isSavingCorrection}
                        className="mt-1 w-4 h-4 accent-[#C97D60]"
                      />
                      <div className="flex-1">
                        <p className="text-[12.5px] font-medium text-[#2F2F2F]" style={{ fontFamily: "var(--font-zen-kaku)" }}>通知しない</p>
                        <p className="text-[11px] text-[#777] leading-relaxed mt-1">他の手段（電話・LINE・対面など）で連絡済みの場合に。内部記録のみ</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* オプション */}
                <div className="bg-white border border-[#E5DED2] rounded-2xl p-5 space-y-3.5">
                  <p className="text-[10px] tracking-[0.3em] font-medium text-[#7E9279] mb-1" style={{ fontFamily: "var(--font-outfit)" }}>OPTIONS</p>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={correctionMarkAsPaid}
                      onChange={(e) => setCorrectionMarkAsPaid(e.target.checked)}
                      disabled={isSavingCorrection}
                      className="mt-0.5 w-4 h-4 accent-[#C97D60]"
                    />
                    <div className="flex-1">
                      <p className="text-[12.5px] font-medium text-[#2F2F2F]" style={{ fontFamily: "var(--font-zen-kaku)" }}>訂正と同時に「入金済み」へ更新する</p>
                      <p className="text-[11px] text-[#777] leading-relaxed mt-0.5">既に入金確認できているお客様、振込確認後の処理に使用</p>
                    </div>
                  </label>

                  <div className="border-t border-[#F0EAE0]"></div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={correctionNotifyStore}
                      onChange={(e) => setCorrectionNotifyStore(e.target.checked)}
                      disabled={isSavingCorrection}
                      className="w-4 h-4 accent-[#C97D60]"
                    />
                    <span className="text-[12.5px] text-[#2F2F2F]" style={{ fontFamily: "var(--font-zen-kaku)" }}>店舗の通知メールにも記録通知</span>
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowAmountCorrection(false)}
                    disabled={isSavingCorrection}
                    className="flex-1 h-12 bg-white border border-[#E5DED2] text-[#5B5B5B] text-[12.5px] font-medium rounded-full hover:border-[#C97D60] hover:text-[#C97D60] disabled:opacity-50 transition"
                    style={{ fontFamily: "var(--font-zen-kaku)" }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={async () => {
                      if (!correctionReason || correctionReason.trim().length < 3) {
                        alert('訂正理由を3文字以上で入力してください');
                        return;
                      }
                      setIsSavingCorrection(true);
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) { alert('セッションが切れています'); return; }
                        const me = getCurrentStaff();
                        const res = await fetch('/api/orders/correct-amount', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({
                            orderId: order.id,
                            newItemPrice: newItem,
                            newCalculatedFee: newFee,
                            reason: correctionReason,
                            notifyMode: !modalData.customerInfo?.email ? 'none' : correctionNotifyMode,
                            notifyStore: correctionNotifyStore,
                            markAsPaid: correctionMarkAsPaid,
                            operatorName: me?.name || 'オーナー',
                            operatorRole: 'owner',
                          }),
                        });
                        const data = await res.json();
                        if (res.ok && data.ok) {
                          alert(`金額を訂正しました\n\n新しい合計: ¥${data.newTotal.toLocaleString()}\n差額: ${data.diff > 0 ? '+' : ''}¥${data.diff.toLocaleString()}`);
                          // 親に反映してリロード
                          if (onUpdatePayment) {
                            const updatedData = { ...modalData, itemPrice: newItem, calculatedFee: newFee, totalAmount: newTotal };
                            await onUpdatePayment(order.id, updatedData, { skipConfirm: true, alreadyUpdated: true });
                          }
                          setShowAmountCorrection(false);
                          onClose && onClose();
                        } else {
                          alert(`訂正失敗: ${data.error || '原因不明'}`);
                        }
                      } catch (e) {
                        alert(`訂正失敗: ${e.message}`);
                      } finally {
                        setIsSavingCorrection(false);
                      }
                    }}
                    disabled={isSavingCorrection || !correctionReason}
                    className="flex-1 h-12 bg-[#C97D60] hover:bg-[#B36B50] text-white text-[12.5px] font-medium rounded-full disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm"
                    style={{ fontFamily: "var(--font-zen-kaku)" }}
                  >
                    {isSavingCorrection ? (
                      <>保存中…</>
                    ) : (
                      <><Save size={14}/> 訂正を確定</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ★ 完成写真メール送信前の確認モーダル */}
      {completionMailPreview && (
        <div
          className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { e.stopPropagation(); if (!isSendingMail) setCompletionMailPreview(null); }}
        >
          <div
            className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#EAEAEA] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-[15px] font-bold text-[#2D4B3E] flex items-center gap-1.5"><Mail size={15}/> 完成写真メールの送信確認</h3>
              <button
                onClick={() => setCompletionMailPreview(null)}
                className="text-[#999] hover:text-[#111] text-[20px] font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-[12px] text-amber-900 leading-relaxed flex items-start gap-1.5">
                  <AlertCircle size={13} className="shrink-0 mt-0.5"/>
                  <span>下記の内容で <strong>{completionMailPreview.customerEmail}</strong> 宛にメールを送信します。<br/>
                  写真の内容に問題ないか、ご確認の上「送信する」を押してください。</span>
                </p>
              </div>

              {/* 写真プレビュー（削除・差し替え・追加可能） */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-[#999] flex items-center gap-1"><Camera size={11}/> 送信される完成写真 ({completionMailPreview.images.length}枚)</p>
                  {/* 追加ボタン */}
                  <label className={`text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition ${isUploading ? 'bg-gray-100 text-gray-400' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b]'}`}>
                    {isUploading ? 'アップロード中...' : '＋ 写真追加'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isUploading}
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        setIsUploading(true);
                        try {
                          const uploadedUrls = [];
                          for (const file of files) {
                            const ext = file.name.split('.').pop();
                            const fileName = `completion_${order.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
                            const { error: uploadError } = await supabase.storage.from('portfolio').upload(fileName, file);
                            if (uploadError) throw uploadError;
                            const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(fileName);
                            uploadedUrls.push(publicUrl);
                          }
                          const newImages = [...completionMailPreview.images, ...uploadedUrls];
                          // 注文DBにも反映
                          const updatedData = { ...modalData, completionImages: newImages, completionImage: newImages[0] };
                          await supabase.from('orders').update({ order_data: updatedData }).eq('id', order.id);
                          if (order?.order_data) {
                            order.order_data.completionImages = newImages;
                            order.order_data.completionImage = newImages[0];
                          }
                          setCompletionMailPreview({ ...completionMailPreview, images: newImages });
                        } catch (err) {
                          alert(`追加失敗: ${err.message}`);
                        } finally {
                          setIsUploading(false);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {completionMailPreview.images.map((url, idx) => (
                    <div key={idx} className="relative aspect-square bg-[#FBFAF9] rounded-lg overflow-hidden border border-[#EAEAEA] group">
                      <img src={url} alt={`完成写真${idx+1}`} className="w-full h-full object-cover"/>
                      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded-full">
                        {idx+1}枚目
                      </div>
                      {/* 操作ボタン群（右上） */}
                      <div className="absolute top-1 right-1 flex gap-1">
                        {/* 差し替えボタン */}
                        <label className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition ${isUploading ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'}`} title="この写真を差し替える">
                          <Camera size={10}/>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setIsUploading(true);
                              try {
                                const ext = file.name.split('.').pop();
                                const fileName = `completion_${order.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
                                const { error: uploadError } = await supabase.storage.from('portfolio').upload(fileName, file);
                                if (uploadError) throw uploadError;
                                const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(fileName);
                                const newImages = [...completionMailPreview.images];
                                newImages[idx] = publicUrl;
                                // 注文DBにも反映
                                const updatedData = { ...modalData, completionImages: newImages, completionImage: newImages[0] };
                                await supabase.from('orders').update({ order_data: updatedData }).eq('id', order.id);
                                if (order?.order_data) {
                                  order.order_data.completionImages = newImages;
                                  order.order_data.completionImage = newImages[0];
                                }
                                setCompletionMailPreview({ ...completionMailPreview, images: newImages });
                              } catch (err) {
                                alert(`差し替え失敗: ${err.message}`);
                              } finally {
                                setIsUploading(false);
                                e.target.value = '';
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        {/* 削除ボタン */}
                        <button
                          onClick={async () => {
                            if (completionMailPreview.images.length <= 1) {
                              alert('最低1枚は必要です。差し替えにてご対応ください。');
                              return;
                            }
                            if (!confirm(`${idx+1}枚目の写真を削除します。よろしいですか？`)) return;
                            const newImages = completionMailPreview.images.filter((_, i) => i !== idx);
                            try {
                              const updatedData = { ...modalData, completionImages: newImages, completionImage: newImages[0] };
                              await supabase.from('orders').update({ order_data: updatedData }).eq('id', order.id);
                              if (order?.order_data) {
                                order.order_data.completionImages = newImages;
                                order.order_data.completionImage = newImages[0];
                              }
                              setCompletionMailPreview({ ...completionMailPreview, images: newImages });
                            } catch (err) {
                              alert(`削除失敗: ${err.message}`);
                            }
                          }}
                          className="w-7 h-7 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-md flex items-center justify-center transition"
                          title="この写真を削除"
                        >
                          <span className="text-[12px] font-bold">×</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-[#999] mt-2 leading-relaxed flex items-start gap-1">
                  <Lightbulb size={11} className="shrink-0 mt-0.5"/>
                  <span>各写真の右上で <strong>差し替え</strong> / <strong>× 削除</strong> ができます。「＋ 写真追加」で複数枚一気に追加もOK。</span>
                </p>
              </div>

              {/* ★ 納品日確認・編集（入金確認モーダルと同じスキーム） */}
              <div className="bg-[#FBFAF9] rounded-xl p-4 border border-[#EAEAEA] space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-[#2D4B3E]"/>
                  <p className="text-[12px] font-bold text-[#2D4B3E]">お届け予定日（メール本文に反映されます）</p>
                </div>
                <div className="text-[11px] text-[#777] bg-white p-2 rounded border border-[#EAEAEA]">
                  現在の納品予定日: <span className="font-bold text-[#111]">{modalData.selectedDate || '未指定'} {modalData.selectedTime || ''}</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#555] mb-1.5 tracking-widest">新しい納品日 <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={completionDeliveryDate}
                    onChange={(e) => setCompletionDeliveryDate(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#555] mb-1.5 tracking-widest">時間（任意）</label>
                  <input
                    type="text"
                    value={completionDeliveryTime}
                    onChange={(e) => setCompletionDeliveryTime(e.target.value)}
                    placeholder="例: 14:00〜16:00"
                    className="w-full h-11 px-3 bg-white border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]"
                  />
                </div>
                <p className="text-[10px] text-[#999]">※ 変更すると注文データの納品日も更新され、メール本文に反映されます。</p>
              </div>

              {/* メール本文のサマリー */}
              <div className="bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg p-3">
                <p className="text-[10px] font-bold text-[#999] mb-1 flex items-center gap-1"><FileText size={10}/> メール本文の概要</p>
                <p className="text-[12px] text-[#222] leading-relaxed">
                  完成のご案内 + 上の写真と注文情報を記載。<br/>
                  <strong className="text-[#2D4B3E]">お届け日程のご案内＋日程変更のご相談はお電話で</strong>もご案内します。<br/>
                  <span className="text-[10px] text-[#999]">※本文の詳細はオーナーページ → 案内文管理 → 「完成写真のお知らせ」でカスタマイズできます</span>
                </p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-[#EAEAEA]">
                <button
                  onClick={() => setCompletionMailPreview(null)}
                  className="flex-1 h-11 bg-white border border-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-xl hover:bg-[#FBFAF9] flex items-center justify-center gap-1.5"
                >
                  <Clock size={13}/> 後で送る
                </button>
                <button
                  onClick={sendCompletionPhotoMail}
                  disabled={isSendingMail}
                  className="flex-1 h-11 bg-[#117768] text-white text-[12px] font-bold rounded-xl hover:bg-[#0f6358] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSendingMail ? '送信中...' : <><Mail size={13}/> 今すぐ送信</>}
                </button>
              </div>
              <p className="text-[10px] text-[#999] text-center -mt-1 flex items-start justify-center gap-1">
                <Lightbulb size={11} className="shrink-0 mt-0.5"/>
                <span>「後で送る」を選んでも、注文詳細の <strong>「完成写真メール送信」ボタン</strong> から、いつでも再度送信できます</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}