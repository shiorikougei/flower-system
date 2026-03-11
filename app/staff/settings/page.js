'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import Link from 'next/link';
import { LayoutGrid, ListChecks, Plus, Trash2 } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // --- 状態管理 ---
  const [generalConfig, setGeneralConfig] = useState({ appName: 'FLORIX', logoUrl: '', logoSize: 100, logoTransparent: false, slipBgUrl: '', slipBgOpacity: 50 });
  const [shops, setShops] = useState([]); 
  const [flowerItems, setFlowerItems] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffStore, setNewStaffStore] = useState('all');
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [shippingProvider, setShippingProvider] = useState('佐川急便');
  
  const [shippingRates, setShippingRates] = useState([
    { region: '北海道', prefs: ['北海道'], fee: 1000, coolFee: 500 },
    { region: '北東北', prefs: ['青森', '岩手', '秋田'], fee: 1200, coolFee: 500 },
    { region: '南東北', prefs: ['宮城', '山形', '福島'], fee: 1300, coolFee: 500 },
    { region: '関東・信越', prefs: ['茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '山梨', '新潟', '長野'], fee: 1400, coolFee: 600 },
    { region: '北陸・中部', prefs: ['富山', '石川', '福井', '岐阜', '静岡', '愛知', '三重'], fee: 1500, coolFee: 600 },
    { region: '関西', prefs: ['滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山'], fee: 1600, coolFee: 600 },
    { region: '中国・四国', prefs: ['鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知'], fee: 1800, coolFee: 700 },
    { region: '九州', prefs: ['福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島'], fee: 2000, coolFee: 700 },
    { region: '沖縄', prefs: ['沖縄'], fee: 3500, coolFee: 1000 },
  ]);

  const [boxFeeConfig, setBoxFeeConfig] = useState({
    type: 'flat', flatFee: 500, priceTiers: [{ minPrice: 0, fee: 300 }, { minPrice: 10000, fee: 0 }], itemFees: {},
    freeShippingThresholdEnabled: false, freeShippingThreshold: 15000,
    isBundleDiscount: true, coolBinEnabled: true, coolBinPeriods: [ { id: 1, start: '06-01', end: '09-30', note: '夏季クール便' } ]
  });

  const [brandTheme, setBrandTheme] = useState({ logoUrl: '', primaryColor: '#2D4B3E' });
  const [autoReply, setAutoReply] = useState({ subject: '', body: '' });

  const [staffOrderConfig, setStaffOrderConfig] = useState({
    ignoreLeadTime: true, allowCustomPrice: true,
    paymentMethods: ['店頭支払い(済)', '銀行振込(請求書)', '代金引換', '未定'], sendAutoReply: false,
  });

  // ★ 追加: ステータス設定
  const [statusConfig, setStatusConfig] = useState({
    type: 'template', // 'template' or 'custom'
    customLabels: ['未対応', '制作中', '制作完了', '配達中']
  });

  const tabs = [
    { id: 'general', label: '基本設定', sub: 'アプリ名・ロゴ・伝票柄' },
    { id: 'status', label: 'ステータス設定', sub: '受注状態のラベル定義' }, // ★ 追加
    { id: 'shop', label: '店舗管理', sub: '店舗・営業時間・決済' },
    { id: 'items', label: '商品管理', sub: 'アイテム・納期' },
    { id: 'shipping', label: '配送・送料', sub: '自社配達・業者配送' },
    { id: 'rules', label: '立札デザイン', sub: 'テンプレート' },
    { id: 'staff_order', label: '店舗注文受付', sub: '代理入力ルール' },
    { id: 'staff', label: 'スタッフ管理', sub: 'ログインユーザー' },
    { id: 'message', label: '通知メール', sub: '自動返信の設定' },
  ];

  const tateMaster = [
    { id: 'p1', label: '御供｜横型 (背景あり)', layout: 'horizontal', color: 'gray' }, 
    { id: 'p3', label: '御供｜縦型 (シンプル)', layout: 'vertical', color: 'gray' }, 
    { id: 'p4', label: '御供｜縦型 (会社名入)', layout: 'vertical', color: 'gray' },
    { id: 'p5', label: '祝｜横型 (スタンダード)', layout: 'horizontal', color: 'red' }, 
    { id: 'p6', label: '祝｜横型 (様へ構成)', layout: 'horizontal', color: 'red' }, 
    { id: 'p7', label: '祝｜縦型 (二列構成)', layout: 'vertical', color: 'red' }, 
    { id: 'p8', label: '祝｜縦型 (三列完成版)', layout: 'vertical', color: 'red' },
  ];

  const [selectedPreviewTate, setSelectedPreviewTate] = useState(tateMaster[3]);
  const topPrefixText = ['p1', 'p3', 'p4'].includes(selectedPreviewTate.id) ? (selectedPreviewTate.id === 'p1' ? '御供' : '供') : '祝';
  const tateInput1 = '御開店'; const tateInput2 = '株式会社〇〇'; const tateInput3 = '株式会社〇〇 山田太郎';
  const tateInput3a = '株式会社〇〇'; const tateInput3b = '代表取締役 山田太郎';

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (error) throw error;
        if (data && data.settings_data) {
          const s = data.settings_data;
          const today = new Date().toISOString().split('T')[0];

          if (s.generalConfig) setGeneralConfig({ ...{ slipBgUrl: '', slipBgOpacity: 50, logoSize: 100, logoTransparent: false }, ...s.generalConfig });
          if (s.statusConfig) setStatusConfig(s.statusConfig); // ★ 読み込み追加
          
          if (s.shops) {
            setShops(s.shops.map(shop => ({
              ...shop,
              bankInfo: shop.bankInfo || '',
              paymentUrl: shop.paymentUrl || '',
              specialHours: (shop.specialHours || []).filter(sh => {
                if (sh.recurrence === 'once' && sh.settingType === 'date' && sh.date < today) return false;
                return true;
              })
            })));
          }
          if (s.flowerItems) setFlowerItems(s.flowerItems);
          if (s.staffList) {
            if (s.staffList.length > 0 && typeof s.staffList[0] === 'string') {
              setStaffList(s.staffList.map((name, i) => ({ id: Date.now() + i, name, stores: ['all'] })));
            } else { setStaffList(s.staffList); }
          }
          if (s.deliveryAreas) setDeliveryAreas(s.deliveryAreas);
          if (s.shippingRates) setShippingRates(s.shippingRates);
          if (s.boxFeeConfig) setBoxFeeConfig(s.boxFeeConfig);
          if (s.staffOrderConfig) setStaffOrderConfig(s.staffOrderConfig);
          if (s.autoReply) setAutoReply(s.autoReply);
        }
      } catch (error) { console.error('設定の読み込みに失敗しました:', error.message); }
    }
    loadSettings();
  }, []);

  const handleLogin = () => {
    if (adminPassword === '7777') { setIsAdmin(true); } else { alert('パスワードが違います。'); }
  };

  const saveSettings = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const settingsData = {
        generalConfig, statusConfig, shops, flowerItems, staffList, deliveryAreas, shippingProvider, shippingRates,
        boxFeeConfig, brandTheme, autoReply, staffOrderConfig,
      };
      const { error } = await supabase.from('app_settings').upsert({ id: 'default', settings_data: settingsData });
      if (error) throw error;
      alert('設定を保存しました。');
    } catch (error) { alert('設定の保存に失敗しました。'); } finally { setIsSaving(false); }
  };

  const updateShop = (id, field, value) => setShops(shops.map(s => s.id === id ? { ...s, [field]: value } : s));
  const addShop = () => setShops([...shops, { id: Date.now(), name: '', phone: '', zip: '', address: '', invoiceNumber: '', bankInfo: '', paymentUrl: '', canDelivery: true, normalOpen: '11:00', normalClose: '19:00', normalDeliveryOpen: '11:00', normalDeliveryClose: '18:00', specialHours: [], enabledTatePatterns: ['p5', 'p7'] }]);
  const addSpecialHour = (shopId) => setShops(shops.map(s => s.id === shopId ? { ...s, specialHours: [...(s.specialHours || []), { id: Date.now(), target: 'business', settingType: 'date', date: '', recurrence: 'once', type: 'closed', open: '11:00', close: '18:00' }] } : s));
  const toggleTatePattern = (shopId, patternId) => setShops(shops.map(s => s.id === shopId ? { ...s, enabledTatePatterns: s.enabledTatePatterns.includes(patternId) ? s.enabledTatePatterns.filter(p => p !== patternId) : [...s.enabledTatePatterns, patternId] } : s));
  const addFlowerItem = () => setFlowerItems([...flowerItems, { id: Date.now(), name: '', minPrice: 3000, stepPrice: 1000, maxPrice: 20000, canPickup: true, canDelivery: true, canShipping: true, normalLeadDays: 2, shippingLeadDays: 3, canBringFlowers: false, bringFlowersLeadDays: 7, canBringVase: false, bringVaseLeadDays: 7 }]);
  const updateFlowerItem = (id, field, value) => setFlowerItems(flowerItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  const addDeliveryArea = () => setDeliveryAreas([...deliveryAreas, { id: Date.now(), name: '', keywords: '', fee: 0 }]);
  const updateDeliveryArea = (id, field, value) => setDeliveryAreas(deliveryAreas.map(a => a.id === id ? { ...a, [field]: value } : a));
  const removeDeliveryArea = (id) => setDeliveryAreas(deliveryAreas.filter(a => a.id !== id));
  const updateShippingRate = (index, field, value) => { const newRates = [...shippingRates]; newRates[index][field] = Number(value); setShippingRates(newRates); };
  const addCoolPeriod = () => setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: [...boxFeeConfig.coolBinPeriods, { id: Date.now(), start: '01-01', end: '01-31', note: '' }]});
  const updateCoolPeriod = (id, field, value) => setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(p => p.id === id ? {...p, [field]: value} : p)});
  const removeCoolPeriod = (id) => setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.filter(p => p.id !== id)});

  const addStaff = () => {
    if (!newStaffName.trim()) return;
    setStaffList([...staffList, { id: Date.now(), name: newStaffName.trim(), stores: [newStaffStore] }]);
    setNewStaffName('');
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('画像サイズが大きすぎます。2MB以下の画像を選んでください。'); return; }
    const reader = new FileReader();
    reader.onload = (event) => setGeneralConfig({ ...generalConfig, [field]: event.target.result });
    reader.readAsDataURL(file);
  };

  // ★ ステータス自作用の関数
  const addCustomStatus = () => {
    setStatusConfig({ ...statusConfig, customLabels: [...statusConfig.customLabels, '新ステータス'] });
  };
  const updateCustomStatus = (index, val) => {
    const newList = [...statusConfig.customLabels];
    newList[index] = val;
    setStatusConfig({ ...statusConfig, customLabels: newList });
  };
  const removeCustomStatus = (index) => {
    setStatusConfig({ ...statusConfig, customLabels: statusConfig.customLabels.filter((_, i) => i !== index) });
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10 hidden md:block">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {generalConfig.logoUrl ? (
             <img src={generalConfig.logoUrl} alt={generalConfig.appName} style={{ width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal' }} className="h-8 object-contain object-left mb-1 transition-all" />
          ) : (
             <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{generalConfig.appName}</span>
          )}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">ダッシュボード</Link>
          <Link href="/staff/orders" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">受注一覧</Link>
          <Link href="/staff/new-order" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">店舗注文受付</Link>
        </nav>
        <div className="px-4 pt-4 border-t border-[#EAEAEA]">
          <p className="text-[10px] font-bold text-[#2D4B3E] px-2 mb-2 tracking-widest uppercase">Settings</p>
          <nav className="space-y-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className={`w-full text-left px-6 py-4 rounded-xl transition-all duration-300 ${activeTab === t.id ? 'bg-[#2D4B3E] text-white shadow-lg' : 'text-[#555555] hover:bg-[#F7F7F7]'}`}>
                <div className="flex flex-col text-left"><span className={`text-[13px] font-bold tracking-wider`}>{t.label}</span><span className={`text-[10px] ${activeTab === t.id ? 'text-white/70' : 'text-[#999999]'}`}>{t.sub}</span></div>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 md:ml-64 flex flex-col min-w-0 text-left">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-12 sticky top-0 z-10 text-left">
          <h1 className="text-[16px] font-bold tracking-tight text-[#2D4B3E]">{tabs.find(t => t.id === activeTab)?.label}</h1>
          <div className="flex items-center gap-4">
            {!isAdmin ? (
              <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border border-[#EAEAEA] shadow-sm">
                <span className="text-[10px] font-bold text-[#999999] ml-2">閲覧のみ</span>
                <input type="password" placeholder="パスワード" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-24 h-8 px-3 bg-[#FBFAF9] text-xs font-bold outline-none rounded-lg" />
                <button onClick={handleLogin} className="px-4 h-8 bg-[#2D4B3E] text-white text-[11px] font-bold rounded-lg hover:bg-[#1f352b] transition-all">解除</button>
              </div>
            ) : (
              <div className="flex items-center gap-4 animate-in fade-in">
                <span className="text-[11px] font-bold text-[#2D4B3E]">編集モード</span>
                <button onClick={saveSettings} disabled={isSaving} className={`px-8 py-3 rounded-xl text-[13px] font-bold tracking-widest shadow-md transition-all ${isSaving ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b] active:scale-95'}`}>
                  {isSaving ? '保存中...' : '設定を保存'}
                </button>
              </div>
            )}
          </div>
        </header>

        <div className={`max-w-[840px] mx-auto w-full py-12 md:py-20 px-6 transition-all duration-500 ${!isAdmin ? 'pointer-events-none opacity-60 grayscale-[30%]' : ''}`}>
          
          {/* 【1】基本設定 */}
          {activeTab === 'general' && (
            <div className="space-y-16 animate-in fade-in">
              <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">基本設定</h2></header>
              <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 md:p-12 shadow-sm space-y-10">
                <div className="space-y-2 text-left">
                  <label className="text-[12px] font-bold text-[#555555]">アプリの表示名 (ブランド名)</label>
                  <input type="text" value={generalConfig.appName} onChange={(e) => setGeneralConfig({...generalConfig, appName: e.target.value})} className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 font-bold focus:border-[#2D4B3E] outline-none" />
                </div>
                
                <div className="space-y-4 text-left pt-6 border-t border-[#FBFAF9]">
                  <label className="text-[12px] font-bold text-[#555555]">店舗ロゴ・アイコン</label>
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full space-y-6 p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA]">
                      <div className="space-y-2">
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logoUrl')} className="block w-full text-sm text-[#555555] file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-[12px] file:font-bold file:bg-[#2D4B3E] file:text-white hover:file:bg-[#1f352b] cursor-pointer" />
                      </div>
                      {generalConfig.logoUrl && (
                        <div className="space-y-6 pt-4 border-t border-[#EAEAEA]">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center"><label className="text-[11px] font-bold text-[#2D4B3E]">表示サイズ</label><span className="text-[11px] font-bold text-[#2D4B3E] bg-white px-2 py-0.5 rounded-md border">{generalConfig.logoSize}%</span></div>
                            <input type="range" min="30" max="150" value={generalConfig.logoSize} onChange={(e) => setGeneralConfig({...generalConfig, logoSize: Number(e.target.value)})} className="w-full accent-[#2D4B3E]" />
                          </div>
                          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#EAEAEA]">
                            <span className="text-[12px] font-bold text-[#2D4B3E]">背景を透明にする (multiply)</span>
                            <button onClick={() => setGeneralConfig({...generalConfig, logoTransparent: !generalConfig.logoTransparent})} className={`w-12 h-7 rounded-full relative transition-all ${generalConfig.logoTransparent ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${generalConfig.logoTransparent ? 'left-6' : 'left-1'}`}></div></button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="w-full lg:w-48 shrink-0 flex flex-col items-center gap-2">
                      <label className="text-[11px] font-bold text-[#999999]">プレビュー</label>
                      <div className="w-full aspect-square bg-[#EAEAEA]/30 border rounded-2xl flex items-center justify-center overflow-hidden">
                        {generalConfig.logoUrl ? <img src={generalConfig.logoUrl} style={{ width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal' }} className="object-contain" /> : <span className="text-[10px] font-bold text-[#999999]">No Logo</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ★ 【新設】ステータス設定 */}
          {activeTab === 'status' && (
            <div className="space-y-16 animate-in fade-in">
              <header className="px-2 border-l-4 border-[#2D4B3E] mb-10">
                <h2 className="text-[24px] font-bold text-[#2D4B3E]">ステータス設定</h2>
                <p className="text-[13px] text-[#555555] mt-2">注文の進捗状況（ステータス）の選択肢を管理します。</p>
              </header>

              <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-sm space-y-10">
                <div className="flex gap-4 p-2 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA]">
                  <button 
                    onClick={() => setStatusConfig({...statusConfig, type: 'template'})}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-[13px] transition-all ${statusConfig.type === 'template' ? 'bg-white shadow-md text-[#2D4B3E]' : 'text-[#999999]'}`}
                  >
                    <LayoutGrid size={18} /> テンプレを使用
                  </button>
                  <button 
                    onClick={() => setStatusConfig({...statusConfig, type: 'custom'})}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-[13px] transition-all ${statusConfig.type === 'custom' ? 'bg-white shadow-md text-[#2D4B3E]' : 'text-[#999999]'}`}
                  >
                    <ListChecks size={18} /> 自分で設定する
                  </button>
                </div>

                {statusConfig.type === 'template' ? (
                  <div className="p-8 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] space-y-4">
                    <p className="text-[12px] font-bold text-[#2D4B3E]">標準のステータス項目</p>
                    <div className="flex flex-wrap gap-2">
                      {['未対応', '制作中', '制作完了', '配達中'].map(s => (
                        <span key={s} className="px-4 py-2 bg-white border border-[#EAEAEA] rounded-lg text-[12px] font-bold text-[#555555]">{s}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#999999] pt-2">※一般的なお花屋さんのフローに合わせた設定です。</p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center">
                      <p className="text-[12px] font-bold text-[#2D4B3E]">カスタムステータス一覧</p>
                      <button onClick={addCustomStatus} className="flex items-center gap-1 text-[11px] font-bold text-[#2D4B3E] bg-[#2D4B3E]/5 px-4 py-2 rounded-full hover:bg-[#2D4B3E] hover:text-white transition-all">
                        <Plus size={14} /> 項目を追加
                      </button>
                    </div>
                    <div className="space-y-3">
                      {statusConfig.customLabels.map((label, idx) => (
                        <div key={idx} className="flex items-center gap-3 animate-in fade-in">
                          <div className="w-8 h-8 flex items-center justify-center bg-[#FBFAF9] rounded-lg border border-[#EAEAEA] text-[10px] font-bold text-[#999999]">{idx + 1}</div>
                          <input 
                            type="text" 
                            value={label} 
                            onChange={(e) => updateCustomStatus(idx, e.target.value)}
                            className="flex-1 h-12 px-5 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl font-bold text-[13px] outline-none focus:bg-white focus:border-[#2D4B3E] transition-all"
                          />
                          <button onClick={() => removeCustomStatus(idx)} className="p-3 text-red-300 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 【2】店舗管理 (既存) */}
          {activeTab === 'shop' && (
            <div className="space-y-16 animate-in fade-in">
              <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">店舗管理</h2></header>
              <div className="space-y-12">
                {shops.map((shop) => (
                  <div key={shop.id} className="bg-white rounded-[32px] border border-[#EAEAEA] p-6 md:p-12 shadow-sm relative">
                    <button onClick={() => setShops(shops.filter(s => s.id !== shop.id))} className="absolute top-6 right-6 text-[#999999] hover:text-red-500 font-bold text-[10px]">削除</button>
                    <div className="space-y-12 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2"><label className="text-[11px] font-bold text-[#2D4B3E] ml-1">店舗名</label><input type="text" value={shop.name} onChange={(e) => updateShop(shop.id, 'name', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E]" /></div>
                        <div className="space-y-2"><label className="text-[11px] font-bold text-[#2D4B3E] ml-1">電話番号</label><input type="tel" value={shop.phone} onChange={(e) => updateShop(shop.id, 'phone', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E]" /></div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="md:col-span-3 space-y-2"><label className="text-[11px] font-bold text-[#2D4B3E] ml-1">郵便番号</label><input type="text" placeholder="000-0000" value={shop.zip} onChange={(e) => updateShop(shop.id, 'zip', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none font-mono focus:border-[#2D4B3E]" /></div>
                        <div className="md:col-span-6 space-y-2"><label className="text-[11px] font-bold text-[#2D4B3E] ml-1">住所</label><input type="text" value={shop.address} onChange={(e) => updateShop(shop.id, 'address', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E]" /></div>
                        <div className="md:col-span-3 space-y-2"><label className="text-[11px] font-bold text-[#2D4B3E] ml-1">インボイス番号</label><input type="text" placeholder="T..." value={shop.invoiceNumber} onChange={(e) => updateShop(shop.id, 'invoiceNumber', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none font-mono focus:border-[#2D4B3E]" /></div>
                      </div>
                      <div className="pt-6 border-t border-[#FBFAF9] space-y-6">
                        <p className="text-[13px] font-bold text-[#2D4B3E]">決済・振込先情報</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#2D4B3E]/5 p-6 rounded-2xl border border-[#2D4B3E]/20">
                          <div className="space-y-2"><label className="text-[11px] font-bold text-[#2D4B3E] ml-1">振込先口座情報</label><textarea placeholder="銀行名 支店名 口座番号..." value={shop.bankInfo || ''} onChange={(e) => updateShop(shop.id, 'bankInfo', e.target.value)} className="w-full h-24 p-4 bg-white border border-[#EAEAEA] rounded-xl outline-none text-[12px] resize-none focus:border-[#2D4B3E]" /></div>
                          <div className="space-y-2"><label className="text-[11px] font-bold text-[#2D4B3E] ml-1">オンライン決済URL</label><input type="url" placeholder="https://..." value={shop.paymentUrl || ''} onChange={(e) => updateShop(shop.id, 'paymentUrl', e.target.value)} className="w-full h-12 px-4 bg-white border border-[#EAEAEA] rounded-xl outline-none text-[12px] focus:border-[#2D4B3E]" /></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addShop} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] text-[#999999] font-bold rounded-[32px] hover:bg-white hover:border-[#2D4B3E] transition-all">+ 店舗を追加</button>
              </div>
            </div>
          )}

          {/* ... その他のタブは既存のまま ... */}
          {activeTab === 'items' && <div className="space-y-12 animate-in fade-in">...既存の商品管理コード...</div>}
          {activeTab === 'shipping' && <div className="space-y-12 animate-in fade-in">...既存の配送管理コード...</div>}
          {/* (※ページが長大になるため、主要な変更箇所以外は省略していますが、お手元のファイルを上書きする際はそのまま残してください) */}

        </div>
      </main>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; }`}</style>
    </div>
  );
}