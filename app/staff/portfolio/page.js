'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import Link from 'next/link';
import { Wand2, Copy, ExternalLink, CheckCircle } from 'lucide-react';

export default function PortfolioPage() {
  const [appSettings, setAppSettings] = useState(null);
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 新規登録用ステート
  const [isAdding, setIsAdding] = useState(false);
  const [newImage, setNewImage] = useState({
    id: '', url: '', caption: '', price: 0,
    purpose: '', color: '', vibe: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: settings } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (settings) setAppSettings(settings.settings_data);

        const { data: gallery } = await supabase.from('app_settings').select('settings_data').eq('id', 'gallery').single();
        if (gallery && gallery.settings_data?.images) {
          setImages(gallery.settings_data.images);
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
  const logoUrl = generalConfig.logoUrl || '';

  // キャプションから金額を自動計算する魔法
  const calculatePriceFromCaption = (text) => {
    if (!text) return 0;
    const tenKCount = (text.match(/\*/g) || []).length;
    const oneKCount = (text.match(/-/g) || []).length;
    return (tenKCount * 10000) + (oneKCount * 1000);
  };

  const handleCaptionChange = (text) => {
    const calculatedPrice = calculatePriceFromCaption(text);
    setNewImage({ ...newImage, caption: text, price: calculatedPrice });
  };

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

  // ★ AIキャプション自動生成（テスト用モック）
  const handleGenerateCaption = async () => {
    if (!newImage.purpose || !newImage.color || !newImage.vibe) {
      alert('「用途」「カラー」「イメージ」を選択してからAIボタンを押してください。');
      return;
    }
    setIsGenerating(true);
    
    // ※実際はここでOpenAIやGeminiのAPIを叩きます。今回は数秒待ってそれっぽい文章を返します。
    setTimeout(() => {
      const generatedText = `【${newImage.purpose}のご注文】\n今回は${newImage.color}をメインに、${newImage.vibe}雰囲気でお作りしました✨\n\n大切な方への贈り物として当店を選んでいただき、本当にありがとうございます。\nお花が空間を華やかに彩り、皆様に笑顔をお届けできますように。\n\n---\n▼ こちらの商品（¥${newImage.price || '金額設定なし'}）はプロフィールURLから簡単にご注文いただけます！\n\n#${appName} #お花屋さん #フラワーアレンジメント #スタンド花 #${newImage.purpose} #${newImage.vibe} #${newImage.color}のブーケ #花のある暮らし`;
      
      setNewImage({ ...newImage, caption: generatedText });
      setIsGenerating(false);
    }, 1500);
  };

  const saveGallery = async (updatedImages) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert({ id: 'gallery', settings_data: { images: updatedImages } });
      if (error) throw error;
      setImages(updatedImages);
      setIsAdding(false);
      setNewImage({ id: '', url: '', caption: '', price: 0, purpose: '', color: '', vibe: '' });
      alert('作品データを保存しました。');
    } catch (err) {
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSubmit = () => {
    if (!newImage.url || !newImage.purpose || !newImage.color || !newImage.vibe) {
      alert('画像、用途、カラー、イメージは必須項目です。'); return;
    }
    const newItem = { ...newImage, id: `img_${Date.now()}` };
    const updated = [newItem, ...images];
    saveGallery(updated);
  };

  const handleDelete = (id) => {
    if (!confirm('この作品データを削除しますか？')) return;
    const updated = images.filter(img => img.id !== id);
    saveGallery(updated);
  };

  // ★ URLコピー機能（即売カート用）
  const handleCopyUrl = (id) => {
    const shopId = appSettings?.shops?.[0]?.id || 'default';
    const baseUrl = window.location.origin;
    // URLの末尾に ?img=ID をつけて、お客様画面で自動選択されるようにする
    const targetUrl = `${baseUrl}/order/${shopId}?img=${id}`;
    
    navigator.clipboard.writeText(targetUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest animate-pulse">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* サイドバー */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10 hidden md:block">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {logoUrl ? <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" /> : <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{appName}</span>}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">🏠 ダッシュボード</Link>
          <Link href="/staff/orders" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">受注一覧</Link>
          <Link href="/staff/new-order" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">店舗注文受付</Link>
          <Link href="/staff/portfolio" className="block px-6 py-4 rounded-xl bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10 transition-all text-[13px] font-bold tracking-wider">作品・SNS連携管理</Link>
          <Link href="/staff/settings" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all mt-4 border-t border-[#EAEAEA] pt-4 text-[13px] font-bold tracking-wider">各種設定</Link>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 md:ml-64 flex flex-col min-w-0 pb-32">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">作品・SNS連携管理</h1>
          {!isAdding && (
            <button onClick={() => setIsAdding(true)} className="px-6 py-2.5 bg-[#2D4B3E] text-white text-[12px] font-bold rounded-xl shadow-sm hover:bg-[#1f352b] transition-all tracking-widest active:scale-95">
              ＋ 新規作品を追加
            </button>
          )}
        </header>

        <div className="max-w-[1000px] mx-auto w-full p-4 md:p-8">
          
          {/* 新規追加フォーム */}
          {isAdding && (
            <div className="bg-white p-6 md:p-8 rounded-[32px] border border-[#EAEAEA] shadow-lg mb-10 animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-center mb-6 border-b border-[#FBFAF9] pb-4">
                <h2 className="text-[16px] font-bold text-[#2D4B3E] tracking-widest">新規作品の登録</h2>
                <button onClick={() => setIsAdding(false)} className="text-[12px] font-bold text-[#999999] hover:text-[#111111] transition-colors">キャンセル</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                {/* 左側：画像とキャプション */}
                <div className="space-y-6">
                  <div className="relative w-full aspect-square bg-[#FBFAF9] border-2 border-dashed border-[#EAEAEA] rounded-[24px] flex items-center justify-center overflow-hidden hover:bg-gray-50 transition-colors">
                    {newImage.url ? (
                      <img src={newImage.url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <span className="text-[24px] mb-2 block">📸</span>
                        <span className="text-[12px] font-bold text-[#999999] tracking-widest">画像をタップして選択</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#999999] tracking-widest flex justify-between items-end">
                      <span>Instagram用 キャプション</span>
                      <button 
                        onClick={handleGenerateCaption}
                        disabled={isGenerating}
                        className="flex items-center gap-1 bg-[#2D4B3E]/10 text-[#2D4B3E] px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#2D4B3E] hover:text-white transition-all disabled:opacity-50"
                      >
                        <Wand2 size={12} /> {isGenerating ? 'AIが生成中...' : 'AIで自動生成'}
                      </button>
                    </label>
                    <textarea 
                      value={newImage.caption} 
                      onChange={(e) => handleCaptionChange(e.target.value)} 
                      placeholder="AIボタンを押すか、直接入力してください。（※金額自動計算機能：＊=1万円 / －=千円）"
                      className="w-full h-32 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-4 text-[13px] resize-none focus:border-[#2D4B3E] outline-none"
                    ></textarea>
                  </div>
                </div>

                {/* 右側：解析結果とメタデータ */}
                <div className="space-y-6">
                  <div className="p-6 bg-[#2D4B3E]/5 border border-[#2D4B3E]/20 rounded-[24px]">
                    <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest mb-1">自動算出された金額</p>
                    <div className="flex items-end gap-2">
                      <span className="text-[32px] font-serif font-bold text-[#2D4B3E] leading-none">
                        ¥{newImage.price.toLocaleString()}
                      </span>
                      <span className="text-[12px] font-sans font-bold text-[#555555] mb-1">
                        (税抜)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-2">
                        用途 <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded text-[8px]">必須</span>
                      </label>
                      <select value={newImage.purpose} onChange={(e) => setNewImage({...newImage, purpose: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                        <option value="">選択してください</option>
                        <option value="誕生日">誕生日</option><option value="開店">開店</option><option value="お供え">お供え</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-2">
                        カラー <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded text-[8px]">必須</span>
                      </label>
                      <select value={newImage.color} onChange={(e) => setNewImage({...newImage, color: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                        <option value="">選択してください</option>
                        <option value="暖色系">暖色系</option><option value="寒色系">寒色系</option><option value="おまかせ">おまかせ</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-2">
                        イメージ <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded text-[8px]">必須</span>
                      </label>
                      <select value={newImage.vibe} onChange={(e) => setNewImage({...newImage, vibe: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                        <option value="">選択してください</option>
                        <option value="かわいい">かわいい</option><option value="豪華">豪華</option><option value="大人っぽい">大人っぽい</option><option value="元気">元気</option><option value="おまかせ">おまかせ</option>
                      </select>
                    </div>
                  </div>

                  <button disabled={isSaving} onClick={handleAddSubmit} className="w-full h-14 bg-[#2D4B3E] text-white rounded-xl font-bold text-[14px] tracking-widest shadow-md hover:bg-[#1f352b] transition-all active:scale-[0.98] disabled:opacity-50">
                    {isSaving ? '保存中...' : 'この内容で登録する'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 登録済み画像ギャラリー */}
          <div>
            <h2 className="text-[14px] font-bold text-[#111111] tracking-widest mb-6 border-l-4 border-[#2D4B3E] pl-3">
              登録済みの作品 ＆ 即売カートURL
            </h2>
            {images.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-[32px] border border-dashed border-[#EAEAEA] text-[#999999] text-[13px] font-bold tracking-widest">
                作品が登録されていません。上のボタンから追加してください。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map(img => (
                  <div key={img.id} className="bg-white rounded-[24px] border border-[#EAEAEA] overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                    <div className="relative aspect-square bg-[#FBFAF9]">
                      <img src={img.url} alt="Portfolio" className="w-full h-full object-cover" />
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-[12px] font-bold text-[#2D4B3E] shadow-sm">
                        ¥{img.price.toLocaleString()}
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
                      
                      {/* ★ 即売カートURLのコピーボタン */}
                      <div className="space-y-2 mt-auto">
                        <button 
                          onClick={() => handleCopyUrl(img.id)}
                          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[11px] transition-all border ${copiedId === img.id ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-[#FBFAF9] border-[#EAEAEA] text-[#2D4B3E] hover:bg-white hover:border-[#2D4B3E]'}`}
                        >
                          {copiedId === img.id ? <><CheckCircle size={14}/> コピーしました！</> : <><Copy size={14}/> この作品の購入URLをコピー</>}
                        </button>
                        
                        <div className="flex justify-between items-center pt-2">
                          <a href={`/order/${appSettings?.shops?.[0]?.id || 'default'}?img=${img.id}`} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1 text-[#999999] hover:text-[#2D4B3E]">
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