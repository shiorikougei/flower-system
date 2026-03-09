'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState('tenants');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- SaaS運営データ（オーナー専用） ---
  const [tenants, setTenants] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInvitePlan, setNewInvitePlan] = useState('10000');
  
  // オーナー用パスワード（実際の運用では強力な認証に切り替えます）
  const [isAuth, setIsAuth] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    async function loadOwnerData() {
      try {
        // id='nocolde_owner' という秘密のキーでSaaS管理データを保存・読み込みします
        const { data, error } = await supabase.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
        if (data && data.settings_data) {
          if (data.settings_data.tenants) setTenants(data.settings_data.tenants);
          if (data.settings_data.invitations) setInvitations(data.settings_data.invitations);
        } else {
          // 初回起動時のダミーデータ
          setTenants([
            { id: 'shop_a', name: '花・花 OHANA!', email: 'info@hana-ohana.example.com', price: 10000, status: 'active', lastPaid: '2026-02-28', requests: 0 },
            { id: 'shop_b', name: 'お花カフェ (デモ店舗)', email: 'demo@example.com', price: 0, status: 'active', lastPaid: '-', requests: 2 },
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
    if (password === 'nocolde2026') { // ★オーナー専用の強力なパスワード
      setIsAuth(true);
    } else {
      alert('アクセス権限がありません。');
    }
  };

  const saveOwnerData = async (updatedTenants = tenants, updatedInvitations = invitations) => {
    setIsSaving(true);
    try {
      await supabase.from('app_settings').upsert({ 
        id: 'nocolde_owner', 
        settings_data: { tenants: updatedTenants, invitations: updatedInvitations } 
      });
      setTenants(updatedTenants);
      setInvitations(updatedInvitations);
    } catch (error) {
      alert('データの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // ★アカウント招待URLの発行ロジック
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
      status: 'pending' // pending(未登録) -> active(登録済)
    };
    
    const updated = [newInvite, ...invitations];
    saveOwnerData(tenants, updated);
    setNewInviteEmail('');
    
    // クリップボードにコピー
    navigator.clipboard.writeText(`システムのご案内です。以下のURLから初期設定を行ってください。\n${setupUrl}`);
    alert('招待URLを発行し、クリップボードにコピーしました！そのままお客様にメールで送信できます。');
  };

  // ★最強の権限：店舗の強制ロック / 解除
  const toggleLock = (tenantId) => {
    const target = tenants.find(t => t.id === tenantId);
    const newStatus = target.status === 'active' ? 'locked' : 'active';
    const confirmMsg = newStatus === 'locked' 
      ? `【警告】この店舗のシステム利用を強制停止（ロック）しますか？\n未入金などの場合に実行してください。` 
      : `この店舗のロックを解除し、利用を再開させますか？`;
      
    if (!confirm(confirmMsg)) return;

    const updated = tenants.map(t => t.id === tenantId ? { ...t, status: newStatus } : t);
    saveOwnerData(updated, invitations);
  };

  const updatePrice = (tenantId, newPrice) => {
    const updated = tenants.map(t => t.id === tenantId ? { ...t, price: Number(newPrice) } : t);
    saveOwnerData(updated, invitations);
  };

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
          <button onClick={() => setActiveTab('tenants')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest ${activeTab === 'tenants' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>🏢 契約店舗の管理</button>
          <button onClick={() => setActiveTab('invites')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest ${activeTab === 'invites' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>✉️ アカウント発行</button>
          <button onClick={() => setActiveTab('requests')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center justify-between ${activeTab === 'requests' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>
            <span>💬 要望・修正依頼</span>
            <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full">2</span>
          </button>
        </nav>
        <div className="absolute bottom-8 left-8 text-[10px] text-gray-600 font-mono">
          System v1.0.0<br/>Secure Connection
        </div>
      </aside>

      <main className="flex-1 md:ml-64 p-8 md:p-12">
        <header className="flex justify-between items-center mb-12">
          <h2 className="text-2xl font-bold text-white tracking-widest">
            {activeTab === 'tenants' && 'TENANT MANAGEMENT'}
            {activeTab === 'invites' && 'ISSUE INVITATION'}
            {activeTab === 'requests' && 'CLIENT REQUESTS'}
          </h2>
          {isSaving && <span className="text-[#2D4B3E] text-sm animate-pulse font-mono">Syncing to Cloud...</span>}
        </header>

        {/* 1. 契約店舗・料金・ロック管理 */}
        {activeTab === 'tenants' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-[#111111] rounded-2xl border border-[#222222] overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-[#1a1a1a] border-b border-[#333333] text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                  <tr>
                    <th className="px-6 py-4">店舗名 (テナントID)</th>
                    <th className="px-6 py-4">月額料金設定</th>
                    <th className="px-6 py-4">最終入金確認</th>
                    <th className="px-6 py-4 text-center">ステータス</th>
                    <th className="px-6 py-4 text-right">強制操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222] text-[13px]">
                  {tenants.map(t => (
                    <tr key={t.id} className="hover:bg-[#1a1a1a] transition-all">
                      <td className="px-6 py-5">
                        <div className="font-bold text-white">{t.name}</div>
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
                      <td className="px-6 py-5 font-mono text-gray-400">{t.lastPaid}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest ${t.status === 'active' ? 'bg-[#2D4B3E]/20 text-green-400 border border-[#2D4B3E]/50' : 'bg-red-900/20 text-red-500 border border-red-900/50'}`}>
                          {t.status === 'active' ? 'ACTIVE' : 'LOCKED'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button 
                          onClick={() => toggleLock(t.id)}
                          className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all ${t.status === 'active' ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-900' : 'bg-[#2D4B3E]/10 text-[#2D4B3E] hover:bg-[#2D4B3E] hover:text-white border border-[#2D4B3E]'}`}
                        >
                          {t.status === 'active' ? '利用停止(ロック)' : 'ロック解除'}
                        </button>
                      </td>
                    </tr>
                  ))}
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
                  <div key={inv.id} className="bg-[#111111] p-6 rounded-xl border border-[#222222] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{inv.email}</p>
                      <p className="text-[11px] text-gray-500 mt-1 font-mono">発行日: {inv.date} | 設定料金: ¥{Number(inv.price).toLocaleString()}</p>
                      <input type="text" value={inv.url} readOnly className="mt-3 w-96 bg-black text-[#2D4B3E] border border-[#333333] text-[10px] p-2 rounded outline-none font-mono" />
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded text-[10px] font-bold tracking-widest ${inv.status === 'pending' ? 'bg-orange-900/30 text-orange-500 border border-orange-900/50' : 'bg-[#2D4B3E]/20 text-[#2D4B3E] border border-[#2D4B3E]/50'}`}>
                        {inv.status === 'pending' ? '未設定 (URL送付済)' : '本登録完了'}
                      </span>
                    </div>
                  </div>
                ))}
                {invitations.length === 0 && <p className="text-xs text-gray-600 italic">まだ招待したアカウントはありません。</p>}
              </div>
            </div>
          </div>
        )}

        {/* 3. 要望・修正管理 */}
        {activeTab === 'requests' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-[#111111] p-6 rounded-xl border border-[#222222] border-l-4 border-l-[#2D4B3E]">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] bg-[#2D4B3E] text-white px-2 py-0.5 rounded font-bold tracking-widest">NEW</span>
                <span className="text-[10px] text-gray-500 font-mono">2026.03.10 | お花カフェ</span>
              </div>
              <h4 className="font-bold text-white text-sm mb-2">設定画面に「配送料の自動計算オフ」ボタンを追加してほしい</h4>
              <p className="text-xs text-gray-400">いつもお世話になっております。店頭で直接送料を交渉することが多いので、自動計算を一時的にオフにできる機能があると助かります。</p>
              <div className="mt-4 flex gap-2">
                <button className="text-[10px] border border-[#333333] text-white px-4 py-1.5 rounded hover:bg-[#222222] transition-all">対応済みにする</button>
                <button className="text-[10px] border border-[#333333] text-gray-400 px-4 py-1.5 rounded hover:bg-[#222222] transition-all">返信</button>
              </div>
            </div>
            <div className="bg-[#111111] p-6 rounded-xl border border-[#222222] opacity-60">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] border border-gray-600 text-gray-400 px-2 py-0.5 rounded font-bold tracking-widest">対応完了</span>
                <span className="text-[10px] text-gray-500 font-mono">2026.02.15 | 花・花 OHANA!</span>
              </div>
              <h4 className="font-bold text-gray-300 text-sm mb-2">立札の縦書きレイアウトの微調整</h4>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}