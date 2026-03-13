'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Link from 'next/link';
import { 
  ArrowLeft, Package, Truck, Store, Calendar, Clock, 
  MapPin, Phone, User, MessageSquare, CreditCard, 
  Printer, FileText, Send, ChevronRight, AlertCircle
} from 'lucide-react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!params?.id) return;
      try {
        const [orderRes, settingsRes] = await Promise.all([
          supabase.from('orders').select('*').eq('id', params.id).single(),
          supabase.from('app_settings').select('settings_data').eq('id', 'default').single()
        ]);
        
        if (orderRes.error) throw orderRes.error;
        setOrder(orderRes.data);
        if (settingsRes.data) setAppSettings(settingsRes.data.settings_data);
      } catch (err) {
        console.error('取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [params?.id]);

  const updateOrderData = async (field, value) => {
    setIsSaving(true);
    try {
      const newData = { ...order.order_data, [field]: value };
      const { error } = await supabase.from('orders').update({ order_data: newData }).eq('id', order.id);
      if (error) throw error;
      setOrder({ ...order, order_data: newData });
    } catch (err) {
      alert('更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const getCustomLabels = () => {
    const labels = appSettings?.statusConfig?.customLabels;
    return Array.isArray(labels) ? labels : ['制作中', '制作完了', '配達中'];
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center text-[#2D4B3E] font-bold tracking-widest animate-pulse">読み込み中...</div>;
  if (!order) return <div className="min-h-screen flex items-center justify-center font-bold">注文が見つかりません</div>;

  const d = order.order_data || {};
  const isSagawa = d.receiveMethod === 'sagawa';
  const isDelivery = d.receiveMethod === 'delivery';
  const isPickup = d.receiveMethod === 'pickup';

  // 料金計算
  const itemPrice = Number(d.itemPrice) || 0;
  const fee = Number(d.calculatedFee) || 0;
  const pickupFee = Number(d.pickupFee) || 0;
  const tax = Math.floor((itemPrice + fee + pickupFee) * 0.1);
  const total = itemPrice + fee + pickupFee + tax;

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-32 text-[#111111]">
      {/* --- ヘッダー領域 --- */}
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-30 px-4 md:px-8 py-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#FBFAF9] border border-[#EAEAEA] hover:bg-[#EAEAEA] transition-colors"><ArrowLeft size={20}/></button>
          <div>
            <h1 className="text-[18px] font-black text-[#2D4B3E]">注文詳細</h1>
            <p className="text-[10px] font-bold text-[#999999] tracking-wider">ID: {order.id}</p>
          </div>
        </div>

        {/* ★ フェーズ2（伝票機能）に向けたボタンの枠組み */}
        <div className="flex flex-wrap items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm">
            <Printer size={14} /> 受注書/納品書 印刷
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#555555] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all shadow-sm">
            <FileText size={14} /> PDF出力
          </button>
          {d.customerInfo?.email && (
            <button className="flex items-center gap-2 px-4 py-2 bg-[#2D4B3E] text-white rounded-xl text-[11px] font-bold hover:bg-[#1f352b] transition-all shadow-md">
              <Send size={14} /> メール通知
            </button>
          )}
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto p-4 md:p-8 space-y-8 pt-8">

        {/* --- トップ：ステータス＆巨大スケジュールパネル --- */}
        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EAEAEA] pb-6">
            <div className="flex items-center gap-3">
              <span className={`px-4 py-2 rounded-xl text-[13px] font-bold flex items-center gap-2 ${isPickup ? 'bg-orange-100 text-orange-700' : isDelivery ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {isPickup ? <Store size={16}/> : isDelivery ? <Truck size={16}/> : <Package size={16}/>}
                {isPickup ? '店頭受取' : isDelivery ? '自社配達' : '業者配送'}
              </span>
              <span className="text-[13px] font-bold text-[#D97C8F] bg-[#FBFAF9] border border-[#EAEAEA] px-4 py-2 rounded-xl flex items-center gap-2">
                <Clock size={16}/> {d.selectedTime || '指定なし'}
              </span>
            </div>
            
            <div className="flex items-center gap-3 bg-[#FBFAF9] p-2 rounded-2xl border border-[#EAEAEA]">
              <span className="text-[11px] font-bold text-[#999999] pl-2">ステータス:</span>
              <select 
                value={d.status || 'new'} 
                onChange={(e) => updateOrderData('status', e.target.value)}
                className="h-10 bg-white border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold text-[#2D4B3E] outline-none shadow-sm cursor-pointer"
              >
                <option value="new">未対応 (新規)</option>
                {getCustomLabels().map(l => <option key={l} value={l}>{l}</option>)}
                <option value="完了">完了</option>
                <option value="キャンセル">キャンセル</option>
              </select>
            </div>
          </div>

          {/* ★ 発送日のデカデカ表示パネル！ */}
          {isSagawa ? (
            <div className="bg-green-50 border-2 border-green-200 p-6 md:p-8 rounded-[24px] flex flex-col md:flex-row items-center gap-6 justify-center text-center shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-bl-[64px] -mr-4 -mt-4"></div>
              
              <div className="space-y-1 relative z-10">
                <span className="text-[12px] font-bold text-green-700 tracking-widest bg-white/50 px-3 py-1 rounded-full">【箱詰め・集荷】発送予定日</span>
                <p className="text-[32px] md:text-[40px] font-black text-green-900 flex items-center justify-center gap-2 pt-2">
                  <Package size={28} className="text-green-600"/> 
                  {d.shippingDate ? `${d.shippingDate.split('-')[1]}月${d.shippingDate.split('-')[2]}日` : '未設定'}
                </p>
              </div>
              
              <ChevronRight size={32} className="hidden md:block text-green-300 relative z-10"/>
              
              <div className="space-y-1 relative z-10">
                <span className="text-[12px] font-bold text-green-700 tracking-widest">お客様 お届け日</span>
                <p className="text-[20px] md:text-[24px] font-bold text-green-800 flex items-center justify-center gap-2 pt-2">
                  <Calendar size={20} className="text-green-600"/> 
                  {d.selectedDate ? `${d.selectedDate.split('-')[1]}月${d.selectedDate.split('-')[2]}日` : '未設定'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#FBFAF9] border border-[#EAEAEA] p-6 rounded-[24px] flex flex-col items-center justify-center text-center shadow-inner">
               <span className="text-[12px] font-bold text-[#999999] tracking-widest mb-1">{isPickup ? 'ご来店予定日' : '配達予定日'}</span>
               <p className="text-[32px] font-black text-[#2D4B3E] flex items-center gap-2">
                 <Calendar size={24}/> {d.selectedDate ? `${d.selectedDate.split('-')[1]}月${d.selectedDate.split('-')[2]}日` : '未設定'}
               </p>
            </div>
          )}

          {/* 置き配や要望の警告 */}
          {(d.absenceAction === '置き配' || d.note || pickupFee > 0) && (
            <div className="bg-orange-50 p-5 rounded-2xl border border-orange-200 space-y-3">
              {d.absenceAction === '置き配' && (
                <p className="font-bold text-orange-900 flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-orange-600"/>
                  <span><span className="bg-orange-600 text-white px-2 py-0.5 rounded text-[11px] mr-2">置き配希望</span>{d.absenceNote}</span>
                </p>
              )}
              {pickupFee > 0 && (
                <p className="font-bold text-orange-900 flex items-center gap-2">
                  <Truck size={18} className="text-orange-600"/> 後日、スタンド等の「器回収」が必要です。
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 左カラム：注文者・お届け先 */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
              <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 flex items-center gap-2"><User size={18}/> ご注文者様</h2>
              <div className="space-y-2 text-[13px] font-bold text-[#555555]">
                <p className="text-[18px] text-[#111111]">{d.customerInfo?.name} 様</p>
                <p className="flex items-center gap-2"><Phone size={14}/> {d.customerInfo?.phone}</p>
                {d.customerInfo?.email && <p className="flex items-center gap-2 text-[#4285F4]"><MessageSquare size={14}/> {d.customerInfo?.email}</p>}
                {!isPickup && (
                  <p className="flex items-start gap-2 pt-2 border-t border-[#F7F7F7]">
                    <MapPin size={14} className="mt-0.5 shrink-0"/> 
                    <span>〒{d.customerInfo?.zip}<br/>{d.customerInfo?.address1} {d.customerInfo?.address2}</span>
                  </p>
                )}
              </div>
            </div>

            {d.isRecipientDifferent && !isPickup && (
              <div className="bg-[#2D4B3E]/5 p-6 rounded-[24px] border border-[#2D4B3E]/10 shadow-sm space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-[#2D4B3E] text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">お届け先</div>
                <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#2D4B3E]/10 pb-2 flex items-center gap-2"><Truck size={18}/> お届け先情報</h2>
                <div className="space-y-2 text-[13px] font-bold text-[#555555]">
                  <p className="text-[18px] text-[#111111]">{d.recipientInfo?.name} 様</p>
                  <p className="flex items-center gap-2"><Phone size={14}/> {d.recipientInfo?.phone}</p>
                  <p className="flex items-start gap-2 pt-2 border-t border-[#2D4B3E]/10">
                    <MapPin size={14} className="mt-0.5 shrink-0"/> 
                    <span>〒{d.recipientInfo?.zip}<br/>{d.recipientInfo?.address1} {d.recipientInfo?.address2}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-3">
              <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2">社内メモ</h2>
              <textarea 
                value={d.note || ''} 
                onChange={(e) => updateOrderData('note', e.target.value)}
                placeholder="クリックしてメモを追記..."
                className="w-full h-24 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-3 text-[13px] outline-none focus:border-[#2D4B3E] resize-none"
              />
            </div>
          </div>

          {/* 右カラム：商品・料金・立札 */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
              <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 flex items-center gap-2"><Package size={18}/> ご注文内容</h2>
              
              <div className="flex gap-4 items-start">
                {d.referenceImage ? (
                  <img src={d.referenceImage} alt="参考" className="w-24 h-24 object-cover rounded-xl border border-[#EAEAEA] shrink-0" />
                ) : (
                  <div className="w-24 h-24 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl flex items-center justify-center text-[#999999] text-[10px] shrink-0">画像なし</div>
                )}
                <div className="space-y-2 flex-1">
                  <p className="text-[16px] font-black text-[#111111]">{d.flowerType}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[11px] font-bold bg-[#FBFAF9] border border-[#EAEAEA] px-2 py-0.5 rounded text-[#555555]">用途: {d.flowerPurpose === 'その他' ? d.otherPurpose : d.flowerPurpose}</span>
                    <span className="text-[11px] font-bold bg-[#FBFAF9] border border-[#EAEAEA] px-2 py-0.5 rounded text-[#555555]">色: {d.flowerColor}</span>
                    <span className="text-[11px] font-bold bg-[#FBFAF9] border border-[#EAEAEA] px-2 py-0.5 rounded text-[#555555]">雰囲気: {d.flowerVibe === 'その他' ? d.otherVibe : d.flowerVibe}</span>
                  </div>
                  {d.isBring === 'bring' && <span className="inline-block text-[11px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200">※お花/器の持込あり</span>}
                </div>
              </div>

              <div className="bg-[#FBFAF9] p-4 rounded-xl space-y-2 text-[13px] font-medium text-[#555555] mt-4">
                <div className="flex justify-between"><span>商品代 (税抜):</span><span className="font-bold">¥{itemPrice.toLocaleString()}</span></div>
                {fee > 0 && <div className="flex justify-between text-blue-700"><span>配達・送料 (箱代等含):</span><span className="font-bold">¥{fee.toLocaleString()}</span></div>}
                {pickupFee > 0 && <div className="flex justify-between text-orange-600"><span>回収費用:</span><span className="font-bold">¥{pickupFee.toLocaleString()}</span></div>}
                <div className="flex justify-between border-t border-[#EAEAEA] pt-2"><span>消費税 (10%):</span><span className="font-bold">¥{tax.toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-[#EAEAEA] pt-2 mt-2">
                  <span className="font-bold text-[#2D4B3E]">合計 (税込):</span>
                  <span className="font-black text-[18px] text-[#2D4B3E]">¥{total.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#EAEAEA]">
                 <span className="text-[11px] font-bold text-[#999999] flex items-center gap-1"><CreditCard size={14}/> 決済方法</span>
                 <span className="text-[13px] font-bold text-[#111111]">{d.paymentMethod || '未設定'}</span>
              </div>
            </div>

            {d.cardType !== 'なし' && (
              <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4">
                <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 flex items-center gap-2"><MessageSquare size={18}/> {d.cardType}の内容</h2>
                
                {d.cardType === 'メッセージカード' && (
                  <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] text-[13px] whitespace-pre-wrap font-medium leading-relaxed">
                    {d.cardMessage}
                  </div>
                )}

                {d.cardType === '立札' && (
                  <div className="space-y-3 bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]">
                    <span className="text-[10px] font-bold bg-[#2D4B3E] text-white px-2 py-0.5 rounded">{d.tatePattern}</span>
                    {d.tateInput1 && <div className="flex text-[13px] border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">内容:</span><span className="font-black">{d.tateInput1}</span></div>}
                    {d.tateInput2 && <div className="flex text-[13px] border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">宛名:</span><span className="font-black">{d.tateInput2} 様</span></div>}
                    {d.tateInput3 && <div className="flex text-[13px] border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">贈り主:</span><span className="font-black">{d.tateInput3}</span></div>}
                    {d.tateInput3a && <div className="flex text-[13px] border-b border-white pb-1"><span className="w-16 text-[#999999] font-bold">会社名:</span><span className="font-black">{d.tateInput3a}</span></div>}
                    {d.tateInput3b && <div className="flex text-[13px]"><span className="w-16 text-[#999999] font-bold">役職・名:</span><span className="font-black">{d.tateInput3b}</span></div>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}