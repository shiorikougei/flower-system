'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { 
  LayoutDashboard, FileText, Calendar, PlusCircle, 
  Truck, Building2, Users, ImageIcon, Settings, UserCheck 
} from 'lucide-react';

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const [appSettings, setAppSettings] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
      if (data) setAppSettings(data.settings_data);
    }
    fetchSettings();
  }, []);

  const generalConfig = appSettings?.generalConfig || {};
  const logoUrl = generalConfig.logoUrl || '';
  const appName = generalConfig.appName || 'FLORIX';

  // --- メニュー構成（ご指定の並び順） ---
  const mainItems = [
    { label: '受注一覧', href: '/staff/orders', icon: FileText },
    { label: 'カレンダー', href: '/staff/calendar', icon: Calendar },
    { label: '店舗注文受付', href: '/staff/new-order', icon: PlusCircle },
    { label: '配達管理', href: '/staff/deliveries', icon: Truck },
    { label: '法人管理', href: '/staff/corporate', icon: Building2 },
    { label: '顧客(個人)管理', href: '/staff/customers', icon: Users },
    { label: 'SNS・作品連携', href: '/staff/portfolio', icon: ImageIcon },
  ];

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* --- 共通サイドバー --- */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-30 overflow-y-auto pb-10 hidden md:block">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          <Link href="/staff" className="hover:opacity-70 transition-opacity">
            {logoUrl ? (
               <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" />
            ) : (
               <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{appName}</span>
            )}
          </Link>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        
        <nav className="p-4 flex flex-col gap-0.5">
          {/* 親：ダッシュボード */}
          <Link 
            href="/staff"
            className={`flex items-center gap-3.5 px-6 py-4 rounded-xl text-[13px] font-bold tracking-wider transition-all ${
              pathname === '/staff' 
              ? 'bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10' 
              : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <LayoutDashboard size={18} strokeWidth={pathname === '/staff' ? 2.5 : 2} />
            ダッシュボード
          </Link>

          {/* 子メニュー（1文字分ずらす） */}
          <div className="ml-4 flex flex-col gap-0.5 mt-0.5">
            {mainItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[12.5px] font-bold tracking-wider transition-all ${
                    isActive 
                    ? 'bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10' 
                    : 'text-[#666666] hover:bg-[#F7F7F7] hover:text-[#111111]'
                  }`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-[#2D4B3E]' : 'text-[#999999]'} />
                  {item.label}
                </Link>
              );
            })}
          </div>
          
          {/* 各種設定（一番下） */}
          <div className="pt-4 mt-4 border-t border-[#F7F7F7]">
            <Link 
              href="/staff/settings" 
              className={`flex items-center gap-3.5 px-6 py-4 rounded-xl text-[13px] font-bold tracking-wider transition-all ${
                pathname.startsWith('/staff/settings')
                ? 'bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10'
                : 'text-[#555555] hover:bg-[#F7F7F7]'
              }`}
            >
              <Settings size={18} strokeWidth={pathname.startsWith('/staff/settings') ? 2.5 : 2} />
              各種設定
            </Link>
            
            {/* ドライバー管理（設定の中のサブ） */}
            <Link 
              href="/staff/settings/drivers" 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-bold tracking-wider ml-10 mt-1 transition-all ${
                pathname === '/staff/settings/drivers'
                ? 'text-[#2D4B3E]'
                : 'text-[#999999] hover:text-[#555555]'
              }`}
            >
              <UserCheck size={14} />
              ↳ ドライバー管理
            </Link>
          </div>
        </nav>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        {children}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); 
        .font-serif { font-family: 'Noto Serif JP', serif; }
      `}</style>
    </div>
  );
}