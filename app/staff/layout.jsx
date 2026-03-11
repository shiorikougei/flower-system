'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  ClipboardList, 
  PlusSquare, 
  CalendarDays, 
  Truck, 
  Briefcase, 
  Users, 
  Building2, 
  Settings 
} from 'lucide-react';

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const [appName, setAppName] = useState('FLORIX');
  const [logoUrl, setLogoUrl] = useState('');

  // 設定からロゴとアプリ名を自動取得
  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data?.settings_data?.generalConfig) {
          setAppName(data.settings_data.generalConfig.appName || 'FLORIX');
          setLogoUrl(data.settings_data.generalConfig.logoUrl || '');
        }
      } catch (error) {
        console.error('設定の取得に失敗しました', error);
      }
    }
    fetchSettings();
  }, []);

  // ★ 消えていたメニューを完全復活！
  const menuItems = [
    { name: '受注一覧', path: '/staff/orders', icon: ClipboardList },
    { name: '店舗注文受付', path: '/staff/new-order', icon: PlusSquare },
    { name: 'カレンダー', path: '/staff/calendar', icon: CalendarDays },
    { name: '配達・ルート管理', path: '/staff/deliveries', icon: Truck },
    { name: '配達業務委託 (外部)', path: '/staff/contractors', icon: Briefcase },
    { name: '顧客管理', path: '/staff/customers', icon: Users },
    { name: '法人管理', path: '/staff/corporations', icon: Building2 },
    { name: '各種設定', path: '/staff/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row font-sans text-[#111111]">
      
      {/* 共通サイドバー */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-50 flex flex-col">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" />
          ) : (
            <span className="font-serif italic text-[24px] font-black tracking-tight text-[#2D4B3E]">{appName}</span>
          )}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto hide-scrollbar">
          {menuItems.map(item => {
            // 現在のページかどうかを判定して色を変える
            const isActive = pathname?.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                href={item.path} 
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-[13px] tracking-wider transition-all ${
                  isActive 
                    ? 'bg-[#2D4B3E]/5 text-[#2D4B3E] border border-[#2D4B3E]/10 shadow-sm' 
                    : 'text-[#555555] hover:bg-[#F7F7F7] border border-transparent'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#2D4B3E]' : 'text-[#999999]'} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>
      
      {/* 各ページのメインコンテンツがここに入る */}
      <main className="flex-1 md:ml-64 min-w-0">
        {children}
      </main>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}