'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { LayoutGrid, ListChecks, Plus, Trash2, Store, Tag, Truck, User, Mail, Settings as SettingsIcon } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // --- 状態管理 (全てのデータをStateで保持) ---
  const [generalConfig, setGeneralConfig] = useState({ appName: 'FLORIX', logoUrl: '', logoSize: 100, logoTransparent: false, slipBgUrl: '', slipBgOpacity: 50 });
  const [shops, setShops] = useState([]); 
  const [flowerItems, setFlowerItems] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [shippingRates, setShippingRates] = useState([]);
  const [boxFeeConfig, setBoxFeeConfig] = useState({ type: 'flat', flatFee: 500, priceTiers: [], itemFees: {}, freeShippingThresholdEnabled: false, freeShippingThreshold: 15000, isBundleDiscount: true, coolBinEnabled: true, coolBinPeriods: [] });
  const [autoReply, setAutoReply] = useState({ subject: '', body: '' });
  const [staffOrderConfig, setStaffOrderConfig] = useState({ ignoreLeadTime: true, allowCustomPrice: true, paymentMethods: [], sendAutoReply: false });
  const [statusConfig, setStatusConfig] = useState({ type: 'template', customLabels: [] });

  const tabs = [
    { id: 'general', label: '基本設定', icon: SettingsIcon },
    { id: 'status', label: 'ステータス', icon: ListChecks },
    { id: 'shop', label: '店舗管理', icon: Store }, 
    { id: 'items', label: '商品管理', icon: Tag },
    { id: 'shipping', label: '配送・送料', icon: Truck },
    { id: 'staff', label: 'スタッフ', icon: User },
    { id: 'message', label: '通知メール', icon: Mail },
  ];

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data && data.settings_data) {
          const s = data.settings_data;
          if (s.generalConfig) setGeneralConfig(s.generalConfig);
          if (s.statusConfig) setStatusConfig(s.statusConfig);
          if (s.shops) setShops(s.shops);
          if (s.flowerItems) setFlowerItems(s.flowerItems);
          if (s.staffList) setStaffList(s.staffList);
          if (s.deliveryAreas) setDeliveryAreas(s.deliveryAreas);
          if (s.shippingRates) setShippingRates(s.shippingRates);
          if (s.boxFeeConfig) setBoxFeeConfig(s.boxFeeConfig);
          if (s.staffOrderConfig) setStaffOrderConfig(s.staffOrderConfig);
          if (s.autoReply) setAutoReply(s.autoReply);
        }
      } catch (error) { console.error('読込エラー:', error.message); }
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
      const settingsData = { generalConfig, statusConfig, shops, flowerItems, staffList, deliveryAreas, shippingRates, boxFeeConfig, autoReply, staffOrderConfig };
      const { error } = await supabase.from('app_settings').upsert({ id: 'default', settings_data: settingsData });
      if (error) throw error;
      alert('すべての設定を保存しました！');
    } catch (error) { alert('保存に失敗しました。'); } finally { setIsSaving(false); }
  };

  // --- 各タブのレンダリング関数 (入力をStateに反映させるロジック入り) ---

  const renderGeneralTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6">
        <h2 className="text-[18px] font-bold text-[#2D4B3E]">基本情報</h2>
        <div className="space-y-2">
          <label className="text-[12px] font-bold text-[#999999]">アプリ名</label>
          <input type="text" value={generalConfig.appName} onChange={(e) => setGeneralConfig({...generalConfig, appName: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E]" />
        </div>
      </div>
    </div>
  );

  const renderStatusTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6">
        <h2 className="text-[18px] font-bold text-[#2D4B3E]">ステータス設定</h2>
        <div className="flex gap-2 p-1 bg-[#F7F7F7] rounded-xl border border-[#EAEAEA]">
          <button onClick={() => setStatusConfig({...statusConfig, type: 'template'})} className={`flex-1 py-3 rounded-lg font-bold text-[12px] transition-all ${statusConfig.type === 'template' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>標準</button>
          <button onClick={() => setStatusConfig({...statusConfig, type: 'custom'})} className={`flex-1 py-3 rounded-lg font-bold text-[12px] transition-all ${statusConfig.type === 'custom' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>カスタム</button>
        </div>
        {statusConfig.type === 'custom' && (
          <div className="space-y-3 pt-4">
            {statusConfig.customLabels.map((label, idx) => (
              <div key={idx} className="flex gap-2">
                <input type="text" value={label} onChange={(e) => { const n = [...statusConfig.customLabels]; n[idx] = e.target.value; setStatusConfig({...statusConfig, customLabels: n}); }} className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none" />
                <button onClick={() => { const n = statusConfig.customLabels.filter((_, i) => i !== idx); setStatusConfig({...statusConfig, customLabels: n}); }} className="p-3 text-red-300 hover:text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
            <button onClick={() => setStatusConfig({...statusConfig, customLabels: [...statusConfig.customLabels, '新ステータス']})} className="w-full py-3 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] hover:border-[#2D4B3E] transition-all">+ 項目を追加</button>
          </div>
        )}
      </div>
    </div>
  );

  const renderShopTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="space-y-6">
        {shops.map((shop) => (
          <div key={shop.id} className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm relative space-y-4">
            <button onClick={() => setShops(shops.filter(s => s.id !== shop.id))} className="absolute top-6 right-6 text-[#999999] hover:text-red-500"><Trash2 size={18}/></button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">店舗名</label><input type="text" value={shop.name} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, name: e.target.value} : s))} className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">電話番号</label><input type="tel" value={shop.phone} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, phone: e.target.value} : s))} className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" /></div>
            </div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">住所</label><input type="text" value={shop.address} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? {...s, address: e.target.value} : s))} className="w-full h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" /></div>
          </div>
        ))}
        <button onClick={() => setShops([...shops, { id: Date.now(), name: '', phone: '', address: '' }])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold text-[13px] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">+ 店舗を追加</button>
      </div>
    </div>
  );

  const renderItemsTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="space-y-6">
        {flowerItems.map(item => (
          <div key={item.id} className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm relative space-y-6">
            <button onClick={() => setFlowerItems(flowerItems.filter(i => i.id !== item.id))} className="absolute top-8 right-8 text-red-300 hover:text-red-500"><Trash2 size={20}/></button>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#999999]">アイテム名</label>
              <input type="text" value={item.name} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, name: e.target.value} : i))} className="w-full h-12 bg-transparent border-b-2 border-[#F7F7F7] text-[20px] font-bold outline-none focus:border-[#2D4B3E]" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#FBFAF9] p-3 rounded-2xl"><label className="text-[9px] font-bold block text-[#2D4B3E]">最低価格</label><input type="number" value={item.minPrice} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, minPrice: Number(e.target.value)} : i))} className="w-full bg-transparent font-bold text-[15px] outline-none" /></div>
              <div className="bg-[#FBFAF9] p-3 rounded-2xl"><label className="text-[9px] font-bold block text-[#2D4B3E]">刻み幅</label><input type="number" value={item.stepPrice} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, stepPrice: Number(e.target.value)} : i))} className="w-full bg-transparent font-bold text-[15px] outline-none" /></div>
              <div className="bg-[#FBFAF9] p-3 rounded-2xl"><label className="text-[9px] font-bold block text-[#2D4B3E]">最高価格</label><input type="number" value={item.maxPrice} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? {...i, maxPrice: Number(e.target.value)} : i))} className="w-full bg-transparent font-bold text-[15px] outline-none" /></div>
            </div>
          </div>
        ))}
        <button onClick={() => setFlowerItems([...flowerItems, { id: Date.now(), name: '', minPrice: 3000, stepPrice: 1000, maxPrice: 20000, canPickup: true, canDelivery: true, canShipping: true }])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-[32px] text-[#999999] font-bold hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all">+ 新しい商品を追加</button>
      </div>
    </div>
  );

  const renderShippingTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6">
        <h2 className="text-[18px] font-bold text-[#2D4B3E]">自社配達エリア・料金</h2>
        <div className="space-y-3">
          {deliveryAreas.map((area) => (
            <div key={area.id} className="flex gap-2 items-center bg-[#FBFAF9] p-3 rounded-2xl border border-[#EAEAEA]">
              <input type="text" placeholder="エリア名" value={area.name} onChange={(e) => setDeliveryAreas(deliveryAreas.map(a => a.id === area.id ? {...a, name: e.target.value} : a))} className="flex-[2] bg-white border border-[#EAEAEA] rounded-xl h-10 px-3 text-[13px] outline-none" />
              <div className="flex-1 flex items-center gap-1 bg-white border border-[#EAEAEA] rounded-xl h-10 px-3">
                <span className="text-[11px] font-bold text-[#999999]">¥</span>
                <input type="number" value={area.fee} onChange={(e) => setDeliveryAreas(deliveryAreas.map(a => a.id === area.id ? {...a, fee: Number(e.target.value)} : a))} className="w-full bg-transparent text-right font-bold text-[13px] outline-none" />
              </div>
              <button onClick={() => setDeliveryAreas(deliveryAreas.filter(a => a.id !== area.id))} className="text-red-300 hover:text-red-500 px-2"><Trash2 size={16}/></button>
            </div>
          ))}
          <button onClick={() => setDeliveryAreas([...deliveryAreas, { id: Date.now(), name: '', fee: 0, keywords: '' }])} className="w-full py-3 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ エリアを追加</button>
        </div>
      </div>
    </div>
  );

  const renderStaffTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6">
        <h2 className="text-[18px] font-bold text-[#2D4B3E]">スタッフ管理</h2>
        <div className="space-y-3">
          {staffList.map((staff) => (
            <div key={staff.id} className="flex justify-between items-center bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA]">
              <span className="font-bold text-[14px]">{staff.name}</span>
              <button onClick={() => setStaffList(staffList.filter(s => s.id !== staff.id))} className="text-red-300 hover:text-red-500"><Trash2 size={18}/></button>
            </div>
          ))}
          <div className="flex gap-2 pt-4">
            <input type="text" placeholder="スタッフ名を入力" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none" />
            <button onClick={() => { if(newStaffName.trim()){ setStaffList([...staffList, { id: Date.now(), name: newStaffName, stores: ['all'] }]); setNewStaffName(''); } }} className="bg-[#2D4B3E] text-white px-6 rounded-xl font-bold text-[13px]">追加</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMessageTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm space-y-6">
        <h2 className="text-[18px] font-bold text-[#2D4B3E]">自動返信メール</h2>
        <div className="space-y-4">
          <div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">件名</label><input type="text" value={autoReply.subject} onChange={(e) => setAutoReply({...autoReply, subject: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none" /></div>
          <div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">本文</label><textarea value={autoReply.body} onChange={(e) => setAutoReply({...autoReply, body: e.target.value})} className="w-full h-64 bg-[#FBFAF9] border border-[#EAEAEA] rounded-[24px] p-4 text-[13px] font-bold outline-none resize-none leading-relaxed" /></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-left">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-12 sticky top-0 z-50">
        <h1 className="text-[16px] font-bold text-[#2D4B3E] flex-shrink-0">各種設定</h1>
        <div className="hidden md:flex flex-1 mx-6 overflow-x-auto bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] hide-scrollbar">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {!isAdmin ? (
            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border border-[#EAEAEA] shadow-sm">
              <input type="password" placeholder="Pass" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-16 h-8 px-2 bg-[#FBFAF9] text-[11px] font-bold outline-none rounded-lg" />
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

      <main className={`flex-1 max-w-[800px] mx-auto w-full py-10 px-6 transition-all ${!isAdmin ? 'opacity-40 pointer-events-none grayscale-[50%]' : ''}`}>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'shop' && renderShopTab()}
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'shipping' && renderShippingTab()}
        {activeTab === 'staff' && renderStaffTab()}
        {activeTab === 'message' && renderMessageTab()}
        <div className="h-40"></div>
      </main>
    </div>
  );
}