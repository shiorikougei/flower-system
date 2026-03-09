'use client';
import { useParams, useRouter } from 'next/navigation';

export default function ThanksPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = params?.shopId || 'default';

  // 店舗のブランドデータを読み込み
  const shopData = {
    'shop_a': { name: '花・花OHANA！', color: '#2D4B3E', logo: 'OH' },
    'shop_b': { name: 'お花カフェ', color: '#8B5A2B', logo: 'CA' },
    'default': { name: 'FLORIX', color: '#2D4B3E', logo: 'FX' }
  }[shopId] || { name: 'FLORIX', color: '#2D4B3E', logo: 'FX' };

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-[#111111]">
      {/* ヘッダー */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-center px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-serif font-bold text-[12px]" style={{ backgroundColor: shopData.color }}>{shopData.logo}</div>
          <span className="font-serif italic font-bold tracking-tight text-[18px]">{shopData.name}</span>
        </div>
      </header>

      {/* メインのメッセージ部分 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-sm border border-[#EAEAEA] max-w-lg w-full animate-in zoom-in-95 duration-700">
          
          {/* オシャレなチェックマーク */}
          <div className="w-20 h-20 mx-auto mb-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-500 text-4xl shadow-inner">
            ✓
          </div>
          
          <h1 className="text-[24px] md:text-[28px] font-serif italic text-[#2D4B3E] mb-4 tracking-tight">Thank you!</h1>
          <p className="text-[16px] font-bold text-[#111111] mb-6">ご注文が完了しました。</p>
          
          <div className="text-[13px] text-[#555555] space-y-4 leading-relaxed mb-10">
            <p>この度は <strong>{shopData.name}</strong> をご利用いただき、誠にありがとうございます。</p>
            <p>ご入力いただいた内容を確認の上、スタッフより手配を進めさせていただきます。</p>
            <p className="text-[11px] text-[#999999] bg-[#FBFAF9] p-4 rounded-2xl">※ご不明な点がございましたら、店舗まで直接お問い合わせください。</p>
          </div>

          <button 
            onClick={() => router.push(`/order/${shopId}`)} 
            className="w-full py-4 rounded-2xl text-white font-bold text-[14px] tracking-widest shadow-md hover:opacity-90 transition-all active:scale-95"
            style={{ backgroundColor: shopData.color }}
          >
            最初の画面に戻る
          </button>
        </div>
      </main>

      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; }`}</style>
    </div>
  );
}