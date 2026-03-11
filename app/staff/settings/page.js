'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Settings as SettingsIcon, ListChecks, Store, Tag, Truck, User, Mail, 
  Trash2, Plus, Clock, ShieldCheck, MapPin, Box, Calendar as CalendarIcon, 
  RotateCcw, Image as ImageIcon, CheckCircle, Percent
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // --- 状態管理 (失われた全設定を完全復元) ---
  const [generalConfig, setGeneralConfig] = useState({ 
    appName: 'FLORIX', logoUrl: '', logoSize: 100, logoTransparent: false, slipBgUrl: '', slipBgOpacity: 50 
  });
  const [shops, setShops] = useState([]); 
  const [flowerItems, setFlowerItems] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffStore, setNewStaffStore] = useState('all');
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [shippingRates, setShippingRates] = useState([]); 
  const [boxFeeConfig, setBoxFeeConfig] = useState({ 
    type: 'flat', flatFee: 500, priceTiers: [], itemFees: {}, 
    freeShippingThresholdEnabled: false, freeShippingThreshold: 15000, 
    isBundleDiscount: true, coolBinEnabled: true, coolBinPeriods: [],
    returnFeeType: 'flat', returnFeeValue: 1000 
  });
  const [autoReply, setAutoReply] = useState({ subject: '', body: '' });
  const [staffOrderConfig, setStaffOrderConfig] = useState({ 
    ignoreLeadTime: true, allowCustomPrice: true, paymentMethods: [], sendAutoReply: false 
  });
  const [statusConfig, setStatusConfig] = useState({ type: 'template', customLabels: [] });

  const tabs = [
    { id: 'general', label: '基本設定', icon: SettingsIcon },
    { id: 'status', label: 'ステータス', icon: ListChecks },
    { id: 'shop', label: '店舗・営業日', icon: Store }, 
    { id: 'items', label: '商品・納期', icon: Tag },
    { id: 'shipping', label: '配送・送料', icon: Truck },
    { id: 'staff_order', label: '店舗注文受付', icon: Clock },
    { id: 'staff', label: 'スタッフ', icon: User },
    { id: 'message', label: '自動返信', icon: Mail },
  ];

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data?.settings_data) {
          const s = data.settings_data;
          setGeneralConfig(s.generalConfig || generalConfig);
          setStatusConfig(s.statusConfig || statusConfig);
          setShops(s.shops || []);
          setFlowerItems(s.flowerItems || []);
          setStaffList(s.staffList || []);
          setDeliveryAreas(s.deliveryAreas || []);
          setShippingRates(s.shippingRates || []);
          setBoxFeeConfig(s.boxFeeConfig || boxFeeConfig);
          setStaffOrderConfig(s.staffOrderConfig || staffOrderConfig);
          setAutoReply(s.autoReply || autoReply);
        }
      } catch (error) { console.error('読込失敗:', error); }
    }
    loadSettings();
  }, []);

  const handleLogin = () => {
    if (adminPassword === '7777') setIsAdmin(true);
    else alert('パスワードが違います。');
  };

  const saveSettings = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const settingsData = { generalConfig, statusConfig, shops, flowerItems, staffList, deliveryAreas, shippingRates, boxFeeConfig, autoReply, staffOrderConfig };
      await supabase.from('app_settings').upsert({ id: 'default', settings_data: settingsData });
      alert('すべての設定を保存しました！');
    } catch (error) { alert('保存失敗'); } finally { setIsSaving(false); }
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setGeneralConfig({ ...generalConfig, [field]: event.target.result });
    reader.readAsDataURL(file);
  };

  // --- タブ別レンダリング ---

  const renderGeneralTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-8">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><ImageIcon size={20}/> ロゴ・基本設定</h2>
        <div className="space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-[12px] font-bold text-[#999999]">アプリ名</label>
            <input type="text" value={generalConfig.appName} onChange={(e) => setGeneralConfig({...generalConfig, appName: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none" />
          </div>
          <div className="space-y-4 text-left">
            <label className="text-[12px] font-bold text-[#999999]">店舗ロゴ</label>
            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logoUrl')} className="block w-full text-xs" />
            {generalConfig.logoUrl && (
              <div className="p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold">サイズ: {generalConfig.logoSize}%</span>
                  <input type="range" min="30" max="150" value={generalConfig.logoSize} onChange={(e) => setGeneralConfig({...generalConfig, logoSize: Number(e.target.value)})} className="w-48 accent-[#2D4B3E]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold">白背景を透過</span>
                  <button onClick={() => setGeneralConfig({...generalConfig, logoTransparent: !generalConfig.logoTransparent})} className={`w-12 h-6 rounded-full transition-all ${generalConfig.logoTransparent ? 'bg-[#2D4B3E]' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-all ${generalConfig.logoTransparent ? 'translate-x-6' : ''}`} />
                  </button>
                </div>
                <div className="flex justify-center border-t pt-4"><img src={generalConfig.logoUrl} style={{ width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal' }} className="max-h-20 object-contain" /></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatusTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6 text-left">
        <h2 className="text-[18px] font-bold text-[#2D4B3E]">受注ステータス設定</h2>
        <div className="flex gap-2 p-1 bg-[#F7F7F7] rounded-xl mb-4">
          {['template', 'custom'].map(t => (
            <button key={t} onClick={() => setStatusConfig({...statusConfig, type: t})} className={`flex-1 py-3 rounded-lg font-bold text-[12px] ${statusConfig.type === t ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>{t === 'template' ? '標準' : 'カスタム'}</button>
          ))}
        </div>
        {statusConfig.type === 'custom' && (
          <div className="space-y-3">
            {statusConfig.customLabels.map((l, i) => (
              <div key={i} className="flex gap-2"><input type="text" value={l} onChange={(e) => { const n = [...statusConfig.customLabels]; n[i] = e.target.value; setStatusConfig({...statusConfig, customLabels: n}); }} className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none" /><button onClick={() => setStatusConfig({...statusConfig, customLabels: statusConfig.customLabels.filter((_, idx) => idx !== i)})} className="text-red-300 p-2"><Trash2 size={18}/></button></div>
            ))}
            <button onClick={() => setStatusConfig({...statusConfig, customLabels: [...statusConfig.customLabels, '新状態']})} className="w-full py-3 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#999999]">+ 項目を追加</button>
          </div>
        )}
      </div>
    </div>
  );

  const renderShopTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {shops.map((shop) => (
        <div key={shop.id} className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm relative space-y-6 text-left">
          <button onClick={() => setShops(shops.filter(s => s.id !== shop.id))} className="absolute top-6 right-6 text-red-300"><Trash2 size={20}/></button>
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Store size={20}/> {shop.name || '名称未設定'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">店舗名</label><input type="text" value={shop.name} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, name: e.target.value} : s))} className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none" /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">電話番号</label><input type="tel" value={shop.phone} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, phone: e.target.value} : s))} className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none" /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">郵便番号</label><input type="text" value={shop.zip} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, zip: e.target.value} : s))} className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none" placeholder="000-0000" /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">住所</label><input type="text" value={shop.address} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, address: e.target.value} : s))} className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none" /></div>
          </div>
          <div className="pt-4 border-t border-[#FBFAF9] space-y-4">
            <div className="flex justify-between items-center"><label className="text-[12px] font-bold text-[#2D4B3E]">特別営業日・休業設定</label><button onClick={() => setShops(shops.map(s => s.id === shop.id ? {...s, specialHours: [...(s.specialHours || []), {id:Date.now(), date:'', type:'closed', note:''}]} : s))} className="text-[10px] bg-[#2D4B3E] text-white px-3 py-1 rounded-full">+ 追加</button></div>
            {(shop.specialHours || []).map(sh => (
              <div key={sh.id} className="flex flex-wrap gap-2 items-center bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA]">
                <input type="date" value={sh.date} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, specialHours: s.specialHours.map(h => h.id === sh.id ? {...h, date:e.target.value} : h)} : s))} className="h-9 px-2 rounded border border-[#EAEAEA] text-[11px] font-bold" />
                <select value={sh.type} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, specialHours: s.specialHours.map(h => h.id === sh.id ? {...h, type:e.target.value} : h)} : s))} className="h-9 px-2 rounded border border-[#EAEAEA] text-[11px] font-bold"><option value="closed">終日休業</option><option value="open">臨時営業</option></select>
                <input type="text" placeholder="理由メモ" value={sh.note} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, specialHours: s.specialHours.map(h => h.id === sh.id ? {...h, note:e.target.value} : h)} : s))} className="flex-1 h-9 px-3 rounded border border-[#EAEAEA] text-[11px]" />
                <button onClick={() => setShops(shops.map(s => s.id === shop.id ? {...s, specialHours: s.specialHours.filter(h => h.id !== sh.id)} : s))} className="text-red-400">×</button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => setShops([...shops, {id:Date.now(), name:'', phone:'', zip:'', address:'', invoiceNumber:'', specialHours:[]}])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold text-[13px] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">+ 新しい店舗を登録</button>
    </div>
  );

  const renderItemsTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {flowerItems.map(item => (
        <div key={item.id} className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm relative space-y-6 text-left">
          <button onClick={() => setFlowerItems(flowerItems.filter(i => i.id !== item.id))} className="absolute top-8 right-8 text-red-300"><Trash2 size={20}/></button>
          <input type="text" value={item.name} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, name: e.target.value} : i))} className="w-full h-12 bg-transparent border-b-2 border-[#F7F7F7] text-[20px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="商品名" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={16}/> 納期設定</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#FBFAF9] p-3 rounded-2xl"><label className="text-[9px] font-bold block text-[#999999]">通常納期</label><div className="flex items-center gap-1"><input type="number" value={item.normalLeadDays} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, normalLeadDays: Number(e.target.value)} : i))} className="w-full bg-transparent font-bold text-[16px] outline-none" /><span>日後</span></div></div>
                <div className="bg-[#FBFAF9] p-3 rounded-2xl"><label className="text-[9px] font-bold block text-[#999999]">配送納期</label><div className="flex items-center gap-1"><input type="number" value={item.shippingLeadDays} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, shippingLeadDays: Number(e.target.value)} : i))} className="w-full bg-transparent font-bold text-[16px] outline-none" /><span>日後</span></div></div>
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><ShieldCheck size={16}/> 持ち込み・返却</p>
              <div className="space-y-3">
                {['canBringFlowers', 'canBringVase'].map(key => (
                  <div key={key} className="bg-[#FBFAF9] p-4 rounded-2xl space-y-3 border border-transparent hover:border-[#EAEAEA] transition-all">
                    <label className="flex items-center justify-between cursor-pointer"><span className="text-[12px] font-bold">{key === 'canBringFlowers' ? '花材持込を許可' : '花器持込を許可'}</span><input type="checkbox" checked={item[key]} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, [key]: e.target.checked} : i))} className="accent-[#2D4B3E] w-4 h-4" /></label>
                    {item[key] && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-white animate-in slide-in-from-top-1">
                        <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-[#999999]">持込時納期</span><div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#EAEAEA]"><input type="number" value={item[key + 'LeadDays'] || 7} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, [key + 'LeadDays']: Number(e.target.value)} : i))} className="w-8 text-center font-bold text-[12px] outline-none" /><span className="text-[10px]">日後</span></div></div>
                        <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-[#999999]">器の返却</span><select value={item[key + 'Return'] ? 'yes' : 'no'} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, [key + 'Return']: e.target.value === 'yes'} : i))} className="text-[11px] font-bold bg-white border border-[#EAEAEA] rounded-lg px-2 py-1 outline-none"><option value="no">返却なし</option><option value="yes">返却あり</option></select></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => setFlowerItems([...flowerItems, {id:Date.now(), name:'', normalLeadDays:2, shippingLeadDays:3, canBringFlowers:false, canBringVase:false}])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">+ 商品を追加</button>
    </div>
  );

  const renderShippingTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-8 text-left">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-4">配送・送料設定</h2>
        
        {/* 返却送料設定 */}
        <div className="bg-[#2D4B3E]/5 p-6 rounded-[24px] border border-[#2D4B3E]/10 space-y-4">
          <div className="flex items-center gap-2 font-bold text-[#2D4B3E]"><RotateCcw size={18}/> 器返却時の送料加算</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">計算タイプ</label><select value={boxFeeConfig.returnFeeType} onChange={(e) => setBoxFeeConfig({...boxFeeConfig, returnFeeType: e.target.value})} className="w-full h-11 bg-white border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none"><option value="flat">固定金額を加算</option><option value="percent">送料の○%を加算</option></select></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">{boxFeeConfig.returnFeeType === 'flat' ? '金額 (¥)' : '率 (%)'}</label><input type="number" value={boxFeeConfig.returnFeeValue} onChange={(e) => setBoxFeeConfig({...boxFeeConfig, returnFeeValue: Number(e.target.value)})} className="w-full h-11 bg-white border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none" /></div>
          </div>
        </div>

        {/* 地方別・サイズ別送料テーブル */}
        <div className="pt-6 space-y-4">
          <p className="text-[14px] font-bold text-[#2D4B3E]">サイズ別・地方別送料マスタ</p>
          <div className="overflow-x-auto border border-[#EAEAEA] rounded-2xl">
            <table className="w-full text-left text-[11px] min-w-[600px]">
              <thead className="bg-[#FBFAF9] border-b text-[#999999]"><tr><th className="p-3">地方</th><th className="p-3">80サイズ</th><th className="p-3">100サイズ</th><th className="p-3">120サイズ</th><th className="p-3">クール便</th></tr></thead>
              <tbody className="divide-y divide-[#FBFAF9]">
                {shippingRates.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="p-3 font-bold">{r.region}</td>
                    <td className="p-2"><input type="number" value={r.fee80 || 0} onChange={(e) => { const n = [...shippingRates]; n[i].fee80 = Number(e.target.value); setShippingRates(n); }} className="w-20 border rounded-lg p-1.5 font-bold" /></td>
                    <td className="p-2"><input type="number" value={r.fee100 || 0} onChange={(e) => { const n = [...shippingRates]; n[i].fee100 = Number(e.target.value); setShippingRates(n); }} className="w-20 border rounded-lg p-1.5 font-bold" /></td>
                    <td className="p-2"><input type="number" value={r.fee120 || 0} onChange={(e) => { const n = [...shippingRates]; n[i].fee120 = Number(e.target.value); setShippingRates(n); }} className="w-20 border rounded-lg p-1.5 font-bold" /></td>
                    <td className="p-2"><input type="number" value={r.coolFee || 0} onChange={(e) => { const n = [...shippingRates]; n[i].coolFee = Number(e.target.value); setShippingRates(n); }} className="w-20 border rounded-lg p-1.5 font-bold text-blue-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStaffOrderTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6 text-left">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={20}/> 代理入力（店舗受付）ルール</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between bg-[#FBFAF9] p-5 rounded-[24px] cursor-pointer group">
            <div><span className="text-[14px] font-bold block group-hover:text-[#2D4B3E] transition-colors">納期制限を完全に無視する</span><span className="text-[10px] text-[#999999] font-bold">当日・翌日の注文をシステムで強制許可します</span></div>
            <input type="checkbox" checked={staffOrderConfig.ignoreLeadTime} onChange={(e) => setStaffOrderConfig({...staffOrderConfig, ignoreLeadTime: e.target.checked})} className="accent-[#2D4B3E] w-5 h-5" />
          </label>
        </div>
      </div>
    </div>
  );

  const renderStaffTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6 text-left">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><User size={20}/> スタッフ所属設定</h2>
        <div className="space-y-3">
          {staffList.map((s, i) => (
            <div key={i} className="flex justify-between items-center bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA]">
              <div className="flex flex-col">
                <span className="font-bold text-[14px]">{s.name}</span>
                <span className="text-[10px] text-[#999999] font-bold uppercase">所属: {s.store === 'all' ? '全店舗共通' : shops.find(shop => shop.id === Number(s.store))?.name || s.store}</span>
              </div>
              <button onClick={() => setStaffList(staffList.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-500"><Trash2 size={18}/></button>
            </div>
          ))}
          <div className="flex flex-col md:flex-row gap-2 pt-4 border-t border-[#FBFAF9]">
            <input type="text" placeholder="名前" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} className="flex-[2] h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none" />
            <select value={newStaffStore} onChange={(e) => setNewStaffStore(e.target.value)} className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[12px] font-bold outline-none">
              <option value="all">全店舗共通</option>
              {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
            </select>
            <button onClick={() => { if(newStaffName.trim()){ setStaffList([...staffList, {name:newStaffName, store:newStaffStore}]); setNewStaffName(''); } }} className="bg-[#2D4B3E] text-white px-6 h-12 rounded-xl font-bold text-[13px]">追加</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMessageTab = () => (
    <div className="space-y-8 animate-in fade-in text-left">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6">
        <h2 className="text-[18px] font-bold text-[#2D4B3E]">自動返信メール</h2>
        <div className="space-y-4">
          <input type="text" placeholder="件名" value={autoReply.subject} onChange={(e) => setAutoReply({...autoReply, subject: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none" />
          <textarea value={autoReply.body} onChange={(e) => setAutoReply({...autoReply, body: e.target.value})} className="w-full h-64 bg-[#FBFAF9] border border-[#EAEAEA] rounded-[24px] p-4 text-[13px] font-bold outline-none resize-none leading-relaxed" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-left">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-12 sticky top-0 z-50">
        <h1 className="text-[16px] font-bold text-[#2D4B3E] flex-shrink-0 tracking-tight">各種設定</h1>
        <div className="hidden md:flex flex-1 mx-6 overflow-x-auto bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] hide-scrollbar">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {!isAdmin ? (
            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border border-[#EAEAEA] shadow-sm">
              <input type="password" placeholder="7777" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-16 h-8 px-2 bg-[#FBFAF9] text-[11px] font-bold outline-none rounded-lg border border-[#EAEAEA]" />
              <button onClick={handleLogin} className="px-3 h-8 bg-[#2D4B3E] text-white text-[11px] font-bold rounded-lg">解除</button>
            </div>
          ) : (
            <button onClick={saveSettings} disabled={isSaving} className={`px-6 py-2.5 rounded-xl text-[12px] font-bold tracking-widest shadow-md transition-all ${isSaving ? 'bg-gray-400' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b]'}`}>{isSaving ? '保存中...' : '変更を保存'}</button>
          )}
        </div>
      </header>

      <div className="md:hidden flex overflow-x-auto bg-white border-b border-[#EAEAEA] p-2 hide-scrollbar sticky top-20 z-40 shadow-sm">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-4 py-2 text-[12px] font-bold rounded-lg ${activeTab === t.id ? 'bg-[#2D4B3E] text-white shadow-md' : 'text-[#999999]'}`}>{t.label}</button>
        ))}
      </div>

      <main className={`flex-1 max-w-[840px] mx-auto w-full py-10 px-6 transition-all ${!isAdmin ? 'opacity-40 pointer-events-none grayscale-[50%]' : ''}`}>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'shop' && renderShopTab()}
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'shipping' && renderShippingTab()}
        {activeTab === 'staff_order' && renderStaffOrderTab()}
        {activeTab === 'staff' && renderStaffTab()}
        {activeTab === 'message' && renderMessageTab()}
        <div className="h-40"></div>
      </main>
    </div>
  );
}