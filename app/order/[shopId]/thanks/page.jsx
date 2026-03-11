'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../../utils/supabase';

export default function ThanksPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = params?.shopId || 'default';

  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (error) throw error;
        if (data && data.settings_data) setAppSettings(data.settings_data);
      } catch (err) {
        console.error('設定の読み込みに失敗しました:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  // ローディング画面
  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-sans"><div className="text-[#2D4B3E] font-bold tracking-widest animate-pulse">読み込み中...</div></div>;

  // 設定データの抽出
  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';
  const logoSize = generalConfig.logoSize || 100;
  const logoTransparent = generalConfig.logoTransparent || false;

  // URLのshopIdから対象の店舗を探す（なければ1番目の店舗を使う）
  const shops = appSettings?.shops || [];
  const targetShop = shops.find(s => String(s.id) === String(shopId)) || shops[0] || { name: appName };
  
  // 決済情報の抽出
  const paymentUrl = targetShop.paymentUrl || '';
  const bankInfo = targetShop.bankInfo || '';

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-[#111111]">
      
      {/* ★ 変更：ロゴサイズ・透過設定を反映したヘッダー */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 h-full">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={appName} 
              style={{ 
                // 100%のとき高さを32pxとし、スライダーの値で拡大縮小させる
                height: `${(logoSize / 100) * 32}px`, 
                maxHeight: '50px', // ヘッダーをはみ出さないように制限
                mixBlendMode: logoTransparent ? 'multiply' : 'normal' 
              }} 
              className="object-contain" 
            />
          ) : (
            <span className="font-serif font-bold tracking-tight text-[18px] text-[#2D4B3E]">{appName}</span>
          )}
        </div>
      </header>

      {/* メインのメッセージ部分 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center pb-20">
        <div className="bg-white p-8 md:p-14 rounded-[40px] shadow-sm border border-[#EAEAEA] max-w-lg w-full animate-in zoom-in-95 duration-700">
          
          {/* オシャレなチェックマーク */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-[#2D4B3E]/10 text-[#2D4B3E] text-4xl shadow-inner">
            ✓
          </div>
          
          <h1 className="text-[24px] md:text-[28px] font-serif italic text-[#2D4B3E] mb-4 tracking-tight">Thank you!</h1>
          <p className="text-[16px] font-bold text-[#111111] mb-6">ご注文が完了しました。</p>
          
          <div className="text-[13px] text-[#555555] space-y-3 leading-relaxed">
            <p>この度は <strong>{targetShop.name}</strong> をご利用いただき、誠にありがとうございます。</p>
            <p>ご入力いただいた内容を確認の上、スタッフより手配を進めさせていただきます。</p>
          </div>

          {/* ★ 新規追加：お支払い情報パネル（動的表示） */}
          {(paymentUrl || bankInfo) && (
            <div className="mt-10 mb-8 w-full text-left space-y-6 bg-[#FBFAF9] p-6 md:p-8 rounded-[24px] border border-[#EAEAEA]">
              <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 text-center tracking-widest">お支払いについて</h2>
              
              {/* クレジットカード決済ボタン */}
              {paymentUrl && (
                <div className="space-y-3">
                  <p className="text-[11px] text-[#555555] font-bold text-center">クレジットカード・オンライン決済</p>
                  <a 
                    href={paymentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full py-4 bg-[#2D4B3E] text-white rounded-[16px] font-bold text-[14px] tracking-widest shadow-md hover:bg-[#1f352b] active:scale-95 transition-all"
                  >
                    💳 クレジットで支払う
                  </a>
                </div>
              )}

              {/* 銀行振込のご案内 */}
              {bankInfo && (
                <div className={`space-y-3 ${paymentUrl ? 'pt-6 border-t border-dashed border-[#EAEAEA]' : ''}`}>
                  <p className="text-[11px] text-[#555555] font-bold text-center">銀行振込をご希望の方</p>
                  <div className="bg-white p-4 rounded-xl border border-[#EAEAEA] shadow-sm">
                    {/* whitespace-pre-wrap で入力した改行をそのまま表示 */}
                    <pre className="text-[12px] font-bold text-[#555555] font-sans whitespace-pre-wrap leading-relaxed">{bankInfo}</pre>
                  </div>
                  <p className="text-[10px] text-[#999999] text-center">※お振込手数料はお客様負担となります。</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-8">
            <button 
              onClick={() => router.push(`/order/${shopId}`)} 
              className="w-full py-4 rounded-[16px] bg-white border-2 border-[#EAEAEA] text-[#555555] font-bold text-[13px] tracking-widest hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all"
            >
              最初の画面に戻る
            </button>
          </div>

        </div>
      </main>

      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; }`}</style>
    </div>
  );
}