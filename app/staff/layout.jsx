'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Home, ClipboardList, PlusSquare, CalendarDays, Truck, Briefcase,
  Users, Building2, Settings, TrendingUp, Lock, Sparkles, MessageSquare, X, Send, Image as ImageIcon, ShoppingBag, UserCheck, ChevronDown, History
} from 'lucide-react';
import { getCurrentStaff, setCurrentStaff, ROLE_LABELS, ROLE_DESCRIPTIONS, can } from '@/utils/staffRole';
import { isFeatureEnabled } from '@/utils/features';

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

  // ★ スタッフ切替
  const [staffList, setStaffList] = useState([]);
  const [currentStaff, setCurrentStaffState] = useState(null);
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [staffAuthConfig, setStaffAuthConfig] = useState({ requirePin: false, requireForOwnerOnly: true });
  const [tenantSettings, setTenantSettings] = useState(null);  // features参照用

  // ★ PIN認証モーダル
  const [pinModal, setPinModal] = useState(null); // { staff, onSuccess }
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    const applySettings = (settingsData) => {
      setTenantSettings(settingsData || null);
      if (settingsData?.generalConfig) {
        setAppName(settingsData.generalConfig.appName || 'FLORIX');
        setLogoUrl(settingsData.generalConfig.logoUrl || '');
        setIsPremiumPlan(settingsData.generalConfig.isPremiumPlan || false);
      }
      if (Array.isArray(settingsData?.staffList)) {
        setStaffList(settingsData.staffList);
      }
      if (settingsData?.staffAuthConfig) {
        setStaffAuthConfig(prev => ({ ...prev, ...settingsData.staffAuthConfig }));
      }
    };

    // 現在のスタッフをlocalStorageからロード
    setCurrentStaffState(getCurrentStaff());

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

  // ★ メニューをカテゴリ別に整理（feature: 機能がONのときだけ表示）
  const menuCategories = [
    {
      name: '業務',
      items: [
        { name: 'ホーム', path: '/staff', icon: Home, perm: 'home' },
        { name: '店舗注文受付', path: '/staff/new-order', icon: PlusSquare, perm: 'newOrder' },
        { name: '受注一覧', path: '/staff/orders', icon: ClipboardList, perm: 'orders' },
        { name: '受注カレンダー', path: '/staff/calendar', icon: CalendarDays, perm: 'calendar' },
        { name: '配達管理', path: '/staff/deliveries', icon: Truck, perm: 'deliveries' },
      ],
    },
    {
      name: '顧客・作品',
      items: [
        { name: '顧客管理', path: '/staff/customers', icon: Users, perm: 'customers', feature: 'customers' },
        { name: '作品管理', path: '/staff/portfolio', icon: ImageIcon, perm: 'portfolio', feature: 'portfolio' },
      ],
    },
    {
      name: 'EC・売上',
      items: [
        { name: '商品管理（EC）', path: '/staff/products', icon: ShoppingBag, perm: 'products', feature: 'ec' },
        { name: '売上管理', path: '/staff/sales', icon: TrendingUp, perm: 'sales', feature: 'sales' },
      ],
    },
    {
      name: 'スタッフ・勤怠',
      items: [
        { name: 'シフト管理', path: '/staff/shift', icon: CalendarDays, perm: 'manageShift', feature: 'shiftManagement' },
        { name: '自分のシフト', path: '/staff/my-shift', icon: CalendarDays, perm: 'shift', feature: 'shiftManagement' },
        { name: '操作履歴・勤怠', path: '/staff/audit', icon: History, perm: 'audit', feature: 'attendanceManagement' },
      ],
    },
    {
      name: '設定',
      items: [
        { name: '各種設定', path: '/staff/settings', icon: Settings, perm: 'settings' },
      ],
    },
    {
      name: 'プレミアム',
      premium: true,
      items: [
        { name: '配達業務委託', path: '/staff/setting/drivers', icon: Briefcase, perm: 'deliveries', feature: 'deliveryOutsource' },
        { name: '法人管理', path: '/staff/corporations', icon: Building2, perm: 'settings', feature: 'b2b' },
      ],
    },
  ];

  // role + features でフィルタ
  const currentRole = currentStaff?.role || 'owner';
  const filteredCategories = menuCategories.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      can(currentRole, item.perm) &&
      (!item.feature || isFeatureEnabled(tenantSettings, item.feature))
    ),
  })).filter(cat => cat.items.length > 0);

  // 旧コードとの互換用（switchStaff内で使用）
  const activeMenuItems = filteredCategories.flatMap(cat => cat.items);

  // PIN認証が必要か判定
  const needsPin = (targetStaff) => {
    if (!staffAuthConfig.requirePin) return false;
    if (!targetStaff?.pin) return false;  // PIN未設定なら認証スキップ
    if (targetStaff.role === 'owner') return true;  // オーナーは常に
    return staffAuthConfig.requireForOwnerOnly === false;  // 全員必須モードなら
  };

  const performSwitch = (s) => {
    // ★ 自動打刻は廃止。打刻は TOP ページの「出勤/退勤」ボタンから明示的に行う
    setCurrentStaff(s);
    setCurrentStaffState(s);
    setShowStaffPicker(false);
    setPinModal(null);
    setPinInput('');
    setPinError('');

    // 権限変更で見れない画面にいる場合はホームに戻す（リロードはしない）
    if (s && pathname && !pathname.startsWith('/staff/login')) {
      const stillVisible = activeMenuItems.some(m =>
        m.path === '/staff' ? pathname === '/staff' : pathname.startsWith(m.path)
      );
      if (!stillVisible) {
        // soft navigation
        window.location.href = '/staff';
      }
    }
  };

  // スタッフ切替（PIN認証込み）
  const switchStaff = (s) => {
    if (needsPin(s)) {
      setPinModal({ staff: s });
      setPinInput('');
      setPinError('');
      return;
    }
    performSwitch(s);
  };

  const verifyPin = () => {
    if (!pinModal?.staff) return;
    if (pinInput !== pinModal.staff.pin) {
      setPinError('PINが違います');
      setPinInput('');
      return;
    }
    performSwitch(pinModal.staff);
  };

  const clearStaff = () => {
    // ★ 自動打刻廃止（手動）
    setCurrentStaff(null);
    setCurrentStaffState(null);
    setShowStaffPicker(false);
    // リロードしない（state更新だけで反映）
  };

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
        <div className="p-6 flex flex-col gap-1 border-b border-[#EAEAEA] shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" />
          ) : (
            <span className="font-serif italic text-[24px] font-bold tracking-tight text-[#2D4B3E]">{appName}</span>
          )}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1 flex items-center gap-1">
            管理ワークスペース
            {isPremiumPlan && <Sparkles size={10} className="text-yellow-500" />}
          </span>

          {/* ★ スタッフ切替ピッカー */}
          <div className="mt-3 relative">
            <button
              onClick={() => setShowStaffPicker(s => !s)}
              className="w-full flex items-center justify-between gap-2 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-3 py-2 hover:border-[#2D4B3E] transition-all"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                  currentStaff?.role === 'owner' ? 'bg-[#2D4B3E]' :
                  currentStaff?.role === 'staff' ? 'bg-[#117768]' :
                  currentStaff?.role === 'parttime' ? 'bg-[#D97D54]' : 'bg-[#999]'
                }`}>
                  <UserCheck size={13}/>
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[11px] font-bold text-[#111] truncate">{currentStaff?.name || '未選択'}</p>
                  <p className="text-[9px] text-[#999] truncate">{currentStaff?.role ? ROLE_LABELS[currentStaff.role] : '※全機能アクセス'}</p>
                </div>
              </div>
              <ChevronDown size={14} className="text-[#999] shrink-0"/>
            </button>

            {showStaffPicker && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-[#EAEAEA] rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="p-2 max-h-80 overflow-y-auto">
                  {staffList.length === 0 ? (
                    <p className="text-[11px] text-[#999] p-3 text-center">スタッフ未登録<br/>設定→スタッフから追加してください</p>
                  ) : staffList.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => switchStaff(s)}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-lg hover:bg-[#FBFAF9] transition-all text-left ${currentStaff?.name === s.name ? 'bg-[#2D4B3E]/5' : ''}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                        s.role === 'owner' ? 'bg-[#2D4B3E]' :
                        s.role === 'staff' ? 'bg-[#117768]' :
                        s.role === 'parttime' ? 'bg-[#D97D54]' : 'bg-[#117768]'
                      }`}>
                        <UserCheck size={13}/>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-[#111] truncate">{s.name}</p>
                        <p className="text-[9px] text-[#999] truncate">{ROLE_LABELS[s.role || 'staff']}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {currentStaff && (
                  <button
                    onClick={clearStaff}
                    className="w-full p-2.5 text-[11px] font-bold text-[#999] hover:bg-[#FBFAF9] border-t border-[#EAEAEA]"
                  >
                    選択を解除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        
        <nav className="p-4 space-y-4 flex-1 overflow-y-auto hide-scrollbar">
          {filteredCategories.map(cat => (
            <div key={cat.name} className="space-y-1">
              <p className={`text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5 px-2 ${cat.premium ? 'text-yellow-600' : 'text-[#999999]'}`}>
                {cat.premium && '✨ '}{cat.name}
              </p>
              {cat.items.map(item => {
                const isActive = item.path === '/staff'
                  ? pathname === '/staff'
                  : pathname?.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path} href={item.path}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-bold text-[12.5px] tracking-wider transition-all ${
                      isActive ? 'bg-[#2D4B3E]/5 text-[#2D4B3E] border border-[#2D4B3E]/10 shadow-sm' : 'text-[#555555] hover:bg-[#F7F7F7] border border-transparent'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-[#2D4B3E]' : 'text-[#999999]'} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-5 bg-[#F7F7F7] border-t border-[#EAEAEA] shrink-0 space-y-3">
          <button 
            onClick={() => setShowFeedback(true)}
            className="w-full bg-white border border-[#EAEAEA] text-[#555555] text-[11px] font-bold py-2.5 rounded-xl shadow-sm hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all flex items-center justify-center gap-2"
          >
            <MessageSquare size={14} /> アプリの要望・バグ報告
          </button>

          {/* オプション機能のアップグレード案内 */}
          <div className="pt-2 border-t border-[#EAEAEA]">
            <button
              onClick={handleUpgradeRequest}
              disabled={isSending}
              className="w-full bg-[#2D4B3E] text-white text-[11px] font-bold py-3 rounded-xl shadow-md hover:bg-[#1f352b] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={14} /> {isSending ? '送信中...' : '機能アップグレード問い合わせ'}
            </button>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 md:ml-64 min-w-0">
        {children}
      </main>

      {showFeedback && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#111111]/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#EAEAEA] flex justify-between items-center bg-[#FBFAF9]">
              <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><MessageSquare size={18}/> フィードバックを送信</h2>
              <button onClick={() => setShowFeedback(false)} className="text-[#999999] hover:text-[#111111]"><X size={20}/></button>
            </div>
            <form onSubmit={handleFeedbackSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999]">種類</label>
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
                <label className="text-[11px] font-bold text-[#999999]">内容</label>
                <textarea 
                  required value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="追加してほしい機能や、発生しているエラーの詳細を具体的にご記入ください。"
                  className="w-full h-32 px-4 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E] resize-none leading-relaxed"
                />
              </div>
              <button type="submit" disabled={isSending} className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-[#1f352b] transition-all shadow-md disabled:opacity-50 mt-4">
                <Send size={16}/> {isSending ? '送信中...' : '開発元へ送信する'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ★ PIN認証モーダル */}
      {pinModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setPinModal(null); setPinInput(''); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-3">
                <Lock size={24} className="text-amber-600"/>
              </div>
              <h3 className="text-[16px] font-bold text-[#111]">{pinModal.staff.name} に切替</h3>
              <p className="text-[11px] text-[#999] mt-1">4桁PINを入力してください</p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && pinInput.length === 4) verifyPin(); }}
              autoFocus
              className="w-full h-16 text-center text-[32px] font-bold tracking-[0.6em] bg-[#FBFAF9] border-2 border-[#EAEAEA] rounded-xl outline-none focus:border-amber-500 font-mono"
              placeholder="••••"
            />
            {pinError && <p className="text-[12px] text-red-600 text-center font-bold">{pinError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setPinModal(null); setPinInput(''); }} className="flex-1 h-11 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-xl">キャンセル</button>
              <button onClick={verifyPin} disabled={pinInput.length !== 4} className="flex-1 h-11 bg-amber-600 text-white text-[12px] font-bold rounded-xl hover:bg-amber-700 disabled:opacity-50">確定</button>
            </div>
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