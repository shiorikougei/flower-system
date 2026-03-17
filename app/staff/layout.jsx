'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Home,
  ClipboardList, 
  PlusSquare, 
  CalendarDays, 
  Truck, 
  Briefcase, 
  Users, 
  Building2, 
  Settings,
  TrendingUp,
  Lock,
  Sparkles
} from 'lucide-react';

// ★ キャッシュ用のキーを定義
const SETTINGS_CACHE_KEY = 'florix_app_settings_cache';

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const [appName, setAppName] = useState('FLORIX');
  const [logoUrl, setLogoUrl] = useState('');
  
  // ★ アプリ制作側の管理画面でON/OFFする想定のフラグ
  const [isPremiumPlan, setIsPremiumPlan] = useState(false);

  // 設定からロゴ、アプリ名、プレミアムフラグを自動取得（キャッシュ対応）
  useEffect(() => {
    const applySettings = (settingsData) => {
      if (settingsData?.generalConfig) {
        setAppName(settingsData.generalConfig.appName || 'FLORIX');
        setLogoUrl(settingsData.generalConfig.logoUrl || '');
        // プレミアムプランの判定（初期値はfalse想定）
        setIsPremiumPlan(settingsData.generalConfig.isPremiumPlan || false);
      }
    };

    async function fetchSettings() {
      try {
        // 1. キャッシュから即時復元
        const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
        if (cached) {
          applySettings(JSON.parse(cached));
        }

        // 2. DBから最新を取得して上書き
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data?.settings_data) {
          applySettings(data.settings_data);
          sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data.settings_data));
        }
      } catch (error) {
        console.error('設定の取得に失敗しました', error);
      }
    }
    fetchSettings();
  }, []);

  // ★ 全プラン共通の基本メニュー
  const baseMenuItems = [
    { name: 'ホーム', path: '/staff', icon: Home },
    { name: '店舗注文受付', path: '/staff/new-order', icon: PlusSquare },
    { name: '受注一覧', path: '/staff/orders', icon: ClipboardList },
    { name: '受注カレンダー', path: '/staff/calendar', icon: CalendarDays },
    { name: '配達管理', path: '/staff/deliveries', icon: Truck },
    { name: '売上管理', path: '/staff/sales', icon: TrendingUp }, // ★ 売上管理を追加
    { name: '顧客管理', path: '/staff/customers', icon: Users },
    { name: '各種設定', path: '/staff/settings', icon: Settings },
  ];

  // ★ プレミアム限定のメニュー（アップグレード対象）
  const premiumMenuItems = [
    { name: '配達業務委託', path: '/staff/setting/drivers', icon: Briefcase },
    { name: '法人管理', path: '/staff/corporations', icon: Building2 },
  ];

  // プランに応じて実際に表示するメインメニューを結合
  const activeMenuItems = isPremiumPlan 
    ? [...baseMenuItems.slice(0, 5), ...premiumMenuItems, ...baseMenuItems.slice(5)] // いい感じの位置に挿入
    : baseMenuItems;

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row font-sans text-[#111111]">
      
      {/* 共通サイドバー */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-50 flex flex-col">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA] shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" />
          ) : (
            <span className="font-serif italic text-[24px] font-black tracking-tight text-[#2D4B3E]">{appName}</span>
          )}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1 flex items-center gap-1">
            管理ワークスペース
            {isPremiumPlan && <Sparkles size={10} className="text-yellow-500" />}
          </span>
        </div>
        
        {/* メインメニュー */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto hide-scrollbar">
          {activeMenuItems.map(item => {
            // ホーム（/staff）が他の全ページでも「選択中」になってしまうのを防ぐ厳密判定
            const isActive = item.path === '/staff' 
              ? pathname === '/staff' 
              : pathname?.startsWith(item.path);
              
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

        {/* ★ アップグレード欄（プレミアムプラン未加入時のみ最下部に表示） */}
        {!isPremiumPlan && (
          <div className="p-5 bg-[#F7F7F7] border-t border-[#EAEAEA] shrink-0">
            <p className="text-[10px] font-bold text-[#999999] tracking-widest mb-3 flex items-center gap-1.5">
              <Lock size={12} /> プレミアム機能
            </p>
            <div className="space-y-2 mb-4">
              {premiumMenuItems.map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.path} className="flex items-center gap-3 px-4 py-3 bg-white/50 rounded-xl border border-[#EAEAEA] opacity-60 grayscale cursor-not-allowed">
                    <Icon size={16} className="text-[#999999]" />
                    <span className="text-[12px] font-bold text-[#555555]">{item.name}</span>
                  </div>
                );
              })}
            </div>
            <button className="w-full bg-[#2D4B3E] text-white text-[11px] font-bold py-3 rounded-xl shadow-md hover:bg-[#1f352b] transition-all flex items-center justify-center gap-2">
              <Sparkles size={14} />
              プランをアップグレード
            </button>
          </div>
        )}
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