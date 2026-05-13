'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../utils/supabase';

export default function PrintSlipPage() {
  const { orderId } = useParams();
  const [orderData, setOrderData] = useState(null);
  const [shopData, setShopData] = useState(null);
  const [generalConfig, setGeneralConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [printMode, setPrintMode] = useState('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (orderError) throw orderError;
        setOrderData(order.order_data);

        const { data: settings } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (settings && settings.settings_data) {
          const shopId = order.order_data.shopId;
          const shop = settings.settings_data.shops?.find(s => s.id === shopId || s.name === order.order_data.selectedShop) || settings.settings_data.shops[0];
          setShopData(shop);
          setGeneralConfig(settings.settings_data.generalConfig);
        }
      } catch (err) {
        console.error('データ取得エラー:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [orderId]);

  if (isLoading) return <div className="p-10 font-bold text-[#2D4B3E] animate-pulse">伝票データを生成中...</div>;
  if (!orderData) return <div className="p-10 text-red-500 font-bold">データが見つかりません。</div>;

  const o = orderData;
  const isDifferent = o.isRecipientDifferent;

  // ★ EC注文判定: cartItems があれば EC形式
  const isEcOrder = o.orderType === 'ec' && Array.isArray(o.cartItems) && o.cartItems.length > 0;

  // 金額計算: EC注文ならcartItemsから、それ以外は従来通り
  const itemPrice = isEcOrder
    ? o.cartItems.reduce((s, c) => s + Number(c.price) * Number(c.qty), 0)
    : (Number(o.itemPrice) || 0);
  const shippingFee = Number(o.calculatedFee) || 0;
  const subTotal = itemPrice + shippingFee;
  const tax = Math.floor(subTotal * 0.1);
  const total = subTotal + tax;

  // 背景画像とロゴの設定を抽出
  const bgImgUrl = generalConfig?.slipBgUrl || '';
  const bgOpacity = generalConfig?.slipBgOpacity !== undefined ? generalConfig.slipBgOpacity / 100 : 0.5;
  const logoSize = generalConfig?.logoSize || 100;
  const logoTransparent = generalConfig?.logoTransparent || false;

  const getMethodText = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '業者配送' };
    return map[method] || method || '未指定';
  };

  // ==========================================
  // ① 伝票テンプレート (4面印刷用)
  // ==========================================
  const SlipTemplate = ({ title, colorCode, bgColor, slipType = 'store' }) => {
    const showPrice = slipType === 'store' || slipType === 'customer';
    const showSignature = slipType === 'receipt';

    let staffArray = [];
    if (slipType === 'store') {
      staffArray = [
        { label: '受注', name: o.staffName || o.orderStaff },
        { label: '配達', name: o.deliveryStaff },
        { label: '片付', name: o.cleanupStaff },
        { label: '請求', name: o.billingStaff }
      ];
    } else if (slipType === 'customer') {
      staffArray = [{ label: '受注', name: o.staffName || o.orderStaff }];
    } else if (slipType === 'delivery' || slipType === 'receipt') {
      staffArray = [{ label: '配達', name: o.deliveryStaff }];
    }

    return (
      <div 
        className="slip-container relative w-full border-2 border-gray-400 p-3 flex flex-col justify-between overflow-hidden" 
        style={{ flex: 1, backgroundColor: bgImgUrl ? bgColor : '#ffffff' }}
      >
        {bgImgUrl && (
          <div 
            className="absolute inset-0 z-0 grayscale-[30%] pointer-events-none" 
            style={{ 
              backgroundImage: `url(${bgImgUrl})`, 
              backgroundSize: 'cover', 
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              mixBlendMode: 'multiply',
              opacity: bgOpacity 
            }} 
          />
        )}

        <div className="relative z-10 flex flex-col h-full">
          <div>
            <div className="flex justify-between items-start border-b pb-1 mb-1.5" style={{ borderColor: colorCode }}>
              <h1 className="text-lg font-bold tracking-widest flex items-center gap-2" style={{ color: colorCode }}>
                {title}
                {isEcOrder && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">EC注文</span>}
              </h1>
              <div className="text-right text-[9px] space-y-0.5">
                <p>伝票：{orderId.slice(0, 8).toUpperCase()}　受付：{new Date().toLocaleDateString('ja-JP')}</p>
                <p>お渡し：<span className="font-bold">{getMethodText(o.receiveMethod || o.deliveryType)}</span>　希望日：<span className="font-bold">{o.receiveDate || o.selectedDate || '未指定'}</span></p>
                <p>入金状況：<span className="font-bold border border-gray-400 bg-white px-1 rounded inline-block">{o.paymentStatus || o.paymentMethod || '未定'}</span></p>
              </div>
            </div>

            <div className="flex gap-3 mb-1.5">
              <div className="flex-1 border p-1 bg-white/95 text-[10px] leading-tight">
                <span className="text-[8px] text-gray-500 font-bold block mb-0.5">【ご依頼主様 (ご注文者)】</span>
                <p className="font-bold text-sm mb-0.5">{o.customerInfo?.name} <span className="text-[9px] font-normal">様</span></p>
                <p>〒{o.customerInfo?.zip} {o.customerInfo?.address1} {o.customerInfo?.address2}</p>
                <p className="mt-0.5">TEL: {o.customerInfo?.phone}{o.customerInfo?.email ? `　Email: ${o.customerInfo.email}` : ''}</p>
              </div>
              
              <div className="flex-1 border p-1 bg-white/95 text-[10px] leading-tight">
                <span className="text-[8px] text-gray-500 font-bold block mb-0.5">【お届け先様】</span>
                {isDifferent ? (
                  <>
                    <p className="font-bold text-sm mb-0.5">{o.recipientInfo?.name} <span className="text-[9px] font-normal">様</span></p>
                    <p>〒{o.recipientInfo?.zip} {o.recipientInfo?.address1} {o.recipientInfo?.address2}</p>
                    <p className="mt-0.5">TEL: {o.recipientInfo?.phone}</p>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 font-bold tracking-widest">
                    ご依頼主様と同じ
                  </div>
                )}
              </div>
            </div>

            <div className="border bg-white/95 mb-1.5">
              <table className="w-full text-[10px] text-left">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="p-1">商品名・内容</th>
                    <th className="p-1 w-10 text-center">数量</th>
                    {showPrice && <th className="p-1 w-20 text-right">金額(税抜)</th>}
                  </tr>
                </thead>
                <tbody>
                  {isEcOrder ? (
                    // ★ EC注文: cartItems を1行ずつ表示
                    o.cartItems.map((c, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-1">
                          <span className="font-bold text-xs">{c.name}</span>
                        </td>
                        <td className="p-1 text-center align-top">{c.qty}</td>
                        {showPrice && <td className="p-1 text-right align-top">¥{(Number(c.price) * Number(c.qty)).toLocaleString()}</td>}
                      </tr>
                    ))
                  ) : (
                    // 既存：カスタム注文
                    <tr className="border-b">
                      <td className="p-1">
                        <span className="font-bold text-xs">{o.flowerType}</span>
                        <div className="text-[9px] text-gray-600 mt-0.5">用途: {o.flowerPurpose} / 色: {o.flowerColor} / イメージ: {o.flowerVibe}</div>

                        {o.cardType === '立札' && (
                          <div className="mt-1 p-1 border border-dashed border-gray-400 bg-gray-50 rounded w-fit pr-6 leading-tight">
                            <p className="text-[8px] text-gray-500 mb-0.5 font-bold">【立札の内容】</p>
                            <p className="font-bold text-[#c62828] text-[10px]">{o.tateInput1 || '祝'}</p>
                            <p className="font-bold text-[11px] text-gray-800">{o.tateInput3 || o.tateInput2}</p>
                          </div>
                        )}

                        {o.cardType === 'メッセージカード' && (
                          <div className="mt-1 p-1 border border-dashed border-gray-400 bg-gray-50 rounded text-[9px] text-gray-800 italic">
                            「{o.cardMessage}」
                          </div>
                        )}
                      </td>
                      <td className="p-1 text-center align-top">1</td>
                      {showPrice && <td className="p-1 text-right align-top">¥{itemPrice.toLocaleString()}</td>}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ★ EC注文 かつ お客様向け伝票（納品書・お客様控え）には「ありがとう」メッセージを入れる */}
            {isEcOrder && (slipType === 'customer' || slipType === 'delivery') && (
              <div className="border border-[#2D4B3E]/30 bg-[#FBFAF9] p-2 mb-1.5 rounded text-center">
                <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest mb-0.5">Thank you for your order</p>
                <p className="text-[9px] text-gray-700 leading-snug">
                  この度はご注文いただき、誠にありがとうございました。<br/>
                  またのご利用を心よりお待ちしております。
                </p>
              </div>
            )}

            {showPrice && (
              <div className="flex justify-end mb-1.5">
                <table className="w-40 text-[10px] border border-gray-300 bg-white/95">
                  <tbody>
                    <tr className="border-b border-gray-200"><td className="p-0.5 bg-gray-50 font-bold text-gray-600">商品代</td><td className="p-0.5 text-right">¥{itemPrice.toLocaleString()}</td></tr>
                    <tr className="border-b border-gray-200"><td className="p-0.5 bg-gray-50 font-bold text-gray-600">送料・箱代等</td><td className="p-0.5 text-right">¥{shippingFee.toLocaleString()}</td></tr>
                    <tr className="border-b border-gray-200"><td className="p-0.5 bg-gray-50 font-bold text-gray-600">消費税(10%)</td><td className="p-0.5 text-right">¥{tax.toLocaleString()}</td></tr>
                    <tr><td className="p-0.5 bg-gray-100 font-bold text-xs" style={{ color: colorCode }}>合計(税込)</td><td className="p-0.5 text-right font-bold text-xs">¥{total.toLocaleString()}</td></tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex-grow"></div>

          {showSignature && (
            <div className="border border-gray-400 bg-white/95 p-1.5 mb-1.5 flex items-center justify-between">
              <span className="text-[9px] font-bold text-gray-800">上記の商品を確かに受領いたしました。</span>
              <div className="flex gap-4 items-end">
                <span className="text-[8px] text-gray-500">受領日：　　年　　月　　日</span>
                <div className="w-24 h-5 border-b border-dotted border-gray-400 flex items-end justify-end"><span className="text-[7px] text-gray-400">サインまたは印</span></div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-end pt-1.5 border-t border-gray-300">
            <div className="flex items-end gap-2">
              {/* ★ ロゴのサイズ・透過設定を反映 */}
              {generalConfig?.logoUrl && (
                <img 
                  src={generalConfig.logoUrl} 
                  alt="Logo" 
                  style={{ 
                    height: `${(logoSize / 100) * 24}px`, 
                    mixBlendMode: logoTransparent ? 'multiply' : 'normal' 
                  }} 
                  className="object-contain object-left" 
                />
              )}
              <div className="text-[8px] text-gray-700 leading-tight">
                <p className="font-bold text-[11px] tracking-widest mb-0.5">{shopData?.name || 'FLORIX'}</p>
                <p>〒{shopData?.zip || '---'} {shopData?.address}</p>
                <p>TEL: {shopData?.phone} {shopData?.invoiceNumber && `(T${shopData.invoiceNumber})`}</p>
              </div>
            </div>
            
            <div className="flex gap-1.5">
              {staffArray.map((staff, i) => (
                 <div key={i} className="flex flex-col items-center">
                   <span className="text-[7px] text-gray-500 mb-0.5">{staff.label}</span>
                   <div className="w-12 h-6 border-2 border-gray-400 rounded-md bg-white flex items-center justify-center shadow-sm">
                     {staff.name && (
                       <span className="text-gray-800 font-bold text-[9px]">{staff.name}</span>
                     )}
                   </div>
                 </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // ② 新規追加：本番用 立札・カードテンプレート (A4フルサイズ)
  // ==========================================
  const CardTemplate = () => {
    if (!o.cardType || o.cardType === 'なし') {
      return <div className="p-20 text-center font-bold text-gray-400 border-2 border-dashed m-10">立札・メッセージカードの指定はありません。</div>;
    }

    if (o.cardType === 'メッセージカード') {
      return (
        <div className="print-page bg-white shadow-xl flex items-center justify-center" style={{ height: '296mm' }}>
          <div className="w-full h-full border-4 border-gray-100 p-20 flex items-center justify-center">
             <div className="text-center font-serif text-[32px] text-gray-800 leading-loose whitespace-pre-wrap">
               {o.cardMessage}
             </div>
          </div>
        </div>
      );
    }

    if (o.cardType === '立札') {
      const isOsonae = o.flowerPurpose === 'お供え';
      const tateOptions = isOsonae ? [
        { id: 'p1_k_yoko_bg', layout: 'horizontal', color: 'gray' },
        { id: 'p3_k_tate_simple', layout: 'vertical', color: 'gray' },
        { id: 'p4_k_tate_company', layout: 'vertical', color: 'gray' }
      ] : [
        { id: 'p5_c_yoko_line', layout: 'horizontal', color: 'red' },
        { id: 'p6_c_yoko_sama', layout: 'horizontal', color: 'red' },
        { id: 'p7_c_tate_2col', layout: 'vertical', color: 'red' },
        { id: 'p8_c_tate_3col', layout: 'vertical', color: 'red' }
      ];
      
      const selectedTateOpt = tateOptions.find(opt => opt.id === o.tatePattern) || tateOptions[0];
      const topPrefixText = isOsonae ? '御供' : '祝'; // 基本の頭書き

      return (
        <div className="print-page bg-white shadow-xl flex items-center justify-center p-8" style={{ height: '296mm' }}>
          <div className={`relative w-full h-full border-4 ${isOsonae ? 'border-gray-200' : 'border-red-100'} flex flex-col items-center p-8`}>
             
             {/* 余白調整：縦型なら上部余白を多めに、横型なら中央揃え */}
             <div className={`w-full h-full flex flex-col items-center ${selectedTateOpt?.layout === 'horizontal' ? 'justify-center' : 'pt-24'}`}>
               
               <div className={`font-serif font-bold ${isOsonae ? 'text-gray-500' : 'text-red-600'} ${selectedTateOpt?.layout === 'horizontal' ? 'text-[70px] mb-12' : 'text-[100px] mb-20 leading-none'}`}>
                 {topPrefixText}
               </div>

               <div className={`flex w-full font-serif font-bold text-gray-900 ${selectedTateOpt?.layout === 'horizontal' ? 'flex-col items-center gap-10 text-[45px]' : 'flex-row-reverse justify-center gap-24 text-[60px]'}`}>
                 {o.tatePattern?.includes('p6') || o.tatePattern?.includes('p8') ? (
                   <>
                     <div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{o.tateInput2}様</div>
                     <div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{o.tateInput1}</div>
                     <div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{o.tateInput3}</div>
                   </>
                 ) : o.tatePattern?.includes('p4') ? (
                   <>
                     <div className={`tracking-[0.3em] ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{o.tateInput3a}</div>
                     <div className={`tracking-[0.3em] font-normal ${selectedTateOpt?.layout === 'horizontal' ? 'mt-8 text-[30px]' : 'mt-16 text-[35px] [writing-mode:vertical-rl]'}`}>{o.tateInput3b}</div>
                   </>
                 ) : (
                   <>
                     <div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{o.tateInput1}</div>
                     <div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{o.tateInput3}</div>
                   </>
                 )}
               </div>

             </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] py-8 print-reset">
      
      {/* 印刷コントローラー（画面上部） */}
      <div className="max-w-[1000px] mx-auto bg-white p-5 rounded-xl shadow-lg mb-8 print-hidden border border-gray-200 sticky top-4 z-50">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
            🖨️ 伝票・立札 印刷センター
            <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-md">A4サイズ / 100%倍率推奨</span>
          </div>
          <button onClick={() => window.print()} className="px-6 py-3 bg-[#2D4B3E] text-white font-bold rounded-lg shadow-md hover:bg-[#1f352b] transition-all flex items-center gap-2 active:scale-95">
            PDF保存 / プリンターで印刷する
          </button>
        </div>
        
        {/* モード切替ボタン */}
        <div className="flex flex-wrap gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
          <button onClick={() => setPrintMode('all')} className={`flex-1 py-2.5 text-xs font-bold rounded-md transition-all ${printMode === 'all' ? 'bg-white shadow-sm border border-gray-300 text-[#2D4B3E]' : 'text-gray-500 hover:bg-gray-200'}`}>
            📋 伝票フルセット (4面印刷)
          </button>
          <button onClick={() => setPrintMode('customer')} className={`flex-1 py-2.5 text-xs font-bold rounded-md transition-all ${printMode === 'customer' ? 'bg-white shadow-sm border border-gray-300 text-[#1565c0]' : 'text-gray-500 hover:bg-gray-200'}`}>
            📧 お客様控え のみ
          </button>
          <button onClick={() => setPrintMode('delivery')} className={`flex-1 py-2.5 text-xs font-bold rounded-md transition-all ${printMode === 'delivery' ? 'bg-white shadow-sm border border-gray-300 text-[#f57f17]' : 'text-gray-500 hover:bg-gray-200'}`}>
            🚚 納品・受領書 のみ
          </button>
          {!isEcOrder && (
            <button onClick={() => setPrintMode('card')} className={`flex-1 py-2.5 text-xs font-bold rounded-md transition-all ${printMode === 'card' ? 'bg-white shadow-sm border border-[#c62828] text-[#c62828]' : 'text-[#c62828] hover:bg-red-50 border border-transparent'}`}>
              🏷️ 本番用 立札・カード印刷
            </button>
          )}
        </div>
      </div>

      {/* 印刷プレビュー領域 */}
      <div className="print-container flex flex-col items-center gap-8 pb-20">
        
        {(printMode === 'all' || printMode === 'customer') && (
          <div className="print-page bg-white shadow-xl flex flex-col relative" style={{ height: printMode === 'customer' ? '148.5mm' : '296mm' }}>
            {printMode === 'all' && (
              <>
                <SlipTemplate title="受 注 書 控" colorCode="#2e7d32" bgColor="#f1f8e9" slipType="store" />
                <div className="border-t border-dashed border-gray-400 w-full relative my-1 z-20 shrink-0">
                  <span className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-white px-4 text-[10px] text-gray-400">✂ 切り取り線</span>
                </div>
              </>
            )}
            <SlipTemplate title="お 客 様 控" colorCode="#1565c0" bgColor="#e3f2fd" slipType="customer" />
          </div>
        )}

        {(printMode === 'all' || printMode === 'delivery') && (
          <div className="print-page bg-white shadow-xl flex flex-col relative" style={{ pageBreakBefore: printMode === 'delivery' ? 'auto' : 'always', height: '296mm' }}>
            <SlipTemplate title="納 品 書" colorCode="#f57f17" bgColor="#fffde7" slipType="delivery" />
            <div className="border-t border-dashed border-gray-400 w-full relative my-1 z-20 shrink-0">
              <span className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-white px-4 text-[10px] text-gray-400">✂ 切り取り線</span>
            </div>
            <SlipTemplate title="受 領 書" colorCode="#c62828" bgColor="#ffebee" slipType="receipt" />
          </div>
        )}

        {/* 新規追加：立札・メッセージカードのA4印刷 */}
        {printMode === 'card' && (
          <CardTemplate />
        )}

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        .print-page {
          width: 210mm;
          padding: 8mm;
          box-sizing: border-box;
        }

        @media print {
          @page { 
            size: A4 portrait !important; 
            margin: 0mm !important; 
          }
          
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          .min-h-screen {
            min-height: 0 !important;
            background: white !important;
          }

          .print-reset {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .print-hidden { 
            display: none !important; 
          }
          
          .print-container {
            display: block !important;
            gap: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-page {
            width: 210mm !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }
        }
      `}} />
    </div>
  );
}