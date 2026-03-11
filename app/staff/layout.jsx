/* eslint-disable react/prop-types */
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, PlusCircle, Calendar, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const [generalConfig, setGeneralConfig] = useState({ appName: 'FLORIX', logoUrl: '', logoSize: 100, logoTransparent: false });

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data?.settings_data?.generalConfig) {
          setGeneralConfig(data.settings_data.generalConfig);
        }
      } catch (error) {
        console.error('設定読み込みエラー:', error);
      }
    }
    loadSettings();
  }, []);

  const navItems = [
    { href: '/staff', label: 'ホーム', icon: LayoutDashboard },
    { href: '/staff/orders', label: '受注一覧', icon: ShoppingBag },
    { href: '/staff/new-order', label: '新規注文', icon: PlusCircle, isPrimary: true },
    { href: '/staff/calendar', label: 'カレンダー', icon: Calendar },
    { href: '/staff/settings', label: '設定', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex font-sans">
      <aside className="hidden md:flex w-64 bg-white border-r border-[#EAEAEA] fixed h-full z-30 flex-col">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {generalConfig.logoUrl ? (
             <img src={generalConfig.logoUrl} alt={generalConfig.appName} style={{ width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal' }} className="h-8 object-contain object-left mb-1 transition-all" />
          ) : (
             <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{generalConfig.appName}</span>
          )}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">Workspace</span>
        </div>
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-6 py-4 rounded-2xl transition-all ${isActive ? 'bg-[#2D4B3E] text-white shadow-md' : 'text-[#555555] hover:bg-[#F7F7F7]'}`}>
                <Icon size={18} className={isActive ? 'text-white' : 'text-[#999999]'} />
                <span className="text-[13px] font-bold tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 md:ml-64 w-full relative pb-20 md:pb-0">
        {children}
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-[#EAEAEA] flex items-center justify-around px-2 pb-6 pt-2 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          if (item.isPrimary) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center -mt-8 group">
                <div className="w-14 h-14 bg-[#2D4B3E] rounded-full flex items-center justify-center text-white shadow-lg border-4 border-[#FBFAF9] group-active:scale-95 transition-transform"><Icon size={24} /></div>
                <span className="text-[9px] font-bold text-[#2D4B3E] mt-1">{item.label}</span>
              </Link>
            );
          }
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center p-2 w-16 h-14 active:scale-95 transition-transform">
              <Icon size={20} className={`mb-1 transition-colors ${isActive ? 'text-[#2D4B3E]' : 'text-[#999999]'}`} />
              <span className={`text-[9px] font-bold transition-colors ${isActive ? 'text-[#2D4B3E]' : 'text-[#999999]'}`}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}