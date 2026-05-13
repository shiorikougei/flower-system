'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Plus, Package, Edit2, Trash2, Image as ImageIcon, X, AlertCircle, Save, ToggleLeft, ToggleRight, Bell, Send } from 'lucide-react';

export default function StaffProductsPage() {
  const [tenantId, setTenantId] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);   // 編集中商品 or 'new' or null
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [pendingNotifyCounts, setPendingNotifyCounts] = useState({});  // 商品ID → 未通知件数

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

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data || []);

      // 未通知の入荷通知件数を取得
      const { data: notifs } = await supabase
        .from('stock_notifications')
        .select('product_id')
        .eq('tenant_id', tId)
        .is('notified_at', null);
      if (notifs) {
        const counts = {};
        for (const n of notifs) {
          counts[n.product_id] = (counts[n.product_id] || 0) + 1;
        }
        setPendingNotifyCounts(counts);
      }
    } catch (err) {
      setMessage({ type: 'error', text: '商品の読み込みに失敗しました: ' + err.message });
    } finally {
      setIsLoading(false);
    }
  }

  async function dispatchNotifications(productId) {
    const count = pendingNotifyCounts[productId] || 0;
    if (count === 0) return;
    if (!confirm(`${count}件の入荷通知メールを送信しますか？`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/stock-notify/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '送信に失敗しました');
      setMessage({ type: 'success', text: `${data.sent}件の通知メールを送信しました` });
      await initData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  function openNew() {
    setEditTarget({
      id: null,
      tenant_id: tenantId,
      name: '',
      description: '',
      price: 3000,
      stock: 10,
      image_url: '',
      category: '',
      is_active: true,
      restock_allowed: false,  // ★ 一点もの（ドライフラワー等）デフォルト
      display_order: 0,
    });
  }

  function openEdit(p) {
    setEditTarget({ ...p });
  }

  async function saveProduct() {
    if (!editTarget.name || editTarget.price <= 0) {
      setMessage({ type: 'error', text: '商品名と価格は必須です' });
      return;
    }
    setIsSaving(true);
    try {
      let imageUrl = editTarget.image_url;
      // 新規アップロードファイルがあれば Storage に保存
      if (editTarget._uploadFile) {
        const fileExt = editTarget._uploadFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${tenantId}/products/${fileName}`;
        const { error: uploadErr } = await supabase.storage
          .from('portfolio')
          .upload(filePath, editTarget._uploadFile);
        if (uploadErr) throw uploadErr;
        const { data: pub } = supabase.storage.from('portfolio').getPublicUrl(filePath);
        imageUrl = pub.publicUrl;
      }

      const payload = {
        tenant_id: tenantId,
        name: editTarget.name,
        description: editTarget.description || '',
        price: Number(editTarget.price) || 0,
        stock: Number(editTarget.stock) || 0,
        image_url: imageUrl || '',
        category: editTarget.category || '',
        is_active: Boolean(editTarget.is_active),
        restock_allowed: Boolean(editTarget.restock_allowed),  // ★ 再入荷可否
        display_order: Number(editTarget.display_order) || 0,
      };

      if (editTarget.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', editTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
      }

      setMessage({ type: 'success', text: editTarget.id ? '商品を更新しました' : '商品を追加しました' });
      setEditTarget(null);
      await initData();
    } catch (err) {
      setMessage({ type: 'error', text: '保存に失敗しました: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteProduct(id) {
    if (!confirm('この商品を削除しますか？')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setMessage({ type: 'success', text: '商品を削除しました' });
      await initData();
    } catch (err) {
      setMessage({ type: 'error', text: '削除に失敗しました: ' + err.message });
    }
  }

  async function toggleActive(p) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !p.is_active })
        .eq('id', p.id);
      if (error) throw error;
      await initData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-[#2D4B3E]">読み込み中...</div>;
  }

  return (
    <main className="pb-32 font-sans">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
        <div>
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E]">商品管理（EC）</h1>
          <p className="text-[11px] text-[#999999] mt-0.5">プリセット商品のカタログ・在庫を管理</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-5 h-11 bg-[#2D4B3E] text-white rounded-xl font-bold text-[13px] hover:bg-[#1f352b] transition-all shadow-md"
        >
          <Plus size={16} /> 新規商品
        </button>
      </header>

      <div className="max-w-[1200px] mx-auto p-4 md:p-8 space-y-6">

        {message && (
          <div className={`flex items-start gap-2 p-4 rounded-xl border ${
            message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="text-[12px] font-bold flex-1">{message.text}</p>
            <button onClick={() => setMessage(null)} className="text-[#999999] hover:text-[#111111]"><X size={14}/></button>
          </div>
        )}

        {products.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#EAEAEA]">
            <Package size={32} className="mx-auto text-[#CCC] mb-3" />
            <p className="text-[13px] font-bold text-[#999999]">商品が登録されていません</p>
            <p className="text-[11px] text-[#CCC] mt-1">「新規商品」ボタンから追加してください</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map(p => (
              <div key={p.id} className={`bg-white rounded-2xl border overflow-hidden flex flex-col group transition-all hover:shadow-md ${p.is_active ? 'border-[#EAEAEA]' : 'border-[#EAEAEA] opacity-60'}`}>
                <div className="relative aspect-square bg-[#FBFAF9]">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#CCC]"><ImageIcon size={32} /></div>
                  )}
                  {p.stock === 0 && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded">在庫切れ</div>
                  )}
                  {!p.is_active && (
                    <div className="absolute top-2 right-2 bg-[#999999] text-white text-[10px] font-bold px-2 py-1 rounded">非公開</div>
                  )}
                  {/* ★ 再入荷不可（一点もの）バッジ */}
                  {!p.restock_allowed && (
                    <div className="absolute bottom-2 left-2 bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full border border-amber-300">一点もの</div>
                  )}
                </div>
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <p className="text-[14px] font-bold text-[#111111]">{p.name}</p>
                  {p.category && <p className="text-[10px] text-[#999999]">{p.category}</p>}
                  <p className="text-[12px] text-[#555555] line-clamp-2 leading-relaxed flex-1">{p.description || '—'}</p>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-[16px] font-bold text-[#2D4B3E]">¥{p.price.toLocaleString()}</p>
                    <p className="text-[11px] text-[#999999]">在庫: <span className={p.stock <= 3 ? 'text-red-500 font-bold' : 'text-[#555555] font-bold'}>{p.stock}</span></p>
                  </div>

                  {/* 入荷通知の待機件数 */}
                  {(pendingNotifyCounts[p.id] || 0) > 0 && p.stock > 0 && (
                    <button
                      onClick={() => dispatchNotifications(p.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-[#D97D54]/10 text-[#D97D54] border border-[#D97D54]/30 hover:bg-[#D97D54] hover:text-white transition-all"
                    >
                      <Send size={12}/> {pendingNotifyCounts[p.id]}件の入荷通知を送信
                    </button>
                  )}
                  {(pendingNotifyCounts[p.id] || 0) > 0 && p.stock === 0 && (
                    <div className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold text-[#999999] bg-[#FBFAF9]">
                      <Bell size={11}/> {pendingNotifyCounts[p.id]}件の入荷待ち
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-[#F0F0F0]">
                    <button
                      onClick={() => toggleActive(p)}
                      title={p.is_active ? 'クリックで非公開にする' : 'クリックで公開する'}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition-all ${p.is_active ? 'text-green-600 hover:bg-green-50' : 'text-[#999999] hover:bg-[#F7F7F7]'}`}
                    >
                      {p.is_active ? <ToggleRight size={14}/> : <ToggleLeft size={14}/>}
                      {p.is_active ? '公開中' : '非公開'}
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold text-[#555555] hover:bg-[#FBFAF9] transition-all"
                    >
                      <Edit2 size={12}/> 編集
                    </button>
                    <button
                      onClick={() => deleteProduct(p.id)}
                      className="py-2 px-3 rounded-lg text-[11px] font-bold text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/40 backdrop-blur-sm p-4" onClick={() => !isSaving && setEditTarget(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#EAEAEA] p-5 flex justify-between items-center">
              <h2 className="text-[16px] font-bold text-[#2D4B3E]">{editTarget.id ? '商品を編集' : '新規商品を追加'}</h2>
              <button onClick={() => setEditTarget(null)} disabled={isSaving} className="text-[#999999] hover:text-[#111111]"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-5">
              {/* 画像 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999]">商品画像</label>
                <div className="aspect-square w-48 mx-auto bg-[#FBFAF9] border-2 border-dashed border-[#EAEAEA] rounded-2xl flex items-center justify-center overflow-hidden relative">
                  {(editTarget._previewUrl || editTarget.image_url) ? (
                    <img src={editTarget._previewUrl || editTarget.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-[#CCC] text-[11px]"><ImageIcon size={28} className="mx-auto mb-1"/>クリックして選択</div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 3 * 1024 * 1024) { alert('3MB以下の画像にしてください'); return; }
                      setEditTarget({ ...editTarget, _uploadFile: f, _previewUrl: URL.createObjectURL(f) });
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999]">商品名 *</label>
                  <input type="text" value={editTarget.name} onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
                    className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-bold focus:border-[#2D4B3E] outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999]">カテゴリ</label>
                  <input type="text" value={editTarget.category || ''} onChange={(e) => setEditTarget({ ...editTarget, category: e.target.value })}
                    placeholder="例: ブーケ・スタンド花 など"
                    className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-bold focus:border-[#2D4B3E] outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999]">価格（税抜）*</label>
                  <input type="number" value={editTarget.price} onChange={(e) => setEditTarget({ ...editTarget, price: e.target.value })}
                    className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-bold focus:border-[#2D4B3E] outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999]">在庫数</label>
                  <input type="number" value={editTarget.stock} onChange={(e) => setEditTarget({ ...editTarget, stock: e.target.value })}
                    className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-bold focus:border-[#2D4B3E] outline-none" />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[11px] font-bold text-[#999999]">説明</label>
                  <textarea value={editTarget.description || ''} onChange={(e) => setEditTarget({ ...editTarget, description: e.target.value })}
                    className="w-full h-24 px-4 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] resize-none focus:border-[#2D4B3E] outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999]">並び順</label>
                  <input type="number" value={editTarget.display_order} onChange={(e) => setEditTarget({ ...editTarget, display_order: e.target.value })}
                    className="w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-bold focus:border-[#2D4B3E] outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#999999]">公開状態</label>
                  <label className="flex items-center gap-2 h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] font-bold cursor-pointer">
                    <input type="checkbox" checked={editTarget.is_active} onChange={(e) => setEditTarget({ ...editTarget, is_active: e.target.checked })}
                      className="w-5 h-5 accent-[#2D4B3E]" />
                    {editTarget.is_active ? '販売中' : '非公開（停止中）'}
                  </label>
                </div>
              </div>

              {/* ★ 再入荷可否 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editTarget.restock_allowed)}
                    onChange={(e) => setEditTarget({ ...editTarget, restock_allowed: e.target.checked })}
                    className="mt-0.5 w-5 h-5 accent-[#2D4B3E]"
                  />
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-[#111111]">この商品は再入荷できる商品</p>
                    <p className="text-[11px] text-amber-900 mt-1 leading-relaxed">
                      <strong>OFF（推奨）:</strong> ドライフラワーなど一点ものの商品。在庫0になるとお客様ページから自動非表示<br/>
                      <strong>ON:</strong> 同じ商品を継続的に作る場合。在庫0でも「入荷通知に登録」ボタンが表示され、入荷時に登録者へ自動メール送信されます
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#EAEAEA] p-5 flex gap-3">
              <button onClick={() => setEditTarget(null)} disabled={isSaving}
                className="flex-1 h-12 rounded-xl border border-[#EAEAEA] text-[#555555] font-bold text-[13px] hover:bg-[#FBFAF9]">
                キャンセル
              </button>
              <button onClick={saveProduct} disabled={isSaving}
                className="flex-1 h-12 rounded-xl bg-[#2D4B3E] text-white font-bold text-[13px] hover:bg-[#1f352b] flex items-center justify-center gap-2 disabled:opacity-50">
                <Save size={14}/> {isSaving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
