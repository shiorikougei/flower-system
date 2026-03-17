'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Settings as SettingsIcon, ListChecks, Store, Tag, Truck, User, Mail, 
  Trash2, Plus, Clock, ShieldCheck, RotateCcw, Image as ImageIcon, Ruler, 
  ChevronRight, Calendar as CalendarIcon, Box, MapPin, X,
  LayoutTemplate, Package, Eye, EyeOff, Sparkles, AlertCircle, Link as LinkIcon
} from 'lucide-react';

import TatefudaPreview from '@/components/TatefudaPreview';

const SETTINGS_CACHE_KEY = 'florix_app_settings_cache';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 

  // --- 1. 基本設定 ---
  const [generalConfig, setGeneralConfig] = useState({ 
    appName: 'FLORIX', logoUrl: '', logoSize: 100, logoTransparent: false, slipBgUrl: '', slipBgOpacity: 50, systemPassword: '7777'
  });

  // --- 2. ステータス設定 ---
  const [statusConfig, setStatusConfig] = useState({ type: 'template', customLabels: ['未対応', '制作中', '制作完了', '配達中'] });

  // --- 3. 店舗管理 ---
  const [shops, setShops] = useState([]); 

  // --- 4. 商品管理 ---
  const [flowerItems, setFlowerItems] = useState([]);

  // --- 5. 配送・送料 ---
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [shippingSizes, setShippingSizes] = useState(['80', '100', '120']);
  const [shippingRates, setShippingRates] = useState([]); 
  const [boxFeeConfig, setBoxFeeConfig] = useState({ 
    type: 'flat', flatFee: 500, priceTiers: [{ minPrice: 0, fee: 300 }, { minPrice: 10000, fee: 0 }], itemFees: {},
    returnFeeType: 'flat', returnFeeValue: 1000, coolBinEnabled: true, coolBinPeriods: [],
    freeShippingThresholdEnabled: false, freeShippingThreshold: 15000, isBundleDiscount: true
  });
  
  const [timeSlots, setTimeSlots] = useState({
    pickup: ['10:00-12:00', '12:00-15:00', '15:00-18:00'],
    delivery: ['9:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
    shipping: ['午前中', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
  });

  // --- 6. 立札デザインマスター ---
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

  // --- 7. その他 ---
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffStore, setNewStaffStore] = useState('all');
  const [staffOrderConfig, setStaffOrderConfig] = useState({ ignoreLeadTime: true, allowCustomPrice: true, paymentMethods: ['店頭支払い(済)', '銀行振込(請求書)', '代金引換'], sendAutoReply: false });
  
  const [autoReplyTemplates, setAutoReplyTemplates] = useState([
    { id: 't1', trigger: '注文受付時', subject: 'ご注文ありがとうございます', body: '{CustomerName} 様\n\nご注文ありがとうございます。' }
  ]);

  // ★ URL・リンク発行タブを追加
  const tabs = [
    { id: 'general', label: '基本設定', icon: SettingsIcon },
    { id: 'status', label: 'ステータス', icon: ListChecks },
    { id: 'shop', label: '店舗・特別日', icon: Store }, 
    { id: 'items', label: '商品・納期', icon: Tag },
    { id: 'shipping', label: '配送・時間枠', icon: Truck },
    { id: 'rules', label: '立札デザイン', icon: LayoutTemplate },
    { id: 'staff_order', label: '店舗受付', icon: Clock },
    { id: 'staff', label: 'スタッフ', icon: User },
    { id: 'message', label: '通知メール', icon: Mail },
    { id: 'links', label: 'URL発行', icon: LinkIcon }, 
  ];

  const applySettings = (s) => {
    if (s.generalConfig) setGeneralConfig(prev => ({...prev, ...s.generalConfig}));
    if (s.statusConfig) setStatusConfig(s.statusConfig);
    if (s.shops) setShops(s.shops);
    if (s.flowerItems) setFlowerItems(s.flowerItems);
    if (s.staffList) setStaffList(s.staffList);
    if (s.deliveryAreas) setDeliveryAreas(s.deliveryAreas);
    if (s.shippingSizes) setShippingSizes(s.shippingSizes);
    if (s.shippingRates) setShippingRates(s.shippingRates);
    if (s.boxFeeConfig) setBoxFeeConfig(prev => ({...prev, ...s.boxFeeConfig}));
    if (s.staffOrderConfig) setStaffOrderConfig(s.staffOrderConfig);
    if (s.autoReplyTemplates) setAutoReplyTemplates(s.autoReplyTemplates);
    if (s.timeSlots) setTimeSlots(s.timeSlots);
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const cached = sessionStorage.getItem(SETTINGS_CACHE_KEY);
        if (cached) { applySettings(JSON.parse(cached)); }
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data?.settings_data) {
          applySettings(data.settings_data);
          sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data.settings_data));
        }
      } catch (e) { console.error('読込失敗', e); }
    }
    loadSettings();
  }, []);

  const handleLogin = () => {
    const correctPassword = generalConfig.systemPassword || '7777';
    if (adminPassword === correctPassword) setIsAdmin(true);
    else alert('パスワードが違います');
  };

  const saveSettings = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const payload = { generalConfig, statusConfig, shops, flowerItems, staffList, deliveryAreas, shippingSizes, shippingRates, boxFeeConfig, autoReplyTemplates, staffOrderConfig, timeSlots };
      await supabase.from('app_settings').upsert({ id: 'default', settings_data: payload });
      sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(payload));
      alert('すべての設定を保存しました！');
    } catch (e) { alert('保存失敗'); } finally { setIsSaving(false); }
  };

  const handleImg = (e, f) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => setGeneralConfig({ ...generalConfig, [f]: ev.target.result });
    r.readAsDataURL(file);
  };

  const handleTimeSlotChange = (method, index, value) => {
    setTimeSlots(prev => {
      const newSlots = { ...prev };
      newSlots[method][index] = value;
      return newSlots;
    });
  };
  const addTimeSlot = (method) => { setTimeSlots(prev => ({ ...prev, [method]: [...prev[method], ''] })); };
  const removeTimeSlot = (method, index) => { setTimeSlots(prev => ({ ...prev, [method]: prev[method].filter((_, i) => i !== index) })); };

  // --- タブ：基本設定 ---
  const renderGeneralTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-8 animate-in fade-in">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><ImageIcon size={20}/> 基本情報・ロゴ・伝票</h2>
      <div className="space-y-6">
        
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-[#999999]">アプリ名</label>
          <input 
            type="text" 
            value={generalConfig.appName} 
            onChange={(e)=>setGeneralConfig({...generalConfig, appName: e.target.value})} 
            className="w-full h-12 bg-[#FBFAF9] border rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E] transition-colors"
          />
        </div>
        
        <div className="space-y-4 pt-4 border-t border-[#EAEAEA]">
          <label className="text-[11px] font-bold text-[#999999]">ロゴ画像</label>
          {!generalConfig.logoUrl && <input type="file" accept="image/*" onChange={(e)=>handleImg(e, 'logoUrl')} className="block w-full text-xs" />}
          {generalConfig.logoUrl && (
            <div className="p-6 bg-[#FBFAF9] rounded-2xl border space-y-6 relative">
              <button onClick={() => setGeneralConfig({...generalConfig, logoUrl: ''})} className="absolute top-4 right-4 text-red-400 hover:text-red-600 bg-white p-2 rounded-full shadow-sm transition-colors"><Trash2 size={16}/></button>
              <div className="flex items-center justify-between"><span className="text-[12px] font-bold">表示サイズ: {generalConfig.logoSize}%</span><input type="range" min="30" max="150" value={generalConfig.logoSize} onChange={(e)=>setGeneralConfig({...generalConfig, logoSize: Number(e.target.value)})} className="w-40 accent-[#2D4B3E]"/></div>
              <div className="flex items-center justify-between"><span className="text-[12px] font-bold">白背景を透過</span><button onClick={()=>setGeneralConfig({...generalConfig, logoTransparent: !generalConfig.logoTransparent})} className={`w-12 h-6 rounded-full transition-all ${generalConfig.logoTransparent ? 'bg-[#2D4B3E]' : 'bg-gray-300'}`}><div className={`w-4 h-4 bg-white rounded-full mx-1 transition-all ${generalConfig.logoTransparent ? 'translate-x-6' : ''}`}/></button></div>
              <div className="flex justify-center border-t pt-4 bg-white rounded-xl p-4"><img src={generalConfig.logoUrl} style={{width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal'}} className="max-h-24 object-contain" /></div>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-4 border-t border-[#EAEAEA]">
          <label className="text-[11px] font-bold text-[#999999]">伝票用 背景画像</label>
          {!generalConfig.slipBgUrl && <input type="file" accept="image/*" onChange={(e)=>handleImg(e, 'slipBgUrl')} className="block w-full text-xs" />}
          {generalConfig.slipBgUrl && (
            <div className="p-6 bg-[#FBFAF9] rounded-2xl border space-y-6 relative">
              <button onClick={() => setGeneralConfig({...generalConfig, slipBgUrl: ''})} className="absolute top-4 right-4 text-red-400 hover:text-red-600 bg-white p-2 rounded-full shadow-sm"><Trash2 size={16}/></button>
              <div className="flex items-center justify-between"><span className="text-[12px] font-bold">透過度: {generalConfig.slipBgOpacity}%</span><input type="range" min="0" max="100" value={generalConfig.slipBgOpacity} onChange={(e)=>setGeneralConfig({...generalConfig, slipBgOpacity: Number(e.target.value)})} className="w-40 accent-[#2D4B3E]"/></div>
              <div className="flex justify-center border-t pt-4"><div className="relative w-48 h-32 bg-white border shadow-sm overflow-hidden flex flex-col justify-between p-2"><div className="absolute inset-0 z-0 grayscale-[30%] pointer-events-none" style={{ backgroundImage: `url(${generalConfig.slipBgUrl})`, backgroundSize: 'cover', opacity: generalConfig.slipBgOpacity / 100 }} /><span className="relative z-10 text-[10px] font-bold text-green-700">受 注 書</span></div></div>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-6 border-t border-[#EAEAEA]">
          <h3 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><ShieldCheck size={16}/> システムセキュリティ</h3>
          <div className="bg-red-50 p-6 rounded-2xl border border-red-100 space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-red-800">管理者パスワード (設定変更・注文削除用)</label>
              <div className="relative w-full max-w-[240px]">
                <input type={showPassword ? "text" : "password"} value={generalConfig.systemPassword || ''} onChange={(e)=>setGeneralConfig({...generalConfig, systemPassword: e.target.value})} className="w-full h-12 bg-white border border-red-200 rounded-xl px-4 font-bold outline-none focus:border-red-400 text-red-700 tracking-widest pr-10"/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600">
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // --- タブ：ステータス ---
  const renderStatusTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-6 animate-in fade-in">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><ListChecks size={20}/> 受注ステータス管理</h2>
      <div className="flex gap-2 p-1 bg-[#F7F7F7] rounded-xl mb-4">
        {['template', 'custom'].map(t => (
          <button key={t} onClick={() => setStatusConfig({...statusConfig, type: t})} className={`flex-1 py-3 rounded-lg font-bold text-[12px] ${statusConfig.type === t ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>{t === 'template' ? '標準' : 'カスタム'}</button>
        ))}
      </div>
      <div className="space-y-3">
        {(statusConfig.type === 'template' ? ['未対応', '制作中', '制作完了', '配達中'] : statusConfig.customLabels).map((l, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={l} readOnly={statusConfig.type==='template'} onChange={(e) => { if(statusConfig.type==='custom'){ const n = [...statusConfig.customLabels]; n[i] = e.target.value; setStatusConfig({...statusConfig, customLabels: n}); } }} className={`flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none ${statusConfig.type==='template'?'text-[#999999] cursor-not-allowed':'focus:border-[#2D4B3E]'}`} />
            {statusConfig.type === 'custom' && <button onClick={() => setStatusConfig({...statusConfig, customLabels: statusConfig.customLabels.filter((_, idx) => idx !== i)})} className="text-red-300 p-2 hover:text-red-500"><Trash2 size={18}/></button>}
          </div>
        ))}
        {statusConfig.type === 'custom' && <button onClick={() => setStatusConfig({...statusConfig, customLabels: [...statusConfig.customLabels, '新状態']})} className="w-full py-3 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 項目を追加</button>}
      </div>
    </div>
  );

  // --- 特別日・営業時間のレンダリング補助 ---
  const renderSpecialHoursList = (shop, listKey) => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
      {(shop[listKey] || []).map(sh => (
        <div key={sh.id} className="flex flex-col gap-2 bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA] text-[11px] relative">
          <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].filter(h=>h.id!==sh.id)}:s))} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><X size={14}/></button>
          <div className="flex gap-2 pr-6">
            <select value={sh.repeatType || '今年のみ'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, repeatType:e.target.value}:h)}:s))} className="border rounded p-1.5 outline-none font-bold bg-white">
              <option value="今年のみ">単日</option><option value="毎週">毎週</option><option value="毎月">毎月</option><option value="毎年">毎年</option><option value="祝日">祝日</option>
            </select>
            {sh.repeatType !== '祝日' && (
              <div className="flex-1">
                {sh.repeatType === '毎週' ? (
                  <select value={sh.date} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, date:e.target.value}:h)}:s))} className="w-full border rounded p-1.5 outline-none bg-white">
                    <option value="">曜日を選択</option><option value="日">日曜日</option><option value="月">月曜日</option><option value="火">火曜日</option><option value="水">水曜日</option><option value="木">木曜日</option><option value="金">金曜日</option><option value="土">土曜日</option>
                  </select>
                ) : sh.repeatType === '毎月' ? (
                  <select value={sh.date} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, date:e.target.value}:h)}:s))} className="w-full border rounded p-1.5 outline-none bg-white">
                    <option value="">日付を選択</option>{[...Array(31)].map((_, i) => <option key={i} value={`${i+1}日`}>{i+1}日</option>)}
                  </select>
                ) : <input type={sh.repeatType==='毎年' ? 'text' : 'date'} placeholder="MM-DD" value={sh.date} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, date:e.target.value}:h)}:s))} className="w-full border rounded p-1.5 outline-none bg-white"/>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <select value={sh.type || 'closed'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, type:e.target.value}:h)}:s))} className={`border rounded p-1.5 outline-none font-bold ${sh.type === 'closed' ? 'bg-red-50 text-red-600' : sh.type === 'changed' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
              <option value="closed">休業</option><option value="changed">時間変更</option><option value="open">特別営業</option>
            </select>
            <input type="text" placeholder="理由メモ" value={sh.note || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, note:e.target.value}:h)}:s))} className="flex-1 border rounded p-1.5 outline-none bg-white"/>
          </div>
          {sh.type === 'changed' && (
            <div className="flex gap-2 items-center bg-white p-2 rounded border border-orange-200 mt-1 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-orange-600">変更後:</span>
              <input type="time" value={sh.changedOpenTime || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, changedOpenTime:e.target.value}:h)}:s))} className="border rounded p-1 text-[10px] outline-none"/>
              <span>〜</span>
              <input type="time" value={sh.changedCloseTime || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, changedCloseTime:e.target.value}:h)}:s))} className="border rounded p-1 text-[10px] outline-none"/>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // --- タブ：店舗管理 ---
  const renderShopTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {shops.map(shop => (
        <div key={shop.id} className="bg-white rounded-[32px] border p-8 shadow-sm relative space-y-8 text-left">
          <button onClick={()=>setShops(shops.filter(s=>s.id!==shop.id))} className="absolute top-6 right-6 p-2 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
          
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={shop.isActive} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, isActive:e.target.checked}:s))} className="w-6 h-6 accent-[#2D4B3E]"/>
            <h2 className="text-[18px] font-bold text-[#2D4B3E]">{shop.name || '店舗設定'}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">店舗名</label><input type="text" value={shop.name} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, name:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">電話番号</label><input type="text" value={shop.phone} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, phone:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">郵便番号</label><input type="text" value={shop.zip} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, zip:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="000-0000"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">住所</label><input type="text" value={shop.address} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, address:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-[#999999]">インボイス番号</label><input type="text" value={shop.invoiceNumber || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, invoiceNumber:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="T12345..."/></div>
          </div>
          
          <div className="space-y-1 border-t pt-4 border-[#EAEAEA]">
            <label className="text-[10px] font-bold text-[#999999]">振込先口座情報</label>
            <textarea value={shop.bankInfo || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, bankInfo:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-3 text-[12px] outline-none resize-none focus:border-[#2D4B3E]" placeholder="銀行名 支店名..."/>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-[#FBFAF9]">
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={14}/> 店舗(ご来店) 営業時間・特別日</label>
              <div className="flex gap-2 bg-[#FBFAF9] p-3 rounded-xl border mb-2">
                <input type="time" value={shop.openTime || '10:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, openTime:e.target.value}:s))} className="border rounded p-1 text-xs outline-none bg-white"/>
                <span>〜</span>
                <input type="time" value={shop.closeTime || '19:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, closeTime:e.target.value}:s))} className="border rounded p-1 text-xs outline-none bg-white"/>
              </div>
              {renderSpecialHoursList(shop, 'specialHours')}
              <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:[...(s.specialHours||[]), {id:Date.now(), date:'', type:'closed', repeatType:'今年のみ', note:''}]}:s))} className="w-full py-2 bg-[#FBFAF9] border-dashed border border-[#EAEAEA] rounded-xl text-[10px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 特別ルールを追加</button>
            </div>
            
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#D97C8F] flex items-center gap-2"><Truck size={14}/> 配達可能時間・特別日</label>
              <div className="flex gap-2 bg-[#D97C8F]/5 p-3 rounded-xl border border-[#D97C8F]/20 mb-2">
                <input type="time" value={shop.deliveryOpenTime || '11:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryOpenTime:e.target.value}:s))} className="border border-[#D97C8F]/30 rounded p-1 text-xs outline-none bg-white"/>
                <span>〜</span>
                <input type="time" value={shop.deliveryCloseTime || '18:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryCloseTime:e.target.value}:s))} className="border border-[#D97C8F]/30 rounded p-1 text-xs outline-none bg-white"/>
              </div>
              {renderSpecialHoursList(shop, 'deliverySpecialHours')}
              <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:[...(s.deliverySpecialHours||[]), {id:Date.now(), date:'', type:'closed', repeatType:'今年のみ', note:''}]}:s))} className="w-full py-2 bg-[#D97C8F]/5 border-dashed border border-[#D97C8F]/30 rounded-xl text-[10px] font-bold text-[#D97C8F]/80 hover:text-[#D97C8F] transition-all">+ 配達特別ルールを追加</button>
            </div>
          </div>

          {/* ★ 置き配・注意事項の設定 */}
          <div className="pt-6 border-t border-[#FBFAF9] space-y-4">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><AlertCircle size={16}/> 注意書き・ご案内テキスト設定</h3>
            <p className="text-[10px] text-[#999999]">お客様のオーダー画面で表示される、各受取方法ごとの注意書きを店舗別に設定できます。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#999999]">店頭受取のご案内</label>
                <textarea value={shop.pickupNote ?? 'ご来店予定日時に店舗までお越しください。'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, pickupNote:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-3 text-[12px] outline-none resize-none focus:border-[#2D4B3E]"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#999999]">自社配達のご案内</label>
                <textarea value={shop.deliveryNote ?? '交通状況により配達時間が前後する場合がございます。'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryNote:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-3 text-[12px] outline-none resize-none focus:border-[#2D4B3E]"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#999999]">業者配送のご案内</label>
                <textarea value={shop.shippingNote ?? '発送準備期間＋配送日数がかかります。交通状況により遅延する場合がございます。'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, shippingNote:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-3 text-[12px] outline-none resize-none focus:border-[#2D4B3E]"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#999999]">置き配に関するご案内 (自社配達時)</label>
                <textarea value={shop.absenceInstruction ?? '生花のため、ご不在時は原則として置き配または宅配ボックスへのお届けとなります。ご希望の対応をお選びください。'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, absenceInstruction:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-3 text-[12px] outline-none resize-none focus:border-[#2D4B3E]"/>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button 
        onClick={()=>setShops([...shops, {
          id:Date.now(), name:'', isActive:true, openTime:'10:00', closeTime:'19:00', deliveryOpenTime:'11:00', deliveryCloseTime:'18:00', 
          specialHours:[], deliverySpecialHours:[], enabledTatePatterns: ['p5', 'p7'],
          pickupNote: 'ご来店予定日時に店舗までお越しください。', deliveryNote: '交通状況により配達時間が前後する場合がございます。', shippingNote: '発送準備期間＋配送日数がかかります。交通状況により遅延する場合がございます。',
          absenceInstruction: '生花のため、ご不在時は原則として置き配または宅配ボックスへのお届けとなります。ご希望の対応をお選びください。'
        }])} 
        className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold transition-all hover:border-[#2D4B3E] shadow-sm"
      >
        + 店舗を新規追加
      </button>
    </div>
  );

  // --- タブ：商品管理 ---
  const renderItemsTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {flowerItems.map(item => {
        const isAllShops = item.targetShops === 'all' || item.targetShops === undefined;

        return (
          <div key={item.id} className="bg-white rounded-[32px] border p-8 shadow-sm relative space-y-6 text-left">
            <button onClick={()=>setFlowerItems(flowerItems.filter(i=>i.id!==item.id))} className="absolute top-6 right-6 p-2 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10 md:pr-14 pt-2">
              <input type="text" value={item.name} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, name:e.target.value}:i))} className="w-full h-12 bg-transparent border-b-2 text-[20px] font-bold outline-none focus:border-[#2D4B3E] transition-all" placeholder="商品名" />
              <div className="flex items-center gap-2 justify-start md:justify-end">
                <span className="text-[11px] font-bold text-[#999999]">配送サイズ (箱):</span>
                <select value={item.defaultBoxSize || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, defaultBoxSize:e.target.value}:i))} className="h-10 bg-[#FBFAF9] border rounded-xl px-3 font-bold text-[13px] outline-none focus:border-[#2D4B3E]">
                  <option value="">未設定</option>
                  {shippingSizes.map(s => <option key={s} value={s}>{s}サイズ</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 mt-2">
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">最低注文料金 (税抜)</label><input type="number" value={item.minPrice || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, minPrice:Number(e.target.value)}:i))} className="w-full h-10 bg-[#FBFAF9] border rounded-xl px-3 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="例: 3000"/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">最大注文料金 (税抜)</label><input type="number" value={item.maxPrice || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, maxPrice:Number(e.target.value)}:i))} className="w-full h-10 bg-[#FBFAF9] border rounded-xl px-3 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="例: 50000"/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">金額の刻み幅</label><input type="number" value={item.stepPrice || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, stepPrice:Number(e.target.value)}:i))} className="w-full h-10 bg-[#FBFAF9] border rounded-xl px-3 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="例: 1000"/></div>
            </div>

            <div className="pt-4 pb-2 border-t border-[#FBFAF9] mt-2">
              <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between mb-3">
                <p className="text-[12px] font-bold text-[#2D4B3E] flex items-center gap-2"><MapPin size={16}/> 取扱店舗</p>
                <div className="flex gap-2 p-1 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA] w-fit">
                  <button onClick={() => setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, targetShops: 'all'}:i))} className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${isAllShops ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>全店舗</button>
                  <button onClick={() => setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, targetShops: Array.isArray(i.targetShops) ? i.targetShops : []}:i))} className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${!isAllShops ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>指定店舗のみ</button>
                </div>
              </div>
              {!isAllShops && (
                <div className="flex flex-wrap gap-3 mt-2 p-4 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] animate-in slide-in-from-top-2">
                  {shops.length === 0 ? <p className="text-[11px] text-[#999999]">店舗が登録されていません</p> : shops.map(shop => {
                    const isChecked = Array.isArray(item.targetShops) && item.targetShops.includes(shop.id);
                    return (
                      <label key={shop.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-white border-[#2D4B3E]/30 text-[#2D4B3E] shadow-sm' : 'bg-transparent border-transparent text-[#999999] hover:bg-white'}`}>
                        <input type="checkbox" checked={isChecked} onChange={(e)=>{const current = Array.isArray(item.targetShops) ? item.targetShops : []; const next = e.target.checked ? [...current, shop.id] : current.filter(id => id !== shop.id); setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, targetShops: next}:i));}} className="accent-[#2D4B3E] w-3.5 h-3.5"/>
                        <span className="text-[11px] font-bold">{shop.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 pb-2 border-t border-[#FBFAF9]">
              <p className="text-[12px] font-bold text-[#2D4B3E] mb-3 flex items-center gap-2"><Store size={16}/> 対応可能な受取方法</p>
              <div className="flex flex-wrap gap-3">
                {['canPickup', 'canDelivery', 'canShipping'].map(key => (
                  <label key={key} className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all ${item[key] !== false ? 'bg-[#FBFAF9] border-[#2D4B3E]/30 text-[#2D4B3E]' : 'bg-white border-[#EAEAEA] text-[#999999]'}`}>
                    <input type="checkbox" checked={item[key] !== false} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key]:e.target.checked}:i))} className="accent-[#2D4B3E] w-4 h-4"/>
                    <span className="text-[12px] font-bold">{key==='canPickup'?'店頭受取':key==='canDelivery'?'自社配達':'業者配送'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-[#FBFAF9] pt-6">
              <div className="space-y-4">
                <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={16}/> 納期設定</p>
                <div className="space-y-2"><label className="text-[9px] font-bold text-[#999999]">通常納期 (日後)</label><input type="number" value={item.normalLeadDays} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, normalLeadDays:Number(e.target.value)}:i))} className="w-full bg-[#FBFAF9] border rounded-lg h-10 px-3 font-bold outline-none focus:border-[#2D4B3E]"/></div>
                <div className="space-y-2"><label className="text-[9px] font-bold text-[#999999]">業者配送 発送準備(日)</label><input type="number" value={item.shippingLeadDays} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, shippingLeadDays:Number(e.target.value)}:i))} className="w-full bg-[#FBFAF9] border rounded-lg h-10 px-3 font-bold outline-none focus:border-[#2D4B3E]"/></div>
              </div>
              <div className="space-y-4 px-4 border-l border-r border-[#FBFAF9]">
                <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><ShieldCheck size={16}/> 持込設定</p>
                {['canBringFlowers', 'canBringVase'].map(key => (
                  <div key={key} className="bg-[#FBFAF9] p-3 rounded-xl border space-y-2">
                    <label className="flex items-center justify-between text-[12px] font-bold">{key==='canBringFlowers'?'花材持込':'花器持込'}<input type="checkbox" checked={item[key]} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key]:e.target.checked}:i))} className="accent-[#2D4B3E] w-4 h-4"/></label>
                    {item[key] && <div className="flex items-center justify-between text-[10px] font-bold text-[#555555]"><span>持込時納期</span><div className="flex items-center gap-1"><input type="number" value={item[key+'LeadDays']||7} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key+'LeadDays']:Number(e.target.value)}:i))} className="w-10 border rounded text-center h-8 font-black"/>日後</div></div>}
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><RotateCcw size={16}/> 器の回収/返却</p>
                <div className="bg-[#FBFAF9] p-3 rounded-xl border space-y-3">
                  <label className="flex items-center justify-between text-[12px] font-bold cursor-pointer">器の回収を必要とする<input type="checkbox" checked={item.hasReturn} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, hasReturn:e.target.checked}:i))} className="accent-[#2D4B3E] w-5 h-5"/></label>
                  <p className="text-[9px] text-[#999999] leading-tight font-bold">※注文時に「器返却あり」の送料計算を自動で有効化します。</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={()=>setFlowerItems([...flowerItems, {id:Date.now(), name:'', targetShops: 'all', normalLeadDays:2, shippingLeadDays:3, canBringFlowers:false, hasReturn:false, canPickup:true, canDelivery:true, canShipping:true, minPrice:3000, maxPrice:50000, stepPrice:1000}])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold transition-all hover:border-[#2D4B3E]">+ 商品を追加</button>
    </div>
  );

  // --- タブ：配送・送料・時間枠 ---
  const renderShippingTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-10 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] border-b pb-4 flex items-center gap-2"><Truck size={20}/> 配送・送料・時間枠</h2>
      <section className="space-y-6">
        <label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={16}/> 受取・配達の時間枠</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['pickup', 'delivery', 'shipping'].map(method => (
            <div key={method} className={`p-4 rounded-2xl border ${method==='pickup'?'bg-orange-50/50 border-orange-200':method==='delivery'?'bg-blue-50/50 border-blue-200':'bg-green-50/50 border-green-200'}`}>
              <h3 className={`text-[13px] font-bold mb-3 flex items-center gap-1 ${method==='pickup'?'text-orange-800':method==='delivery'?'text-blue-800':'text-green-800'}`}>{method==='pickup' ? <Store size={14}/> : method==='delivery' ? <Truck size={14}/> : <Package size={14}/>}{method==='pickup' ? '店頭受取' : method==='delivery' ? '自社配達' : '業者配送'}</h3>
              <div className="space-y-2">
                {timeSlots[method].map((slot, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={slot} onChange={(e) => handleTimeSlotChange(method, i, e.target.value)} className={`flex-1 px-3 py-1.5 rounded-lg border bg-white text-[13px] font-bold outline-none focus:border-[#2D4B3E] ${method==='pickup'?'border-orange-200':method==='delivery'?'border-blue-200':'border-green-200'}`} />
                    <button onClick={() => removeTimeSlot(method, i)} className="text-red-300 p-1.5 hover:text-red-500 transition-colors"><X size={14}/></button>
                  </div>
                ))}
                <button onClick={() => addTimeSlot(method)} className={`text-[11px] font-bold flex items-center gap-1 mt-2 transition-colors ${method==='pickup'?'text-orange-600 hover:text-orange-800':method==='delivery'?'text-blue-600 hover:text-blue-800':'text-green-600 hover:text-green-800'}`}><Plus size={14}/> 枠を追加</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="space-y-4 pt-6 border-t border-[#EAEAEA]">
        <label className="text-[14px] font-bold text-[#2D4B3E]">自社配達エリアと料金</label>
        <div className="space-y-2">
          {deliveryAreas.map(a => (
            <div key={a.id} className="flex gap-2 bg-[#FBFAF9] p-2 rounded-xl border border-[#EAEAEA]">
              <input type="text" value={a.name} onChange={(e)=>setDeliveryAreas(deliveryAreas.map(x=>x.id===a.id?{...x, name:e.target.value}:x))} className="flex-[2] h-10 bg-white border rounded-xl px-3 text-[13px] font-bold focus:border-[#2D4B3E] outline-none" placeholder="判定用キーワード (例: 中央区, 北区)"/>
              <div className="flex-1 flex items-center gap-1 bg-white border rounded-xl px-3 h-10"><span className="text-[10px] text-[#999999] font-bold">¥</span><input type="number" value={a.fee} onChange={(e)=>setDeliveryAreas(deliveryAreas.map(x=>x.id===a.id?{...x, fee:Number(e.target.value)}:x))} className="w-full bg-transparent text-right font-bold text-[13px] outline-none"/></div>
              <button onClick={()=>setDeliveryAreas(deliveryAreas.filter(x=>x.id!==a.id))} className="text-red-300 px-2 hover:text-red-500"><Trash2 size={16}/></button>
            </div>
          ))}
          <button onClick={()=>setDeliveryAreas([...deliveryAreas, {id:Date.now(), name:'', fee:0}])} className="py-3 border border-dashed rounded-xl text-[11px] font-bold text-[#999999] hover:text-[#2D4B3E] w-full transition-all">+ 配達エリアを追加</button>
        </div>
      </div>
      <div className="pt-6 space-y-4 border-t border-[#EAEAEA]">
        <label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Box size={16}/> 梱包（箱代）の計算ロジック</label>
        <div className="flex gap-2 bg-[#FBFAF9] p-1 rounded-xl w-fit">{[{id:'flat',l:'一律'},{id:'price_based',l:'商品代ベース'}].map(t=>(<button key={t.id} onClick={()=>setBoxFeeConfig({...boxFeeConfig, type:t.id})} className={`px-4 py-2 rounded-lg text-xs font-bold ${boxFeeConfig.type===t.id?'bg-white shadow text-[#2D4B3E]':'text-[#999999]'}`}>{t.l}</button>))}</div>
        {boxFeeConfig.type === 'flat' ? (
          <div className="flex items-center gap-2 bg-[#FBFAF9] p-4 rounded-xl border w-fit"><span className="text-[12px] font-bold">一律加算:</span><input type="number" value={boxFeeConfig.flatFee} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, flatFee:Number(e.target.value)})} className="w-20 h-8 rounded border px-2 text-right font-bold focus:border-[#2D4B3E] outline-none"/>円</div>
        ) : (
          <div className="space-y-2 bg-[#FBFAF9] p-4 rounded-xl border">
            {boxFeeConfig.priceTiers.map((tier, i) => (<div key={i} className="flex items-center gap-2 text-[12px] font-bold"><input type="number" value={tier.minPrice} onChange={(e)=>{const n=[...boxFeeConfig.priceTiers];n[i].minPrice=Number(e.target.value);setBoxFeeConfig({...boxFeeConfig,priceTiers:n})}} className="w-24 h-8 rounded border px-2 focus:border-[#2D4B3E] outline-none"/>円以上なら 箱代<input type="number" value={tier.fee} onChange={(e)=>{const n=[...boxFeeConfig.priceTiers];n[i].fee=Number(e.target.value);setBoxFeeConfig({...boxFeeConfig,priceTiers:n})}} className="w-20 h-8 rounded border px-2 text-right focus:border-[#2D4B3E] outline-none"/>円</div>))}
            <button onClick={()=>setBoxFeeConfig({...boxFeeConfig, priceTiers:[...boxFeeConfig.priceTiers, {minPrice:0,fee:0}]})} className="text-[10px] text-[#2D4B3E] font-bold">+ 条件追加</button>
          </div>
        )}
      </div>
      <div className="space-y-4 border-t border-[#EAEAEA] pt-8">
        <div className="flex justify-between items-center"><label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><CalendarIcon size={16}/> クール便 適用期間設定</label><button onClick={()=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: [...boxFeeConfig.coolBinPeriods, {id:Date.now(), start:'06-01', end:'09-30', note:''}]})} className="text-[10px] bg-[#2D4B3E] text-white px-3 py-1.5 rounded-full font-bold shadow-sm transition-all hover:bg-[#1f352b]">+ 期間を追加</button></div>
        <div className="grid grid-cols-1 gap-3">
          {boxFeeConfig.coolBinPeriods.map(p => (
            <div key={p.id} className="flex flex-wrap gap-2 items-center bg-[#FBFAF9] p-3 rounded-2xl border border-[#EAEAEA] shadow-sm"><input type="text" value={p.start} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, start:e.target.value}:x)})} className="w-16 h-9 border rounded-lg text-center text-[11px] font-bold outline-none focus:border-[#2D4B3E]"/><span className="text-[11px] text-[#999999]">〜</span><input type="text" value={p.end} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, end:e.target.value}:x)})} className="w-16 h-9 border rounded-lg text-center text-[11px] font-bold outline-none focus:border-[#2D4B3E]"/><input type="text" placeholder="理由メモ" value={p.note} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, note:e.target.value}:x)})} className="flex-1 h-9 border rounded-lg px-3 text-[11px] outline-none font-bold focus:border-[#2D4B3E]"/><button onClick={()=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.filter(x=>x.id!==p.id)})} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></div>
          ))}
        </div>
      </div>
      <div className="bg-[#2D4B3E]/5 p-6 rounded-[24px] border border-[#2D4B3E]/10 space-y-4">
        <div className="font-bold text-[#2D4B3E] text-[14px] flex items-center gap-2"><RotateCcw size={18}/> 器回収/返却時の加算送料</div>
        <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">計算タイプ</label><select value={boxFeeConfig.returnFeeType} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, returnFeeType:e.target.value})} className="w-full h-10 bg-white border rounded-xl px-3 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"><option value="flat">固定金額 (¥)</option><option value="percent">基本送料の○%</option></select></div><div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">{boxFeeConfig.returnFeeType === 'flat' ? '加算金額 (¥)' : '加算率 (%)'}</label><input type="number" value={boxFeeConfig.returnFeeValue} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, returnFeeValue:Number(e.target.value)})} className="w-full h-10 bg-white border rounded-xl px-3 text-[13px] font-bold text-right outline-none focus:border-[#2D4B3E]"/></div></div>
      </div>
      <div className="space-y-6 pt-4 border-t border-[#EAEAEA]">
        <div className="flex justify-between items-center"><label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Ruler size={16}/> 業者配送 サイズ・地域マスタ</label><div className="flex gap-2"><button onClick={()=>{const s=prompt('サイズを入力(例:140)'); if(s) setShippingSizes([...shippingSizes, s]);}} className="text-[10px] bg-[#2D4B3E] text-white px-3 py-1.5 rounded-full font-bold shadow-sm hover:bg-[#1f352b] transition-all">+ サイズ追加</button><button onClick={()=>{const r=prompt('新しい地域名を入力'); if(r) setShippingRates([...shippingRates, {region:r, leadDays:1}]);}} className="text-[10px] bg-[#2D4B3E] text-white px-3 py-1.5 rounded-full font-bold shadow-sm hover:bg-[#1f352b] transition-all">+ 地域追加</button></div></div>
        <div className="flex flex-wrap gap-2 mb-4 bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA]"><span className="text-[11px] font-bold text-[#999999] w-full mb-1">登録サイズ (×で削除可):</span>{shippingSizes.map((s, i) => (<div key={i} className="flex items-center gap-2 bg-white border rounded-full pl-3 pr-1 py-1 shadow-sm transition-all hover:border-red-200"><span className="text-[11px] font-black text-[#2D4B3E]">{s}サイズ</span><button onClick={() => { if(confirm(`${s}サイズを削除しますか？`)){ setShippingSizes(shippingSizes.filter((_, idx)=>idx!==i)); }}} className="w-5 h-5 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"><X size={12}/></button></div>))}</div>
        <div className="overflow-x-auto border rounded-[24px]">
          <table className="w-full text-left text-[10px] min-w-[1100px] bg-white">
            <thead className="bg-[#FBFAF9] border-b text-[#999999]"><tr><th className="p-3 w-32 font-black">地域・地方名</th><th className="p-3 text-center border-l bg-green-50 text-green-800">配送日数</th>{shippingSizes.map(s=><th key={s} className="p-3 text-center border-l bg-gray-50">{s}サイズ</th>)}{shippingSizes.map(s=><th key={'c'+s} className="p-3 text-center border-l bg-blue-50 text-blue-500">{s}クール加算</th>)}<th className="p-3"></th></tr></thead>
            <tbody className="divide-y">{shippingRates.map((r, i) => (<tr key={i} className="hover:bg-gray-50/50 transition-colors"><td className="p-3"><input type="text" value={r.region} onChange={(e)=>{const n=[...shippingRates]; n[i].region=e.target.value; setShippingRates(n);}} className="w-full border-none bg-transparent font-bold text-[11px] outline-none" /></td><td className="p-1 border-l bg-green-50/30"><div className="flex items-center justify-center gap-1"><input type="number" value={r.leadDays || 1} onChange={(e)=>{const n=[...shippingRates]; n[i].leadDays=Number(e.target.value); setShippingRates(n);}} className="w-12 border rounded p-1.5 text-center font-bold text-green-900 outline-none"/><span className="text-[10px] text-green-800">日</span></div></td>{shippingSizes.map(s => <td key={s} className="p-1 border-l"><input type="number" value={r['fee'+s]||0} onChange={(e)=>{const n=[...shippingRates]; n[i]['fee'+s]=Number(e.target.value); setShippingRates(n);}} className="w-16 border rounded p-1.5 mx-auto block text-right font-bold outline-none focus:border-[#2D4B3E]"/></td>)}{shippingSizes.map(s => <td key={'c'+s} className="p-1 border-l bg-blue-50/10"><input type="number" value={r['cool'+s]||0} onChange={(e)=>{const n=[...shippingRates]; n[i]['cool'+s]=Number(e.target.value); setShippingRates(n);}} className="w-16 border border-blue-100 rounded p-1.5 mx-auto block text-right text-blue-500 font-bold outline-none focus:border-blue-400"/></td>)}<td className="p-1 text-center"><button onClick={()=>{if(confirm('削除しますか？')){setShippingRates(shippingRates.filter((_, idx)=>idx!==i))}}} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={14}/></button></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRulesTab = () => {
    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-8 text-left">
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><LayoutTemplate size={20}/> 立札デザイン・店舗紐付け</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#999999]">店舗ごとのテンプレート選択</label>
              {shops.length === 0 ? <p className="text-sm text-[#999999]">店舗を登録してください</p> : shops.map(shop => (
                <div key={shop.id} className="bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA] space-y-2">
                  <span className="font-bold text-[13px] text-[#2D4B3E]">{shop.name}</span>
                  <div className="flex flex-col gap-1">
                    {tateMaster.map(tate => (
                      <label key={tate.id} className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border hover:border-[#2D4B3E] transition-all">
                        <input type="checkbox" checked={(shop.enabledTatePatterns || []).includes(tate.id)} onChange={(e)=>{const current = shop.enabledTatePatterns || []; const next = e.target.checked ? [...current, tate.id] : current.filter(p=>p!==tate.id); setShops(shops.map(s=>s.id===shop.id?{...s, enabledTatePatterns:next}:s));}} className="accent-[#2D4B3E]"/>
                        <span className="text-[11px] font-bold flex-1">{tate.label}</span>
                        <button onClick={(e)=>{e.preventDefault(); setSelectedPreviewTate(tate)}} className="text-[9px] bg-[#F7F7F7] px-2 py-1 rounded text-[#555555]">プレビュー</button>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky top-24 h-fit bg-[#FBFAF9] p-8 rounded-[32px] border border-[#EAEAEA] shadow-inner text-center">
              <span className="text-[10px] font-bold text-[#999999] tracking-widest block mb-4">プレビュー ({selectedPreviewTate.label})</span>
              <TatefudaPreview tatePattern={selectedPreviewTate.id} layout={selectedPreviewTate.layout} isOsonae={['p1', 'p3', 'p4'].includes(selectedPreviewTate.id)} input1="御開店" input2="山田太郎" input3="株式会社〇〇" input3a="株式会社〇〇" input3b="代表 山田太郎" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStaffOrderTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-8 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={20}/> 代理入力の特別ルール</h2>
      <div className="space-y-4">
        {[{ label: '最短納期の制限を完全に無視する', key: 'ignoreLeadTime' }, { label: '注文金額の自由入力を許可', key: 'allowCustomPrice' }].map(item => (
          <label key={item.key} className="flex items-center justify-between bg-[#FBFAF9] p-5 rounded-[24px] cursor-pointer border border-transparent hover:border-[#EAEAEA] shadow-sm"><span className="font-bold text-[14px]">{item.label}</span><input type="checkbox" checked={staffOrderConfig[item.key]} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, [item.key]:e.target.checked})} className="w-6 h-6 accent-[#2D4B3E]"/></label>
        ))}
        <label className="flex items-center justify-between bg-[#FBFAF9] p-5 rounded-[24px] cursor-pointer border border-transparent hover:border-[#EAEAEA] shadow-sm"><span className="font-bold text-[14px]">お客様への自動返信メールを送らない</span><input type="checkbox" checked={!staffOrderConfig.sendAutoReply} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, sendAutoReply:!e.target.checked})} className="w-6 h-6 accent-[#2D4B3E]"/></label>
        <div className="pt-4 space-y-1"><label className="text-[11px] font-bold text-[#999999]">スタッフ専用 支払い方法（カンマ区切り）</label><input type="text" value={(staffOrderConfig.paymentMethods||[]).join(', ')} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, paymentMethods:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full h-12 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
      </div>
    </div>
  );

  const renderStaffTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-6 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><User size={20}/> スタッフ管理</h2>
      <div className="space-y-3">
        {staffList.map((s, i) => (
          <div key={i} className="flex justify-between items-center bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA]"><div className="flex flex-col"><span className="font-bold text-[14px]">{s.name}</span><span className="text-[9px] text-[#999999] font-bold tracking-tight">所属: {s.store === 'all' ? '全店' : shops.find(sh=>sh.id===Number(s.store))?.name || '不明'}</span></div><button onClick={()=>setStaffList(staffList.filter((_,idx)=>idx!==i))} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={16}/></button></div>
        ))}
        <div className="flex flex-col md:flex-row gap-2 pt-4 border-t border-[#EAEAEA]"><input type="text" placeholder="氏名" value={newStaffName} onChange={(e)=>setNewStaffName(e.target.value)} className="flex-[2] h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E]"/><select value={newStaffStore} onChange={(e)=>setNewStaffStore(e.target.value)} className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"><option value="all">全店</option>{shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name}</option>)}</select><button onClick={()=>{if(newStaffName.trim()){setStaffList([...staffList,{name:newStaffName, store:newStaffStore}]); setNewStaffName('');}}} className="bg-[#2D4B3E] text-white px-6 h-12 rounded-xl font-bold text-[13px] shadow-sm hover:bg-[#1f352b] transition-all">追加</button></div>
      </div>
    </div>
  );

  const renderMessageTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-6 animate-in fade-in text-left">
      <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-4"><h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Mail size={20}/> 通知メール管理</h2><button onClick={() => setAutoReplyTemplates([...autoReplyTemplates, { id: `t_${Date.now()}`, trigger: 'カスタム', subject: '新しいテンプレート', body: '' }])} className="text-[11px] bg-[#2D4B3E] text-white px-4 py-2 rounded-full font-bold shadow-sm transition-all hover:bg-[#1f352b]">+ 追加</button></div>
      <div className="space-y-8">
        {autoReplyTemplates.map((template, index) => (
          <div key={template.id} className="bg-[#FBFAF9] p-6 rounded-[24px] border border-[#EAEAEA] space-y-4 relative group"><button onClick={() => setAutoReplyTemplates(autoReplyTemplates.filter(t => t.id !== template.id))} className="absolute top-6 right-6 text-red-300 hover:text-red-500 bg-white p-2 rounded-full shadow-sm"><Trash2 size={16}/></button><div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-12"><div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">送信用途</label><input type="text" value={template.trigger} onChange={(e) => { const newT = [...autoReplyTemplates]; newT[index].trigger = e.target.value; setAutoReplyTemplates(newT); }} className="w-full h-12 bg-white border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E]" /></div><div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">件名</label><input type="text" value={template.subject} onChange={(e) => { const newT = [...autoReplyTemplates]; newT[index].subject = e.target.value; setAutoReplyTemplates(newT); }} className="w-full h-12 bg-white border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E]" /></div></div><div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">本文 (利用可能タグ: {"{CustomerName}"} {"{OrderDetails}"})</label><textarea value={template.body} onChange={(e) => { const newT = [...autoReplyTemplates]; newT[index].body = e.target.value; setAutoReplyTemplates(newT); }} className="w-full h-48 bg-white border border-[#EAEAEA] rounded-[20px] p-5 text-[13px] font-bold outline-none resize-none leading-relaxed focus:border-[#2D4B3E]" /></div></div>
        ))}
      </div>
    </div>
  );

  // ★ 追加: リンク・URL発行タブ
  const renderLinksTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-8 animate-in fade-in">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><LinkIcon size={20}/> URL・リンク発行</h2>
      <div className="space-y-6">
        <div className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] space-y-4">
          <h3 className="text-[14px] font-bold text-[#111111]">法人のお客様向け</h3>
          <div className="space-y-2">
             <label className="text-[11px] font-bold text-[#999999]">法人ポータル (ログイン・注文履歴)</label>
             <div className="flex gap-2">
               <input type="text" readOnly value={`${window.location.origin}/corporate`} className="flex-1 h-12 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[13px] font-mono outline-none text-[#555555]" />
               <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/corporate`); alert('コピーしました！'); }} className="px-6 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all">コピー</button>
             </div>
          </div>
          <div className="space-y-2 pt-2">
             <label className="text-[11px] font-bold text-[#999999]">法人アカウント新規登録フォーム</label>
             <div className="flex gap-2">
               <input type="text" readOnly value={`${window.location.origin}/corporate/register`} className="flex-1 h-12 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[13px] font-mono outline-none text-[#555555]" />
               <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/corporate/register`); alert('コピーしました！'); }} className="px-6 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all">コピー</button>
             </div>
          </div>
        </div>

        <div className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] space-y-4">
          <h3 className="text-[14px] font-bold text-[#111111]">一般のお客様向け (店舗別注文ページ)</h3>
          {shops.length === 0 ? <p className="text-[12px] text-[#999999]">店舗を登録してください。</p> : shops.map(shop => (
             <div key={shop.id} className="space-y-1">
               <label className="text-[11px] font-bold text-[#2D4B3E]">{shop.name}</label>
               <div className="flex gap-2">
                 <input type="text" readOnly value={`${window.location.origin}/order/${shop.id}`} className="flex-1 h-12 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[13px] font-mono outline-none text-[#555555]" />
                 <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/order/${shop.id}`); alert('コピーしました！'); }} className="px-6 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all">コピー</button>
               </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );

  // --- メイン描画 ---
  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-left pb-40">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-6 md:px-12 sticky top-0 z-50 shadow-sm">
        <h1 className="text-[16px] font-bold text-[#2D4B3E] tracking-tight">システム設定</h1>
        <div className="hidden md:flex flex-1 mx-6 overflow-x-auto bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] hide-scrollbar">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {!isAdmin ? (
            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border border-[#EAEAEA] shadow-sm">
              <input type="password" placeholder="Pass" value={adminPassword} onChange={(e)=>setAdminPassword(e.target.value)} className="w-16 h-8 px-2 bg-[#FBFAF9] text-[11px] font-bold outline-none rounded-lg border focus:border-[#2D4B3E]"/>
              <button onClick={handleLogin} className="px-3 h-8 bg-[#2D4B3E] text-white text-[11px] font-bold rounded-lg transition-all hover:bg-[#1f352b] active:scale-95">解除</button>
            </div>
          ) : (
            <button onClick={saveSettings} disabled={isSaving} className={`px-6 py-2.5 rounded-xl text-[12px] font-bold tracking-widest shadow-md transition-all ${isSaving ? 'bg-gray-400' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b] active:scale-95'}`}>{isSaving ? '保存中...' : '変更を保存'}</button>
          )}
        </div>
      </header>

      <div className="md:hidden flex overflow-x-auto bg-white border-b p-2 hide-scrollbar sticky top-20 z-40 shadow-sm">
        {tabs.map((t) => (<button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-[#2D4B3E] text-white shadow-md' : 'text-[#999999]'}`}>{t.label}</button>))}
      </div>

      <main className={`flex-1 max-w-[1000px] mx-auto w-full py-10 px-6 transition-all ${!isAdmin ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'shop' && renderShopTab()}
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'shipping' && renderShippingTab()}
        {activeTab === 'rules' && renderRulesTab()}
        {activeTab === 'staff_order' && renderStaffOrderTab()}
        {activeTab === 'staff' && renderStaffTab()}
        {activeTab === 'message' && renderMessageTab()}
        {activeTab === 'links' && renderLinksTab()}
      </main>

      <style jsx global>{` @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; } .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } `}</style>
    </div>
  );
}