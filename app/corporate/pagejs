'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { 
  Building2, Calendar, ShoppingBag, FileText, 
  ChevronRight, Plus, CreditCard, LogOut, Gift, ArrowRight, Download, Package
} from 'lucide-react';
import Link from 'next/link';

export default function CorporateDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false); // 本番ではデータ取得時にtrue
  const [companyName, setCompanyName] = useState('株式会社 グローバルIT'); // ※ダミー

  // ダミーデータ：今後のお祝いイベント（スタッフ側のCRMと連動するイメージ）
  const upcomingEvents = [
    { id: 1, title: '代表取締役 就任記念', date: '2026-04-01', target: '山田 社長', recItem: '胡蝶蘭がおすすめ' },
    { id: 2, title: '取引先(株式会社A) 移転祝い', date: '2026-04-15', target: '株式会社A 様', recItem: 'スタンド花 / アレンジメント' },
  ];

  // ダミーデータ：注文履歴
  const recentOrders = [
    { id: 'ORD-20260310', date: '2026-03-10', item: 'お祝い用スタンド花 1段', price: 16500, status: '配達完了', target: 'CLUB Louns 様' },
    { id: 'ORD-20260214', date: '2026-02-14', item: '特選 胡蝶蘭 3本立ち', price: 33000, status: '配達完了', target: 'Bar NIGHT 様' },
  ];

  const handleLogout = async () => {
    // await supabase.auth.signOut();
    router.push('/corporate/login');
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      
      {/* ヘッダー */}
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-[#EAEAEA] sticky top-0 z-40 px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-serif italic text-[20px] font-black tracking-tight text-[#2D4B3E]">FLORIX</span>
          <span className="hidden sm:inline-block w-[1px] h-4 bg-[#EAEAEA]"></span>
          <span className="hidden sm:inline-block text-[11px] font-bold tracking-widest text-[#999999] uppercase">Corporate Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[12px] font-bold text-[#555555]">
            <Building2 size={16} className="text-[#2D4B3E]" />
            <span className="hidden sm:inline-block">{companyName} 様</span>
          </div>
          <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#FBFAF9] border border-[#EAEAEA] text-[#999999] hover:text-[#111111] hover:bg-[#EAEAEA] transition-all">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto p-6 md:p-8 space-y-8 pt-8">
        
        {/* ウェルカム＆クイックアクション */}
        <div className="bg-[#2D4B3E] rounded-[32px] p-8 md:p-10 shadow-lg text-white relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* 背景の装飾 */}
          <div className="absolute -right-20 -top-20 opacity-10 pointer-events-none">
            <Gift size={240} />
          </div>
          
          <div className="relative z-10 space-y-2">
            <h1 className="text-[24px] md:text-[28px] font-black tracking-tight leading-tight">
              いつもご利用ありがとうございます。<br />
              <span className="text-emerald-300">{companyName}</span> 様
            </h1>
            <p className="text-[13px] text-white/80 font-medium pt-2">
              ご請求書のダウンロードや、次回のお祝い花のオーダーをこちらから行えます。
            </p>
          </div>
          
          <div className="relative z-10 shrink-0">
            <Link 
              href="/order/default" 
              className="group flex items-center justify-center gap-2 bg-white text-[#2D4B3E] px-8 py-4 rounded-2xl font-black text-[15px] shadow-xl hover:scale-105 transition-all active:scale-95"
            >
              <Plus size={20} />
              新しいお花を注文する
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform ml-1" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* 左側：メインコンテンツ（2カラム分） */}
          <div className="md:col-span-2 space-y-8">
            
            {/* 注文履歴 */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-black text-[#2D4B3E] flex items-center gap-2">
                  <ShoppingBag size={20} /> 最近のご注文履歴
                </h2>
                <Link href="#" className="text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] flex items-center gap-1">
                  すべて見る <ChevronRight size={14} />
                </Link>
              </div>

              <div className="bg-white rounded-[24px] border border-[#EAEAEA] shadow-sm overflow-hidden">
                <div className="divide-y divide-[#F7F7F7]">
                  {recentOrders.map(order => (
                    <div key={order.id} className="p-5 hover:bg-[#FBFAF9] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#999999] font-mono">{order.date}</span>
                          <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{order.status}</span>
                        </div>
                        <p className="text-[15px] font-black text-[#111111]">{order.item}</p>
                        <p className="text-[12px] font-bold text-[#555555] flex items-center gap-1"><Building2 size={12}/> お届け先: {order.target}</p>
                      </div>
                      
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 border-[#EAEAEA] pt-3 sm:pt-0">
                        <p className="text-[16px] font-black text-[#2D4B3E]">¥{order.price.toLocaleString()}</p>
                        <button className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-500 hover:text-white transition-all shadow-sm">
                          <Download size={14} /> 領収書 / 納品書
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>

          {/* 右側：サイドコンテンツ（1カラム分） */}
          <div className="space-y-8">
            
            {/* 今後のイベント（アラート） */}
            <section className="space-y-4">
              <h2 className="text-[16px] font-black text-[#2D4B3E] flex items-center gap-2">
                <Calendar size={20} /> 近日中のお祝い・イベント
              </h2>
              <div className="space-y-3">
                {upcomingEvents.map(ev => (
                  <div key={ev.id} className="bg-white p-5 rounded-[20px] border border-[#EAEAEA] shadow-sm relative overflow-hidden group hover:border-[#D97C8F] transition-all cursor-pointer">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#D97C8F]"></div>
                    <div className="space-y-2 pl-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold bg-[#D97C8F]/10 text-[#D97C8F] px-2 py-0.5 rounded font-mono">{ev.date}</span>
                        <span className="text-[10px] font-bold text-[#999999] bg-[#FBFAF9] px-2 py-0.5 rounded border border-[#EAEAEA]">ご案内</span>
                      </div>
                      <p className="text-[14px] font-black text-[#111111] leading-tight">{ev.title}</p>
                      <p className="text-[11px] font-bold text-[#555555]">{ev.target}</p>
                      <div className="pt-2 mt-2 border-t border-[#F7F7F7]">
                        <p className="text-[10px] font-bold text-[#999999] flex items-center gap-1">
                          <Package size={12}/> 推奨: {ev.recItem}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 請求関連のサマリー */}
            <section className="bg-[#FBFAF9] p-6 rounded-[24px] border border-[#EAEAEA]">
              <h2 className="text-[13px] font-black text-[#555555] flex items-center gap-2 mb-4">
                <CreditCard size={16} /> 請求・お支払い情報
              </h2>
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-[11px] font-bold text-[#999999]">当月ご利用額 (3月分)</span>
                  <span className="text-[20px] font-black text-[#111111]">¥49,500</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-[11px] font-bold text-[#999999]">お支払い期限</span>
                  <span className="text-[13px] font-bold text-[#111111]">2026年4月末日</span>
                </div>
                <button className="w-full mt-2 py-3 bg-white border border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#2D4B3E] hover:border-[#2D4B3E] transition-all flex items-center justify-center gap-2 shadow-sm">
                  <FileText size={16} /> 今月の請求書を発行する
                </button>
              </div>
            </section>

          </div>

        </div>
      </main>
    </div>
  );
}