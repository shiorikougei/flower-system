'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Settings as SettingsIcon, ListChecks, Store, Tag, Truck, User, Mail,
  Trash2, Plus, Clock, ShieldCheck, RotateCcw, Image as ImageIcon, Ruler,
  ChevronRight, Calendar as CalendarIcon, CalendarDays, Box, MapPin, X,
  LayoutTemplate, Package, Eye, EyeOff, Sparkles, AlertCircle, Link as LinkIcon, Building2, CreditCard, Palette
} from 'lucide-react';
import HelpTooltip from '@/components/HelpTooltip';

import TatefudaPreview from '@/components/TatefudaPreview';
import PaymentTab from '@/components/settings/PaymentTab';
import { EMAIL_TRIGGERS, getPresetTemplates, getTriggerById } from '@/utils/emailTemplates';

const SETTINGS_CACHE_KEY = 'florix_app_settings_cache';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  // ★ 保存完了トースト
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  
  const [currentTenantId, setCurrentTenantId] = useState(null);
  
  const [isB2BEnabled, setIsB2BEnabled] = useState(false);
  const [isLineFeatureEnabled, setIsLineFeatureEnabled] = useState(false);
  
  // ★追加：コピーしたタグの名前を一時的に保持するステート
  const [copiedTag, setCopiedTag] = useState(null);

  const [generalConfig, setGeneralConfig] = useState({
    tenantId: '',
    appName: 'FLORIX',
    logoUrl: '', logoSize: 100, logoTransparent: false, slipBgUrl: '', slipBgOpacity: 50, systemPassword: '7777',
    // ★ 領収書の印影設定: mode = 'none' | 'auto' | 'image'
    receiptStamp: { mode: 'auto', imageUrl: '' }
  });

  const [paymentConfig, setPaymentConfig] = useState({
    bankName: '', branchName: '', accountType: '普通', accountNumber: '', accountName: ''
  });

  const [statusConfig, setStatusConfig] = useState({
    type: 'template',
    customLabels: ['受注', '制作', '配達', '片付', '請求'],
    ecLabels: ['受注', '発送準備中', '発送済み', '完了'],   // ★ EC共通ステータス
    deliveryLabels: ['未配達', '配達中', '配達完了', '不在'],  // ★ 配達管理ステータス
    orderTypeLabels: {},  // ★ 花の種類ごと: { '花束': [...], 'アレンジ': [...] }
  });

  const [designOptions, setDesignOptions] = useState({
    purposes: ['誕生日', '開店', 'お供え', '就任・昇進祝い', '移転祝い'],
    colors: ['おまかせ', '暖色系 (赤・ピンク・オレンジ)', '寒色系 (青・紫・白)', 'ホワイト・グリーン系'],
    vibes: ['おまかせ (用途に合わせる)', 'かわいい', '豪華', '大人っぽい', '元気', '華やか・豪華', '上品・落ち着いた雰囲気']
  });

  const [shops, setShops] = useState([]); 
  const [flowerItems, setFlowerItems] = useState([]);
  const [deliveryAreas, setDeliveryAreas] = useState([]);
  const [shippingSizes, setShippingSizes] = useState(['80', '100', '120']);
  const [shippingRates, setShippingRates] = useState([]); 
  const [boxFeeConfig, setBoxFeeConfig] = useState({
    type: 'flat', flatFee: 500, priceTiers: [{ minPrice: 0, fee: 300 }, { minPrice: 10000, fee: 0 }], itemFees: {},
    returnFeeType: 'flat', returnFeeValue: 1000, coolBinEnabled: true, coolBinPeriods: [],
    freeShippingThresholdEnabled: false, freeShippingThreshold: 15000, isBundleDiscount: true,
    applyToDelivery: false, // ★ 自社配達時も箱代を加算するか（デフォルト=しない）
    // ★ EC専用箱代（商品サイズごとの単価）
    ecBoxFees: { S: 300, M: 500, L: 800, XL: 1200 },
  });
  
  const [timeSlots, setTimeSlots] = useState({
    pickup: ['10:00-12:00', '12:00-15:00', '15:00-18:00'],
    delivery: ['9:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
    shipping: ['午前中', '14:00-16:00', '16:00-18:00', '18:00-20:00', '19:00-21:00']
  });

  const tateMaster = [
    { id: 'p1', label: '① 御供｜横型 (背景あり)', layout: 'horizontal', color: 'gray' }, 
    { id: 'p3', label: '② 御供｜縦型 (シンプル)', layout: 'vertical', color: 'gray' }, 
    { id: 'p4', label: '③ 御供｜縦型 (会社名入)', layout: 'vertical', color: 'gray' },
    { id: 'p5', label: '⑤ 祝｜横型 (スタンダード)', layout: 'horizontal', color: 'red' }, 
    { id: 'p6', label: '⑥ 祝｜横型 (様へ構成)', layout: 'horizontal', color: 'red' }, 
    { id: 'p7', label: '⑦ 祝｜縦型 (二列構成)', layout: 'vertical', color: 'red' }, 
    { id: 'p8', label: '⑧ 祝｜縦型 (三列完成版)', layout: 'vertical', color: 'red' },
  ];
  const [selectedPreviewTate, setSelectedPreviewTate] = useState(tateMaster[3]);

  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffStore, setNewStaffStore] = useState('all');
  const [staffOrderConfig, setStaffOrderConfig] = useState({ ignoreLeadTime: true, allowCustomPrice: true, paymentMethods: ['店頭支払い(済)', '銀行振込(請求書)', '代金引換'], sendAutoReply: false });
  
  const [autoReplyTemplates, setAutoReplyTemplates] = useState([
    { id: 't1', trigger: '注文受付（自動返信）', targetShops: 'all', subject: 'ご注文ありがとうございます', body: '{CustomerName} 様\n\nご注文ありがとうございます。' }
  ]);

  // ★ LINE 連携設定
  const [lineConfig, setLineConfig] = useState({
    enabled: false,
    channelAccessToken: '',
    channelSecret: '',
    channelId: '',
    addFriendUrl: '',
  });

  // ★ スタッフPIN認証設定
  const [staffAuthConfig, setStaffAuthConfig] = useState({
    requirePin: false,           // スタッフ切替時にPIN必須にするか
    requireForOwnerOnly: false,  // オーナー以外もPIN必須にするか
  });

  // ★ 給与計算設定（店舗共通）
  const [payrollConfig, setPayrollConfig] = useState({
    enabled: false,
    employmentInsuranceRate: 0.6,
    socialInsuranceRate: 14.5,
    incomeTaxThreshold: 88000,
    incomeTaxRate: 3.063,
    overtimePremiumRate: 25,
    overtimeThresholdHours: 8,
  });

  // ★ シフト設定
  const [shiftConfig, setShiftConfig] = useState({
    patterns: [
      { id: 'pat_morning', name: '早番', startTime: '09:00', endTime: '14:00', color: '#FFE4B5' },
      { id: 'pat_evening', name: '遅番', startTime: '14:00', endTime: '20:00', color: '#B5D4F5' },
      { id: 'pat_full',    name: '全日', startTime: '09:00', endTime: '20:00', color: '#C5E8C5' },
    ],
    requiredStaff: {
      mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 2, sun: 2, holiday: 2,
    },
    holidayRule: {
      submitDeadlineDay: 20,    // 毎月20日までに翌月分提出
      maxPriorities: 1,         // 第1希望のみ（増やせば複数希望可）
    },
  });

  // ★ タブをカテゴリ別に整理
  const tabCategories = [
    {
      name: '基本',
      tabs: [
        { id: 'general', label: '基本・ロゴ', icon: SettingsIcon },
        { id: 'shop', label: '店舗・口座・特別日', icon: Store },
        { id: 'staff_order', label: '店舗受付', icon: Clock },
      ],
    },
    {
      name: '商品・配送',
      tabs: [
        { id: 'items', label: '商品・納期', icon: Tag },
        { id: 'shipping', label: '配送・時間枠', icon: Truck },
        { id: 'design', label: 'デザイン選択肢', icon: Palette },
        { id: 'rules', label: '立札デザイン', icon: LayoutTemplate },
      ],
    },
    {
      name: 'スタッフ・シフト',
      tabs: [
        { id: 'status', label: 'ステータス', icon: ListChecks },
        { id: 'staff', label: 'スタッフ', icon: User },
        { id: 'shift', label: 'シフト設定', icon: CalendarDays },
      ],
    },
    {
      name: '通知・連携',
      tabs: [
        { id: 'message', label: '案内文管理', icon: Mail },
        // ★ LINE連携はサブスク機能。未契約のテナントには表示しない
        ...(isLineFeatureEnabled ? [{ id: 'line', label: 'LINE連携', icon: Mail }] : []),
        { id: 'links', label: 'URL発行', icon: LinkIcon },
      ],
    },
    {
      name: '決済',
      tabs: [
        { id: 'payment', label: '決済設定', icon: CreditCard },
      ],
    },
  ];
  // 旧コード互換のため
  const tabs = tabCategories.flatMap(c => c.tabs);

  const applySettings = (s) => {
    if (s.generalConfig) setGeneralConfig(prev => ({...prev, ...s.generalConfig}));
    if (s.paymentConfig) setPaymentConfig(prev => ({...prev, ...s.paymentConfig})); 
    if (s.statusConfig) setStatusConfig(s.statusConfig);
    if (s.designOptions) setDesignOptions(prev => ({...prev, ...s.designOptions}));
    if (s.shops) setShops(s.shops);
    if (s.flowerItems) setFlowerItems(s.flowerItems);
    if (s.staffList) setStaffList(s.staffList);
    if (s.deliveryAreas) setDeliveryAreas(s.deliveryAreas);
    if (s.shippingSizes) setShippingSizes(s.shippingSizes);
    if (s.shippingRates) setShippingRates(s.shippingRates);
    if (s.boxFeeConfig) setBoxFeeConfig(prev => ({...prev, ...s.boxFeeConfig}));
    if (s.staffOrderConfig) setStaffOrderConfig(s.staffOrderConfig);
    if (s.autoReplyTemplates) setAutoReplyTemplates(s.autoReplyTemplates);
    if (s.timeSlots) setTimeSlots(s.timeSlots);
    if (s.lineConfig) setLineConfig(prev => ({...prev, ...s.lineConfig}));
    if (s.staffAuthConfig) setStaffAuthConfig(prev => ({...prev, ...s.staffAuthConfig}));
    if (s.shiftConfig) setShiftConfig(prev => ({...prev, ...s.shiftConfig}));
    if (s.payrollConfig) setPayrollConfig(prev => ({...prev, ...s.payrollConfig}));

    if (s.features && s.features.b2b) setIsB2BEnabled(true);
    setIsLineFeatureEnabled(Boolean(s.features?.lineIntegration));
    // ★ payrollConfig.enabled は features.payroll に強制連動（二重管理を解消）
    setPayrollConfig(prev => ({ ...prev, enabled: Boolean(s.features?.payroll) }));
  };

  useEffect(() => {
    async function loadSettings() {
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

        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', tId).single();
        if (data?.settings_data) {
          applySettings(data.settings_data);
          setGeneralConfig(prev => ({...prev, tenantId: tId}));
        }
      } catch (e) {
        console.error('設定の読み込みに失敗:', e);
      }
    }
    loadSettings();
  }, []);

  const handleLogin = () => {
    const correctPassword = generalConfig.systemPassword || '7777';
    if (adminPassword === correctPassword) setIsAdmin(true);
    else alert('パスワードが違います');
  };

  const saveSettings = async () => {
    if (!isAdmin || !currentTenantId) return;
    setIsSaving(true);
    try {
      const { data: current } = await supabase.from('app_settings').select('settings_data').eq('id', currentTenantId).single();
      const currentData = current?.settings_data || {};

      const payload = { 
        ...currentData, 
        generalConfig: {...generalConfig, tenantId: currentTenantId}, 
        paymentConfig, 
        statusConfig, 
        designOptions,
        shops, flowerItems, staffList, deliveryAreas, shippingSizes, shippingRates, boxFeeConfig, autoReplyTemplates, staffOrderConfig, timeSlots,
        lineConfig,
        staffAuthConfig,
        shiftConfig,
        payrollConfig,
      };
      await supabase.from('app_settings').upsert({ id: currentTenantId, settings_data: payload });
      showToast('success', '設定を保存しました');
      // ★ 操作履歴記録（動的import で循環依存回避）
      import('@/utils/auditLog').then(({ logAction }) => logAction({
        action: 'settings_save', targetType: 'settings', description: '設定を保存',
      })).catch(() => {});
    } catch (e) {
      console.error(e);
      showToast('error', '保存に失敗しました');
    } finally { setIsSaving(false); }
  };

  const handleImg = (e, f) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => setGeneralConfig({ ...generalConfig, [f]: ev.target.result });
    r.readAsDataURL(file);
  };

  // ★ 印影画像アップロード（receiptStamp.imageUrl にbase64 or Storage URL格納）
  const handleStampImg = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('画像サイズは1MB以下にしてください');
      return;
    }
    const r = new FileReader();
    r.onload = (ev) => setGeneralConfig({
      ...generalConfig,
      receiptStamp: { ...(generalConfig.receiptStamp || {}), mode: 'image', imageUrl: ev.target.result }
    });
    r.readAsDataURL(file);
  };

  const handleTimeSlotChange = (method, index, value) => {
    setTimeSlots(prev => {
      const newSlots = { ...prev };
      newSlots[method][index] = value;
      return newSlots;
    });
  };
  const addTimeSlot = (method) => { setTimeSlots(prev => ({ ...prev, [method]: [...prev[method], ''] })); };
  const removeTimeSlot = (method, index) => { setTimeSlots(prev => ({ ...prev, [method]: prev[method].filter((_, i) => i !== index) })); };

  // ★ コピー機能のハンドラー
  const handleCopyTag = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000); // 2秒後に「コピーしました」表示を消す
  };

  const renderGeneralTab = () => (
    <div className="space-y-8 animate-in fade-in">
      <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-8">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Building2 size={20}/> システム基本設定 (アプリ名・ID)</h2>
        <div className="space-y-4">
          <div className="space-y-1 bg-[#F7F7F7] p-5 rounded-2xl border border-[#EAEAEA]">
            <label className="text-[11px] font-bold text-[#2D4B3E] flex items-center gap-2">テナントID (URL用システム連携ID)</label>
            <p className="text-[10px] text-[#999999] mb-2">※法人ページやお客様の注文ページのURLに使用されます。</p>
            <input type="text" value={generalConfig.tenantId || currentTenantId || ''} readOnly className="w-full h-12 bg-white border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none text-gray-500 transition-colors" />
          </div>
          <div className="pt-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#999999]">アプリ名 (ショップ全体名)</label>
              <input type="text" value={generalConfig.appName} onChange={(e)=>setGeneralConfig({...generalConfig, appName: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E] transition-colors" placeholder="花・花OHANA!"/>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-8">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><ImageIcon size={20}/> ロゴ・画像・セキュリティ</h2>
        <div className="space-y-4">
          <label className="text-[11px] font-bold text-[#999999]">ロゴ画像</label>
          {!generalConfig.logoUrl && <input type="file" accept="image/*" onChange={(e)=>handleImg(e, 'logoUrl')} className="block w-full text-xs" />}
          {generalConfig.logoUrl && (
            <div className="p-6 bg-[#FBFAF9] rounded-2xl border space-y-6 relative">
              <button onClick={() => setGeneralConfig({...generalConfig, logoUrl: ''})} className="absolute top-4 right-4 text-red-400 hover:text-red-600 bg-white p-2 rounded-full shadow-sm"><Trash2 size={16}/></button>
              <div className="flex items-center justify-between"><span className="text-[12px] font-bold">表示サイズ: {generalConfig.logoSize}%</span><input type="range" min="30" max="150" value={generalConfig.logoSize} onChange={(e)=>setGeneralConfig({...generalConfig, logoSize: Number(e.target.value)})} className="w-40 accent-[#2D4B3E]"/></div>
              <div className="flex items-center justify-between"><span className="text-[12px] font-bold">白背景を透過</span><button onClick={()=>setGeneralConfig({...generalConfig, logoTransparent: !generalConfig.logoTransparent})} className={`w-12 h-6 rounded-full transition-all ${generalConfig.logoTransparent ? 'bg-[#2D4B3E]' : 'bg-gray-300'}`}><div className={`w-4 h-4 bg-white rounded-full mx-1 transition-all ${generalConfig.logoTransparent ? 'translate-x-6' : ''}`}/></button></div>
              <div className="flex justify-center border-t pt-4 bg-white rounded-xl p-4"><img src={generalConfig.logoUrl} style={{width: `${generalConfig.logoSize}%`, mixBlendMode: generalConfig.logoTransparent ? 'multiply' : 'normal'}} className="max-h-24 object-contain" /></div>
            </div>
          )}
        </div>

        <div className="space-y-4 pt-4 border-t border-[#EAEAEA]">
          <label className="text-[11px] font-bold text-[#999999]">伝票用 背景画像</label>
          {!generalConfig.slipBgUrl && <input type="file" accept="image/*" onChange={(e)=>handleImg(e, 'slipBgUrl')} className="block w-full text-xs" />}
          {generalConfig.slipBgUrl && (
            <div className="p-6 bg-[#FBFAF9] rounded-2xl border space-y-6 relative">
              <button onClick={() => setGeneralConfig({...generalConfig, slipBgUrl: ''})} className="absolute top-4 right-4 text-red-400 hover:text-red-600 bg-white p-2 rounded-full shadow-sm"><Trash2 size={16}/></button>
              <div className="flex items-center justify-between"><span className="text-[12px] font-bold">透過度: {generalConfig.slipBgOpacity}%</span><input type="range" min="0" max="100" value={generalConfig.slipBgOpacity} onChange={(e)=>setGeneralConfig({...generalConfig, slipBgOpacity: Number(e.target.value)})} className="w-40 accent-[#2D4B3E]"/></div>
              <div className="flex justify-center border-t pt-4"><div className="relative w-48 h-32 bg-white border shadow-sm overflow-hidden flex flex-col justify-between p-2"><div className="absolute inset-0 z-0 grayscale-[30%] pointer-events-none" style={{ backgroundImage: `url(${generalConfig.slipBgUrl})`, backgroundSize: 'cover', opacity: generalConfig.slipBgOpacity / 100 }} /><span className="relative z-10 text-[10px] font-bold text-green-700">受 注 書</span></div></div>
            </div>
          )}
        </div>

        {/* ★ 領収書の印影設定 */}
        <div className="space-y-4 pt-6 border-t border-[#EAEAEA]">
          <h3 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2">🧾 領収書の印影</h3>
          <p className="text-[11px] text-[#999] leading-relaxed">
            お客様マイページから発行される領収書PDFの印影を設定します。日本の法律上「印影は必須ではない」ため、印影なしでも有効です。
          </p>

          <div className="space-y-2">
            <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${(generalConfig.receiptStamp?.mode || 'auto') === 'none' ? 'border-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA]'}`}>
              <input type="radio" name="receipt-stamp-mode" value="none"
                checked={(generalConfig.receiptStamp?.mode || 'auto') === 'none'}
                onChange={() => setGeneralConfig({...generalConfig, receiptStamp: {...(generalConfig.receiptStamp || {}), mode: 'none'}})}
                className="mt-1 accent-[#2D4B3E]"/>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-[#111]">A. 印影なし（テキストのみ）</p>
                <p className="text-[11px] text-[#555] mt-1">
                  領収書には印影を表示しません。<br/>
                  💡 <strong>メリット:</strong> 不正利用リスクゼロ・法的にもOK<br/>
                  💡 <strong>デメリット:</strong> 「公式っぽくない」と感じるお客様も
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${(generalConfig.receiptStamp?.mode || 'auto') === 'auto' ? 'border-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA]'}`}>
              <input type="radio" name="receipt-stamp-mode" value="auto"
                checked={(generalConfig.receiptStamp?.mode || 'auto') === 'auto'}
                onChange={() => setGeneralConfig({...generalConfig, receiptStamp: {...(generalConfig.receiptStamp || {}), mode: 'auto'}})}
                className="mt-1 accent-[#2D4B3E]"/>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-[#111]">B. 自動生成印影 <span className="text-[10px] text-[#117768] ml-2">推奨</span></p>
                <p className="text-[11px] text-[#555] mt-1">
                  店舗名から自動生成される赤い丸印を表示します（実印影ではないデザイン）。<br/>
                  💡 <strong>メリット:</strong> 安全（不正コピーされても被害がない）・店舗ごとに自動生成
                </p>
                {/* プレビュー */}
                <div className="mt-3 inline-flex items-center justify-center w-20 h-20 border-2 border-red-600 rounded-full text-red-600 text-[8px] font-bold opacity-60 leading-tight text-center">
                  {generalConfig.appName || 'お花屋さん'}<br/>領収印
                </div>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer ${(generalConfig.receiptStamp?.mode || 'auto') === 'image' ? 'border-[#2D4B3E] bg-[#2D4B3E]/5' : 'border-[#EAEAEA]'}`}>
              <input type="radio" name="receipt-stamp-mode" value="image"
                checked={(generalConfig.receiptStamp?.mode || 'auto') === 'image'}
                onChange={() => setGeneralConfig({...generalConfig, receiptStamp: {...(generalConfig.receiptStamp || {}), mode: 'image'}})}
                className="mt-1 accent-[#2D4B3E]"/>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-[#111]">C. 画像アップロード（実印影）</p>
                <p className="text-[11px] text-[#555] mt-1 leading-relaxed">
                  実際の店舗印を画像（透過PNG推奨）でアップロードして表示します。<br/>
                  💡 <strong>メリット:</strong> 一番リアル<br/>
                  ⚠️ <strong>注意:</strong> 領収書PDFから画像を抜き取って悪用されるリスクがあります（実害は限定的だが、認印の使用を推奨）
                </p>

                {(generalConfig.receiptStamp?.mode || 'auto') === 'image' && (
                  <div className="mt-3 space-y-3 p-3 bg-white rounded-lg border border-[#EAEAEA]">
                    {!generalConfig.receiptStamp?.imageUrl ? (
                      <>
                        <input type="file" accept="image/png,image/jpeg" onChange={handleStampImg} className="block w-full text-[11px]"/>
                        <p className="text-[10px] text-[#999] leading-relaxed">
                          📌 推奨: 透過PNG（背景なし）・正方形・1MB以下<br/>
                          📌 印影以外（背景）が透過されていないと、領収書上で目立つ白枠が出ます
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-4">
                        <img src={generalConfig.receiptStamp.imageUrl} alt="印影" className="w-20 h-20 object-contain border border-[#EAEAEA] rounded"/>
                        <div className="flex-1">
                          <button onClick={() => setGeneralConfig({...generalConfig, receiptStamp: {...generalConfig.receiptStamp, imageUrl: ''}})}
                            className="text-red-500 hover:text-red-700 text-[11px] font-bold flex items-center gap-1">
                            <Trash2 size={12}/> 画像を削除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-[#EAEAEA]">
          <h3 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><ShieldCheck size={16}/> システムセキュリティ</h3>
          <div className="bg-red-50 p-6 rounded-2xl border border-red-100 space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-red-800">管理者パスワード (設定変更・注文削除用)</label>
              <div className="relative w-full max-w-[240px]">
                <input type={showPassword ? "text" : "password"} value={generalConfig.systemPassword || ''} onChange={(e)=>setGeneralConfig({...generalConfig, systemPassword: e.target.value})} className="w-full h-12 bg-white border border-red-200 rounded-xl px-4 font-bold outline-none focus:border-red-400 text-red-700 pr-10"/>
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600">
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {(generalConfig.systemPassword === '7777' || !generalConfig.systemPassword) && (
                <div className="mt-3 bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-[11px] text-amber-900 leading-relaxed">
                  ⚠️ <strong>初期パスワード「7777」のままです。</strong> セキュリティのため、推測されにくいパスワードに変更して「変更を保存」を押してください。
                </div>
              )}
              <p className="text-[10px] text-red-700 mt-2">
                💡 忘れた場合は管理者（NocoLde）に連絡すれば、登録メアド宛に再発行メールを送ります。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatusTab = () => {
    // 花の種類リスト（flowerItems から取得 + 未登録対応）
    const flowerTypes = (flowerItems || []).map(i => typeof i === 'string' ? i : i.name).filter(Boolean);

    return (
      <div className="space-y-6 animate-in fade-in">
        {/* ① オーダー商品共通ステータス（既存） */}
        <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-4">
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><ListChecks size={20}/> オーダー商品 共通ステータス</h2>
          <p className="text-[11px] text-[#999]">花の種類別に個別設定がない場合、こちらが適用されます。</p>
          <div className="flex gap-2 p-1 bg-[#F7F7F7] rounded-xl mb-4">
            {['template', 'custom'].map(t => (
              <button key={t} onClick={() => setStatusConfig({...statusConfig, type: t})} className={`flex-1 py-3 rounded-lg font-bold text-[12px] ${statusConfig.type === t ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>{t === 'template' ? '標準' : 'カスタム'}</button>
            ))}
          </div>
          <div className="space-y-3">
            {(statusConfig.type === 'template' ? ['受注', '制作', '配達', '片付', '請求'] : statusConfig.customLabels).map((l, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={l} readOnly={statusConfig.type==='template'} onChange={(e) => { if(statusConfig.type==='custom'){ const n = [...statusConfig.customLabels]; n[i] = e.target.value; setStatusConfig({...statusConfig, customLabels: n}); } }} className={`flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none ${statusConfig.type==='template'?'text-[#999999] cursor-not-allowed':'focus:border-[#2D4B3E]'}`} />
                {statusConfig.type === 'custom' && <button onClick={() => setStatusConfig({...statusConfig, customLabels: statusConfig.customLabels.filter((_, idx) => idx !== i)})} className="text-red-300 p-2 hover:text-red-500"><Trash2 size={18}/></button>}
              </div>
            ))}
            {statusConfig.type === 'custom' && <button onClick={() => setStatusConfig({...statusConfig, customLabels: [...statusConfig.customLabels, '新状態']})} className="w-full py-3 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 項目を追加</button>}
          </div>
        </div>

        {/* ② 花の種類別 個別ステータス */}
        <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-4">
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2">🌷 花の種類別 個別ステータス</h2>
          <p className="text-[11px] text-[#999] leading-relaxed">
            花の種類ごとに専用ステータスを定義できます。<br/>
            設定しない種類は共通ステータスが使われます。
          </p>
          {flowerTypes.length === 0 ? (
            <p className="text-[12px] text-[#999] italic bg-[#FBFAF9] p-4 rounded-xl">商品・納期タブで花の種類を登録すると、ここに表示されます。</p>
          ) : (
            <div className="space-y-4">
              {flowerTypes.map((ft) => {
                const labels = statusConfig.orderTypeLabels?.[ft] || [];
                const isEnabled = labels.length > 0;
                return (
                  <div key={ft} className="border border-[#EAEAEA] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[13px] font-bold text-[#111]">{ft}</h3>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            const next = { ...(statusConfig.orderTypeLabels || {}) };
                            if (e.target.checked) {
                              next[ft] = ['受注', '制作中', '完了'];
                            } else {
                              delete next[ft];
                            }
                            setStatusConfig({...statusConfig, orderTypeLabels: next});
                          }}
                          className="w-4 h-4 accent-[#2D4B3E]"
                        />
                        <span className="text-[11px] font-bold text-[#555]">個別設定を使う</span>
                      </label>
                    </div>
                    {isEnabled && (
                      <div className="space-y-2">
                        {labels.map((l, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="text"
                              value={l}
                              onChange={(e) => {
                                const newLabels = [...labels];
                                newLabels[i] = e.target.value;
                                setStatusConfig({...statusConfig, orderTypeLabels: {...statusConfig.orderTypeLabels, [ft]: newLabels}});
                              }}
                              className="flex-1 h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg px-3 text-[12px] font-bold outline-none focus:border-[#2D4B3E]"
                            />
                            <button onClick={() => {
                              const newLabels = labels.filter((_, idx) => idx !== i);
                              setStatusConfig({...statusConfig, orderTypeLabels: {...statusConfig.orderTypeLabels, [ft]: newLabels}});
                            }} className="text-red-300 p-2 hover:text-red-500"><Trash2 size={14}/></button>
                          </div>
                        ))}
                        <button onClick={() => {
                          setStatusConfig({...statusConfig, orderTypeLabels: {...statusConfig.orderTypeLabels, [ft]: [...labels, '新状態']}});
                        }} className="w-full py-2 border border-dashed border-[#EAEAEA] rounded-lg text-[11px] font-bold text-[#999] hover:text-[#2D4B3E]">+ 項目を追加</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ③ EC共通ステータス */}
        <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-4">
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2">🛒 EC商品 共通ステータス</h2>
          <p className="text-[11px] text-[#999]">EC（完成品販売）のステータス。EC商品はすべてこの共通ステータスが適用されます。</p>
          <div className="space-y-2">
            {(statusConfig.ecLabels || []).map((l, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={l}
                  onChange={(e) => {
                    const next = [...statusConfig.ecLabels];
                    next[i] = e.target.value;
                    setStatusConfig({...statusConfig, ecLabels: next});
                  }}
                  className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"
                />
                <button onClick={() => setStatusConfig({...statusConfig, ecLabels: statusConfig.ecLabels.filter((_, idx) => idx !== i)})} className="text-red-300 p-2 hover:text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
            <button onClick={() => setStatusConfig({...statusConfig, ecLabels: [...(statusConfig.ecLabels || []), '新状態']})} className="w-full py-3 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ EC項目を追加</button>
          </div>
        </div>

        {/* ④ 配達管理ステータス */}
        <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-4">
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2">🚚 配達管理 ステータス</h2>
          <p className="text-[11px] text-[#999]">配達画面で使用するステータス。配達中・配達完了・不在など、配達状況を管理する用です。</p>
          <div className="space-y-2">
            {(statusConfig.deliveryLabels || []).map((l, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={l}
                  onChange={(e) => {
                    const next = [...statusConfig.deliveryLabels];
                    next[i] = e.target.value;
                    setStatusConfig({...statusConfig, deliveryLabels: next});
                  }}
                  className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"
                />
                <button onClick={() => setStatusConfig({...statusConfig, deliveryLabels: statusConfig.deliveryLabels.filter((_, idx) => idx !== i)})} className="text-red-300 p-2 hover:text-red-500"><Trash2 size={18}/></button>
              </div>
            ))}
            <button onClick={() => setStatusConfig({...statusConfig, deliveryLabels: [...(statusConfig.deliveryLabels || []), '新状態']})} className="w-full py-3 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 配達項目を追加</button>
          </div>
        </div>
      </div>
    );
  };

  const renderDesignTab = () => (
    <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-8 animate-in fade-in">
      <div className="border-b pb-4">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Palette size={20}/> デザイン選択肢の設定</h2>
        <p className="text-[11px] text-[#999999] mt-2">注文フォームでお客様が選択する「用途」「カラー」「イメージ」の選択肢を自由にカスタマイズできます。「その他」は自動で追加されます。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-3">
          <label className="text-[14px] font-bold text-[#2D4B3E] bg-[#FBFAF9] px-4 py-2 rounded-lg inline-block border">ご用途</label>
          <div className="space-y-2">
            {designOptions.purposes.map((p, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={p} onChange={(e) => { const n = [...designOptions.purposes]; n[i] = e.target.value; setDesignOptions({...designOptions, purposes: n}); }} className="flex-1 h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-3 text-[12px] font-bold outline-none focus:border-[#2D4B3E]" />
                <button onClick={() => setDesignOptions({...designOptions, purposes: designOptions.purposes.filter((_, idx) => idx !== i)})} className="text-red-300 p-1.5 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
            ))}
            <button onClick={() => setDesignOptions({...designOptions, purposes: [...designOptions.purposes, '新しい用途']})} className="w-full py-2 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 追加</button>
          </div>
        </div>

        <div className="space-y-3 border-t md:border-t-0 md:border-l border-[#EAEAEA] md:pl-6">
          <label className="text-[14px] font-bold text-[#2D4B3E] bg-[#FBFAF9] px-4 py-2 rounded-lg inline-block border">カラー</label>
          <div className="space-y-2">
            {designOptions.colors.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={c} onChange={(e) => { const n = [...designOptions.colors]; n[i] = e.target.value; setDesignOptions({...designOptions, colors: n}); }} className="flex-1 h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-3 text-[12px] font-bold outline-none focus:border-[#2D4B3E]" />
                <button onClick={() => setDesignOptions({...designOptions, colors: designOptions.colors.filter((_, idx) => idx !== i)})} className="text-red-300 p-1.5 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
            ))}
            <button onClick={() => setDesignOptions({...designOptions, colors: [...designOptions.colors, '新しいカラー']})} className="w-full py-2 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 追加</button>
          </div>
        </div>

        <div className="space-y-3 border-t md:border-t-0 md:border-l border-[#EAEAEA] md:pl-6">
          <label className="text-[14px] font-bold text-[#2D4B3E] bg-[#FBFAF9] px-4 py-2 rounded-lg inline-block border">イメージ</label>
          <div className="space-y-2">
            {designOptions.vibes.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input type="text" value={v} onChange={(e) => { const n = [...designOptions.vibes]; n[i] = e.target.value; setDesignOptions({...designOptions, vibes: n}); }} className="flex-1 h-10 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-3 text-[12px] font-bold outline-none focus:border-[#2D4B3E]" />
                <button onClick={() => setDesignOptions({...designOptions, vibes: designOptions.vibes.filter((_, idx) => idx !== i)})} className="text-red-300 p-1.5 hover:text-red-500"><Trash2 size={16}/></button>
              </div>
            ))}
            <button onClick={() => setDesignOptions({...designOptions, vibes: [...designOptions.vibes, '新しいイメージ']})} className="w-full py-2 border-2 border-dashed border-[#EAEAEA] rounded-xl text-[11px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 追加</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSpecialHoursList = (shop, listKey) => (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
      {(shop[listKey] || []).map(sh => (
        <div key={sh.id} className="flex flex-col gap-2 bg-[#FBFAF9] p-3 rounded-xl border border-[#EAEAEA] text-[11px] relative">
          <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].filter(h=>h.id!==sh.id)}:s))} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><X size={14}/></button>
          <div className="flex gap-2 pr-6">
            <select value={sh.repeatType || '今年のみ'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, repeatType:e.target.value}:h)}:s))} className="border rounded p-1.5 outline-none font-bold bg-white">
              <option value="今年のみ">単日</option><option value="毎週">毎週</option><option value="毎月">毎月</option><option value="毎年">毎年</option><option value="祝日">祝日</option>
            </select>
            {sh.repeatType !== '祝日' && (
              <div className="flex-1">
                {sh.repeatType === '毎週' ? (
                  <select value={sh.date} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, date:e.target.value}:h)}:s))} className="w-full border rounded p-1.5 outline-none bg-white">
                    <option value="">曜日を選択</option><option value="日">日曜日</option><option value="月">月曜日</option><option value="火">火曜日</option><option value="水">水曜日</option><option value="木">木曜日</option><option value="金">金曜日</option><option value="土">土曜日</option>
                  </select>
                ) : sh.repeatType === '毎月' ? (
                  <select value={sh.date} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, date:e.target.value}:h)}:s))} className="w-full border rounded p-1.5 outline-none bg-white">
                    <option value="">日付を選択</option>{[...Array(31)].map((_, i) => <option key={i} value={`${i+1}日`}>{i+1}日</option>)}
                  </select>
                ) : <input type={sh.repeatType==='毎年' ? 'text' : 'date'} placeholder="MM-DD" value={sh.date} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, date:e.target.value}:h)}:s))} className="w-full border rounded p-1.5 outline-none bg-white"/>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <select value={sh.type || 'closed'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, type:e.target.value}:h)}:s))} className={`border rounded p-1.5 outline-none font-bold ${sh.type === 'closed' ? 'bg-red-50 text-red-600' : sh.type === 'changed' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
              <option value="closed">休業</option><option value="changed">時間変更</option><option value="open">特別営業</option>
            </select>
            <input type="text" placeholder="理由メモ" value={sh.note || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, note:e.target.value}:h)}:s))} className="flex-1 border rounded p-1.5 outline-none bg-white"/>
          </div>
          {sh.type === 'changed' && (
            <div className="flex gap-2 items-center bg-white p-2 rounded border border-orange-200 mt-1 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-orange-600">変更後:</span>
              <input type="time" value={sh.changedOpenTime || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, changedOpenTime:e.target.value}:h)}:s))} className="border rounded p-1 text-[10px] outline-none"/>
              <span>〜</span>
              <input type="time" value={sh.changedCloseTime || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, [listKey]:s[listKey].map(h=>h.id===sh.id?{...h, changedCloseTime:e.target.value}:h)}:s))} className="border rounded p-1 text-[10px] outline-none"/>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // ★ 決済設定タブ（Stripe Connect）
  const renderPaymentTab = () => <PaymentTab />;

  const renderShopTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {shops.map(shop => (
        <div key={shop.id} className="bg-white rounded-2xl border p-8 shadow-sm relative space-y-8 text-left">
          <button onClick={()=>setShops(shops.filter(s=>s.id!==shop.id))} className="absolute top-6 right-6 p-2 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
          
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={shop.isActive} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, isActive:e.target.checked}:s))} className="w-6 h-6 accent-[#2D4B3E]"/>
            <h2 className="text-[18px] font-bold text-[#2D4B3E]">{shop.name || '店舗設定'}</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">店舗名</label><input type="text" value={shop.name} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, name:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">電話番号</label><input type="text" value={shop.phone} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, phone:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">郵便番号</label><input type="text" value={shop.zip} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, zip:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="000-0000"/></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">住所</label><input type="text" value={shop.address} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, address:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
            <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-[#999999]">インボイス番号</label><input type="text" value={shop.invoiceNumber || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, invoiceNumber:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="T12345..."/></div>
          </div>
          
          <div className="space-y-4 pt-6 border-t border-[#EAEAEA]">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><CreditCard size={16}/> 振込先口座情報 (法人請求書等用)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">銀行名</label><input type="text" value={shop.bankName || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, bankName:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="〇〇銀行"/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">支店名</label><input type="text" value={shop.branchName || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, branchName:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="〇〇支店"/></div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#999999]">口座種別</label>
                <select value={shop.accountType || '普通'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, accountType:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]">
                  <option value="普通">普通</option><option value="当座">当座</option><option value="貯蓄">貯蓄</option>
                </select>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">口座番号</label><input type="text" value={shop.accountNumber || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, accountNumber:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-mono outline-none focus:border-[#2D4B3E]" placeholder="1234567"/></div>
              <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-bold text-[#999999]">口座名義 (カナ等)</label><input type="text" value={shop.accountName || ''} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, accountName:e.target.value}:s))} className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="カ）ハナハナオハナ"/></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-[#FBFAF9]">
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={14}/> 店舗(ご来店) 営業時間・特別日</label>
              <div className="flex gap-2 bg-[#FBFAF9] p-3 rounded-xl border mb-2">
                <input type="time" value={shop.openTime || '10:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, openTime:e.target.value}:s))} className="border rounded p-1 text-xs outline-none bg-white"/>
                <span>〜</span>
                <input type="time" value={shop.closeTime || '19:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, closeTime:e.target.value}:s))} className="border rounded p-1 text-xs outline-none bg-white"/>
              </div>
              {renderSpecialHoursList(shop, 'specialHours')}
              <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, specialHours:[...(s.specialHours||[]), {id:Date.now(), date:'', type:'closed', repeatType:'今年のみ', note:''}]}:s))} className="w-full py-2 bg-[#FBFAF9] border-dashed border border-[#EAEAEA] rounded-xl text-[10px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-all">+ 特別ルールを追加</button>
            </div>
            
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#D97D54] flex items-center gap-2"><Truck size={14}/> 配達可能時間・特別日</label>
              <div className="flex gap-2 bg-[#D97D54]/5 p-3 rounded-xl border border-[#D97D54]/20 mb-2">
                <input type="time" value={shop.deliveryOpenTime || '11:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryOpenTime:e.target.value}:s))} className="border border-[#D97D54]/30 rounded p-1 text-xs outline-none bg-white"/>
                <span>〜</span>
                <input type="time" value={shop.deliveryCloseTime || '18:00'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryCloseTime:e.target.value}:s))} className="border border-[#D97D54]/30 rounded p-1 text-xs outline-none bg-white"/>
              </div>
              {renderSpecialHoursList(shop, 'deliverySpecialHours')}
              <button onClick={()=>setShops(shops.map(s=>s.id===shop.id?{...s, deliverySpecialHours:[...(s.deliverySpecialHours||[]), {id:Date.now(), date:'', type:'closed', repeatType:'今年のみ', note:''}]}:s))} className="w-full py-2 bg-[#D97D54]/5 border-dashed border border-[#D97D54]/30 rounded-xl text-[10px] font-bold text-[#D97D54]/80 hover:text-[#D97D54] transition-all">+ 配達特別ルールを追加</button>
            </div>
          </div>

          <div className="pt-6 border-t border-[#FBFAF9] space-y-4">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><AlertCircle size={16}/> 注意書き・ご案内テキスト設定 <HelpTooltip articleId="mail_not_sent"/></h3>
            <p className="text-[10px] text-[#999999]">お客様のオーダー画面で表示される、各受取方法ごとの注意書きを店舗別に設定できます。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#999999]">店頭受取のご案内</label>
                <textarea value={shop.pickupNote ?? 'ご来店予定日時に店舗までお越しください。'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, pickupNote:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-3 text-[12px] outline-none resize-none focus:border-[#2D4B3E]"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#999999]">自社配達のご案内</label>
                <textarea value={shop.deliveryNote ?? '交通状況により配達時間が前後する場合がございます。'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, deliveryNote:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-3 text-[12px] outline-none resize-none focus:border-[#2D4B3E]"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#999999]">業者配送のご案内</label>
                <textarea value={shop.shippingNote ?? '発送準備期間＋配送日数がかかります。交通状況により遅延する場合がございます。'} onChange={(e)=>setShops(shops.map(s=>s.id===shop.id?{...s, shippingNote:e.target.value}:s))} className="w-full h-24 bg-[#FBFAF9] border rounded-xl p-3 text-[12px] outline-none resize-none focus:border-[#2D4B3E]"/>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button 
        onClick={()=>setShops([...shops, {
          id:Date.now(), name:'', isActive:true, openTime:'10:00', closeTime:'19:00', deliveryOpenTime:'11:00', deliveryCloseTime:'18:00', 
          specialHours:[], deliverySpecialHours:[], enabledTatePatterns: ['p5', 'p7'],
          bankName: '', branchName: '', accountType: '普通', accountNumber: '', accountName: '',
          pickupNote: 'ご来店予定日時に店舗までお越しください。', deliveryNote: '交通状況により配達時間が前後する場合がございます。', shippingNote: '発送準備期間＋配送日数がかかります。交通状況により遅延する場合がございます。',
        }])}
        className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-2xl text-[#999999] font-bold transition-all hover:border-[#2D4B3E] shadow-sm"
      >
        + 店舗を新規追加
      </button>
    </div>
  );

  const renderItemsTab = () => (
    <div className="space-y-8 animate-in fade-in">
      {flowerItems.map(item => {
        const isAllShops = item.targetShops === 'all' || item.targetShops === undefined;

        return (
          <div key={item.id} className="bg-white rounded-2xl border p-8 shadow-sm relative space-y-6 text-left">
            <button onClick={()=>setFlowerItems(flowerItems.filter(i=>i.id!==item.id))} className="absolute top-6 right-6 p-2 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-10 md:pr-14 pt-2">
              <input type="text" value={item.name} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, name:e.target.value}:i))} className="w-full h-12 bg-transparent border-b-2 text-[20px] font-bold outline-none focus:border-[#2D4B3E] transition-all" placeholder="商品名" />
              <div className="flex items-center gap-2 justify-start md:justify-end">
                <span className="text-[11px] font-bold text-[#999999]">配送サイズ (箱):</span>
                <select value={item.defaultBoxSize || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, defaultBoxSize:e.target.value}:i))} className="h-10 bg-[#FBFAF9] border rounded-xl px-3 font-bold text-[13px] outline-none focus:border-[#2D4B3E]">
                  <option value="">未設定</option>
                  {shippingSizes.map(s => <option key={s} value={s}>{s}サイズ</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 mt-2">
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">最低注文料金 (税抜)</label><input type="number" value={item.minPrice || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, minPrice:Number(e.target.value)}:i))} className="w-full h-10 bg-[#FBFAF9] border rounded-xl px-3 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="例: 3000"/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">最大注文料金 (税抜)</label><input type="number" value={item.maxPrice || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, maxPrice:Number(e.target.value)}:i))} className="w-full h-10 bg-[#FBFAF9] border rounded-xl px-3 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="例: 50000"/></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">金額の刻み幅</label><input type="number" value={item.stepPrice || ''} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, stepPrice:Number(e.target.value)}:i))} className="w-full h-10 bg-[#FBFAF9] border rounded-xl px-3 text-[13px] font-bold outline-none focus:border-[#2D4B3E]" placeholder="例: 1000"/></div>
            </div>

            <div className="pt-4 pb-2 border-t border-[#FBFAF9] mt-2">
              <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between mb-3">
                <p className="text-[12px] font-bold text-[#2D4B3E] flex items-center gap-2"><MapPin size={16}/> 取扱店舗</p>
                <div className="flex gap-2 p-1 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA] w-fit">
                  <button onClick={() => setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, targetShops: 'all'}:i))} className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${isAllShops ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>全店舗</button>
                  <button onClick={() => setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, targetShops: Array.isArray(i.targetShops) ? i.targetShops : []}:i))} className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${!isAllShops ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999]'}`}>指定店舗のみ</button>
                </div>
              </div>
              {!isAllShops && (
                <div className="flex flex-wrap gap-3 mt-2 p-4 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] animate-in slide-in-from-top-2">
                  {shops.length === 0 ? <p className="text-[11px] text-[#999999]">店舗が登録されていません</p> : shops.map(shop => {
                    const isChecked = Array.isArray(item.targetShops) && item.targetShops.includes(shop.id);
                    return (
                      <label key={shop.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-white border-[#2D4B3E]/30 text-[#2D4B3E] shadow-sm' : 'bg-transparent border-transparent text-[#999999] hover:bg-white'}`}>
                        <input type="checkbox" checked={isChecked} onChange={(e)=>{const current = Array.isArray(item.targetShops) ? item.targetShops : []; const next = e.target.checked ? [...current, shop.id] : current.filter(id => id !== shop.id); setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, targetShops: next}:i));}} className="accent-[#2D4B3E] w-3.5 h-3.5"/>
                        <span className="text-[11px] font-bold">{shop.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 pb-2 border-t border-[#FBFAF9]">
              <p className="text-[12px] font-bold text-[#2D4B3E] mb-3 flex items-center gap-2"><Store size={16}/> 対応可能な受取方法</p>
              <div className="flex flex-wrap gap-3">
                {['canPickup', 'canDelivery', 'canShipping'].map(key => (
                  <label key={key} className={`flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-all ${item[key] !== false ? 'bg-[#FBFAF9] border-[#2D4B3E]/30 text-[#2D4B3E]' : 'bg-white border-[#EAEAEA] text-[#999999]'}`}>
                    <input type="checkbox" checked={item[key] !== false} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key]:e.target.checked}:i))} className="accent-[#2D4B3E] w-4 h-4"/>
                    <span className="text-[12px] font-bold">{key==='canPickup'?'店頭受取':key==='canDelivery'?'自社配達':'業者配送'}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-[#FBFAF9] pt-6">
              <div className="space-y-4">
                <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={16}/> 納期設定</p>
                <div className="space-y-2"><label className="text-[9px] font-bold text-[#999999]">通常納期 (日後)</label><input type="number" value={item.normalLeadDays} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, normalLeadDays:Number(e.target.value)}:i))} className="w-full bg-[#FBFAF9] border rounded-lg h-10 px-3 font-bold outline-none focus:border-[#2D4B3E]"/></div>
                <div className="space-y-2"><label className="text-[9px] font-bold text-[#999999]">業者配送 発送準備(日)</label><input type="number" value={item.shippingLeadDays} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, shippingLeadDays:Number(e.target.value)}:i))} className="w-full bg-[#FBFAF9] border rounded-lg h-10 px-3 font-bold outline-none focus:border-[#2D4B3E]"/></div>

                {/* ★ 要件⑤: お急ぎ電話案内のON/OFF（デフォルトON） */}
                <div className="bg-[#FBFAF9] p-3 rounded-xl border space-y-1">
                  <label className="flex items-center justify-between text-[11px] font-bold cursor-pointer">
                    お急ぎ電話案内を表示
                    <input
                      type="checkbox"
                      checked={item.showRushCallNotice !== false}
                      onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, showRushCallNotice:e.target.checked}:i))}
                      className="accent-[#2D4B3E] w-4 h-4"
                    />
                  </label>
                  <p className="text-[9px] text-[#999999] leading-tight">納期より早くご希望の場合に「店舗へ直接お電話ください」と注文画面に表示します。</p>
                </div>
              </div>
              <div className="space-y-4 px-4 border-l border-r border-[#FBFAF9]">
                <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><ShieldCheck size={16}/> 持込設定</p>
                {['canBringFlowers', 'canBringVase'].map(key => (
                  <div key={key} className="bg-[#FBFAF9] p-3 rounded-xl border space-y-2">
                    <label className="flex items-center justify-between text-[12px] font-bold">{key==='canBringFlowers'?'花材持込':'花器持込'}<input type="checkbox" checked={item[key]} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key]:e.target.checked}:i))} className="accent-[#2D4B3E] w-4 h-4"/></label>
                    {item[key] && <div className="flex items-center justify-between text-[10px] font-bold text-[#555555]"><span>持込時納期</span><div className="flex items-center gap-1"><input type="number" value={item[key+'LeadDays']||7} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, [key+'LeadDays']:Number(e.target.value)}:i))} className="w-10 border rounded text-center h-8 font-bold"/>日後</div></div>}
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                <p className="text-[13px] font-bold text-[#2D4B3E] flex items-center gap-2"><RotateCcw size={16}/> 器の回収/返却</p>
                <div className="bg-[#FBFAF9] p-3 rounded-xl border space-y-3">
                  <label className="flex items-center justify-between text-[12px] font-bold cursor-pointer">器の回収を必要とする<input type="checkbox" checked={item.hasReturn} onChange={(e)=>setFlowerItems(flowerItems.map(i=>i.id===item.id?{...i, hasReturn:e.target.checked}:i))} className="accent-[#2D4B3E] w-5 h-5"/></label>
                  <p className="text-[9px] text-[#999999] leading-tight font-bold">※注文時に「器返却あり」の送料計算を自動で有効化します。</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={()=>setFlowerItems([...flowerItems, {id:Date.now(), name:'', targetShops: 'all', normalLeadDays:2, shippingLeadDays:3, canBringFlowers:false, hasReturn:false, canPickup:true, canDelivery:true, canShipping:true, minPrice:3000, maxPrice:50000, stepPrice:1000}])} className="w-full py-10 border-2 border-dashed border-[#EAEAEA] rounded-2xl text-[#999999] font-bold transition-all hover:border-[#2D4B3E]">+ 商品を追加</button>
    </div>
  );

  const renderShippingTab = () => (
    <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-10 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] border-b pb-4 flex items-center gap-2"><Truck size={20}/> 配送・送料・時間枠</h2>
      <section className="space-y-6">
        <label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={16}/> 受取・配達の時間枠</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['pickup', 'delivery', 'shipping'].map(method => (
            <div key={method} className={`p-4 rounded-2xl border ${method==='pickup'?'bg-orange-50/50 border-orange-200':method==='delivery'?'bg-blue-50/50 border-blue-200':'bg-green-50/50 border-green-200'}`}>
              <h3 className={`text-[13px] font-bold mb-3 flex items-center gap-1 ${method==='pickup'?'text-orange-800':method==='delivery'?'text-blue-800':'text-green-800'}`}>{method==='pickup' ? <Store size={14}/> : method==='delivery' ? <Truck size={14}/> : <Package size={14}/>}{method==='pickup' ? '店頭受取' : method==='delivery' ? '自社配達' : '業者配送'}</h3>
              <div className="space-y-2">
                {timeSlots[method].map((slot, i) => (
                  <div key={i} className="flex gap-2">
                    <input type="text" value={slot} onChange={(e) => handleTimeSlotChange(method, i, e.target.value)} className={`flex-1 px-3 py-1.5 rounded-lg border bg-white text-[13px] font-bold outline-none focus:border-[#2D4B3E] ${method==='pickup'?'border-orange-200':method==='delivery'?'border-blue-200':'border-green-200'}`} />
                    <button onClick={() => removeTimeSlot(method, i)} className="text-red-300 p-1.5 hover:text-red-500 transition-colors"><X size={14}/></button>
                  </div>
                ))}
                <button onClick={() => addTimeSlot(method)} className={`text-[11px] font-bold flex items-center gap-1 mt-2 transition-colors ${method==='pickup'?'text-orange-600 hover:text-orange-800':method==='delivery'?'text-blue-600 hover:text-blue-800':'text-green-600 hover:text-green-800'}`}><Plus size={14}/> 枠を追加</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="space-y-4 pt-6 border-t border-[#EAEAEA]">
        <label className="text-[14px] font-bold text-[#2D4B3E]">自社配達エリアと料金</label>
        <div className="space-y-2">
          {deliveryAreas.map(a => (
            <div key={a.id} className="flex gap-2 bg-[#FBFAF9] p-2 rounded-xl border border-[#EAEAEA]">
              <input type="text" value={a.name} onChange={(e)=>setDeliveryAreas(deliveryAreas.map(x=>x.id===a.id?{...x, name:e.target.value}:x))} className="flex-[2] h-10 bg-white border rounded-xl px-3 text-[13px] font-bold focus:border-[#2D4B3E] outline-none" placeholder="判定用キーワード (例: 中央区, 北区)"/>
              <div className="flex-1 flex items-center gap-1 bg-white border rounded-xl px-3 h-10"><span className="text-[10px] text-[#999999] font-bold">¥</span><input type="number" value={a.fee} onChange={(e)=>setDeliveryAreas(deliveryAreas.map(x=>x.id===a.id?{...x, fee:Number(e.target.value)}:x))} className="w-full bg-transparent text-right font-bold text-[13px] outline-none"/></div>
              <button onClick={()=>setDeliveryAreas(deliveryAreas.filter(x=>x.id!==a.id))} className="text-red-300 px-2 hover:text-red-500"><Trash2 size={16}/></button>
            </div>
          ))}
          <button onClick={()=>setDeliveryAreas([...deliveryAreas, {id:Date.now(), name:'', fee:0}])} className="py-3 border border-dashed rounded-xl text-[11px] font-bold text-[#999999] hover:text-[#2D4B3E] w-full transition-all">+ 配達エリアを追加</button>
        </div>
      </div>
      <div className="pt-6 space-y-4 border-t border-[#EAEAEA]">
        <label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Box size={16}/> 梱包（箱代）の計算ロジック</label>
        <div className="flex gap-2 bg-[#FBFAF9] p-1 rounded-xl w-fit">{[{id:'flat',l:'一律'},{id:'price_based',l:'商品代ベース'}].map(t=>(<button key={t.id} onClick={()=>setBoxFeeConfig({...boxFeeConfig, type:t.id})} className={`px-4 py-2 rounded-lg text-xs font-bold ${boxFeeConfig.type===t.id?'bg-white shadow text-[#2D4B3E]':'text-[#999999]'}`}>{t.l}</button>))}</div>

        {/* ★ 自社配達時の箱代加算オプション */}
        <div className="bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA] space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(boxFeeConfig.applyToDelivery)}
              onChange={(e) => setBoxFeeConfig({...boxFeeConfig, applyToDelivery: e.target.checked})}
              className="mt-1 w-4 h-4 accent-[#2D4B3E]"
            />
            <div>
              <p className="text-[12px] font-bold text-[#111]">自社配達時も箱代を加算する</p>
              <p className="text-[10px] text-[#555] mt-1 leading-relaxed">
                通常、箱代は<strong>業者配送（佐川等）の時のみ</strong>加算されます。<br/>
                自社で配達する場合も箱代を取りたい場合は ON にしてください。
              </p>
            </div>
          </label>
        </div>

        {/* ★ EC専用 箱サイズ別 箱代マスター（業者配送のサイズマスタと連動） */}
        <div className="bg-orange-50 p-5 rounded-xl border-2 border-orange-200 space-y-3">
          <h3 className="text-[13px] font-bold text-orange-900 flex items-center gap-2">🛒 EC専用 箱サイズ別 箱代</h3>
          <p className="text-[10px] text-orange-800 leading-relaxed">
            EC商品の梱包代。商品登録時に選んだ箱サイズに応じて加算されます（カート内の最大サイズで計算）。<br/>
            <strong>業者配送のサイズマスタ（下の「業者配送 サイズ・地域マスタ」のサイズ）と連動します</strong>。サイズを追加・削除すると自動で反映されます。
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {shippingSizes.length === 0 ? (
              <p className="col-span-full text-[11px] text-orange-700 italic">下の「業者配送 サイズ・地域マスタ」でサイズを登録してください。</p>
            ) : (
              shippingSizes.map(size => (
                <div key={size} className="bg-white border border-orange-200 rounded-lg p-3 space-y-2">
                  <label className="text-[11px] font-bold text-orange-900 block">{size} サイズ</label>
                  <div className="flex items-center gap-1.5 bg-[#FBFAF9] border border-orange-300 rounded-md px-2 h-10 focus-within:border-orange-500 focus-within:bg-white transition-colors">
                    <span className="text-[13px] font-bold text-orange-700">¥</span>
                    <input
                      type="number"
                      value={boxFeeConfig.ecBoxFees?.[size] ?? 0}
                      onChange={e => setBoxFeeConfig({
                        ...boxFeeConfig,
                        ecBoxFees: { ...(boxFeeConfig.ecBoxFees || {}), [size]: Number(e.target.value) }
                      })}
                      className="flex-1 bg-transparent text-[14px] font-bold text-right outline-none border-0 min-w-0"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {boxFeeConfig.type === 'flat' ? (
          <div className="flex items-center gap-2 bg-[#FBFAF9] p-4 rounded-xl border w-fit"><span className="text-[12px] font-bold">一律加算:</span><input type="number" value={boxFeeConfig.flatFee} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, flatFee:Number(e.target.value)})} className="w-20 h-8 rounded border px-2 text-right font-bold focus:border-[#2D4B3E] outline-none"/>円</div>
        ) : (
          <div className="space-y-2 bg-[#FBFAF9] p-4 rounded-xl border">
            {boxFeeConfig.priceTiers.map((tier, i) => (<div key={i} className="flex items-center gap-2 text-[12px] font-bold"><input type="number" value={tier.minPrice} onChange={(e)=>{const n=[...boxFeeConfig.priceTiers];n[i].minPrice=Number(e.target.value);setBoxFeeConfig({...boxFeeConfig,priceTiers:n})}} className="w-24 h-8 rounded border px-2 focus:border-[#2D4B3E] outline-none"/>円以上なら 箱代<input type="number" value={tier.fee} onChange={(e)=>{const n=[...boxFeeConfig.priceTiers];n[i].fee=Number(e.target.value);setBoxFeeConfig({...boxFeeConfig,priceTiers:n})}} className="w-20 h-8 rounded border px-2 text-right focus:border-[#2D4B3E] outline-none"/>円</div>))}
            <button onClick={()=>setBoxFeeConfig({...boxFeeConfig, priceTiers:[...boxFeeConfig.priceTiers, {minPrice:0,fee:0}]})} className="text-[10px] text-[#2D4B3E] font-bold">+ 条件追加</button>
          </div>
        )}
      </div>
      <div className="space-y-4 border-t border-[#EAEAEA] pt-8">
        <div className="flex justify-between items-center"><label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><CalendarIcon size={16}/> クール便 適用期間設定</label><button onClick={()=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: [...boxFeeConfig.coolBinPeriods, {id:Date.now(), start:'06-01', end:'09-30', note:''}]})} className="text-[10px] bg-[#2D4B3E] text-white px-3 py-1.5 rounded-full font-bold shadow-sm transition-all hover:bg-[#1f352b]">+ 期間を追加</button></div>
        <div className="grid grid-cols-1 gap-3">
          {boxFeeConfig.coolBinPeriods.map(p => (
            <div key={p.id} className="flex flex-wrap gap-2 items-center bg-[#FBFAF9] p-3 rounded-2xl border border-[#EAEAEA] shadow-sm"><input type="text" value={p.start} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, start:e.target.value}:x)})} className="w-16 h-9 border rounded-lg text-center text-[11px] font-bold outline-none focus:border-[#2D4B3E]"/><span className="text-[11px] text-[#999999]">〜</span><input type="text" value={p.end} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, end:e.target.value}:x)})} className="w-16 h-9 border rounded-lg text-center text-[11px] font-bold outline-none focus:border-[#2D4B3E]"/><input type="text" placeholder="理由メモ" value={p.note} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.map(x=>x.id===p.id?{...x, note:e.target.value}:x)})} className="flex-1 h-9 border rounded-lg px-3 text-[11px] outline-none font-bold focus:border-[#2D4B3E]"/><button onClick={()=>setBoxFeeConfig({...boxFeeConfig, coolBinPeriods: boxFeeConfig.coolBinPeriods.filter(x=>x.id!==p.id)})} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button></div>
          ))}
        </div>
      </div>
      <div className="bg-[#2D4B3E]/5 p-6 rounded-2xl border border-[#2D4B3E]/10 space-y-4">
        <div className="font-bold text-[#2D4B3E] text-[14px] flex items-center gap-2"><RotateCcw size={18}/> 器回収/返却時の加算送料</div>
        <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">計算タイプ</label><select value={boxFeeConfig.returnFeeType} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, returnFeeType:e.target.value})} className="w-full h-10 bg-white border rounded-xl px-3 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"><option value="flat">固定金額 (¥)</option><option value="percent">基本送料の○%</option></select></div><div className="space-y-1"><label className="text-[10px] font-bold text-[#999999]">{boxFeeConfig.returnFeeType === 'flat' ? '加算金額 (¥)' : '加算率 (%)'}</label><input type="number" value={boxFeeConfig.returnFeeValue} onChange={(e)=>setBoxFeeConfig({...boxFeeConfig, returnFeeValue:Number(e.target.value)})} className="w-full h-10 bg-white border rounded-xl px-3 text-[13px] font-bold text-right outline-none focus:border-[#2D4B3E]"/></div></div>
      </div>
      <div className="space-y-6 pt-4 border-t border-[#EAEAEA]">
        <div className="flex justify-between items-center"><label className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Ruler size={16}/> 業者配送 サイズ・地域マスタ</label><div className="flex gap-2"><button onClick={()=>{const s=prompt('サイズを入力(例:140)'); if(s) setShippingSizes([...shippingSizes, s]);}} className="text-[10px] bg-[#2D4B3E] text-white px-3 py-1.5 rounded-full font-bold shadow-sm hover:bg-[#1f352b] transition-all">+ サイズ追加</button><button onClick={()=>{const r=prompt('新しい地域名を入力'); if(r) setShippingRates([...shippingRates, {region:r, leadDays:1}]);}} className="text-[10px] bg-[#2D4B3E] text-white px-3 py-1.5 rounded-full font-bold shadow-sm hover:bg-[#1f352b] transition-all">+ 地域追加</button></div></div>
        <div className="flex flex-wrap gap-2 mb-4 bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA]"><span className="text-[11px] font-bold text-[#999999] w-full mb-1">登録サイズ (×で削除可):</span>{shippingSizes.map((s, i) => (<div key={i} className="flex items-center gap-2 bg-white border rounded-full pl-3 pr-1 py-1 shadow-sm transition-all hover:border-red-200"><span className="text-[11px] font-bold text-[#2D4B3E]">{s}サイズ</span><button onClick={() => { if(confirm(`${s}サイズを削除しますか？`)){ setShippingSizes(shippingSizes.filter((_, idx)=>idx!==i)); }}} className="w-5 h-5 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"><X size={12}/></button></div>))}</div>
        <div className="overflow-x-auto border rounded-2xl">
          <table className="w-full text-left text-[10px] min-w-[1100px] bg-white">
            <thead className="bg-[#FBFAF9] border-b text-[#999999]"><tr><th className="p-3 w-32 font-bold">地域・地方名</th><th className="p-3 text-center border-l bg-green-50 text-green-800">配送日数</th>{shippingSizes.map(s=><th key={s} className="p-3 text-center border-l bg-gray-50">{s}サイズ</th>)}{shippingSizes.map(s=><th key={'c'+s} className="p-3 text-center border-l bg-blue-50 text-blue-500">{s}クール加算</th>)}<th className="p-3"></th></tr></thead>
            <tbody className="divide-y">{shippingRates.map((r, i) => (<tr key={i} className="hover:bg-gray-50/50 transition-colors"><td className="p-3"><input type="text" value={r.region} onChange={(e)=>{const n=[...shippingRates]; n[i].region=e.target.value; setShippingRates(n);}} className="w-full border-none bg-transparent font-bold text-[11px] outline-none" /></td><td className="p-1 border-l bg-green-50/30"><div className="flex items-center justify-center gap-1"><input type="number" value={r.leadDays || 1} onChange={(e)=>{const n=[...shippingRates]; n[i].leadDays=Number(e.target.value); setShippingRates(n);}} className="w-12 border rounded p-1.5 text-center font-bold text-green-900 outline-none"/></div></td>{shippingSizes.map(s => <td key={s} className="p-1 border-l"><input type="number" value={r['fee'+s]||0} onChange={(e)=>{const n=[...shippingRates]; n[i]['fee'+s]=Number(e.target.value); setShippingRates(n);}} className="w-16 border rounded p-1.5 mx-auto block text-right font-bold outline-none focus:border-[#2D4B3E]"/></td>)}{shippingSizes.map(s => <td key={'c'+s} className="p-1 border-l bg-blue-50/10"><input type="number" value={r['cool'+s]||0} onChange={(e)=>{const n=[...shippingRates]; n[i]['cool'+s]=Number(e.target.value); setShippingRates(n);}} className="w-16 border border-blue-100 rounded p-1.5 mx-auto block text-right text-blue-500 font-bold outline-none focus:border-blue-400"/></td>)}<td className="p-1 text-center"><button onClick={()=>{if(confirm('削除しますか？')){setShippingRates(shippingRates.filter((_, idx)=>idx!==i))}}} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={14}/></button></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRulesTab = () => {
    return (
      <div className="space-y-8 animate-in fade-in">
        <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-8 text-left">
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><LayoutTemplate size={20}/> 立札デザイン・店舗紐付け</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[12px] font-bold text-[#999999]">店舗ごとのテンプレート選択</label>
              {shops.length === 0 ? <p className="text-sm text-[#999999]">店舗を登録してください</p> : shops.map(shop => (
                <div key={shop.id} className="bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA] space-y-2">
                  <span className="font-bold text-[13px] text-[#2D4B3E]">{shop.name}</span>
                  <div className="flex flex-col gap-1">
                    {tateMaster.map(tate => (
                      <label key={tate.id} className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-lg border hover:border-[#2D4B3E] transition-all">
                        <input type="checkbox" checked={(shop.enabledTatePatterns || []).includes(tate.id)} onChange={(e)=>{const current = shop.enabledTatePatterns || []; const next = e.target.checked ? [...current, tate.id] : current.filter(p=>p!==tate.id); setShops(shops.map(s=>s.id===shop.id?{...s, enabledTatePatterns:next}:s));}} className="accent-[#2D4B3E]"/>
                        <span className="text-[11px] font-bold flex-1">{tate.label}</span>
                        <button onClick={(e)=>{e.preventDefault(); setSelectedPreviewTate(tate)}} className="text-[9px] bg-[#F7F7F7] px-2 py-1 rounded text-[#555555]">プレビュー</button>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky top-24 h-fit bg-[#FBFAF9] p-8 rounded-2xl border border-[#EAEAEA] shadow-inner text-center">
              <span className="text-[10px] font-bold text-[#999999] block mb-4">プレビュー ({selectedPreviewTate.label})</span>
              <TatefudaPreview tatePattern={selectedPreviewTate.id} layout={selectedPreviewTate.layout} isOsonae={['p1', 'p3', 'p4'].includes(selectedPreviewTate.id)} input1="御開店" input2="山田太郎" input3="株式会社〇〇" input3a="株式会社〇〇" input3b="代表 山田太郎" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStaffOrderTab = () => (
    <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-8 animate-in fade-in text-left">
      <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Clock size={20}/> 代理入力の特別ルール</h2>
      <div className="space-y-4">
        {[{ label: '最短納期の制限を完全に無視する', key: 'ignoreLeadTime' }, { label: '注文金額の自由入力を許可', key: 'allowCustomPrice' }].map(item => (
          <label key={item.key} className="flex items-center justify-between bg-[#FBFAF9] p-5 rounded-2xl cursor-pointer border border-transparent hover:border-[#EAEAEA] shadow-sm"><span className="font-bold text-[14px]">{item.label}</span><input type="checkbox" checked={staffOrderConfig[item.key]} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, [item.key]:e.target.checked})} className="w-6 h-6 accent-[#2D4B3E]"/></label>
        ))}
        <label className="flex items-center justify-between bg-[#FBFAF9] p-5 rounded-2xl cursor-pointer border border-transparent hover:border-[#EAEAEA] shadow-sm"><span className="font-bold text-[14px]">お客様への自動返信メールを送らない</span><input type="checkbox" checked={!staffOrderConfig.sendAutoReply} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, sendAutoReply:!e.target.checked})} className="w-6 h-6 accent-[#2D4B3E]"/></label>
        <div className="pt-4 space-y-1"><label className="text-[11px] font-bold text-[#999999]">スタッフ専用 支払い方法（カンマ区切り）</label><input type="text" value={(staffOrderConfig.paymentMethods||[]).join(', ')} onChange={(e)=>setStaffOrderConfig({...staffOrderConfig, paymentMethods:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full h-12 bg-[#FBFAF9] border rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]"/></div>
      </div>
    </div>
  );

  // ★ LINE 連携設定タブ
  const renderLineTab = () => {
    const webhookUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/api/line/webhook/${currentTenantId || 'default'}`
      : `https://noodleflorix.com/api/line/webhook/${currentTenantId || 'default'}`;
    return (
      <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-6 animate-in fade-in text-left max-w-[800px]">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2">💬 LINE公式アカウント連携 <HelpTooltip articleId="line_setup"/></h2>
        <p className="text-[12px] text-[#555555] leading-relaxed">
          LINE Messaging API と連携すると、注文確認・完成写真・入金確認等の通知を
          <strong className="text-[#117768]"> メール + LINE 両方</strong>でお客様にお届けできます。
        </p>

        {/* 有効化トグル */}
        <div className={`p-5 rounded-2xl border ${lineConfig.enabled ? 'bg-green-50 border-green-200' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lineConfig.enabled}
              onChange={(e) => setLineConfig({ ...lineConfig, enabled: e.target.checked })}
              className="mt-1 w-5 h-5 accent-[#117768]"
            />
            <div>
              <p className="text-[14px] font-bold text-[#111]">LINE連携を有効にする</p>
              <p className="text-[11px] text-[#555] mt-1">
                チェックを入れ、下の認証情報を全て入力した状態で「変更を保存」してください。
              </p>
            </div>
          </label>
        </div>

        {/* 認証情報 */}
        <div className="space-y-3">
          <h3 className="text-[14px] font-bold text-[#2D4B3E]">認証情報</h3>
          <p className="text-[11px] text-[#999] leading-relaxed">
            LINE Developers Console で発行した値を入力してください。
            <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-[#117768] underline ml-1">LINE Developers Console を開く →</a>
          </p>
          <div>
            <label className="text-[11px] font-bold text-[#555] tracking-widest">Channel Access Token（長期）</label>
            <input type="password" value={lineConfig.channelAccessToken}
              onChange={(e) => setLineConfig({ ...lineConfig, channelAccessToken: e.target.value })}
              placeholder="JI4dF3rN..."
              className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] font-mono outline-none focus:border-[#2D4B3E]"/>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#555] tracking-widest">Channel Secret</label>
            <input type="password" value={lineConfig.channelSecret}
              onChange={(e) => setLineConfig({ ...lineConfig, channelSecret: e.target.value })}
              placeholder="abcdef1234..."
              className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] font-mono outline-none focus:border-[#2D4B3E]"/>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#555] tracking-widest">Channel ID（任意）</label>
            <input type="text" value={lineConfig.channelId}
              onChange={(e) => setLineConfig({ ...lineConfig, channelId: e.target.value })}
              placeholder="1234567890"
              className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] font-mono outline-none focus:border-[#2D4B3E]"/>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#555] tracking-widest">友達追加用URL（お客様へ案内）</label>
            <input type="url" value={lineConfig.addFriendUrl}
              onChange={(e) => setLineConfig({ ...lineConfig, addFriendUrl: e.target.value })}
              placeholder="https://lin.ee/xxxxxx"
              className="w-full mt-1 h-11 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] outline-none focus:border-[#2D4B3E]"/>
            <p className="text-[10px] text-[#999] mt-1">マイページや確認メール末尾に「LINEで通知を受け取る」リンクとして表示されます</p>
          </div>
        </div>

        {/* Webhook URL（コピペ用） */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <p className="text-[12px] font-bold text-blue-900">📡 LINE Developers に設定する Webhook URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded-lg text-[11px] font-mono text-blue-900 break-all border border-blue-200">{webhookUrl}</code>
            <button
              onClick={() => { navigator.clipboard?.writeText(webhookUrl); alert('コピーしました'); }}
              className="px-3 py-2 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700"
            >コピー</button>
          </div>
          <p className="text-[10px] text-blue-800 leading-relaxed">
            このURLを LINE Developers Console → Messaging API設定 → Webhook URL に設定して、「Webhookの利用」をオンにしてください。
          </p>
        </div>

        {/* 連携手順 */}
        <details className="border border-[#EAEAEA] rounded-xl">
          <summary className="cursor-pointer p-4 text-[12px] font-bold text-[#2D4B3E] hover:bg-[#FBFAF9]">📖 LINE連携の手順を見る</summary>
          <div className="p-4 pt-0 text-[11px] text-[#555] leading-relaxed space-y-2">
            <p><strong>1.</strong> <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="text-[#117768] underline">LINE Developers Console</a> にログイン</p>
            <p><strong>2.</strong> プロバイダーを作成 → 「Messaging API」のチャネルを作成</p>
            <p><strong>3.</strong> 「Messaging API設定」タブで <strong>Channel Access Token（長期）</strong> を発行 → 上欄にペースト</p>
            <p><strong>4.</strong> 「チャネル基本設定」タブで <strong>Channel Secret</strong> をコピー → 上欄にペースト</p>
            <p><strong>5.</strong> 「Messaging API設定」 → 「Webhook URL」 に上の青枠のURLをペースト → 「Webhookの利用」をON</p>
            <p><strong>6.</strong> 「応答メッセージ」をOFF、「あいさつメッセージ」と「Webhook」をONに設定</p>
            <p><strong>7.</strong> LINE公式アカウントの<strong>友達追加URL</strong>（lin.ee/...）を上欄にペースト</p>
            <p><strong>8.</strong> ページ上部「変更を保存」 → 「LINE連携を有効にする」にチェック</p>
            <p className="pt-2 border-t border-[#EAEAEA] text-[#117768] font-bold">✓ 設定完了！お客様が公式LINEを友達追加 → メアドを送信 → 自動で紐付けされます</p>
          </div>
        </details>
      </div>
    );
  };

  // ★ シフト設定タブ
  const renderShiftTab = () => {
    const dayLabels = { mon:'月', tue:'火', wed:'水', thu:'木', fri:'金', sat:'土', sun:'日', holiday:'祝' };
    const updatePattern = (i, key, val) => {
      const next = [...shiftConfig.patterns];
      next[i] = { ...next[i], [key]: val };
      setShiftConfig({ ...shiftConfig, patterns: next });
    };
    return (
      <div className="space-y-6 animate-in fade-in max-w-[900px]">
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
          <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><CalendarDays size={18}/> シフトパターン <HelpTooltip articleId="shift_setup"/></h2>
          <p className="text-[11px] text-[#999]">早番・遅番など、店舗で使うシフトパターンを自由に登録できます。</p>
          <div className="space-y-2">
            {shiftConfig.patterns.map((p, i) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-[#EAEAEA]" style={{ background: p.color + '40' }}>
                <input type="text" value={p.name} onChange={e => updatePattern(i, 'name', e.target.value)} placeholder="名称"
                  className="flex-1 min-w-[120px] h-10 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"/>
                <input type="time" value={p.startTime} onChange={e => updatePattern(i, 'startTime', e.target.value)}
                  className="w-28 h-10 px-2 bg-white border border-[#EAEAEA] rounded-lg text-[12px] outline-none"/>
                <span className="text-[#999]">〜</span>
                <input type="time" value={p.endTime} onChange={e => updatePattern(i, 'endTime', e.target.value)}
                  className="w-28 h-10 px-2 bg-white border border-[#EAEAEA] rounded-lg text-[12px] outline-none"/>
                <input type="color" value={p.color || '#FFE4B5'} onChange={e => updatePattern(i, 'color', e.target.value)}
                  className="w-10 h-10 border border-[#EAEAEA] rounded-lg cursor-pointer"/>
                <button onClick={() => setShiftConfig({...shiftConfig, patterns: shiftConfig.patterns.filter((_, idx) => idx !== i)})}
                  className="text-red-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
              </div>
            ))}
            <button
              onClick={() => setShiftConfig({...shiftConfig, patterns: [...shiftConfig.patterns, { id: `pat_${Date.now()}`, name: '', startTime: '10:00', endTime: '18:00', color: '#FFE4B5' }]})}
              className="text-[12px] font-bold text-[#2D4B3E] border border-dashed border-[#2D4B3E]/40 rounded-xl px-4 py-2 hover:bg-[#2D4B3E]/5"
            >
              <Plus size={12} className="inline mr-1"/> パターンを追加
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
          <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><User size={18}/> 必要人数（曜日別）</h2>
          <p className="text-[11px] text-[#999]">曜日ごとに最低でも必要なスタッフ人数。自動シフト作成時の目安になります。</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(dayLabels).map(([key, label]) => (
              <div key={key} className="bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-3 text-center">
                <p className="text-[12px] font-bold text-[#555] mb-2">{label}{key === 'holiday' ? '日' : '曜'}</p>
                <input type="number" min="0" max="20"
                  value={shiftConfig.requiredStaff?.[key] ?? 1}
                  onChange={e => setShiftConfig({...shiftConfig, requiredStaff: {...(shiftConfig.requiredStaff || {}), [key]: Number(e.target.value)}})}
                  className="w-16 h-10 text-center text-[16px] font-bold bg-white border border-[#EAEAEA] rounded-lg outline-none"/>
                <p className="text-[10px] text-[#999] mt-1">名</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
          <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2"><CalendarIcon size={18}/> 休み希望の運用ルール</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#999] tracking-widest">提出〆切日</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[12px] text-[#555]">毎月</span>
                <input type="number" min="1" max="31"
                  value={shiftConfig.holidayRule?.submitDeadlineDay ?? 20}
                  onChange={e => setShiftConfig({...shiftConfig, holidayRule: {...(shiftConfig.holidayRule || {}), submitDeadlineDay: Number(e.target.value)}})}
                  className="w-16 h-10 px-3 text-center bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"/>
                <span className="text-[12px] text-[#555]">日まで翌月分</span>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#999] tracking-widest">第〇希望まで提出可能</label>
              <select
                value={shiftConfig.holidayRule?.maxPriorities ?? 1}
                onChange={e => setShiftConfig({...shiftConfig, holidayRule: {...(shiftConfig.holidayRule || {}), maxPriorities: Number(e.target.value)}})}
                className="w-full mt-1 h-10 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"
              >
                <option value={1}>第1希望のみ</option>
                <option value={2}>第2希望まで</option>
                <option value={3}>第3希望まで</option>
              </select>
            </div>
          </div>
          <p className="text-[10px] text-[#999] bg-[#FBFAF9] p-2 rounded-lg leading-relaxed">
            💡 〆切日を過ぎても受付けるが、自動シフト作成時の優先度が下がる仕様です。
          </p>
        </div>

        {/* ★ 給与計算設定 */}
        <div className="bg-white rounded-2xl border p-6 shadow-sm space-y-4">
          <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2">💰 給与計算（控除率・残業） <HelpTooltip articleId="payroll_setup"/></h2>
          <p className="text-[11px] text-[#999] leading-relaxed">
            勤怠記録と時給から、設定した料率通りに給与計算します。<strong className="text-amber-600">最終チェックは社会保険労務士にご依頼ください。</strong>
          </p>
          <div className={`p-3 rounded-xl border ${payrollConfig.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${payrollConfig.enabled ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                {payrollConfig.enabled ? '✓ ON' : 'OFF'}
              </span>
              <p className="text-[12px] font-bold text-[#111]">給与計算機能（サブスク連動）</p>
            </div>
            <p className="text-[10px] text-[#555] mt-2 leading-relaxed">
              {payrollConfig.enabled
                ? '給与計算サブスクが有効です。下の各項目で料率を調整してください。'
                : 'NocoLdeのサブスクで「給与計算」を契約するとON。サイドバー下部の「機能アップグレード」からお申し込みください。'}
            </p>
          </div>

          {payrollConfig.enabled && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-[#EAEAEA]">
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">雇用保険率 (%)</label>
                <input type="number" step="0.1" value={payrollConfig.employmentInsuranceRate}
                  onChange={e => setPayrollConfig({...payrollConfig, employmentInsuranceRate: Number(e.target.value)})}
                  className="w-full mt-1 h-10 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"/>
                <p className="text-[9px] text-[#999] mt-0.5">標準 0.6%</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">社会保険率 (%)</label>
                <input type="number" step="0.1" value={payrollConfig.socialInsuranceRate}
                  onChange={e => setPayrollConfig({...payrollConfig, socialInsuranceRate: Number(e.target.value)})}
                  className="w-full mt-1 h-10 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"/>
                <p className="text-[9px] text-[#999] mt-0.5">健保+厚年合計</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">所得税率 (%)</label>
                <input type="number" step="0.01" value={payrollConfig.incomeTaxRate}
                  onChange={e => setPayrollConfig({...payrollConfig, incomeTaxRate: Number(e.target.value)})}
                  className="w-full mt-1 h-10 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"/>
                <p className="text-[9px] text-[#999] mt-0.5">簡易源泉</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">所得税の課税開始ライン (円)</label>
                <input type="number" value={payrollConfig.incomeTaxThreshold}
                  onChange={e => setPayrollConfig({...payrollConfig, incomeTaxThreshold: Number(e.target.value)})}
                  className="w-full mt-1 h-10 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"/>
                <p className="text-[9px] text-[#999] mt-0.5">月給がこの金額未満なら<br/>所得税は引かない（標準: 88,000円）</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">残業割増 (%)</label>
                <input type="number" value={payrollConfig.overtimePremiumRate}
                  onChange={e => setPayrollConfig({...payrollConfig, overtimePremiumRate: Number(e.target.value)})}
                  className="w-full mt-1 h-10 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"/>
                <p className="text-[9px] text-[#999] mt-0.5">法定 25%以上</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#999] tracking-widest">残業判定 (時間/日)</label>
                <input type="number" value={payrollConfig.overtimeThresholdHours}
                  onChange={e => setPayrollConfig({...payrollConfig, overtimeThresholdHours: Number(e.target.value)})}
                  className="w-full mt-1 h-10 px-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-lg text-[13px] font-bold outline-none"/>
                <p className="text-[9px] text-[#999] mt-0.5">これ超で残業</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStaffTab = () => (
    <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-6 animate-in fade-in text-left">
      <div>
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><User size={20}/> スタッフ管理 <HelpTooltip articleId="role_explain"/></h2>
        <p className="text-[11px] text-[#999] mt-1 leading-relaxed">
          スタッフを登録すると、各画面の上部のセレクターから「現在誰が操作しているか」を切り替えられます。
          権限により見れる機能が変わります。
        </p>
      </div>

      {/* 権限の凡例 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
        <div className="bg-[#2D4B3E]/5 border border-[#2D4B3E]/20 rounded-xl p-3">
          <p className="font-bold text-[#2D4B3E] mb-1">🟢 オーナー</p>
          <p className="text-[#555] leading-relaxed">全機能・設定変更・売上・スタッフ管理</p>
        </div>
        <div className="bg-[#117768]/5 border border-[#117768]/20 rounded-xl p-3">
          <p className="font-bold text-[#117768] mb-1">🔵 スタッフ</p>
          <p className="text-[#555] leading-relaxed">注文管理・売上閲覧・顧客管理(設定×)</p>
        </div>
        <div className="bg-[#D97D54]/5 border border-[#D97D54]/20 rounded-xl p-3">
          <p className="font-bold text-[#D97D54] mb-1">🟠 バイト</p>
          <p className="text-[#555] leading-relaxed">注文一覧・対応のみ(売上・設定×)</p>
        </div>
      </div>

      {/* ★ PIN認証設定 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <p className="text-[13px] font-bold text-amber-900">🔐 スタッフ切替時のPIN認証 <HelpTooltip articleId="pin_lock"/></p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={Boolean(staffAuthConfig.requirePin)}
            onChange={(e) => setStaffAuthConfig({...staffAuthConfig, requirePin: e.target.checked})}
            className="mt-1 w-4 h-4 accent-amber-600"/>
          <div>
            <p className="text-[12px] font-bold text-amber-900">オーナー切替時にPIN認証を必須にする</p>
            <p className="text-[10px] text-amber-700 mt-1">設定変更・スタッフ管理など権限の高いオーナーへの切替時に4桁PIN必要</p>
          </div>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={Boolean(staffAuthConfig.requireForOwnerOnly === false && staffAuthConfig.requirePin)}
            onChange={(e) => setStaffAuthConfig({...staffAuthConfig, requireForOwnerOnly: !e.target.checked})}
            disabled={!staffAuthConfig.requirePin}
            className="mt-1 w-4 h-4 accent-amber-600 disabled:opacity-50"/>
          <div className={!staffAuthConfig.requirePin ? 'opacity-50' : ''}>
            <p className="text-[12px] font-bold text-amber-900">スタッフ・バイト切替時もPINを必須にする</p>
            <p className="text-[10px] text-amber-700 mt-1">忙しい店舗ではOFF推奨。誰がやっても操作履歴に残るので証跡は確保されます</p>
          </div>
        </label>
      </div>

      <div className="space-y-2">
        {staffList.map((s, i) => {
          const dayLabels = { mon:'月', tue:'火', wed:'水', thu:'木', fri:'金', sat:'土', sun:'日', holiday:'祝' };
          const fixedDayOff = Array.isArray(s.fixedDayOff) ? s.fixedDayOff : [];
          const toggleDayOff = (key) => {
            const next = [...staffList];
            const cur = Array.isArray(next[i].fixedDayOff) ? next[i].fixedDayOff : [];
            next[i] = { ...next[i], fixedDayOff: cur.includes(key) ? cur.filter(d => d !== key) : [...cur, key] };
            setStaffList(next);
          };
          return (
          <div key={i} className="bg-[#FBFAF9] p-4 rounded-2xl border border-[#EAEAEA] space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-bold text-[14px]">{s.name}</span>
              <span className="text-[9px] text-[#999999] font-bold tracking-tight">所属: {s.store === 'all' ? '全店' : shops.find(sh=>sh.id===Number(s.store))?.name || '不明'}</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN(4桁)"
              value={s.pin || ''}
              onChange={(e) => {
                const next = [...staffList];
                next[i] = { ...next[i], pin: e.target.value.replace(/\D/g, '').slice(0, 4) };
                setStaffList(next);
              }}
              className="w-24 h-10 px-3 bg-white border border-[#EAEAEA] rounded-lg text-[12px] font-bold outline-none focus:border-amber-500 text-center font-mono tracking-widest"
            />
            <select
              value={s.role || 'staff'}
              onChange={(e) => {
                const next = [...staffList];
                next[i] = { ...next[i], role: e.target.value };
                setStaffList(next);
              }}
              className={`h-10 px-3 bg-white border rounded-lg text-[12px] font-bold outline-none focus:border-[#2D4B3E] ${
                (s.role || 'staff') === 'owner' ? 'border-[#2D4B3E]/40 text-[#2D4B3E]' :
                (s.role || 'staff') === 'staff' ? 'border-[#117768]/40 text-[#117768]' :
                'border-[#D97D54]/40 text-[#D97D54]'
              }`}
            >
              <option value="owner">🟢 オーナー</option>
              <option value="staff">🔵 スタッフ</option>
              <option value="parttime">🟠 バイト</option>
            </select>
            <button onClick={()=>setStaffList(staffList.filter((_,idx)=>idx!==i))} className="text-red-300 hover:text-red-500 p-2"><Trash2 size={16}/></button>
            </div>

            {/* ★ 固定休 */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#EAEAEA]">
              <span className="text-[10px] font-bold text-[#999] tracking-widest">固定休:</span>
              {Object.entries(dayLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleDayOff(key)}
                  className={`w-9 h-9 rounded-lg text-[11px] font-bold transition-all ${
                    fixedDayOff.includes(key)
                      ? 'bg-[#D97D54] text-white border border-[#D97D54]'
                      : 'bg-white text-[#555] border border-[#EAEAEA] hover:border-[#D97D54]/40'
                  }`}
                >
                  {label}
                </button>
              ))}
              {fixedDayOff.length === 0 && <span className="text-[10px] text-[#999]">なし（毎日勤務可能）</span>}
            </div>

            {/* ★ 基本出勤時間（自動シフト生成のデフォルト） */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#EAEAEA]">
              <span className="text-[10px] font-bold text-[#999] tracking-widest">基本出勤時間:</span>
              <input type="time" value={s.defaultStartTime || ''}
                onChange={(e) => { const next = [...staffList]; next[i] = {...next[i], defaultStartTime: e.target.value}; setStaffList(next); }}
                className="h-8 px-2 bg-white border border-[#EAEAEA] rounded text-[11px] outline-none"/>
              <span className="text-[#999] text-[11px]">〜</span>
              <input type="time" value={s.defaultEndTime || ''}
                onChange={(e) => { const next = [...staffList]; next[i] = {...next[i], defaultEndTime: e.target.value}; setStaffList(next); }}
                className="h-8 px-2 bg-white border border-[#EAEAEA] rounded text-[11px] outline-none"/>
              <span className="text-[10px] text-[#999]">（自動シフト生成時のデフォルト時間）</span>
            </div>

            {/* ★ 給与設定（payrollConfig.enabled の時だけ表示） */}
            {payrollConfig.enabled && (
              <div className="pt-2 border-t border-[#EAEAEA] space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] font-bold text-[#117768] tracking-widest">💰 給与:</span>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                    <input type="checkbox" checked={Boolean(s.payrollEnabled)}
                      onChange={(e) => { const next = [...staffList]; next[i] = {...next[i], payrollEnabled: e.target.checked}; setStaffList(next); }}
                      className="w-4 h-4 accent-[#117768]"/>
                    給与計算対象
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#999]">時給</span>
                    <input type="number" placeholder="1100" value={s.hourlyWage || ''}
                      onChange={(e) => { const next = [...staffList]; next[i] = {...next[i], hourlyWage: Number(e.target.value) || 0}; setStaffList(next); }}
                      className="w-20 h-8 px-2 bg-white border border-[#EAEAEA] rounded text-[11px] text-right font-bold outline-none"/>
                    <span className="text-[10px] text-[#999]">円</span>
                  </div>
                </div>

                {s.payrollEnabled && (
                  <>
                    <div className="flex items-center gap-3 flex-wrap text-[11px]">
                      <span className="text-[10px] font-bold text-[#999]">控除:</span>
                      {[
                        { key: 'employment', label: '雇用保険' },
                        { key: 'social', label: '社会保険' },
                        { key: 'incomeTax', label: '所得税' },
                      ].map(opt => (
                        <label key={opt.key} className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox"
                            checked={Boolean(s.insurance?.[opt.key])}
                            onChange={(e) => {
                              const next = [...staffList];
                              next[i] = { ...next[i], insurance: { ...(next[i].insurance || {}), [opt.key]: e.target.checked } };
                              setStaffList(next);
                            }}
                            className="w-3.5 h-3.5 accent-[#117768]"/>
                          {opt.label}
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-[11px]">
                      <span className="text-[10px] font-bold text-[#999]">扶養:</span>
                      <select value={s.dependencyLimitYen ?? 0}
                        onChange={(e) => { const next = [...staffList]; next[i] = {...next[i], dependencyLimitYen: Number(e.target.value)}; setStaffList(next); }}
                        className="h-8 px-2 bg-white border border-[#EAEAEA] rounded text-[11px] font-bold outline-none">
                        <option value="0">対象外</option>
                        <option value="1030000">103万円</option>
                        <option value="1300000">130万円</option>
                        <option value="1500000">150万円</option>
                        <option value="2010000">201万円</option>
                      </select>
                      <span className="text-[10px] font-bold text-[#999] ml-2">月上限:</span>
                      <input type="number" placeholder="160" value={s.monthlyHourLimit || ''}
                        onChange={(e) => { const next = [...staffList]; next[i] = {...next[i], monthlyHourLimit: Number(e.target.value) || 0}; setStaffList(next); }}
                        className="w-16 h-8 px-2 bg-white border border-[#EAEAEA] rounded text-[11px] text-right font-bold outline-none"/>
                      <span className="text-[10px] text-[#999]">時間/月</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          );
        })}

        <div className="flex flex-col md:flex-row gap-2 pt-4 border-t border-[#EAEAEA]">
          <input type="text" placeholder="氏名" value={newStaffName} onChange={(e)=>setNewStaffName(e.target.value)} className="flex-[2] h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E]"/>
          <select value={newStaffStore} onChange={(e)=>setNewStaffStore(e.target.value)} className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold outline-none focus:border-[#2D4B3E]">
            <option value="all">全店</option>
            {shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name}</option>)}
          </select>
          <button onClick={()=>{
            if(newStaffName.trim()){
              setStaffList([...staffList,{name:newStaffName, store:newStaffStore, role: 'staff'}]);
              setNewStaffName('');
            }
          }} className="bg-[#2D4B3E] text-white px-6 h-12 rounded-xl font-bold text-[13px] shadow-sm hover:bg-[#1f352b] transition-all">追加</button>
        </div>
      </div>
    </div>
  );

  const renderMessageTab = () => (
    <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-6 animate-in fade-in text-left">
      <div className="flex justify-between items-center border-b border-[#EAEAEA] pb-4">
        <div>
          <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><Mail size={20}/> 案内文・テンプレート管理</h2>
          <p className="text-[11px] text-[#999999] mt-1">注文画面や通知メールで使用する定型文を管理します。店舗ごとに内容を変えることも可能です。</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!confirm('プリセット（自動メールのデフォルト文面）を読み込みます。既存のテンプレートは残ります。')) return;
              const presets = getPresetTemplates();
              // 既に同じトリガーのテンプレートがある場合はスキップ
              const existingTriggers = new Set(autoReplyTemplates.map(t => t.trigger));
              const toAdd = presets.filter(p => !existingTriggers.has(p.trigger)).map(p => ({ ...p, id: `t_${Date.now()}_${p.trigger}` }));
              setAutoReplyTemplates([...autoReplyTemplates, ...toAdd]);
              alert(`${toAdd.length}件のプリセットを追加しました`);
            }}
            className="text-[11px] bg-white border border-[#2D4B3E] text-[#2D4B3E] px-4 py-2 rounded-full font-bold transition-all hover:bg-[#2D4B3E]/5"
          >
            📥 プリセット読み込み
          </button>
          <button onClick={() => setAutoReplyTemplates([...autoReplyTemplates, { id: `t_${Date.now()}`, trigger: 'custom', targetShops: 'all', enabled: true, subject: '新しいテンプレート', body: '' }])} className="text-[11px] bg-[#2D4B3E] text-white px-4 py-2 rounded-full font-bold shadow-sm transition-all hover:bg-[#1f352b]">+ 追加</button>
        </div>
      </div>
      <div className="space-y-8">
        {autoReplyTemplates.map((template, index) => {
          const triggerInfo = getTriggerById(template.trigger);
          const isEnabled = template.enabled !== false;
          const isAllShops = template.targetShops === 'all' || template.targetShops === undefined;
          return (
            <div key={template.id} className={`bg-[#FBFAF9] p-6 rounded-2xl border border-[#EAEAEA] space-y-4 relative group ${!isEnabled ? 'opacity-60' : ''}`}>
              <button onClick={() => setAutoReplyTemplates(autoReplyTemplates.filter(t => t.id !== template.id))} className="absolute top-6 right-6 text-red-300 hover:text-red-500 bg-white p-2 rounded-full shadow-sm"><Trash2 size={16}/></button>

              {/* ★ トリガー情報 + 有効化トグル */}
              {triggerInfo && (
                <div className="flex items-start justify-between gap-3 pr-12 pb-3 border-b border-[#EAEAEA]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-[#2D4B3E]">
                      {triggerInfo.auto ? '🤖 自動送信' : '✋ 手動送信'} ／ {triggerInfo.label}
                    </p>
                    <p className="text-[10px] text-[#999999] leading-relaxed mt-1">{triggerInfo.description}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => { const newT = [...autoReplyTemplates]; newT[index].enabled = e.target.checked; setAutoReplyTemplates(newT); }}
                      className="w-4 h-4 accent-[#2D4B3E]"
                    />
                    <span className="text-[10px] font-bold text-[#555555]">{isEnabled ? '有効' : '無効'}</span>
                  </label>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-12">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999]">案内の種類（いつ使うか）</label>
                  <select value={template.trigger} onChange={(e) => { const newT = [...autoReplyTemplates]; newT[index].trigger = e.target.value; setAutoReplyTemplates(newT); }} className="w-full h-12 bg-white border border-[#EAEAEA] rounded-xl px-4 font-bold text-[13px] outline-none focus:border-[#2D4B3E]">
                    <option value="order_confirmed">ご注文受付（自動送信）</option>
                    <option value="restock_notification">入荷のお知らせ</option>
                    <option value="mypage_magic_link">注文履歴の確認URL</option>
                    <option value="delivery_completion">お渡し・配達完了（手動）</option>
                    <option value="custom">カスタム（手動送信）</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999]">適用する店舗</label>
                  <div className="flex gap-2 p-1 bg-white rounded-xl border border-[#EAEAEA]">
                    <button onClick={() => { const newT = [...autoReplyTemplates]; newT[index].targetShops = 'all'; setAutoReplyTemplates(newT); }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isAllShops ? 'bg-[#2D4B3E] text-white' : 'text-[#999999]'}`}>全店舗</button>
                    <button onClick={() => { const newT = [...autoReplyTemplates]; newT[index].targetShops = Array.isArray(template.targetShops) && template.targetShops !== 'all' ? template.targetShops : []; setAutoReplyTemplates(newT); }} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${!isAllShops ? 'bg-[#2D4B3E] text-white' : 'text-[#999999]'}`}>指定店舗のみ</button>
                  </div>
                </div>
              </div>

              {!isAllShops && (
                <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border border-[#EAEAEA] animate-in slide-in-from-top-2">
                  {shops.length === 0 ? <p className="text-[11px] text-[#999999]">店舗が登録されていません</p> : shops.map(shop => {
                    const isChecked = Array.isArray(template.targetShops) && template.targetShops.includes(shop.id);
                    return (
                      <label key={shop.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-[#2D4B3E]/5 border-[#2D4B3E] text-[#2D4B3E] shadow-sm' : 'text-[#999999] border-transparent hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={isChecked} onChange={(e)=>{const current = Array.isArray(template.targetShops) ? template.targetShops : []; const next = e.target.checked ? [...current, shop.id] : current.filter(id => id !== shop.id); const newT = [...autoReplyTemplates]; newT[index].targetShops = next; setAutoReplyTemplates(newT);}} className="accent-[#2D4B3E] w-3.5 h-3.5"/>
                        <span className="text-[11px] font-bold">{shop.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#999999]">件名 / 表示タイトル</label>
                <input type="text" value={template.subject} onChange={(e) => { const newT = [...autoReplyTemplates]; newT[index].subject = e.target.value; setAutoReplyTemplates(newT); }} className="w-full h-12 bg-white border border-[#EAEAEA] rounded-xl px-4 font-bold outline-none focus:border-[#2D4B3E]" />
              </div>
              
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#999999]">本文設定</label>
                <div className="relative">
                  <textarea value={template.body} onChange={(e) => { const newT = [...autoReplyTemplates]; newT[index].body = e.target.value; setAutoReplyTemplates(newT); }} className="w-full h-64 bg-white border border-[#EAEAEA] rounded-2xl p-5 pb-16 text-[13px] font-bold outline-none resize-none leading-relaxed focus:border-[#2D4B3E]" />
                  
                  {/* ★ トリガーに応じた変数ボタン（クリックでコピー） */}
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5">
                    {(triggerInfo?.variables || ['customerName', 'shopName', 'orderId']).map(v => {
                      const labelMap = {
                        customerName: 'お客様名',
                        shopName: '店舗名',
                        orderId: '注文番号',
                        orderTotal: '合計金額',
                        orderItems: '注文内容',
                        paymentMethod: '支払い方法',
                        bankInfo: '振込先情報',
                        deliveryDate: '納品予定日',
                        shopPhone: '店舗電話',
                        productName: '商品名',
                        shopUrl: '商品ページURL',
                        magicLinkUrl: '注文履歴URL',
                      };
                      const tag = `{${v}}`;
                      const label = labelMap[v] || v;
                      return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleCopyTag(tag)}
                        className="px-2 py-1 bg-[#F7F7F7] border border-[#EAEAEA] text-[9px] font-bold text-[#2D4B3E] rounded-md hover:bg-[#EAEAEA] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {copiedTag === tag ? (
                          <span className="text-green-600">✓ コピーしました</span>
                        ) : (
                          `${tag}: ${label}`
                        )}
                      </button>
                    );
                    })}
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderLinksTab = () => {
    const tid = generalConfig.tenantId || 'default';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    return (
      <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-8 animate-in fade-in text-left">
        <h2 className="text-[18px] font-bold text-[#2D4B3E] flex items-center gap-2"><LinkIcon size={20}/> URL・リンク発行</h2>
        <div className="space-y-6">
          
          {isB2BEnabled && (
            <div className="p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] space-y-4">
              <h3 className="text-[14px] font-bold text-[#111111] flex items-center gap-2"><Building2 size={16}/> 法人のお客様向け</h3>
              <div className="space-y-2">
                 <label className="text-[11px] font-bold text-[#999999]">法人ポータル・注文画面</label>
                 <div className="flex gap-2">
                   <input type="text" readOnly value={`${baseUrl}/corporate/${tid}`} className="flex-1 h-12 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[13px] font-mono outline-none text-[#555555]" />
                   <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/corporate/${tid}`); alert('コピーしました！'); }} className="px-6 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all">コピー</button>
                 </div>
              </div>
              <div className="space-y-2 pt-2">
                 <label className="text-[11px] font-bold text-[#999999]">法人アカウント 新規登録フォーム</label>
                 <div className="flex gap-2">
                   <input type="text" readOnly value={`${baseUrl}/corporate/register/${tid}`} className="flex-1 h-12 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[13px] font-mono outline-none text-[#555555]" />
                   <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/corporate/register/${tid}`); alert('コピーしました！'); }} className="px-6 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all">コピー</button>
                 </div>
              </div>
            </div>
          )}

          <div className="p-6 bg-[#FBFAF9] rounded-2xl border border-[#EAEAEA] space-y-4">
            <h3 className="text-[14px] font-bold text-[#111111] flex items-center gap-2"><Store size={16}/> 一般のお客様向け (店舗別注文ページ)</h3>
            {shops.length === 0 ? <p className="text-[12px] text-[#999999]">店舗を登録してください。</p> : shops.map(shop => (
               <div key={shop.id} className="space-y-1">
                 <label className="text-[11px] font-bold text-[#2D4B3E]">{shop.name}</label>
                 <div className="flex gap-2">
                   <input type="text" readOnly value={`${baseUrl}/order/${tid}/${shop.id}`} className="flex-1 h-12 px-4 bg-white border border-[#EAEAEA] rounded-xl text-[13px] font-mono outline-none text-[#555555]" />
                   <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/order/${tid}/${shop.id}`); alert('コピーしました！'); }} className="px-6 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] transition-all">コピー</button>
                 </div>
               </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-left pb-40">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-6 md:px-12 sticky top-0 z-50 shadow-sm">
        <h1 className="text-[16px] font-bold text-[#2D4B3E] tracking-tight">システム設定</h1>
        {/* ★ カテゴリ別タブ表示 */}
        <div className="hidden md:flex flex-1 mx-6 overflow-x-auto hide-scrollbar gap-2">
          {tabCategories.map(cat => (
            <div key={cat.name} className="flex flex-col items-start shrink-0">
              <span className="text-[8px] font-bold text-[#999999] tracking-widest mb-0.5 px-1">{cat.name}</span>
              <div className="flex bg-[#F7F7F7] p-1 rounded-xl border border-[#EAEAEA]">
                {cat.tabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>{t.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {!isAdmin ? (
            <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-xl border border-[#EAEAEA] shadow-sm">
              <input type="password" placeholder="Pass" value={adminPassword} onChange={(e)=>setAdminPassword(e.target.value)} className="w-16 h-8 px-2 bg-[#FBFAF9] text-[11px] font-bold outline-none rounded-lg border focus:border-[#2D4B3E]"/>
              <button onClick={handleLogin} className="px-3 h-8 bg-[#2D4B3E] text-white text-[11px] font-bold rounded-lg transition-all hover:bg-[#1f352b] active:scale-95">解除</button>
            </div>
          ) : (
            <button onClick={saveSettings} disabled={isSaving} className={`px-6 py-2.5 rounded-xl text-[12px] font-bold shadow-md transition-all ${isSaving ? 'bg-gray-400' : 'bg-[#2D4B3E] text-white hover:bg-[#1f352b] active:scale-95'}`}>{isSaving ? '保存中...' : '変更を保存'}</button>
          )}
        </div>
      </header>

      <div className="md:hidden bg-white border-b p-2 sticky top-20 z-40 shadow-sm space-y-2">
        {tabCategories.map(cat => (
          <div key={cat.name}>
            <p className="text-[9px] font-bold text-[#999999] tracking-widest px-1 mb-1">{cat.name}</p>
            <div className="flex overflow-x-auto hide-scrollbar gap-1">
              {cat.tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`whitespace-nowrap px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeTab === t.id ? 'bg-[#2D4B3E] text-white shadow-md' : 'bg-[#FBFAF9] text-[#999999]'}`}>{t.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <main className={`flex-1 max-w-[1000px] mx-auto w-full py-10 px-6 transition-all ${!isAdmin ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'status' && renderStatusTab()}
        {activeTab === 'design' && renderDesignTab()} 
        {activeTab === 'shop' && renderShopTab()}
        {activeTab === 'items' && renderItemsTab()}
        {activeTab === 'shipping' && renderShippingTab()}
        {activeTab === 'rules' && renderRulesTab()}
        {activeTab === 'staff_order' && renderStaffOrderTab()}
        {activeTab === 'staff' && renderStaffTab()}
        {activeTab === 'shift' && renderShiftTab()}
        {activeTab === 'message' && renderMessageTab()}
        {activeTab === 'payment' && renderPaymentTab()}
        {activeTab === 'line' && renderLineTab()}
        {activeTab === 'links' && renderLinksTab()}
      </main>

      {/* ★ 保存トースト */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border ${
            toast.type === 'success'
              ? 'bg-white border-[#117768]/30 text-[#117768]'
              : 'bg-white border-red-300 text-red-700'
          }`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[14px] font-bold ${
              toast.type === 'success' ? 'bg-[#117768]' : 'bg-red-500'
            }`}>
              {toast.type === 'success' ? '✓' : '!'}
            </div>
            <span className="text-[13px] font-bold">{toast.message}</span>
          </div>
        </div>
      )}

      <style jsx global>{` @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; } .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } `}</style>
    </div>
  );
}