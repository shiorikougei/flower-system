'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase'; 
import { Calendar, Package, ChevronRight, Store, Truck, AlertCircle, Phone, ShoppingBag, Search } from 'lucide-react';
import Link from 'next/link';

import TatefudaPreview from '@/components/TatefudaPreview';
import DatePicker from '@/components/DatePicker';

// ★ 時間スロットを店舗営業時間でフィルタするヘルパー
const TIME_RANGE_RE = /(\d{1,2}):(\d{2})\s*[-〜]\s*(\d{1,2}):(\d{2})/;

function parseTimeSlot(slot) {
  if (!slot) return null;
  if (slot.includes('午前中')) return { start: 9 * 60, end: 12 * 60 };
  const m = slot.match(TIME_RANGE_RE);
  if (!m) return null;
  return {
    start: Number(m[1]) * 60 + Number(m[2]),
    end: Number(m[3]) * 60 + Number(m[4]),
  };
}

function timeStrToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// 指定日 + 受取方法に対する「実効営業時間」を取得（specialHours の time 変更ルールを反映）
function getEffectiveHours(dateStr, shopData, method) {
  const isDelivery = method === 'delivery';
  const defaultOpen = isDelivery ? (shopData?.deliveryOpenTime || '11:00') : (shopData?.openTime || '10:00');
  const defaultClose = isDelivery ? (shopData?.deliveryCloseTime || '18:00') : (shopData?.closeTime || '19:00');
  const rules = isDelivery ? (shopData?.deliverySpecialHours || []) : (shopData?.specialHours || []);

  if (!dateStr) return { openTime: defaultOpen, closeTime: defaultClose };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { openTime: defaultOpen, closeTime: defaultClose };

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];

  // 「時間変更」ルールにマッチするものを探す
  for (const r of rules) {
    if (r.type !== 'changed') continue;
    const repeat = r.repeatType || '今年のみ';
    let matched = false;
    if (repeat === '今年のみ') matched = r.date === `${yyyy}-${mm}-${dd}`;
    else if (repeat === '毎週') matched = r.date === weekday;
    else if (repeat === '毎月') {
      const ruleDay = parseInt(String(r.date || '').replace('日', ''), 10);
      matched = !isNaN(ruleDay) && d.getDate() === ruleDay;
    } else if (repeat === '毎年') matched = r.date === `${mm}-${dd}`;
    if (matched) {
      return {
        openTime: r.changedOpenTime || defaultOpen,
        closeTime: r.changedCloseTime || defaultClose,
      };
    }
  }
  return { openTime: defaultOpen, closeTime: defaultClose };
}

// 営業時間内に収まる時間スロットだけを返す
function filterSlotsByHours(slots, openTime, closeTime) {
  const openMin = timeStrToMinutes(openTime);
  const closeMin = timeStrToMinutes(closeTime);
  if (openMin === null || closeMin === null) return slots;
  return slots.filter(s => {
    const p = parseTimeSlot(s);
    if (!p) return true; // パースできないスロットは残す
    return p.start >= openMin && p.end <= closeMin;
  });
}

const SETTINGS_CACHE_KEY = 'florix_app_settings_cache';
const GALLERY_CACHE_KEY = 'florix_gallery_cache';

