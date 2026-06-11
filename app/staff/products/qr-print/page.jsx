// [POS-#28] QRコード印刷ページ
// 3パターン選択可:
//   ① A4シート一括印刷（40枚/ページ等）
//   ② 個別ダウンロード（PNG/SVG）
//   ③ 商品タグ付き（QR + 商品名 + 価格 + 取扱注意）

'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, Printer, Download, CheckSquare, Square, Tag, Grid3x3, ImageIcon, Loader2 } from 'lucide-react';
import { getProductQrUrl, getQrCodeDataUrl, getQrCodeSvg } from '@/utils/qrcode';

export default function QrPrintPage() {
  const [tenantId, setTenantId] = useState(null);
  const [shopName, setShopName] = useState('FLORIX');
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [printMode, setPrintMode] = useState('sheet'); // 'sheet' | 'tag' | 'individual'
  const [isLoading, setIsLoading] = useState(true);
  const [qrDataUrls, setQrDataUrls] = useState({}); // { productId: dataUrl }

  useEffect(() => {
    initData();
  }, []);

  async function initData() {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/staff/login';
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
      const tId = profile?.tenant_id;
      if (!tId) throw new Error('tenant_id が取得できません');
      setTenantId(tId);

      // 店舗名取得
      const { data: settingsRow } = await supabase.from('app_settings').select('settings_data').eq('id', tId).single();
      const shops = settingsRow?.settings_data?.shops || [];
      setShopName(shops[0]?.name || settingsRow?.settings_data?.generalConfig?.appName || 'FLORIX');

      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, stock, is_active')
        .eq('tenant_id', tId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      console.warn(e?.message);
    } finally {
      setIsLoading(false);
    }
  }

  // 選択した商品のQRをDataURLに変換
  const generateQrs = useCallback(async () => {
    if (!tenantId) return;
    const targets = products.filter(p => selectedIds.has(p.id));
    const newQrs = { ...qrDataUrls };
    for (const p of targets) {
      if (!newQrs[p.id]) {
        const url = getProductQrUrl(tenantId, p.id);
        newQrs[p.id] = await getQrCodeDataUrl(url, { width: 200 });
      }
    }
    setQrDataUrls(newQrs);
  }, [tenantId, products, selectedIds, qrDataUrls]);

  useEffect(() => {
    if (selectedIds.size > 0) generateQrs();
  }, [selectedIds, generateQrs]);

  function toggleSelect(productId) {
    const next = new Set(selectedIds);
    if (next.has(productId)) next.delete(productId); else next.add(productId);
    setSelectedIds(next);
  }

  function selectAll() { setSelectedIds(new Set(products.map(p => p.id))); }
  function clearSelection() { setSelectedIds(new Set()); }

  async function downloadIndividual(product) {
    const url = getProductQrUrl(tenantId, product.id);
    const svg = await getQrCodeSvg(url, { width: 600 });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `qr_${product.name.replace(/[^a-zA-Z0-9一-龯ぁ-んァ-ヴ]/g, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
  }

  function handlePrint() {
    window.print();
  }

  const selectedProducts = products.filter(p => selectedIds.has(p.id));

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-[#2D4B3E]">読み込み中...</div>;
  }

  return (
    <main className="pb-32 font-sans">
      {/* ヘッダー（印刷時は非表示） */}
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 sticky top-0 z-10 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/staff/products" className="flex items-center gap-1 text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 商品管理に戻る
          </Link>
          <h1 className="text-[18px] font-bold text-[#2D4B3E]">📱 QRコード印刷</h1>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#999]">{selectedIds.size}個 選択中</span>
            <button onClick={handlePrint} className="px-4 h-10 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold hover:bg-[#1f352b] flex items-center gap-2">
              <Printer size={14}/> 印刷
            </button>
          </div>
        )}
      </header>

      <div className="max-w-[1200px] mx-auto p-6 space-y-6 print:p-0">
        {/* 印刷モード選択 */}
        <div className="bg-white border border-[#EAEAEA] rounded-2xl p-5 space-y-3 print:hidden">
          <h2 className="text-[13px] font-bold text-[#2D4B3E]">印刷モード</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setPrintMode('sheet')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${printMode === 'sheet' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-white border-[#EAEAEA] hover:border-[#2D4B3E]'}`}
            >
              <Grid3x3 size={20} className={`mb-2 ${printMode === 'sheet' ? 'text-white' : 'text-[#2D4B3E]'}`}/>
              <p className="text-[12px] font-bold mb-1">① A4シート一括</p>
              <p className={`text-[10px] leading-relaxed ${printMode === 'sheet' ? 'text-white/80' : 'text-[#999]'}`}>1ページに小さなQRを並べて一気に印刷。シール用紙対応</p>
            </button>
            <button
              onClick={() => setPrintMode('tag')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${printMode === 'tag' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-white border-[#EAEAEA] hover:border-[#2D4B3E]'}`}
            >
              <Tag size={20} className={`mb-2 ${printMode === 'tag' ? 'text-white' : 'text-[#2D4B3E]'}`}/>
              <p className="text-[12px] font-bold mb-1">② 商品タグ付き</p>
              <p className={`text-[10px] leading-relaxed ${printMode === 'tag' ? 'text-white/80' : 'text-[#999]'}`}>QR + 商品名 + 価格 + 取扱注意のおしゃれなタグデザイン</p>
            </button>
            <button
              onClick={() => setPrintMode('individual')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${printMode === 'individual' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E]' : 'bg-white border-[#EAEAEA] hover:border-[#2D4B3E]'}`}
            >
              <Download size={20} className={`mb-2 ${printMode === 'individual' ? 'text-white' : 'text-[#2D4B3E]'}`}/>
              <p className="text-[12px] font-bold mb-1">③ 個別ダウンロード</p>
              <p className={`text-[10px] leading-relaxed ${printMode === 'individual' ? 'text-white/80' : 'text-[#999]'}`}>SVG形式で1つずつDL。シールプリンター（テプラ等）に</p>
            </button>
          </div>
        </div>

        {/* 商品選択 */}
        <div className="bg-white border border-[#EAEAEA] rounded-2xl p-5 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-[#2D4B3E]">商品を選択（{selectedIds.size}/{products.length}）</h2>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-[11px] text-[#2D4B3E] font-bold hover:underline">すべて選択</button>
              <span className="text-[#CCC]">/</span>
              <button onClick={clearSelection} className="text-[11px] text-[#999] font-bold hover:underline">選択解除</button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {products.map(p => {
              const isSelected = selectedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleSelect(p.id)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${isSelected ? 'bg-[#2D4B3E]/5 border-[#2D4B3E]' : 'bg-white border-[#EAEAEA] hover:border-[#2D4B3E]/30'}`}
                >
                  {isSelected ? <CheckSquare size={16} className="text-[#2D4B3E] shrink-0"/> : <Square size={16} className="text-[#CCC] shrink-0"/>}
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="w-8 h-8 object-cover rounded shrink-0"/>
                  ) : (
                    <div className="w-8 h-8 bg-[#FBFAF9] rounded flex items-center justify-center shrink-0"><ImageIcon size={12} className="text-[#CCC]"/></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">{p.name}</p>
                    <p className="text-[9px] text-[#999]">¥{p.price.toLocaleString()} / 在庫{p.stock}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* プレビュー（印刷対象） */}
        {selectedProducts.length > 0 && (
          <div className="print:break-inside-avoid">
            {printMode === 'sheet' && (
              <div className="bg-white p-4 print:p-0">
                <h2 className="text-[12px] font-bold text-[#999] mb-3 print:hidden">📄 プレビュー（A4シート一括）</h2>
                <div className="grid grid-cols-5 gap-2 print:gap-1">
                  {selectedProducts.map(p => (
                    <div key={p.id} className="aspect-square bg-white border border-[#EAEAEA] p-1 flex flex-col items-center justify-center print:border-dashed">
                      {qrDataUrls[p.id] ? (
                        <img src={qrDataUrls[p.id]} alt="" className="w-full"/>
                      ) : (
                        <Loader2 size={20} className="animate-spin text-[#999]"/>
                      )}
                      <p className="text-[7px] text-center mt-0.5 truncate w-full">{p.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {printMode === 'tag' && (
              <div className="bg-white p-4 print:p-0">
                <h2 className="text-[12px] font-bold text-[#999] mb-3 print:hidden">📄 プレビュー（商品タグ付き）</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedProducts.map(p => (
                    <div key={p.id} className="border-2 border-[#2D4B3E] rounded-xl p-3 bg-white print:break-inside-avoid">
                      <div className="text-center mb-2">
                        <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest line-clamp-1">{shopName}</p>
                      </div>
                      <div className="bg-white p-2 flex items-center justify-center">
                        {qrDataUrls[p.id] ? (
                          <img src={qrDataUrls[p.id]} alt="" className="w-32"/>
                        ) : (
                          <Loader2 size={24} className="animate-spin text-[#999]"/>
                        )}
                      </div>
                      <div className="text-center mt-2 space-y-1">
                        <p className="text-[12px] font-bold text-[#111] line-clamp-2">{p.name}</p>
                        <p className="text-[16px] font-bold text-[#2D4B3E]">¥{p.price.toLocaleString()}<span className="text-[10px] font-normal text-[#999] ml-1">(税抜)</span></p>
                        <div className="text-[8px] text-[#999] border-t border-[#EAEAEA] pt-1 mt-2 leading-relaxed">
                          スキャンで在庫確認
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {printMode === 'individual' && (
              <div className="bg-white p-4">
                <h2 className="text-[12px] font-bold text-[#999] mb-3">📥 個別ダウンロード</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedProducts.map(p => (
                    <div key={p.id} className="bg-white border border-[#EAEAEA] rounded-xl p-3 flex flex-col items-center">
                      {qrDataUrls[p.id] ? (
                        <img src={qrDataUrls[p.id]} alt="" className="w-32"/>
                      ) : (
                        <div className="w-32 h-32 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-[#999]"/></div>
                      )}
                      <p className="text-[12px] font-bold text-[#111] mt-2 line-clamp-1 text-center">{p.name}</p>
                      <button
                        onClick={() => downloadIndividual(p)}
                        className="mt-3 w-full h-10 bg-[#2D4B3E] text-white rounded-lg text-[11px] font-bold hover:bg-[#1f352b] flex items-center justify-center gap-1"
                      >
                        <Download size={12}/> SVGダウンロード
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 説明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-[11px] text-blue-900 leading-relaxed print:hidden">
          <p className="font-bold mb-2">📌 使い方ガイド</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li><strong>A4シート</strong>: コクヨ等のラベルシール用紙に印刷→切って貼る</li>
            <li><strong>商品タグ付き</strong>: 厚紙印刷して紐穴を空けて値札タグとして使用</li>
            <li><strong>個別DL</strong>: SVGをテプラ等のシールプリンターに転送して印刷</li>
            <li>📱 <strong>誰でもスキャン可能</strong>: 在庫数をスマホでサクッと確認できます</li>
            <li>🔒 <strong>在庫変更はPIN必須</strong>: スタッフのみ「在庫を減らす」操作可。4桁PIN入力で本人確認</li>
            <li>📋 監査ログに「誰が・いつ・何を・何個」自動記録</li>
          </ul>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 8mm; size: A4 portrait; }
          body { background: white !important; }
        }
      `}</style>
    </main>
  );
}
