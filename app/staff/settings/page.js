'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Settings as SettingsIcon, ListChecks, Store, Tag, Truck, User, Mail, 
  Trash2, Plus, Clock, ShieldCheck, RotateCcw, ImageIcon, Ruler, Percent, ChevronRight
} from 'lucide-react';

export default function SettingsPage() {
  // --- 基本状態 ---
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // --- 1. 基本設定 (ロゴ・透過・サイズ) ---
  const [generalConfig, setGeneralConfig] = useState({ 
    appName: 'FLORIX', logoUrl: '', logoSize: 100, logoTransparent: false, slipBgUrl: '', slipBgOpacity: 50 
  });

  // --- 2. ステータス設定 ---
  const [statusConfig, setStatusConfig] = useState({ type: 'template', customLabels: [] });

  // --- 3. 店舗管理 (有無・住所・通常/配達時間・特別日) ---
  const [shops, setShops] = useState([]); 

  // --- 4. 商品管理 (納期・持込納期・返却の有無) ---
  const [flowerItems, setFlowerItems] = useState([]);

  // --- 5. 配送・送料 (自社配達・業者配送・サイズ追加・クール便サイズ別・返却送料) ---
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [shippingSizes, setShippingSizes] = useState(['80', '100', '120']);
  const [shippingRates, setShippingRates] = useState([]); 
  const [boxFeeConfig, setBoxFeeConfig] = useState({ 
    returnFeeType: 'flat', returnFeeValue: 1000, coolBinEnabled: true, coolBinPeriods: [], freeShippingThresholdEnabled: false, freeShippingThreshold: 15000 
  });

  // --- 6. スタッフ & 7. 代理入力 & 8. メール ---
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffStore, setNewStaffStore] = useState('all');
  const [staffOrderConfig, setStaffOrderConfig] = useState({ ignoreLeadTime: true, allowCustomPrice: true, paymentMethods: [], sendAutoReply: false });
  const [autoReply, setAutoReply] = useState({ subject: '', body: '' });

  // タブ定義 (ReferenceError回避のため関数外に置くかここで定義)
  const tabs = [
    { id: 'general', label: '基本設定', icon: SettingsIcon },
    { id: 'status', label: 'ステータス', icon: ListChecks },
    { id: 'shop', label: '店舗・営業日', icon: Store }, 
    { id: 'items', label: '商品・納期', icon: Tag },
    { id: 'shipping', label: '配送・送料', icon: Truck },
    { id: 'staff_order', label: '店舗注文受付', icon: Clock },
    { id: 'staff', label: 'スタッフ', icon: User },
    { id: 'message', label: '通知メール', icon: Mail },
  ];

  // --- データ読み込み ---
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data?.settings_data) {
          const s = data.settings_data;
          if (s.generalConfig) setGeneralConfig(s.generalConfig);
          if (s.statusConfig) setStatusConfig(s.statusConfig);
          if (s.shops) setShops(s.shops);
          if (s.flowerItems) setFlowerItems(s.flowerItems);
          if (s.staffList) setStaffList(s.staffList);
          if (s.deliveryAreas) setDeliveryAreas(s.deliveryAreas);
          if (s.shippingSizes) setShippingSizes(s.shippingSizes);
          if (s.shippingRates) setShippingRates(s.shippingRates);
          if (s.boxFeeConfig) setBoxFeeConfig(s.boxFeeConfig);
          if (s.staffOrderConfig) setStaffOrderConfig(s.staffOrderConfig);
          if (s.autoReply) setAutoReply(s.autoReply);
        }
      } catch (e) { console.error(e); }
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

  // --- タブ別レンダリング関数 (これらをバラバラに定義することでエラーを防ぐ) ---

  const GeneralTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-8 animate-in fade-in">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><ImageIcon size={20}/> 基本情報・ロゴ</h2>
      <div className="space-y-6">
        <div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">アプリ名</label><input type="text" value={generalConfig.appName} onChange={(e)=>setGeneralConfig({...generalConfig, appName: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border rounded-xl px-4 font-bold outline-none"/></div>
        <div className="space-y-4">
          <label className="text-[11px] font-bold text-[#999999]">ロゴ画像アップロード</label>
          <input type="file" accept="image/*" onChange={(e)=>handleImg(e, 'logoUrl')} className="block w-full text-xs" />
          {generalConfig.logoUrl && (
            <div className="p-6 bg-[#FBFAF9] rounded-2xl border space-y-4">
               <div className="flex items-center justify-between"><span className="text-[12px] font-bold">ロゴサイズ: {generalConfig.logoSize}%</span><input type="range" min="30" max="150" value={generalConfig.logoSize} onChange={(e)=>setGeneralConfig({...generalConfig, logoSize: Number(e.target.value)})} className="w-40 accent-[#2D4B3E]"/></div>
               <div className="flex items-center justify-between"><span className="text-[12px] font-bold">白背景を透過</span><button onClick={()=>setGeneralConfig({...generalConfig, logoTransparent: !generalConfig.logoTransparent})} className={`w-12 h-6 rounded-full transition-all ${generalConfig.logoTransparent ? 'bg-[#2D4B3E]' : 'bg-gray-300'}`}><div className={`w-4 h-4 bg-white rounded-full mx-1 transition-all ${generalConfig.logoTransparent ? 'translate-x-6' : ''}`}/></button></div>
               <div className="flex justify-center border-t pt-4 bg-white rounded-lg"><img src={generalConfig.logoUrl} style={{width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal'}} className="max-h-24 object-contain"/></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const ShopTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {shops.map(shop => (
        <div key={shop.id} className="bg-white rounded-[32px] border p-8 shadow-sm relative space-y-6">
          <button onClick={()=>setShops(shops.filter(s=>s.id!==shop.id))} className="absolute top-6 right-6 text-red-300"><Trash2 size={20}/></button>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={shop.isActive} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, isActive:e.target.checked}:s))} className="w-5 h-5 accent-[#2D4B3E]"/>
            <h2 className="text-[18px] font-bold text-[#2D4B3E]">{shop.name || '名称未設定'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">店舗名</label><input type="text" value={shop.name} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, name:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">電話番号</label><input type="text" value={shop.phone} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, phone:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">郵便番号</label><input type="text" value={shop.zip} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, zip:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none" placeholder="000-0000"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">住所</label><input type="text" value={shop.address} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, address:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none"/></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-[#FBFAF9]">
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={14}/> 営業時間・特別スケジュール</label>
              <div className="flex gap-2 bg-[#FBFAF9] p-2 rounded-xl border mb-2">
                <input type="time" value={shop.openTime} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, openTime:e.target.value}:s))} className="border rounded p-1 text-xs"/><span>〜</span><input type="time" value={shop.closeTime} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, closeTime:e.target.value}:s))} className="border rounded p-1 text-xs"/>
              </div>
              {(shop.specialHours || []).map(sh => (
                <div key={sh.id} className="flex gap-1 items-center bg-[#FBFAF9] p-2 rounded-xl text-[9px]">
                  <input type="date" value={sh.date} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:s.specialHours.map(h=>h.id===sh.id?{...h, date:e.target.value}:h)}:s))} className="border p-1"/>
                  <select value={sh.type} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:s.specialHours.map(h=>h.id===sh.id?{...h, type:e.target.value}:h)}:s))} className="border p-1"><option value="closed">休業</option><option value="changed">変更</option></select>
                  <input type="text" placeholder="理由" value={sh.note} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:s.specialHours.map(h=>h.id===sh.id?{...h, note:e.target.value}:h)}:s))} className="flex-1 border p-1"/>
                  <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:s.specialHours.filter(h=>h.id!==sh.id)}:s))} className="text-red-400">×</button>
                </div>
              ))}
              <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:[...(s.specialHours||[]), {id:Date.now(), date:'', type:'closed'}]}:s))} className="w-full py-2 bg-[#FBFAF9] border-dashed border rounded-xl text-[10px]">+ 追加</button>
            </div>
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#D97C8F] flex items-center gap-2"><Truck size={14}/> 配達可能時間・特別スケジュール</label>
              <div className="flex gap-2 bg-[#D97C8F]/5 p-2 rounded-xl border mb-2">
                <input type="time" value={shop.deliveryOpenTime} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryOpenTime:e.target.value}:s))} className="border rounded p-1 text-xs"/><span>〜</span><input type="time" value={shop.deliveryCloseTime} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryCloseTime:e.target.value}:s))} className="border rounded p-1 text-xs"/>
              </div>
              {(shop.deliverySpecialHours || []).map(sh => (
                <div key={sh.id} className="flex gap-1 items-center bg-[#D97C8F]/5 p-2 rounded-xl text-[9px]">
                  <input type="date" value={sh.date} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:s.deliverySpecialHours.map(h=>h.id===sh.id?{...h, date:e.target.value}:h)}:s))} className="border p-1"/>
                  <select value={sh.type} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:s.deliverySpecialHours.map(h=>h.id===sh.id?{...h, type:e.target.value}:h)}:s))} className="border p-1"><option value="closed">休止</option><option value="changed">変更</option></select>
                  <input type="text" placeholder="理由" value={sh.note} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:s.deliverySpecialHours.map(h=>h.id===sh.id?{...h, note:e.target.value}:h)}:s))} className="flex-1 border p-1"/>
                  <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:s.deliverySpecialHours.filter(h=>h.id!==sh.id)}:s))} className="text-red-400">×</button>
                </div>
              ))}
              <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:[...(s.deliverySpecialHours||[]), {id:Date.now(), date:'', type:'closed'}]}:s))} className="w-full py-2 bg-[#D97C8F]/5 border-dashed border rounded-xl text-[10px]">+ 追加</button>
            </div>
          </div>
        </div>
      ))}
      <button onClick={()=>setShops([...shops, {id:Date.now(), name:'', isActive:true, specialHours:[], deliverySpecialHours:[]}])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold transition-all">+ 店舗を追加</button>
    </div>
  );

  const ItemsTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {flowerItems.map(item => (
        <div key={item.id} className="bg-white rounded-[32px] border p-8 shadow-sm relative space-y-6 text-left">
          <button onClick={()=>setFlowerItems(flowerItems.filter(i=>i.id!==item.id))} className="absolute top-8 right-8 text-red-300"><Trash2 size={20}/></button>
          <input type="text" value={item.name} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, name:e.target.value}:i))} className="w-full h-12 bg-transparent border-b-2 text-[20px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="商品名" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={16}/> 納期設定</p>
              <div className="space-y-2"><label className="text-[9px] font-bold text-[#999999]">通常納期 (日後)</label><input type="number" value={item.normalLeadDays} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, normalLeadDays:Number(e.target.value)}:i))} className="w-full bg-[#FBFAF9] border rounded-lg h-10 px-3 font-bold"/></div>
              <div className="space-y-2"><label className="text-[9px] font-bold text-[#999999]">配送納期 (日後)</label><input type="number" value={item.shippingLeadDays} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, shippingLeadDays:Number(e.target.value)}:i))} className="w-full bg-[#FBFAF9] border rounded-lg h-10 px-3 font-bold"/></div>
            </div>
            <div className="space-y-4">
              <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><ShieldCheck size={16}/> 持込設定</p>
              {['canBringFlowers', 'canBringVase'].map(key => (
                <div key={key} className="bg-[#FBFAF9] p-3 rounded-xl border space-y-2">
                  <label className="flex items-center justify-between text-[12px] font-bold">{key==='canBringFlowers'?'花材持込':'花器持込'}<input type="checkbox" checked={item[key]} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key]:e.target.checked}:i))} className="accent-[#2D4B3E]"/></label>
                  {item[key] && <div className="flex items-center justify-between text-[10px]"><span>納期</span><div className="flex items-center gap-1"><input type="number" value={item[key+'LeadDays']||7} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key+'LeadDays']:Number(e.target.value)}:i))} className="w-10 border rounded text-center"/>日後</div></div>}
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><RotateCcw size={16}/> 回収・返却</p>
              <div className="bg-[#FBFAF9] p-3 rounded-xl border space-y-2">
                <label className="flex items-center justify-between text-[12px] font-bold">器の回収/返却<input type="checkbox" checked={item.hasReturn} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, hasReturn:e.target.checked}:i))} className="accent-[#2D4B3E]"/></label>
                <p className="text-[9px] text-[#999999]">※持ち込みとは関係なく、商品ごとの返却要否を決定します。</p>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button onClick={()=>setFlowerItems([...flowerItems, {id:Date.now(), name:'', normalLeadDays:2, shippingLeadDays:3, canBringFlowers:false, hasReturn:false}])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold transition-all">+ 商品を追加</button>
    </div>
  );

  const ShippingTab = () => (
    <div className="space-y-8 animate-in fade-in text-left">
      <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-8">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] border-b pb-4 flex items-center gap-2"><Truck size={20}/> 配送・送料・返却設定</h2>
        <div className="space-y-4">
          <label className="text-[14px] font-bold text-[#2D4B3E]">自社配達エリア</label>
          <div className="space-y-2">
            {deliveryAreas.map(a => (
              <div key={a.id} className="flex gap-2 bg-[#FBFAF9] p-2 rounded-xl border">
                <input type="text" value={a.name} onChange={(e)=>setDeliveryAreas(deliveryAreas.map(x=>x.id===a.id?{...x, name:e.target.value}:x))} className="flex-[2] h-9 bg-white border rounded px-3 text-xs" placeholder="北区, 札幌市中央区など"/>
                <input type="number" value={a.fee} onChange={(e)=>setDeliveryAreas(deliveryAreas.map(x=>x.id===a.id?{...x, fee:Number(e.target.value)}:x))} className="flex-1 h-9 bg-white border rounded px-3 text-xs text-right"/>
                <button onClick={()=>setDeliveryAreas(deliveryAreas.filter(x=>x.id!==a.id))} className="text-red-300 px-2">×</button>
              </div>
            ))}
            <button onClick={()=>setDeliveryAreas([...deliveryAreas, {id:Date.now(), name:'', fee:0}])} className="text-[11px] font-bold text-[#2D4B3E]">+ エリア追加</button>
          </div>
        </div>

        <div className="bg-[#2D4B3E]/5 p-6 rounded-[24px] border space-y-4">
          <div className="font-bold text-[#2D4B3E] text-[14px] flex items-center gap-2"><RotateCcw size={16}/> 回収/返却時の送料加算</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">加算方法</label><select value={boxFeeConfig.returnFeeType} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, returnFeeType:e.target.value})} className="w-full h-10 bg-white border rounded-xl px-3 text-xs font-bold"><option value="flat">固定金額</option><option value="percent">基本送料の○%</option></select></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">加算値</label><input type="number" value={boxFeeConfig.returnFeeValue} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, returnFeeValue:Number(e.target.value)})} className="w-full h-10 bg-white border rounded-xl px-3 text-xs font-bold"/></div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex justify-between items-center"><label className="text-[14px] font-bold text-[#2D4B3E]">業者配送・サイズ別地方別送料</label><button onClick={()=>{const s=prompt('サイズを入力(例:140)'); if(s) setShippingSizes([...shippingSizes, s]);}} className="text-[10px] bg-[#2D4B3E] text-white px-3 py-1 rounded-full">+ サイズ追加</button></div>
          <div className="overflow-x-auto border rounded-2xl">
            <table className="w-full text-left text-[10px] min-w-[900px]">
              <thead className="bg-[#FBFAF9] border-b text-[#999999]"><tr><th className="p-3">地方</th>{shippingSizes.map(s=><th key={s} className="p-3 text-center">{s}サイズ</th>)}{shippingSizes.map(s=><th key={'c'+s} className="p-3 text-center text-blue-400">{s}クール</th>)}</tr></thead>
              <tbody className="divide-y">
                {shippingRates.map((r, i) => (
                  <tr key={i}>
                    <td className="p-3 font-bold bg-[#FBFAF9]/50">{r.region}</td>
                    {shippingSizes.map(s => <td key={s} className="p-1"><input type="number" value={r['fee'+s]||0} onChange={(e)=>{const n=[...shippingRates]; n[i]['fee'+s]=Number(e.target.value); setShippingRates(n);}} className="w-16 border rounded p-1 mx-auto block text-right font-bold"/></td>)}
                    {shippingSizes.map(s => <td key={'c'+s} className="p-1"><input type="number" value={r['cool'+s]||0} onChange={(e)=>{const n=[...shippingRates]; n[i]['cool'+s]=Number(e.target.value); setShippingRates(n);}} className="w-16 border rounded p-1 mx-auto block text-right text-blue-500 font-bold"/></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const StaffOrderTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-6 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={20}/> 代理入力（店舗受付）設定</h2>
      <div className="space-y-4">
        <label className="flex items-center justify-between bg-[#FBFAF9] p-4 rounded-2xl cursor-pointer"><div><span className="font-bold block text-[13px]">最短納期の制限を無視</span><span className="text-[10px] text-[#999999]">オンにすると、当日・翌日の注文も強制入力できます</span></div><input type="checkbox" checked={staffOrderConfig.ignoreLeadTime} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, ignoreLeadTime:e.target.checked})} className="w-5 h-5 accent-[#2D4B3E]"/></label>
        <label className="flex items-center justify-between bg-[#FBFAF9] p-4 rounded-2xl cursor-pointer"><div><span className="font-bold block text-[13px]">金額の自由入力を許可</span><span className="text-[10px] text-[#999999]">プルダウン以外の任意の金額を入力できます</span></div><input type="checkbox" checked={staffOrderConfig.allowCustomPrice} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, allowCustomPrice:e.target.checked})} className="w-5 h-5 accent-[#2D4B3E]"/></label>
        <label className="flex items-center justify-between bg-[#FBFAF9] p-4 rounded-2xl cursor-pointer"><div><span className="font-bold block text-[13px]">自動返信メールを送らない</span><span className="text-[10px] text-[#999999]">代理入力時はお客様への自動メールを停止します</span></div><input type="checkbox" checked={!staffOrderConfig.sendAutoReply} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, sendAutoReply:!e.target.checked})} className="w-5 h-5 accent-[#2D4B3E]"/></label>
        <div className="pt-4 space-y-1"><label className="text-[11px] font-bold text-[#999999]">支払い方法設定（カンマ区切り）</label><input type="text" value={staffOrderConfig.paymentMethods.join(', ')} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, paymentMethods:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none"/></div>
      </div>
    </div>
  );

  const StaffTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-6 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><User size={20}/> スタッフ管理</h2>
      <div className="space-y-3">
        {staffList.map((s, i) => (
          <div key={i} className="flex justify-between items-center bg-[#FBFAF9] p-4 rounded-2xl border">
            <div className="flex flex-col"><span className="font-bold text-[14px]">{s.name}</span><span className="text-[9px] text-[#999999] font-bold uppercase">所属: {s.store === 'all' ? '全店舗共通' : shops.find(sh=>sh.id===Number(s.store))?.name || s.store}</span></div>
            <button onClick={()=>setStaffList(staffList.filter((_,idx)=>idx!==i))} className="text-red-300 px-2"><Trash2 size={18}/></button>
          </div>
        ))}
        <div className="flex flex-col md:flex-row gap-2 pt-4 border-t">
          <input type="text" placeholder="スタッフ名" value={newStaffName} onChange={(e)=>setNewStaffName(e.target.value)} className="flex-[2] h-12 bg-[#FBFAF9] border rounded-xl px-4 font-bold outline-none"/>
          <select value={newStaffStore} onChange={(e)=>setNewStaffStore(e.target.value)} className="flex-1 h-12 bg-[#FBFAF9] border rounded-xl px-4 text-[12px] font-bold"><option value="all">全店舗共通</option>{shops.map(sh=><option key={sh.id} value={sh.id}>{sh.name}</option>)}</select>
          <button onClick={()=>{if(newStaffName.trim()){setStaffList([...staffList,{name:newStaffName, store:newStaffStore}]); setNewStaffName('');}}} className="bg-[#2D4B3E] text-white px-6 h-12 rounded-xl font-bold text-[13px]">追加</button>
        </div>
      </div>
    </div>
  );

  const MessageTab = () => (
    <div className="bg-white rounded-[32px] border p-8 shadow-sm space-y-6 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Mail size={20}/> 自動返信メールテンプレート</h2>
      <div className="space-y-4">
        <div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">件名</label><input type="text" value={autoReply.subject} onChange={(e)=>setAutoReply({...autoReply, subject:e.target.value})} className="w-full h-12 bg-[#FBFAF9] border rounded-xl px-4 font-bold outline-none"/></div>
        <div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">本文 (タグ利用可: {"{CustomerName}"} など)</label><textarea value={autoReply.body} onChange={(e)=>setAutoReply({...autoReply, body:e.target.value})} className="w-full h-64 bg-[#FBFAF9] border rounded-[24px] p-4 text-[13px] font-bold outline-none resize-none leading-relaxed" /></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-6 md:px-12 sticky top-0 z-50">
        <h1 className="text-[16px] font-bold text-[#2D4B3E] flex-shrink-0">各種設定</h1>
        <div className="hidden md:flex flex-1 mx-6 overflow-x-auto bg-[#F7F7F7] p-1 rounded-xl border hide-scrollbar">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>{t.label}</button>
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

      <main className={`flex-1 max-w-[900px] mx-auto w-full py-10 px-6 transition-all ${!isAdmin ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
        {activeTab === 'general' && <GeneralTab/>}
        {activeTab === 'status' && <StatusTab/>}
        {activeTab === 'shop' && <ShopTab/>}
        {activeTab === 'items' && <ItemsTab/>}
        {activeTab === 'shipping' && <ShippingTab/>}
        {activeTab === 'staff_order' && <StaffOrderTab/>}
        {activeTab === 'staff' && <StaffTab/>}
        {activeTab === 'message' && <MessageTab/>}
        <div className="h-40" />
      </main>
    </div>
  );
}