// ★ URLパラメータを読み取るためのコンポーネント（Suspenseで囲む必要があります）
function OrderFormContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const imgId = searchParams.get('img'); // ★ URLから img= のIDを取得

  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';

  const [appSettings, setAppSettings] = useState(null);
  const [portfolioImages, setPortfolioImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
  const [otherColor, setOtherColor] = useState('');
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

  // ★ 要件⑦: 自社配達でお届け先が注文者と異なる場合の「事前連絡同意」フラグ
  const [priorContactAgreed, setPriorContactAgreed] = useState(false);
  
  const [calculatedFee, setCalculatedFee] = useState(null);
  const [pickupFee, setPickupFee] = useState(0);
  // ★ 内訳: 送料/配達料・箱代・クール代を別々に保持（お見積り内訳表示用）
  const [feeBreakdown, setFeeBreakdown] = useState({ baseFee: 0, boxFee: 0, coolFee: 0 });

  const [areaError, setAreaError] = useState('');
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ★ 要件④: 決済方法選択
  const [paymentMethod, setPaymentMethod] = useState('');
  // 店舗のStripe接続状態（カード決済が使えるかどうかの判定用）
  const [stripeEnabled, setStripeEnabled] = useState(false);

  const defaultTimeSlots = {
    pickup: ['10:00-12:00', '12:00-15:00', '15:00-18:00'],
    delivery: ['9:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
    shipping: ['午前中', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
  };
  const [timeSlots, setTimeSlots] = useState(defaultTimeSlots);

  const defaultDesignOptions = {
    purposes: ['誕生日', '開店', 'お供え', '就任・昇進祝い', '移転祝い'],
    colors: ['おまかせ', '暖色系 (赤・ピンク・オレンジ)', '寒色系 (青・紫・白)', 'ホワイト・グリーン系'],
    vibes: ['おまかせ (用途に合わせる)', 'かわいい', '豪華', '大人っぽい', '元気', '華やか・豪華', '上品・落ち着いた雰囲気']
  };
  const designOptions = appSettings?.designOptions || defaultDesignOptions;

  useEffect(() => {
    let isFirstLoad = true;

    const applyDataToState = (settingsData, galleryData) => {
      if (settingsData) {
        setAppSettings(settingsData);
        if (settingsData.timeSlots) {
          setTimeSlots(settingsData.timeSlots);
        }
        // ★ Stripeが有効化されている店舗かを判定
        const s = settingsData.stripe;
        setStripeEnabled(Boolean(s?.accountId && s?.chargesEnabled));
      }
      if (galleryData?.images) {
        setPortfolioImages(galleryData.images);
        
        // ★ カタログURLからの引き込み処理
        if (imgId && isFirstLoad) {
          const targetImg = galleryData.images.find(img => img.id === imgId);
          if (targetImg) {
            setSelectedImage(targetImg);
            if (targetImg.flowerType) setFlowerType(targetImg.flowerType); // ★ お花の種類を引き込み
            if (targetImg.purpose) setFlowerPurpose(targetImg.purpose);
            if (targetImg.color) setFlowerColor(targetImg.color);
            if (targetImg.vibe) setFlowerVibe(targetImg.vibe);
            if (targetImg.price) setItemPrice(String(targetImg.price));
          }
        }
      }
    };

    async function fetchSettings() {
      try {
        const cachedSettings = sessionStorage.getItem(`${SETTINGS_CACHE_KEY}_${tenantId}`);
        const cachedGallery = sessionStorage.getItem(`${GALLERY_CACHE_KEY}_${tenantId}`);

        if (cachedSettings) {
          applyDataToState(JSON.parse(cachedSettings), cachedGallery ? JSON.parse(cachedGallery) : null);
          isFirstLoad = false;
          setIsLoading(false);
        }

        const [settingsRes, galleryRes] = await Promise.all([
          supabase.from('app_settings').select('settings_data').eq('id', tenantId).single(),
          // ★ ギャラリーは公開APIで取得（anonでもRLS気にせず確実に取得できる）
          fetch(`/api/portfolio/list?tenantId=${encodeURIComponent(tenantId)}`).then(r => r.json()).catch(() => ({ items: [] })),
        ]);

        const newSettings = settingsRes.data?.settings_data;
        // 公開APIレスポンスを既存の形式（{ images: [...] }）に整形
        const newGallery = { images: galleryRes?.items || [] };

        if (newSettings) {
          applyDataToState(newSettings, newGallery);
          sessionStorage.setItem(`${SETTINGS_CACHE_KEY}_${tenantId}`, JSON.stringify(newSettings));
          if (newGallery) {
            sessionStorage.setItem(`${GALLERY_CACHE_KEY}_${tenantId}`, JSON.stringify(newGallery));
          }
        }
      } catch (err) {
        console.error('設定読込エラー:', err.message);
      } finally {
        setIsLoading(false);
        isFirstLoad = false;
      }
    }
    fetchSettings();
  }, [tenantId, imgId]);

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';

  const selectedItemSettings = useMemo(() => {
    return appSettings?.flowerItems?.find(i => i.name === flowerType) || {};
  }, [flowerType, appSettings]);

  // ★ 類似スコアリング: 部分一致でも「近いもの」を提案
  //   purpose 完全一致 = +3点 / color = +2点 / vibe = +2点
  //   price ±20%以内 = +1点 / ±50%以内 = +0.5点
  //   flowerType も一致してれば優先度UP +1点
  //   何も条件入ってなければ全件最新順表示（インスピレーション用）
  const matchingImages = useMemo(() => {
    if (!portfolioImages || portfolioImages.length === 0) return [];

    const hasAnyCondition = flowerType || flowerPurpose || flowerColor || flowerVibe || itemPrice;
    // 何も条件入ってなければ最新6件を表示
    if (!hasAnyCondition) {
      return portfolioImages.slice(0, 6).map(img => ({ ...img, _score: 0, _matched: [] }));
    }

    const targetPrice = Number(itemPrice) || 0;

    const scored = portfolioImages.map(img => {
      let score = 0;
      const matched = [];

      if (flowerType && img.flowerType === flowerType) {
        score += 1;
        matched.push('種類');
      }
      if (flowerPurpose && flowerPurpose !== 'その他' && img.purpose === flowerPurpose) {
        score += 3;
        matched.push('用途');
      }
      if (flowerColor && flowerColor !== 'おまかせ' && img.color === flowerColor) {
        score += 2;
        matched.push('色');
      }
      if (flowerVibe && flowerVibe !== 'その他' && flowerVibe !== 'おまかせ' && img.vibe === flowerVibe) {
        score += 2;
        matched.push('イメージ');
      }
      if (targetPrice && img.price) {
        const diff = Math.abs(Number(img.price) - targetPrice) / targetPrice;
        if (diff <= 0.2) { score += 1; matched.push('予算'); }
        else if (diff <= 0.5) { score += 0.5; }
      }
      return { ...img, _score: score, _matched: matched };
    });

    return scored
      .filter(img => img._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 8);  // 上位8件まで
  }, [portfolioImages, flowerType, flowerPurpose, flowerColor, flowerVibe, itemPrice]);

  const handleSelectImage = (img) => {
    if (selectedImage?.id === img.id) {
      setSelectedImage(null); 
    } else {
      setSelectedImage(img);
      if (img.price > 0) setItemPrice(String(img.price));
      if (img.flowerType) setFlowerType(img.flowerType); // ★手動選択時も自動セット
      if (img.purpose) setFlowerPurpose(img.purpose);
      if (img.color) setFlowerColor(img.color);
      if (img.vibe) setFlowerVibe(img.vibe);
    }
  };

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

  // ★ ターゲット店舗の情報（営業日カレンダー判定にも使うため上に移動）
  const targetShopData = useMemo(() => {
    if (shopId && shopId !== 'default') {
      return appSettings?.shops?.find(s => String(s.id) === String(shopId)) || appSettings?.shops?.[0] || {};
    }
    if (selectedShop) {
      return appSettings?.shops?.find(s => s.name === selectedShop) || appSettings?.shops?.[0] || {};
    }
    return appSettings?.shops?.[0] || {};
  }, [selectedShop, shopId, appSettings]);

  // ★ バグ③修正: 指定された日付が「休業日」に該当するかチェックする
  //   - receiveMethod に応じて店舗の specialHours / deliverySpecialHours を見る
  //   - repeatType: 単日(今年のみ) / 毎週 / 毎月 / 毎年 / 祝日 をサポート
  const isDateBlocked = (dateStr, shopData, method) => {
    if (!dateStr || !shopData) return false;

    // 受取方法に応じてどのルール配列を使うか切り替え
    //   pickup/sagawa → specialHours（店舗営業日に紐づく）
    //   delivery     → deliverySpecialHours（配達カレンダー）
    const rules = method === 'delivery'
      ? (shopData.deliverySpecialHours || [])
      : (shopData.specialHours || []);

    if (rules.length === 0) return false;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dayNameMap = ['日', '月', '火', '水', '木', '金', '土'];
    const weekday = dayNameMap[d.getDay()];

    for (const r of rules) {
      // 「休業」タイプのルールだけを対象にする（時間変更や特別営業は予約可）
      if (r.type !== 'closed') continue;

      const repeat = r.repeatType || '今年のみ';

      if (repeat === '今年のみ') {
        // 単日: r.date が "YYYY-MM-DD" 形式
        if (r.date === `${yyyy}-${mm}-${dd}`) return true;
      } else if (repeat === '毎週') {
        // 毎週: r.date が '月','火'... の曜日
        if (r.date === weekday) return true;
      } else if (repeat === '毎月') {
        // 毎月: r.date が "1日","2日"...
        const monthDayNum = parseInt(d.getDate(), 10);
        const ruleDayNum = parseInt(String(r.date || '').replace('日', ''), 10);
        if (monthDayNum === ruleDayNum) return true;
      } else if (repeat === '毎年') {
        // 毎年: r.date が "MM-DD" 形式
        if (r.date === `${mm}-${dd}`) return true;
      }
      // 祝日（'祝日'）は別途 holidays ライブラリが要るので、
      // ここでは未対応。導入時に追加する（japanese-holidays 等）。
    }
    return false;
  };

  // 選択中の日付が休業日かどうか（エラーメッセージ表示用）
  const blockedDateMessage = useMemo(() => {
    if (!selectedDate) return '';
    // 配達の場合は配達カレンダー、それ以外は店舗カレンダーを基準に判定
    const method = receiveMethod === 'sagawa' ? 'pickup' : receiveMethod; // 業者配送は店舗の発送業務なので店舗カレンダー
    if (isDateBlocked(selectedDate, targetShopData, method)) {
      return method === 'delivery'
        ? '選択された日は配達休業日です。別の日付をお選びください。'
        : '選択された日は店舗休業日です。別の日付をお選びください。';
    }
    // 業者配送の場合、発送日(shippingDate)も休業日に当たらないかチェック
    if (receiveMethod === 'sagawa' && shippingDate && isDateBlocked(shippingDate, targetShopData, 'pickup')) {
      return `この日にお届けするための発送日 (${shippingDate}) が店舗休業日のため、別の日付をお選びください。`;
    }
    return '';
  }, [selectedDate, receiveMethod, shippingDate, targetShopData]);

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
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
      setCalculatedFee(null); setPickupFee(0); setFeeBreakdown({ baseFee: 0, boxFee: 0, coolFee: 0 }); setAreaError(''); setShippingDate(''); return;
    }

    const targetInfo = isRecipientDifferent ? recipientInfo : customerInfo;
    const rawAddress = ((targetInfo.address1 || '') + (targetInfo.address2 || '')).replace(/[\s　]+/g, '');
    if (!rawAddress) {
      setCalculatedFee(null); setPickupFee(0); setFeeBreakdown({ baseFee: 0, boxFee: 0, coolFee: 0 }); setAreaError(''); setShippingDate(''); return;
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
        setCalculatedFee(baseFee); setPickupFee(pickupFeeAmt); setFeeBreakdown({ baseFee, boxFee: 0, coolFee: 0 }); setAreaError('');
      } else {
        setCalculatedFee(null); setPickupFee(0); setFeeBreakdown({ baseFee: 0, boxFee: 0, coolFee: 0 }); setAreaError('自社配達エリア外です。配送をご利用ください。');
      }
    } else if (receiveMethod === 'sagawa') {
      const prefMatch = rawAddress.match(/^(北海道|東京都|(?:京都|大阪)府|.{2,3}県)/);
      if (!prefMatch) { setCalculatedFee(null); setFeeBreakdown({ baseFee: 0, boxFee: 0, coolFee: 0 }); setAreaError('都道府県が判別できません。'); setShippingDate(''); return; }
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

        setCalculatedFee(baseFee + boxFee + coolFee); setPickupFee(0); setFeeBreakdown({ baseFee, boxFee, coolFee }); setAreaError('');
      } else {
        setCalculatedFee(null); setShippingDate(''); setFeeBreakdown({ baseFee: 0, boxFee: 0, coolFee: 0 }); setAreaError('該当する地域の送料設定が見つかりません。');
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

  // ★ 受取方法ごとのベース時間スロット → 営業時間でフィルタ
  // 業者配送(sagawa)はSagawaの配達時間帯なので店舗営業時間に依存しないため、フィルタ対象外
  // ★ 受取方法ごとのベース時間スロット → 営業時間でフィルタ
  // 業者配送(sagawa)はSagawaの配達時間帯なので店舗営業時間に依存しないため、フィルタ対象外
  const getTimeOptions = () => {
    if (!selectedDate) return [];
    if (receiveMethod === 'sagawa') return timeSlots.shipping || [];
    let base, method;
    if (receiveMethod === 'pickup') { base = timeSlots.pickup; method = 'pickup'; }
    else if (receiveMethod === 'delivery') { base = timeSlots.delivery; method = 'delivery'; }
    else return [];
    if (!base) return [];
    if (!targetShopData || Object.keys(targetShopData).length === 0) return base;
    const hours = getEffectiveHours(selectedDate, targetShopData, method);
    return filterSlotsByHours(base, hours.openTime, hours.closeTime);
  };

  // ★ 日付・受取方法・店舗データが変わった時、既に選んだ時間帯が候補外になればクリア
  useEffect(() => {
    if (!selectedTime) return;
    const opts = getTimeOptions();
    if (!opts.includes(selectedTime)) setSelectedTime('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, receiveMethod, targetShopData, timeSlots]);

  const parsedItemPrice = Number(itemPrice) || 0;
  const parsedFee = calculatedFee || 0;
  const parsedPickupFee = pickupFee || 0;
  const subTotal = parsedItemPrice + parsedFee + parsedPickupFee;
  const tax = Math.floor(subTotal * 0.1);
  const totalAmount = subTotal + tax;

  const missingFields = useMemo(() => {
    const missing = [];
    if (step === 1) {
      if (!flowerType) missing.push('商品');
      if (flowerType && !agreed) missing.push('注意事項の同意');
    }
    if (step === 3) {
      if (!flowerPurpose) missing.push('ご用途');
      if (!flowerColor) missing.push('カラー');
      if (!flowerVibe) missing.push('イメージ');
      if (!itemPrice) missing.push('ご予算');
      if (cardType === 'メッセージカード' && !cardMessage) missing.push('メッセージ内容');
      if (cardType === '立札' && !tatePattern) missing.push('立札のレイアウト');
    }
    if (step === 4) {
      if (!customerInfo.name || !customerInfo.phone || !customerInfo.email) missing.push('ご注文者情報');
      if (isRecipientDifferent && (!recipientInfo.name || !recipientInfo.phone || !recipientInfo.address1)) missing.push('お届け先情報');
      if (!selectedDate) missing.push('お届け希望日');
      if (!selectedTime) missing.push('希望時間');
      if ((receiveMethod === 'delivery' || receiveMethod === 'sagawa') && areaError) missing.push('配送エリアの確認');
      if (receiveMethod === 'delivery' && absenceAction === '置き配' && !absenceNote) missing.push('置き配の指定場所');
      // ★ 要件⑦: 自社配達でお届け先が異なる場合、事前連絡同意が必須
      if (receiveMethod === 'delivery' && isRecipientDifferent && !priorContactAgreed) missing.push('事前連絡への同意');
      // ★ バグ③: 休業日が選ばれていたら次へ進めない
      if (blockedDateMessage) missing.push('お届け希望日（休業日不可）');
      // ★ Phase 2: 決済方法の選択
      if (!paymentMethod) missing.push('お支払い方法');
      if (!methodAgreed) missing.push('注文内容の同意');
    }
    return missing;
  }, [step, flowerType, agreed, flowerPurpose, flowerColor, flowerVibe, itemPrice, cardType, cardMessage, tatePattern, customerInfo, isRecipientDifferent, recipientInfo, selectedDate, selectedTime, methodAgreed, areaError, receiveMethod, absenceAction, absenceNote, blockedDateMessage, priorContactAgreed, paymentMethod]);

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    try {
      const orderPayload = {
        shopId, flowerType, isBring, receiveMethod, selectedShop,
        selectedDate, selectedTime, shippingDate,
        itemPrice, calculatedFee, pickupFee, feeBreakdown,
        absenceAction, absenceNote,
        flowerPurpose, flowerColor, flowerVibe, otherPurpose, otherColor, otherVibe,
        cardType, cardMessage, tatePattern,
        tateInput1, tateInput2, tateInput3, tateInput3a, tateInput3b,
        customerInfo, isRecipientDifferent, recipientInfo, priorContactAgreed, note,
        referenceImage: selectedImage ? selectedImage.url : null,
        status: 'new',
      };

      // ★ Phase 2: クライアントから直接insertではなく API Route 経由に変更
      //   - サーバー側で金額再計算・検証
      //   - paymentMethod === 'card' なら Stripe Checkout に飛ぶ
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          shopId,
          orderData: orderPayload,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注文の送信に失敗しました');

      if (data.checkoutUrl) {
        // クレジットカード: Stripe Checkout へ
        window.location.href = data.checkoutUrl;
        return;
      }

      // 銀行振込・代引きの場合はサンクスページへ
      router.push(`/order/${tenantId}/${shopId}/thanks?order_id=${data.orderId}`);
    } catch (error) {
      console.error('注文エラー:', error);
      alert('注文の送信に失敗しました。\n' + (error.message || ''));
      setIsSubmitting(false);
    }
  };

  const pickupNote = targetShopData.pickupNote || 'ご来店予定日時に店舗までお越しください。';
  const deliveryNote = targetShopData.deliveryNote || '交通状況により配達時間が前後する場合がございます。';
  const shippingNote = targetShopData.shippingNote || '発送準備期間＋配送日数がかかります。交通状況により遅延する場合がございます。';
  const absenceInstruction = targetShopData.absenceInstruction || '生花のため、ご不在時は原則として置き配または宅配ボックスへのお届けとなります。ご希望の対応をお選びください。';

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-sans"><div className="text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div></div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans text-[#111111] pb-32">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA]">
        <div className="max-w-[600px] mx-auto h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? <img src={logoUrl} alt={appName} className="h-6 object-contain" /> : <span className="font-serif font-bold tracking-tight text-[18px] text-[#2D4B3E]">{appName}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/order/${tenantId}/${shopId}`} className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-[#555555] hover:text-[#2D4B3E] px-2 py-1">
              ← 注文方法を変更
            </Link>
            <Link href={`/order/${tenantId}/${shopId}/history`} className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-[#555555] hover:text-[#2D4B3E] px-2 py-1">
              <Search size={12}/> 注文確認
            </Link>
            <div className="text-[10px] font-bold text-[#999999]">ステップ {step} / 4</div>
          </div>
        </div>
        <div className="h-0.5 w-full bg-[#FBFAF9]">
          <div className="h-full transition-all duration-500 ease-out bg-[#2D4B3E]" style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>
      </header>

      <main className="max-w-[600px] mx-auto px-6 pt-10">

        {/* --- STEP 1: お花の種類 --- */}
        {step === 1 && (
          <div className="space-y-10 animate-in fade-in duration-200">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">カスタム注文</h1>
              <p className="text-[12px] text-[#555555]">お花の種類・予算・イメージから自由に組み立てます。</p>
            </div>

            {/* ★ 入口ページから「オーダーメイドで注文」を選択して遷移してくるためここでのCTAは不要 */}
            <div className="space-y-6">
              <select className={`w-full h-16 px-5 bg-white border rounded-2xl outline-none transition-all text-[15px] font-bold appearance-none shadow-sm ${flowerType ? 'border-[#2D4B3E] text-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA] focus:border-[#2D4B3E]'}`} value={flowerType} onChange={(e) => { setFlowerType(e.target.value); setItemPrice(''); setIsBring('shop'); }}>
                <option value="">種類を選択してください</option>
                {appSettings?.flowerItems?.filter(item => {
                  if (!shopId || shopId === 'default') return true;
                  if (!item.targetShops || item.targetShops === 'all') return true;
                  return item.targetShops.includes(Number(shopId));
                }).map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>

              {flowerType && selectedItemSettings.canBringFlowers && (
                <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-4 animate-in fade-in">
                  <p className="text-[11px] font-bold text-[#999999] uppercase text-center">お花・花器の持ち込み</p>
                  <div className="flex gap-2 p-1 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                    <button onClick={() => setIsBring('shop')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${isBring === 'shop' ? 'bg-white text-[#2D4B3E] shadow-sm' : 'text-[#999999]'}`}>当店のお花のみ</button>
                    <button onClick={() => setIsBring('bring')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${isBring === 'bring' ? 'bg-white text-[#2D4B3E] shadow-sm' : 'text-[#999999]'}`}>持ち込みあり</button>
                  </div>
                </div>
              )}

              {flowerType ? (
                <div className="p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] space-y-4 animate-in fade-in">
                  <p className="text-[11px] font-bold text-[#111111] border-b border-[#EAEAEA] pb-2">納期に関する注意事項</p>
                  <div className="space-y-2 text-[12px] text-[#555555] font-medium">
                    {selectedItemSettings.normalLeadDays !== undefined && <div className="flex justify-between"><span>通常納期 (店頭/配達)</span><span className="font-bold">{selectedItemSettings.normalLeadDays}日後以降</span></div>}
                    {selectedItemSettings.shippingLeadDays !== undefined && (
                      <div className="flex justify-between text-[#2D4B3E]">
                        <span>業者(佐川)配送 納期</span>
                        <span className="font-bold">
                          道内{Number(selectedItemSettings.shippingLeadDays) + 1}日、道外{Number(selectedItemSettings.shippingLeadDays) + 2}日
                        </span>
                      </div>
                    )}
                    {isBring === 'bring' && (selectedItemSettings.canBringFlowersLeadDays || selectedItemSettings.canBringVaseLeadDays) && <div className="flex justify-between text-[#2D4B3E] pt-1"><span>お持ち込み時 (通常より延長)</span><span className="font-bold">{Math.max(Number(selectedItemSettings.canBringFlowersLeadDays)||0, Number(selectedItemSettings.canBringVaseLeadDays)||0)}日後以降</span></div>}
                  </div>

                  {/* ★ 要件⑤: お急ぎの電話案内（商品ごとにON/OFF切替可能、デフォルトON） */}
                  {selectedItemSettings.showRushCallNotice !== false && targetShopData.phone && (
                    <div className="flex items-start gap-3 p-4 bg-white border border-[#2D4B3E]/20 rounded-xl">
                      <Phone size={18} className="text-[#2D4B3E] shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <p className="text-[12px] font-bold text-[#111111] leading-relaxed">
                          予定納期よりも早い納期をご希望の場合は、店舗へ直接お電話ください。
                        </p>
                        <a
                          href={`tel:${String(targetShopData.phone).replace(/[^\d+]/g, '')}`}
                          className="inline-flex items-center gap-2 text-[15px] font-bold text-[#2D4B3E] hover:underline"
                        >
                          {targetShopData.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-3 pt-4 cursor-pointer border-t border-[#EAEAEA]">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="w-5 h-5 accent-[#2D4B3E] rounded-md cursor-pointer" />
                    <span className="text-[13px] font-bold text-[#111111] underline underline-offset-4">内容を確認し、同意します</span>
                  </label>
                </div>
              ) : (
                <div className="p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] text-center border-dashed">
                   <p className="text-[12px] text-[#999999] font-bold">種類を選択すると納期が表示されます</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- STEP 2: お受け取り方法 --- */}
        {step === 2 && (
          <div className="space-y-10 animate-in fade-in duration-200">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">納品方法を選ぶ</h1>
              <p className="text-[12px] text-[#555555]">ご来店、または配達・配送をお選びください。</p>
            </div>
            <div className="space-y-4">
              {selectedItemSettings.canPickup !== false && appSettings?.shops?.length > 0 ? (
                appSettings.shops.filter(s => shopId === 'default' || String(s.id) === String(shopId)).map(shop => (
                  <button key={shop.id} onClick={() => { setReceiveMethod('pickup'); setSelectedShop(shop.name); setStep(3); }} className="w-full p-8 rounded-2xl bg-white border border-[#EAEAEA] shadow-sm hover:border-[#2D4B3E] transition-all text-left group">
                    <span className="block font-bold text-[16px] mb-1 group-hover:text-[#2D4B3E]">{shop.name}で受取</span>
                    <span className="block text-[12px] text-[#999999]">{shop.address}</span>
                  </button>
                ))
              ) : null}
              <div className="grid grid-cols-2 gap-4 mt-8">
                {selectedItemSettings.canDelivery !== false && (<button onClick={() => { setReceiveMethod('delivery'); setStep(3); }} className="p-6 rounded-2xl bg-[#FBFAF9] border border-[#EAEAEA] font-bold text-[14px] hover:bg-white hover:border-[#2D4B3E] transition-all text-[#555555] hover:text-[#2D4B3E]">自社配達</button>)}
                {selectedItemSettings.canShipping !== false && (<button onClick={() => { setReceiveMethod('sagawa'); setStep(3); }} className="p-6 rounded-2xl bg-[#FBFAF9] border border-[#EAEAEA] font-bold text-[14px] hover:bg-white hover:border-[#2D4B3E] transition-all text-[#555555] hover:text-[#2D4B3E]">業者配送</button>)}
              </div>
            </div>
          </div>
        )}

        {/* --- STEP 3: デザイン詳細と画像提案 --- */}
        {step === 3 && (
          <div className="space-y-10 animate-in fade-in duration-200">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">デザイン・詳細設定</h1>
              <p className="text-[12px] text-[#555555]">お花のイメージと、立札・カードの内容を入力してください。</p>
            </div>

            <div className="space-y-8 bg-white p-8 rounded-2xl border border-[#EAEAEA] shadow-sm transition-all duration-500">
              
              {matchingImages.length > 0 && (
                <div className="bg-[#2D4B3E]/5 -mx-8 -mt-8 p-6 pb-8 mb-4 rounded-t-[28px] border-b border-[#EAEAEA] space-y-4">
                   <p className="text-[11px] font-bold text-[#2D4B3E] flex items-center gap-2">
                      ✨ こんな感じはいかがですか？（過去のお作り例）
                   </p>
                   <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                     {matchingImages.map(img => (
                       <div key={img.id} className="shrink-0 w-[140px] space-y-2 snap-center">
                         <div
                           onClick={() => handleSelectImage(img)}
                           className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all cursor-pointer ${selectedImage?.id === img.id ? 'border-[#2D4B3E] shadow-lg scale-105' : 'border-transparent hover:scale-105'}`}
                         >
                           <img src={img.url} alt="style" className="w-full h-full object-cover" />
                           {selectedImage?.id === img.id && (
                             <div className="absolute inset-0 bg-[#2D4B3E]/30 flex items-center justify-center backdrop-blur-[1px]">
                               <span className="bg-[#2D4B3E] text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm">選択中</span>
                             </div>
                           )}
                           {/* マッチ理由バッジ */}
                           {img._matched && img._matched.length > 0 && selectedImage?.id !== img.id && (
                             <div className="absolute top-1.5 left-1.5 right-1.5 flex flex-wrap gap-1">
                               {img._matched.map((m, i) => (
                                 <span key={i} className="bg-[#2D4B3E]/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">{m}✓</span>
                               ))}
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
                <label className="text-[11px] font-bold text-[#999999]">ご用途</label>
                <select value={flowerPurpose} onChange={(e) => setFlowerPurpose(e.target.value)} className={`w-full h-12 border-b bg-transparent outline-none font-bold transition-all ${selectedImage && flowerPurpose ? 'border-[#2D4B3E] text-[#2D4B3E]' : 'border-[#EAEAEA] focus:border-[#2D4B3E]'}`}>
                  <option value="">選択...</option>
                  {designOptions.purposes.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="その他">その他</option>
                </select>
                {flowerPurpose === 'その他' && <input type="text" placeholder="詳細を入力..." value={otherPurpose} onChange={(e) => setOtherPurpose(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-sm border border-[#EAEAEA]" />}
              </div>
              
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-[#999999]">メインカラー</label>
                <select value={flowerColor} onChange={(e) => setFlowerColor(e.target.value)} className={`w-full h-12 border-b bg-transparent outline-none font-bold transition-all ${selectedImage && flowerColor ? 'border-[#2D4B3E] text-[#2D4B3E]' : 'border-[#EAEAEA] focus:border-[#2D4B3E]'}`}>
                  <option value="">選択...</option>
                  {designOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="その他">その他</option>
                </select>
                {flowerColor === 'その他' && <input type="text" placeholder="ご希望のカラーをご入力ください" value={otherColor} onChange={(e) => setOtherColor(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-sm border border-[#EAEAEA]" />}
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-[#999999]">イメージ</label>
                <select value={flowerVibe} onChange={(e) => setFlowerVibe(e.target.value)} className={`w-full h-12 border-b bg-transparent outline-none font-bold transition-all ${selectedImage && flowerVibe ? 'border-[#2D4B3E] text-[#2D4B3E]' : 'border-[#EAEAEA] focus:border-[#2D4B3E]'}`}>
                  <option value="">選択...</option>
                  {designOptions.vibes.map(v => <option key={v} value={v}>{v}</option>)}
                  <option value="その他">その他</option>
                </select>
                {flowerVibe === 'その他' && <input type="text" placeholder="イメージの詳細をご入力ください" value={otherVibe} onChange={(e) => setOtherVibe(e.target.value)} className="w-full h-10 mt-2 bg-[#FBFAF9] px-4 rounded-lg outline-none text-sm border border-[#EAEAEA]" />}
              </div>

              <div className="space-y-3 pt-4">
                <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                  ご予算 (税抜)
                  {selectedImage && <span className="bg-[#2D4B3E] text-white px-2 py-0.5 rounded text-[9px]">画像から自動反映</span>}
                </label>
                <select value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className={`w-full h-14 border rounded-xl px-4 bg-[#FBFAF9] outline-none font-bold text-[16px] transition-all ${selectedImage ? 'border-[#2D4B3E] text-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA] focus:border-[#2D4B3E]'}`}>
                  <option value="">選択...</option>
                  {getPriceOptions().map(price => (<option key={price} value={price}>¥{price.toLocaleString()}</option>))}
                  {selectedImage && itemPrice && !getPriceOptions().includes(Number(itemPrice)) && (
                    <option value={itemPrice}>¥{Number(itemPrice).toLocaleString()}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-[11px] font-bold text-[#999999] text-center">メッセージ・立札</p>
              <div className="flex gap-2 p-1 bg-white rounded-2xl border border-[#EAEAEA]">
                {['なし', 'メッセージカード', '立札'].map(t => (
                  <button key={t} onClick={() => setCardType(t)} className={`flex-1 py-3 text-[12px] font-bold rounded-xl transition-all ${cardType === t ? 'bg-[#2D4B3E] text-white shadow-md' : 'text-[#555555]'}`}>{t}</button>
                ))}
              </div>

              {cardType === 'メッセージカード' && (
                 <textarea value={cardMessage} onChange={(e) => setCardMessage(e.target.value)} placeholder="カードのメッセージをご入力ください" className="w-full h-32 p-4 bg-white border border-[#EAEAEA] rounded-2xl text-[13px] resize-none outline-none focus:border-[#2D4B3E] shadow-sm animate-in zoom-in-95"></textarea>
              )}

              {cardType === '立札' && (
                <div className="space-y-6 bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm animate-in zoom-in-95 duration-300">
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
                      {tateNeeds.includes('1') && <input type="text" placeholder={`① 内容 (例: ${isOsonae ? '御供' : '御開店'})`} value={tateInput1} onChange={(e) => setTateInput1(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('2') && <input type="text" placeholder="② 宛名 (例: 〇〇様)" value={tateInput2} onChange={(e) => setTateInput2(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('3') && <input type="text" placeholder="③ 贈り主 (例: 株式会社〇〇)" value={tateInput3} onChange={(e) => setTateInput3(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('3a') && <input type="text" placeholder="③-1 会社名" value={tateInput3a} onChange={(e) => setTateInput3a(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      {tateNeeds.includes('3b') && <input type="text" placeholder="③-2 役職・氏名" value={tateInput3b} onChange={(e) => setTateInput3b(e.target.value)} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]" />}
                      
                      <p className="text-[10px] font-bold text-[#999999] text-center pt-4 mb-2">仕上がりプレビュー</p>
                      
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
          </div>
        )}

        {/* --- STEP 4: お届け・お客様情報 --- */}
        {step === 4 && (
          <div className="space-y-10 animate-in fade-in duration-200">
            <div>
              <h1 className="text-[20px] font-bold mb-2 text-[#2D4B3E]">お届け・お客様情報</h1>
              <p className="text-[12px] text-[#555555]">お届け希望日と、お客様の情報をご入力ください。</p>
            </div>

            <div className="space-y-6">
              
              <div className="space-y-4 bg-white p-8 rounded-2xl border border-[#EAEAEA] shadow-sm">
                <div className="space-y-4">
                  <label className="text-[11px] font-bold text-[#999999]">注文者情報</label>
                  <input type="text" placeholder="お名前" value={customerInfo.name} onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="tel" placeholder="電話番号" value={customerInfo.phone} onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="email" placeholder="メールアドレス (必須)" value={customerInfo.email} onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  
                  {receiveMethod !== 'pickup' && (
                    <>
                      <div className="flex gap-2">
                        <input type="text" placeholder="郵便番号 (7桁・ハイフンなし)" value={customerInfo.zip} onChange={(e) => { setCustomerInfo({...customerInfo, zip: e.target.value}); if(e.target.value.length === 7) fetchAddress(e.target.value, 'customer'); }} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                      </div>
                      <input type="text" placeholder="住所が自動入力されます" value={customerInfo.address1} className="w-full h-14 px-5 bg-[#EAEAEA]/30 rounded-xl outline-none text-[#999999] text-[14px]" readOnly />
                      <input type="text" placeholder="番地・建物名など" value={customerInfo.address2} onChange={(e) => setCustomerInfo({...customerInfo, address2: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                    </>
                  )}
                </div>
              </div>

              {receiveMethod !== 'pickup' && (
                <div className="pt-2">
                  <label className="flex items-center gap-3 p-4 bg-white rounded-xl border border-[#EAEAEA] cursor-pointer shadow-sm">
                    <input type="checkbox" checked={isRecipientDifferent} onChange={(e) => setIsRecipientDifferent(e.target.checked)} className="w-5 h-5 accent-[#2D4B3E] rounded" />
                    <span className="text-[13px] font-bold text-[#111111]">お届け先が注文者と異なる</span>
                  </label>
                </div>
              )}

              {isRecipientDifferent && receiveMethod !== 'pickup' && (
                <div className="space-y-4 bg-white p-8 rounded-2xl border border-[#2D4B3E]/20 shadow-sm animate-in fade-in zoom-in-95">
                  <label className="text-[11px] font-bold text-[#2D4B3E]">お届け先情報</label>
                  <input type="text" placeholder="お届け先 お名前" value={recipientInfo.name} onChange={(e) => setRecipientInfo({...recipientInfo, name: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px] font-bold" />
                  <input type="tel" placeholder="お届け先 電話番号" value={recipientInfo.phone} onChange={(e) => setRecipientInfo({...recipientInfo, phone: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="text" placeholder="郵便番号 (7桁)" value={recipientInfo.zip} onChange={(e) => { setRecipientInfo({...recipientInfo, zip: e.target.value}); if(e.target.value.length === 7) fetchAddress(e.target.value, 'recipient'); }} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                  <input type="text" placeholder="都道府県・市区町村 (自動入力)" value={recipientInfo.address1} className="w-full h-14 px-5 bg-[#EAEAEA]/30 rounded-xl outline-none text-[#999999] text-[14px]" readOnly />
                  <input type="text" placeholder="番地・建物名" value={recipientInfo.address2} onChange={(e) => setRecipientInfo({...recipientInfo, address2: e.target.value})} className="w-full h-14 px-5 bg-[#FBFAF9] rounded-xl outline-none focus:bg-white focus:border-[#2D4B3E] border border-transparent transition-all text-[14px]" />
                </div>
              )}

              {/* ★ 要件⑦: 自社配達 + お届け先が注文者と異なる場合の「事前連絡同意」 */}
              {receiveMethod === 'delivery' && isRecipientDifferent && (
                <div className="p-5 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl space-y-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-[#2D4B3E] shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#555555] leading-relaxed">
                      自社配達では、お届け先のご都合確認のため、配達前にお届け先様へ直接ご連絡させていただく場合がございます。
                      事前連絡へのご同意が必要です。同意いただけない場合は、業者配送（佐川急便）への切り替えをご検討ください。
                    </p>
                  </div>
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#EAEAEA] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={priorContactAgreed}
                      onChange={(e) => setPriorContactAgreed(e.target.checked)}
                      className="w-5 h-5 accent-[#2D4B3E] rounded-md cursor-pointer"
                    />
                    <span className="text-[13px] font-bold text-[#111111]">お届け先様への事前連絡に同意します</span>
                  </label>
                  {!priorContactAgreed && (
                    <button
                      type="button"
                      onClick={() => {
                        setReceiveMethod('sagawa');
                        setPriorContactAgreed(false);
                        setCalculatedFee(null);
                      }}
                      className="w-full h-12 bg-white border border-[#2D4B3E] text-[#2D4B3E] rounded-xl font-bold text-[13px] hover:bg-[#2D4B3E] hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Truck size={16} /> 業者配送（佐川急便）に切り替える
                    </button>
                  )}
                </div>
              )}

              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#999999]">お届け希望日</label>
                  {/* ★ 要件⑧: HTML date input → 独自カレンダーUIに置き換え（PC・スマホ共通表示） */}
                  <DatePicker
                    value={selectedDate}
                    onChange={setSelectedDate}
                    minDate={minDateLimit}
                    isBlocked={(dateStr) => {
                      if (!targetShopData) return false;
                      if (receiveMethod === 'sagawa') {
                        // 業者配送の場合: お届け日に対応する発送日が店舗休業日かをチェック
                        const [y, m, day] = dateStr.split('-').map(Number);
                        const dd = new Date(y, m - 1, day);
                        dd.setDate(dd.getDate() - (transitDays || 0));
                        const yy = dd.getFullYear();
                        const mm = String(dd.getMonth() + 1).padStart(2, '0');
                        const dn = String(dd.getDate()).padStart(2, '0');
                        return isDateBlocked(`${yy}-${mm}-${dn}`, targetShopData, 'pickup');
                      }
                      return isDateBlocked(dateStr, targetShopData, receiveMethod);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[#999999]">希望時間</label>
                  <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="w-full h-14 px-4 bg-white border border-[#EAEAEA] rounded-xl outline-none font-bold text-[#555555] focus:border-[#2D4B3E] shadow-sm">
                    <option value="">選択...</option>
                    {getTimeOptions().map(t => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
              </div>

              {/* 既存日付が休業日に該当する場合の警告（保険として残す）*/}
              {blockedDateMessage && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] font-bold text-red-700 leading-relaxed">{blockedDateMessage}</p>
                </div>
              )}

              {receiveMethod === 'sagawa' && selectedDate && shippingDate && (
                <div className="mt-4 p-5 bg-green-50 border border-green-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3 animate-in fade-in shadow-sm">
                  <p className="text-[11px] font-bold text-green-700">配送スケジュール</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-2 text-green-900 font-bold text-[15px] bg-white px-3 py-2 rounded-lg shadow-sm border border-green-100">
                       <Package size={18}/> 発送日: {shippingDate}
                    </div>
                    <ChevronRight size={18} className="hidden sm:block text-green-400"/>
                    <div className="flex items-center gap-2 text-green-800 font-bold text-[13px]">
                       <Calendar size={16}/> お届け: {selectedDate}
                    </div>
                  </div>
                </div>
              )}

              {receiveMethod === 'delivery' && (
                <div className="p-8 bg-white rounded-2xl border border-[#EAEAEA] shadow-sm space-y-4 animate-in fade-in mt-6">
                  <div className="space-y-2">
                    <label className="text-[12px] font-bold text-[#111111] flex items-center justify-between">
                      ご不在時の対応 (置き配)
                      <span className="bg-[#2D4B3E] text-white px-2 py-0.5 rounded text-[9px] font-bold">必須</span>
                    </label>
                    <p className="text-[11px] text-[#555555] mb-2 leading-relaxed">生花のため、ご不在時は原則として置き配または宅配ボックスへのお届けとなります。ご希望の対応をお選びください。</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setAbsenceAction('持ち戻り')} className={`py-4 text-[13px] font-bold rounded-xl border transition-all ${absenceAction === '持ち戻り' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E] shadow-md' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>持ち戻り (再配達)</button>
                      <button onClick={() => setAbsenceAction('置き配')} className={`py-4 text-[13px] font-bold rounded-xl border transition-all ${absenceAction === '置き配' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E] shadow-md' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#555555]'}`}>置き配を希望する</button>
                    </div>
                  </div>
                  {absenceAction === '置き配' && (
                    <div className="space-y-2 pt-2 animate-in fade-in">
                      <p className="text-[11px] font-bold text-[#2D4B3E]">置き配の場所</p>
                      <input 
                        type="text" 
                        placeholder="例：玄関のドア前、宅配ボックス、ガスメーターの中 など" 
                        value={absenceNote} 
                        onChange={(e) => setAbsenceNote(e.target.value)} 
                        className="w-full h-14 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl outline-none text-[13px] focus:bg-white focus:border-[#2D4B3E] transition-all shadow-inner" 
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ★ AI感削減: 帳票/レシート風の落ち着いたデザインに変更 */}
              <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] mt-8">
                <p className="text-[12px] font-bold text-[#555555] mb-4">お見積り内訳</p>
                <div className="space-y-2 text-[13px] text-[#555555] mb-4">
                  <div className="flex justify-between">
                    <span>商品代（税抜）</span>
                    <span className="text-[#111111]">¥{parsedItemPrice.toLocaleString()}</span>
                  </div>
                  {/* ★ 内訳: 配送料（送料/配達料）・箱代・クール代を別行で */}
                  {feeBreakdown.baseFee > 0 && (
                    <div className="flex justify-between">
                      <span>{receiveMethod === 'delivery' ? '配達料' : '送料'}</span>
                      <span className="text-[#111111]">¥{feeBreakdown.baseFee.toLocaleString()}</span>
                    </div>
                  )}
                  {feeBreakdown.boxFee > 0 && (
                    <div className="flex justify-between">
                      <span>箱代</span>
                      <span className="text-[#111111]">¥{feeBreakdown.boxFee.toLocaleString()}</span>
                    </div>
                  )}
                  {feeBreakdown.coolFee > 0 && (
                    <div className="flex justify-between">
                      <span>クール便代</span>
                      <span className="text-[#111111]">¥{feeBreakdown.coolFee.toLocaleString()}</span>
                    </div>
                  )}
                  {parsedPickupFee > 0 && (
                    <div className="flex justify-between">
                      <span>後日回収費</span>
                      <span className="text-[#111111]">¥{parsedPickupFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#999999] pt-2 border-t border-[#F0F0F0]">
                    <span>消費税（10%）</span>
                    <span>¥{tax.toLocaleString()}</span>
                  </div>
                </div>
                {areaError && <p className="text-red-500 text-[11px] mb-3">{areaError}</p>}
                <div className="flex items-baseline justify-between pt-4 border-t border-[#EAEAEA]">
                  <span className="text-[13px] font-bold text-[#111111]">合計（税込）</span>
                  <span className="text-[24px] font-bold text-[#2D4B3E]">
                    ¥{totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* ★ Phase 2: お支払い方法選択 */}
              <div className="bg-white p-6 rounded-2xl border border-[#EAEAEA] mt-6">
                <p className="text-[12px] font-bold text-[#555555] mb-4">お支払い方法</p>
                <div className="space-y-2">
                  {stripeEnabled && (
                    <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA] hover:border-[#2D4B3E]/50'}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="card"
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-1 accent-[#2D4B3E]"
                      />
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-[#111111]">クレジットカード決済</p>
                        <p className="text-[11px] text-[#555555] mt-1 leading-relaxed">
                          確定後すぐにStripeの安全な決済画面へ移動します。Visa / Mastercard / JCB / American Express 対応。
                        </p>
                      </div>
                    </label>
                  )}
                  <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === 'bank_transfer' ? 'border-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA] hover:border-[#2D4B3E]/50'}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bank_transfer"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mt-1 accent-[#2D4B3E]"
                    />
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-[#111111]">銀行振込</p>
                      <p className="text-[11px] text-[#555555] mt-1 leading-relaxed">
                        ご注文確定後、振込先をメールでお送りします。お支払いの確認後、商品の準備を開始いたします。
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] font-sans space-y-4 mt-6">
                <p className="text-[11px] font-bold text-[#111111] border-b border-[#EAEAEA] pb-2 flex items-center gap-1.5">
                  <AlertCircle size={14}/>
                  {receiveMethod === 'pickup' ? '店頭受取に関する注意事項' : receiveMethod === 'delivery' ? '自社配達に関する注意事項' : '配送に関する注意事項'}
                </p>
                <div className="text-[12px] text-[#555555] space-y-3 leading-relaxed font-medium whitespace-pre-wrap">
                  {receiveMethod === 'pickup' && <p>{pickupNote}</p>}
                  
                  {receiveMethod === 'delivery' && (
                    <>
                      <p>{deliveryNote}</p>
                      <p className="text-[#2D4B3E] font-bold">{absenceInstruction}</p>
                      {parsedPickupFee > 0 && <p className="font-bold text-orange-600">※ご注文の商品には回収が必要な器（スタンド等）が含まれているため、回収費用(¥{parsedPickupFee.toLocaleString()})が加算されています。</p>}
                    </>
                  )}
                  
                  {receiveMethod === 'sagawa' && (
                    <>
                      <p>{shippingNote}</p>
                      <div className="space-y-1 mt-4 pt-4 border-t border-[#EAEAEA]"><p className="font-bold text-[#111111]">■ 配送時の事故について</p><p>配送中の事故につきましては、当店では補償いたしかねます。商品到着時に不具合等が確認された場合は、直接業者へご連絡くださいますようお願いいたします。</p></div>
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

        <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-[#EAEAEA] py-4 px-6 z-50">
          <div className="max-w-[600px] mx-auto flex flex-col gap-2">
            
            {missingFields.length > 0 && (
              <div className="text-[10px] font-bold text-red-500 text-center animate-pulse">
                未入力項目があります: {missingFields.join('、')}
              </div>
            )}
            
            <div className="flex gap-4">
              {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="px-6 h-14 shrink-0 rounded-xl bg-white border border-[#EAEAEA] text-[#555555] font-bold text-[14px] hover:bg-[#F7F7F7] transition-all">戻る</button>
              )}
              <button 
                disabled={missingFields.length > 0 || isSubmitting} 
                onClick={() => step < 4 ? setStep(step + 1) : handleSubmitOrder()} 
                className={`flex-1 h-14 rounded-xl bg-[#2D4B3E] text-white font-bold text-[15px] shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 hover:bg-[#1f352b]`}
              >
                {step === 4 ? (isSubmitting ? '送信中...' : '注文を確定する') : '次へ進む'}
              </button>
            </div>
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

// ★ Suspense で囲んでエクスポート（Next.jsの仕様対応）
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E]">読み込み中...</div>}>
      <OrderFormContent />
    </Suspense>
  );
}