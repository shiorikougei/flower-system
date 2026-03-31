'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Home, ClipboardList, PlusSquare, CalendarDays, Truck, Briefcase, 
  Users, Building2, Settings, TrendingUp, Lock, Sparkles, MessageSquare, X, Send, Image as ImageIcon 
} from 'lucide-react';

const SETTINGS_CACHE_KEY = 'florix_app_settings_cache';

export default function StaffLayout({ children }) {
  const pathname = usePathname();
  const [appName, setAppName] = useState('FLORIX');
  const [logoUrl, setLogoUrl] = useState('');
  const [isPremiumPlan, setIsPremiumPlan] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('アップデート依頼');
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    const applySettings = (settingsData) => {
      if (settingsData?.generalConfig) {
        setAppName(settingsData.generalConfig.appName || 'FLORIX');
        setLogoUrl(settingsData.generalConfig.logoUrl || '');
        setIsPremiumPlan(settingsData.generalConfig.isPremiumPlan || false);
      }
    };

    async function fetchSettings() {
      try {
        // ★修正：セッションからログインユーザーのtenant_idを取得して、正しい店舗のデータを引っ張る！
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (!profile?.tenant_id) return;

        const tenantId = profile.tenant_id;

        const cached = sessionStorage.getItem(`${SETTINGS_CACHE_KEY}_${tenantId}`);
        if (cached) {
          applySettings(JSON.parse(cached));
        }

        // ★修正：'default'ではなく、実際のtenantIdで検索！
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
        if (data?.settings_data) {
          applySettings(data.settings_data);
          sessionStorage.setItem(`${SETTINGS_CACHE_KEY}_${tenantId}`, JSON.stringify(data.settings_data));
        }
      } catch (error) {
        console.error('設定の取得に失敗しました', error);
      }
    }
    fetchSettings();
  }, []);

  const baseMenuItems = [
    { name: 'ホーム', path: '/staff', icon: Home },
    { name: '店舗注文受付', path: '/staff/new-order', icon: PlusSquare },
    { name: '受注一覧', path: '/staff/orders', icon: ClipboardList },
    { name: '受注カレンダー', path: '/staff/calendar', icon: CalendarDays },
    { name: '配達管理', path: '/staff/deliveries', icon: Truck },
    { name: '売上管理', path: '/staff/sales', icon: TrendingUp },
    { name: '顧客管理', path: '/staff/customers', icon: Users },
    { name: '作品管理', path: '/staff/portfolio', icon: ImageIcon },
    { name: '各種設定', path: '/staff/settings', icon: Settings },
  ];

  const premiumMenuItems = [
    { name: '配達業務委託', path: '/staff/setting/drivers', icon: Briefcase },
    { name: '法人管理', path: '/staff/corporations', icon: Building2 },
  ];

  const activeMenuItems = isPremiumPlan 
    ? [...baseMenuItems.slice(0, 6), ...premiumMenuItems, ...baseMenuItems.slice(6)]
    : baseMenuItems;

  const handleUpgradeRequest = async () => {
    if (!confirm('アップグレード料金について問い合わせ、機能の解放を依頼しますか？')) return;
    setIsSending(true);
    try {
      const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
      const ownerData = data?.settings_data || {};
      const currentReqs = ownerData.upgradeRequests || [];

      const newReq = {
        id: `req_${Date.now()}`,
        tenantId: 'current_shop', 
        tenantName: appName,
        featureKey: 'premium',
        featureName: 'プレミアムプラン一式 (配達委託・法人管理)',
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
      };

      await supabase.from('app_settings').upsert({
        id: 'nocolde_owner',
        settings_data: { ...ownerData, upgradeRequests: [newReq, ...currentReqs] }
      });
      
      alert('アップグレードの問い合わせを送信しました！オーナーからの連絡をお待ちください。');
    } catch (err) {
      alert('送信に失敗しました。');
    } finally {
      setIsSending(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setIsSending(true);
    try {
      const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
      const ownerData = data?.settings_data || {};
      const currentFeedbacks = ownerData.clientRequests || [];

      const newFeedback = {
        id: `fb_${Date.now()}`,
        tenantId: 'current_shop',
        tenantName: appName,
        type: feedbackType,
        text: feedbackText,
        date: new Date().toISOString().split('T')[0],
        status: 'new'
      };

      await supabase.from('app_settings').upsert({
        id: 'nocolde_owner',
        settings_data: { ...ownerData, clientRequests: [newFeedback, ...currentFeedbacks] }
      });
      
      alert('フィードバックを送信しました！ご協力ありがとうございます。');
      setShowFeedback(false);
      setFeedbackText('');
    } catch (err) {
      alert('送信に失敗しました。');
    } finally {
      setIsSending(false);
    }
  };

  if (pathname === '/staff/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row font-sans text-[#111111]">
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-40 flex flex-col">
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
        
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto hide-scrollbar">
          {activeMenuItems.map(item => {
            const isActive = item.path === '/staff' 
              ? pathname === '/staff' 
              : pathname?.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link 
                key={item.path} href={item.path} 
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-[13px] tracking-wider transition-all ${
                  isActive ? 'bg-[#2D4B3E]/5 text-[#2D4B3E] border border-[#2D4B3E]/10 shadow-sm' : 'text-[#555555] hover:bg-[#F7F7F7] border border-transparent'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#2D4B3E]' : 'text-[#999999]'} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-5 bg-[#F7F7F7] border-t border-[#EAEAEA] shrink-0 space-y-3">
          <button 
            onClick={() => setShowFeedback(true)}
            className="w-full bg-white border border-[#EAEAEA] text-[#555555] text-[11px] font-bold py-2.5 rounded-xl shadow-sm hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare size={14} /> アプリの要望・バグ報告
          </button>

          {!isPremiumPlan && (
            <div className="pt-2 border-t border-[#EAEAEA]">
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
              <button 
                onClick={handleUpgradeRequest}
                disabled={isSending}
                className="w-full bg-[#2D4B3E] text-white text-[11px] font-bold py-3 rounded-xl shadow-md hover:bg-[#1f352b] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles size={14} /> {isSending ? '送信中...' : 'プランをアップグレード'}
              </button>
            </div>
          )}
        </div>
      </aside>
      
      <main className="flex-1 md:ml-64 min-w-0">
        {children}
      </main>

      {showFeedback && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111111]/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#EAEAEA] flex justify-between items-center bg-[#FBFAF9]">
              <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><MessageSquare size={18}/> フィードバックを送信</h2>
              <button onClick={() => setShowFeedback(false)} className="text-[#999999] hover:text-[#111111]"><X size={20}/></button>
            </div>
            <form onSubmit={handleFeedbackSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">種類</label>
                <select 
                  value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}
                  className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl font-bold text-[13px] outline-none focus:border-[#2D4B3E]"
                >
                  <option value="アップデート依頼">アップデート依頼・要望</option>
                  <option value="バグ修正依頼">バグ修正依頼 (不具合報告)</option>
                  <option value="その他">その他・ご質問</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">内容</label>
                <textarea 
                  required value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="追加してほしい機能や、発生しているエラーの詳細を具体的にご記入ください。"
                  className="w-full h-32 px-4 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E] resize-none leading-relaxed"
                />
              </div>
              <button type="submit" disabled={isSending} className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl font-bold text-[13px] tracking-widest flex items-center justify-center gap-2 hover:bg-[#1f352b] transition-all shadow-md disabled:opacity-50 mt-4">
                <Send size={16}/> {isSending ? '送信中...' : '開発元へ送信する'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}