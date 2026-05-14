'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { Sparkles, ShoppingBag, ChevronRight, History, User } from 'lucide-react';

// ★ お客様の最初の入口：オーダーメイド / 完成品 の2択
//   従来の /page.js（カスタム注文フォーム）は /custom/page.js に移動

export default function OrderEntryPage() {
  const params = useParams();
  // ★ tenantId はDB保存時に小文字に統一されているため、URL大文字でも小文字でクエリ
  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';

  const [appSettings, setAppSettings] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('settings_data')
          .eq('id', tenantId)
          .single();
        if (data?.settings_data) setAppSettings(data.settings_data);
      } catch (e) {}
    })();
  }, [tenantId]);

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';
  const shop = (appSettings?.shops || []).find(s => String(s.id) === String(shopId)) || (appSettings?.shops || [])[0] || {};
  const shopName = shop.name || appName;

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-16">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-[800px] mx-auto h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl
              ? <img src={logoUrl} alt={appName} className="h-7 object-contain" />
              : <span className="font-serif font-bold text-[16px] text-[#2D4B3E]">{shopName}</span>}
          </div>
          <Link
            href={`/order/${tenantId}/${shopId}/history`}
            className="flex items-center gap-1 text-[11px] font-bold text-[#555555] hover:text-[#2D4B3E] px-2 py-1"
          >
            <User size={12}/> マイページ
          </Link>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-6 pt-12 md:pt-16">
        <div className="text-center mb-10">
          <p className="text-[11px] font-bold text-[#117768] tracking-[0.3em] mb-2">ORDER</p>
          <h1 className="text-[22px] md:text-[26px] font-bold text-[#2D4B3E] mb-3">ご注文方法をお選びください</h1>
          <p className="text-[13px] text-[#555555] leading-relaxed">
            ご希望に合わせてお選びいただけます
          </p>
        </div>

        <div className="space-y-4">
          {/* オーダーメイド注文 */}
          <Link
            href={`/order/${tenantId}/${shopId}/custom`}
            className="block p-6 md:p-7 bg-white border border-[#EAEAEA] rounded-3xl shadow-sm hover:border-[#2D4B3E] hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#2D4B3E]/10 text-[#2D4B3E] flex items-center justify-center shrink-0 group-hover:bg-[#2D4B3E] group-hover:text-white transition-all">
                <Sparkles size={22}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#117768] tracking-widest mb-1">CUSTOM ORDER</p>
                <h2 className="text-[16px] md:text-[17px] font-bold text-[#111111] mb-1.5">オーダーメイドで注文する</h2>
                <p className="text-[11.5px] text-[#555555] leading-relaxed">
                  用途・カラー・ご予算からお任せでお作りします。<br className="hidden sm:inline"/>
                  花束・アレンジ・スタンド花など対応します。
                </p>
              </div>
              <ChevronRight size={20} className="text-[#999999] group-hover:text-[#2D4B3E] transition-colors shrink-0"/>
            </div>
          </Link>

          {/* 完成品（EC） */}
          <Link
            href={`/order/${tenantId}/${shopId}/shop`}
            className="block p-6 md:p-7 bg-white border border-[#EAEAEA] rounded-3xl shadow-sm hover:border-[#2D4B3E] hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#D97D54]/10 text-[#D97D54] flex items-center justify-center shrink-0 group-hover:bg-[#D97D54] group-hover:text-white transition-all">
                <ShoppingBag size={22}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#D97D54] tracking-widest mb-1">READY-MADE</p>
                <h2 className="text-[16px] md:text-[17px] font-bold text-[#111111] mb-1.5">完成品をすぐに購入する</h2>
                <p className="text-[11.5px] text-[#555555] leading-relaxed">
                  ドライフラワーアレンジなど、店頭の完成品から<br className="hidden sm:inline"/>
                  そのままご購入いただけます。
                </p>
              </div>
              <ChevronRight size={20} className="text-[#999999] group-hover:text-[#2D4B3E] transition-colors shrink-0"/>
            </div>
          </Link>
        </div>

        {/* マイページ導線 */}
        <div className="mt-8 pt-8 border-t border-[#EAEAEA]">
          <Link
            href={`/order/${tenantId}/${shopId}/history`}
            className="block p-5 bg-white border border-[#EAEAEA] rounded-2xl hover:border-[#2D4B3E] transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FBFAF9] text-[#2D4B3E] flex items-center justify-center shrink-0 group-hover:bg-[#2D4B3E] group-hover:text-white transition-all">
                <User size={20}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-[#111111] mb-0.5">マイページ</p>
                <p className="text-[11px] text-[#555555] leading-relaxed">
                  ご注文履歴 ・ 記念日リマインダー ・ 領収書発行 ・ 再注文
                </p>
              </div>
              <ChevronRight size={18} className="text-[#999999] group-hover:text-[#2D4B3E] transition-colors shrink-0"/>
            </div>
          </Link>
        </div>

        <div className="text-center mt-10">
          <p className="text-[11px] text-[#999999] leading-relaxed">
            お電話でのご注文も承っております{shop.phone ? <><br/>TEL: <a href={`tel:${String(shop.phone).replace(/[^\d+]/g, '')}`} className="text-[#2D4B3E] font-bold">{shop.phone}</a></> : ''}
          </p>
        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
        .font-serif { font-family: 'Noto Serif JP', serif; }
      `}</style>
    </div>
  );
}
