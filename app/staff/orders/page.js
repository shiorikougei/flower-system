'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import Link from 'next/link';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(null);
  
  // ★ 追加: アップロード中のローディング状態とプレビュー用の状態
  const [uploadingId, setUploadingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: settingsData } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (settingsData) setAppSettings(settingsData.settings_data);

        const { data: ordersData, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setOrders(ordersData || []);
      } catch (err) {
        console.error('データ取得エラー:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';

  const handlePrint = (orderId) => {
    window.open(`/staff/print/${orderId}`, '_blank');
  };

  // ★ 追加: 画像を軽くする（圧縮する）魔法の関数
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 最大幅を800pxに制限（文字が読める十分なサイズ）
          if (width > 800) {
            height = Math.round((height * 800) / width);
            width = 800;
          }
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // 画質を60%に落としてJPEGで出力（超軽量化）
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  // ★ 追加: 受領書のアップロード処理
  const handleUploadReceipt = async (order, e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(order.id);
    try {
      // 1. 画像を圧縮
      const compressedBase64 = await compressImage(file);

      // 2. 既存の注文データに「receiptImage」を追加
      const updatedOrderData = { ...order.order_data, receiptImage: compressedBase64 };

      // 3. Supabase（データベース）を更新
      const { error } = await supabase.from('orders').update({ order_data: updatedOrderData }).eq('id', order.id);
      if (error) throw error;

      // 4. 画面の表示を更新
      setOrders(orders.map(o => o.id === order.id ? { ...o, order_data: updatedOrderData } : o));
      alert('受領書を保存しました！');
    } catch (err) {
      console.error('アップロードエラー:', err);
      alert('保存に失敗しました。通信環境をご確認ください。');
    } finally {
      setUploadingId(null);
      e.target.value = ''; // 入力欄をリセット
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest animate-pulse">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {logoUrl ? <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" /> : <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{appName}</span>}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff/orders" className="block w-full text-left px-6 py-4 rounded-xl bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10 transition-all">
            <span className="text-[13px] font-bold tracking-wider block">受注一覧</span>
          </Link>
          <Link href="/staff/new-order" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all">
            <span className="text-[13px] font-bold tracking-wider block">店舗注文受付</span>
          </Link>
          <Link href="/staff/calendar" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all">
            <span className="text-[13px] font-bold tracking-wider block">カレンダー</span>
          </Link>
          <Link href="/staff/settings" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all mt-4 border-t border-[#EAEAEA] pt-4">
            <span className="text-[13px] font-bold tracking-wider block">各種設定</span>
          </Link>
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 flex flex-col min-w-0 pb-32">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">受注一覧・帳票発行</h1>
        </header>

        <div className="max-w-[1100px] mx-auto w-full p-8">
          <div className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-[13px] min-w-[800px]">
              <thead className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                <tr>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">注文日時</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">お渡し日</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">注文者様</th>
                  {/* ★ 変更: ヘッダー名を「商品 / 金額内訳」に変更 */}
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">商品 / 金額内訳</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest">受取方法</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest text-center">受領書</th>
                  <th className="p-4 text-[11px] font-bold text-[#999999] tracking-widest text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F7F7]">
                {orders.map((order) => {
                  const d = order.order_data;
                  const date = new Date(order.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  
                  // ★ 新規追加: 金額のリアルタイム計算
                  const itemPrice = Number(d.itemPrice) || 0;
                  const fee = Number(d.calculatedFee) || 0;
                  const subTotal = itemPrice + fee;
                  const tax = Math.floor(subTotal * 0.1);
                  const totalAmount = subTotal + tax;

                  return (
                    <tr key={order.id} className="hover:bg-[#FBFAF9] transition-all">
                      <td className="p-4 text-[#555555] font-mono">{date}</td>
                      <td className="p-4 font-bold text-[#2D4B3E]">{d.selectedDate} {d.selectedTime && <span className="text-[10px] text-[#999999] block">{d.selectedTime}</span>}</td>
                      <td className="p-4 font-bold">{d.customerInfo?.name}</td>
                      
                      {/* ★ 変更: 商品名の下に内訳ミニパネルを表示 */}
                      <td className="p-4">
                        <div className="font-bold">{d.flowerType}</div>
                        <div className="mt-1.5 p-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[10px] text-[#555555] w-fit min-w-[140px]">
                          <div className="flex justify-between gap-4">
                            <span>商品代:</span><span>¥{itemPrice.toLocaleString()}</span>
                          </div>
                          {fee > 0 && (
                            <div className="flex justify-between gap-4">
                              <span>送料等:</span><span>¥{fee.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-4 text-[#2D4B3E]">
                            <span>消費税:</span><span>¥{tax.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-[#EAEAEA] font-bold text-[#2D4B3E]">
                            <span>合計(税込):</span><span>¥{totalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-md ${d.receiveMethod === 'pickup' ? 'bg-blue-50 text-blue-600' : d.receiveMethod === 'delivery' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                          {d.receiveMethod === 'pickup' ? '店頭受取' : d.receiveMethod === 'delivery' ? '自社配達' : '配送'}
                        </span>
                      </td>
                      
                      <td className="p-4 text-center">
                        {uploadingId === order.id ? (
                          <span className="text-[10px] font-bold text-[#999999] animate-pulse">保存中...</span>
                        ) : d.receiptImage ? (
                          <div className="flex flex-col items-center gap-1">
                            <button onClick={() => setPreviewImage(d.receiptImage)} className="text-[10px] bg-[#2D4B3E]/10 text-[#2D4B3E] border border-[#2D4B3E]/20 px-3 py-1 rounded-md font-bold hover:bg-[#2D4B3E] hover:text-white transition-all">
                              確認する
                            </button>
                            <label className="text-[9px] text-gray-400 underline cursor-pointer hover:text-[#2D4B3E]">
                              再UP
                              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} />
                            </label>
                          </div>
                        ) : (
                          <label className="cursor-pointer text-[10px] font-bold text-white bg-[#2D4B3E] px-3 py-1.5 rounded-md hover:bg-[#1f352b] transition-all flex items-center justify-center w-fit mx-auto gap-1 shadow-sm">
                            📷 撮影 / UP
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleUploadReceipt(order, e)} />
                          </label>
                        )}
                      </td>

                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handlePrint(order.id)}
                          className="px-4 py-2 bg-white border border-[#EAEAEA] text-[#555555] text-[11px] font-bold rounded-lg shadow-sm hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all"
                        >
                          伝票発行
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr><td colSpan="7" className="p-8 text-center text-[#999999]">注文データがありません。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ★ 新規追加: 受領書プレビュー用の全画面モーダル */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-12 right-0 text-white font-bold text-xl hover:scale-110 transition-all">
              ✕ 閉じる
            </button>
            <img src={previewImage} alt="受領書" className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl bg-white" />
          </div>
        </div>
      )}

    </div>
  );
}