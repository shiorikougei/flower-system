'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Store, AlertCircle, Calendar, ChevronRight, Package } from 'lucide-react';
import TatefudaPreview from '@/components/TatefudaPreview';

const SETTINGS_CACHE_KEY = 'florix_app_settings_cache';
const GALLERY_CACHE_KEY = 'florix_gallery_cache';

export default function StaffNewOrderPage() {
  const router = useRouter();
  const [appSettings, setAppSettings] = useState(null);
  const [portfolioImages, setPortfolioImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ★ ログイン中のテナントIDを保持する
  const [currentTenantId, setCurrentTenantId] = useState(null);

  const [receptionType, setReceptionType] = useState('phone'); 
  const [staffName, setStaffName] = useState(''); 
  const [paymentMethod, setPaymentMethod] = useState('');
  const [sendAutoReply, setSendAutoReply] = useState(false);
  const [isCustomPrice, setIsCustomPrice] = useState(false);

  const [shopId, setShopId] = useState(''); 
  const [flowerType, setFlowerType] = useState('');
  const [isBring, setIsBring] = useState('shop');
  const [receiveMethod, setReceiveMethod] = useState('');
  const [selectedShop, setSelectedShop] = useState(null); 
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
  const [tatePattern, setTatePattern] = useState('');
  const [tateInput1, setTateInput1] = useState(''); 
  const [tateInput2, setTateInput2] = useState(''); 
  const [tateInput3, setTateInput3] = useState(''); 
  const [tateInput3a, setTateInput3a] = useState(''); 
  const [tateInput3b, setTateInput3b] = useState(''); 

  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '', zip: '', address1: '', address2: '' });
  const [isRecipientDifferent, setIsRecipientDifferent] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState({ name: '', phone: '', zip: '', address1: '', address2: '' });
  const [calculatedFee, setCalculatedFee] = useState(null);
  const [pickupFee, setPickupFee] = useState(0); 
  const [areaError, setAreaError] = useState('');
  const [note, setNote] = useState('');

  const defaultTimeSlots = {
    pickup: ['10:00-12:00', '12:00-15:00', '15:00-18:00'],
    delivery: ['9:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
    shipping: ['午前中', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
  };
  const [timeSlots, setTimeSlots] = useState(defaultTimeSlots);

  // ★ 新規：設定画面と連動するデザイン選択肢の初期値
  const defaultDesignOptions = {
    purposes: ['誕生日', '開店', 'お供え', '就任・昇進祝い', '移転祝い'],
    colors: ['おまかせ', '暖色系 (赤・ピンク・オレンジ)', '寒色系 (青・紫・白)', 'ホワイト・グリーン系'],
    vibes: ['おまかせ (用途に合わせる)', 'かわいい', '豪華', '大人っぽい', '元気', '華やか・豪華', '上品・落ち着いた雰囲気']
  };
  const designOptions = appSettings?.designOptions || defaultDesignOptions;

  // ★ 認証＆データ取得ロジック（RLS対応）
  useEffect(() => {
    let isFirstLoad = true;

    const applyDataToState = (settingsData, galleryData) => {
      if (settingsData) {
        setAppSettings(settingsData);
        if (settingsData.timeSlots) setTimeSlots(settingsData.timeSlots);
        
        if (isFirstLoad) {
          if (settingsData.staffOrderConfig?.sendAutoReply) setSendAutoReply(true);
          if (settingsData.staffOrderConfig?.paymentMethods?.length > 0) {
            setPaymentMethod(settingsData.staffOrderConfig.paymentMethods[0]);
          }
          if (settingsData.shops?.length > 0) {
            const defaultShop = settingsData.shops[0];
            setShopId(defaultShop.id);
            setSelectedShop(defaultShop.name);
          }
        }
      }
      if (galleryData?.images) {
        setPortfolioImages(galleryData.images);
      }
    };

    async function fetchSettings() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = '/staff/login';
          return;
        }

        const { data: profile, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (profileError) throw profileError;
        
        const tId = profile.tenant_id;
        setCurrentTenantId(tId);

        const [settingsRes, galleryRes] = await Promise.all([
          supabase.from('app_settings').select('settings_data').eq('id', tId).single(),
          supabase.from('app_settings').select('settings_data').eq('id', `${tId}_gallery`).single()
        ]);

        if (settingsRes.data?.settings_data) {
          applyDataToState(settingsRes.data.settings_data, galleryRes.data?.settings_data);
        }
      } catch (err) {
        console.error('設定の読み込みに失敗:', err.message);
      } finally {
        setIsLoading(false);
        isFirstLoad = false;
      }
    }
    fetchSettings();
  }, []);

  const staffConfig = appSettings?.staffOrderConfig || {};
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
      if (img.price > 0) { setItemPrice(String(img.price)); setIsCustomPrice(false); }
      if (img.purpose) setFlowerPurpose(img.purpose);
      if (img.color) setFlowerColor(img.color);
      if (img.vibe) setFlowerVibe(img.vibe);
    }
  };

  // ★ 修正箇所：キーワードで「お悔やみ・お供え」かどうかを賢く判定する！
  const isOsonae = flowerPurpose.includes('供') || flowerPurpose.includes('悔') || flowerPurpose.includes('葬') || flowerPurpose.includes('忌');
  
  const allTateOptions = isOsonae ? [
    { id: 'p1', label: '① 御供｜横型 (背景あり)', needs: ['3'], layout: 'horizontal' },
    { id: 'p3', label: '② 御供｜縦型 (シンプル)', needs: ['3'], layout: 'vertical' },
    { id: 'p4', label: '③ 御供｜縦型 (会社名入)', needs: ['3a', '3b'], layout: 'vertical' }
  ] : [
    { id: 'p5', label: '⑤ 祝｜横型 (スタンダード)', needs: ['1', '3'], layout: 'horizontal' },
    { id: 'p6', label: '⑥ 祝｜横型 (様へ構成)', needs: ['1', '2', '3'], layout: 'horizontal' },
    { id: 'p7', label: '⑦ 祝｜縦型 (二列構成)', needs: ['1', '3'], layout: 'vertical' },
    { id: 'p8', label: '⑧ 祝｜縦型 (三列完成版)', needs: ['1', '2', '3'], layout: 'vertical' }
  ];

  const currentShopSettings = appSettings?.shops?.find(s => shopId === 'default' ? true : String(s.id) === String(shopId)) || appSettings?.shops?.[0] || {};
  const enabledTatePatterns = currentShopSettings.enabledTatePatterns || [];
  
  const availableTateOptions = allTateOptions.filter(opt => enabledTatePatterns.includes(opt.id));
  const selectedTateOpt = availableTateOptions.find(opt => opt.id === tatePattern);
  const tateNeeds = selectedTateOpt?.needs || [];

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

  const properMinDate = useMemo(() => {
    if (!flowerType) return '';
    const base = new Date();
    let prepDays = 0;
    if (receiveMethod === 'sagawa') {
      prepDays = Number(selectedItemSettings?.shippingLeadDays) || 0;
    } else {
      prepDays = Number(selectedItemSettings?.normalLeadDays) || 0;
    }

    if (isBring === 'bring') {
      const fLead = Number(selectedItemSettings.canBringFlowersLeadDays) || 0;
      const vLead = Number(selectedItemSettings.canBringVaseLeadDays) || 0;
      if (selectedItemSettings.canBringFlowers && fLead > prepDays) prepDays = fLead;
      if (selectedItemSettings.canBringVase && vLead > prepDays) prepDays = vLead;
    }
    const d = new Date(base);
    d.setDate(d.getDate() + prepDays + transitDays);
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [flowerType, isBring, receiveMethod, selectedItemSettings, transitDays]);

  const minDateLimit = useMemo(() => {
    if (staffConfig.ignoreLeadTime) return new Date().toISOString().split('T')[0]; 
    return properMinDate;
  }, [staffConfig.ignoreLeadTime, properMinDate]);

  const getPriceOptions = () => {
    if (!flowerType) return [];
    let min = 2000, max = 50000, stepSize = 1000;
    if (selectedItemSettings.minPrice) {
      min = Number(selectedItemSettings.minPrice); 
      max = Number(selectedItemSettings.maxPrice); 
      stepSize = Number(selectedItemSettings.stepPrice);
    }
    const options = [];
    for (let i = min; i <= max; i += stepSize) options.push(i);
    return options;
  };

  const getTimeOptions = () => {
    if (!selectedDate) return [];
    if (receiveMethod === 'pickup') return timeSlots.pickup;
    if (receiveMethod === 'delivery') return timeSlots.delivery;
    if (receiveMethod === 'sagawa') return timeSlots.shipping;
    return [];
  };

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
          const keywords = (area.name || '').split(',').map(k => k.trim()).filter(k => k);
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
        setCalculatedFee(null); setPickupFee(0);
        setAreaError('自社配達エリア外です。手動で送料を加算するか、配送をご利用ください。'); 
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

        let size = selectedItemSettings?.defaultBoxSize;
        if (!size) {
          size = appSettings?.shippingSizes?.[0] || '80';
          if (appSettings?.boxFeeConfig?.type === 'flat') {
            boxFee = Number(appSettings.boxFeeConfig.flatFee) || 0;
          } else if (appSettings?.boxFeeConfig?.type === 'price_based') {
            const tiers = appSettings.boxFeeConfig.priceTiers || [];
            const sortedTiers = [...tiers].sort((a, b) => b.minPrice - a.minPrice);
            const matchedTier = sortedTiers.find(t => Number(itemPrice) >= t.minPrice);
            boxFee = matchedTier ? Number(matchedTier.fee) : 0;
          }
        }

        baseFee = Number(rateData['fee' + size]) || 0;

        if (appSettings?.boxFeeConfig?.freeShippingThresholdEnabled && Number(itemPrice) >= (appSettings.boxFeeConfig.freeShippingThreshold || 15000)) {
          baseFee = 0; 
        }

        if (!selectedItemSettings?.excludeCoolBin && appSettings?.boxFeeConfig?.coolBinEnabled && selectedDate) {
          const dateObj = new Date(selectedDate);
          const mmdd = String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
          const periods = appSettings.boxFeeConfig.coolBinPeriods || [];
          const isCool = periods.some(p => mmdd >= p.start && mmdd <= p.end);
          if (isCool) coolFee = Number(rateData['cool' + size]) || 0;
        }

        setCalculatedFee(baseFee + boxFee + coolFee); setPickupFee(0); setAreaError(''); 
      } else {
        setCalculatedFee(null); setShippingDate(''); setAreaError('該当する地域の送料設定が見つかりません。');
      }
    }
  }, [customerInfo.address1, customerInfo.address2, recipientInfo.address1, recipientInfo.address2, isRecipientDifferent, receiveMethod, flowerType, itemPrice, selectedDate, appSettings, selectedItemSettings, transitDays]);

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

  const parsedItemPrice = Number(itemPrice) || 0;
  const parsedFee = calculatedFee || 0;
  const parsedPickupFee = pickupFee || 0;
  const subTotal = parsedItemPrice + parsedFee + parsedPickupFee;
  const tax = Math.floor(subTotal * 0.1);
  const totalAmount = subTotal + tax;

  const handleSubmitStaffOrder = async () => {
    let warnings = [];

    if (!receptionType) warnings.push('・受付区分');
    if (!staffName) warnings.push('・受付スタッフ');
    if (!shopId) warnings.push('・受付した店舗');
    if (!flowerType) warnings.push('・お花の種類');
    if (!receiveMethod) warnings.push('・受取方法');
    if (receiveMethod === 'pickup' && !selectedShop) warnings.push('・受取店舗');
    if (!itemPrice) warnings.push('・ご予算(金額)');
    if (!selectedDate) warnings.push('・納品希望日');
    if (!customerInfo.name) warnings.push('・注文者のお名前');

    if (warnings.length > 0) {
      const isConfirmed = window.confirm("⚠️ 以下の未入力・確認事項があります：\n\n" + warnings.join("\n") + "\n\nこのまま注文を強制的に登録してもよろしいですか？");
      if (!isConfirmed) return;
    }
    
    setIsSubmitting(true);
    try {
      const orderPayload = {
        receptionType, staffName, shopId, flowerType, isBring, receiveMethod, selectedShop,
        selectedDate, receiveDate: selectedDate, shippingDate,
        selectedTime, itemPrice, calculatedFee, pickupFee, 
        absenceAction, absenceNote, 
        flowerPurpose, flowerColor, flowerVibe, otherPurpose, otherVibe,
        cardType, cardMessage, tatePattern,
        tateInput1, tateInput2, tateInput3, tateInput3a, tateInput3b,
        customerInfo, isRecipientDifferent, recipientInfo, note,
        paymentMethod, sendAutoReply,
        referenceImage: selectedImage ? selectedImage.url : null,
        status: 'new',
        isStaffEntered: true 
      };

      const { error } = await supabase.from('orders').insert([
        { tenant_id: currentTenantId, order_data: orderPayload }
      ]);
      
      if (error) throw error;

      alert('店舗注文を受付し、データを保存しました。');
      router.push('/staff/orders'); 
      
    } catch (error) {
      console.error('注文エラー:', error.message);
      alert('保存に失敗しました。通信環境を確認してください。');
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-sans text-[#2D4B3E] font-bold tracking-widest animate-pulse">読み込み中...</div>;

  return (
    <div className="flex flex-col font-sans text-[#111111] pb-32">
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-3">
            店舗注文受付 (代理入力)
            <div className="flex gap-2">
              {staffConfig.ignoreLeadTime && <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1 rounded-md font-bold">納期制限 解除中</span>}
              {staffConfig.allowCustomPrice && <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1 rounded-md font-bold">金額自由入力 解除中</span>}
            </div>
          </h1>
        </header>

        <div className="max-w-[700px] mx-auto w-full p-8 space-y-8">
          
          <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm space-y-6">
            <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-3 tracking-widest">1. 受付情報と商品</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">受付区分</label>
                <div className="flex gap-2">
                  <button onClick={() => setReceptionType('phone')} className={`flex-1 py-3 text-[13px] font-bold rounded-xl border transition-all ${receptionType === 'phone' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>電話受付</button>
                  <button onClick={() => setReceptionType('store')} className={`flex-1 py-3 text-[13px] font-bold rounded-xl border transition-all ${receptionType === 'store' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>店頭受付</button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">受付スタッフ</label>
                <select value={staffName} onChange={(e) => setStaffName(e.target.value)} className="w-full h-[50px] bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                  <option value="">担当者を選択</option>
                  {appSettings?.staffList?.map(staff => (
                    <option key={staff.id || staff} value={staff.name || staff}>{staff.name || staff}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-[11px] font-bold text-[#999999] tracking-widest">受付した店舗</label>
              <select value={shopId} onChange={(e) => {
                setShopId(e.target.value);
                const s = appSettings?.shops?.find(shop => String(shop.id) === String(e.target.value));
                if (s) setSelectedShop(s.name);
              }} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                <option value="">店舗を選択</option>
                {appSettings?.shops?.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#FBFAF9]">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">お花の種類</label>
                <select value={flowerType} onChange={(e) => { setFlowerType(e.target.value); setItemPrice(''); }} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                  <option value="">選択してください</option>
                  {appSettings?.flowerItems?.filter(item => {
                    if (!shopId) return true;
                    if (!item.targetShops || item.targetShops === 'all') return true;
                    return item.targetShops.includes(Number(shopId));
                  }).map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">受取方法</label>
                <div className="flex gap-2">
                  <button onClick={() => setReceiveMethod('pickup')} className={`flex-1 py-3 text-[12px] font-bold rounded-xl border ${receiveMethod === 'pickup' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>店頭受取</button>
                  <button onClick={() => setReceiveMethod('delivery')} className={`flex-1 py-3 text-[12px] font-bold rounded-xl border ${receiveMethod === 'delivery' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>自社配達</button>
                  <button onClick={() => setReceiveMethod('sagawa')} className={`flex-1 py-3 text-[12px] font-bold rounded-xl border ${receiveMethod === 'sagawa' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>業者配送</button>
                </div>
              </div>
              
              {receiveMethod === 'pickup' && (
                <div className="md:col-span-2 bg-orange-50 p-4 rounded-xl border border-orange-200 animate-in fade-in space-y-2 mt-2">
                  <label className="text-[12px] font-bold text-orange-800 flex items-center gap-1.5"><Store size={16}/> ご来店・受取予定の店舗</label>
                  <select value={selectedShop || ''} onChange={(e) => setSelectedShop(e.target.value)} className="w-full h-12 bg-white border border-orange-200 rounded-xl px-4 text-[13px] font-bold text-[#2D4B3E] focus:border-orange-400 outline-none shadow-sm">
                    <option value="">受取店舗を選択してください</option>
                    {appSettings?.shops?.map(shop => <option key={shop.id} value={shop.name}>{shop.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4 pt-2">
               <span className="text-[11px] font-bold text-[#999999] tracking-widest">持ち込み</span>
               <div className="flex items-center gap-3">
                 <label className="flex items-center gap-2 text-[13px] font-bold cursor-pointer"><input type="radio" checked={isBring === 'shop'} onChange={() => setIsBring('shop')} className="accent-[#2D4B3E]" /> なし</label>
                 <label className="flex items-center gap-2 text-[13px] font-bold cursor-pointer"><input type="radio" checked={isBring === 'bring'} onChange={() => setIsBring('bring')} className="accent-[#2D4B3E]" /> あり</label>
               </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm space-y-6 overflow-hidden">
            
            {matchingImages.length > 0 && (
              <div className="bg-[#2D4B3E]/5 -mx-8 -mt-8 p-6 pb-8 mb-6 border-b border-[#EAEAEA] space-y-4">
                 <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest flex items-center gap-2">✨ 制作例からオーダー内容を自動入力</p>
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
                         <button onClick={() => handleSelectImage(img)} className="text-[9px] font-bold text-[#999999] hover:text-[#2D4B3E] mt-1 border border-[#EAEAEA] bg-white px-3 py-1 rounded-full shadow-sm">
                           {selectedImage?.id === img.id ? '選択解除' : 'この設定を使用'}
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
            )}

            <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-3 tracking-widest">2. 詳細と金額</h2>
            <div className="grid grid-cols-2 gap-4">
              {/* ★ 設定画面のカスタマイズ項目（デザイン選択肢）を反映！ */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">用途</label>
                <select value={flowerPurpose} onChange={(e) => setFlowerPurpose(e.target.value)} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                  <option value="">用途...</option>
                  {designOptions.purposes.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="その他">その他</option>
                </select>
                {flowerPurpose === 'その他' && <input type="text" placeholder="詳細を入力..." value={otherPurpose} onChange={(e) => setOtherPurpose(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-[13px] border border-[#EAEAEA]" />}
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">イメージ</label>
                <select value={flowerVibe} onChange={(e) => setFlowerVibe(e.target.value)} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                  <option value="">イメージ...</option>
                  {designOptions.vibes.map(v => <option key={v} value={v}>{v}</option>)}
                  <option value="その他">その他</option>
                </select>
                {flowerVibe === 'その他' && <input type="text" placeholder="詳細を入力..." value={otherVibe} onChange={(e) => setOtherVibe(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-[13px] border border-[#EAEAEA]" />}
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">メインカラー</label>
                <select value={flowerColor} onChange={(e) => setFlowerColor(e.target.value)} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                  <option value="">カラー...</option>
                  {designOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="その他">その他</option>
                </select>
              </div>
            </div>
            
            <div className="space-y-2 pt-4 border-t border-[#FBFAF9]">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">ご予算 (税抜)</label>
                {staffConfig.allowCustomPrice && (
                  <button onClick={() => setIsCustomPrice(!isCustomPrice)} className="text-[10px] text-[#2D4B3E] border border-[#2D4B3E]/30 bg-[#2D4B3E]/5 px-3 py-1 rounded-full font-bold hover:bg-[#2D4B3E] hover:text-white transition-all">
                    {isCustomPrice ? 'リストから選ぶ' : '金額を直接入力する'}
                  </button>
                )}
              </div>
              {isCustomPrice ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[18px]">¥</span>
                    <input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold text-[#2D4B3E] text-[18px] focus:border-[#2D4B3E] outline-none" placeholder="例: 3500" />
                  </div>
                </div>
              ) : (
                <select value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className={`w-full h-14 border rounded-xl px-4 font-bold text-[16px] outline-none transition-all ${selectedImage ? 'border-[#2D4B3E] text-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA] bg-[#FBFAF9] focus:border-[#2D4B3E]'}`}>
                  <option value="">選択...</option>
                  {getPriceOptions().map(price => (<option key={price} value={price}>¥{price.toLocaleString()}</option>))}
                  {selectedImage && itemPrice && !getPriceOptions().includes(Number(itemPrice)) && (
                    <option value={itemPrice}>¥{Number(itemPrice).toLocaleString()}</option>
                  )}
                </select>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm space-y-6">
            <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-3 tracking-widest">3. メッセージ・立札</h2>
            <div className="flex gap-2 p-1 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA]">
              {['なし', 'メッセージカード', '立札'].map(t => (
                <button key={t} onClick={() => setCardType(t)} className={`flex-1 py-3 text-[12px] font-bold rounded-xl transition-all ${cardType === t ? 'bg-[#2D4B3E] text-white shadow-md' : 'text-[#555555]'}`}>{t}</button>
              ))}
            </div>

            {cardType === 'メッセージカード' && (
              <textarea value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} placeholder="カードのメッセージを入力" className="w-full h-32 p-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] resize-none focus:border-[#2D4B3E] outline-none"></textarea>
            )}

            {cardType === '立札' && (
              <div className="space-y-6 bg-white p-6 rounded-[28px] border border-[#EAEAEA] shadow-sm animate-in zoom-in-95 duration-300">
                
                {/* ★ 立札の出し分け（店舗設定で許可されているもの かつ 用途に合っているものだけを表示） */}
                <select value={tatePattern} onChange={(e) => setTatePattern(e.target.value)} className="w-full h-14 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none font-bold text-[13px] focus:border-[#2D4B3E]">
                  <option value="">レイアウトを選択</option>
                  {availableTateOptions.length > 0 ? (
                    availableTateOptions.map(opt => (<option key={opt.id} value={opt.id}>{opt.label}</option>))
                  ) : (
                    <option value="" disabled>現在この店舗で利用可能なテンプレートがありません</option>
                  )}
                </select>
                
                {tatePattern && (
                  <div className="space-y-3">
                    {tateNeeds.includes('1') && <input type="text" placeholder={`① 内容 (例: ${isOsonae ? '御供' : '御開店'})`} value={tateInput1} onChange={(e) => setTateInput1(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] focus:border-[#2D4B3E] outline-none" />}
                    {tateNeeds.includes('2') && <input type="text" placeholder="② 宛名 (例: 〇〇様)" value={tateInput2} onChange={(e) => setTateInput2(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] focus:border-[#2D4B3E] outline-none" />}
                    {tateNeeds.includes('3') && <input type="text" placeholder="③ 贈り主 (例: 株式会社〇〇)" value={tateInput3} onChange={(e) => setTateInput3(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] focus:border-[#2D4B3E] outline-none" />}
                    {tateNeeds.includes('3a') && <input type="text" placeholder="③-1 会社名" value={tateInput3a} onChange={(e) => setTateInput3a(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] focus:border-[#2D4B3E] outline-none" />}
                    {tateNeeds.includes('3b') && <input type="text" placeholder="③-2 役職・氏名" value={tateInput3b} onChange={(e) => setTateInput3b(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] focus:border-[#2D4B3E] outline-none" />}
                    
                    <p className="text-[10px] font-bold text-[#999999] tracking-widest text-center pt-4">仕上がりプレビュー</p>
                    <TatefudaPreview 
                      tatePattern={tatePattern}
                      layout={selectedTateOpt?.layout}
                      isOsonae={isOsonae}
                      input1={tateInput1}
                      input2={tateInput2}
                      input3={tateInput3}
                      input3a={tateInput3a}
                      input3b={tateInput3b}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm space-y-6">
            <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-3 tracking-widest">4. スケジュール・情報</h2>
            
            <div className="space-y-3 pb-4 border-b border-[#FBFAF9]">
              <label className="text-[11px] font-bold text-[#999999] tracking-widest">注文者情報</label>
              <input type="text" placeholder="お名前（必須）" value={customerInfo.name} onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none" />
              <input type="tel" placeholder="電話番号" value={customerInfo.phone} onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
              <input type="email" placeholder="メールアドレス (任意)" value={customerInfo.email} onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
              
              {receiveMethod !== 'pickup' && (
                <>
                  <div className="flex gap-2">
                    <input type="text" placeholder="郵便番号 (7桁)" value={customerInfo.zip} onChange={(e) => { setCustomerInfo({...customerInfo, zip: e.target.value}); if(e.target.value.length === 7) fetchAddress(e.target.value, 'customer'); }} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
                  </div>
                  <input type="text" placeholder="都道府県・市区町村 (自動入力)" value={customerInfo.address1} className="w-full h-12 bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-xl px-4 text-[13px] text-[#555555] outline-none" readOnly />
                  <input type="text" placeholder="番地・建物名" value={customerInfo.address2} onChange={(e) => setCustomerInfo({...customerInfo, address2: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
                </>
              )}
            </div>

            {receiveMethod !== 'pickup' && (
              <div className="py-2">
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                  <input type="checkbox" checked={isRecipientDifferent} onChange={(e) => setIsRecipientDifferent(e.target.checked)} className="w-5 h-5 accent-[#2D4B3E] rounded" />
                  <span className="text-[13px] font-bold text-[#111111]">お届け先が注文者と異なる</span>
                </label>
              </div>
            )}

            {isRecipientDifferent && receiveMethod !== 'pickup' && (
              <div className="space-y-3 p-6 bg-white border border-[#EAEAEA] shadow-sm rounded-2xl animate-in fade-in zoom-in-95">
                <label className="text-[11px] font-bold text-[#2D4B3E] tracking-widest">お届け先情報</label>
                <input type="text" placeholder="お届け先 お名前" value={recipientInfo.name} onChange={(e) => setRecipientInfo({...recipientInfo, name: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none" />
                <input type="tel" placeholder="お届け先 電話番号" value={recipientInfo.phone} onChange={(e) => setRecipientInfo({...recipientInfo, phone: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
                <input type="text" placeholder="郵便番号 (7桁)" value={recipientInfo.zip} onChange={(e) => { setRecipientInfo({...recipientInfo, zip: e.target.value}); if(e.target.value.length === 7) fetchAddress(e.target.value, 'recipient'); }} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
                <input type="text" placeholder="都道府県・市区町村 (自動入力)" value={recipientInfo.address1} className="w-full h-12 bg-[#EAEAEA]/30 border border-[#EAEAEA] rounded-xl px-4 text-[13px] text-[#555555] outline-none" readOnly />
                <input type="text" placeholder="番地・建物名" value={recipientInfo.address2} onChange={(e) => setRecipientInfo({...recipientInfo, address2: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] focus:border-[#2D4B3E] outline-none" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">納品希望日</label>
                <input type="date" min={minDateLimit} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none" />
                {selectedDate && properMinDate && selectedDate < properMinDate && (
                  <div className="bg-orange-50 text-orange-700 px-3 py-2.5 rounded-xl text-[11px] font-bold flex items-start gap-1.5 border border-orange-200 mt-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span className="leading-relaxed">注意：規定の最短納期（{new Date(properMinDate).toLocaleDateString('ja-JP')}）より早い日付が指定されています。対応可能か確認してください。</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">希望時間</label>
                <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                  <option value="">選択...</option>
                  {getTimeOptions().map(t => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
            </div>

            {receiveMethod === 'sagawa' && selectedDate && shippingDate && (
              <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 animate-in fade-in shadow-sm">
                <div className="flex items-center gap-2 text-green-800 font-bold text-[12px]">
                   <Calendar size={16}/> お届け指定: {selectedDate}
                </div>
                <ChevronRight size={14} className="hidden sm:block text-green-600"/>
                <div className="flex items-center gap-2 text-green-900 font-black text-[14px]">
                   <Package size={18}/> 発送予定日: {shippingDate}
                </div>
              </div>
            )}

            {receiveMethod === 'delivery' && (
              <div className="pt-6 border-t border-[#FBFAF9] space-y-4 animate-in fade-in">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#2D4B3E] tracking-widest flex items-center justify-between">
                    ご不在時の対応 (置き配)
                  </label>
                  <p className="text-[11px] text-[#999999] mb-2">生花のため、ご不在時は原則として置き配または宅配ボックスへのお届けとなります。</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setAbsenceAction('持ち戻り')} className={`py-3 text-[12px] font-bold rounded-xl border transition-all ${absenceAction === '持ち戻り' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E] shadow-md' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>持ち戻り (再配達)</button>
                    <button onClick={() => setAbsenceAction('置き配')} className={`py-3 text-[12px] font-bold rounded-xl border transition-all ${absenceAction === '置き配' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E] shadow-md' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>置き配を希望する</button>
                  </div>
                </div>
                {absenceAction === '置き配' && (
                  <div className="space-y-2 animate-in fade-in">
                    <input 
                      type="text" 
                      placeholder="例：玄関のドア前、宅配ボックス、ガスメーターの中 など" 
                      value={absenceNote} 
                      onChange={(e) => setAbsenceNote(e.target.value)} 
                      className="w-full h-12 px-4 bg-white border-2 border-[#2D4B3E]/30 rounded-xl outline-none font-bold text-[13px] focus:border-[#2D4B3E] shadow-inner" 
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm space-y-6">
            <h2 className="text-[14px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-3 tracking-widest">5. 決済ステータス・社内メモ</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">支払方法・状態</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full h-12 bg-[#2D4B3E]/5 text-[#2D4B3E] border border-[#2D4B3E]/20 rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                  {staffConfig.paymentMethods?.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest">社内メモ / 要望</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：予算オーバーだけどサービスでバラ増量" className="w-full h-24 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-4 text-[13px] resize-none focus:border-[#2D4B3E] outline-none"></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border-2 border-[#2D4B3E]/30 shadow-md">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              
              <div className="space-y-2 w-full md:w-auto">
                <p className="text-[11px] font-bold text-[#999999] tracking-widest text-center md:text-left">お支払い内訳</p>
                <div className="bg-[#FBFAF9] p-4 rounded-xl space-y-2 text-[13px] text-[#555555] font-medium w-full md:w-64">
                  <div className="flex justify-between">
                    <span>商品代 (税抜):</span>
                    <span className="font-bold text-[#111111]">¥{parsedItemPrice.toLocaleString()}</span>
                  </div>
                  {parsedFee > 0 && (
                    <div className="flex justify-between text-blue-700">
                      <span>配達・送料:</span>
                      <span className="font-bold">¥{parsedFee.toLocaleString()}</span>
                    </div>
                  )}
                  {parsedPickupFee > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>後日回収費:</span>
                      <span className="font-bold">¥{parsedPickupFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#EAEAEA] pt-2 mt-2">
                    <span className="text-[#2D4B3E]">消費税 (10%):</span>
                    <span className="font-bold text-[#2D4B3E]">¥{tax.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="text-center md:text-right flex-shrink-0">
                <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest mb-1">合計金額 (税込)</p>
                <div className="text-[40px] font-bold text-[#2D4B3E] font-sans leading-none">
                  ¥{totalAmount.toLocaleString()}
                </div>
              </div>

            </div>
          </div>

          <button 
            disabled={isSubmitting} 
            onClick={handleSubmitStaffOrder} 
            className="w-full h-16 bg-[#2D4B3E] hover:bg-[#1f352b] text-white rounded-[24px] font-bold text-[16px] tracking-widest shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? '保存中...' : '注文を登録する'}
          </button>

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