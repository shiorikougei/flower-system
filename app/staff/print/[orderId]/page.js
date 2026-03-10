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

  // ★ 追加：英語の受取方法を日本語に変換する魔法の辞書
  const getMethodText = (method) => {
    const map = { pickup: '店頭受取', delivery: '自社配達', sagawa: '業者配送' };
    return map[method] || method || '未指定';
  };

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
              <h1 className="text-lg font-bold tracking-widest" style={{ color: colorCode }}>{title}</h1>
              <div className="text-right text-[9px] space-y-0.5">
                <p>伝票：{orderId.slice(0, 8).toUpperCase()}　受付：{new Date().toLocaleDateString('ja-JP')}</p>
                {/* ★ 翻訳辞書を通すように変更！ */}
                <p>お渡し：<span className="font-bold">{getMethodText(o.receiveMethod || o.deliveryType)}</span>　希望日：<span className="font-bold">{o.receiveDate || o.deliveryDate || o.pickupDate || '未指定'}</span></p>
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
                </tbody>
              </table>
            </div>

            {showPrice && (
              <div className="flex justify-end mb-1.5">
                <table className="w-40 text-[10px] border border-gray-300 bg-white/95">
                  <tbody>
                    <tr className="border-b border-gray-200"><td className="p-0.5 bg-gray-50 font-bold text-gray-600">商品代</td><td className="p-0.5 text-right">¥{itemPrice.toLocaleString()}</td></tr>
                    <tr className="border-b border-gray-200"><td className="p-0.5 bg-gray-50 font-bold text-gray-600">送料・箱代等</td><td className="p-0.5 text-right">¥{shippingFee.toLocaleString()}</td></tr>
                    <tr className="border-b border-gray-200"><td className="p-0.5 bg-gray-50 font-bold text-gray-600">消費税(10%)</td><td className="p-0.5 text-right">¥{tax.toLocaleString()}</td></tr>
                    <tr><td className="p-0.5 bg-gray-100 font-bold text-xs" style={{ color: colorCode }}>合計</td><td className="p-0.5 text-right font-bold text-xs">¥{total.toLocaleString()}</td></tr>
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
              {generalConfig?.logoUrl && (
                <img src={generalConfig.logoUrl} alt="Logo" className="h-6 object-contain object-left" />
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

  return (
    <div className="min-h-screen bg-white py-8 print-reset">
      
      <div className="w-[210mm] mx-auto bg-white p-5 rounded-xl shadow-lg mb-6 print-hidden border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
            🖨️ 伝票プレビュー ＆ 出力
            <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-md">
              A4サイズ / 100%倍率推奨
            </span>
          </div>
          <button onClick={() => window.print()} className="px-6 py-2.5 bg-[#2D4B3E] text-white font-bold rounded-lg shadow-md hover:bg-[#1f352b] transition-all flex items-center gap-2">
            PDFに保存 / 印刷する
          </button>
        </div>
        
        <div className="flex gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
          <button 
            onClick={() => setPrintMode('all')} 
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${printMode === 'all' ? 'bg-white shadow-sm border border-gray-300 text-[#2D4B3E]' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            📋 フルセット (4面印刷)
          </button>
          <button 
            onClick={() => setPrintMode('customer')} 
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${printMode === 'customer' ? 'bg-white shadow-sm border border-gray-300 text-[#1565c0]' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            📧 お客様控え のみ (データ送付用)
          </button>
          <button 
            onClick={() => setPrintMode('delivery')} 
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${printMode === 'delivery' ? 'bg-white shadow-sm border border-gray-300 text-[#f57f17]' : 'text-gray-500 hover:bg-gray-200'}`}
          >
            🚚 納品・受領書 のみ (現場配達用)
          </button>
        </div>
      </div>

      <div className="print-container flex flex-col items-center gap-8">
        
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