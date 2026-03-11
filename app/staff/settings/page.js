'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { LayoutGrid, ListChecks, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

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

  const [autoReply, setAutoReply] = useState({ subject: '', body: '' });

  const [staffOrderConfig, setStaffOrderConfig] = useState({
    ignoreLeadTime: true, allowCustomPrice: true,
    paymentMethods: ['店頭支払い(済)', '銀行振込(請求書)', '代金引換', '未定'], sendAutoReply: false,
  });

  const [statusConfig, setStatusConfig] = useState({
    type: 'template',
    customLabels: ['未対応', '制作中', '制作完了', '配達中']
  });

  const tabs = [
    { id: 'general', label: '基本設定', sub: 'アプリ名・ロゴ・伝票柄' },
    { id: 'status', label: 'ステータス', sub: '受注状態のラベル' },
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
          if (s.statusConfig) setStatusConfig(s.statusConfig);
          
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
        boxFeeConfig, autoReply, staffOrderConfig,
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

  const addCustomStatus = () => setStatusConfig({ ...statusConfig, customLabels: [...statusConfig.customLabels, '新ステータス'] });
  const updateCustomStatus = (index, val) => {
    const newList = [...statusConfig.customLabels];
    newList[index] = val;
    setStatusConfig({ ...statusConfig, customLabels: newList });
  };
  const removeCustomStatus = (index) => setStatusConfig({ ...statusConfig, customLabels: statusConfig.customLabels.filter((_, i) => i !== index) });

  return (
    <>
      <main className="pb-32 font-sans text-left">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-12 sticky top-0 z-10 text-left">
          <h1 className="text-[16px] font-bold tracking-tight text-[#2D4B3E] flex-shrink-0">
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>
          
          <div className="hidden md:flex flex-1 mx-6 overflow-x-auto bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] hide-scrollbar">
            {tabs.map((t) => (
              <button 
                key={t.id} 
                onClick={() => setActiveTab(t.id)} 
                className={`whitespace-nowrap px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 shrink-0">
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

        {/* スマホ用タブメニュー */}
        <div className="md:hidden flex overflow-x-auto bg-white border-b border-[#EAEAEA] p-2 hide-scrollbar sticky top-20 z-10 shadow-sm">
          {tabs.map((t) => (
            <button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)} 
              className={`whitespace-nowrap px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-[#2D4B3E] text-white' : 'text-[#999999] hover:bg-[#F7F7F7]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

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
                  <label className="text-[12px] font-bold text-[#555555]">店舗ロゴ・アイコン (任意)</label>
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 w-full space-y-6 p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA]">
                      <div className="space-y-2">
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logoUrl')} className="block w-full text-sm text-[#555555] file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-[12px] file:font-bold file:bg-[#2D4B3E] file:text-white hover:file:bg-[#1f352b] cursor-pointer transition-all" />
                        <p className="text-[10px] text-[#999999]">※2MB以下の画像（PNG/JPG）を直接選択してください。</p>
                      </div>
                      {generalConfig.logoUrl && (
                        <div className="space-y-6 pt-4 border-t border-[#EAEAEA] animate-in fade-in">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <label className="text-[11px] font-bold text-[#2D4B3E]">ロゴの表示サイズ</label>
                              <span className="text-[11px] font-bold text-[#2D4B3E] bg-white px-2 py-0.5 rounded-md border border-[#EAEAEA]">{generalConfig.logoSize}%</span>
                            </div>
                            <input type="range" min="30" max="150" value={generalConfig.logoSize} onChange={(e) => setGeneralConfig({...generalConfig, logoSize: Number(e.target.value)})} className="w-full accent-[#2D4B3E]" />
                          </div>
                          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#EAEAEA]">
                            <div className="space-y-1">
                              <span className="text-[12px] font-bold text-[#2D4B3E] block">白背景を透明にする</span>
                              <span className="text-[9px] text-[#999999] block">※白い部分が透けて見えます</span>
                            </div>
                            <button onClick={() => setGeneralConfig({...generalConfig, logoTransparent: !generalConfig.logoTransparent})} className={`w-12 h-7 rounded-full relative transition-all ${generalConfig.logoTransparent ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}>
                              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${generalConfig.logoTransparent ? 'left-6' : 'left-1'}`}></div>
                            </button>
                          </div>
                          <button onClick={() => setGeneralConfig({...generalConfig, logoUrl: '', logoSize: 100, logoTransparent: false})} className="text-[10px] text-red-500 font-bold hover:underline transition-all">ロゴを削除する</button>
                        </div>
                      )}
                    </div>
                    <div className="w-full lg:w-48 shrink-0 space-y-2">
                      <label className="text-[11px] font-bold text-[#999999] tracking-widest text-center block">プレビュー</label>
                      <div className="relative w-full aspect-square bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-2xl flex items-center justify-center overflow-hidden">
                        {generalConfig.logoUrl ? (
                          <img src={generalConfig.logoUrl} alt="Logo Preview" style={{ width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal' }} className="object-contain transition-all duration-200" />
                        ) : (
                          <span className="text-[10px] font-bold text-[#999999] text-center">No Logo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 text-left pt-6 border-t border-[#FBFAF9]">
                  <div className="flex flex-col lg:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                      <label className="text-[12px] font-bold text-[#2D4B3E]">伝票用 背景（透かし柄）画像</label>
                      <div className="flex flex-col gap-4 p-6 bg-[#2D4B3E]/5 rounded-2xl border border-[#2D4B3E]/20">
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'slipBgUrl')} className="block w-full text-sm text-[#555555] file:mr-4 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:text-[12px] file:font-bold file:bg-[#2D4B3E]/10 file:text-[#2D4B3E] hover:file:bg-[#2D4B3E]/20 cursor-pointer transition-all" />
                        {generalConfig.slipBgUrl && (
                          <div className="space-y-3 mt-4 border-t border-[#2D4B3E]/10 pt-4">
                             <div className="flex justify-between items-center">
                               <label className="text-[11px] font-bold text-[#2D4B3E]">画像の濃さ（透過度）</label>
                               <span className="text-[11px] font-bold text-[#2D4B3E] bg-white px-2 py-0.5 rounded-md shadow-sm">{generalConfig.slipBgOpacity}%</span>
                             </div>
                             <input type="range" min="0" max="100" value={generalConfig.slipBgOpacity} onChange={(e) => setGeneralConfig({...generalConfig, slipBgOpacity: Number(e.target.value)})} className="w-full accent-[#2D4B3E]" />
                             <button onClick={() => setGeneralConfig({...generalConfig, slipBgUrl: ''})} className="text-[10px] text-red-500 font-bold bg-white border border-red-200 px-4 py-2 rounded-lg mt-2 hover:bg-red-50 transition-all shadow-sm">画像を削除</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-full lg:w-[280px] shrink-0 space-y-2">
                       <label className="text-[11px] font-bold text-[#999999] tracking-widest text-center block">伝票プレビュー</label>
                       <div className="relative w-full aspect-[210/148] bg-[#f1f8e9] border border-gray-300 rounded-xl p-4 overflow-hidden flex flex-col justify-between shadow-md">
                         {generalConfig.slipBgUrl && (
                           <div className="absolute inset-0 z-0 grayscale-[30%] pointer-events-none" style={{ backgroundImage: `url(${generalConfig.slipBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', mixBlendMode: 'multiply', opacity: generalConfig.slipBgOpacity / 100 }} />
                         )}
                         <div className="relative z-10 flex justify-between border-b border-[#2e7d32] pb-1"><span className="text-[#2e7d32] font-bold text-[12px] tracking-widest">受 注 書 控</span></div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 【ステータス設定】 */}
          {activeTab === 'status' && (
            <div className="space-y-16 animate-in fade-in">
              <header className="px-2 border-l-4 border-[#2D4B3E] mb-10">
                <h2 className="text-[24px] font-bold text-[#2D4B3E]">ステータス設定</h2>
                <p className="text-[13px] text-[#555555] mt-2">注文の進捗状況（ステータス）の選択肢を管理します。</p>
              </header>

              <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-sm space-y-10">
                <div className="flex gap-4 p-2 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA]">
                  <button onClick={() => setStatusConfig({...statusConfig, type: 'template'})} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-[13px] transition-all ${statusConfig.type === 'template' ? 'bg-white shadow-md text-[#2D4B3E]' : 'text-[#999999]'}`}>
                    <LayoutGrid size={18} /> テンプレを使用
                  </button>
                  <button onClick={() => setStatusConfig({...statusConfig, type: 'custom'})} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-[13px] transition-all ${statusConfig.type === 'custom' ? 'bg-white shadow-md text-[#2D4B3E]' : 'text-[#999999]'}`}>
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
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <p className="text-[12px] font-bold text-[#2D4B3E]">カスタムステータス一覧</p>
                      <button onClick={addCustomStatus} className="flex items-center gap-1 text-[11px] font-bold text-[#2D4B3E] bg-[#2D4B3E]/5 px-4 py-2 rounded-full hover:bg-[#2D4B3E] hover:text-white transition-all"><Plus size={14} /> 項目を追加</button>
                    </div>
                    <div className="space-y-3">
                      {statusConfig.customLabels.map((label, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-[#FBFAF9] rounded-lg border border-[#EAEAEA] text-[10px] font-bold text-[#999999]">{idx + 1}</div>
                          <input type="text" value={label} onChange={(e) => updateCustomStatus(idx, e.target.value)} className="flex-1 h-12 px-5 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl font-bold text-[13px] outline-none focus:bg-white focus:border-[#2D4B3E] transition-all" />
                          <button onClick={() => removeCustomStatus(idx)} className="p-3 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 【2】店舗管理 */}
          {activeTab === 'shop' && (
            <div className="space-y-16 animate-in fade-in duration-700">
              <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">店舗管理</h2></header>
              <div className="space-y-12">
                {shops.length === 0 && <p className="text-sm text-gray-500 text-center py-10">店舗が登録されていません。</p>}
                {shops.map((shop) => (
                  <div key={shop.id} className="bg-white rounded-[32px] border border-[#EAEAEA] p-6 md:p-12 shadow-sm relative">
                    <button onClick={() => setShops(shops.filter(s => s.id !== shop.id))} className="absolute top-6 right-6 text-[#999999] hover:text-red-500 font-bold text-[10px]">削除</button>
                    <div className="space-y-12 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-[#2D4B3E] ml-1">店舗名</label>
                          <input type="text" value={shop.name} onChange={(e) => updateShop(shop.id, 'name', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E]" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-[#2D4B3E] ml-1">電話番号</label>
                          <input type="tel" value={shop.phone} onChange={(e) => updateShop(shop.id, 'phone', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E]" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="md:col-span-3 space-y-2">
                          <label className="text-[11px] font-bold text-[#2D4B3E] ml-1">郵便番号</label>
                          <input type="text" placeholder="000-0000" value={shop.zip || ''} onChange={(e) => updateShop(shop.id, 'zip', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none font-mono focus:border-[#2D4B3E]" />
                        </div>
                        <div className="md:col-span-6 space-y-2">
                          <label className="text-[11px] font-bold text-[#2D4B3E] ml-1">住所</label>
                          <input type="text" value={shop.address} onChange={(e) => updateShop(shop.id, 'address', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E]" />
                        </div>
                        <div className="md:col-span-3 space-y-2">
                          <label className="text-[11px] font-bold text-[#2D4B3E] ml-1">インボイス番号</label>
                          <input type="text" placeholder="T..." value={shop.invoiceNumber} onChange={(e) => updateShop(shop.id, 'invoiceNumber', e.target.value)} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none font-mono focus:border-[#2D4B3E]" />
                        </div>
                      </div>
                      <div className="pt-6 border-t border-[#FBFAF9] space-y-6">
                        <p className="text-[13px] font-bold text-[#2D4B3E]">決済・振込先情報</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-[#2D4B3E]/5 p-6 rounded-2xl border border-[#2D4B3E]/20">
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-[#2D4B3E] ml-1">振込先口座情報</label>
                            <textarea placeholder="銀行名 支店名 口座番号..." value={shop.bankInfo || ''} onChange={(e) => updateShop(shop.id, 'bankInfo', e.target.value)} className="w-full h-24 p-4 bg-white border border-[#EAEAEA] rounded-xl outline-none text-[12px] resize-none focus:border-[#2D4B3E]" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[11px] font-bold text-[#2D4B3E] ml-1">オンライン決済URL</label>
                            <input type="url" placeholder="https://..." value={shop.paymentUrl || ''} onChange={(e) => updateShop(shop.id, 'paymentUrl', e.target.value)} className="w-full h-12 px-4 bg-white border border-[#EAEAEA] rounded-xl outline-none text-[12px] focus:border-[#2D4B3E]" />
                          </div>
                        </div>
                      </div>
                      <div className="pt-10 border-t border-[#FBFAF9] flex items-center justify-between">
                        <p className="text-[14px] font-bold text-[#2D4B3E]">自社配達サービスの提供</p>
                        <button onClick={() => updateShop(shop.id, 'canDelivery', !shop.canDelivery)} className={`w-14 h-8 rounded-full transition-all relative ${shop.canDelivery ? 'bg-[#2D4B3E]' : 'bg-[#EAEAEA]'}`}>
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${shop.canDelivery ? 'left-7' : 'left-1'}`}></div>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <label className="text-[11px] font-bold text-[#999999] ml-1">通常営業時間</label>
                          <div className="p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] flex items-center justify-between font-mono font-bold text-[#2D4B3E]">
                            <input type="time" value={shop.normalOpen} onChange={(e)=>updateShop(shop.id,'normalOpen',e.target.value)} className="bg-transparent outline-none" />
                            <span>―</span>
                            <input type="time" value={shop.normalClose} onChange={(e)=>updateShop(shop.id,'normalClose',e.target.value)} className="bg-transparent outline-none text-right" />
                          </div>
                        </div>
                        {shop.canDelivery && (
                          <div className="space-y-4 animate-in fade-in">
                            <label className="text-[11px] font-bold text-[#2D4B3E] ml-1">通常配達可能時間</label>
                            <div className="p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] flex items-center justify-between font-mono font-bold text-[#2D4B3E]">
                              <input type="time" value={shop.normalDeliveryOpen} onChange={(e)=>updateShop(shop.id,'normalDeliveryOpen',e.target.value)} className="bg-transparent outline-none" />
                              <span>―</span>
                              <input type="time" value={shop.normalDeliveryClose} onChange={(e)=>updateShop(shop.id,'normalDeliveryClose',e.target.value)} className="bg-transparent outline-none text-right" />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="pt-10 border-t border-[#FBFAF9] space-y-6">
                        <div className="flex justify-between items-center">
                          <p className="text-[11px] font-bold text-[#999999] tracking-widest">特別スケジュール設定</p>
                          <button onClick={() => addSpecialHour(shop.id)} className="text-[10px] font-bold text-[#2D4B3E] border border-[#2D4B3E] px-4 py-2 rounded-full hover:bg-[#2D4B3E] hover:text-white transition-all">+ 追加</button>
                        </div>
                        <div className="space-y-4">
                          {(shop.specialHours || []).map((sh) => (
                            <div key={sh.id} className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] space-y-6 relative">
                              <button onClick={() => updateShop(shop.id, 'specialHours', shop.specialHours.filter(h => h.id !== sh.id))} className="absolute top-4 right-4 text-red-300 font-bold">×</button>
                              
                              <div className="flex flex-wrap items-center gap-4">
                                <select value={sh.target} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, target: e.target.value} : h))} className="bg-[#2D4B3E] text-white rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none shadow-sm">
                                  <option value="business">店舗の営業</option>
                                  {shop.canDelivery && <option value="delivery">自社での配達</option>}
                                </select>
                                <div className="flex bg-white rounded-xl border border-[#EAEAEA] p-1">
                                  <button onClick={() => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, settingType: 'date', recurrence: 'once'} : h))} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sh.settingType === 'date' ? 'bg-[#2D4B3E] text-white shadow-sm' : 'text-[#999999]'}`}>日付指定</button>
                                  <button onClick={() => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, settingType: 'day', recurrence: 'weekly'} : h))} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${sh.settingType === 'day' ? 'bg-[#2D4B3E] text-white shadow-sm' : 'text-[#999999]'}`}>曜日指定</button>
                                </div>
                                {sh.settingType === 'date' ? (
                                  <input type="date" value={sh.date} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, date: e.target.value} : h))} className="bg-white border border-[#EAEAEA] rounded-lg p-2 text-[12px] font-bold" />
                                ) : (
                                  <select value={sh.day} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, day: e.target.value} : h))} className="bg-white border border-[#EAEAEA] rounded-lg p-2 text-[12px] font-bold">
                                    <option>月</option><option>火</option><option>水</option><option>木</option><option>金</option><option>土</option><option>日</option>
                                  </select>
                                )}
                                
                                {sh.settingType === 'date' ? (
                                  <select value={sh.recurrence} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, recurrence: e.target.value} : h))} className="bg-white border border-[#EAEAEA] rounded-lg p-2 text-[11px] font-bold text-left">
                                    <option value="once">1回のみ</option>
                                    <option value="yearly">毎年繰り返す</option>
                                  </select>
                                ) : (
                                  <select value={sh.recurrence} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, recurrence: e.target.value} : h))} className="bg-white border border-[#EAEAEA] rounded-lg p-2 text-[11px] font-bold text-left">
                                    <option value="weekly">毎週繰り返す</option>
                                  </select>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-[#EAEAEA] text-left">
                                <select value={sh.type} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, type: e.target.value} : h))} className="bg-white border border-[#2D4B3E] text-[#2D4B3E] rounded-lg p-2 text-[12px] font-bold text-left">
                                  <option value="closed">休業 / 受付不可</option>
                                  <option value="open">臨時営業 / 受付許可</option>
                                  <option value="changed">時間変更</option>
                                </select>
                                {sh.type !== 'closed' && (
                                  <div className="flex items-center gap-2">
                                    <input type="time" value={sh.open} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, open: e.target.value} : h))} className="bg-white border border-[#EAEAEA] rounded-lg p-1.5 font-mono font-bold text-sm" />
                                    <span>―</span>
                                    <input type="time" value={sh.close} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, close: e.target.value} : h))} className="bg-white border border-[#EAEAEA] rounded-lg p-1.5 font-mono font-bold text-sm" />
                                  </div>
                                )}
                                <input type="text" placeholder="理由メモ" value={sh.note} onChange={(e) => updateShop(shop.id, 'specialHours', shop.specialHours.map(h => h.id === sh.id ? {...h, note: e.target.value} : h))} className="flex-1 bg-transparent border-b border-[#EAEAEA] outline-none text-xs px-2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addShop} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] text-[#999999] font-bold rounded-[32px] hover:bg-white hover:border-[#2D4B3E] transition-all">+ 店舗を追加</button>
              </div>
            </div>
          )}

          {/* 【3】商品管理 */}
          {activeTab === 'items' && (
            <div className="space-y-12 animate-in fade-in duration-700">
              <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">商品管理</h2></header>
              <div className="space-y-10">
                {flowerItems.map(item => (
                  <div key={item.id} className="bg-white rounded-[32px] border border-[#EAEAEA] shadow-sm relative overflow-hidden group">
                    <button onClick={() => setFlowerItems(flowerItems.filter(i => i.id !== item.id))} className="absolute top-8 right-8 text-[#999999] hover:text-red-500 font-bold text-[10px]">削除</button>
                    <div className="p-10 space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="md:col-span-1 space-y-2">
                          <label className="text-[10px] font-bold text-[#999999] tracking-widest ml-1">アイテム名</label>
                          <input type="text" value={item.name} onChange={(e) => updateFlowerItem(item.id, 'name', e.target.value)} className="w-full h-10 border-b-2 border-[#F7F7F7] font-bold text-[20px] focus:border-[#2D4B3E] outline-none" />
                        </div>
                        <div className="md:col-span-3 grid grid-cols-3 gap-6 bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA]">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#2D4B3E] ml-1">最低価格</label>
                            <input type="number" value={item.minPrice} onChange={(e) => updateFlowerItem(item.id, 'minPrice', e.target.value)} className="w-full h-10 bg-white rounded-lg px-3 font-mono font-bold text-sm shadow-sm outline-none focus:border focus:border-[#2D4B3E]" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#2D4B3E] ml-1">価格刻み</label>
                            <input type="number" value={item.stepPrice} onChange={(e) => updateFlowerItem(item.id, 'stepPrice', e.target.value)} className="w-full h-10 bg-white rounded-lg px-3 font-mono font-bold text-sm shadow-sm outline-none focus:border focus:border-[#2D4B3E]" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#2D4B3E] ml-1">最高価格</label>
                            <input type="number" value={item.maxPrice} onChange={(e) => updateFlowerItem(item.id, 'maxPrice', e.target.value)} className="w-full h-10 bg-white rounded-lg px-3 font-mono font-bold text-sm shadow-sm outline-none focus:border focus:border-[#2D4B3E]" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4">
                        <div className="space-y-4">
                          <label className="text-[10px] font-bold text-[#999999] tracking-widest ml-1">受取方法</label>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer bg-[#FBFAF9] px-4 py-2 rounded-full border border-[#EAEAEA] has-[:checked]:border-[#2D4B3E] has-[:checked]:bg-[#2D4B3E]/5 shadow-sm transition-all"><input type="checkbox" checked={item.canPickup} onChange={(e)=>updateFlowerItem(item.id,'canPickup',e.target.checked)} className="w-4 h-4 accent-[#2D4B3E]" /><span className="text-[12px] font-bold">店頭受取</span></label>
                            <label className="flex items-center gap-2 cursor-pointer bg-[#FBFAF9] px-4 py-2 rounded-full border border-[#EAEAEA] has-[:checked]:border-[#2D4B3E] has-[:checked]:bg-[#2D4B3E]/5 shadow-sm transition-all"><input type="checkbox" checked={item.canDelivery} onChange={(e)=>updateFlowerItem(item.id,'canDelivery',e.target.checked)} className="w-4 h-4 accent-[#2D4B3E]" /><span className="text-[12px] font-bold">自社配達</span></label>
                            <label className="flex items-center gap-2 cursor-pointer bg-[#FBFAF9] px-4 py-2 rounded-full border border-[#EAEAEA] has-[:checked]:border-[#2D4B3E] has-[:checked]:bg-[#2D4B3E]/5 shadow-sm transition-all"><input type="checkbox" checked={item.canShipping} onChange={(e)=>updateFlowerItem(item.id,'canShipping',e.target.checked)} className="w-4 h-4 accent-[#2D4B3E]" /><span className="text-[12px] font-bold">業者配送</span></label>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA]">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#2D4B3E]">通常・配達納期</label>
                            <div className="flex items-center gap-1 font-bold text-[15px]"><input type="number" value={item.normalLeadDays} onChange={(e) => updateFlowerItem(item.id, 'normalLeadDays', e.target.value)} className="w-full h-10 bg-white rounded-lg text-center shadow-sm outline-none focus:border focus:border-[#2D4B3E]" /><span>日後</span></div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#2D4B3E]">配送納期</label>
                            <div className="flex items-center gap-1 font-bold text-[15px]"><input type="number" value={item.shippingLeadDays} onChange={(e) => updateFlowerItem(item.id, 'shippingLeadDays', e.target.value)} className="w-full h-10 bg-white rounded-lg text-center shadow-sm outline-none focus:border focus:border-[#2D4B3E]" /><span>日後</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 pt-4">
                        <label className="text-[10px] font-bold text-[#999999] tracking-widest ml-1">持ち込み特別ルール</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className={`p-6 rounded-[24px] border transition-all ${item.canBringFlowers ? 'bg-[#2D4B3E]/5 border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-[13px] font-bold text-[#2D4B3E]">花材(お花)持ち込み</span>
                              <button onClick={() => updateFlowerItem(item.id, 'canBringFlowers', !item.canBringFlowers)} className={`w-12 h-7 rounded-full relative transition-all ${item.canBringFlowers ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${item.canBringFlowers ? 'left-6' : 'left-1'}`}></div></button>
                            </div>
                            {item.canBringFlowers && <div className="flex items-center gap-2 animate-in fade-in"><span className="text-[11px] text-[#2D4B3E] font-bold">最短納期:</span><input type="number" value={item.bringFlowersLeadDays} onChange={(e)=>updateFlowerItem(item.id,'bringFlowersLeadDays',e.target.value)} className="w-16 h-10 bg-white border border-[#EAEAEA] rounded-xl text-center font-bold text-[#2D4B3E] shadow-sm outline-none" /><span className="text-[12px] font-bold text-[#2D4B3E]">日後〜</span></div>}
                          </div>
                          <div className={`p-6 rounded-[24px] border transition-all ${item.canBringVase ? 'bg-[#2D4B3E]/5 border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-[13px] font-bold text-[#2D4B3E]">花器(器)持ち込み</span>
                              <button onClick={() => updateFlowerItem(item.id, 'canBringVase', !item.canBringVase)} className={`w-12 h-7 rounded-full relative transition-all ${item.canBringVase ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${item.canBringVase ? 'left-6' : 'left-1'}`}></div></button>
                            </div>
                            {item.canBringVase && <div className="flex items-center gap-2 animate-in fade-in"><span className="text-[11px] text-[#2D4B3E] font-bold">最短納期:</span><input type="number" value={item.bringVaseLeadDays} onChange={(e)=>updateFlowerItem(item.id,'bringVaseLeadDays',e.target.value)} className="w-16 h-10 bg-white border border-[#EAEAEA] rounded-xl text-center font-bold text-[#2D4B3E] shadow-sm outline-none" /><span className="text-[12px] font-bold text-[#2D4B3E]">日後〜</span></div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addFlowerItem} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] text-[#999999] font-bold rounded-[32px] hover:bg-white hover:border-[#2D4B3E] transition-all text-[12px] tracking-widest">+ 新しいアイテムを追加</button>
              </div>
            </div>
          )}

          {/* 【4】配送・送料 */}
          {activeTab === 'shipping' && (
            <div className="space-y-12 animate-in fade-in duration-700">
               <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">配送・送料管理</h2></header>
               <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-sm space-y-10">
                 
                 <div className="space-y-6">
                   <div className="flex items-center justify-between mb-4 border-b-2 border-[#EAEAEA] pb-2">
                     <h3 className="text-[13px] font-bold text-[#2D4B3E] tracking-widest">自社配達エリア・料金設定</h3>
                     <button onClick={addDeliveryArea} className="px-4 py-1.5 bg-white border border-[#2D4B3E] text-[#2D4B3E] rounded-full text-[10px] font-bold hover:bg-[#2D4B3E] hover:text-white transition-all">+ エリア追加</button>
                   </div>
                   <p className="text-[11px] text-[#999999] mb-4">お客様が入力した住所に「判定キーワード」が含まれていた場合、設定した配達料が適用されます。</p>
                   <div className="space-y-4">
                     {deliveryAreas.length === 0 ? (
                       <p className="text-sm text-[#999999] text-center py-6 bg-[#FBFAF9] rounded-xl border border-dashed border-[#EAEAEA]">エリアが設定されていません</p>
                     ) : (
                       deliveryAreas.map((area) => (
                         <div key={area.id} className="flex flex-wrap items-center gap-4 bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA] relative group">
                           <button onClick={() => removeDeliveryArea(area.id)} className="absolute top-2 right-2 text-[#999999] hover:text-red-500 font-bold px-2 transition-all">×</button>
                           <div className="flex-1 min-w-[150px] space-y-1"><label className="text-[10px] font-bold text-[#999999] ml-1">表示名 (例: 北区エリア)</label><input type="text" value={area.name} onChange={(e) => updateDeliveryArea(area.id, 'name', e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EAEAEA] outline-none font-bold text-[13px] focus:border-[#2D4B3E]" /></div>
                           <div className="flex-[2] min-w-[200px] space-y-1"><label className="text-[10px] font-bold text-[#999999] ml-1">判定キーワード (カンマ区切り)</label><input type="text" placeholder="例: 北区, 東区" value={area.keywords} onChange={(e) => updateDeliveryArea(area.id, 'keywords', e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EAEAEA] outline-none font-bold text-[13px] focus:border-[#2D4B3E]" /></div>
                           <div className="w-32 space-y-1"><label className="text-[10px] font-bold text-[#999999] ml-1">配達料 (円)</label><input type="number" value={area.fee} onChange={(e) => updateDeliveryArea(area.id, 'fee', Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-[#EAEAEA] outline-none font-bold text-[13px] text-right focus:border-[#2D4B3E]" /></div>
                         </div>
                       ))
                     )}
                   </div>
                 </div>

                 <div className="pt-10 border-t border-[#FBFAF9] space-y-10">
                   <h3 className="text-[13px] font-bold text-[#2D4B3E] tracking-widest border-b-2 border-[#EAEAEA] pb-2">送料・箱代の高度な設定 (業者配送用)</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className={`p-6 rounded-[24px] border transition-all ${boxFeeConfig.freeShippingThresholdEnabled ? 'bg-[#2D4B3E]/5 border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[13px] font-bold">送料無料ライン連動</span>
                          <button onClick={() => setBoxFeeConfig({...boxFeeConfig, freeShippingThresholdEnabled: !boxFeeConfig.freeShippingThresholdEnabled})} className={`w-12 h-7 rounded-full relative transition-all ${boxFeeConfig.freeShippingThresholdEnabled ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${boxFeeConfig.freeShippingThresholdEnabled ? 'left-6' : 'left-1'}`}></div></button>
                        </div>
                        {boxFeeConfig.freeShippingThresholdEnabled && (
                          <div className="flex items-center gap-2 animate-in fade-in">
                            <input type="number" value={boxFeeConfig.freeShippingThreshold} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, freeShippingThreshold: Number(e.target.value)})} className="w-28 h-10 bg-white border border-[#EAEAEA] rounded-xl px-3 font-mono font-bold text-[#2D4B3E] outline-none" />
                            <span>円〜無料</span>
                          </div>
                        )}
                     </div>
                     <div className={`p-6 rounded-[24px] border transition-all ${boxFeeConfig.isBundleDiscount ? 'bg-[#2D4B3E]/5 border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <div><span className="text-[13px] font-bold">おまとめ割引</span><p className="text-[10px] text-[#999999]">2点注文でも箱代を1個分にする</p></div>
                          <button onClick={() => setBoxFeeConfig({...boxFeeConfig, isBundleDiscount: !boxFeeConfig.isBundleDiscount})} className={`w-12 h-7 rounded-full relative transition-all ${boxFeeConfig.isBundleDiscount ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${boxFeeConfig.isBundleDiscount ? 'left-6' : 'left-1'}`}></div></button>
                        </div>
                     </div>
                   </div>

                   <div className={`p-8 rounded-[24px] border transition-all ${boxFeeConfig.coolBinEnabled ? 'bg-[#2D4B3E]/5 border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
                      <div className="flex items-center justify-between mb-6">
                        <div><span className="text-[13px] font-bold text-[#2D4B3E]">クール便 加算期間設定</span><p className="text-[10px] text-[#999999] mt-1">指定した期間内の配送注文にクール料金を自動加算します。</p></div>
                        <div className="flex items-center gap-4">
                          <button onClick={addCoolPeriod} className="px-4 py-1.5 bg-white border border-[#2D4B3E] text-[#2D4B3E] rounded-full text-[10px] font-bold hover:bg-[#2D4B3E] hover:text-white transition-all">+ 期間追加</button>
                          <button onClick={() => setBoxFeeConfig({...boxFeeConfig, coolBinEnabled: !boxFeeConfig.coolBinEnabled})} className={`w-12 h-7 rounded-full relative transition-all ${boxFeeConfig.coolBinEnabled ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${boxFeeConfig.coolBinEnabled ? 'left-6' : 'left-1'}`}></div></button>
                        </div>
                      </div>
                      {boxFeeConfig.coolBinEnabled && (
                        <div className="space-y-3 animate-in fade-in">
                          {boxFeeConfig.coolBinPeriods.map((period) => (
                             <div key={period.id} className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-[#EAEAEA]">
                                <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-[#555555]">開始:</span><input type="date" value={`2026-${period.start}`} onChange={(e)=>updateCoolPeriod(period.id, 'start', e.target.value.slice(5))} className="p-1.5 rounded border text-xs font-bold font-mono outline-none" /></div>
                                <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-[#555555]">終了:</span><input type="date" value={`2026-${period.end}`} onChange={(e)=>updateCoolPeriod(period.id, 'end', e.target.value.slice(5))} className="p-1.5 rounded border text-xs font-bold font-mono outline-none" /></div>
                                <input type="text" placeholder="理由メモ (例: お盆・夏季)" value={period.note} onChange={(e)=>updateCoolPeriod(period.id, 'note', e.target.value)} className="flex-1 bg-transparent border-b border-[#EAEAEA] outline-none text-xs px-2" />
                                <button onClick={() => removeCoolPeriod(period.id)} className="text-red-400 font-bold px-2 hover:scale-125 transition-all"><Trash2 size={16}/></button>
                             </div>
                          ))}
                        </div>
                      )}
                   </div>

                   <div className="pt-10 border-t border-[#FBFAF9] space-y-6">
                     <p className="text-[11px] font-bold text-[#999999] tracking-widest text-center">箱代（梱包費用）計算ロジック</p>
                     <div className="flex flex-wrap gap-3 justify-center">
                       {[{id:'flat',l:'一律'},{id:'price_based',l:'花代ベース'},{id:'item_based',l:'アイテム別'}].map(t=>(
                         <button key={t.id} onClick={()=>setBoxFeeConfig({...boxFeeConfig, type: t.id})} className={`px-6 py-2 rounded-full border text-[12px] font-bold transition-all ${boxFeeConfig.type === t.id ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-white text-[#999999] border-[#EAEAEA]'}`}>{t.l}</button>
                       ))}
                     </div>
                     <div className="bg-[#FBFAF9] p-6 rounded-2xl border border-[#EAEAEA]">
                       {boxFeeConfig.type === 'flat' && (
                         <div className="flex items-center justify-center gap-4">
                           <span className="font-bold text-[13px]">一律：</span>
                           <input type="number" value={boxFeeConfig.flatFee} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, flatFee:Number(e.target.value)})} className="w-32 h-10 rounded-lg border px-3 text-right outline-none focus:border-[#2D4B3E]" />
                           <span>円</span>
                         </div>
                       )}
                       {boxFeeConfig.type === 'price_based' && (
                         <div className="space-y-3">
                           {boxFeeConfig.priceTiers.map((tier,i)=>(
                             <div key={i} className="flex items-center gap-4 justify-center text-[13px]">
                               <input type="number" value={tier.minPrice} onChange={(e)=>{const n=[...boxFeeConfig.priceTiers];n[i].minPrice=Number(e.target.value);setBoxFeeConfig({...boxFeeConfig,priceTiers:n})}} className="w-24 h-10 border rounded px-2 outline-none focus:border-[#2D4B3E]" />
                               <span>円以上のとき ➡ 箱代</span>
                               <input type="number" value={tier.fee} onChange={(e)=>{const n=[...boxFeeConfig.priceTiers];n[i].fee=Number(e.target.value);setBoxFeeConfig({...boxFeeConfig,priceTiers:n})}} className="w-24 h-10 border rounded px-2 outline-none focus:border-[#2D4B3E]" />
                               <span>円</span>
                             </div>
                           ))}
                           <button onClick={()=>setBoxFeeConfig({...boxFeeConfig, priceTiers:[...boxFeeConfig.priceTiers, {minPrice:0,fee:0}]})} className="text-[10px] font-bold text-[#2D4B3E] border border-[#2D4B3E] px-3 py-1 rounded-full mx-auto block mt-4">+ 条件追加</button>
                         </div>
                       )}
                       {boxFeeConfig.type === 'item_based' && (
                         <div className="grid grid-cols-2 gap-4">
                           {flowerItems.map(it=>(
                             <div key={it.id} className="bg-white p-3 border border-[#EAEAEA] rounded-xl flex justify-between items-center">
                               <span className="text-[13px] font-bold">{it.name}</span>
                               <div className="flex items-center gap-2">
                                 <input type="number" value={boxFeeConfig.itemFees[it.name]||0} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig,itemFees:{...boxFeeConfig.itemFees,[it.name]:Number(e.target.value)}})} className="w-20 h-8 border rounded text-right px-2 outline-none focus:border-[#2D4B3E]" />
                                 <span className="text-xs">円</span>
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   </div>

                   <div className="overflow-x-auto rounded-2xl border border-[#EAEAEA] shadow-sm">
                     <table className="w-full text-left text-xs border-collapse">
                       <thead>
                         <tr className="bg-[#FBFAF9] border-b border-[#EAEAEA]">
                           <th className="p-4 font-bold text-[#555555]">地方</th>
                           <th className="p-4 font-bold text-[#555555]">都道府県</th>
                           <th className="p-4 font-bold text-[#555555] text-right">基本送料</th>
                           <th className="p-4 font-bold text-[#2D4B3E] text-right">クール便</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-[#F7F7F7]">
                         {shippingRates.map((rate, idx) => (
                           <tr key={idx} className="hover:bg-[#FBFAF9]/50">
                             <td className="p-4 font-bold">{rate.region}</td>
                             <td className="p-4 text-[#999999]">{rate.prefs.join('、')}</td>
                             <td className="p-4"><input type="number" value={rate.fee} onChange={(e)=>updateShippingRate(idx, 'fee', e.target.value)} className="w-full p-2 border rounded-lg text-right font-bold outline-none focus:border-[#2D4B3E]" /></td>
                             <td className="p-4"><input type="number" value={rate.coolFee} onChange={(e)=>updateShippingRate(idx, 'coolFee', e.target.value)} className="w-full p-2 border rounded-lg text-right font-bold text-[#2D4B3E] outline-none focus:border-[#2D4B3E]" /></td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </div>
              </div>
            </div>
          )}

          {/* 【5】立札デザイン */}
          {activeTab === 'rules' && (
            <div className="space-y-12 animate-in fade-in duration-700">
               <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">立札デザイン</h2></header>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    {shops.length === 0 ? (
                      <div className="text-center py-20 bg-white rounded-3xl border border-dashed text-[#999999] text-sm">店舗を先に登録してください</div>
                    ) : (
                      shops.map(shop => (
                        <div key={shop.id} className="bg-white rounded-[24px] border border-[#EAEAEA] p-6 shadow-sm space-y-4 mb-4">
                          <p className="text-[12px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-3 tracking-widest">{shop.name || '未設定店舗'} の使用デザイン</p>
                          <div className="grid grid-cols-1 gap-2">
                            {tateMaster.map(tate => (
                              <div key={tate.id} className="flex items-center gap-2 group">
                                <button onClick={() => toggleTatePattern(shop.id, tate.id)} className={`flex-1 p-4 rounded-xl border text-left transition-all flex items-center justify-between ${shop.enabledTatePatterns.includes(tate.id) ? 'border-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA] bg-white opacity-60'}`}>
                                  <span className="text-[11px] font-bold">{tate.label}</span>
                                  {shop.enabledTatePatterns.includes(tate.id) && <span className="text-[#2D4B3E] text-xs">✓</span>}
                                </button>
                                <button onClick={() => setSelectedPreviewTate(tate)} className="p-4 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA] hover:border-[#2D4B3E] transition-all text-[11px] font-bold text-[#2D4B3E]">
                                  プレビュー
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                 </div>
                 <div className="sticky top-24 h-fit">
                    <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-2xl space-y-6 text-center">
                       <p className="text-[10px] font-bold text-[#999999] tracking-widest text-center">仕上がりプレビュー</p>
                       <div className="flex flex-col items-center gap-4">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold ${selectedPreviewTate.color === 'red' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
                            {selectedPreviewTate.label}
                          </span>
                          <div className={`relative bg-white rounded-sm shadow-xl mx-auto font-serif overflow-hidden w-full flex flex-col items-center border border-[#EAEAEA] ${selectedPreviewTate.layout === 'horizontal' ? 'aspect-[1.414/1] h-[220px] justify-center p-6' : 'aspect-[9/16] h-[360px] pt-8 px-4'}`}>
                             <div className={`font-bold ${selectedPreviewTate.color === 'red' ? 'text-red-600' : 'text-gray-800'} ${selectedPreviewTate.layout === 'horizontal' ? 'text-[28px] mb-4' : 'text-[40px] mb-6 leading-none'}`}>
                               {topPrefixText}
                             </div>
                             
                             <div className={`flex w-full font-bold text-gray-900 ${selectedPreviewTate.layout === 'horizontal' ? 'flex-col items-center gap-2 text-[16px]' : 'flex-row-reverse justify-center gap-6 text-[18px]'}`}>
                                {(selectedPreviewTate.id.includes('p6') || selectedPreviewTate.id.includes('p8')) && (
                                  <>
                                    <div className={`tracking-widest ${selectedPreviewTate.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput2}様</div>
                                    <div className={`tracking-widest ${selectedPreviewTate.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput1}</div>
                                    <div className={`tracking-widest ${selectedPreviewTate.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3}</div>
                                  </>
                                )}
                                {selectedPreviewTate.id.includes('p4') && (
                                  <>
                                    <div className={`tracking-[0.3em] ${selectedPreviewTate.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3a}</div>
                                    <div className={`tracking-[0.3em] font-normal ${selectedPreviewTate.layout === 'horizontal' ? 'mt-4 text-[14px]' : 'mt-6 text-[14px] [writing-mode:vertical-rl]'}`}>{tateInput3b}</div>
                                  </>
                                )}
                                {(!selectedPreviewTate.id.includes('p6') && !selectedPreviewTate.id.includes('p8') && !selectedPreviewTate.id.includes('p4')) && (
                                  <>
                                    <div className={`tracking-widest ${selectedPreviewTate.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput1}</div>
                                    <div className={`tracking-widest ${selectedPreviewTate.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3}</div>
                                  </>
                                )}
                             </div>

                          </div>
                       </div>
                    </div>
                 </div>
               </div>
            </div>
          )}

          {/* 【6】店舗注文受付（代理入力） */}
          {activeTab === 'staff_order' && (
            <div className="space-y-12 animate-in fade-in duration-700">
               <header className="px-2 border-l-4 border-[#2D4B3E] mb-10">
                 <h2 className="text-[24px] font-bold text-[#2D4B3E]">店舗注文受付ルール</h2>
                 <p className="text-[13px] text-[#555555] mt-2">電話や店頭での注文をスタッフが代理入力する際の、特別なルールを設定します。</p>
               </header>
               <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-sm space-y-10">
                 <div className="space-y-6">
                   <h3 className="text-[13px] font-bold text-[#2D4B3E] tracking-widest border-b border-[#EAEAEA] pb-2">入力制限の解除</h3>
                   <div className={`p-6 rounded-[24px] border transition-all ${staffOrderConfig.ignoreLeadTime ? 'bg-[#2D4B3E]/5 border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
                      <div className="flex items-center justify-between">
                        <div><span className="text-[13px] font-bold">最短納期の制限を無効にする</span><p className="text-[10px] text-[#999999] mt-1">オンにすると、本日や明日の日付もカレンダーから選択できるようになります。</p></div>
                        <button onClick={() => setStaffOrderConfig({...staffOrderConfig, ignoreLeadTime: !staffOrderConfig.ignoreLeadTime})} className={`w-12 h-7 rounded-full relative transition-all ${staffOrderConfig.ignoreLeadTime ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${staffOrderConfig.ignoreLeadTime ? 'left-6' : 'left-1'}`}></div></button>
                      </div>
                   </div>
                   <div className={`p-6 rounded-[24px] border transition-all ${staffOrderConfig.allowCustomPrice ? 'bg-[#2D4B3E]/5 border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
                      <div className="flex items-center justify-between">
                        <div><span className="text-[13px] font-bold">金額の自由入力を許可する</span><p className="text-[10px] text-[#999999] mt-1">オンにすると、選択肢以外の任意の金額を直接入力できるようになります。</p></div>
                        <button onClick={() => setStaffOrderConfig({...staffOrderConfig, allowCustomPrice: !staffOrderConfig.allowCustomPrice})} className={`w-12 h-7 rounded-full relative transition-all ${staffOrderConfig.allowCustomPrice ? 'bg-[#2D4B3E]' : 'bg-[#D1D1D1]'}`}><div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${staffOrderConfig.allowCustomPrice ? 'left-6' : 'left-1'}`}></div></button>
                      </div>
                   </div>
                 </div>
                 <div className="pt-10 border-t border-[#FBFAF9] space-y-6">
                   <h3 className="text-[13px] font-bold text-[#2D4B3E] tracking-widest border-b border-[#EAEAEA] pb-2">支払い・決済ステータス（社内メモ用）</h3>
                   <p className="text-[11px] text-[#999999] mb-4">スタッフ用フォームで選択できる「支払方法」の項目を設定します。（カンマ区切りで入力）</p>
                   <input type="text" value={(staffOrderConfig.paymentMethods || []).join(', ')} onChange={(e) => setStaffOrderConfig({...staffOrderConfig, paymentMethods: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})} className="w-full h-14 px-6 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none font-bold text-[13px] focus:bg-white focus:border-[#2D4B3E]" placeholder="例: 店頭支払い(済), 銀行振込(請求書), 代金引換" />
                 </div>
               </div>
            </div>
          )}

          {/* 【7】スタッフ管理 */}
          {activeTab === 'staff' && (
            <div className="space-y-12 animate-in fade-in px-2 text-left">
               <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">スタッフ管理</h2></header>
               <div className="bg-white rounded-[24px] border border-[#EAEAEA] overflow-hidden shadow-sm">
                 <table className="w-full text-left">
                   <thead><tr className="bg-[#FBFAF9] border-b border-[#EAEAEA] text-[10px] font-black text-[#999999] tracking-widest"><th className="px-8 py-5">スタッフ名</th><th className="px-8 py-5">所属店舗</th><th className="px-8 py-5 w-24 text-right">操作</th></tr></thead>
                   <tbody className="divide-y divide-[#F7F7F7]">
                     {staffList.length === 0 ? (<tr><td colSpan="3" className="px-8 py-12 text-center text-[#999999] text-sm">登録スタッフはいません</td></tr>) : (
                       staffList.map((staff) => (
                         <tr key={staff.id} className="hover:bg-[#FBFAF9] transition-all">
                           <td className="px-8 py-5 text-[14px] font-bold">{staff.name}</td>
                           <td className="px-8 py-5"><span className="px-3 py-1 bg-[#2D4B3E]/5 text-[#2D4B3E] text-[11px] font-bold rounded-full">{staff.stores.includes('all') ? '全店舗共通' : shops.find(s => s.id === staff.stores[0])?.name || staff.stores[0]}</span></td>
                           <td className="px-8 py-5 text-right"><button onClick={() => setStaffList(staffList.filter(s => s.id !== staff.id))} className="text-red-400 hover:text-red-600 font-bold text-[10px] bg-red-50 px-3 py-1.5 rounded-lg transition-all">削除</button></td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
               <div className="flex flex-col md:flex-row gap-3 bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm">
                 <input type="text" placeholder="名前を入力" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} className="flex-1 h-14 px-6 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none text-[14px] font-bold focus:border-[#2D4B3E]" />
                 <select value={newStaffStore} onChange={(e) => setNewStaffStore(e.target.value)} className="h-14 px-6 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none text-[13px] font-bold focus:border-[#2D4B3E]">
                   <option value="all">全店舗 (共通)</option>
                   {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
                 </select>
                 <button onClick={addStaff} className="h-14 bg-[#2D4B3E] text-white px-10 rounded-xl font-bold text-[13px] shadow-md hover:bg-[#1f352b] transition-all">追加</button>
               </div>
            </div>
          )}

          {/* 【8】通知メール */}
          {activeTab === 'message' && (
            <div className="space-y-12 animate-in fade-in duration-700">
               <header className="px-2 border-l-4 border-[#2D4B3E] mb-10">
                 <h2 className="text-[24px] font-bold text-[#2D4B3E]">自動返信メール</h2>
                 <p className="text-[13px] text-[#555555] mt-2">注文完了時にお客様へ自動送信されるメールの内容を設定します。</p>
               </header>
               <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-sm space-y-10">
                 <div className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA]">
                    <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest mb-4">利用可能な埋め込みタグ</p>
                    <div className="flex flex-wrap gap-2">
                       {['{ShopName}', '{CustomerName}', '{OrderDetails}', '{ShopPhone}', '{ShopAddress}'].map(tag => (
                          <span key={tag} className="px-3 py-1.5 bg-white border border-[#EAEAEA] rounded-lg text-[11px] font-mono text-[#555555] shadow-sm">{tag}</span>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-8">
                    <div className="space-y-2">
                       <label className="text-[11px] font-bold text-[#999999] tracking-widest ml-1">メール件名</label>
                       <input type="text" placeholder="例：ご注文ありがとうございます" value={autoReply.subject || ''} onChange={(e) => setAutoReply({...autoReply, subject: e.target.value})} className="w-full h-14 px-6 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] transition-all font-bold" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-bold text-[#999999] tracking-widest ml-1">メール本文</label>
                       <textarea value={autoReply.body || ''} onChange={(e) => setAutoReply({...autoReply, body: e.target.value})} className="w-full h-[400px] p-8 bg-[#FBFAF9] border border-[#EAEAEA] rounded-[32px] outline-none focus:bg-white focus:border-[#2D4B3E] transition-all text-[13px] leading-relaxed resize-none" />
                    </div>
                 </div>
               </div>
            </div>
          )}
          <div className="h-40"></div>
        </div>
      </main>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; }`}</style>
    </>
  );
}