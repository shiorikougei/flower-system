'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Calendar, Package, ChevronRight, Store, Truck, Building2 } from 'lucide-react';

// ★ キャッシュ用のキー
const SETTINGS_CACHE_KEY = 'florix_app_settings_cache';
const GALLERY_CACHE_KEY = 'florix_gallery_cache';

export default function CorporateOrderPage() {
  const router = useRouter();

  // --- 法人ログインユーザーのダミーデータ（※本番ではSupabase Authから取得） ---
  const myCompany = {
    companyName: '株式会社 グローバルIT',
    contactName: '山田 太郎',
    phone: '03-1234-5678',
    email: 'info@global-it.example.com',
    zip: '100-0001',
    address1: '東京都千代田区',
    address2: '千代田1-1-1 グローバルビル5F',
  };

  const [appSettings, setAppSettings] = useState(null);
  const [portfolioImages, setPortfolioImages] = useState([]);
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
  const [shippingDate, setShippingDate] = useState('');
  
  const [itemPrice, setItemPrice] = useState('');
  const [flowerPurpose, setFlowerPurpose] = useState('');
  const [flowerColor, setFlowerColor] = useState('');
  const [flowerVibe, setFlowerVibe] = useState('');
  const [otherPurpose, setOtherPurpose] = useState('');
  const [otherVibe, setOtherVibe] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); 

  const [absenceAction, setAbsenceAction] = useState('持ち戻り'); 
  const [absenceNote, setAbsenceNote] = useState(''); 

  const [cardType, setCardType] = useState('なし');
  const [cardMessage, setCardMessage] = useState('');
  // ★ 立札の「贈り主」に初期値として自社名をセットしておく
  const [tatePattern, setTatePattern] = useState('');
  const [tateInput1, setTateInput1] = useState(''); 
  const [tateInput2, setTateInput2] = useState(''); 
  const [tateInput3, setTateInput3] = useState(myCompany.companyName); 
  const [tateInput3a, setTateInput3a] = useState(myCompany.companyName); 
  const [tateInput3b, setTateInput3b] = useState(`代表取締役 ${myCompany.contactName}`); 

  // ★ 注文者情報に初期値として自社情報をフルセットしておく
  const [customerInfo, setCustomerInfo] = useState({ 
    name: `${myCompany.companyName} ${myCompany.contactName}`, 
    phone: myCompany.phone, 
    email: myCompany.email, 
    zip: myCompany.zip, 
    address1: myCompany.address1, 
    address2: myCompany.address2 
  });
  
  // 法人は他社へ送る（お届け先が異なる）ケースが圧倒的に多いので、初期状態をtrueに
  const [isRecipientDifferent, setIsRecipientDifferent] = useState(true);
  const [recipientInfo, setRecipientInfo] = useState({ name: '', phone: '', zip: '', address1: '', address2: '' });
  
  const [calculatedFee, setCalculatedFee] = useState(null);
  const [pickupFee, setPickupFee] = useState(0); 
  const [areaError, setAreaError] = useState('');
  
  // ★ 支払い方法（法人は請求書払いをデフォルトにする）
  const [paymentMethod, setPaymentMethod] = useState('請求書払い (月末締め 翌月末払い)');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultTimeSlots = {
    pickup: ['10:00-12:00', '12:00-15:00', '15:00-18:00'],
    delivery: ['9:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
    shipping: ['午前中', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
  };
  const [timeSlots, setTimeSlots] = useState(defaultTimeSlots);

  // ★ キャッシュ化ロジック
  useEffect(() => {
    let isFirstLoad = true;
    const applyDataToState = (settingsData, galleryData) => {
      if (settingsData) {
        setAppSettings(settingsData);
        if (settingsData.timeSlots) setTimeSlots(settingsData.timeSlots);
      }
      if (galleryData?.images) setPortfolioImages(galleryData.images);
    };

    async function fetchSettings() {
      try {
        // 1. キャッシュから即時復元
        const cachedSettings = sessionStorage.getItem(SETTINGS_CACHE_KEY);
        const cachedGallery = sessionStorage.getItem(GALLERY_CACHE_KEY);

        if (cachedSettings) {
          applyDataToState(JSON.parse(cachedSettings), cachedGallery ? JSON.parse(cachedGallery) : null);
          isFirstLoad = false;
          setIsLoading(false); // 画面を即時表示
        }

        // 2. バックグラウンドで最新データを取得
        const [settingsRes, galleryRes] = await Promise.all([
          supabase.from('app_settings').select('settings_data').eq('id', 'default').single(),
          supabase.from('app_settings').select('settings_data').eq('id', 'gallery').single()
        ]);

        if (settingsRes.data?.settings_data) {
          applyDataToState(settingsRes.data.settings_data, galleryRes.data?.settings_data);
          // 最新データをキャッシュに上書き保存
          sessionStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settingsRes.data.settings_data));
          if (galleryRes.data?.settings_data) {
            sessionStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify(galleryRes.data.settings_data));
          }
        }
      } catch (err) {
        console.error('設定読込エラー:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const selectedItemSettings = useMemo(() => appSettings?.flowerItems?.find(i => i.name === flowerType) || {}, [flowerType, appSettings]);

  const matchingImages = useMemo(() => {
    if (!portfolioImages || portfolioImages.length === 0) return [];
    return portfolioImages.filter(img => {
      let match = true;
      if (flowerPurpose && flowerPurpose !== 'その他' && img.purpose && img.purpose !== flowerPurpose) match = false;
      if (flowerColor && flowerColor !== 'おまかせ' && img.color && img.color !== flowerColor) match = false;
      if (flowerVibe && flowerVibe !== 'その他' && flowerVibe !== 'おまかせ' && img.vibe && img.vibe !== flowerVibe) match = false;
      return match;
    });
  }, [portfolioImages, flowerPurpose, flowerColor, flowerVibe]);

  const handleSelectImage = (img) => {
    if (selectedImage?.id === img.id) {
      setSelectedImage(null); 
    } else {
      setSelectedImage(img);
      if (img.price > 0) setItemPrice(String(img.price));
      if (img.purpose) setFlowerPurpose(img.purpose);
      if (img.color) setFlowerColor(img.color);
      if (img.vibe) setFlowerVibe(img.vibe);
    }
  };

  const isOsonae = flowerPurpose === 'お供え';
  const tateOptions = isOsonae ? [
    { id: 'p1', label: '① 御供｜横型 (背景あり)', needs: ['3'], layout: 'horizontal' },
    { id: 'p3', label: '② 御供｜縦型 (シンプル)', needs: ['3'], layout: 'vertical' },
    { id: 'p4', label: '③ 御供｜縦型 (会社名入)', needs: ['3a', '3b'], layout: 'vertical' }
  ] : [
    { id: 'p5', label: '⑤ 祝｜横型 (スタンダード)', needs: ['1', '3'], layout: 'horizontal' },
    { id: 'p6', label: '⑥ 祝｜横型 (様へ構成)', needs: ['1', '2', '3'], layout: 'horizontal' },
    { id: 'p7', label: '⑦ 祝｜縦型 (二列構成)', needs: ['1', '3'], layout: 'vertical' },
    { id: 'p8', label: '⑧ 祝｜縦型 (三列完成版)', needs: ['1', '2', '3'], layout: 'vertical' }
  ];
  const selectedTateOpt = tateOptions.find(opt => opt.id === tatePattern);
  const tateNeeds = selectedTateOpt?.needs || [];
  const topPrefixText = isOsonae ? '御供' : '祝';

  const getPriceOptions = () => {
    if (!flowerType) return [];
    let min = 2000, max = 50000, stepSize = 1000;
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

  const transitDays = useMemo(() => {
    if (receiveMethod !== 'sagawa') return 0;
    const targetInfo = isRecipientDifferent ? recipientInfo : customerInfo;
    const rawAddress = ((targetInfo.address1 || '') + (targetInfo.address2 || '')).replace(/[\s　]+/g, '');
    const prefMatch = rawAddress.match(/^(北海道|東京都|(?:京都|大阪)府|.{2,3}県)/);
    
    if (prefMatch && appSettings?.shippingRates) {
      const targetPref = prefMatch[1].replace(/(都|府|県)$/, ''); 
      const searchPref = targetPref === '北海' ? '北海道' : targetPref;
      let rateData = appSettings.shippingRates.find(r => r.prefs && r.prefs.includes(searchPref));
      if (!rateData) rateData = appSettings.shippingRates.find(r => r.region && r.region.includes(searchPref));
      if (rateData) return Number(rateData.leadDays) || 1;
    }
    return 1;
  }, [receiveMethod, customerInfo.address1, recipientInfo.address1, isRecipientDifferent, appSettings]);

  const minDateLimit = useMemo(() => {
    const base = new Date();
    let prepDays = 0;
    if (receiveMethod === 'sagawa') {
      prepDays = Number(selectedItemSettings?.shippingLeadDays) || 0;
    } else {
      prepDays = Number(selectedItemSettings?.normalLeadDays) || 0;
    }
    if (isBring === 'bring') {
      const fLead = Number(selectedItemSettings?.canBringFlowersLeadDays) || 0;
      const vLead = Number(selectedItemSettings?.canBringVaseLeadDays) || 0;
      if (selectedItemSettings?.canBringFlowers && fLead > prepDays) prepDays = fLead;
      if (selectedItemSettings?.canBringVase && vLead > prepDays) prepDays = vLead;
    }
    const d = new Date(base);
    d.setDate(d.getDate() + prepDays + transitDays);
    return d.toISOString().split('T')[0];
  }, [flowerType, isBring, receiveMethod, selectedItemSettings, transitDays]);

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
    if (!receiveMethod || receiveMethod === 'pickup' || !itemPrice) { 
      setCalculatedFee(null); setPickupFee(0); setAreaError(''); setShippingDate(''); return; 
    }
    
    const targetInfo = isRecipientDifferent ? recipientInfo : customerInfo;
    const rawAddress = ((targetInfo.address1 || '') + (targetInfo.address2 || '')).replace(/[\s　]+/g, '');
    if (!rawAddress) { 
      setCalculatedFee(null); setPickupFee(0); setAreaError(''); setShippingDate(''); return; 
    }

    let baseFee = 0, boxFee = 0, coolFee = 0, pickupFeeAmt = 0;

    if (receiveMethod === 'delivery') {
      setShippingDate(''); 
      const normalizedAddress = normalizeAddressText(rawAddress);
      const northPatterns = ["23", "24", "25", "26", "27"]; const westPatterns = ["3", "4", "5"];
      let isFreeArea = false;
      for (const n of northPatterns) { for (const w of westPatterns) { if (normalizedAddress.includes(`北${n}条西${w}`)) { isFreeArea = true; break; } } if (isFreeArea) break; }
      
      let matchedFee = null;
      if (isFreeArea) { matchedFee = 0; } 
      else if (appSettings?.deliveryAreas?.length > 0) {
        for (const area of appSettings.deliveryAreas) {
          const keywords = (area.name||'').split(',').map(k => k.trim()).filter(k => k);
          if (keywords.some(keyword => rawAddress.includes(keyword) || normalizedAddress.includes(keyword))) { matchedFee = Number(area.fee); break; }
        }
      } 
      
      if (matchedFee === null) {
        if (normalizedAddress.includes("厚別区") || normalizedAddress.includes("清田区") || normalizedAddress.includes("南区")) matchedFee = 1000;
        else if (normalizedAddress.includes("白石区") || normalizedAddress.includes("豊平区") || normalizedAddress.includes("手稲区") || normalizedAddress.includes("石狩市")) matchedFee = 800;
        else if (normalizedAddress.includes("北区") || normalizedAddress.includes("中央区") || normalizedAddress.includes("東区") || normalizedAddress.includes("西区")) matchedFee = 500;
      }

      if (matchedFee !== null) { 
        baseFee = matchedFee;
        if (selectedItemSettings?.hasReturn) {
          const returnType = appSettings?.boxFeeConfig?.returnFeeType || 'flat';
          const returnVal = Number(appSettings?.boxFeeConfig?.returnFeeValue) || 0;
          if (returnType === 'flat') pickupFeeAmt = returnVal;
          else if (returnType === 'percent') pickupFeeAmt = Math.floor(baseFee * (returnVal / 100));
        }
        setCalculatedFee(baseFee); setPickupFee(pickupFeeAmt); setAreaError(''); 
      } else { 
        setCalculatedFee(null); setPickupFee(0); setAreaError('自社配達エリア外です。配送をご利用ください。'); 
      }
    } else if (receiveMethod === 'sagawa') {
      const prefMatch = rawAddress.match(/^(北海道|東京都|(?:京都|大阪)府|.{2,3}県)/);
      if (!prefMatch) { setCalculatedFee(null); setAreaError('都道府県が判別できません。'); setShippingDate(''); return; }
      const targetPref = prefMatch[1].replace(/(都|府|県)$/, ''); 
      const searchPref = targetPref === '北海' ? '北海道' : targetPref;
      
      let rateData = appSettings?.shippingRates?.find(r => r.prefs && r.prefs.includes(searchPref));
      if (!rateData) rateData = appSettings?.shippingRates?.find(r => r.region && r.region.includes(searchPref));

      if (rateData) { 
        if (selectedDate) {
          const dDate = new Date(selectedDate);
          dDate.setDate(dDate.getDate() - transitDays);
          setShippingDate(dDate.toISOString().split('T')[0]);
        } else {
          setShippingDate('');
        }

        let size = selectedItemSettings?.defaultBoxSize || appSettings?.shippingSizes?.[0] || '80';
        baseFee = Number(rateData['fee' + size]) || 0;

        if (appSettings?.boxFeeConfig?.type === 'flat') {
          boxFee = Number(appSettings.boxFeeConfig.flatFee) || 0;
        } else if (appSettings?.boxFeeConfig?.type === 'price_based') {
          const tiers = appSettings.boxFeeConfig.priceTiers || [];
          const matchedTier = [...tiers].sort((a, b) => b.minPrice - a.minPrice).find(t => Number(itemPrice) >= t.minPrice);
          boxFee = matchedTier ? Number(matchedTier.fee) : 0;
        }

        if (appSettings?.boxFeeConfig?.freeShippingThresholdEnabled && Number(itemPrice) >= (appSettings.boxFeeConfig.freeShippingThreshold || 15000)) {
          baseFee = 0; 
        }

        if (!selectedItemSettings?.excludeCoolBin && appSettings?.boxFeeConfig?.coolBinEnabled && selectedDate) {
          const dateObj = new Date(selectedDate);
          const mmdd = String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
          const isCool = (appSettings.boxFeeConfig.coolBinPeriods || []).some(p => mmdd >= p.start && mmdd <= p.end);
          if (isCool) coolFee = Number(rateData['cool' + size]) || 0;
        }

        setCalculatedFee(baseFee + boxFee + coolFee); setPickupFee(0); setAreaError(''); 
      } else {
        setCalculatedFee(null); setShippingDate(''); setAreaError('該当する地域の送料設定が見つかりません。');
      }
    }
  }, [customerInfo, recipientInfo, isRecipientDifferent, receiveMethod, flowerType, itemPrice, selectedDate, appSettings, selectedItemSettings, transitDays]);

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
    } catch (error) {}
  };

  const getTimeOptions = () => {
    if (!selectedDate) return [];
    if (receiveMethod === 'pickup') return timeSlots.pickup;
    if (receiveMethod === 'delivery') return timeSlots.delivery;
    if (receiveMethod === 'sagawa') return timeSlots.shipping;
    return [];
  };

  const parsedItemPrice = Number(itemPrice) || 0;
  const parsedFee = calculatedFee || 0;
  const parsedPickupFee = pickupFee || 0;
  const subTotal = parsedItemPrice + parsedFee + parsedPickupFee;
  const tax = Math.floor(subTotal * 0.1);
  const totalAmount = subTotal + tax;

  const isFormInvalid = () => {
    if (step === 3) {
      if (!flowerPurpose || !flowerColor || !flowerVibe || !itemPrice) return true;
      if (cardType === 'メッセージカード' && !cardMessage) return true;
      if (cardType === '立札' && !tatePattern) return true;
    }
    if (step === 4) {
      if (!customerInfo.name || !customerInfo.phone || !customerInfo.email || !selectedDate || !selectedTime || !methodAgreed) return true;
      if (selectedDate && selectedDate < minDateLimit) return true;
      if ((receiveMethod === 'delivery' || receiveMethod === 'sagawa') && areaError) return true;
      if (receiveMethod === 'delivery' && absenceAction === '置き配' && !absenceNote) return true;
      if (isRecipientDifferent && (!recipientInfo.name || !recipientInfo.phone || !recipientInfo.zip || !recipientInfo.address1 || !recipientInfo.address2)) return true;
    }
    return false;
  };

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    try {
      const orderPayload = {
        shopId: 'default', flowerType, isBring, receiveMethod, selectedShop,
        selectedDate, selectedTime, shippingDate,
        itemPrice, calculatedFee, pickupFee,
        absenceAction, absenceNote,
        flowerPurpose, flowerColor, flowerVibe, otherPurpose, otherVibe,
        cardType, cardMessage, tatePattern,
        tateInput1, tateInput2, tateInput3, tateInput3a, tateInput3b,
        customerInfo, isRecipientDifferent, recipientInfo,
        paymentMethod, // 法人用の支払方法
        referenceImage: selectedImage ? selectedImage.url : null,
        status: 'new',
        isCorporateOrder: true // 法人からの注文フラグ
      };

      const { error } = await supabase.from('orders').insert([{ order_data: orderPayload }]);
      if (error) throw error;

      // 送信完了後、法人ポータルへ戻る（完了メッセージなどを出すと親切）
      alert('ご注文を承りました！ポータル画面へ戻ります。');
      router.push('/corporate');
      
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
          <div className="flex items-center gap-2 text-[#2D4B3E]">
            <Building2 size={18}/>
            <span className="font-bold tracking-tight text-[14px]">法人専用オーダー</span>
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
              <p className="text-[12px] text-[#555555]">ご希望のアイテムをお選びください。</p>
            </div>
            <div className="space-y-6">
              <select className="w-full h-16 px-5 bg-white border border-[#EAEAEA] rounded-[20px] outline-none focus:border-[#2D4B3E] transition-all text-[15px] font-bold appearance-none shadow-sm" value={flowerType} onChange={(e) => { setFlowerType(e.target.value); setItemPrice(''); setIsBring('shop'); }}>
                <option value="">種類を選択してください</option>
                {appSettings?.flowerItems?.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>

              {flowerType ? (
                <div className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] space-y-4 animate-in fade-in">
                  <p className="text-[11px] font-bold text-[#111111] tracking-widest border-b border-[#EAEAEA] pb-2">納期に関する注意事項</p>
                  <div className="space-y-2 text-[12px] text-[#555555] font-medium">
                    {selectedItemSettings.normalLeadDays && <div className="flex justify-between"><span>通常納期 (配達)</span><span className="font-bold">{selectedItemSettings.normalLeadDays}日後以降</span></div>}
                    {selectedItemSettings.shippingLeadDays && <div className="flex justify-between text-[#2D4B3E]"><span>業者配送 納期</span><span className="font-bold">発送準備 {selectedItemSettings.shippingLeadDays}日 ＋ 配送リードタイム</span></div>}
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
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">お届け方法を選ぶ</h1>
              <p className="text-[12px] text-[#555555]">お花のお届け方法をお選びください。</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {selectedItemSettings.canDelivery !== false && (<button onClick={() => { setReceiveMethod('delivery'); setStep(3); }} className="p-6 rounded-[24px] bg-[#FBFAF9] border border-[#EAEAEA] font-bold text-[14px] hover:bg-white hover:border-[#2D4B3E] transition-all text-[#555555] hover:text-[#2D4B3E]">自社配達<br/><span className="text-[10px] font-normal text-[#999]">(近隣エリア向け)</span></button>)}
              {selectedItemSettings.canShipping !== false && (<button onClick={() => { setReceiveMethod('sagawa'); setStep(3); }} className="p-6 rounded-[24px] bg-[#FBFAF9] border border-[#EAEAEA] font-bold text-[14px] hover:bg-white hover:border-[#2D4B3E] transition-all text-[#555555] hover:text-[#2D4B3E]">業者配送<br/><span className="text-[10px] font-normal text-[#999]">(全国対応)</span></button>)}
            </div>
          </div>
        )}

        {/* --- STEP 3: デザイン詳細と画像提案 --- */}
        {step === 3 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">デザイン・詳細設定</h1>
              <p className="text-[12px] text-[#555555]">お花のイメージと、立札の内容を入力してください。</p>
            </div>

            <div className="space-y-8 bg-white p-8 rounded-[28px] border border-[#EAEAEA] shadow-sm transition-all duration-500">
              
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">ご用途</label>
                <select value={flowerPurpose} onChange={(e) => setFlowerPurpose(e.target.value)} className="w-full h-12 border-b border-[#EAEAEA] bg-transparent outline-none font-bold focus:border-[#2D4B3E] transition-all">
                  <option value="">選択...</option><option value="就任・昇進祝い">就任・昇進祝い</option><option value="開店・開業祝い">開店・開業祝い</option><option value="移転祝い">移転祝い</option><option value="お供え">お供え</option><option value="その他">その他</option>
                </select>
                {flowerPurpose === 'その他' && <input type="text" placeholder="詳細を入力..." value={otherPurpose} onChange={(e) => setOtherPurpose(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-sm border border-[#EAEAEA]" />}
              </div>
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">イメージ / ご要望</label>
                <select value={flowerVibe} onChange={(e) => setFlowerVibe(e.target.value)} className="w-full h-12 border-b border-[#EAEAEA] bg-transparent outline-none font-bold focus:border-[#2D4B3E] transition-all">
                  <option value="">選択...</option><option value="おまかせ (用途に合わせる)">おまかせ (用途に合わせる)</option><option value="華やか・豪華">華やか・豪華</option><option value="上品・落ち着いた雰囲気">上品・落ち着いた雰囲気</option><option value="その他">その他</option>
                </select>
                {flowerVibe === 'その他' && <input type="text" placeholder="イメージの詳細をご入力ください" value={otherVibe} onChange={(e) => setOtherVibe(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-sm border border-[#EAEAEA]" />}
              </div>
              <div className="space-y-3 pt-4">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">ご予算 (税抜)</label>
                <select value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-full h-14 border rounded-xl px-4 bg-[#FBFAF9] outline-none font-bold text-[16px] transition-all border-[#EAEAEA] focus:border-[#2D4B3E]">
                  <option value="">選択...</option>
                  {getPriceOptions().map(price => (<option key={price} value={price}>¥{price.toLocaleString()}</option>))}
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

              {cardType === '立札' && (
                <div className="space-y-6 bg-white p-6 rounded-[28px] border border-[#EAEAEA] shadow-sm animate-in zoom-in-95 duration-300">
                  <select value={tatePattern} onChange={(e) => setTatePattern(e.target.value)} className="w-full h-14 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none font-bold text-[13px] focus:border-[#2D4B3E]">
                    <option value="">レイアウトを選択</option>
                    {tateOptions.map(opt => (<option key={opt.id} value={opt.id}>{opt.label}</option>))}
                  </select>
                  
                  {tatePattern && (
                    <div className="space-y-3">
                      {tateNeeds.includes('1') && <input type="text" placeholder="① 内容 (例: 御開店)" value={tateInput1} onChange={(e) => setTateInput1(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('2') && <input type="text" placeholder="② 宛名 (例: 〇〇様)" value={tateInput2} onChange={(e) => setTateInput2(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      
                      <div className="pt-2 pb-1 border-t border-[#FBFAF9]">
                        <span className="text-[10px] font-bold text-[#2D4B3E] bg-[#2D4B3E]/10 px-2 py-1 rounded">※贈り主情報は自社データから自動入力されています</span>
                      </div>

                      {tateNeeds.includes('3') && <input type="text" placeholder="③ 贈り主 (例: 株式会社〇〇)" value={tateInput3} onChange={(e) => setTateInput3(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('3a') && <input type="text" placeholder="③-1 会社名" value={tateInput3a} onChange={(e) => setTateInput3a(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('3b') && <input type="text" placeholder="③-2 役職・氏名" value={tateInput3b} onChange={(e) => setTateInput3b(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      
                      <p className="text-[10px] font-bold text-[#999999] tracking-widest text-center pt-4">仕上がりプレビュー</p>
                      <div className={`relative mx-auto border border-[#EAEAEA] shadow-lg bg-white flex flex-col items-center font-serif ${selectedTateOpt?.layout === 'horizontal' ? 'aspect-[1.414/1] w-full justify-center p-6' : 'aspect-[1/1.414] h-[300px] pt-6 px-4'}`}>
                         <div className={`font-black ${isOsonae ? 'text-gray-500' : 'text-red-600'} ${selectedTateOpt?.layout === 'horizontal' ? 'text-[28px] mb-4' : 'text-[40px] mb-6 leading-none'}`}>
                           {topPrefixText}
                         </div>
                         <div className={`flex w-full font-bold text-gray-900 ${selectedTateOpt?.layout === 'horizontal' ? 'flex-col items-center gap-2 text-[16px]' : 'flex-row-reverse justify-center gap-6 text-[18px]'}`}>
                           {tatePattern.includes('p6') || tatePattern.includes('p8') ? (
                             <><div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput2 || '宛名'}様</div>{!isOsonae && <div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput1 || '内容'}</div>}<div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3 || '贈り主'}</div></>
                           ) : tatePattern.includes('p4') ? (
                             <><div className={`tracking-[0.3em] ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3a || '会社名'}</div><div className={`tracking-[0.3em] font-normal ${selectedTateOpt?.layout === 'horizontal' ? 'mt-4 text-[14px]' : 'mt-6 text-[14px] [writing-mode:vertical-rl]'}`}>{tateInput3b || '役職・氏名'}</div></>
                           ) : (
                             <>{!isOsonae && <div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput1 || '内容'}</div>}<div className={`tracking-widest ${selectedTateOpt?.layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{tateInput3 || '贈り主'}</div></>
                           )}
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
              <p className="text-[12px] text-[#555555]">お届け希望日と、お届け先の情報をご入力ください。</p>
            </div>

            <div className="space-y-6">
              
              {/* ご注文者情報はリードオンリー表示 */}
              <div className="space-y-4 bg-gray-50 p-6 rounded-[24px] border border-gray-200 shadow-sm opacity-80">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-bold text-gray-500 tracking-widest flex items-center gap-1.5"><Building2 size={14}/> ご注文者情報 (自動入力)</label>
                </div>
                <div className="text-[13px] font-bold text-gray-700 space-y-2">
                  <p>{customerInfo.name}</p>
                  <p>{customerInfo.phone} / {customerInfo.email}</p>
                  <p>〒{customerInfo.zip} {customerInfo.address1}{customerInfo.address2}</p>
                </div>
              </div>

              {isRecipientDifferent && (
                <div className="space-y-4 bg-white p-8 rounded-[28px] border border-[#2D4B3E]/20 shadow-sm">
                  <label className="text-[11px] font-bold text-[#2D4B3E] tracking-widest">お届け先情報をご入力ください</label>
                  <input type="text" placeholder="お届け先 会社名・お名前" value={recipientInfo.name} onChange={(e) => setRecipientInfo({...recipientInfo, name: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px] font-bold" />
                  <input type="tel" placeholder="お届け先 電話番号" value={recipientInfo.phone} onChange={(e) => setRecipientInfo({...recipientInfo, phone: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="text" placeholder="郵便番号 (7桁)" value={recipientInfo.zip} onChange={(e) => { setRecipientInfo({...recipientInfo, zip: e.target.value}); if(e.target.value.length === 7) fetchAddress(e.target.value, 'recipient'); }} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="text" placeholder="都道府県・市区町村 (自動入力)" value={recipientInfo.address1} className="w-full h-14 px-5 bg-[#EAEAEA]/30 rounded-xl outline-none text-[#999999] text-[14px]" readOnly />
                  <input type="text" placeholder="番地・建物名" value={recipientInfo.address2} onChange={(e) => setRecipientInfo({...recipientInfo, address2: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#999999] tracking-widest">お届け希望日</label>
                  <input type="date" min={minDateLimit} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full h-14 px-4 bg-white border border-[#EAEAEA] rounded-[16px] outline-none font-bold text-[#555555] focus:border-[#2D4B3E] shadow-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#999999] tracking-widest">希望時間</label>
                  <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full h-14 px-4 bg-white border border-[#EAEAEA] rounded-[16px] outline-none font-bold text-[#555555] focus:border-[#2D4B3E] shadow-sm">
                    <option value="">選択...</option>
                    {getTimeOptions().map(t => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
              </div>

              {/* 支払い方法の選択（請求書払いをデフォルト・強調） */}
              <div className="bg-white p-6 rounded-[24px] border-2 border-[#2D4B3E]/20 shadow-sm mt-6">
                 <label className="text-[11px] font-bold text-[#2D4B3E] tracking-widest block mb-4">お支払い方法</label>
                 <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full h-14 px-5 bg-[#2D4B3E]/5 border border-[#2D4B3E]/20 rounded-xl outline-none font-bold text-[#2D4B3E] focus:border-[#2D4B3E] transition-all text-[14px]">
                   <option value="請求書払い (月末締め 翌月末払い)">請求書払い (月末締め 翌月末払い)</option>
                   <option value="クレジットカード決済 (オンライン)">クレジットカード決済 (オンライン)</option>
                   <option value="銀行振込 (前払い)">銀行振込 (前払い)</option>
                 </select>
              </div>

              <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm mt-8">
                <div className="flex flex-col items-center justify-center gap-6">
                  <div className="w-full">
                    <p className="text-[11px] font-bold text-[#999999] tracking-widest text-center mb-2">お見積り金額</p>
                    <div className="bg-[#FBFAF9] p-5 rounded-2xl space-y-3 text-[13px] text-[#555555] font-medium w-full">
                      <div className="flex justify-between">
                        <span>商品代 (税抜):</span>
                        <span className="font-bold text-[#111111]">¥{parsedItemPrice.toLocaleString()}</span>
                      </div>
                      {parsedFee > 0 && (
                        <div className="flex justify-between text-blue-700">
                          <span>配送料 (箱代・クール等含):</span>
                          <span className="font-bold">¥{parsedFee.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-[#EAEAEA] pt-3 mt-1">
                        <span className="text-[#2D4B3E]">消費税 (10%):</span>
                        <span className="font-bold text-[#2D4B3E]">¥{tax.toLocaleString()}</span>
                      </div>
                    </div>
                    {areaError && <p className="text-red-500 text-[11px] font-bold mt-2 text-center">{areaError}</p>}
                  </div>
                  <div className="text-center w-full border-t border-[#EAEAEA] pt-6">
                    <p className="text-[12px] font-bold text-[#2D4B3E] tracking-widest mb-1">合計金額 (税込)</p>
                    <div className="text-[44px] font-black text-[#2D4B3E] font-sans leading-none">
                      ¥{totalAmount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[#FBFAF9] rounded-[24px] border border-[#EAEAEA] font-sans space-y-4 mt-6">
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="methodAgreed" checked={methodAgreed} onChange={(e) => setMethodAgreed(e.target.checked)} className="w-5 h-5 accent-[#2D4B3E] cursor-pointer rounded-md" />
                  <label htmlFor="methodAgreed" className="text-[13px] font-bold underline cursor-pointer text-[#111111]">注文内容と注意事項に同意する</label>
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

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
        .font-serif { font-family: 'Noto Serif JP', serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}