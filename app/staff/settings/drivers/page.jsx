'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../../utils/supabase';
import Link from 'next/link';
import { UserCheck, Ban, Upload, ShieldAlert, ShieldCheck, Plus, CheckCircle, Clock } from 'lucide-react';

export default function DriversPage() {
  const [appSettings, setAppSettings] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, active, blocked

  // 新規登録モーダル用
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', maxDeliveries: 10 });

  // 画像プレビュー用
  const [previewImage, setPreviewImage] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => {
    async function fetchDrivers() {
      try {
        const { data, error } = await supabase.from('app_settings').select('settings_data').eq('id', 'default').single();
        if (error) throw error;
        
        if (data && data.settings_data) {
          setAppSettings(data.settings_data);
          // JSONの中からdrivers配列を取得（なければ空配列）
          setDrivers(data.settings_data.drivers || []);
        }
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDrivers();
  }, []);

  const generalConfig = appSettings?.generalConfig || {};
  const logoUrl = generalConfig.logoUrl || '';
  const appName = generalConfig.appName || 'FLORIX';

  // データベース保存関数
  const saveDriversToDB = async (updatedDrivers) => {
    try {
      const newSettings = { ...appSettings, drivers: updatedDrivers };
      const { error } = await supabase.from('app_settings').update({ settings_data: newSettings }).eq('id', 'default');
      if (error) throw error;
      setAppSettings(newSettings);
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました。');
    }
  };

  // 新規追加
  const handleAddDriver = async () => {
    if (!newDriver.name) {
      alert('名前を入力してください。');
      return;
    }
    
    const driverObj = {
      id: Date.now().toString(),
      name: newDriver.name,
      phone: newDriver.phone,
      status: 'pending', // 初期状態は「承認待ち」
      maxDeliveries: newDriver.maxDeliveries,
      documents: { blackNumber: null, insurance: null, insuranceExpiry: '' },
      createdAt: new Date().toISOString()
    };

    const updated = [driverObj, ...drivers];
    setDrivers(updated);
    await saveDriversToDB(updated);
    
    setIsModalOpen(false);
    setNewDriver({ name: '', phone: '', maxDeliveries: 10 });
  };

  // ステータス変更（承認 / ブロック / 待機）
  const changeStatus = async (id, newStatus) => {
    // 稼働中にする場合、保険の期限が切れていないか簡易チェック
    const target = drivers.find(d => d.id === id);
    if (newStatus === 'active' && target.documents) {
      const expiry = target.documents.insuranceExpiry;
      const today = new Date().toISOString().split('T')[0];
      if (!target.documents.blackNumber || !target.documents.insurance) {
        if (!confirm('書類の画像が提出されていませんが、稼働を承認しますか？')) return;
      }
      if (expiry && expiry < today) {
        alert('保険の有効期限が切れています！新しい証券を確認してください。');
        return;
      }
    }

    const updated = drivers.map(d => d.id === id ? { ...d, status: newStatus } : d);
    setDrivers(updated);
    await saveDriversToDB(updated);
  };

  // 書類の更新
  const updateDocumentField = async (id, field, value) => {
    const updated = drivers.map(d => {
      if (d.id === id) {
        return { ...d, documents: { ...(d.documents || {}), [field]: value } };
      }
      return d;
    });
    setDrivers(updated);
    await saveDriversToDB(updated);
  };

  // 件数上限の更新
  const updateMaxDeliveries = async (id, value) => {
    const updated = drivers.map(d => d.id === id ? { ...d, maxDeliveries: Number(value) } : d);
    setDrivers(updated);
    await saveDriversToDB(updated);
  };

  // 画像圧縮関数
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > 800) { height = Math.round((height * 800) / width); width = 800; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  const handleUploadDoc = async (id, field, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingId(`${id}-${field}`);
    try {
      const compressed = await compressImage(file);
      await updateDocumentField(id, field, compressed);
    } catch (err) {
      alert('アップロードに失敗しました。');
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  };

  // 表示のフィルタリング
  const filteredDrivers = drivers.filter(d => filter === 'all' || d.status === filter);

  if (isLoading) return <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] animate-pulse">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col md:flex-row text-[#111111] font-sans">
      
      {/* サイドバー */}
      <aside className="w-full md:w-64 bg-white border-r border-[#EAEAEA] md:fixed h-full z-20 overflow-y-auto pb-10 hidden md:block">
        <div className="p-8 flex flex-col gap-1 border-b border-[#EAEAEA]">
          {logoUrl ? <img src={logoUrl} alt={appName} className="h-8 object-contain object-left mb-1" /> : <span className="font-serif italic text-[24px] tracking-tight text-[#2D4B3E]">{appName}</span>}
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#999999] pt-1">管理ワークスペース</span>
        </div>
        <nav className="p-4 space-y-1">
          <Link href="/staff/orders" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">受注一覧</Link>
          <Link href="/staff/deliveries" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[13px] font-bold tracking-wider transition-all">配達・ルート管理</Link>
          <Link href="/staff/settings" className="block px-6 py-4 rounded-xl bg-[#2D4B3E]/5 text-[#2D4B3E] shadow-sm border border-[#2D4B3E]/10 text-[13px] font-bold tracking-wider transition-all mt-4 border-t border-[#EAEAEA] pt-4">各種設定</Link>
          <Link href="/staff/settings/drivers" className="block px-6 py-4 rounded-xl text-[#555555] hover:bg-[#F7F7F7] text-[12px] font-bold tracking-wider ml-4 border-l-2 border-[#EAEAEA]">↳ ドライバー管理</Link>
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 flex flex-col min-w-0 pb-32">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2">
            <UserCheck size={20} /> ドライバー ＆ 配送リソース管理
          </h1>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1 bg-[#2D4B3E] text-white px-4 py-2 rounded-lg text-[12px] font-bold shadow-sm hover:bg-[#1f352b] transition-all">
            <Plus size={16} /> 新規登録
          </button>
        </header>

        <div className="max-w-[1000px] mx-auto w-full p-4 md:p-8 space-y-6">
          
          <div className="flex flex-wrap gap-2 mb-6">
            {[{ id: 'all', label: 'すべて' }, { id: 'pending', label: '審査・承認待ち' }, { id: 'active', label: '稼働中' }, { id: 'blocked', label: 'ブロック (NG)' }].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setFilter(tab.id)}
                className={`px-5 py-2.5 rounded-full text-[12px] font-bold transition-all ${filter === tab.id ? 'bg-[#2D4B3E] text-white shadow-md' : 'bg-white text-[#555555] border border-[#EAEAEA] hover:bg-gray-50'}`}
              >
                {tab.label} 
                {tab.id === 'pending' && drivers.filter(d => d.status === 'pending').length > 0 && (
                  <span className="ml-2 bg-orange-500 text-white px-1.5 py-0.5 rounded-full text-[10px]">{drivers.filter(d => d.status === 'pending').length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {filteredDrivers.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-[#EAEAEA] text-[#999999] font-bold">
                該当するドライバーはいません。
              </div>
            ) : (
              filteredDrivers.map(driver => {
                const docs = driver.documents || {};
                const today = new Date().toISOString().split('T')[0];
                const isExpired = docs.insuranceExpiry && docs.insuranceExpiry < today;
                
                return (
                  <div key={driver.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${driver.status === 'blocked' ? 'border-red-200 opacity-60' : 'border-[#EAEAEA]'}`}>
                    
                    {/* カードヘッダー */}
                    <div className="flex flex-wrap justify-between items-center bg-[#FBFAF9] px-6 py-4 border-b border-[#EAEAEA]">
                      <div className="flex items-center gap-4">
                        <span className="text-[18px] font-bold text-[#111111]">{driver.name}</span>
                        <span className="text-[12px] text-[#555555]">📞 {driver.phone || '未設定'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {driver.status === 'pending' && <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[11px] font-bold"><Clock size={12}/> 承認待ち</span>}
                        {driver.status === 'active' && <span className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-[11px] font-bold"><CheckCircle size={12}/> 稼働中</span>}
                        {driver.status === 'blocked' && <span className="flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-[11px] font-bold"><Ban size={12}/> ブロック</span>}
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* 左側：法的チェック・書類 */}
                      <div className="space-y-5">
                        <p className="text-[12px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 flex items-center gap-1">
                          <ShieldCheck size={16} /> 法的チェック・書類提出
                        </p>
                        
                        {/* 黒ナンバー */}
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-bold text-[#555555]">事業用ナンバー(黒ナンバー)</span>
                          {docs.blackNumber ? (
                            <div className="flex gap-2 items-center">
                              <button onClick={() => setPreviewImage(docs.blackNumber)} className="text-[11px] bg-[#2D4B3E]/10 text-[#2D4B3E] px-3 py-1 rounded font-bold hover:bg-[#2D4B3E] hover:text-white transition-all">確認</button>
                              <label className="text-[10px] text-[#999999] underline cursor-pointer hover:text-[#2D4B3E]">再UP<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadDoc(driver.id, 'blackNumber', e)}/></label>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex items-center gap-1 bg-gray-100 text-gray-500 px-3 py-1.5 rounded text-[11px] font-bold hover:bg-gray-200 transition-all">
                              {uploadingId === `${driver.id}-blackNumber` ? '送信中...' : <><Upload size={14}/> 画像を提出</>}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadDoc(driver.id, 'blackNumber', e)}/>
                            </label>
                          )}
                        </div>

                        {/* 保険証券 */}
                        <div className="space-y-2 pt-3 border-t border-dashed border-[#EAEAEA]">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-[#555555]">任意保険証券 (事業用)</span>
                            {docs.insurance ? (
                              <div className="flex gap-2 items-center">
                                <button onClick={() => setPreviewImage(docs.insurance)} className="text-[11px] bg-[#2D4B3E]/10 text-[#2D4B3E] px-3 py-1 rounded font-bold hover:bg-[#2D4B3E] hover:text-white transition-all">確認</button>
                                <label className="text-[10px] text-[#999999] underline cursor-pointer hover:text-[#2D4B3E]">再UP<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadDoc(driver.id, 'insurance', e)}/></label>
                              </div>
                            ) : (
                              <label className="cursor-pointer flex items-center gap-1 bg-gray-100 text-gray-500 px-3 py-1.5 rounded text-[11px] font-bold hover:bg-gray-200 transition-all">
                                {uploadingId === `${driver.id}-insurance` ? '送信中...' : <><Upload size={14}/> 画像を提出</>}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadDoc(driver.id, 'insurance', e)}/>
                              </label>
                            )}
                          </div>
                          <div className="flex items-center justify-between bg-[#FBFAF9] p-2 rounded-lg border border-[#EAEAEA]">
                            <span className="text-[11px] text-[#555555]">有効期限:</span>
                            <div className="flex items-center gap-2">
                              {isExpired && <ShieldAlert size={14} className="text-red-500" />}
                              <input 
                                type="date" 
                                value={docs.insuranceExpiry || ''} 
                                onChange={(e) => updateDocumentField(driver.id, 'insuranceExpiry', e.target.value)}
                                className={`text-[12px] font-bold font-mono outline-none bg-transparent ${isExpired ? 'text-red-500' : 'text-[#2D4B3E]'}`} 
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 右側：リソース制限 ＆ 操作 */}
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <p className="text-[12px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2">リソース（件数）制限</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-[#555555]">1日の最大配達枠</span>
                            <div className="flex items-center gap-1">
                              <input 
                                type="number" 
                                value={driver.maxDeliveries} 
                                onChange={(e) => updateMaxDeliveries(driver.id, e.target.value)} 
                                className="w-16 h-8 text-center border border-[#EAEAEA] rounded font-bold text-[13px] outline-none focus:border-[#2D4B3E]"
                              />
                              <span className="text-[11px] text-[#999999]">件まで</span>
                            </div>
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="pt-4 border-t border-[#EAEAEA] flex gap-2 justify-end">
                          {driver.status !== 'blocked' && (
                            <button onClick={() => changeStatus(driver.id, 'blocked')} className="px-4 py-2 border border-red-200 text-red-500 font-bold text-[11px] rounded-lg hover:bg-red-50 transition-all flex items-center gap-1">
                              <Ban size={14} /> ブロックする
                            </button>
                          )}
                          {driver.status === 'blocked' && (
                            <button onClick={() => changeStatus(driver.id, 'pending')} className="px-4 py-2 border border-gray-300 text-gray-600 font-bold text-[11px] rounded-lg hover:bg-gray-100 transition-all">
                              ブロック解除
                            </button>
                          )}
                          {driver.status !== 'active' && driver.status !== 'blocked' && (
                            <button onClick={() => changeStatus(driver.id, 'active')} className="px-6 py-2 bg-[#2D4B3E] text-white font-bold text-[12px] rounded-lg shadow-sm hover:bg-[#1f352b] transition-all">
                              本登録として承認
                            </button>
                          )}
                          {driver.status === 'active' && (
                            <button onClick={() => changeStatus(driver.id, 'pending')} className="px-4 py-2 bg-orange-50 text-orange-600 font-bold text-[11px] rounded-lg border border-orange-200 hover:bg-orange-100 transition-all">
                              稼働を一時停止
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      {/* 新規登録モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-[24px] shadow-2xl p-8 max-w-md w-full space-y-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold text-[#2D4B3E]">新規ドライバー追加</h2>
            <div className="space-y-4">
              <div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">氏名</label><input type="text" value={newDriver.name} onChange={(e)=>setNewDriver({...newDriver, name: e.target.value})} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E] text-[14px]" placeholder="例：鈴木 太郎" /></div>
              <div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">電話番号</label><input type="tel" value={newDriver.phone} onChange={(e)=>setNewDriver({...newDriver, phone: e.target.value})} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E] text-[14px]" placeholder="例：090-0000-0000" /></div>
              <div className="space-y-1"><label className="text-[11px] font-bold text-[#999999]">1日の件数上限 (初期値)</label><input type="number" value={newDriver.maxDeliveries} onChange={(e)=>setNewDriver({...newDriver, maxDeliveries: Number(e.target.value)})} className="w-full h-12 px-4 border border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E] text-[14px]" /></div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl font-bold text-[#555555] text-[13px] hover:bg-gray-100">キャンセル</button>
              <button onClick={handleAddDriver} className="flex-1 py-3 bg-[#2D4B3E] text-white rounded-xl font-bold text-[13px] shadow-md hover:bg-[#1f352b]">登録する</button>
            </div>
          </div>
        </div>
      )}

      {/* 画像プレビューモーダル */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-10 right-0 text-white font-bold text-[14px] bg-black/50 px-4 py-2 rounded-full hover:bg-black transition-all">✕ 閉じる</button>
            <img src={previewImage} alt="Document" className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl bg-white" />
          </div>
        </div>
      )}

    </div>
  );
}