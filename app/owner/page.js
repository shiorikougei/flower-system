'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { 
  Building2, Mail, ArrowUpCircle, Bot, Lock, Unlock, 
  CheckCircle, XCircle, RefreshCw, Save, Sparkles, Store
} from 'lucide-react';

const DEFAULT_AI_PROMPT = '以下のテキストからお花の「価格」「用途」「カラー」「イメージ」をJSON形式で抽出してください。価格はカンマなしの数値で出力してください。';

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState('tenants');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- SaaS運営データ（オーナー専用） ---
  const [tenants, setTenants] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInvitePlan, setNewInvitePlan] = useState('10000');
  
  const [upgradeRequests, setUpgradeRequests] = useState([]);

  // オーナー用パスワード
  const [isAuth, setIsAuth] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    async function loadOwnerData() {
      try {
        const { data, error } = await supabase.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
        if (data && data.settings_data) {
          if (data.settings_data.tenants) setTenants(data.settings_data.tenants);
          if (data.settings_data.invitations) setInvitations(data.settings_data.invitations);
          if (data.settings_data.upgradeRequests) setUpgradeRequests(data.settings_data.upgradeRequests);
        } else {
          // 初回起動時のダミーデータ（aiPromptを各店舗ごとに持たせる）
          setTenants([
            { id: 'shop_a', name: '花・花 OHANA!', email: 'info@hana-ohana.example.com', price: 10000, status: 'active', lastPaid: '2026-02-28', features: { b2b: false, deliveryOutsource: true }, aiPrompt: DEFAULT_AI_PROMPT },
            { id: 'shop_b', name: 'お花カフェ (デモ店舗)', email: 'demo@example.com', price: 0, status: 'active', lastPaid: '-', features: { b2b: true, deliveryOutsource: false }, aiPrompt: DEFAULT_AI_PROMPT },
          ]);
          setUpgradeRequests([
            { id: 'req_1', tenantId: 'shop_a', tenantName: '花・花 OHANA!', featureKey: 'b2b', featureName: '法人ポータル管理機能', date: '2026-03-15', status: 'pending' }
          ]);
        }
      } catch (err) {
        console.error('オーナーデータの読み込みエラー');
      } finally {
        setIsLoading(false);
      }
    }
    loadOwnerData();
  }, []);

  const handleLogin = () => {
    if (password === 'nocolde2026') {
      setIsAuth(true);
    } else {
      alert('アクセス権限がありません。');
    }
  };

  // 統合保存ロジック（aiPromptはtenantsの中に含まれるため引数を整理）
  const saveOwnerData = async (updatedTenants = tenants, updatedInvitations = invitations, updatedUpgrades = upgradeRequests) => {
    setIsSaving(true);
    try {
      await supabase.from('app_settings').upsert({ 
        id: 'nocolde_owner', 
        settings_data: { 
          tenants: updatedTenants, 
          invitations: updatedInvitations,
          upgradeRequests: updatedUpgrades
        } 
      });
      setTenants(updatedTenants);
      setInvitations(updatedInvitations);
      setUpgradeRequests(updatedUpgrades);
    } catch (error) {
      alert('データの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // アカウント招待URLの発行ロジック
  const handleInvite = () => {
    if (!newInviteEmail) return;
    const token = Math.random().toString(36).substring(2, 15);
    const setupUrl = `${window.location.origin}/setup?token=${token}`;
    
    const newInvite = {
      id: Date.now(),
      email: newInviteEmail,
      price: newInvitePlan,
      token: token,
      url: setupUrl,
      date: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
    
    const updated = [newInvite, ...invitations];
    saveOwnerData(tenants, updated, upgradeRequests);
    setNewInviteEmail('');
    
    navigator.clipboard.writeText(`システムのご案内です。以下のURLから初期設定を行ってください。\n${setupUrl}`);
    alert('招待URLを発行し、クリップボードにコピーしました！');
  };

  // 店舗の強制ロック / 解除
  const toggleLock = (tenantId) => {
    const target = tenants.find(t => t.id === tenantId);
    const newStatus = target.status === 'active' ? 'locked' : 'active';
    const confirmMsg = newStatus === 'locked' 
      ? `【警告】この店舗のシステム利用を強制停止（ロック）しますか？\n未入金などの場合に実行してください。` 
      : `この店舗のロックを解除し、利用を再開させますか？`;
      
    if (!confirm(confirmMsg)) return;

    const updated = tenants.map(t => t.id === tenantId ? { ...t, status: newStatus } : t);
    saveOwnerData(updated, invitations, upgradeRequests);
  };

  // 料金の変更
  const updatePrice = (tenantId, newPrice) => {
    const updated = tenants.map(t => t.id === tenantId ? { ...t, price: Number(newPrice) } : t);
    saveOwnerData(updated, invitations, upgradeRequests);
  };

  // 機能の個別出し分け（トグル切り替え）
  const toggleFeature = (tenantId, featureKey) => {
    const updated = tenants.map(t => {
      if (t.id === tenantId) {
        const currentFeatures = t.features || { b2b: false, deliveryOutsource: false };
        return { ...t, features: { ...currentFeatures, [featureKey]: !currentFeatures[featureKey] } };
      }
      return t;
    });
    saveOwnerData(updated, invitations, upgradeRequests);
  };

  // ★ AIプロンプトの個別更新（入力中）
  const updateTenantPrompt = (tenantId, newPrompt) => {
    const updated = tenants.map(t => t.id === tenantId ? { ...t, aiPrompt: newPrompt } : t);
    setTenants(updated); // ローカルステートだけ更新して入力をもたつかせない
  };

  // アップグレードの承認
  const handleApproveUpgrade = (reqId) => {
    if(!confirm('この機能のアップグレードを承認し、店舗に機能を解放しますか？')) return;
    
    const req = upgradeRequests.find(r => r.id === reqId);
    
    // 店舗の機能を自動でONにする
    const updatedTenants = tenants.map(t => {
      if (t.id === req.tenantId) {
        const currentFeatures = t.features || { b2b: false, deliveryOutsource: false };
        return { ...t, features: { ...currentFeatures, [req.featureKey]: true } };
      }
      return t;
    });

    const updatedReqs = upgradeRequests.map(r => r.id === reqId ? { ...r, status: 'approved' } : r);
    saveOwnerData(updatedTenants, invitations, updatedReqs);
    alert('機能を解放しました！');
  };

  // アップグレードの却下
  const handleRejectUpgrade = (reqId) => {
    if(!confirm('この依頼を却下しますか？')) return;
    const updatedReqs = upgradeRequests.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r);
    saveOwnerData(tenants, invitations, updatedReqs);
  };

  const pendingUpgradesCount = upgradeRequests.filter(r => r.status === 'pending').length;

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans">
        <div className="bg-[#111111] p-10 rounded-2xl border border-[#333333] shadow-2xl w-96 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-white tracking-widest font-serif italic">NocoLde</h1>
            <p className="text-[10px] text-[#2D4B3E] tracking-[0.3em]">SUPER ADMIN CONSOLE</p>
          </div>
          <input 
            type="password" 
            placeholder="ACCESS KEY" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full bg-black border border-[#333333] rounded-lg px-4 py-3 text-white font-mono text-center tracking-widest focus:border-[#2D4B3E] outline-none transition-all"
          />
          <button onClick={handleLogin} className="w-full bg-[#2D4B3E] hover:bg-[#1f352b] text-white font-bold py-3 rounded-lg tracking-widest transition-all">LOGIN</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row text-gray-300 font-sans">
      
      {/* オーナー専用ダークサイドバー */}
      <aside className="w-full md:w-64 bg-[#111111] border-r border-[#222222] md:fixed h-full z-20">
        <div className="p-8 flex flex-col gap-1 border-b border-[#222222]">
          <span className="font-serif italic text-[24px] font-black tracking-tight text-white">NocoLde</span>
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-[#2D4B3E] pt-1">Cloud Control</span>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => setActiveTab('tenants')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'tenants' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>
            <Building2 size={16}/> 店舗・機能管理
          </button>
          <button onClick={() => setActiveTab('invites')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'invites' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>
            <Mail size={16}/> アカウント発行
          </button>
          <button onClick={() => setActiveTab('upgrades')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center justify-between ${activeTab === 'upgrades' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>
            <div className="flex items-center gap-3"><ArrowUpCircle size={16}/> <span>アップグレード依頼</span></div>
            {pendingUpgradesCount > 0 && <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full">{pendingUpgradesCount}</span>}
          </button>
          <button onClick={() => setActiveTab('ai')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'ai' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>
            <Bot size={16}/> AIプロンプト設定
          </button>
        </nav>
        <div className="absolute bottom-8 left-8 text-[10px] text-gray-600 font-mono">
          System v1.3.0<br/>Secure Connection
        </div>
      </aside>

      <main className="flex-1 md:ml-64 p-8 md:p-12">
        <header className="flex justify-between items-center mb-10 border-b border-[#222222] pb-6">
          <h2 className="text-xl font-bold text-white tracking-widest">
            {activeTab === 'tenants' && 'TENANT MANAGEMENT'}
            {activeTab === 'invites' && 'ISSUE INVITATION'}
            {activeTab === 'upgrades' && 'UPGRADE REQUESTS'}
            {activeTab === 'ai' && 'AI PROMPT SETTINGS'}
          </h2>
          {isSaving && <span className="text-[#2D4B3E] text-sm animate-pulse font-mono flex items-center gap-2"><RefreshCw size={14} className="animate-spin"/> Syncing...</span>}
        </header>

        {/* 1. 契約店舗・料金・機能・ロック管理 */}
        {activeTab === 'tenants' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-[#111111] rounded-2xl border border-[#222222] overflow-x-auto shadow-2xl">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-[#1a1a1a] border-b border-[#333333] text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                  <tr>
                    <th className="px-6 py-4">店舗名 (ID)</th>
                    <th className="px-6 py-4">月額料金</th>
                    <th className="px-6 py-4">機能の個別解放</th>
                    <th className="px-6 py-4 text-center">ステータス</th>
                    <th className="px-6 py-4 text-right">強制操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222] text-[13px]">
                  {tenants.map(t => {
                    const f = t.features || { b2b: false, deliveryOutsource: false };
                    return (
                      <tr key={t.id} className="hover:bg-[#1a1a1a] transition-all">
                        <td className="px-6 py-5">
                          <div className="font-bold text-white text-[14px]">{t.name}</div>
                          <div className="text-[10px] text-gray-500 font-mono mt-1">{t.id}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">¥</span>
                            <input 
                              type="number" 
                              value={t.price} 
                              onChange={(e) => updatePrice(t.id, e.target.value)} 
                              className="bg-black border border-[#333333] rounded px-3 py-1.5 w-24 text-white outline-none focus:border-[#2D4B3E]" 
                            />
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div onClick={() => toggleFeature(t.id, 'b2b')} className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${f.b2b ? 'bg-[#2D4B3E]' : 'bg-[#333333]'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${f.b2b ? 'translate-x-4' : ''}`}></div>
                              </div>
                              <span className={`text-[11px] font-bold tracking-widest transition-colors ${f.b2b ? 'text-white' : 'text-gray-600 group-hover:text-gray-400'}`}>法人管理ポータル</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div onClick={() => toggleFeature(t.id, 'deliveryOutsource')} className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${f.deliveryOutsource ? 'bg-[#2D4B3E]' : 'bg-[#333333]'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full transition-all shadow-sm ${f.deliveryOutsource ? 'translate-x-4' : ''}`}></div>
                              </div>
                              <span className={`text-[11px] font-bold tracking-widest transition-colors ${f.deliveryOutsource ? 'text-white' : 'text-gray-600 group-hover:text-gray-400'}`}>配達業務委託</span>
                            </label>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest flex items-center justify-center gap-1 w-fit mx-auto ${t.status === 'active' ? 'bg-[#2D4B3E]/20 text-green-400 border border-[#2D4B3E]/50' : 'bg-red-900/20 text-red-500 border border-red-900/50'}`}>
                            {t.status === 'active' ? <><Unlock size={10}/> ACTIVE</> : <><Lock size={10}/> LOCKED</>}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => toggleLock(t.id)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all ${t.status === 'active' ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-900' : 'bg-[#2D4B3E]/10 text-[#2D4B3E] hover:bg-[#2D4B3E] hover:text-white border border-[#2D4B3E]'}`}
                          >
                            {t.status === 'active' ? 'システムロック' : 'ロック解除'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. アカウント発行（招待） */}
        {activeTab === 'invites' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="bg-[#111111] p-8 rounded-2xl border border-[#222222] shadow-2xl flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-[11px] font-bold text-gray-500 tracking-widest">クライアントのメールアドレス</label>
                <input type="email" value={newInviteEmail} onChange={(e) => setNewInviteEmail(e.target.value)} placeholder="client@example.com" className="w-full bg-black border border-[#333333] rounded-xl px-4 py-3 text-white outline-none focus:border-[#2D4B3E]" />
              </div>
              <div className="w-full md:w-48 space-y-2">
                <label className="text-[11px] font-bold text-gray-500 tracking-widest">初期の月額料金設定</label>
                <select value={newInvitePlan} onChange={(e) => setNewInvitePlan(e.target.value)} className="w-full bg-black border border-[#333333] rounded-xl px-4 py-3 text-white outline-none focus:border-[#2D4B3E]">
                  <option value="0">無料デモ (¥0)</option>
                  <option value="10000">標準プラン (¥10,000)</option>
                  <option value="20000">プロプラン (¥20,000)</option>
                </select>
              </div>
              <button onClick={handleInvite} className="h-[50px] px-8 bg-[#2D4B3E] text-white font-bold rounded-xl tracking-widest hover:bg-[#1f352b] transition-all whitespace-nowrap">
                招待URLを発行
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 tracking-widest border-b border-[#222222] pb-2">発行済みのアカウントURL一覧</h3>
              <div className="grid gap-4">
                {invitations.map(inv => (
                  <div key={inv.id} className="bg-[#111111] p-6 rounded-xl border border-[#222222] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-white text-[15px]">{inv.email}</p>
                      <p className="text-[11px] text-gray-500 mt-1 font-mono">発行日: {inv.date} | 設定料金: ¥{Number(inv.price).toLocaleString()}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <input type="text" value={inv.url} readOnly className="w-full max-w-md bg-black text-[#2D4B3E] border border-[#333333] text-[11px] p-2.5 rounded-lg outline-none font-mono" />
                        <button onClick={() => {navigator.clipboard.writeText(inv.url); alert('URLをコピーしました！')}} className="text-xs bg-[#222222] hover:bg-[#333333] text-gray-300 px-3 py-2.5 rounded-lg transition-all whitespace-nowrap">コピー</button>
                      </div>
                    </div>
                    <div>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest ${inv.status === 'pending' ? 'bg-orange-900/30 text-orange-500 border border-orange-900/50' : 'bg-[#2D4B3E]/20 text-[#2D4B3E] border border-[#2D4B3E]/50'}`}>
                        {inv.status === 'pending' ? '未登録 (招待済)' : '本登録完了'}
                      </span>
                    </div>
                  </div>
                ))}
                {invitations.length === 0 && <p className="text-xs text-gray-600 italic">まだ招待したアカウントはありません。</p>}
              </div>
            </div>
          </div>
        )}

        {/* 3. アップグレードの依頼確認画面 */}
        {activeTab === 'upgrades' && (
          <div className="space-y-6 animate-in fade-in">
            {upgradeRequests.length === 0 ? (
              <div className="text-center py-20 text-gray-600 font-mono tracking-widest border border-dashed border-[#333333] rounded-2xl">
                NO PENDING REQUESTS.
              </div>
            ) : (
              upgradeRequests.map(req => (
                <div key={req.id} className={`bg-[#111111] p-6 md:p-8 rounded-2xl border ${req.status === 'pending' ? 'border-[#2D4B3E] shadow-[0_0_15px_rgba(45,75,62,0.3)]' : 'border-[#222222] opacity-60'} flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all`}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold tracking-widest ${req.status === 'pending' ? 'bg-[#2D4B3E] text-white' : req.status === 'approved' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                        {req.status === 'pending' ? 'NEW REQUEST' : req.status === 'approved' ? 'APPROVED' : 'REJECTED'}
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">{req.date}</span>
                    </div>
                    <h4 className="font-bold text-white text-[18px]"><span className="text-emerald-400">{req.featureName}</span> の利用申請</h4>
                    <p className="text-[13px] text-gray-400 flex items-center gap-2"><Building2 size={14}/> 申請元テナント: {req.tenantName}</p>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => handleRejectUpgrade(req.id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-[#333333] text-gray-400 text-[12px] font-bold rounded-xl hover:bg-[#222222] hover:text-white transition-all"
                      >
                        <XCircle size={16}/> 却下する
                      </button>
                      <button 
                        onClick={() => handleApproveUpgrade(req.id)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#2D4B3E] text-white text-[12px] font-bold rounded-xl hover:bg-[#1f352b] transition-all shadow-lg shadow-[#2D4B3E]/20"
                      >
                        <CheckCircle size={16}/> 承認・機能を解放
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* 4. ★AIプロンプトの設定 (店舗別) */}
        {activeTab === 'ai' && (
          <div className="space-y-6 animate-in fade-in">
            <header className="mb-6 space-y-2">
               <h3 className="text-[16px] font-bold text-emerald-400 flex items-center gap-2"><Sparkles size={18}/> 店舗別 AI 画像解析プロンプト</h3>
               <p className="text-[12px] text-gray-500 leading-relaxed">
                 各店舗が「過去分登録 (URL取込)」を使用した際に、AIに対してどのようにテキストを解析させるかの指示文を個別にチューニングできます。
               </p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {tenants.map(t => (
                  <div key={t.id} className="bg-[#111111] p-6 rounded-2xl border border-[#222222] shadow-xl flex flex-col">
                     <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                       <Store size={16} className="text-emerald-500" /> 
                       {t.name} <span className="text-gray-600 text-[10px] font-mono">({t.id})</span>
                     </h4>
                     <textarea
                        value={t.aiPrompt ?? DEFAULT_AI_PROMPT}
                        onChange={(e) => updateTenantPrompt(t.id, e.target.value)}
                        className="w-full h-40 bg-black border border-[#333333] rounded-xl p-4 text-[12px] text-emerald-50 outline-none resize-none font-mono focus:border-[#2D4B3E] transition-colors flex-1"
                        placeholder="この店舗専用のAI指示を記述..."
                     />
                  </div>
               ))}
            </div>

            <div className="flex justify-end pt-6 border-t border-[#222222]">
              <button 
                onClick={() => saveOwnerData(tenants, invitations, upgradeRequests)}
                disabled={isSaving}
                className="flex items-center justify-center w-full md:w-auto gap-2 bg-[#2D4B3E] text-white px-10 py-4 rounded-xl font-bold text-[13px] tracking-widest hover:bg-[#1f352b] transition-all disabled:opacity-50 shadow-lg shadow-[#2D4B3E]/20"
              >
                <Save size={16}/> {isSaving ? 'SAVING...' : 'SAVE ALL PROMPTS'}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}