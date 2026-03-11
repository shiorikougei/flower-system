'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { 
  LayoutDashboard, FileText, PlusCircle, Calendar, 
  Truck, Building2, ImageIcon, Settings, UserCheck 
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

  // --- メニュー構成の定義 ---
  const menuItems = [
    { label: '🏠 ダッシュボード', href: '/staff', icon: LayoutDashboard },
    { label: '📋 受注一覧', href: '/staff/orders', icon: FileText },
    { label: '📝 店舗注文受付', href: '/staff/new-order', icon: PlusCircle },
    { label: '📅 カレンダー', href: '/staff/calendar', icon: Calendar },
    { label: '🚚 配達・ルート管理', href: '/staff/deliveries', icon: Truck },
    { label: '🏢 法人・イベント管理', href: '/staff/corporate', icon: Building2 },
    { label: '📸 作品・SNS連携', href: '/staff/portfolio', icon: ImageIcon },
    { label: '⚙️ 各種設定', href: '/staff/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* --- 【最強の共通サイドバー】 --- */}
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
        
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl text-[13px] font-bold tracking-wider transition-all ${
                  isActive 
                  ? 'bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10' 
                  : 'text-[#555555] hover:bg-[#F7F7F7]'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#2D4B3E]' : 'text-[#999999]'} />
                {item.label}
              </Link>
            );
          })}
          
          {/* ドライバー管理（設定の下にぶら下げるサブメニュー） */}
          <Link 
            href="/staff/settings/drivers" 
            className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[12px] font-bold tracking-wider ml-4 border-l-2 transition-all ${
              pathname === '/staff/settings/drivers'
              ? 'border-[#2D4B3E] text-[#2D4B3E] bg-[#2D4B3E]/5'
              : 'border-[#EAEAEA] text-[#999999] hover:bg-[#F7F7F7]'
            }`}
          >
            <UserCheck size={14} />
            ↳ ドライバー管理
          </Link>
        </nav>
      </aside>

      {/* --- メインコンテンツ（ここに各ページの中身が入る） --- */}
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