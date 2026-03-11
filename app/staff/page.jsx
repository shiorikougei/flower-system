'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Save, Plus, Trash2, Clock, Truck, Store, Package } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- 設定データ群 ---
  const [generalConfig, setGeneralConfig] = useState({ appName: 'FLORIX', logoUrl: '' });
  const [shops, setShops] = useState([]);
  const [flowerItems, setFlowerItems] = useState([]);
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [shippingRates, setShippingRates] = useState([]);
  const [shippingSizes, setShippingSizes] = useState(['80', '100', '120']);
  
  // ★ 新規追加：時間帯枠の設定
  const [timeSlots, setTimeSlots] = useState({
    pickup: ['10:00-12:00', '12:00-15:00', '15:00-18:00'],
    delivery: ['9:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
    shipping: ['午前中', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
  });

  const [boxFeeConfig, setBoxFeeConfig] = useState({
    type: 'flat', flatFee: 0, priceTiers: [], coolBinEnabled: false, coolBinPeriods: [], returnFeeType: 'flat', returnFeeValue: 0
  });
  const [staffList, setStaffList] = useState([]);
  const [staffOrderConfig, setStaffOrderConfig] = useState({ paymentMethods: ['現地決済', '銀行振込', '請求書払い'], ignoreLeadTime: false, allowCustomPrice: false });
  const [statusConfig, setStatusConfig] = useState({ customLabels: ['制作中', '制作完了', '配達中'] });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data && data.settings_data) {
        const d = data.settings_data;
        setGeneralConfig(d.generalConfig || { appName: 'FLORIX', logoUrl: '' });
        setShops(d.shops || []);
        setFlowerItems(d.flowerItems || []);
        setDeliveryAreas(d.deliveryAreas || []);
        
        // 地域別送料の初期データ（リードタイム項目を追加）
        const defaultRates = [
          { region: '北海道', prefs: '北海道', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 1 },
          { region: '北東北', prefs: '青森,岩手,秋田', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 2 },
          { region: '南東北', prefs: '宮城,山形,福島', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 2 },
          { region: '関東', prefs: '茨城,栃木,群馬,埼玉,千葉,東京,神奈川,山梨', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 2 },
          { region: '信越', prefs: '新潟,長野', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 2 },
          { region: '北陸', prefs: '富山,石川,福井', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 2 },
          { region: '中部', prefs: '岐阜,静岡,愛知,三重', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 2 },
          { region: '関西', prefs: '滋賀,京都,大阪,兵庫,奈良,和歌山', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 3 },
          { region: '中国', prefs: '鳥取,島根,岡山,広島,山口', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 3 },
          { region: '四国', prefs: '徳島,香川,愛媛,高知', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 3 },
          { region: '九州', prefs: '福岡,佐賀,長崎,熊本,大分,宮崎,鹿児島', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 3 },
          { region: '沖縄', prefs: '沖縄', fee80: 0, fee100: 0, cool80: 0, cool100: 0, leadDays: 4 }
        ];
        
        // 既存のデータがあれば結合、なければデフォルト
        const loadedRates = d.shippingRates?.length > 0 ? d.shippingRates : defaultRates;
        // 古いデータに leadDays が無い場合への対応
        const ratesWithLeadDays = loadedRates.map(r => ({ ...r, leadDays: r.leadDays ?? 2 }));
        setShippingRates(ratesWithLeadDays);
        
        setShippingSizes(d.shippingSizes || ['80', '100', '120']);
        
        // 時間枠設定の読み込み
        setTimeSlots(d.timeSlots || {
          pickup: ['10:00-12:00', '12:00-15:00', '15:00-18:00'],
          delivery: ['9:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
          shipping: ['午前中', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
        });

        setBoxFeeConfig(d.boxFeeConfig || { type: 'flat', flatFee: 0, priceTiers: [], coolBinEnabled: false, coolBinPeriods: [], returnFeeType: 'flat', returnFeeValue: 0 });
        setStaffList(d.staffList || []);
        setStaffOrderConfig(d.staffOrderConfig || { paymentMethods: ['現地決済', '銀行振込'], ignoreLeadTime: false, allowCustomPrice: false });
        setStatusConfig(d.statusConfig || { customLabels: ['制作中', '制作完了', '配達中'] });
      }
    } catch (error) {
      console.error('設定の読み込みエラー', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    const settingsData = {
      generalConfig, shops, flowerItems, deliveryAreas, shippingRates, shippingSizes, timeSlots, // ★保存データにtimeSlots追加
      boxFeeConfig, staffList, staffOrderConfig, statusConfig
    };
    try {
      const { error } = await supabase.from('app_settings').upsert({ id: 'default', settings_data: settingsData });
      if (error) throw error;
      alert('設定を保存しました！');
    } catch (error) {
      console.error('保存エラー', error);
      alert('設定の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // --- ハンドラー関数 ---
  const handleArrayChange = (setter, index, value) => {
    setter(prev => { const newArr = [...prev]; newArr[index] = value; return newArr; });
  };
  const addArrayItem = (setter, emptyItem) => setter(prev => [...prev, emptyItem]);
  const removeArrayItem = (setter, index) => setter(prev => prev.filter((_, i) => i !== index));

  const handleRateChange = (index, field, value) => {
    setShippingRates(prev => {
      const newRates = [...prev];
      newRates[index][field] = value;
      return newRates;
    });
  };

  // 時間枠のハンドラー
  const handleTimeSlotChange = (method, index, value) => {
    setTimeSlots(prev => {
      const newSlots = { ...prev };
      newSlots[method][index] = value;
      return newSlots;
    });
  };
  const addTimeSlot = (method) => {
    setTimeSlots(prev => ({ ...prev, [method]: [...prev[method], ''] }));
  };
  const removeTimeSlot = (method, index) => {
    setTimeSlots(prev => ({ ...prev, [method]: prev[method].filter((_, i) => i !== index) }));
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center text-[#2D4B3E] font-bold tracking-widest animate-pulse">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-32">
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-30 px-6 py-4 shadow-sm flex items-center justify-between">
        <h1 className="text-[20px] font-black text-[#2D4B3E] tracking-widest">各種設定</h1>
        <button onClick={saveSettings} disabled={isSaving} className="bg-[#2D4B3E] text-white px-6 py-2.5 rounded-xl font-bold text-[13px] flex items-center gap-2 hover:bg-[#1f352b] transition-all shadow-md active:scale-95 disabled:opacity-50">
          <Save size={16} /> {isSaving ? '保存中...' : '設定を保存'}
        </button>
      </header>

      <main className="max-w-[1000px] mx-auto p-6 pt-8 flex flex-col md:flex-row gap-8">
        
        {/* 左側：タブメニュー */}
        <aside className="w-full md:w-48 shrink-0 flex flex-col gap-2">
          {[{ id: 'general', label: '基本・店舗' }, { id: 'items', label: '商品・納期' }, { id: 'shipping', label: '配送・時間枠' }, { id: 'staff', label: 'スタッフ・決済' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 rounded-xl text-left font-bold text-[13px] transition-all ${activeTab === tab.id ? 'bg-[#2D4B3E] text-white shadow-md' : 'bg-white text-[#555555] border border-[#EAEAEA] hover:border-[#2D4B3E]'}`}>
              {tab.label}
            </button>
          ))}
        </aside>

        {/* 右側：設定内容 */}
        <div className="flex-1 bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm space-y-12">
          
          {/* =========================================
              タブ：基本・店舗設定
          ========================================= */}
          {activeTab === 'general' && (
            <div className="space-y-8 animate-in fade-in">
              <section className="space-y-4">
                <h2 className="text-[16px] font-black text-[#2D4B3E] border-b pb-2">店舗（受取場所）の設定</h2>
                {shops.map((shop, i) => (
                  <div key={i} className="flex flex-col gap-3 bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] relative">
                    <input type="text" placeholder="店舗名" value={shop.name || ''} onChange={(e) => { const newShops = [...shops]; newShops[i].name = e.target.value; setShops(newShops); }} className="w-full px-4 py-2 rounded-lg border outline-none font-bold" />
                    <input type="text" placeholder="住所" value={shop.address || ''} onChange={(e) => { const newShops = [...shops]; newShops[i].address = e.target.value; setShops(newShops); }} className="w-full px-4 py-2 rounded-lg border outline-none text-[13px]" />
                    <button onClick={() => removeArrayItem(setShops, i)} className="absolute top-4 right-4 text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button onClick={() => addArrayItem(setShops, { id: Date.now(), name: '', address: '', openTime: '10:00', closeTime: '19:00' })} className="text-[13px] font-bold text-[#4285F4] flex items-center gap-1 p-2"><Plus size={16}/> 店舗を追加</button>
              </section>
            </div>
          )}

          {/* =========================================
              タブ：商品・納期設定
          ========================================= */}
          {activeTab === 'items' && (
            <div className="space-y-8 animate-in fade-in">
              <section className="space-y-4">
                <h2 className="text-[16px] font-black text-[#2D4B3E] border-b pb-2">商品リストと納期（リードタイム）</h2>
                {flowerItems.map((item, i) => (
                  <div key={i} className="bg-[#FBFAF9] p-5 rounded-2xl border border-[#EAEAEA] space-y-4 relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#999999]">商品名</label>
                        <input type="text" value={item.name || ''} onChange={(e) => { const newItems = [...flowerItems]; newItems[i].name = e.target.value; setFlowerItems(newItems); }} className="w-full px-3 py-2 rounded-lg border font-bold" />
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <label className="flex items-center gap-2 text-[12px] font-bold"><input type="checkbox" checked={item.canBringFlowers || false} onChange={(e) => { const newItems = [...flowerItems]; newItems[i].canBringFlowers = e.target.checked; setFlowerItems(newItems); }} className="accent-[#2D4B3E] w-4 h-4" /> お花持込可</label>
                        <label className="flex items-center gap-2 text-[12px] font-bold"><input type="checkbox" checked={item.canBringVase || false} onChange={(e) => { const newItems = [...flowerItems]; newItems[i].canBringVase = e.target.checked; setFlowerItems(newItems); }} className="accent-[#2D4B3E] w-4 h-4" /> 器持込可</label>
                        <label className="flex items-center gap-2 text-[12px] font-bold text-orange-600"><input type="checkbox" checked={item.hasReturn || false} onChange={(e) => { const newItems = [...flowerItems]; newItems[i].hasReturn = e.target.checked; setFlowerItems(newItems); }} className="accent-orange-600 w-4 h-4" /> 後日回収あり</label>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3 rounded-xl border border-[#EAEAEA]">
                      <div>
                        <label className="text-[10px] font-bold text-[#999999] block mb-1">通常納期 (自社/店頭)</label>
                        <div className="flex items-center gap-1"><input type="number" value={item.normalLeadDays || 0} onChange={(e) => { const newItems = [...flowerItems]; newItems[i].normalLeadDays = e.target.value; setFlowerItems(newItems); }} className="w-16 px-2 py-1 border rounded text-center font-bold" /> 日前</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#999999] block mb-1">配送納期 (業者)</label>
                        <div className="flex items-center gap-1"><input type="number" value={item.shippingLeadDays || 0} onChange={(e) => { const newItems = [...flowerItems]; newItems[i].shippingLeadDays = e.target.value; setFlowerItems(newItems); }} className="w-16 px-2 py-1 border rounded text-center font-bold" /> 日前</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#999999] block mb-1">花材持込時の納期</label>
                        <div className="flex items-center gap-1"><input type="number" value={item.canBringFlowersLeadDays || 0} onChange={(e) => { const newItems = [...flowerItems]; newItems[i].canBringFlowersLeadDays = e.target.value; setFlowerItems(newItems); }} className="w-16 px-2 py-1 border rounded text-center font-bold" /> 日前</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#999999] block mb-1">器持込時の納期</label>
                        <div className="flex items-center gap-1"><input type="number" value={item.canBringVaseLeadDays || 0} onChange={(e) => { const newItems = [...flowerItems]; newItems[i].canBringVaseLeadDays = e.target.value; setFlowerItems(newItems); }} className="w-16 px-2 py-1 border rounded text-center font-bold" /> 日前</div>
                      </div>
                    </div>
                    <button onClick={() => removeArrayItem(setFlowerItems, i)} className="absolute top-4 right-4 text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button onClick={() => addArrayItem(setFlowerItems, { id: Date.now(), name: '', normalLeadDays: 2, shippingLeadDays: 3, canBringFlowers: false, canBringVase: false })} className="text-[13px] font-bold text-[#4285F4] flex items-center gap-1 p-2"><Plus size={16}/> 商品を追加</button>
              </section>
            </div>
          )}

          {/* =========================================
              タブ：配送・時間枠設定
          ========================================= */}
          {activeTab === 'shipping' && (
            <div className="space-y-12 animate-in fade-in">
              
              {/* ★ 新機能：時間帯の枠設定 */}
              <section className="space-y-6">
                <h2 className="text-[16px] font-black text-[#2D4B3E] border-b pb-2 flex items-center gap-2"><Clock size={18}/> 受取・配達の時間帯枠設定</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 店頭受取の時間枠 */}
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-200">
                    <h3 className="text-[13px] font-bold text-orange-800 mb-3 flex items-center gap-1"><Store size={14}/> 店頭受取の時間帯</h3>
                    <div className="space-y-2">
                      {timeSlots.pickup.map((slot, i) => (
                        <div key={i} className="flex gap-2">
                          <input type="text" value={slot} placeholder="例: 10:00-12:00" onChange={(e) => handleTimeSlotChange('pickup', i, e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border border-orange-200 text-[13px] font-bold outline-none" />
                          <button onClick={() => removeTimeSlot('pickup', i)} className="text-red-500 p-1.5"><X size={14}/></button>
                        </div>
                      ))}
                      <button onClick={() => addTimeSlot('pickup')} className="text-[11px] font-bold text-orange-600 flex items-center gap-1 mt-2"><Plus size={14}/> 枠を追加</button>
                    </div>
                  </div>

                  {/* 自社配達の時間枠 */}
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
                    <h3 className="text-[13px] font-bold text-blue-800 mb-3 flex items-center gap-1"><Truck size={14}/> 自社配達の時間帯</h3>
                    <div className="space-y-2">
                      {timeSlots.delivery.map((slot, i) => (
                        <div key={i} className="flex gap-2">
                          <input type="text" value={slot} placeholder="例: 9:00-12:00" onChange={(e) => handleTimeSlotChange('delivery', i, e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border border-blue-200 text-[13px] font-bold outline-none" />
                          <button onClick={() => removeTimeSlot('delivery', i)} className="text-red-500 p-1.5"><X size={14}/></button>
                        </div>
                      ))}
                      <button onClick={() => addTimeSlot('delivery')} className="text-[11px] font-bold text-blue-600 flex items-center gap-1 mt-2"><Plus size={14}/> 枠を追加</button>
                    </div>
                  </div>

                  {/* 業者配送の時間枠 */}
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-200">
                    <h3 className="text-[13px] font-bold text-green-800 mb-3 flex items-center gap-1"><Package size={14}/> 業者配送の時間帯</h3>
                    <div className="space-y-2">
                      {timeSlots.shipping.map((slot, i) => (
                        <div key={i} className="flex gap-2">
                          <input type="text" value={slot} placeholder="例: 午前中" onChange={(e) => handleTimeSlotChange('shipping', i, e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border border-green-200 text-[13px] font-bold outline-none" />
                          <button onClick={() => removeTimeSlot('shipping', i)} className="text-red-500 p-1.5"><X size={14}/></button>
                        </div>
                      ))}
                      <button onClick={() => addTimeSlot('shipping')} className="text-[11px] font-bold text-green-600 flex items-center gap-1 mt-2"><Plus size={14}/> 枠を追加</button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-[16px] font-black text-[#2D4B3E] border-b pb-2">自社配達エリアと送料</h2>
                {deliveryAreas.map((area, i) => (
                  <div key={i} className="flex flex-col md:flex-row gap-3 bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] relative">
                    <input type="text" placeholder="キーワード (例: 北区,中央区)" value={area.name || ''} onChange={(e) => { const newAreas = [...deliveryAreas]; newAreas[i].name = e.target.value; setDeliveryAreas(newAreas); }} className="flex-1 px-4 py-2 rounded-lg border outline-none text-[13px]" />
                    <div className="flex items-center gap-2">
                      <span className="font-bold">¥</span>
                      <input type="number" placeholder="送料" value={area.fee || ''} onChange={(e) => { const newAreas = [...deliveryAreas]; newAreas[i].fee = e.target.value; setDeliveryAreas(newAreas); }} className="w-24 px-4 py-2 rounded-lg border outline-none font-bold" />
                    </div>
                    <button onClick={() => removeArrayItem(setDeliveryAreas, i)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button onClick={() => addArrayItem(setDeliveryAreas, { name: '', fee: 0 })} className="text-[13px] font-bold text-[#4285F4] flex items-center gap-1 p-2"><Plus size={16}/> エリアを追加</button>
              </section>

              {/* ★ 地域別送料と配送日数 */}
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h2 className="text-[16px] font-black text-[#2D4B3E]">業者配送：地域別の送料と「配送日数」</h2>
                </div>
                <div className="overflow-x-auto border border-[#EAEAEA] rounded-2xl">
                  <table className="w-full text-[12px] text-left">
                    <thead className="bg-[#F7F7F7] text-[#555555] font-bold">
                      <tr>
                        <th className="p-3 border-b border-r">地域 (都道府県)</th>
                        <th className="p-3 border-b border-r text-center w-24 bg-green-50 text-green-800">配送日数</th>
                        {shippingSizes.map(size => (
                          <th key={size} className="p-3 border-b text-center">サイズ {size}<br/><span className="text-[10px] font-normal text-blue-500">基本 / クール</span></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shippingRates.map((rate, idx) => (
                        <tr key={idx} className="border-b last:border-0 hover:bg-[#FBFAF9]">
                          <td className="p-3 border-r font-bold text-[#2D4B3E]">{rate.region} <span className="text-[10px] font-normal text-[#999999] block mt-1">{rate.prefs}</span></td>
                          {/* ★ 配送日数の入力欄 */}
                          <td className="p-3 border-r text-center bg-green-50/30">
                            <div className="flex items-center justify-center gap-1">
                              <input type="number" value={rate.leadDays || 1} onChange={(e) => handleRateChange(idx, 'leadDays', e.target.value)} className="w-12 p-1.5 border rounded-lg text-center font-black outline-none focus:border-green-500" />
                              <span className="text-[10px] text-green-800 font-bold">日</span>
                            </div>
                          </td>
                          {shippingSizes.map(size => (
                            <td key={size} className="p-2 text-center border-l border-[#F7F7F7]">
                              <div className="flex flex-col gap-1 items-center">
                                <input type="number" value={rate[`fee${size}`] || 0} onChange={(e) => handleRateChange(idx, `fee${size}`, e.target.value)} className="w-16 p-1 border rounded text-center text-[11px] outline-none" title="基本送料" />
                                <input type="number" value={rate[`cool${size}`] || 0} onChange={(e) => handleRateChange(idx, `cool${size}`, e.target.value)} className="w-16 p-1 border border-blue-200 bg-blue-50 text-blue-700 rounded text-center text-[11px] outline-none" title="クール便加算" />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* =========================================
              タブ：スタッフ・決済
          ========================================= */}
          {activeTab === 'staff' && (
            <div className="space-y-8 animate-in fade-in">
              <section className="space-y-4">
                <h2 className="text-[16px] font-black text-[#2D4B3E] border-b pb-2">スタッフ入力用の特別権限</h2>
                <label className="flex items-center gap-3 p-4 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA] cursor-pointer">
                  <input type="checkbox" checked={staffOrderConfig.ignoreLeadTime || false} onChange={(e) => setStaffOrderConfig({...staffOrderConfig, ignoreLeadTime: e.target.checked})} className="w-5 h-5 accent-[#2D4B3E]" />
                  <span className="text-[13px] font-bold">納期制限を無視して、当日の日付でも強制的にカレンダーを選択可能にする</span>
                </label>
                <label className="flex items-center gap-3 p-4 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA] cursor-pointer">
                  <input type="checkbox" checked={staffOrderConfig.allowCustomPrice || false} onChange={(e) => setStaffOrderConfig({...staffOrderConfig, allowCustomPrice: e.target.checked})} className="w-5 h-5 accent-[#2D4B3E]" />
                  <span className="text-[13px] font-bold">商品金額をプルダウンではなく「自由入力」できるようにする</span>
                </label>
              </section>
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}