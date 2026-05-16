'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Wand2, Copy, ExternalLink, CheckCircle, Trash2,
  Plus, Link as LinkIcon, Image as ImageIcon, Loader2, Sparkles, LayoutGrid,
  Camera, ArrowRight, Search,
} from 'lucide-react';
import FeatureGate from '@/components/FeatureGate';
import HelpTooltip from '@/components/HelpTooltip';

const SETTINGS_CACHE_KEY = 'florix_app_settings_cache';
const GALLERY_CACHE_KEY = 'florix_gallery_cache';

export default function PortfolioPage() {
  return <FeatureGate feature="portfolio" label="作品管理"><PortfolioPageInner/></FeatureGate>;
}

function PortfolioPageInner() {
  const [appSettings, setAppSettings] = useState(null);
  const [images, setImages] = useState([]);
  
  // ★ 新規追加：完成写真がアップロードされた注文のリスト
  const [completedOrders, setCompletedOrders] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTenantId, setCurrentTenantId] = useState(null);

  const [activeTab, setActiveTab] = useState('list');

  const [newImage, setNewImage] = useState({
    id: '', url: '', caption: '', price: '', flowerType: '', purpose: '', color: '', vibe: '', uploadFile: null
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const [copiedId, setCopiedId] = useState(null);

  // ★ 管理番号検索クエリ
  const [searchQuery, setSearchQuery] = useState('');

  // ★ URL一括取込関連 state
  const [bulkUrls, setBulkUrls] = useState('');
  const [extractedItems, setExtractedItems] = useState([]); // { sourceUrl, image, title, description, price, priceHidden, flowerType, purpose, color, vibe, caption, selected }
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [bulkApply, setBulkApply] = useState({ flowerType: '', purpose: '', color: '', vibe: '', priceHidden: true });
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // ★ 作品化済みの注文を除外したリスト（納品写真から作成タブ用）
  const pendingCompletedOrders = useMemo(() => {
    const registeredIds = new Set((images || []).map(img => img.sourceOrderId).filter(Boolean));
    return completedOrders.filter(o => !registeredIds.has(o.id));
  }, [completedOrders, images]);

  const defaultDesignOptions = {
    purposes: ['誕生日', '開店', 'お供え', '就任・昇進祝い', '移転祝い'],
    colors: ['おまかせ', '暖色系 (赤・ピンク・オレンジ)', '寒色系 (青・紫・白)', 'ホワイト・グリーン系'],
    vibes: ['おまかせ (用途に合わせる)', 'かわいい', '豪華', '大人っぽい', '元気', '華やか・豪華', '上品・落ち着いた雰囲気']
  };
  const designOptions = appSettings?.designOptions || defaultDesignOptions;
  const flowerItems = appSettings?.flowerItems || [];

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

        // ★ 注文データも一緒に取得して、完成写真があるものだけを抽出！
        const [settingsRes, galleryRes, ordersRes] = await Promise.all([
          supabase.from('app_settings').select('settings_data').eq('id', tId).single(),
          supabase.from('app_settings').select('settings_data').eq('id', `${tId}_gallery`).single(),
          // ★ セキュリティ修正: tenant_id でフィルタ
          supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false }).limit(200)
        ]);

        if (settingsRes.data?.settings_data) {
          setAppSettings(settingsRes.data.settings_data);
        }
        if (galleryRes.data?.settings_data) {
          setImages(galleryRes.data.settings_data.images || []);
        }
        if (ordersRes.data) {
          // 完成写真 (completionImage) がある注文だけをフィルター
          const withImages = ordersRes.data.filter(o => o.order_data?.completionImage);
          setCompletedOrders(withImages);
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
    setNewImage({ ...newImage, url: URL.createObjectURL(file), uploadFile: file });
  };

  // ★ 新規追加：注文リストから写真と情報を引き継いでセットする関数
  const handleSelectOrderImage = (order) => {
    const d = order.order_data;
    setNewImage({
      id: '',
      url: d.completionImage, // URLをそのまま引き継ぐ
      caption: '', // キャプションは空（あとでAI生成する）
      price: d.itemPrice || '',
      flowerType: d.flowerType || '',
      purpose: d.flowerPurpose || '',
      color: d.flowerColor || '',
      vibe: d.flowerVibe || '',
      managementNo: d.managementNo || '', // ★ 管理番号を引き継ぐ
      sourceOrderId: order.id, // ★ 紐付け（作品化済み判定用）
      uploadFile: 'from_order' // 注文からの引き継ぎであることを示すフラグ
    });
    setActiveTab('new'); // 新規登録タブに移動！
  };

  const handleGenerateCaption = async () => {
    if (!newImage.flowerType || !newImage.purpose || !newImage.color || !newImage.vibe) {
      alert('「お花の種類」「用途」「カラー」「イメージ」を選択してからAIボタンを押してください。');
      return;
    }
    setIsGenerating(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          flowerType: newImage.flowerType,
          purpose: newImage.purpose,
          color: newImage.color,
          vibe: newImage.vibe,
          price: newImage.price,
          appName: appName,
          tenantId: currentTenantId,   // ★ AI利用カウンター用
        })
      });

      const data = await response.json();
      if (data.caption) {
        // ★ 管理番号があれば、キャプションの先頭に自動挿入
        const mn = (newImage.managementNo || '').trim();
        const finalCaption = mn
          ? `📋 ${mn}\n\n${data.caption}`
          : data.caption;
        setNewImage({ ...newImage, caption: finalCaption });
      }

      // ★ 月の無料枠を超えた場合はメッセージ表示
      if (data.usage && data.usage.overage > 0) {
        alert(
          `⚠️ 今月のAI生成回数が無料枠（${data.usage.freeQuota}回）を超えました。\n` +
          `超過: ${data.usage.overage}回 / 追加料金: ¥${data.usage.overageJpy.toLocaleString()}\n` +
          `※請求は月末にまとめて発生します`
        );
      } else if (data.usage) {
        // 残り回数が少ない時の警告（残10回以下）
        const remaining = data.usage.freeQuota - data.usage.used;
        if (remaining <= 10 && remaining > 0) {
          console.log(`AI生成残り ${remaining}回（今月）`);
        }
      }
    } catch (err) {
      alert('AI生成に失敗しました。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    
    // ★ urlが存在すればOKに変更（uploadFile必須ではない）
    if (!newImage.url || !newImage.flowerType || !newImage.purpose || !newImage.color || !newImage.vibe || !newImage.price) {
      alert('画像、金額、お花の種類、用途、カラー、イメージは必須項目です。'); return;
    }

    setIsSaving(true);
    try {
      let finalImageUrl = newImage.url;

      // 手動でアップロードされた画像（from_orderフラグがない）場合のみ、Storageに保存する
      if (newImage.uploadFile && newImage.uploadFile !== 'from_order') {
        const fileExt = newImage.uploadFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${currentTenantId}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('portfolio').upload(filePath, newImage.uploadFile);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('portfolio').getPublicUrl(filePath);
        finalImageUrl = publicUrlData.publicUrl;
      }
      
      const newItem = {
        id: `img_${Date.now()}`,
        url: finalImageUrl,
        caption: newImage.caption,
        price: Number(newImage.price),
        flowerType: newImage.flowerType,
        purpose: newImage.purpose,
        color: newImage.color,
        vibe: newImage.vibe,
        managementNo: newImage.managementNo || '', // ★ 管理番号
        sourceOrderId: newImage.sourceOrderId || null, // ★ 元注文との紐付け（作品化済み判定用）
      };

      const updatedImages = [newItem, ...images];
      const { error: dbError } = await supabase.from('app_settings').upsert({ id: `${currentTenantId}_gallery`, settings_data: { images: updatedImages } });

      if (dbError) throw dbError;

      setImages(updatedImages);
      setNewImage({ id: '', url: '', caption: '', price: '', flowerType: '', purpose: '', color: '', vibe: '', managementNo: '', sourceOrderId: null, uploadFile: null });
      setActiveTab('list');
      alert('作品データを保存しました！');

    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('この作品データを削除しますか？')) return;
    setIsSaving(true);
    try {
      const updated = images.filter(img => img.id !== id);
      const { error } = await supabase.from('app_settings').upsert({ id: `${currentTenantId}_gallery`, settings_data: { images: updated } });
      if (error) throw error;
      setImages(updated);
    } catch(err) {
      alert('削除に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyUrl = (id) => {
    const shopId = appSettings?.shops?.[0]?.id || 'default';
    const baseUrl = window.location.origin;
    const targetUrl = `${baseUrl}/order/${currentTenantId}/${shopId}?img=${id}`;
    
    navigator.clipboard.writeText(targetUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ★ URL一括取込: テキストエリアの URLを1行ごとに分けて、順次API呼び出し
  const handleBulkExtract = async () => {
    const urls = bulkUrls
      .split(/[\n,\s]+/)
      .map(u => u.trim())
      .filter(u => u && /^https?:\/\//.test(u));

    if (urls.length === 0) {
      alert('URLを1つ以上入力してください（1行に1URL）');
      return;
    }
    if (urls.length > 30) {
      if (!confirm(`${urls.length}件のURLを処理します。\nレート制限の都合上、30件を超えるとエラーが出る可能性があります。\n続行しますか？`)) return;
    }

    setIsExtracting(true);
    setExtractProgress({ done: 0, total: urls.length, errors: 0 });
    const results = [];
    let errCount = 0;

    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch('/api/portfolio/extract-from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[i] }),
        });
        const data = await res.json();
        if (res.ok && data.image) {
          results.push({
            sourceUrl: urls[i],
            image: data.image,
            title: data.title || '',
            description: data.description || '',
            price: '',
            priceHidden: bulkApply.priceHidden,
            flowerType: bulkApply.flowerType || '',
            purpose: bulkApply.purpose || '',
            color: bulkApply.color || '',
            vibe: bulkApply.vibe || '',
            caption: (data.description || data.title || '').slice(0, 200),
            selected: true,
          });
        } else {
          errCount++;
        }
      } catch (e) {
        errCount++;
      }
      setExtractProgress({ done: i + 1, total: urls.length, errors: errCount });
      // レート制限対策に少し待つ（30/min なので 200ms 間隔で十分余裕）
      if (i < urls.length - 1) await new Promise(r => setTimeout(r, 250));
    }

    setExtractedItems(prev => [...results, ...prev]);
    setIsExtracting(false);
    setBulkUrls('');
    if (errCount > 0) {
      alert(`${results.length}件取得、${errCount}件失敗\n失敗は非公開投稿・ログイン要・形式不一致などが原因です。`);
    } else {
      alert(`${results.length}件のURLから画像を取得しました🎉\n下のリストで内容を確認し、作品として登録してください。`);
    }
  };

  // ★ 一括適用 (bulkApply の値を 全アイテムに反映)
  const applyBulkToAll = () => {
    if (!bulkApply.flowerType && !bulkApply.purpose && !bulkApply.color && !bulkApply.vibe) {
      alert('一括適用する項目を1つ以上選択してください');
      return;
    }
    setExtractedItems(items => items.map(it => ({
      ...it,
      flowerType: bulkApply.flowerType || it.flowerType,
      purpose: bulkApply.purpose || it.purpose,
      color: bulkApply.color || it.color,
      vibe: bulkApply.vibe || it.vibe,
      priceHidden: bulkApply.priceHidden,
    })));
  };

  // ★ 取込結果から1件削除
  const removeExtractedItem = (idx) => {
    setExtractedItems(items => items.filter((_, i) => i !== idx));
  };

  // ★ 全選択 / 全解除
  const toggleSelectAll = (selected) => {
    setExtractedItems(items => items.map(it => ({ ...it, selected })));
  };

  // ★ 選択中のアイテムをまとめて作品 (images) に保存
  const handleBulkSave = async () => {
    const selected = extractedItems.filter(it => it.selected);
    if (selected.length === 0) { alert('登録するアイテムを選択してください'); return; }

    // バリデーション: 必須項目チェック
    const invalid = selected.find(it =>
      !it.flowerType || !it.purpose || !it.color || !it.vibe ||
      (!it.priceHidden && (!it.price || Number(it.price) < 0))
    );
    if (invalid) {
      alert(
        '以下が未入力のアイテムがあります:\n' +
        '・お花の種類\n・用途\n・カラー\n・イメージ\n' +
        '・金額（金額非公開にチェックが入っていない場合のみ必須）'
      );
      return;
    }

    if (!confirm(`${selected.length}件を作品として登録します。よろしいですか？`)) return;

    setIsBulkSaving(true);
    try {
      const newItems = selected.map((it, idx) => ({
        id: `img_${Date.now()}_${idx}`,
        url: it.image,
        caption: it.caption || '',
        price: it.priceHidden ? 0 : Number(it.price || 0),
        priceHidden: !!it.priceHidden,
        flowerType: it.flowerType,
        purpose: it.purpose,
        color: it.color,
        vibe: it.vibe,
        sourceInstagramUrl: it.sourceUrl, // ★ 元URL記録
        sourceOrderId: null,
      }));

      const updatedImages = [...newItems, ...images];
      const { error: dbError } = await supabase
        .from('app_settings')
        .upsert({ id: `${currentTenantId}_gallery`, settings_data: { images: updatedImages } });
      if (dbError) throw dbError;

      setImages(updatedImages);
      // 登録したものを取込リストから削除
      setExtractedItems(items => items.filter(it => !it.selected));
      alert(`${selected.length}件を作品として登録しました🎉`);
      setActiveTab('list');
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました: ' + err.message);
    } finally {
      setIsBulkSaving(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] animate-pulse">読み込み中...</div>;

  return (
    <div className="bg-[#FBFAF9] flex flex-col font-sans text-[#111111] pb-32 min-h-screen">
      
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
        <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2">作品・SNS連携管理 <HelpTooltip articleId="product_register"/></h1>
      </header>

      <div className="max-w-[1000px] mx-auto w-full p-4 md:p-8 space-y-6">
        
        <div className="flex flex-wrap gap-2 bg-[#F7F7F7] p-1.5 rounded-2xl border border-[#EAEAEA] w-fit">
          <button onClick={() => setActiveTab('list')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'list' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>
            <LayoutGrid size={16}/> 登録済み一覧
          </button>
          {/* ★ 新規追加：納品写真から作成タブ */}
          <button onClick={() => setActiveTab('from_orders')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'from_orders' ? 'bg-white shadow-sm text-[#D97D54]' : 'text-[#999999] hover:text-[#555555]'}`}>
            <Camera size={16}/> 納品写真から作成
            {pendingCompletedOrders.length > 0 && <span className={`ml-1 px-1.5 rounded-full text-[10px] ${activeTab === 'from_orders' ? 'bg-[#D97D54]/10 text-[#D97D54]' : 'bg-[#D97D54] text-white'}`}>{pendingCompletedOrders.length}</span>}
          </button>
          <button onClick={() => setActiveTab('new')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'new' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>
            <Plus size={16}/> 手動で新規登録
          </button>
          <button onClick={() => setActiveTab('import')} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all ${activeTab === 'import' ? 'bg-white shadow-sm text-[#2D4B3E]' : 'text-[#999999] hover:text-[#555555]'}`}>
            <LinkIcon size={16}/> 過去分登録 (URL)
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-[14px] font-bold text-[#111111] mb-3 border-l-4 border-[#2D4B3E] pl-3">
              登録済みの作品 ＆ カタログURL
            </h2>

            {/* ★ 管理番号・キャプション検索 */}
            <div className="bg-white border border-[#EAEAEA] rounded-2xl p-4 mb-6 flex items-center gap-3 shadow-sm">
              <Search size={16} className="text-[#999]"/>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="管理番号で検索（例: 20260514-001）または キャプション・花の種類で絞り込み"
                className="flex-1 h-10 bg-transparent text-[13px] outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[11px] text-[#999] hover:text-[#2D4B3E] font-bold">クリア</button>
              )}
            </div>

            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const filtered = q
                ? images.filter(img =>
                    (img.managementNo || '').toLowerCase().includes(q) ||
                    (img.caption || '').toLowerCase().includes(q) ||
                    (img.flowerType || '').toLowerCase().includes(q) ||
                    (img.purpose || '').toLowerCase().includes(q)
                  )
                : images;
              return filtered.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#EAEAEA] text-[#999999] text-[13px] font-bold">
                  {q ? `「${searchQuery}」に一致する作品がありません` : '作品が登録されていません。タブから新規追加してください。'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map(img => (
                  <div key={img.id} className="bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
                    <div className="relative aspect-square bg-[#FBFAF9]">
                      <img src={img.url} alt="Portfolio" className="w-full h-full object-cover" />
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-[12px] font-bold text-[#2D4B3E] shadow-sm">
                        {img.priceHidden ? '金額: お問い合わせ' : `¥${Number(img.price).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      {img.managementNo && (
                        <p className="text-[10px] font-mono text-[#2D4B3E] bg-[#2D4B3E]/10 px-2 py-1 rounded mb-2 w-fit">
                          📋 {img.managementNo}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {img.flowerType && <span className="px-2 py-1 bg-[#2D4B3E] border border-[#2D4B3E] rounded text-[10px] font-bold text-white shadow-sm">{img.flowerType}</span>}
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
              );
            })()}
          </div>
        )}

        {/* =========================================================
            ★ 新機能：納品写真から作成するタブ
            ========================================================= */}
        {activeTab === 'from_orders' && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-[14px] font-bold text-[#D97D54] mb-6 border-l-4 border-[#D97D54] pl-3 flex items-center gap-2">
              <Camera size={18}/> 注文詳細でアップロードされた完成写真
            </h2>
            
            {pendingCompletedOrders.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#EAEAEA] text-[#999999] text-[13px] font-bold">
                作品登録が必要な完成写真はありません。<br/>
                <span className="text-[11px] font-normal block mt-2">注文詳細画面から完成写真をアップロードすると、ここに自動的に表示されます。<br/>登録済みの作品は「登録済み一覧」タブから確認できます。</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingCompletedOrders.map(order => {
                  const d = order.order_data;
                  return (
                    <div key={order.id} className="bg-white rounded-2xl border border-[#EAEAEA] overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group">
                      <div className="relative aspect-square bg-[#FBFAF9]">
                        <img src={d.completionImage} alt="Completion" className="w-full h-full object-cover" />
                        <div className="absolute top-3 left-3 bg-[#111111]/70 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1">
                          ID: {order.id.slice(0, 6)}
                        </div>
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <p className="text-[14px] font-bold text-[#2D4B3E] truncate">{d.customerInfo?.name} 様のご注文</p>
                          <p className="text-[11px] font-bold text-[#999999] mt-1">{d.flowerType || '未設定'} / ¥{Number(d.itemPrice || 0).toLocaleString()}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 bg-[#F7F7F7] text-[#555] rounded text-[9px]">{d.flowerPurpose || '用途未定'}</span>
                          <span className="px-2 py-0.5 bg-[#F7F7F7] text-[#555] rounded text-[9px]">{d.flowerColor || '色未定'}</span>
                          <span className="px-2 py-0.5 bg-[#F7F7F7] text-[#555] rounded text-[9px]">{d.flowerVibe || 'イメージ未定'}</span>
                        </div>
                        <button 
                          onClick={() => handleSelectOrderImage(order)}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-[#D97D54]/10 text-[#D97D54] rounded-xl font-bold text-[12px] hover:bg-[#D97D54] hover:text-white transition-all group-hover:shadow-md"
                        >
                          この写真で作品を登録 <ArrowRight size={14}/>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 手動登録（＆ 納品写真からの編集画面） */}
        {activeTab === 'new' && (
          <form onSubmit={handleAddSubmit} className="bg-white p-6 md:p-8 rounded-2xl border border-[#EAEAEA] shadow-sm max-w-[800px] space-y-6 animate-in fade-in relative">
            
            {/* 納品写真から引き継いだ場合のお知らせバッジ */}
            {newImage.uploadFile === 'from_order' && (
              <div className="absolute -top-3 -right-3 md:top-6 md:right-8 bg-[#D97D54] text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1">
                <CheckCircle size={12}/> 注文情報を引き継ぎました
              </div>
            )}

            <h2 className="text-[16px] font-bold text-[#2D4B3E] border-b border-[#FBFAF9] pb-4">新規作品の登録</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="relative w-full aspect-square bg-[#FBFAF9] border-2 border-dashed border-[#EAEAEA] rounded-2xl flex items-center justify-center overflow-hidden hover:bg-gray-50 transition-colors">
                  {newImage.url ? (
                    <img src={newImage.url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-[#999999] space-y-2">
                      <ImageIcon size={32} className="mx-auto opacity-50" />
                      <span className="text-[12px] font-bold block">クリックして選択</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {/* ★ 差し替えバッジ（写真がある時のみ） */}
                  {newImage.url && (
                    <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur text-[10px] font-bold text-[#2D4B3E] text-center py-1.5 rounded-lg shadow-sm pointer-events-none">
                      📷 クリックで写真を差し替え
                    </div>
                  )}
                </div>
                {newImage.uploadFile === 'from_order' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[10px] text-amber-900 leading-relaxed">
                    💡 <strong>完成写真がセットされています。</strong><br/>
                    メッセージカード等が写り込んでいる場合は、写真エリアをクリックして別の写真に差し替えできます。SNS掲載に不適切な要素が映ったままにならないようにご注意ください。
                  </div>
                )}
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
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#999999] flex items-center justify-between">
                      <span>お花の種類</span> <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">必須</span>
                    </label>
                    <select required value={newImage.flowerType} onChange={e => setNewImage({...newImage, flowerType: e.target.value})} className="w-full h-12 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[13px] font-bold focus:border-[#2D4B3E] outline-none">
                      <option value="">選択</option>
                      {flowerItems.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                      <option value="その他">その他</option>
                    </select>
                  </div>
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
                  <div className="space-y-1">
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
                      <Wand2 size={12} /> {isGenerating ? '生成中...' : 'APIで自動生成'}
                    </button>
                  </div>
                  <textarea
                    value={newImage.caption}
                    onChange={e => setNewImage({ ...newImage, caption: e.target.value })}
                    placeholder="AIボタンを押すか、直接入力してください。"
                    className="w-full h-32 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-4 text-[13px] resize-none focus:border-[#2D4B3E] outline-none"
                  ></textarea>
                </div>

                {/* ★ 管理番号（キャプション先頭にも自動反映） */}
                <div>
                  <label className="text-[11px] font-bold text-[#999999]">📋 管理番号 <span className="text-[10px] text-[#bbb]">(注文から自動引き継ぎ・キャプション先頭にも反映)</span></label>
                  <input
                    type="text"
                    value={newImage.managementNo || ''}
                    onChange={e => {
                      const newMn = e.target.value;
                      // キャプション先頭の「📋 xxx\n\n」を新しい管理番号で置換 or 追加
                      const cap = newImage.caption || '';
                      const stripped = cap.replace(/^📋\s+\S+\n+/, ''); // 既存の管理番号行を削除
                      const newCap = newMn.trim()
                        ? `📋 ${newMn.trim()}\n\n${stripped}`
                        : stripped;
                      setNewImage({ ...newImage, managementNo: newMn, caption: newCap });
                    }}
                    placeholder="例: 20260514-001"
                    className="w-full h-11 px-3 mt-1 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-mono outline-none focus:border-[#2D4B3E]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#EAEAEA]">
              <button type="submit" disabled={isSaving} className="w-full md:w-auto md:px-12 h-14 bg-[#2D4B3E] text-white rounded-xl font-bold text-[14px] shadow-md hover:bg-[#1f352b] transition-all active:scale-[0.98] disabled:opacity-50 mx-auto block">
                {isSaving ? '保存中...' : '作品を登録する'}
              </button>
            </div>
          </form>
        )}

        {/* ★ URL一括取込タブ */}
        {activeTab === 'import' && (
          <div className="space-y-6 max-w-[1000px] animate-in fade-in duration-300">
            {/* 入力エリア */}
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-5">
              <div>
                <h2 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2 mb-1">
                  <Sparkles size={18}/> URLから一括取り込み
                </h2>
                <p className="text-[12px] text-[#555]">
                  InstagramなどのURLを1行に1つずつ貼り付けて、画像とキャプションを自動取得します。<br/>
                  <span className="text-[11px] text-[#999]">※ Instagram は公開投稿のみ対応 / 1度に30件まで推奨 / 過去投稿で金額非公開のものは「金額を非公開」にチェックを入れてください</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#555]">URL（1行に1つずつ貼り付け）</label>
                <textarea
                  value={bulkUrls}
                  onChange={e => setBulkUrls(e.target.value)}
                  rows={6}
                  placeholder={'https://www.instagram.com/p/XXXXXXX/\nhttps://www.instagram.com/p/YYYYYYY/\nhttps://www.instagram.com/p/ZZZZZZZ/'}
                  className="w-full bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 py-3 text-[12px] font-mono outline-none focus:border-[#2D4B3E] resize-y leading-relaxed"
                  disabled={isExtracting}
                />
                <p className="text-[10px] text-[#999]">
                  検出URL: <strong>{bulkUrls.split(/[\n,\s]+/).filter(u => /^https?:\/\//.test(u.trim())).length}</strong>件
                </p>
              </div>

              {/* 一括設定 */}
              <div className="bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-4 space-y-3">
                <p className="text-[11px] font-bold text-[#2D4B3E]">📌 全アイテムに一括適用する初期値（後から個別変更可能）</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-[#999]">お花の種類</label>
                    <select value={bulkApply.flowerType} onChange={e => setBulkApply({...bulkApply, flowerType: e.target.value})} className="w-full h-10 bg-white border border-[#EAEAEA] rounded-lg px-2 text-[11px] outline-none">
                      <option value="">未選択</option>
                      {flowerItems.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#999]">用途</label>
                    <select value={bulkApply.purpose} onChange={e => setBulkApply({...bulkApply, purpose: e.target.value})} className="w-full h-10 bg-white border border-[#EAEAEA] rounded-lg px-2 text-[11px] outline-none">
                      <option value="">未選択</option>
                      {designOptions.purposes.map(p => <option key={p} value={p}>{p}</option>)}
                      <option value="その他">その他</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#999]">カラー</label>
                    <select value={bulkApply.color} onChange={e => setBulkApply({...bulkApply, color: e.target.value})} className="w-full h-10 bg-white border border-[#EAEAEA] rounded-lg px-2 text-[11px] outline-none">
                      <option value="">未選択</option>
                      {designOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#999]">イメージ</label>
                    <select value={bulkApply.vibe} onChange={e => setBulkApply({...bulkApply, vibe: e.target.value})} className="w-full h-10 bg-white border border-[#EAEAEA] rounded-lg px-2 text-[11px] outline-none">
                      <option value="">未選択</option>
                      {designOptions.vibes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-[#555] pt-2">
                  <input type="checkbox" checked={bulkApply.priceHidden} onChange={e => setBulkApply({...bulkApply, priceHidden: e.target.checked})} className="w-4 h-4 accent-[#2D4B3E]"/>
                  💰 金額を非公開にする（過去投稿用 / お客様画面では「お問い合わせください」と表示）
                </label>
              </div>

              <button
                onClick={handleBulkExtract}
                disabled={isExtracting || !bulkUrls.trim()}
                className="w-full h-14 bg-[#2D4B3E] text-white rounded-xl font-bold text-[14px] shadow-md hover:bg-[#1f352b] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="animate-spin" size={18}/>
                    取得中... ({extractProgress.done}/{extractProgress.total})
                    {extractProgress.errors > 0 && <span className="text-[11px] opacity-80">エラー: {extractProgress.errors}</span>}
                  </>
                ) : (
                  <><Sparkles size={16}/> URLから画像を取得する</>
                )}
              </button>
            </div>

            {/* 取込結果リスト */}
            {extractedItems.length > 0 && (
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-[#EAEAEA] shadow-sm space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-[14px] font-bold text-[#2D4B3E]">
                    📷 取込結果 ({extractedItems.length}件 / 選択中: {extractedItems.filter(it => it.selected).length}件)
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => toggleSelectAll(true)} className="text-[10px] font-bold text-[#555] bg-[#FBFAF9] border border-[#EAEAEA] px-3 py-1.5 rounded-lg hover:bg-white">すべて選択</button>
                    <button onClick={() => toggleSelectAll(false)} className="text-[10px] font-bold text-[#555] bg-[#FBFAF9] border border-[#EAEAEA] px-3 py-1.5 rounded-lg hover:bg-white">すべて解除</button>
                    <button onClick={applyBulkToAll} className="text-[10px] font-bold text-white bg-[#117768] px-3 py-1.5 rounded-lg hover:bg-[#0d5e54]">📌 一括設定を全件に再適用</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {extractedItems.map((it, idx) => (
                    <div key={idx} className={`border rounded-xl overflow-hidden transition-all ${it.selected ? 'border-[#2D4B3E] bg-white' : 'border-[#EAEAEA] bg-[#FBFAF9] opacity-60'}`}>
                      <div className="flex gap-3 p-3">
                        <label className="flex-shrink-0 cursor-pointer">
                          <input type="checkbox" checked={it.selected} onChange={e => setExtractedItems(items => items.map((x,i) => i === idx ? {...x, selected: e.target.checked} : x))} className="w-4 h-4 accent-[#2D4B3E] mt-2"/>
                        </label>
                        <div className="w-24 h-24 flex-shrink-0 bg-[#FBFAF9] rounded-lg overflow-hidden">
                          <img src={it.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer"/>
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <a href={it.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-[#2D4B3E] hover:underline truncate flex items-center gap-1">
                            <ExternalLink size={10}/> {it.sourceUrl.replace(/^https?:\/\//, '').slice(0, 40)}...
                          </a>
                          {it.title && <p className="text-[11px] font-bold text-[#111] line-clamp-1">{it.title}</p>}
                          {it.description && <p className="text-[10px] text-[#555] line-clamp-2 leading-relaxed">{it.description}</p>}
                          <button onClick={() => removeExtractedItem(idx)} className="text-[10px] text-red-500 font-bold hover:underline">削除</button>
                        </div>
                      </div>
                      <div className="px-3 pb-3 space-y-2 border-t border-[#EAEAEA] pt-3 bg-[#FBFAF9]/50">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-[#999]">花の種類</label>
                            <select value={it.flowerType} onChange={e => setExtractedItems(items => items.map((x,i) => i === idx ? {...x, flowerType: e.target.value} : x))} className="w-full h-8 bg-white border border-[#EAEAEA] rounded text-[10px] px-1 outline-none">
                              <option value="">選択</option>
                              {flowerItems.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                              <option value="その他">その他</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-[#999]">用途</label>
                            <select value={it.purpose} onChange={e => setExtractedItems(items => items.map((x,i) => i === idx ? {...x, purpose: e.target.value} : x))} className="w-full h-8 bg-white border border-[#EAEAEA] rounded text-[10px] px-1 outline-none">
                              <option value="">選択</option>
                              {designOptions.purposes.map(p => <option key={p} value={p}>{p}</option>)}
                              <option value="その他">その他</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-[#999]">カラー</label>
                            <select value={it.color} onChange={e => setExtractedItems(items => items.map((x,i) => i === idx ? {...x, color: e.target.value} : x))} className="w-full h-8 bg-white border border-[#EAEAEA] rounded text-[10px] px-1 outline-none">
                              <option value="">選択</option>
                              {designOptions.colors.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-[#999]">イメージ</label>
                            <select value={it.vibe} onChange={e => setExtractedItems(items => items.map((x,i) => i === idx ? {...x, vibe: e.target.value} : x))} className="w-full h-8 bg-white border border-[#EAEAEA] rounded text-[10px] px-1 outline-none">
                              <option value="">選択</option>
                              {designOptions.vibes.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-[#555] whitespace-nowrap">
                            <input type="checkbox" checked={it.priceHidden} onChange={e => setExtractedItems(items => items.map((x,i) => i === idx ? {...x, priceHidden: e.target.checked} : x))} className="w-3 h-3 accent-[#2D4B3E]"/>
                            金額非公開
                          </label>
                          {!it.priceHidden && (
                            <input
                              type="number"
                              value={it.price}
                              onChange={e => setExtractedItems(items => items.map((x,i) => i === idx ? {...x, price: e.target.value} : x))}
                              placeholder="¥金額 (税抜)"
                              className="flex-1 h-8 bg-white border border-[#EAEAEA] rounded text-[11px] px-2 font-bold outline-none"
                            />
                          )}
                        </div>
                        <textarea
                          value={it.caption}
                          onChange={e => setExtractedItems(items => items.map((x,i) => i === idx ? {...x, caption: e.target.value} : x))}
                          rows={2}
                          placeholder="キャプション（任意）"
                          className="w-full bg-white border border-[#EAEAEA] rounded text-[10px] p-2 outline-none resize-none leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleBulkSave}
                  disabled={isBulkSaving || extractedItems.filter(it => it.selected).length === 0}
                  className="w-full h-14 bg-[#117768] text-white rounded-xl font-bold text-[14px] shadow-md hover:bg-[#0d5e54] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBulkSaving ? <><Loader2 className="animate-spin" size={18}/> 保存中...</> : <><CheckCircle size={16}/> 選択した{extractedItems.filter(it => it.selected).length}件を作品として登録</>}
                </button>
              </div>
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