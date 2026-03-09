'use client';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../utils/supabase';

export default function OrderPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = params?.shopId || 'default';

  const [appSettings, setAppSettings] = useState(null);
  const [portfolioImages, setPortfolioImages] = useState([]); // ★追加：ギャラリー画像
  const [isLoading, setIsLoading] = useState(true);

  // --- 状態管理 ---
  const [step, setStep] = useState(1);
  const [flowerType, setFlowerType] = useState('');
  const [isBring, setIsBring] = useState('shop');
  const [receiveMethod, setReceiveMethod] = useState('');
  const [selectedShop, setSelectedShop] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [methodAgreed, setMethodAgreed] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  // デザイン詳細
  const [itemPrice, setItemPrice] = useState('');
  const [flowerPurpose, setFlowerPurpose] = useState('');
  const [flowerColor, setFlowerColor] = useState('');
  const [flowerVibe, setFlowerVibe] = useState('');
  const [otherPurpose, setOtherPurpose] = useState('');
  const [otherVibe, setOtherVibe] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // ★追加：お客様が選んだ画像

  // 立札・メッセージ
  const [cardType, setCardType] = useState('なし');
  const [cardMessage, setCardMessage] = useState('');
  const [prefixFormat, setPrefixFormat] = useState('kanji'); 
  const [tatePattern, setTatePattern] = useState('');
  const [tateInput1, setTateInput1] = useState(''); 
  const [tateInput2, setTateInput2] = useState(''); 
  const [tateInput3, setTateInput3] = useState(''); 
  const [tateInput3a, setTateInput3a] = useState(''); 
  const [tateInput3b, setTateInput3b] = useState(''); 

  // お客様・お届け先情報
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', zip: '', address1: '', address2: '' });
  const [isRecipientDifferent, setIsRecipientDifferent] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState({ name: '', phone: '', zip: '', address1: '', address2: '' });
  const [calculatedFee, setCalculatedFee] = useState(null);
  const [areaError, setAreaError] = useState('');
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        // 1. 基本設定の取得
        const { data, error } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (error) throw error;
        if (data && data.settings_data) setAppSettings(data.settings_data);

        // 2. ★ギャラリー（作品）データの取得
        const { data: gallery } = await supabase.from('app_settings').select('settings_data').eq('id', 'gallery').single();
        if (gallery && gallery.settings_data?.images) {
          setPortfolioImages(gallery.settings_data.images);
        }
      } catch (err) {
        console.error('設定の読み込みに失敗しました:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';

  const selectedItemSettings = useMemo(() => {
    return appSettings?.flowerItems?.find(i => i.name === flowerType) || {};
  }, [flowerType, appSettings]);

  // ★画像自動抽出ロジック（選んだ条件に近いものをフィルタリング）
  const matchingImages = useMemo(() => {
    if (!portfolioImages || portfolioImages.length === 0) return [];
    return portfolioImages.filter(img => {
      let match = true;
      // 何か条件が選ばれていて、かつ画像側のデータと一致しない場合は除外
      if (flowerPurpose && flowerPurpose !== 'その他' && img.purpose && img.purpose !== flowerPurpose) match = false;
      if (flowerColor && flowerColor !== 'おまかせ' && img.color && img.color !== flowerColor) match = false;
      if (flowerVibe && flowerVibe !== 'その他' && flowerVibe !== 'おまかせ' && img.vibe && img.vibe !== flowerVibe) match = false;
      return match;
    });
  }, [portfolioImages, flowerPurpose, flowerColor, flowerVibe]);

  // ★「このイメージで作る」を押した時の自動入力魔法
  const handleSelectImage = (img) => {
    if (selectedImage?.id === img.id) {
      setSelectedImage(null); // 解除
    } else {
      setSelectedImage(img);
      // 画像に設定されている情報をフォームに自動上書き！
      if (img.price > 0) setItemPrice(String(img.price));
      if (img.purpose) setFlowerPurpose(img.purpose);
      if (img.color) setFlowerColor(img.color);
      if (img.vibe) setFlowerVibe(img.vibe);
    }
  };

  const isOsonae = flowerPurpose === 'お供え';
  const tateOptions = isOsonae ? [
    { id: 'p1_k_yoko_bg', label: '① 御供｜横型', needs: ['3'], layout: 'horizontal' },
    { id: 'p3_k_tate_simple', label: '② 御供｜縦型 (シンプル)', needs: ['3'], layout: 'vertical' },
    { id: 'p4_k_tate_company', label: '③ 御供｜縦型 (会社名入り)', needs: ['3a', '3b'], layout: 'vertical' }
  ] : [
    { id: 'p5_c_yoko_line', label: '⑤ 祝｜横型', needs: ['1', '3'], layout: 'horizontal' },
    { id: 'p6_c_yoko_sama', label: '⑥ 祝｜横型 (様へ構成)', needs: ['1', '2', '3'], layout: 'horizontal' },
    { id: 'p7_c_tate_2col', label: '⑦ 祝｜縦型 (二列構成)', needs: ['1', '3'], layout: 'vertical' },
    { id: 'p8_c_tate_3col', label: '⑧ 祝｜縦型 (三列完成版)', needs: ['1', '2', '3'], layout: 'vertical' }
  ];
  const selectedTateOpt = tateOptions.find(opt => opt.id === tatePattern);
  const tateNeeds = selectedTateOpt?.needs || [];
  const topPrefixText = isOsonae ? (prefixFormat === 'hiragana' ? 'お供え' : '御供') : (prefixFormat === 'hiragana' ? 'お祝い' : '祝');

  const getPriceOptions = () => {
    if (!flowerType) return [];
    let min = 2000, max = 20000, stepSize = 1000;
    if (selectedItemSettings.minPrice) {
      min = Number(selectedItemSettings.minPrice);
      max = Number(selectedItemSettings.maxPrice);
      stepSize = Number(selectedItemSettings.stepPrice);
    }
    if ((receiveMethod === 'delivery' || receiveMethod === 'sagawa') && min < 3000) min = 3000;
    const options = [];
    for (let i = min; i <= max; i += stepSize) options.push(i);
    return options;
  };

  const minDateLimit = useMemo(() => {
    const base = new Date();
    const isLongWait = flowerType === 'ドライフラワー' || isBring === 'bring';
    const pickupDate = new Date(base);
    pickupDate.setDate(base.getDate() + (isLongWait ? 7 : 2));
    return pickupDate.toISOString().split('T')[0];
  }, [flowerType, isBring]);

  const normalizeAddressText = (text) => {
    if (!text) return '';
    let res = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const kMap = {'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'};
    res = res.replace(/三十([一二三四五六七八九])/g, (m, p1) => '3' + kMap[p1]);
    res = res.replace(/二十([一二三四五六七八九])/g, (m, p1) => '2' + kMap[p1]);
    res = res.replace(/十([一二三四五六七八九])/g, (m, p1) => '1' + kMap[p1]);
    res = res.replace(/三十/g, '30'); res = res.replace(/二十/g, '20'); res = res.replace(/十/g, '10');
    res = res.replace(/[一二三四五六七八九〇]/g, m => ({...kMap, '〇':'0'})[m] || m);
    return res;
  };

  useEffect(() => {
    if (!receiveMethod || receiveMethod === 'pickup' || !itemPrice) { setCalculatedFee(null); setAreaError(''); return; }
    const targetInfo = isRecipientDifferent ? recipientInfo : customerInfo;
    const rawAddress = ((targetInfo.address1 || '') + (targetInfo.address2 || '')).replace(/[\s　]+/g, '');
    if (!rawAddress) { setCalculatedFee(null); setAreaError(''); return; }

    if (receiveMethod === 'delivery') {
      const normalizedAddress = normalizeAddressText(rawAddress);
      const northPatterns = ["23", "24", "25", "26", "27"]; const westPatterns = ["3", "4", "5"];
      let isFreeArea = false;
      for (const n of northPatterns) { for (const w of westPatterns) { if (normalizedAddress.includes(`北${n}条西${w}`)) { isFreeArea = true; break; } } if (isFreeArea) break; }
      let baseFee = null;
      if (isFreeArea) { baseFee = 0; } 
      else if (appSettings?.deliveryAreas?.length > 0) {
        for (const area of appSettings.deliveryAreas) {
          const keywords = area.keywords.split(',').map(k => k.trim()).filter(k => k);
          if (keywords.some(keyword => rawAddress.includes(keyword) || normalizedAddress.includes(keyword))) { baseFee = Number(area.fee); break; }
        }
      } else {
        if (normalizedAddress.includes("厚別区") || normalizedAddress.includes("清田区") || normalizedAddress.includes("南区")) baseFee = 1000;
        else if (normalizedAddress.includes("白石区") || normalizedAddress.includes("豊平区") || normalizedAddress.includes("手稲区") || normalizedAddress.includes("石狩市")) baseFee = 800;
        else if (normalizedAddress.includes("北区") || normalizedAddress.includes("中央区") || normalizedAddress.includes("東区") || normalizedAddress.includes("西区")) baseFee = 500;
      }

      if (baseFee !== null) { setCalculatedFee(flowerType.includes('スタンド') ? baseFee * 1.5 : baseFee); setAreaError(''); } 
      else { setCalculatedFee(null); setAreaError('入力された住所は自社配達エリア外です。'); }
    } else if (receiveMethod === 'sagawa') {
      const prefMatch = rawAddress.match(/^(北海道|東京都|(?:京都|大阪)府|.{2,3}県)/);
      if (!prefMatch) { setCalculatedFee(null); setAreaError('都道府県が判別できません。'); return; }
      const targetPref = prefMatch[1].replace(/(都|府|県)$/, ''); const searchPref = targetPref === '北海' ? '北海道' : targetPref;
      if (appSettings?.shippingRates) {
        const rateData = appSettings.shippingRates.find(r => r.prefs.includes(searchPref));
        if (rateData) { setCalculatedFee(rateData.fee); setAreaError(''); return; }
      }
      setCalculatedFee(2050); setAreaError('');
    }
  }, [customerInfo.address1, customerInfo.address2, recipientInfo.address1, recipientInfo.address2, isRecipientDifferent, receiveMethod, flowerType, itemPrice, selectedDate, appSettings]);

  const fetchAddress = async (zip, target) => {
    if (zip.length !== 7) return;
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip}`);
      const data = await res.json();
      if (data.results) {
        const fullAddr = `${data.results[0].address1}${data.results[0].address2}${data.results[0].address3}`;
        if (target === 'customer') setCustomerInfo(prev => ({ ...prev, address1: fullAddr }));
        else setRecipientInfo(prev => ({ ...prev, address1: fullAddr }));
      }
    } catch (error) { console.error("住所検索エラー"); }
  };

  const getTimeOptions = () => {
    if (!selectedDate) return [];
    if (receiveMethod === 'delivery') return ["9:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00"];
    if (receiveMethod === 'sagawa') return ["午前中", "12:00-14:00", "14:00-16:00", "16:00-18:00", "18:00-20:00", "19:00-21:00"];
    if (receiveMethod === 'pickup' && selectedShop) {
      const shopObj = appSettings?.shops?.find(s => s.name === selectedShop);
      if (shopObj) return [`${shopObj.normalOpen}-${shopObj.normalClose}`];
      return ["11:00-18:00"];
    }
    return [];
  };

  const isFormInvalid = () => {
    if (step === 3) {
      if (!flowerPurpose || !flowerColor || !flowerVibe || !itemPrice) return true;
      if (cardType === 'メッセージカード' && !cardMessage) return true;
      if (cardType === '立札' && !tatePattern) return true;
    }
    if (step === 4) {
      if (!customerInfo.name || !customerInfo.phone || !selectedDate || !selectedTime || !methodAgreed) return true;
      if ((receiveMethod === 'delivery' || receiveMethod === 'sagawa') && areaError) return true;
    }
    return false;
  };

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    try {
      const orderPayload = {
        shopId, flowerType, isBring, receiveMethod, selectedShop,
        selectedDate, selectedTime, itemPrice, calculatedFee,
        flowerPurpose, flowerColor, flowerVibe, otherPurpose, otherVibe,
        cardType, cardMessage, tatePattern,
        tateInput1, tateInput2, tateInput3, tateInput3a, tateInput3b,
        customerInfo, isRecipientDifferent, recipientInfo, note,
        referenceImage: selectedImage ? selectedImage.url : null, // ★スタッフが確認できるように保存
        status: 'new' 
      };

      const { error } = await supabase.from('orders').insert([{ order_data: orderPayload }]);
      if (error) throw error;

      router.push(`/order/${shopId}/thanks`);
      
    } catch (error) {
      console.error('注文エラー:', error.message);
      alert('注文の送信に失敗しました。');
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-sans"><div className="text-[#2D4B3E] font-bold tracking-widest animate-pulse">読み込み中...</div></div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-[600px] mx-auto h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? <img src={logoUrl} alt={appName} className="h-6 object-contain" /> : <span className="font-serif font-bold tracking-tight text-[18px] text-[#2D4B3E]">{appName}</span>}
          </div>
          <div className="text-[10px] font-bold tracking-widest text-[#999999]">ステップ {step} / 4</div>
        </div>
        <div className="h-0.5 w-full bg-[#FBFAF9]">
          <div className="h-full transition-all duration-500 ease-out bg-[#2D4B3E]" style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-6 pt-10">

        {/* --- STEP 1: お花の種類 --- */}
        {step === 1 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">商品を選ぶ</h1>
              <p className="text-[12px] text-[#555555]">ご希望のアイテムとお持ち込みの有無をお選びください。</p>
            </div>
            <div className="space-y-6">
              <select className="w-full h-16 px-5 bg-white border border-[#EAEAEA] rounded-[20px] outline-none focus:border-[#2D4B3E] transition-all text-[15px] font-bold appearance-none shadow-sm" value={flowerType} onChange={(e) => { setFlowerType(e.target.value); setItemPrice(''); setIsBring('shop'); }}>
                <option value="">種類を選択してください</option>
                {appSettings?.flowerItems?.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>

              {flowerType && selectedItemSettings.canBringFlowers && (
                <div className="bg-white p-6 rounded-[24px] border border-[#EAEAEA] shadow-sm space-y-4 animate-in fade-in">
                  <p className="text-[11px] font-bold text-[#999999] uppercase tracking-widest text-center">お花・花器の持ち込み</p>
                  <div className="flex gap-2 p-1 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                    <button onClick={() => setIsBring('shop')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${isBring === 'shop' ? 'bg-white text-[#2D4B3E] shadow-sm' : 'text-[#999999]'}`}>当店のお花のみ</button>
                    <button onClick={() => setIsBring('bring')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${isBring === 'bring' ? 'bg-white text-[#2D4B3E] shadow-sm' : 'text-[#999999]'}`}>持ち込みあり</button>
                  </div>
                </div>
              )}

              {flowerType ? (
                <div className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] space-y-4 animate-in fade-in">
                  <p className="text-[11px] font-bold text-[#111111] tracking-widest border-b border-[#EAEAEA] pb-2">納期に関する注意事項</p>
                  <div className="space-y-2 text-[12px] text-[#555555] font-medium">
                    {selectedItemSettings.normalLeadDays && <div className="flex justify-between"><span>通常納期 (店頭/配達)</span><span className="font-bold">{selectedItemSettings.normalLeadDays}日後以降</span></div>}
                    {selectedItemSettings.shippingLeadDays && <div className="flex justify-between"><span>配送 (佐川急便) 納期</span><span className="font-bold">{selectedItemSettings.shippingLeadDays}日後以降</span></div>}
                    {isBring === 'bring' && selectedItemSettings.bringFlowersLeadDays && <div className="flex justify-between text-[#2D4B3E] pt-1"><span>お持ち込み時 (通常より延長)</span><span className="font-bold">{selectedItemSettings.bringFlowersLeadDays}日後以降</span></div>}
                  </div>
                  <label className="flex items-center gap-3 pt-4 cursor-pointer border-t border-[#EAEAEA]">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-5 h-5 accent-[#2D4B3E] rounded-md cursor-pointer" />
                    <span className="text-[13px] font-bold text-[#111111] underline underline-offset-4">内容を確認し、同意します</span>
                  </label>
                </div>
              ) : (
                <div className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] text-center border-dashed">
                   <p className="text-[12px] text-[#999999] font-bold">種類を選択すると納期が表示されます</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- STEP 2: お受け取り方法 --- */}
        {step === 2 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">受取方法を選ぶ</h1>
              <p className="text-[12px] text-[#555555]">ご来店、または配達・配送をお選びください。</p>
            </div>
            <div className="space-y-4">
              {selectedItemSettings.canPickup !== false && appSettings?.shops?.length > 0 ? (
                appSettings.shops.map(shop => (
                  <button key={shop.id} onClick={() => { setReceiveMethod('pickup'); setSelectedShop(shop.name); setStep(3); }} className="w-full p-8 rounded-[24px] bg-white border border-[#EAEAEA] shadow-sm hover:border-[#2D4B3E] transition-all text-left group">
                    <span className="block font-bold text-[16px] mb-1 group-hover:text-[#2D4B3E]">{shop.name}で受取</span>
                    <span className="block text-[12px] text-[#999999]">{shop.address} ({shop.normalOpen}-{shop.normalClose})</span>
                  </button>
                ))
              ) : null}
              <div className="grid grid-cols-2 gap-4 mt-8">
                {selectedItemSettings.canDelivery !== false && (<button onClick={() => { setReceiveMethod('delivery'); setStep(3); }} className="p-6 rounded-[24px] bg-[#FBFAF9] border border-[#EAEAEA] font-bold text-[14px] hover:bg-white hover:border-[#2D4B3E] transition-all text-[#555555] hover:text-[#2D4B3E]">自社配達</button>)}
                {selectedItemSettings.canShipping !== false && (<button onClick={() => { setReceiveMethod('sagawa'); setStep(3); }} className="p-6 rounded-[24px] bg-[#FBFAF9] border border-[#EAEAEA] font-bold text-[14px] hover:bg-white hover:border-[#2D4B3E] transition-all text-[#555555] hover:text-[#2D4B3E]">配送(佐川急便)</button>)}
              </div>
            </div>
          </div>
        )}

        {/* --- STEP 3: デザイン詳細と画像提案 --- */}
        {step === 3 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">デザイン・詳細設定</h1>
              <p className="text-[12px] text-[#555555]">お花のイメージと、立札・カードの内容を入力してください。</p>
            </div>

            <div className="space-y-8 bg-white p-8 rounded-[28px] border border-[#EAEAEA] shadow-sm transition-all duration-500">
              
              {/* ▼ 画像自動提案エリア ▼ */}
              {matchingImages.length > 0 && (
                <div className="bg-[#2D4B3E]/5 -mx-8 -mt-8 p-6 pb-8 mb-4 rounded-t-[28px] border-b border-[#EAEAEA] space-y-4">
                   <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest flex items-center gap-2">
                     ✨ 条件に合うおすすめのスタイル
                   </p>
                   <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                     {matchingImages.map(img => (
                       <div key={img.id} className="shrink-0 w-[140px] space-y-2 snap-center">
                         <div 
                           onClick={() => handleSelectImage(img)}
                           className={`relative aspect-square rounded-[20px] overflow-hidden border-4 transition-all cursor-pointer ${selectedImage?.id === img.id ? 'border-[#2D4B3E] shadow-lg scale-105' : 'border-transparent hover:scale-105'}`}
                         >
                           <img src={img.url} alt="style" className="w-full h-full object-cover" />
                           {selectedImage?.id === img.id && (
                             <div className="absolute inset-0 bg-[#2D4B3E]/30 flex items-center justify-center backdrop-blur-[1px]">
                               <span className="bg-[#2D4B3E] text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm tracking-widest">選択中</span>
                             </div>
                           )}
                         </div>
                         <div className="text-center">
                           <p className="text-[11px] font-bold text-[#2D4B3E]">¥{img.price.toLocaleString()}</p>
                           <button onClick={() => handleSelectImage(img)} className="text-[9px] font-bold text-[#999999] hover:text-[#2D4B3E] mt-1 border border-[#EAEAEA] bg-white px-3 py-1 rounded-full">
                             {selectedImage?.id === img.id ? '選択解除' : 'このイメージで作る'}
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">ご用途</label>
                <select value={flowerPurpose} onChange={(e) => setFlowerPurpose(e.target.value)} className="w-full h-12 border-b border-[#EAEAEA] bg-transparent outline-none font-bold focus:border-[#2D4B3E] transition-all">
                  <option value="">選択...</option><option value="誕生日">誕生日</option><option value="開店">開店</option><option value="お供え">お供え</option><option value="その他">その他</option>
                </select>
                {flowerPurpose === 'その他' && <input type="text" placeholder="詳細を入力..." value={otherPurpose} onChange={(e) => setOtherPurpose(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-sm border border-[#EAEAEA]" />}
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">メインカラー</label>
                <select value={flowerColor} onChange={(e) => setFlowerColor(e.target.value)} className="w-full h-12 border-b border-[#EAEAEA] bg-transparent outline-none font-bold focus:border-[#2D4B3E] transition-all">
                  <option value="">選択...</option><option value="暖色系">暖色系</option><option value="寒色系">寒色系</option><option value="おまかせ">おまかせ</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">イメージ</label>
                <select value={flowerVibe} onChange={(e) => setFlowerVibe(e.target.value)} className="w-full h-12 border-b border-[#EAEAEA] bg-transparent outline-none font-bold focus:border-[#2D4B3E] transition-all">
                  <option value="">選択...</option><option value="かわいい">かわいい</option><option value="豪華">豪華</option><option value="大人っぽい">大人っぽい</option><option value="元気">元気</option><option value="おまかせ">おまかせ</option><option value="その他">その他</option>
                </select>
                {flowerVibe === 'その他' && <input type="text" placeholder="イメージの詳細をご入力ください" value={otherVibe} onChange={(e) => setOtherVibe(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-sm border border-[#EAEAEA]" />}
              </div>
              <div className="space-y-3 pt-4">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center justify-between">
                  ご予算 (税抜)
                  {selectedImage && <span className="bg-[#2D4B3E] text-white px-2 py-0.5 rounded text-[9px]">画像から自動反映</span>}
                </label>
                <select value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className={`w-full h-14 border rounded-xl px-4 bg-[#FBFAF9] outline-none font-bold text-[16px] transition-all ${selectedImage ? 'border-[#2D4B3E] text-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA] focus:border-[#2D4B3E]'}`}>
                  <option value="">選択...</option>
                  {getPriceOptions().map(price => (<option key={price} value={price}>¥{price.toLocaleString()}</option>))}
                  {/* 画像の金額がリストにない場合の特別表示用 */}
                  {selectedImage && itemPrice && !getPriceOptions().includes(Number(itemPrice)) && (
                    <option value={itemPrice}>¥{Number(itemPrice).toLocaleString()}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[11px] font-bold text-[#999999] tracking-widest text-center">メッセージ・立札</p>
              <div className="flex gap-2 p-1 bg-white rounded-2xl border border-[#EAEAEA]">
                {['なし', 'メッセージカード', '立札'].map(t => (
                  <button key={t} onClick={() => setCardType(t)} className={`flex-1 py-3 text-[12px] font-bold rounded-xl transition-all ${cardType === t ? 'bg-[#2D4B3E] text-white shadow-md' : 'text-[#555555]'}`}>{t}</button>
                ))}
              </div>

              {cardType === 'メッセージカード' && (
                 <textarea value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} placeholder="カードのメッセージをご入力ください" className="w-full h-32 p-4 bg-white border border-[#EAEAEA] rounded-[24px] text-[13px] resize-none outline-none focus:border-[#2D4B3E] shadow-sm animate-in zoom-in-95"></textarea>
              )}

              {cardType === '立札' && (
                <div className="space-y-6 bg-white p-6 rounded-[28px] border border-[#EAEAEA] shadow-sm animate-in zoom-in-95 duration-300">
                  <select value={tatePattern} onChange={(e) => setTatePattern(e.target.value)} className="w-full h-14 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none font-bold text-[13px]">
                    <option value="">レイアウトを選択</option>
                    {tateOptions.map(opt => (<option key={opt.id} value={opt.id}>{opt.label}</option>))}
                  </select>
                  
                  {tatePattern && (
                    <div className="space-y-3">
                      {tateNeeds.includes('1') && <input type="text" placeholder="① 内容 (例: 御開店)" value={tateInput1} onChange={(e) => setTateInput1(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('2') && <input type="text" placeholder="② 宛名 (例: 〇〇様)" value={tateInput2} onChange={(e) => setTateInput2(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('3') && <input type="text" placeholder="③ 贈り主 (例: 株式会社〇〇)" value={tateInput3} onChange={(e) => setTateInput3(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('3a') && <input type="text" placeholder="③-1 会社名" value={tateInput3a} onChange={(e) => setTateInput3a(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('3b') && <input type="text" placeholder="③-2 役職・氏名" value={tateInput3b} onChange={(e) => setTateInput3b(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      
                      <p className="text-[10px] font-bold text-[#999999] tracking-widest text-center pt-4">仕上がりプレビュー</p>
                      <div className={`relative mx-auto border border-[#EAEAEA] shadow-lg bg-white flex flex-col items-center ${selectedTateOpt?.layout === 'horizontal' ? 'aspect-[1.414/1] w-full justify-center p-6' : 'aspect-[1/1.414] h-[300px] pt-6 px-4'}`}>
                         <div className={`font-bold ${selectedTateOpt?.color === 'red' ? 'text-red-600' : 'text-gray-800'} ${selectedTateOpt?.layout === 'horizontal' ? 'text-[28px] mb-4' : 'text-[40px] mb-6 leading-none'}`}>{topPrefixText}</div>
                         <div className={`flex w-full font-bold text-gray-900 ${selectedTateOpt?.layout === 'horizontal' ? 'flex-col items-center gap-2 text-[16px]' : 'flex-row-reverse justify-center gap-6 text-[18px]'}`}>
                            {tatePattern.includes('p6') || tatePattern.includes('p8') ? (<><div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput2 || '宛名'}様</div><div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput1 || '内容'}</div><div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3 || '贈り主'}</div></>) : tatePattern.includes('p4') ? (<><div className={`tracking-[0.3em] ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3a || '会社名'}</div><div className={`tracking-[0.3em] font-normal ${selectedTateOpt?.layout === 'horizontal' ? 'mt-4 text-[14px]' : 'mt-6 text-[14px] [writing-mode:vertical-rl]'}`}>{tateInput3b || '役職・氏名'}</div></>) : (<><div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput1 || '内容'}</div><div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3 || '贈り主'}</div></>)}
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- STEP 4: お届け・お客様情報 --- */}
        {step === 4 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">お届け・お客様情報</h1>
              <p className="text-[12px] text-[#555555]">お届け希望日と、お客様の情報をご入力ください。</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#999999] tracking-widest">お届け希望日</label>
                  <input type="date" min={minDateLimit} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full h-14 px-4 bg-white border border-[#EAEAEA] rounded-[16px] outline-none font-bold text-[#555555] focus:border-[#2D4B3E]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#999999] tracking-widest">希望時間</label>
                  <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full h-14 px-4 bg-white border border-[#EAEAEA] rounded-[16px] outline-none font-bold text-[#555555] focus:border-[#2D4B3E]">
                    <option value="">選択...</option>
                    {getTimeOptions().map(t => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
              </div>

              <div className="space-y-4 bg-white p-8 rounded-[28px] border border-[#EAEAEA] shadow-sm">
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-[#999999] tracking-widest">注文者情報</label>
                  <input type="text" placeholder="お名前" value={customerInfo.name} onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="tel" placeholder="電話番号" value={customerInfo.phone} onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  {receiveMethod !== 'pickup' && (
                    <>
                      <input type="text" placeholder="郵便番号 (7桁・ハイフンなし)" value={customerInfo.zip} onChange={(e) => { setCustomerInfo({...customerInfo, zip: e.target.value}); if(e.target.value.length === 7) fetchAddress(e.target.value, 'customer'); }} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                      <input type="text" placeholder="住所が自動入力されます" value={customerInfo.address1} className="w-full h-14 px-5 bg-[#EAEAEA]/30 rounded-xl outline-none text-[#999999] text-[14px]" readOnly />
                      <input type="text" placeholder="番地・建物名など" value={customerInfo.address2} onChange={(e) => setCustomerInfo({...customerInfo, address2: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                    </>
                  )}
                </div>

                {calculatedFee !== null && (
                  <div className="mt-6 pt-6 border-t border-[#FBFAF9] flex justify-between items-center font-bold animate-in fade-in">
                    <span className="text-[12px] text-[#999999]">配送料:</span>
                    <span className="text-[18px] text-[#2D4B3E]">{calculatedFee === 0 ? '無料' : `¥${calculatedFee.toLocaleString()}`}</span>
                  </div>
                )}
                {areaError && <p className="text-red-500 text-[11px] font-bold mt-2">{areaError}</p>}
              </div>

              {receiveMethod !== 'pickup' && (
                <div className="pt-2">
                  <label className="flex items-center gap-3 p-4 bg-white rounded-[16px] border border-[#EAEAEA] cursor-pointer shadow-sm">
                    <input type="checkbox" checked={isRecipientDifferent} onChange={(e) => setIsRecipientDifferent(e.target.checked)} className="w-5 h-5 accent-[#2D4B3E] rounded" />
                    <span className="text-[13px] font-bold text-[#111111]">お届け先が注文者と異なる</span>
                  </label>
                </div>
              )}

              {isRecipientDifferent && receiveMethod !== 'pickup' && (
                <div className="space-y-4 bg-white p-8 rounded-[28px] border border-[#2D4B3E]/20 shadow-sm animate-in fade-in zoom-in-95">
                  <label className="text-[11px] font-bold text-[#2D4B3E] tracking-widest">お届け先情報</label>
                  <input type="text" placeholder="お届け先 お名前" value={recipientInfo.name} onChange={(e) => setRecipientInfo({...recipientInfo, name: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="tel" placeholder="お届け先 電話番号" value={recipientInfo.phone} onChange={(e) => setRecipientInfo({...recipientInfo, phone: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="text" placeholder="郵便番号 (7桁)" value={recipientInfo.zip} onChange={(e) => { setRecipientInfo({...recipientInfo, zip: e.target.value}); if(e.target.value.length === 7) fetchAddress(e.target.value, 'recipient'); }} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="text" placeholder="住所" value={recipientInfo.address1} className="w-full h-14 px-5 bg-[#EAEAEA]/30 rounded-xl outline-none text-[#999999] text-[14px]" readOnly />
                  <input type="text" placeholder="番地・建物名など" value={recipientInfo.address2} onChange={(e) => setRecipientInfo({...recipientInfo, address2: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                </div>
              )}

              <div className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] font-sans space-y-4 mt-6">
                <p className="text-[11px] font-bold text-[#111111] tracking-widest border-b border-[#EAEAEA] pb-2">
                  {receiveMethod === 'pickup' ? '店頭受取に関する注意事項' : receiveMethod === 'delivery' ? '自社配達に関する注意事項' : '配送に関する注意事項'}
                </p>
                <div className="text-[12px] text-[#555555] space-y-3 leading-relaxed font-medium">
                  {receiveMethod === 'pickup' && <p>お受け取り予定日にご来店いただけない場合や、遅れる場合は、必ず事前に店舗までご連絡をお願いいたします。</p>}
                  {receiveMethod === 'delivery' && (
                    <>
                      <p>・配達可能エリア外への配達をご希望の場合は、お電話にて直接お問い合わせください。</p>
                      {flowerType.includes('スタンド') && calculatedFee > 0 && <p className="font-bold text-[#2D4B3E]">※スタンド花をご注文の場合、後日回収が必要となるため配達料が通常の1.5倍となります。</p>}
                    </>
                  )}
                  {receiveMethod === 'sagawa' && (
                    <>
                      <div className="space-y-1"><p className="font-bold text-[#111111]">■ 配送時の事故について</p><p>配送中の事故につきましては、当店では補償いたしかねます。商品到着時に不具合等が確認された場合は、直接配送業者へご連絡くださいますようお願いいたします。</p></div>
                      <div className="space-y-1 pt-2"><p className="font-bold text-[#111111]">■ 日付・時間指定について</p><p>天候や離島への配送などの事情により、ご希望の日時に到着しない場合がございます。到着日指定の際は、日数に余裕をもってご注文ください。</p></div>
                    </>
                  )}
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#EAEAEA]">
                    <input type="checkbox" id="methodAgreed" checked={methodAgreed} onChange={(e) => setMethodAgreed(e.target.checked)} className="w-5 h-5 accent-[#2D4B3E] cursor-pointer rounded-md" />
                    <label htmlFor="methodAgreed" className="text-[13px] font-bold underline cursor-pointer text-[#111111]">上記の内容に同意する</label>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ナビゲーション */}
        <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-[#EAEAEA] py-4 px-6 z-50">
          <div className="max-w-[600px] mx-auto flex gap-4">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="px-6 h-14 shrink-0 rounded-[16px] bg-white border border-[#EAEAEA] text-[#555555] font-bold text-[14px] hover:bg-[#F7F7F7] transition-all">戻る</button>
            )}
            <button 
              disabled={isFormInvalid() || (step === 1 && !agreed) || isSubmitting} 
              onClick={() => step < 4 ? setStep(step + 1) : handleSubmitOrder()} 
              className={`flex-1 h-14 rounded-[16px] bg-[#2D4B3E] text-white font-bold text-[15px] tracking-widest shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 hover:bg-[#1f352b]`}
            >
              {step === 4 ? (isSubmitting ? '送信中...' : '注文を確定する') : '次へ進む'}
            </button>
          </div>
        </div>

      </main>

      {/* スクロールバー非表示用のCSSを追加 */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
        .font-serif { font-family: 'Noto Serif JP', serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}