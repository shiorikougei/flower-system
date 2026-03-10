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

  if (isLoading) return <div className="p-10 font-bold">伝票データを生成中...</div>;
  if (!orderData) return <div className="p-10 text-red-500">データが見つかりません。</div>;

  const o = orderData;
  const isDifferent = o.isRecipientDifferent;
  const itemPrice = Number(o.itemPrice) || 0;
  const shippingFee = Number(o.calculatedFee) || 0;
  const subTotal = itemPrice + shippingFee;
  const tax = Math.floor(subTotal * 0.1);
  const total = subTotal + tax;

  const bgImgUrl = generalConfig?.slipBgUrl || '';
  const bgOpacity = generalConfig?.slipBgOpacity !== undefined ? generalConfig.slipBgOpacity / 100 : 0.5;

  // 伝票の種類ごとに表示を切り替える賢いテンプレート
  const SlipTemplate = ({ title, colorCode, bgColor, slipType = 'store' }) => {
    
    // 伝票の種類によって表示/非表示を切り替えるフラグ
    const showPrice = slipType === 'store' || slipType === 'customer';
    const showSignature = slipType === 'receipt';

    // 伝票の種類によって下部のハンコ（スタッフ）枠を切り替える
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
        className="slip-container relative w-full border-2 border-gray-400 p-6 flex flex-col justify-between overflow-hidden" 
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

        <div className="relative z-10">
          <div className="flex justify-between items-start border-b-2 pb-2 mb-3" style={{ borderColor: colorCode }}>
            <h1 className="text-xl font-bold tracking-widest" style={{ color: colorCode }}>{title}</h1>
            <div className="text-right text-[10px] space-y-0.5">
              <p>伝票番号：{orderId.slice(0, 8).toUpperCase()}</p>
              <p>受付日：{new Date().toLocaleDateString('ja-JP')}</p>
              <p>お渡し：<span className="font-bold">{o.receiveMethod || o.deliveryType || '未指定'}</span></p>
              <p>希望日：<span className="font-bold">{o.receiveDate || o.deliveryDate || o.pickupDate || '未指定'}</span></p>
              <p>入金状況：<span className="font-bold border border-gray-400 bg-white px-1 rounded inline-block">{o.paymentStatus || o.paymentMethod || '未定'}</span></p>
            </div>
          </div>

          <div className="flex gap-4 mb-3">
            <div className="flex-1 border p-2 bg-white/95 text-xs">
              <span className="text-[9px] text-gray-500 font-bold block mb-1">【ご依頼主様 (ご注文者)】</span>
              <p className="font-bold text-base mb-1">{o.customerInfo?.name} <span className="text-xs font-normal">様</span></p>
              <p>〒{o.customerInfo?.zip}</p>
              <p>{o.customerInfo?.address1} {o.customerInfo?.address2}</p>
              <p>TEL: {o.customerInfo?.phone}</p>
              {o.customerInfo?.email && <p className="text-[10px] mt-0.5 text-gray-600">Email: {o.customerInfo.email}</p>}
            </div>
            
            <div className="flex-1 border p-2 bg-white/95 text-xs">
              <span className="text-[9px] text-gray-500 font-bold block mb-1">【お届け先様】</span>
              {isDifferent ? (
                <>
                  <p className="font-bold text-base mb-1">{o.recipientInfo?.name} <span className="text-xs font-normal">様</span></p>
                  <p>〒{o.recipientInfo?.zip}</p>
                  <p>{o.recipientInfo?.address1} {o.recipientInfo?.address2}</p>
                  <p>TEL: {o.recipientInfo?.phone}</p>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 font-bold tracking-widest">
                  ご依頼主様と同じ
                </div>
              )}
            </div>
          </div>

          <div className="border bg-white/95 mb-3">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-2">商品名・内容</th>
                  <th className="p-2 w-12 text-center">数量</th>
                  {showPrice && <th className="p-2 w-24 text-right">金額(税抜)</th>}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2">
                    <span className="font-bold text-sm">{o.flowerType}</span>
                    <div className="text-[10px] text-gray-600 mt-1">用途: {o.flowerPurpose} / 色: {o.flowerColor} / イメージ: {o.flowerVibe}</div>
                    
                    {/* 立札のプレビュー風表示 */}
                    {o.cardType === '立札' && (
                      <div className="mt-2 p-2 border border-dashed border-gray-400 bg-gray-50 rounded w-fit pr-8">
                        <p className="text-[9px] text-gray-500 mb-1 font-bold">【立札の内容】</p>
                        <p className="font-bold text-[#c62828] text-[11px] mb-0.5">{o.tateInput1 || '祝'}</p>
                        <p className="font-bold text-[12px] text-gray-800">{o.tateInput3 || o.tateInput2}</p>
                      </div>
                    )}
                    
                    {/* メッセージカードの場合 */}
                    {o.cardType === 'メッセージカード' && (
                      <div className="mt-2 p-2 border border-dashed border-gray-400 bg-gray-50 rounded text-[10px] text-gray-800 italic">
                        「{o.cardMessage}」
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-center align-top">1</td>
                  {showPrice && <td className="p-2 text-right align-top">¥{itemPrice.toLocaleString()}</td>}
                </tr>
                {showPrice && shippingFee > 0 && (
                  <tr className="border-b">
                    <td className="p-2 text-[10px] text-gray-600">配送料・箱代等</td>
                    <td className="p-2 text-center align-top">1</td>
                    <td className="p-2 text-right align-top">¥{shippingFee.toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showPrice && (
            <div className="flex justify-end mb-2">
              <table className="w-48 text-xs border bg-white/95">
                <tbody>
                  <tr className="border-b"><td className="p-1.5 bg-gray-50 font-bold">小計</td><td className="p-1.5 text-right">¥{subTotal.toLocaleString()}</td></tr>
                  <tr className="border-b"><td className="p-1.5 bg-gray-50 font-bold">消費税(10%)</td><td className="p-1.5 text-right">¥{tax.toLocaleString()}</td></tr>
                  <tr><td className="p-1.5 bg-gray-100 font-bold text-sm" style={{ color: colorCode }}>合計</td><td className="p-1.5 text-right font-bold text-sm">¥{total.toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          
          {showSignature && (
            <div className="border-2 border-red-200 bg-white/95 p-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-800">上記の商品を確かに受領いたしました。</span>
              <div className="flex gap-4 items-end">
                <span className="text-[10px] text-gray-500">受領日：　　年　　月　　日</span>
                <div className="w-40 h-8 border-b border-dotted border-gray-400 flex items-end justify-end pb-1"><span className="text-[9px] text-gray-400">サインまたは印</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 flex justify-between items-end pt-2 mt-auto border-t border-gray-300">
          <div className="flex items-end gap-3">
            {generalConfig?.logoUrl && (
              <img src={generalConfig.logoUrl} alt="Logo" className="h-10 object-contain object-left mb-0.5" />
            )}
            <div className="text-[10px] text-gray-700">
              <p className="font-bold text-base tracking-widest mb-1">{shopData?.name || 'FLORIX'}</p>
              <p>〒{shopData?.zip || '---'} {shopData?.address}</p>
              <p>TEL: {shopData?.phone} {shopData?.invoiceNumber && `(適格請求書発行事業者登録番号: T${shopData.invoiceNumber})`}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {staffArray.map((staff, i) => (
               <div key={i} className="flex flex-col items-center">
                 <span className="text-[8px] text-gray-500 mb-0.5">{staff.label}</span>
                 <div className="w-10 h-10 rounded-full border border-red-500 flex items-center justify-center opacity-80" style={{ backgroundImage: 'radial-gradient(circle, transparent 60%, rgba(255,0,0,0.1) 100%)' }}>
                   {staff.name ? (
                     <span className="text-red-600 font-serif font-bold text-[10px] transform -rotate-12">{staff.name.slice(0,2)}</span>
                   ) : (
                     <span className="text-red-200 font-serif text-[8px] transform -rotate-12">印</span>
                   )}
                 </div>
               </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white py-8 print-reset">
      <div className="w-[210mm] mx-auto bg-white p-4 rounded-xl shadow-lg flex justify-between items-center mb-6 print-hidden">
        <div className="text-sm font-bold text-gray-700">🖨️ 伝票印刷プレビュー</div>
        <button onClick={() => window.print()} className="px-6 py-2 bg-[#2D4B3E] text-white font-bold rounded-lg shadow-md hover:bg-[#1f352b] transition-all">
          PDFに保存 / 印刷する
        </button>
      </div>

      <div className="print-container flex flex-col items-center gap-8">
        {/* 1枚目：受注書控 ＆ お客様控 */}
        <div className="print-page bg-white shadow-xl flex flex-col relative">
          <SlipTemplate title="受 注 書 控" colorCode="#2e7d32" bgColor="#f1f8e9" slipType="store" />
          <div className="border-t border-dashed border-gray-400 w-full relative my-1 z-20 shrink-0">
            <span className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-white px-4 text-[10px] text-gray-400">✂ 切り取り線</span>
          </div>
          <SlipTemplate title="お 客 様 控" colorCode="#1565c0" bgColor="#e3f2fd" slipType="customer" />
        </div>

        {/* 2枚目：納品書 ＆ 受領書 */}
        <div className="print-page bg-white shadow-xl flex flex-col relative">
          <SlipTemplate title="納 品 書" colorCode="#f57f17" bgColor="#fffde7" slipType="delivery" />
          <div className="border-t border-dashed border-gray-400 w-full relative my-1 z-20 shrink-0">
            <span className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-white px-4 text-[10px] text-gray-400">✂ 切り取り線</span>
          </div>
          <SlipTemplate title="受 領 書" colorCode="#c62828" bgColor="#ffebee" slipType="receipt" />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        .print-page {
          width: 210mm;
          height: 297mm;
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
            height: 296mm !important;
            max-height: 296mm !important;
            margin: 0 !important;
            padding: 8mm !important;
            box-shadow: none !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }

          .print-page:last-child {
            page-break-after: avoid !important;
          }
        }
      `}} />
    </div>
  );
}