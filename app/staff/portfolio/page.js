'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../utils/supabase';
import Link from 'next/link';

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

  useEffect(() => {
    async function fetchData() {
      try {
        // アプリ名の取得
        const { data: settings } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (settings) setAppSettings(settings.settings_data);

        // ギャラリーデータの取得 (id: 'gallery' に保存します)
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

  // ★魔法のロジック：キャプションから記号を読み取って金額を自動計算
  const calculatePriceFromCaption = (text) => {
    if (!text) return 0;
    // 「*」の数を数えて10,000を掛ける
    const tenKCount = (text.match(/\*/g) || []).length;
    // 「-」の数を数えて1,000を掛ける
    const oneKCount = (text.match(/-/g) || []).length;
    return (tenKCount * 10000) + (oneKCount * 1000);
  };

  // キャプション入力時に自動で金額を更新する
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

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* サイドバー */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {logoUrl ? <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" /> : <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{appName}</span>}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff/orders" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all">
            <span className="text-[13px] font-bold tracking-wider block">受注一覧</span>
          </Link>
          <Link href="/staff/new-order" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all">
            <span className="text-[13px] font-bold tracking-wider block">店舗注文受付</span>
          </Link>
          {/* ★ポートフォリオメニューを追加 */}
          <Link href="/staff/portfolio" className="block w-full text-left px-6 py-4 rounded-xl bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10 transition-all">
            <span className="text-[13px] font-bold tracking-wider block">作品・SNS連携管理</span>
          </Link>
          <Link href="/staff/settings" className="block w-full text-left px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] transition-all mt-4 border-t border-[#EAEAEA] pt-4">
            <span className="text-[13px] font-bold tracking-wider block">各種設定</span>
          </Link>
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 md:ml-64 flex flex-col min-w-0 pb-32">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">作品・SNS連携管理</h1>
          {!isAdding && (
            <button onClick={() => setIsAdding(true)} className="px-6 py-2.5 bg-[#2D4B3E] text-white text-[12px] font-bold rounded-xl shadow-sm hover:bg-[#1f352b] transition-all tracking-widest">
              ＋ 新規作品を追加
            </button>
          )}
        </header>

        <div className="max-w-[1000px] mx-auto w-full p-8">
          
          {/* 新規追加フォーム */}
          {isAdding && (
            <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-lg mb-10 animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-center mb-6 border-b border-[#FBFAF9] pb-4">
                <h2 className="text-[16px] font-bold text-[#2D4B3E] tracking-widest">新規作品の登録</h2>
                <button onClick={() => setIsAdding(false)} className="text-[12px] font-bold text-[#999999] hover:text-[#111111]">キャンセル</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* 左側：画像とキャプション */}
                <div className="space-y-6">
                  <div className="relative w-full aspect-square bg-[#FBFAF9] border-2 border-dashed border-[#EAEAEA] rounded-[24px] flex items-center justify-center overflow-hidden">
                    {newImage.url ? (
                      <img src={newImage.url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[12px] font-bold text-[#999999] tracking-widest">画像を選択</span>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-[#999999] tracking-widest flex justify-between">
                      <span>Instagram用 キャプション</span>
                      <span className="text-[#2D4B3E]">＊=1万円 / －=千円</span>
                    </label>
                    <textarea 
                      value={newImage.caption} 
                      onChange={(e) => handleCaptionChange(e.target.value)} 
                      placeholder="例: 春の可愛らしいアレンジメントです🌸 **--"
                      className="w-full h-32 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-4 text-[13px] resize-none focus:border-[#2D4B3E] outline-none"
                    ></textarea>
                  </div>
                </div>

                {/* 右側：解析結果とメタデータ */}
                <div className="space-y-6">
                  <div className="p-6 bg-[#2D4B3E]/5 border border-[#2D4B3E]/20 rounded-[24px]">
                    <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest mb-1">自動算出された金額</p>
                    <div className="text-[32px] font-serif font-bold text-[#2D4B3E]">
                      ¥{newImage.price.toLocaleString()} <span className="text-[12px] font-sans font-normal text-[#555555]">(税抜)</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-[#999999] tracking-widest">用途 (お客様フォームと連動)</label>
                      <select value={newImage.purpose} onChange={(e) => setNewImage({...newImage, purpose: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                        <option value="">選択してください</option>
                        <option value="誕生日">誕生日</option><option value="開店">開店</option><option value="お供え">お供え</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-[#999999] tracking-widest">カラー</label>
                      <select value={newImage.color} onChange={(e) => setNewImage({...newImage, color: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                        <option value="">選択してください</option>
                        <option value="暖色系">暖色系</option><option value="寒色系">寒色系</option><option value="おまかせ">おまかせ</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-[#999999] tracking-widest">イメージ</label>
                      <select value={newImage.vibe} onChange={(e) => setNewImage({...newImage, vibe: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                        <option value="">選択してください</option>
                        <option value="かわいい">かわいい</option><option value="豪華">豪華</option><option value="大人っぽい">大人っぽい</option><option value="元気">元気</option><option value="おまかせ">おまかせ</option>
                      </select>
                    </div>
                  </div>

                  <button disabled={isSaving} onClick={handleAddSubmit} className="w-full h-14 bg-[#2D4B3E] text-white rounded-xl font-bold text-[14px] tracking-widest shadow-md hover:bg-[#1f352b] transition-all disabled:opacity-50">
                    {isSaving ? '保存中...' : 'この内容で登録する'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 登録済み画像ギャラリー */}
          <div>
            <h2 className="text-[14px] font-bold text-[#111111] tracking-widest mb-6 border-l-4 border-[#2D4B3E] pl-3">登録済みの作品一覧</h2>
            {images.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-[32px] border border-dashed border-[#EAEAEA] text-[#999999] text-[13px] font-bold tracking-widest">
                作品が登録されていません。新規追加から登録してください。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map(img => (
                  <div key={img.id} className="bg-white rounded-[24px] border border-[#EAEAEA] overflow-hidden shadow-sm hover:shadow-md transition-all group">
                    <div className="relative aspect-square bg-[#FBFAF9]">
                      <img src={img.url} alt="Portfolio" className="w-full h-full object-cover" />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[12px] font-bold text-[#2D4B3E] shadow-sm">
                        ¥{img.price.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="px-2 py-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded text-[10px] font-bold text-[#555555]">{img.purpose}</span>
                        <span className="px-2 py-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded text-[10px] font-bold text-[#555555]">{img.color}</span>
                        <span className="px-2 py-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded text-[10px] font-bold text-[#555555]">{img.vibe}</span>
                      </div>
                      <p className="text-[11px] text-[#555555] line-clamp-2 leading-relaxed">{img.caption}</p>
                      <div className="pt-3 border-t border-[#FBFAF9] text-right opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => handleDelete(img.id)} className="text-[10px] font-bold text-red-400 hover:text-red-600">削除</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; }`}</style>
    </div>
  );
}