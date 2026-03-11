'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
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
  const [shippingRates, setShippingRates] = useState([
    { region: '北海道', prefs: ['北海道'], fee: 1000, coolFee: 500 },
    { region: '北東北', prefs: ['青森', '岩手', '秋田'], fee: 1200, coolFee: 500 },
    { region: '沖縄', prefs: ['沖縄'], fee: 3500, coolFee: 1000 },
  ]);
  const [boxFeeConfig, setBoxFeeConfig] = useState({
    type: 'flat', flatFee: 500, priceTiers: [{ minPrice: 0, fee: 300 }], itemFees: {},
    freeShippingThresholdEnabled: false, freeShippingThreshold: 15000,
    isBundleDiscount: true, coolBinEnabled: true, coolBinPeriods: []
  });
  const [autoReply, setAutoReply] = useState({ subject: '', body: '' });
  const [staffOrderConfig, setStaffOrderConfig] = useState({
    ignoreLeadTime: true, allowCustomPrice: true, paymentMethods: ['店頭支払い(済)', '銀行振込(請求書)', '代金引換', '未定'], sendAutoReply: false,
  });
  const [statusConfig, setStatusConfig] = useState({
    type: 'template', customLabels: ['未対応', '制作中', '制作完了', '配達中']
  });

  const tabs = [
    { id: 'general', label: '基本設定' },
    { id: 'status', label: 'ステータス' },
    { id: 'shop', label: '店舗管理' }, 
    { id: 'items', label: '商品管理' },
    { id: 'shipping', label: '配送・送料' },
    { id: 'rules', label: '立札デザイン' },
    { id: 'staff_order', label: '店舗注文受付' },
    { id: 'staff', label: 'スタッフ' },
    { id: 'message', label: '通知メール' },
  ];

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (data && data.settings_data) {
          const s = data.settings_data;
          if (s.generalConfig) setGeneralConfig({ ...generalConfig, ...s.generalConfig });
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

  const saveSettings = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const settingsData = { generalConfig, statusConfig, shops, flowerItems, staffList, deliveryAreas, shippingRates, boxFeeConfig, autoReply, staffOrderConfig };
      await supabase.from('app_settings').upsert({ id: 'default', settings_data: settingsData });
      alert('設定を保存しました。');
    } catch (error) { alert('保存エラー'); } finally { setIsSaving(false); }
  };

  // ==========================================
  // ここから下は「各タブの中身」を分割して定義
  // ==========================================

  const renderGeneralTab = () => (
    <div className="space-y-16 animate-in fade-in">
      <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">基本設定</h2></header>
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 md:p-12 shadow-sm space-y-10">
        <div className="space-y-2 text-left">
          <label className="text-[12px] font-bold text-[#555555]">アプリの表示名</label>
          <input type="text" value={generalConfig.appName} onChange={(e) => setGeneralConfig({...generalConfig, appName: e.target.value})} className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 font-bold outline-none" />
        </div>
      </div>
    </div>
  );

  const renderStatusTab = () => (
    <div className="space-y-16 animate-in fade-in">
      <header className="px-2 border-l-4 border-[#2D4B3E] mb-10">
        <h2 className="text-[24px] font-bold text-[#2D4B3E]">ステータス設定</h2>
      </header>
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-sm space-y-10">
        <div className="flex gap-4 p-2 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA]">
          <button onClick={() => setStatusConfig({...statusConfig, type: 'template'})} className={`flex-1 py-4 rounded-xl font-bold text-[13px] ${statusConfig.type === 'template' ? 'bg-white shadow-md text-[#2D4B3E]' : 'text-[#999999]'}`}>テンプレを使用</button>
          <button onClick={() => setStatusConfig({...statusConfig, type: 'custom'})} className={`flex-1 py-4 rounded-xl font-bold text-[13px] ${statusConfig.type === 'custom' ? 'bg-white shadow-md text-[#2D4B3E]' : 'text-[#999999]'}`}>自分で設定する</button>
        </div>
        {statusConfig.type === 'template' ? (
          <div className="flex flex-wrap gap-2">{['未対応', '制作中', '制作完了', '配達中'].map(s => <span key={s} className="px-4 py-2 bg-white border border-[#EAEAEA] rounded-lg text-[12px] font-bold">{s}</span>)}</div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => setStatusConfig({ ...statusConfig, customLabels: [...statusConfig.customLabels, '新ステータス'] })} className="text-[11px] font-bold text-[#2D4B3E] bg-[#2D4B3E]/5 px-4 py-2 rounded-full">+ 追加</button>
            {statusConfig.customLabels.map((label, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input type="text" value={label} onChange={(e) => { const n = [...statusConfig.customLabels]; n[idx] = e.target.value; setStatusConfig({...statusConfig, customLabels: n}); }} className="flex-1 h-12 px-5 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl font-bold text-[13px] outline-none" />
                <button onClick={() => { const n = statusConfig.customLabels.filter((_, i) => i !== idx); setStatusConfig({...statusConfig, customLabels: n}); }} className="p-3 text-red-300"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderShopTab = () => (
    <div className="space-y-16 animate-in fade-in">
      <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">店舗管理</h2></header>
      <div className="space-y-12">
        {shops.map((shop) => (
          <div key={shop.id} className="bg-white rounded-[32px] border border-[#EAEAEA] p-6 shadow-sm relative">
            <button onClick={() => setShops(shops.filter(s => s.id !== shop.id))} className="absolute top-6 right-6 text-red-500 font-bold text-[10px]">削除</button>
            <div className="space-y-6">
              <input type="text" placeholder="店舗名" value={shop.name} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? { ...s, name: e.target.value } : s))} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none" />
              <input type="text" placeholder="住所" value={shop.address} onChange={(e) => setShops(shops.map(s => s.id === shop.id ? { ...s, address: e.target.value } : s))} className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none" />
            </div>
          </div>
        ))}
        <button onClick={() => setShops([...shops, { id: Date.now(), name: '', phone: '', address: '', specialHours: [] }])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] text-[#999999] font-bold rounded-[32px]">+ 店舗を追加</button>
      </div>
    </div>
  );

  const renderItemsTab = () => (
    <div className="space-y-16 animate-in fade-in">
      <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">商品管理</h2></header>
      <div className="space-y-10">
        {flowerItems.map(item => (
          <div key={item.id} className="bg-white rounded-[32px] border border-[#EAEAEA] p-8 shadow-sm relative">
            <button onClick={() => setFlowerItems(flowerItems.filter(i => i.id !== item.id))} className="absolute top-8 right-8 text-red-500 font-bold text-[10px]">削除</button>
            <input type="text" placeholder="アイテム名" value={item.name} onChange={(e) => setFlowerItems(flowerItems.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))} className="w-full h-10 border-b-2 border-[#F7F7F7] font-bold text-[20px] outline-none" />
          </div>
        ))}
        <button onClick={() => setFlowerItems([...flowerItems, { id: Date.now(), name: '', minPrice: 3000, stepPrice: 1000, maxPrice: 20000, canPickup: true, canDelivery: true, canShipping: true }])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] text-[#999999] font-bold rounded-[32px]">+ 新しいアイテムを追加</button>
      </div>
    </div>
  );

  const renderShippingTab = () => (
    <div className="space-y-16 animate-in fade-in">
      <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">配送・送料管理</h2></header>
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-sm space-y-10">
        <p className="text-[13px] font-bold">自社配達エリア</p>
        {deliveryAreas.map((area) => (
          <div key={area.id} className="flex gap-4">
             <input type="text" value={area.name} onChange={(e) => setDeliveryAreas(deliveryAreas.map(a => a.id === area.id ? { ...a, name: e.target.value } : a))} className="border p-2 rounded" placeholder="エリア名" />
             <input type="number" value={area.fee} onChange={(e) => setDeliveryAreas(deliveryAreas.map(a => a.id === area.id ? { ...a, fee: Number(e.target.value) } : a))} className="border p-2 rounded" placeholder="料金" />
             <button onClick={() => setDeliveryAreas(deliveryAreas.filter(a => a.id !== area.id))} className="text-red-500">削除</button>
          </div>
        ))}
        <button onClick={() => setDeliveryAreas([...deliveryAreas, { id: Date.now(), name: '', keywords: '', fee: 0 }])} className="text-[#2D4B3E] font-bold">+ エリア追加</button>
      </div>
    </div>
  );

  const renderStaffTab = () => (
    <div className="space-y-16 animate-in fade-in">
      <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">スタッフ管理</h2></header>
      <div className="bg-white rounded-[24px] border border-[#EAEAEA] p-6 shadow-sm space-y-4">
        {staffList.map((staff) => (
          <div key={staff.id} className="flex justify-between items-center border-b pb-2">
            <span className="font-bold">{staff.name}</span>
            <button onClick={() => setStaffList(staffList.filter(s => s.id !== staff.id))} className="text-red-500 text-xs">削除</button>
          </div>
        ))}
        <div className="flex gap-2 pt-4">
          <input type="text" placeholder="名前を入力" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} className="flex-1 border p-2 rounded" />
          <button onClick={() => { if(newStaffName.trim()){ setStaffList([...staffList, { id: Date.now(), name: newStaffName, stores: ['all'] }]); setNewStaffName(''); } }} className="bg-[#2D4B3E] text-white px-4 rounded">追加</button>
        </div>
      </div>
    </div>
  );

  const renderMessageTab = () => (
    <div className="space-y-16 animate-in fade-in">
      <header className="px-2 border-l-4 border-[#2D4B3E] mb-10"><h2 className="text-[24px] font-bold text-[#2D4B3E]">自動返信メール</h2></header>
      <div className="bg-white rounded-[32px] border border-[#EAEAEA] p-10 shadow-sm space-y-6">
        <input type="text" placeholder="件名" value={autoReply.subject} onChange={(e) => setAutoReply({...autoReply, subject: e.target.value})} className="w-full border p-4 rounded-xl outline-none" />
        <textarea value={autoReply.body} onChange={(e) => setAutoReply({...autoReply, body: e.target.value})} className="w-full h-[300px] border p-4 rounded-xl outline-none resize-none" placeholder="本文" />
      </div>
    </div>
  );

  // ==========================================
  // メインのレンダリング
  // ==========================================
  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-left">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-12 sticky top-0 z-10">
        <h1 className="text-[16px] font-bold text-[#2D4B3E]">{tabs.find(t => t.id === activeTab)?.label}</h1>
        <div className="hidden md:flex flex-1 mx-6 overflow-x-auto bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA] hide-scrollbar">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg ${activeTab === t.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {!isAdmin ? (
            <div className="flex items-center gap-2">
              <input type="password" placeholder="パスワード" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-24 h-8 px-3 border rounded-lg text-xs" />
              <button onClick={handleLogin} className="px-4 h-8 bg-[#2D4B3E] text-white text-xs rounded-lg">解除</button>
            </div>
          ) : (
            <button onClick={saveSettings} disabled={isSaving} className="px-8 py-3 bg-[#2D4B3E] text-white text-[13px] font-bold rounded-xl shadow-md">
              {isSaving ? '保存中...' : '設定を保存'}
            </button>
          )}
        </div>
      </header>

      <div className="md:hidden flex overflow-x-auto bg-white border-b border-[#EAEAEA] p-2 hide-scrollbar sticky top-20 z-10">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 text-[12px] font-bold rounded-lg ${activeTab === t.id ? 'bg-[#2D4B3E] text-white' : 'text-[#999999]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <main className={`flex-1 max-w-[840px] mx-auto w-full py-12 px-6 ${!isAdmin ? 'opacity-50 pointer-events-none' : ''}`}>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'shop' && renderShopTab()}
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'shipping' && renderShippingTab()}
        {activeTab === 'staff' && renderStaffTab()}
        {activeTab === 'message' && renderMessageTab()}
        
        {/* 未実装のタブ用のプレースホルダー */}
        {(activeTab === 'rules' || activeTab === 'staff_order') && (
           <div className="p-20 text-center text-[#999999] font-bold border-2 border-dashed border-[#EAEAEA] rounded-[32px]">
             この項目は現在整理中です
           </div>
        )}

        <div className="h-40"></div>
      </main>
    </div>
  );
}