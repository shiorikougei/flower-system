'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase'; // ★ パス修正
import { 
  Wand2, Copy, ExternalLink, CheckCircle, Trash2, 
  Plus, Link as LinkIcon, Image as ImageIcon, Loader2, Sparkles, LayoutGrid 
} from 'lucide-react';

export default function PortfolioPage() {
  const [appSettings, setAppSettings] = useState(null);
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTenantId, setCurrentTenantId] = useState(null);

  const [activeTab, setActiveTab] = useState('list');

  const [newImage, setNewImage] = useState({
    id: '', url: '', caption: '', price: '', purpose: '', color: '', vibe: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importedData, setImportedData] = useState(null);

  const [copiedId, setCopiedId] = useState(null);

  // ★ 新規：設定画面と連動するデザイン選択肢の初期値
  const defaultDesignOptions = {
    purposes: ['誕生日', '開店', 'お供え', '就任・昇進祝い', '移転祝い'],
    colors: ['おまかせ', '暖色系 (赤・ピンク・オレンジ)', '寒色系 (青・紫・白)', 'ホワイト・グリーン系'],
    vibes: ['おまかせ (用途に合わせる)', 'かわいい', '豪華', '大人っぽい', '元気', '華やか・豪華', '上品・落ち着いた雰囲気']
  };
  const designOptions = appSettings?.designOptions || defaultDesignOptions;

  useEffect(() => {
    async function fetchData() {
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

        const CACHE_KEY_SETTINGS = `florix_settings_cache_${tId}`;
        const CACHE_KEY_GALLERY = `florix_gallery_cache_${tId}`;

        const cachedSettings = sessionStorage.getItem(CACHE_KEY_SETTINGS);
        const cachedGallery = sessionStorage.getItem(CACHE_KEY_GALLERY);

        if (cachedSettings) {
          try { setAppSettings(JSON.parse(cachedSettings)); } catch (e) {}
        }
        if (cachedGallery) {
          try { setImages(JSON.parse(cachedGallery).images || []); } catch (e) {}
        }
        
        if (cachedSettings && cachedGallery) {
          setIsLoading(false);
        }

        const [settingsRes, galleryRes] = await Promise.all([
          supabase.from('app_settings').select('settings_data').eq('id', tId).single(),
          supabase.from('app_settings').select('settings_data').eq('id', `${tId}_gallery`).single()
        ]);

        if (settingsRes.data?.settings_data) {
          setAppSettings(settingsRes.data.settings_data);
          sessionStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(settingsRes.data.settings_data));
        }
        if (galleryRes.data?.settings_data) {
          const galleryImages = galleryRes.data.settings_data.images || [];
          setImages(galleryImages);
          sessionStorage.setItem(CACHE_KEY_GALLERY, JSON.stringify({ images: galleryImages }));
        }
      } catch (err) {
        console.error('データ取得エラー:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('3MB以下の画像を選択してください。'); return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setNewImage({ ...newImage, url: event.target.result });
    reader.readAsDataURL(file);
  };

  const handleGenerateCaption = async () => {
    if (!newImage.purpose || !newImage.color || !newImage.vibe) {
      alert('「用途」「カラー」「イメージ」を選択してからAIボタンを押してください。');
      return;
    }
    setIsGenerating(true);
    
    setTimeout(() => {
      const generatedText = `【${newImage.purpose}のご注文】\n今回は${newImage.color}をメインに、${newImage.vibe}雰囲気でお作りしました✨\n\n大切な方への贈り物として当店を選んでいただき、本当にありがとうございます。\nお花が空間を華やかに彩り、皆様に笑顔をお届けできますように。\n\n---\n▼ こちらの商品（¥${newImage.price || '金額未設定'}）はプロフィールURLから簡単にご注文いただけます！\n\n#${appName} #お花屋さん #フラワーアレンジメント #スタンド花 #${newImage.purpose} #${newImage.vibe} #${newImage.color}のブーケ #花のある暮らし`;
      
      setNewImage({ ...newImage, caption: generatedText });
      setIsGenerating(false);
    }, 1500);
  };

  const saveGallery = async (updatedImages) => {
    setIsSaving(true);
    try {
      const payload = { images: updatedImages };
      const { error } = await supabase.from('app_settings').upsert({ id: `${currentTenantId}_gallery`, settings_data: payload });
      if (error) throw error;
      
      setImages(updatedImages);
      sessionStorage.setItem(`florix_gallery_cache_${currentTenantId}`, JSON.stringify(payload)); 
      
      setNewImage({ id: '', url: '', caption: '', price: '', purpose: '', color: '', vibe: '' });
      setImportedData(null);
      setImportUrl('');
      setActiveTab('list');
      alert('作品データを保存しました。');
    } catch (err) {
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newImage.url || !newImage.purpose || !newImage.color || !newImage.vibe || !newImage.price) {
      alert('画像、金額、用途、カラー、イメージは必須項目です。'); return;
    }
    const newItem = { ...newImage, id: `img_${Date.now()}`, price: Number(newImage.price) };
    saveGallery([newItem, ...images]);
  };

  const handleDelete = (id) => {
    if (!confirm('この作品データを削除しますか？')) return;
    const updated = images.filter(img => img.id !== id);
    saveGallery(updated);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!importUrl) return;
    setIsImporting(true);

    setTimeout(() => {
      setImportedData({
        url: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=500&q=80',
        caption: '豪華な赤いバラのスタンド花です🌹\nお値段 33,000円〜承っております✨\n#開店祝い #スタンド花 #赤系',
        price: '33000', 
        purpose: designOptions.purposes[1] || '開店祝い',
        color: designOptions.colors[1] || '暖色系',
        vibe: designOptions.vibes[2] || '豪華',
      });
      setIsImporting(false);
    }, 2000);
  };

  const handleSaveImported = (e) => {
    e.preventDefault();
    if (!importedData) return;
    const newItem = { ...importedData, id: `img_${Date.now()}`, price: Number(importedData.price) };
    saveGallery([newItem, ...images]);
  };

  const handleCopyUrl = (id) => {
    const shopId = appSettings?.shops?.[0]?.id || 'default';
    const baseUrl = window.location.origin;
    const targetUrl = `${baseUrl}/order/${currentTenantId}/${shopId}?img=${id}`;
    
    navigator.clipboard.writeText(targetUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest animate-pulse">読み込み中...</div>;

  return (
    <div className="bg-[#FBFAF9] flex flex-col font-sans text-[#111111] pb-32 min-h-screen">
      
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">作品・SNS連携管理</h1>
      </header>

      <div className="max-w-[1000px] mx-auto w-full p-4 md:p-8 space-y-6">
        
        <div className="flex flex-wrap gap-2 bg-[#F7F7F7] p-1.5 rounded-2xl border border-[#EAEAEA] w-fit">
          <button onClick={() => setActiveTab('list')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'list' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>
            <LayoutGrid size={16}/> 登録済み一覧
          </button>
          <button onClick={() => setActiveTab('new')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'new' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>
            <Plus size={16}/> 新規登録 (画像)
          </button>
          <button onClick={() => setActiveTab('import')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'import' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>
            <LinkIcon size={16}/> 過去分登録 (URL)
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-[14px] font-bold text-[#111111] tracking-widest mb-6 border-l-4 border-[#2D4B3E] pl-3">
              登録済みの作品 ＆ カタログURL
            </h2>
            {images.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-[32px] border border-dashed border-[#EAEAEA] text-[#999999] text-[13px] font-bold tracking-widest">
                作品が登録されていません。タブから新規追加してください。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map(img => (
                  <div key={img.id} className="bg-white rounded-[24px] border border-[#EAEAEA] overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                    <div className="relative aspect-square bg-[#FBFAF9]">
                      <img src={img.url} alt="Portfolio" className="w-full h-full object-cover" />
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-[12px] font-bold text-[#2D4B3E] shadow-sm">
                        ¥{Number(img.price).toLocaleString()}
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="px-2 py-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded text-[10px] font-bold text-[#555555]">{img.purpose}</span>
                        <span className="px-2 py-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded text-[10px] font-bold text-[#555555]">{img.color}</span>
                        <span className="px-2 py-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded text-[10px] font-bold text-[#555555]">{img.vibe}</span>
                      </div>
                      <p className="text-[11px] text-[#555555] line-clamp-2 leading-relaxed mb-4 flex-1">
                        {img.caption || 'キャプションなし'}
                      </p>
                      
                      <div className="space-y-2 mt-auto">
                        <button 
                          onClick={() => handleCopyUrl(img.id)}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[11px] transition-all border ${copiedId === img.id ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#2D4B3E] hover:bg-white hover:border-[#2D4B3E]'}`}
                        >
                          {copiedId === img.id ? <><CheckCircle size={14}/> コピーしました！</> : <><Copy size={14}/> カタログURLをコピー</>}
                        </button>
                        
                        <div className="flex justify-between items-center pt-2">
                          <a href={`/order/${currentTenantId}/${appSettings?.shops?.[0]?.id || 'default'}?img=${img.id}`} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1 text-[#999999] hover:text-[#2D4B3E]">
                            <ExternalLink size={12}/> お客様画面を確認
                          </a>
                          <button onClick={() => handleDelete(img.id)} className="text-[10px] font-bold text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'new' && (
          <form onSubmit={handleAddSubmit} className="bg-white p-6 md:p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm max-w-[800px] space-y-6 animate-in fade-in">
            <h2 className="text-[16px] font-bold text-[#2D4B3E] tracking-widest border-b border-[#FBFAF9] pb-4">新規作品の登録</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="relative w-full aspect-square bg-[#FBFAF9] border-2 border-dashed border-[#EAEAEA] rounded-[24px] flex items-center justify-center overflow-hidden hover:bg-gray-50 transition-colors">
                  {newImage.url ? (
                    <img src={newImage.url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-[#999999] space-y-2">
                      <ImageIcon size={32} className="mx-auto opacity-50" />
                      <span className="text-[12px] font-bold block">クリックして選択</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                    <span>金額 (税抜)</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#111111]">¥</span>
                    <input type="number" required value={newImage.price} onChange={e => setNewImage({...newImage, price: e.target.value})} placeholder="例: 15000" className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold focus:border-[#2D4B3E] outline-none" />
                  </div>
                </div>
                
                {/* ★ ここを設定と連動！ */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                      <span>用途</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                    </label>
                    <select required value={newImage.purpose} onChange={e => setNewImage({...newImage, purpose: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                      <option value="">選択</option>
                      {designOptions.purposes.map(p => <option key={p} value={p}>{p}</option>)}
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                      <span>カラー</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                    </label>
                    <select required value={newImage.color} onChange={e => setNewImage({...newImage, color: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                      <option value="">選択</option>
                      {designOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                      <span>イメージ</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                    </label>
                    <select required value={newImage.vibe} onChange={e => setNewImage({...newImage, vibe: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                      <option value="">選択</option>
                      {designOptions.vibes.map(v => <option key={v} value={v}>{v}</option>)}
                      <option value="その他">その他</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-[11px] font-bold text-[#999999]">キャプション</label>
                    <button type="button" onClick={handleGenerateCaption} disabled={isGenerating} className="flex items-center gap-1 bg-[#2D4B3E]/10 text-[#2D4B3E] px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#2D4B3E] hover:text-white transition-all disabled:opacity-50">
                      <Wand2 size={12} /> {isGenerating ? '生成中...' : 'AIで自動生成'}
                    </button>
                  </div>
                  <textarea 
                    value={newImage.caption} 
                    onChange={e => setNewImage({ ...newImage, caption: e.target.value })} 
                    placeholder="AIボタンを押すか、直接入力してください。"
                    className="w-full h-24 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-4 text-[13px] resize-none focus:border-[#2D4B3E] outline-none"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#EAEAEA]">
              <button type="submit" disabled={isSaving} className="w-full md:w-auto md:px-12 h-14 bg-[#2D4B3E] text-white rounded-xl font-bold text-[14px] tracking-widest shadow-md hover:bg-[#1f352b] transition-all active:scale-[0.98] disabled:opacity-50 mx-auto block">
                {isSaving ? '保存中...' : '作品を登録する'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'import' && (
          <div className="space-y-6 max-w-[800px] animate-in fade-in">
            <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-sm space-y-4">
              <h2 className="text-[16px] font-black text-[#2D4B3E] flex items-center gap-2"><Sparkles size={18}/> URLから自動取り込み</h2>
              <p className="text-[12px] text-[#555555]">InstagramなどのURLを入力すると、画像とキャプションを自動で取得します。設定したAIプロンプトにより、金額や用途も自動推測されます。</p>
              
              <form onSubmit={handleImport} className="flex gap-2 pt-2">
                <input 
                  type="url" required placeholder="https://instagram.com/p/..." 
                  value={importUrl} onChange={e => setImportUrl(e.target.value)}
                  className="flex-1 h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] outline-none focus:border-[#2D4B3E]"
                />
                <button type="submit" disabled={isImporting || !importUrl} className="bg-[#2D4B3E] text-white px-6 md:px-8 rounded-xl font-bold text-[13px] hover:bg-[#1f352b] transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
                  {isImporting ? <><Loader2 size={16} className="animate-spin" /> 読込中</> : '読み込む'}
                </button>
              </form>
            </div>

            {importedData && (
              <form onSubmit={handleSaveImported} className="bg-white p-8 rounded-[32px] border-2 border-[#2D4B3E]/20 shadow-md animate-in slide-in-from-bottom-4">
                <h3 className="text-[14px] font-bold text-[#2D4B3E] mb-6 flex items-center gap-2"><CheckCircle size={18}/> 読み込み成功（内容を確認してください）</h3>
                
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="shrink-0 w-full md:w-[240px] space-y-4">
                    <div className="aspect-square bg-[#F7F7F7] rounded-[24px] overflow-hidden border border-[#EAEAEA]">
                      <img src={importedData.url} alt="インポート画像" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                      <p className="text-[10px] font-bold text-[#999999] mb-1">取得したキャプション</p>
                      <p className="text-[11px] text-[#555555] whitespace-pre-wrap leading-relaxed">{importedData.caption}</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-2">
                      <Sparkles size={16} className="text-emerald-500 shrink-0 mt-0.5"/>
                      <p className="text-[11px] text-emerald-800 font-bold leading-relaxed">AIがキャプションから金額と用途を推測しました。間違っている場合は手動で修正してください。</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                        <span>金額 (税抜)</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">¥</span>
                        <input type="number" required value={importedData.price} onChange={e => setImportedData({...importedData, price: e.target.value})} className="flex-1 h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold focus:border-[#2D4B3E] outline-none" />
                      </div>
                    </div>
                    
                    {/* ★ ここも設定と連動！ */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                          <span>用途</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                        </label>
                        <select required value={importedData.purpose} onChange={e => setImportedData({...importedData, purpose: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                          <option value="">未設定</option>
                          {designOptions.purposes.map(p => <option key={p} value={p}>{p}</option>)}
                          <option value="その他">その他</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                          <span>カラー</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                        </label>
                        <select required value={importedData.color} onChange={e => setImportedData({...importedData, color: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                          <option value="">未設定</option>
                          {designOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="その他">その他</option>
                        </select>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                          <span>イメージ</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                        </label>
                        <select required value={importedData.vibe} onChange={e => setImportedData({...importedData, vibe: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                          <option value="">未設定</option>
                          {designOptions.vibes.map(v => <option key={v} value={v}>{v}</option>)}
                          <option value="その他">その他</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-6 mt-4 border-t border-[#FBFAF9]">
                      <button type="submit" disabled={isSaving} className="w-full bg-[#2D4B3E] text-white px-8 py-3.5 rounded-xl font-bold text-[14px] hover:bg-[#1f352b] transition-all shadow-md disabled:opacity-50">
                        {isSaving ? '保存中...' : '登録を確定する'}
                      </button>
                    </div>

                  </div>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
      
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}