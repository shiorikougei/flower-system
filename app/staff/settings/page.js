'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Settings as SettingsIcon, ListChecks, Store, Tag, Truck, User, Mail, 
  Trash2, Plus, Clock, ShieldCheck, RotateCcw, Image, Ruler, Percent, 
  ChevronRight, Calendar as CalendarIcon, Box, MapPin, Search, CheckCircle, X,
  LayoutTemplate, AlertCircle, Snowflake
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // --- 1. 基本設定 ---
  const [generalConfig, setGeneralConfig] = useState({ 
    appName: 'FLORIX', logoUrl: '', logoSize: 100, logoTransparent: false, slipBgUrl: '', slipBgOpacity: 50 
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
  const [autoReply, setAutoReply] = useState({ subject: '', body: '' });

  const tabs = [
    { id: 'general', label: '基本設定', icon: SettingsIcon },
    { id: 'status', label: 'ステータス', icon: ListChecks },
    { id: 'shop', label: '店舗・決済', icon: Store }, 
    { id: 'items', label: '商品・納期', icon: Tag },
    { id: 'shipping', label: '配送・送料', icon: Truck },
    { id: 'rules', label: '立札デザイン', icon: LayoutTemplate },
    { id: 'staff_order', label: '店舗受付', icon: Clock },
    { id: 'staff', label: 'スタッフ', icon: User },
    { id: 'message', label: '通知メール', icon: Mail },
  ];

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data?.settings_data) {
          const s = data.settings_data;
          if (s.generalConfig) setGeneralConfig({...generalConfig, ...s.generalConfig});
          if (s.statusConfig) setStatusConfig(s.statusConfig);
          if (s.shops) setShops(s.shops);
          if (s.flowerItems) setFlowerItems(s.flowerItems);
          if (s.staffList) setStaffList(s.staffList);
          if (s.deliveryAreas) setDeliveryAreas(s.deliveryAreas);
          if (s.shippingSizes) setShippingSizes(s.shippingSizes);
          if (s.shippingRates) setShippingRates(s.shippingRates);
          if (s.boxFeeConfig) setBoxFeeConfig({...boxFeeConfig, ...s.boxFeeConfig});
          if (s.staffOrderConfig) setStaffOrderConfig(s.staffOrderConfig);
          if (s.autoReply) setAutoReply(s.autoReply);
        }
      } catch (e) { console.error('読込失敗', e); }
    }
    loadSettings();
  }, []);

  const handleLogin = () => {
    if (adminPassword === '7777') setIsAdmin(true);
    else alert('パスワードが違います');
  };

  const saveSettings = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const payload = { generalConfig, statusConfig, shops, flowerItems, staffList, deliveryAreas, shippingSizes, shippingRates, boxFeeConfig, autoReply, staffOrderConfig };
      await supabase.from('app_settings').upsert({ id: 'default', settings_data: payload });
      alert('すべての設定を完璧に保存しました！');
    } catch (e) { alert('保存失敗'); } finally { setIsSaving(false); }
  };

  const handleImg = (e, f) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => setGeneralConfig({ ...generalConfig, [f]: ev.target.result });
    r.readAsDataURL(file);
  };

  // 特別時間更新用ヘルパー関数
  const updateSpecialHour = (shopId, isDelivery, hourId, field, value) => {
    setShops(shops.map(s => {
      if (s.id !== shopId) return s;
      const targetKey = isDelivery ? 'deliverySpecialHours' : 'specialHours';
      return { ...s, [targetKey]: (s[targetKey] || []).map(h => h.id === hourId ? { ...h, [field]: value } : h) };
    }));
  };

  // --- タブのレンダリングコンポーネント ---

  const renderGeneralTab = () => (
    <div className="bg-white rounded-[32px] border p-10 shadow-sm space-y-10 animate-in fade-in">
      <h2 className="text-[20px] font-black text-[#2D4B3E] flex items-center gap-2 border-b pb-4"><Image size={24}/> 基本情報・ロゴ・伝票</h2>
      <div className="space-y-8">
        <div className="space-y-2"><label className="text-[12px] font-bold text-[#999999] tracking-widest">アプリ名</label><input type="text" value={generalConfig.appName} onChange={(e)=>setGeneralConfig({...generalConfig, appName: e.target.value})} className="w-full h-14 bg-[#FBFAF9] border rounded-xl px-5 text-[15px] font-bold outline-none focus:border-[#2D4B3E] transition-all"/></div>
        
        <div className="space-y-4 pt-6 border-t">
          <label className="text-[12px] font-bold text-[#999999] tracking-widest">ロゴ画像</label>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1 w-full space-y-4 p-6 bg-[#FBFAF9] rounded-2xl border">
              <input type="file" accept="image/*" onChange={(e)=>handleImg(e, 'logoUrl')} className="block w-full text-xs font-bold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-[#2D4B3E] file:text-white" />
              {generalConfig.logoUrl && (
                <div className="space-y-4 pt-4 border-t border-[#EAEAEA] animate-in fade-in">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-bold">サイズ: {generalConfig.logoSize}%</span><input type="range" min="30" max="150" value={generalConfig.logoSize} onChange={(e)=>setGeneralConfig({...generalConfig, logoSize: Number(e.target.value)})} className="w-40 accent-[#2D4B3E]"/></div>
                  <div className="flex items-center justify-between"><span className="text-[11px] font-bold">白背景を透過</span><button onClick={()=>setGeneralConfig({...generalConfig, logoTransparent: !generalConfig.logoTransparent})} className={`w-10 h-6 rounded-full transition-all relative ${generalConfig.logoTransparent ? 'bg-[#2D4B3E]' : 'bg-gray-300'}`}><div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${generalConfig.logoTransparent ? 'left-5' : 'left-1'}`}/></button></div>
                  <button onClick={()=>setGeneralConfig({...generalConfig, logoUrl:''})} className="text-[10px] text-red-500 font-bold hover:underline">画像を削除する</button>
                </div>
              )}
            </div>
            <div className="w-full md:w-48 shrink-0 space-y-2">
              <label className="text-[10px] font-bold text-[#999999] text-center block">プレビュー</label>
              <div className="w-full aspect-square bg-[#EAEAEA]/30 border rounded-2xl flex items-center justify-center overflow-hidden p-4">
                {generalConfig.logoUrl ? <img src={generalConfig.logoUrl} style={{width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal'}} className="object-contain" /> : <span className="text-[10px] text-[#999999]">No Image</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t">
          <label className="text-[12px] font-bold text-[#999999] tracking-widest">伝票用 背景（透かし柄）画像</label>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1 w-full space-y-4 p-6 bg-[#2D4B3E]/5 rounded-2xl border border-[#2D4B3E]/10">
              <input type="file" accept="image/*" onChange={(e)=>handleImg(e, 'slipBgUrl')} className="block w-full text-xs font-bold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-white file:text-[#2D4B3E] file:border file:border-[#2D4B3E]" />
              {generalConfig.slipBgUrl && (
                <div className="space-y-4 pt-4 border-t border-[#2D4B3E]/10 animate-in fade-in">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-[#2D4B3E]">画像の濃さ: {generalConfig.slipBgOpacity}%</span><input type="range" min="0" max="100" value={generalConfig.slipBgOpacity} onChange={(e)=>setGeneralConfig({...generalConfig, slipBgOpacity: Number(e.target.value)})} className="w-40 accent-[#2D4B3E]"/></div>
                  <button onClick={()=>setGeneralConfig({...generalConfig, slipBgUrl:''})} className="text-[10px] text-red-500 font-bold bg-white border px-3 py-1 rounded-lg shadow-sm">画像を削除</button>
                </div>
              )}
            </div>
            <div className="w-full md:w-[280px] shrink-0 space-y-2">
              <label className="text-[10px] font-bold text-[#999999] text-center block">伝票プレビュー</label>
              <div className="relative w-full aspect-[210/148] bg-[#f1f8e9] border border-gray-300 rounded-xl p-4 overflow-hidden flex flex-col justify-between shadow-md">
                {generalConfig.slipBgUrl && <div className="absolute inset-0 z-0 grayscale-[30%] pointer-events-none" style={{ backgroundImage: `url(${generalConfig.slipBgUrl})`, backgroundSize: 'cover', opacity: generalConfig.slipBgOpacity / 100 }} />}
                <span className="relative z-10 text-[12px] font-bold text-[#2e7d32] border-b border-[#2e7d32] pb-1 tracking-widest">受 注 書 控</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  const renderStatusTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-6 animate-in fade-in">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><ListChecks size={20}/> 受注ステータス管理</h2>
      <div className="flex gap-2 p-1 bg-[#F7F7F7] rounded-xl mb-4">
        {['template', 'custom'].map(t => (
          <button key={t} onClick={() => setStatusConfig({...statusConfig, type: t})} className={`flex-1 py-3 rounded-lg font-bold text-[12px] ${statusConfig.type === t ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>{t === 'template' ? '標準' : 'カスタム'}</button>
        ))}
      </div>
      {statusConfig.type === 'custom' && (
        <div className="space-y-3">
          {statusConfig.customLabels.map((l, i) => (
            <div key={i} className="flex gap-2"><input type="text" value={l} onChange={(e) => { const n = [...statusConfig.customLabels]; n[i] = e.target.value; setStatusConfig({...statusConfig, customLabels: n}); }} className="flex-1 h-12 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none" /><button onClick={() => setStatusConfig({...statusConfig, customLabels: statusConfig.customLabels.filter((_, idx) => idx !== i)})} className="text-red-300 p-2 hover:text-red-500"><Trash2 size={18}/></button></div>
          ))}
          <button onClick={() => setStatusConfig({...statusConfig, customLabels: [...statusConfig.customLabels, '新状態']})} className="w-full py-3 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 項目を追加</button>
        </div>
      )}
    </div>
  );

  const renderShopTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {shops.map(shop => (
        <div key={shop.id} className="bg-white rounded-[32px] border p-10 shadow-sm relative space-y-8 text-left">
          <button onClick={()=>setShops(shops.filter(s=>s.id!==shop.id))} className="absolute top-6 right-6 text-red-300 hover:text-red-500"><Trash2 size={20}/></button>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={shop.isActive} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, isActive:e.target.checked}:s))} className="w-6 h-6 accent-[#2D4B3E]"/>
            <h2 className="text-[20px] font-black text-[#2D4B3E]">{shop.name || '名称未設定'}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#FBFAF9] p-6 rounded-2xl border">
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">店舗名</label><input type="text" value={shop.name} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, name:e.target.value}:s))} className="w-full h-11 bg-white border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">電話番号</label><input type="text" value={shop.phone} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, phone:e.target.value}:s))} className="w-full h-11 bg-white border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">郵便番号</label><input type="text" value={shop.zip} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, zip:e.target.value}:s))} className="w-full h-11 bg-white border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="000-0000"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">住所</label><input type="text" value={shop.address} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, address:e.target.value}:s))} className="w-full h-11 bg-white border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-[#999999]">インボイス登録番号</label><input type="text" value={shop.invoiceNumber || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, invoiceNumber:e.target.value}:s))} className="w-full h-11 bg-white border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="T123456..."/></div>
          </div>
          
          {/* 決済情報復活 */}
          <div className="pt-2 space-y-4">
            <h3 className="text-[14px] font-bold text-[#2D4B3E]">決済・振込先情報（お客様への請求書用）</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">振込先口座情報</label><textarea value={shop.bankInfo || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, bankInfo:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-4 text-[12px] font-bold outline-none resize-none focus:border-[#2D4B3E]" placeholder="○○銀行 〇〇支店..."/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">オンライン決済URL</label><input type="url" value={shop.paymentUrl || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, paymentUrl:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[12px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="https://..."/></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-[#EAEAEA]">
            {/* 店舗の営業時間と特別日 */}
            <div className="space-y-4">
              <label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Store size={16}/> 店舗 営業時間</label>
              <div className="flex items-center justify-between bg-[#FBFAF9] p-4 rounded-2xl border font-bold text-[14px]">
                <input type="time" value={shop.openTime || '10:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, openTime:e.target.value}:s))} className="bg-white border rounded-lg px-2 py-1 outline-none"/><span>〜</span><input type="time" value={shop.closeTime || '19:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, closeTime:e.target.value}:s))} className="bg-white border rounded-lg px-2 py-1 outline-none"/>
              </div>
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-[#999999]">特別スケジュール（店舗）</span>
                {(shop.specialHours || []).map(sh => (
                  <div key={sh.id} className="flex flex-col gap-2 bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA] relative group">
                    <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:s.specialHours.filter(h=>h.id!==sh.id)}:s))} className="absolute top-2 right-2 text-red-300 hover:text-red-500"><X size={14}/></button>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-white rounded-lg border p-0.5"><button onClick={()=>updateSpecialHour(shop.id, false, sh.id, 'settingType', 'date')} className={`px-2 py-1 text-[10px] font-bold rounded-md ${sh.settingType!=='day'?'bg-[#2D4B3E] text-white':'text-gray-400'}`}>日付</button><button onClick={()=>updateSpecialHour(shop.id, false, sh.id, 'settingType', 'day')} className={`px-2 py-1 text-[10px] font-bold rounded-md ${sh.settingType==='day'?'bg-[#2D4B3E] text-white':'text-gray-400'}`}>曜日</button></div>
                      {sh.settingType !== 'day' ? <input type="date" value={sh.date} onChange={(e)=>updateSpecialHour(shop.id, false, sh.id, 'date', e.target.value)} className="h-8 border rounded-lg px-2 text-[11px] font-bold"/> : <select value={sh.day||'月'} onChange={(e)=>updateSpecialHour(shop.id, false, sh.id, 'day', e.target.value)} className="h-8 border rounded-lg px-2 text-[11px] font-bold"><option>月</option><option>火</option><option>水</option><option>木</option><option>金</option><option>土</option><option>日</option></select>}
                      <select value={sh.recurrence||'once'} onChange={(e)=>updateSpecialHour(shop.id, false, sh.id, 'recurrence', e.target.value)} className="h-8 border rounded-lg px-1 text-[10px] font-bold">{sh.settingType!=='day'?<><option value="once">1回のみ</option><option value="yearly">毎年</option></>:<option value="weekly">毎週</option>}</select>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={sh.type} onChange={(e)=>updateSpecialHour(shop.id, false, sh.id, 'type', e.target.value)} className="h-8 border rounded-lg px-2 text-[11px] font-bold bg-white text-[#2D4B3E]"><option value="closed">休業</option><option value="changed">時間変更</option><option value="open">臨時営業</option></select>
                      {sh.type !== 'closed' && <div className="flex items-center gap-1"><input type="time" value={sh.open} onChange={(e)=>updateSpecialHour(shop.id, false, sh.id, 'open', e.target.value)} className="border rounded p-1 text-[10px]"/><span className="text-[10px]">-</span><input type="time" value={sh.close} onChange={(e)=>updateSpecialHour(shop.id, false, sh.id, 'close', e.target.value)} className="border rounded p-1 text-[10px]"/></div>}
                    </div>
                    <input type="text" placeholder="理由メモ" value={sh.note} onChange={(e)=>updateSpecialHour(shop.id, false, sh.id, 'note', e.target.value)} className="w-full bg-transparent border-b text-[11px] outline-none mt-1"/>
                  </div>
                ))}
                <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:[...(s.specialHours||[]), {id:Date.now(), settingType:'date', recurrence:'once', type:'closed'}]}:s))} className="w-full py-2 bg-white border-dashed border rounded-xl text-[10px] font-bold text-[#2D4B3E] hover:bg-[#2D4B3E]/5 transition-all">+ 店舗特別日を追加</button>
              </div>
            </div>

            {/* 配達の営業時間と特別日 */}
            <div className="space-y-4">
              <label className="text-[14px] font-bold text-[#D97C8F] flex items-center gap-2"><Truck size={16}/> 配達 可能時間</label>
              <div className="flex items-center justify-between bg-[#D97C8F]/5 p-4 rounded-2xl border border-[#D97C8F]/20 font-bold text-[14px]">
                <input type="time" value={shop.deliveryOpenTime || '11:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryOpenTime:e.target.value}:s))} className="bg-white border rounded-lg px-2 py-1 outline-none"/><span>〜</span><input type="time" value={shop.deliveryCloseTime || '18:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryCloseTime:e.target.value}:s))} className="bg-white border rounded-lg px-2 py-1 outline-none"/>
              </div>
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-[#999999]">特別スケジュール（配達）</span>
                {(shop.deliverySpecialHours || []).map(sh => (
                  <div key={sh.id} className="flex flex-col gap-2 bg-[#D97C8F]/5 p-3 rounded-xl border border-[#D97C8F]/20 relative group">
                    <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:s.deliverySpecialHours.filter(h=>h.id!==sh.id)}:s))} className="absolute top-2 right-2 text-red-300 hover:text-red-500"><X size={14}/></button>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-white rounded-lg border p-0.5"><button onClick={()=>updateSpecialHour(shop.id, true, sh.id, 'settingType', 'date')} className={`px-2 py-1 text-[10px] font-bold rounded-md ${sh.settingType!=='day'?'bg-[#D97C8F] text-white':'text-gray-400'}`}>日付</button><button onClick={()=>updateSpecialHour(shop.id, true, sh.id, 'settingType', 'day')} className={`px-2 py-1 text-[10px] font-bold rounded-md ${sh.settingType==='day'?'bg-[#D97C8F] text-white':'text-gray-400'}`}>曜日</button></div>
                      {sh.settingType !== 'day' ? <input type="date" value={sh.date} onChange={(e)=>updateSpecialHour(shop.id, true, sh.id, 'date', e.target.value)} className="h-8 border rounded-lg px-2 text-[11px] font-bold"/> : <select value={sh.day||'月'} onChange={(e)=>updateSpecialHour(shop.id, true, sh.id, 'day', e.target.value)} className="h-8 border rounded-lg px-2 text-[11px] font-bold"><option>月</option><option>火</option><option>水</option><option>木</option><option>金</option><option>土</option><option>日</option></select>}
                      <select value={sh.recurrence||'once'} onChange={(e)=>updateSpecialHour(shop.id, true, sh.id, 'recurrence', e.target.value)} className="h-8 border rounded-lg px-1 text-[10px] font-bold">{sh.settingType!=='day'?<><option value="once">1回のみ</option><option value="yearly">毎年</option></>:<option value="weekly">毎週</option>}</select>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={sh.type} onChange={(e)=>updateSpecialHour(shop.id, true, sh.id, 'type', e.target.value)} className="h-8 border rounded-lg px-2 text-[11px] font-bold bg-white text-[#D97C8F]"><option value="closed">配達休止</option><option value="changed">時間変更</option><option value="open">臨時配達</option></select>
                      {sh.type !== 'closed' && <div className="flex items-center gap-1"><input type="time" value={sh.open} onChange={(e)=>updateSpecialHour(shop.id, true, sh.id, 'open', e.target.value)} className="border rounded p-1 text-[10px]"/><span className="text-[10px]">-</span><input type="time" value={sh.close} onChange={(e)=>updateSpecialHour(shop.id, true, sh.id, 'close', e.target.value)} className="border rounded p-1 text-[10px]"/></div>}
                    </div>
                    <input type="text" placeholder="理由メモ" value={sh.note} onChange={(e)=>updateSpecialHour(shop.id, true, sh.id, 'note', e.target.value)} className="w-full bg-transparent border-b border-[#D97C8F]/30 text-[11px] outline-none mt-1"/>
                  </div>
                ))}
                <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:[...(s.deliverySpecialHours||[]), {id:Date.now(), settingType:'date', recurrence:'once', type:'closed'}]}:s))} className="w-full py-2 bg-white border-dashed border border-[#D97C8F]/50 rounded-xl text-[10px] font-bold text-[#D97C8F] hover:bg-[#D97C8F]/10 transition-all">+ 配達特別日を追加</button>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button onClick={()=>setShops([...shops, {id:Date.now(), name:'', isActive:true, openTime:'10:00', closeTime:'19:00', deliveryOpenTime:'11:00', deliveryCloseTime:'18:00', specialHours:[], deliverySpecialHours:[], enabledTatePatterns: ['p5', 'p7']}])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">+ 店舗を新規追加</button>
    </div>
  );

  const renderItemsTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {flowerItems.map(item => (
        <div key={item.id} className="bg-white rounded-[32px] border p-8 shadow-sm relative space-y-8 text-left">
          <button onClick={()=>setFlowerItems(flowerItems.filter(i=>i.id!==item.id))} className="absolute top-8 right-8 text-red-300 hover:text-red-500"><Trash2 size={20}/></button>
          
          <div className="space-y-4 border-b pb-6">
            <input type="text" value={item.name} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, name:e.target.value}:i))} className="w-full h-12 bg-transparent border-b-2 text-[24px] font-black outline-none focus:border-[#2D4B3E]" placeholder="商品名" />
            
            {/* 新規追加：クール便の除外 ＆ 箱サイズの設定 */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#FBFAF9] p-4 rounded-2xl border">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={item.excludeCoolBin} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, excludeCoolBin:e.target.checked}:i))} className="w-5 h-5 accent-blue-500" />
                <span className="text-[13px] font-bold text-blue-600 group-hover:text-blue-800 transition-colors flex items-center gap-1"><Snowflake size={16}/> クール便を適用しない（プリザーブド等）</span>
              </label>
              
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#555555]">デフォルト配送サイズ:</span>
                <select value={item.defaultBoxSize || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, defaultBoxSize:e.target.value}:i))} className="h-10 bg-white border border-[#EAEAEA] rounded-xl px-3 font-bold text-[13px] outline-none shadow-sm">
                  <option value="">未設定 (箱代設定を優先)</option>
                  {shippingSizes.map(s => <option key={s} value={s}>{s}サイズ</option>)}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-[#999999] font-bold text-right px-2">※配送サイズを指定すると、配送タブの「箱代計算ロジック」より優先してサイズ別送料が適用されます。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <p className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={16}/> 納期設定</p>
              <div className="space-y-3">
                <div className="bg-[#FBFAF9] p-4 rounded-2xl border"><label className="text-[10px] font-bold text-[#999999] block mb-1">通常・配達納期</label><div className="flex items-center gap-2"><input type="number" value={item.normalLeadDays} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, normalLeadDays:Number(e.target.value)}:i))} className="w-full bg-white border rounded-xl h-12 px-4 font-black text-[16px] outline-none"/><span>日後</span></div></div>
                <div className="bg-[#FBFAF9] p-4 rounded-2xl border"><label className="text-[10px] font-bold text-[#999999] block mb-1">業者配送納期</label><div className="flex items-center gap-2"><input type="number" value={item.shippingLeadDays} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, shippingLeadDays:Number(e.target.value)}:i))} className="w-full bg-white border rounded-xl h-12 px-4 font-black text-[16px] outline-none"/><span>日後</span></div></div>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><ShieldCheck size={16}/> 持ち込み設定</p>
              {['canBringFlowers', 'canBringVase'].map(key => (
                <div key={key} className="bg-[#FBFAF9] p-4 rounded-2xl border space-y-3">
                  <label className="flex items-center justify-between text-[13px] font-bold cursor-pointer">{key==='canBringFlowers'?'花材持込を許可':'花器持込を許可'}<input type="checkbox" checked={item[key]} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key]:e.target.checked}:i))} className="accent-[#2D4B3E] w-5 h-5"/></label>
                  {item[key] && <div className="flex items-center justify-between text-[11px] font-bold text-[#555555] pt-2 border-t border-[#EAEAEA]"><span>持込時の専用納期</span><div className="flex items-center gap-1"><input type="number" value={item[key+'LeadDays']||7} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key+'LeadDays']:Number(e.target.value)}:i))} className="w-12 h-8 bg-white border rounded-lg text-center font-black outline-none"/>日後</div></div>}
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <p className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><RotateCcw size={16}/> 器の回収・返却</p>
              <div className="bg-[#FBFAF9] p-4 rounded-2xl border space-y-3">
                <label className="flex items-center justify-between text-[13px] font-bold cursor-pointer">器の回収を必須とする<input type="checkbox" checked={item.hasReturn} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, hasReturn:e.target.checked}:i))} className="accent-[#2D4B3E] w-5 h-5"/></label>
                <p className="text-[10px] text-[#999999] leading-tight font-bold">※オンにすると、注文時に「器返却あり」の専用送料計算が自動で有効になります。（持ち込み設定とは完全に独立しています）</p>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button onClick={()=>setFlowerItems([...flowerItems, {id:Date.now(), name:'', normalLeadDays:2, shippingLeadDays:3, canBringFlowers:false, hasReturn:false}])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold transition-all hover:border-[#2D4B3E] hover:text-[#2D4B3E]">+ 商品を新規登録</button>
    </div>
  );

  const renderShippingTab = () => (
    <div className="space-y-8 animate-in fade-in text-left">
      <div className="bg-white rounded-[32px] border p-8 md:p-12 shadow-sm space-y-12">
        <h2 className="text-[20px] font-black text-[#2D4B3E] border-b pb-4 flex items-center gap-2"><Truck size={24}/> 配送・送料・箱代 マスタ設定</h2>
        
        {/* 自社配達 */}
        <div className="space-y-4">
          <label className="text-[15px] font-bold text-[#2D4B3E] flex items-center gap-2"><MapPin size={18}/> 自社配達 エリア料金</label>
          <div className="space-y-3">
            {deliveryAreas.map(a => (
              <div key={a.id} className="flex flex-col md:flex-row gap-3 bg-[#FBFAF9] p-4 rounded-2xl border">
                <input type="text" value={a.name} onChange={(e)=>setDeliveryAreas(deliveryAreas.map(x=>x.id===a.id?{...x, name:e.target.value}:x))} className="flex-[2] h-12 bg-white border rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none" placeholder="判定用キーワード (例: 北区, 中央区)"/>
                <div className="flex-1 flex items-center gap-2 bg-white border rounded-xl px-4 h-12"><span className="text-[12px] font-bold text-[#999999]">¥</span><input type="number" value={a.fee} onChange={(e)=>setDeliveryAreas(deliveryAreas.map(x=>x.id===a.id?{...x, fee:Number(e.target.value)}:x))} className="w-full bg-transparent text-right font-bold text-[14px] outline-none"/></div>
                <button onClick={()=>setDeliveryAreas(deliveryAreas.filter(x=>x.id!==a.id))} className="text-red-300 hover:text-red-500 px-2 transition-colors"><Trash2 size={20}/></button>
              </div>
            ))}
            <button onClick={()=>setDeliveryAreas([...deliveryAreas, {id:Date.now(), name:'', fee:0}])} className="py-4 border-2 border-dashed rounded-xl text-[13px] font-bold text-[#999999] hover:text-[#2D4B3E] hover:border-[#2D4B3E] w-full transition-all">+ 配達エリアを追加</button>
          </div>
        </div>

        {/* 箱代の計算ロジック（完全復元） */}
        <div className="pt-8 border-t space-y-6">
          <label className="text-[15px] font-bold text-[#2D4B3E] flex items-center gap-2"><Box size={18}/> 箱代（梱包費）の計算ロジック</label>
          <div className="flex gap-2 bg-[#F7F7F7] p-1 rounded-xl w-fit">
            {[{id:'flat',l:'一律加算'},{id:'price_based',l:'商品代ベース'}].map(t=><button key={t.id} onClick={()=>setBoxFeeConfig({...boxFeeConfig, type:t.id})} className={`px-6 py-3 rounded-lg text-[12px] font-bold transition-all ${boxFeeConfig.type===t.id?'bg-white shadow-sm text-[#2D4B3E]':'text-[#999999]'}`}>{t.l}</button>)}
          </div>
          {boxFeeConfig.type === 'flat' && (
            <div className="flex items-center gap-3 bg-[#FBFAF9] p-5 rounded-2xl border w-fit">
              <span className="text-[13px] font-bold text-[#555555]">一律加算:</span><input type="number" value={boxFeeConfig.flatFee} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, flatFee:Number(e.target.value)})} className="w-24 h-10 bg-white rounded-xl border px-3 text-right font-black text-[15px] outline-none focus:border-[#2D4B3E]"/><span className="text-[13px] font-bold text-[#555555]">円</span>
            </div>
          )}
          {boxFeeConfig.type === 'price_based' && (
            <div className="space-y-3 bg-[#FBFAF9] p-6 rounded-2xl border">
              {boxFeeConfig.priceTiers.map((tier, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3 text-[13px] font-bold text-[#555555]">
                  <input type="number" value={tier.minPrice} onChange={(e)=>{const n=[...boxFeeConfig.priceTiers];n[i].minPrice=Number(e.target.value);setBoxFeeConfig({...boxFeeConfig,priceTiers:n})}} className="w-28 h-10 bg-white rounded-xl border px-3 text-right font-black outline-none focus:border-[#2D4B3E]"/>円以上なら 箱代<input type="number" value={tier.fee} onChange={(e)=>{const n=[...boxFeeConfig.priceTiers];n[i].fee=Number(e.target.value);setBoxFeeConfig({...boxFeeConfig,priceTiers:n})}} className="w-24 h-10 bg-white rounded-xl border px-3 text-right font-black outline-none focus:border-[#2D4B3E]"/>円
                </div>
              ))}
              <button onClick={()=>setBoxFeeConfig({...boxFeeConfig, priceTiers:[...boxFeeConfig.priceTiers, {minPrice:0,fee:0}]})} className="text-[11px] bg-white border px-4 py-2 rounded-lg text-[#2D4B3E] font-bold shadow-sm hover:bg-gray-50">+ 条件を追加</button>
            </div>
          )}
        </div>

        {/* クール時期 */}
        <div className="space-y-6 pt-8 border-t">
          <div className="flex justify-between items-center"><label className="text-[15px] font-bold text-blue-600 flex items-center gap-2"><Snowflake size={18}/> クール便 自動加算の期間設定</label><button onClick={()=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: [...boxFeeConfig.coolBinPeriods, {id:Date.now(), start:'06-01', end:'09-30', note:''}]})} className="text-[11px] bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 rounded-full font-bold shadow-sm hover:bg-blue-500 hover:text-white transition-all">+ 期間を追加</button></div>
          <div className="grid grid-cols-1 gap-3">
            {boxFeeConfig.coolBinPeriods.map(p => (
              <div key={p.id} className="flex flex-wrap gap-3 items-center bg-blue-50/30 p-4 rounded-2xl border border-blue-100">
                <input type="text" value={p.start} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, start:e.target.value}:x)})} className="w-20 h-10 bg-white border rounded-xl text-center text-[13px] font-bold focus:border-blue-400 outline-none"/>
                <span className="text-[12px] font-bold text-blue-300">〜</span>
                <input type="text" value={p.end} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, end:e.target.value}:x)})} className="w-20 h-10 bg-white border rounded-xl text-center text-[13px] font-bold focus:border-blue-400 outline-none"/>
                <input type="text" placeholder="理由（例：夏季）" value={p.note} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, note:e.target.value}:x)})} className="flex-1 h-10 bg-white border rounded-xl px-4 text-[13px] font-bold focus:border-blue-400 outline-none"/>
                <button onClick={()=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.filter(x=>x.id!==p.id)})} className="text-blue-300 hover:text-blue-600 transition-colors"><Trash2 size={20}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* 器返却送料 */}
        <div className="bg-[#2D4B3E]/5 p-8 rounded-[32px] border border-[#2D4B3E]/20 space-y-6">
          <div className="font-bold text-[#2D4B3E] text-[15px] flex items-center gap-2"><RotateCcw size={20}/> 器回収・返却時の加算送料</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><label className="text-[11px] font-bold text-[#999999]">計算タイプ</label><select value={boxFeeConfig.returnFeeType} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, returnFeeType:e.target.value})} className="w-full h-12 bg-white border border-[#2D4B3E]/20 rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"><option value="flat">固定金額 (¥) で加算</option><option value="percent">基本送料の○% を加算</option></select></div>
            <div className="space-y-2"><label className="text-[11px] font-bold text-[#999999]">{boxFeeConfig.returnFeeType === 'flat' ? '加算金額 (¥)' : '加算率 (%)'}</label><input type="number" value={boxFeeConfig.returnFeeValue} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, returnFeeValue:Number(e.target.value)})} className="w-full h-12 bg-white border border-[#2D4B3E]/20 rounded-xl px-4 text-[15px] font-black text-right outline-none focus:border-[#2D4B3E]"/></div>
          </div>
        </div>

        {/* 業者配送送料マスタ */}
        <div className="space-y-6 pt-8 border-t">
          <div className="flex justify-between items-center"><label className="text-[15px] font-bold text-[#2D4B3E] flex items-center gap-2"><Ruler size={18}/> 業者配送 サイズ・地方別マスタ</label>
            <div className="flex gap-2">
              <button onClick={()=>{const s=prompt('追加するサイズ(数字のみ)を入力 (例:140)'); if(s && !shippingSizes.includes(s)) setShippingSizes([...shippingSizes, s]);}} className="text-[11px] bg-white border border-[#2D4B3E] text-[#2D4B3E] px-4 py-2 rounded-full font-bold shadow-sm hover:bg-[#2D4B3E] hover:text-white transition-all">+ サイズ追加</button>
              <button onClick={()=>{const r=prompt('新しい地域名を入力 (例:沖縄)'); if(r) setShippingRates([...shippingRates, {region:r}]);}} className="text-[11px] bg-[#2D4B3E] text-white px-4 py-2 rounded-full font-bold shadow-sm hover:bg-[#1f352b] transition-all">+ 地域追加</button>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 bg-[#FBFAF9] p-5 rounded-[24px] border border-[#EAEAEA]">
            <span className="text-[11px] font-bold text-[#999999]">現在の登録サイズ (×で列ごと削除します):</span>
            <div className="flex flex-wrap gap-2">
              {shippingSizes.map((s, i) => (
                <div key={i} className="flex items-center gap-2 bg-white border border-[#EAEAEA] rounded-full pl-4 pr-1 py-1 shadow-sm transition-all hover:border-red-200">
                  <span className="text-[12px] font-black text-[#2D4B3E]">{s}</span><span className="text-[10px] text-[#999999] font-bold -ml-1">サイズ</span>
                  <button onClick={() => { if(confirm(`${s}サイズの列を完全に削除しますか？`)){ setShippingSizes(shippingSizes.filter((_, idx)=>idx!==i)); }}} className="w-6 h-6 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"><X size={12}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto border border-[#EAEAEA] rounded-[24px] shadow-sm">
            <table className="w-full text-left text-[11px] min-w-[1200px]">
              <thead className="bg-[#FBFAF9] border-b border-[#EAEAEA] text-[#999999]">
                <tr>
                  <th className="p-4 w-32 font-black tracking-widest">地域・地方名</th>
                  {shippingSizes.map(s=><th key={s} className="p-4 text-center border-l border-[#EAEAEA] bg-white"><span className="text-[#2D4B3E] font-black text-[13px]">{s}</span><br/>サイズ</th>)}
                  {shippingSizes.map(s=><th key={'c'+s} className="p-4 text-center border-l border-blue-100 bg-blue-50/50 text-blue-600"><span className="font-black text-[13px]">{s}</span><br/>クール加算</th>)}
                  <th className="p-4 w-12 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA] bg-white">
                {shippingRates.map((r, i) => (
                  <tr key={i} className="hover:bg-[#FBFAF9] transition-colors group">
                    <td className="p-3 border-r border-[#EAEAEA]"><input type="text" value={r.region} onChange={(e)=>{const n=[...shippingRates]; n[i].region=e.target.value; setShippingRates(n);}} className="w-full h-10 border-none bg-transparent font-black text-[13px] focus:ring-0 px-2" /></td>
                    {shippingSizes.map(s => <td key={s} className="p-2 border-l border-[#EAEAEA]"><input type="number" value={r['fee'+s]||0} onChange={(e)=>{const n=[...shippingRates]; n[i]['fee'+s]=Number(e.target.value); setShippingRates(n);}} className="w-20 h-10 bg-[#FBFAF9] border border-transparent focus:border-[#2D4B3E] focus:bg-white rounded-xl p-2 mx-auto block text-right font-bold text-[13px] outline-none transition-all"/></td>)}
                    {shippingSizes.map(s => <td key={'c'+s} className="p-2 border-l border-blue-100 bg-blue-50/10"><input type="number" value={r['cool'+s]||0} onChange={(e)=>{const n=[...shippingRates]; n[i]['cool'+s]=Number(e.target.value); setShippingRates(n);}} className="w-20 h-10 bg-white border border-blue-100 focus:border-blue-500 rounded-xl p-2 mx-auto block text-right text-blue-600 font-bold text-[13px] outline-none transition-all"/></td>)}
                    <td className="p-2 text-center border-l border-[#EAEAEA]"><button onClick={()=>{if(confirm(`${r.region}の行を削除しますか？`)){setShippingRates(shippingRates.filter((_, idx)=>idx!==i))}}} className="w-8 h-8 rounded-full flex items-center justify-center text-red-300 hover:bg-red-50 hover:text-red-500 transition-colors mx-auto"><Trash2 size={16}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRulesTab = () => {
    // 立札プレビューのロジック（御開店を消し、御供カラーを適用）
    const isGokuyu = ['p1', 'p3', 'p4'].includes(selectedPreviewTate.id);
    const topPrefixText = isGokuyu ? (selectedPreviewTate.id === 'p1' ? '御供' : '供') : '祝';
    const topColor = isGokuyu ? 'text-gray-500' : 'text-red-600';
    const isP6orP8 = selectedPreviewTate.id.includes('p6') || selectedPreviewTate.id.includes('p8');
    const isP4 = selectedPreviewTate.id.includes('p4');
    const verticalClass = selectedPreviewTate.layout === 'vertical' ? '[writing-mode:vertical-rl]' : '';

    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-8 text-left">
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><LayoutTemplate size={20}/> 立札デザイン・店舗紐付け</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#999999] tracking-widest">店舗ごとの使用テンプレート選択</label>
              {shops.length === 0 ? <p className="text-sm text-[#999999] bg-[#FBFAF9] p-8 rounded-2xl text-center border-dashed border-2">店舗を先に登録してください</p> : shops.map(shop => (
                <div key={shop.id} className="bg-[#FBFAF9] p-5 rounded-[24px] border border-[#EAEAEA] space-y-3">
                  <span className="font-black text-[14px] text-[#2D4B3E]">{shop.name}</span>
                  <div className="flex flex-col gap-2">
                    {tateMaster.map(tate => (
                      <label key={tate.id} className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-xl border border-transparent hover:border-[#2D4B3E] transition-all shadow-sm">
                        <input type="checkbox" checked={(shop.enabledTatePatterns || []).includes(tate.id)} onChange={(e)=>{
                          const current = shop.enabledTatePatterns || [];
                          const next = e.target.checked ? [...current, tate.id] : current.filter(p=>p!==tate.id);
                          setShops(shops.map(s=>s.id===shop.id?{...s, enabledTatePatterns:next}:s));
                        }} className="accent-[#2D4B3E] w-4 h-4"/>
                        <span className="text-[12px] font-bold flex-1 text-[#555555]">{tate.label}</span>
                        <button onClick={(e)=>{e.preventDefault(); setSelectedPreviewTate(tate)}} className="text-[10px] font-bold bg-[#F7F7F7] px-3 py-1.5 rounded-lg text-[#2D4B3E] hover:bg-[#2D4B3E] hover:text-white transition-all">確認</button>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="sticky top-24 h-fit bg-[#FBFAF9] p-8 rounded-[32px] border border-[#EAEAEA] text-center space-y-6">
              <span className="text-[11px] font-bold text-[#999999] tracking-widest block">プレビュー ({selectedPreviewTate.label})</span>
              <div className={`relative bg-white shadow-xl mx-auto border overflow-hidden flex flex-col items-center font-serif ${selectedPreviewTate.layout==='horizontal'?'aspect-[1.414/1] h-[220px] justify-center p-6':'aspect-[9/16] h-[360px] pt-8 px-4'}`}>
                <div className={`font-black ${topColor} ${selectedPreviewTate.layout==='horizontal'?'text-[28px] mb-4':'text-[40px] mb-8 leading-none'}`}>{topPrefixText}</div>
                <div className={`flex w-full font-bold text-gray-900 ${selectedPreviewTate.layout==='horizontal'?'flex-col items-center gap-2 text-[16px]':'flex-row-reverse justify-center gap-6 text-[18px]'}`}>
                  {isP6orP8 ? (
                    <><div className={`tracking-widest ${verticalClass}`}>株式会社〇〇様</div>{!isGokuyu && <div className={`tracking-widest ${verticalClass}`}>御開店</div>}<div className={`tracking-widest ${verticalClass}`}>代表 山田太郎</div></>
                  ) : isP4 ? (
                    <><div className={`tracking-widest ${verticalClass}`}>株式会社〇〇</div><div className={`text-[14px] font-normal ${selectedPreviewTate.layout==='horizontal'?'mt-2':'mt-4 [writing-mode:vertical-rl]'}`}>代表 山田太郎</div></>
                  ) : (
                    <>{!isGokuyu && <div className={`tracking-widest ${verticalClass}`}>御開店</div>}<div className={`tracking-widest ${verticalClass}`}>代表 山田太郎</div></>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderStaffOrderTab = () => (
    <div className="bg-white rounded-[32px] border p-8 md:p-12 shadow-sm space-y-8 animate-in fade-in text-left">
      <h2 className="text-[20px] font-black text-[#2D4B3E] flex items-center gap-2 border-b pb-4"><Clock size={24}/> 代理入力（店舗受付）の特別ルール</h2>
      <div className="space-y-4">
        {[
          { label: '最短納期の制限を完全に無視する', sub: 'オンにすると、当日や明日の注文も強制的にカレンダーで選択可能になります', key: 'ignoreLeadTime' },
          { label: '注文金額の自由入力を許可', sub: '選択肢以外の任意の金額（例：5432円）を直接入力できるようにします', key: 'allowCustomPrice' }
        ].map(item => (
          <label key={item.key} className="flex items-center justify-between bg-[#FBFAF9] p-6 rounded-[24px] cursor-pointer group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-[#EAEAEA]">
            <div><span className="font-bold block text-[15px] group-hover:text-[#2D4B3E] transition-colors">{item.label}</span><span className="text-[11px] text-[#999999] font-bold mt-1 block">{item.sub}</span></div>
            <input type="checkbox" checked={staffOrderConfig[item.key]} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, [item.key]:e.target.checked})} className="w-6 h-6 accent-[#2D4B3E]"/>
          </label>
        ))}
        <label className="flex items-center justify-between bg-[#FBFAF9] p-6 rounded-[24px] cursor-pointer group hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-[#EAEAEA]">
          <div><span className="font-bold block text-[15px] group-hover:text-[#2D4B3E] transition-colors">お客様への自動返信メールを送らない</span><span className="text-[11px] text-[#999999] font-bold mt-1 block">代理入力時は、送信完了後の自動メールを停止します</span></div>
          <input type="checkbox" checked={!staffOrderConfig.sendAutoReply} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, sendAutoReply:!e.target.checked})} className="w-6 h-6 accent-[#2D4B3E]"/>
        </label>
        <div className="pt-6 space-y-2"><label className="text-[12px] font-bold text-[#999999] tracking-widest">スタッフ専用 支払い方法リスト（カンマ区切り）</label><input type="text" value={(staffOrderConfig.paymentMethods||[]).join(', ')} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, paymentMethods:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 text-[14px] font-bold outline-none focus:border-[#2D4B3E] focus:bg-white transition-colors"/></div>
      </div>
    </div>
  );

  const renderStaffTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-6 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><User size={20}/> スタッフ管理</h2>
      <div className="space-y-3">
        {staffList.map((s, i) => (
          <div key={i} className="flex justify-between items-center bg-[#FBFAF9] p-4 rounded-2xl border hover:bg-white transition-all">
            <div className="flex flex-col"><span className="font-bold text-[14px]">{s.name}</span><span className="text-[9px] text-[#999999] font-bold uppercase tracking-tight">所属: {s.store === 'all' ? '全店舗共通' : shops.find(sh=>sh.id===Number(s.store))?.name || s.store}</span></div>
            <button onClick={()=>setStaffList(staffList.filter((_,idx)=>idx!==i))} className="text-red-300 hover:text-red-500 px-2"><Trash2 size={18}/></button>
          </div>
        ))}
        <div className="flex flex-col md:flex-row gap-2 pt-4 border-t">
          <input type="text" placeholder="氏名" value={newStaffName} onChange={(e)=>setNewStaffName(e.target.value)} className="flex-[2] h-12 bg-[#FBFAF9] border rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E]"/>
          <select value={newStaffStore} onChange={(e)=>setNewStaffStore(e.target.value)} className="flex-1 h-12 bg-[#FBFAF9] border rounded-xl px-4 text-[12px] font-bold outline-none"><option value="all">全店舗共通</option>{shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>
          <button onClick={()=>{if(newStaffName.trim()){setStaffList([...staffList,{name:newStaffName, store:newStaffStore}]); setNewStaffName('');}}} className="bg-[#2D4B3E] text-white px-6 h-12 rounded-xl font-bold text-[13px] shadow-sm hover:bg-[#1f352b]">追加</button>
        </div>
      </div>
    </div>
  );

  const renderMessageTab = () => (
    <div className="bg-white rounded-[32px] border p-8 md:p-12 shadow-sm space-y-8 animate-in fade-in text-left">
      <h2 className="text-[20px] font-black text-[#2D4B3E] flex items-center gap-2 border-b pb-4"><Mail size={24}/> 自動返信メール設定</h2>
      <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 text-[12px] text-orange-800 space-y-2">
        <p className="font-bold flex items-center gap-2"><AlertCircle size={16}/> 利用可能な埋め込みタグ</p>
        <div className="flex flex-wrap gap-2">{['{ShopName}', '{CustomerName}', '{OrderDetails}', '{ShopPhone}', '{ShopAddress}'].map(tag => <span key={tag} className="bg-white px-2 py-1 rounded-md border border-orange-200 font-mono shadow-sm">{tag}</span>)}</div>
      </div>
      <div className="space-y-6">
        <div className="space-y-2"><label className="text-[12px] font-bold text-[#999999] tracking-widest">メール件名</label><input type="text" value={autoReply.subject} onChange={(e)=>setAutoReply({...autoReply, subject:e.target.value})} className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 text-[15px] font-bold outline-none focus:border-[#2D4B3E] focus:bg-white transition-colors"/></div>
        <div className="space-y-2"><label className="text-[12px] font-bold text-[#999999] tracking-widest">メール本文</label><textarea value={autoReply.body} onChange={(e)=>setAutoReply({...autoReply, body:e.target.value})} className="w-full h-96 bg-[#FBFAF9] border border-[#EAEAEA] rounded-[24px] p-6 text-[14px] font-bold outline-none resize-none leading-relaxed focus:border-[#2D4B3E] focus:bg-white transition-colors" /></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-left pb-40">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-6 md:px-12 sticky top-0 z-50">
        <h1 className="text-[16px] font-bold text-[#2D4B3E] tracking-tight">システム設定</h1>
        <div className="hidden md:flex flex-1 mx-6 overflow-x-auto bg-[#F7F7F7] p-1 rounded-xl border hide-scrollbar">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {!isAdmin ? (
            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border shadow-sm">
              <input type="password" placeholder="Pass" value={adminPassword} onChange={(e)=>setAdminPassword(e.target.value)} className="w-16 h-8 px-2 bg-[#FBFAF9] text-[11px] font-bold outline-none rounded-lg border"/>
              <button onClick={handleLogin} className="px-3 h-8 bg-[#2D4B3E] text-white text-[11px] font-bold rounded-lg">解除</button>
            </div>
          ) : (
            <button onClick={saveSettings} disabled={isSaving} className={`px-6 py-2.5 rounded-xl text-[12px] font-bold tracking-widest shadow-md transition-all ${isSaving ? 'bg-gray-400' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b]'}`}>{isSaving ? '保存中...' : '変更を保存'}</button>
          )}
        </div>
      </header>

      <div className="md:hidden flex overflow-x-auto bg-white border-b p-2 hide-scrollbar sticky top-20 z-40 shadow-sm">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-4 py-2 text-[12px] font-bold rounded-lg ${activeTab === t.id ? 'bg-[#2D4B3E] text-white shadow-md' : 'text-[#999999]'}`}>{t.label}</button>
        ))}
      </div>

      <main className={`flex-1 max-w-[1000px] mx-auto w-full py-10 px-4 md:px-8 transition-all ${!isAdmin ? 'opacity-40 pointer-events-none grayscale-[30%]' : ''}`}>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'shop' && renderShopTab()}
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'shipping' && renderShippingTab()}
        {activeTab === 'rules' && renderRulesTab()}
        {activeTab === 'staff_order' && renderStaffOrderTab()}
        {activeTab === 'staff' && renderStaffTab()}
        {activeTab === 'message' && renderMessageTab()}
      </main>
      
      {/* 立札用 明朝体フォントの読み込み */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&display=swap');
        .font-serif { font-family: 'Noto Serif JP', serif; }
      `}</style>
    </div>
  );
}