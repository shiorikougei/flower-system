'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../utils/supabase'; // パスは適宜調整してください
import { Store, Lock, Mail, ArrowRight, Sparkles, Key, CheckCircle2, Copy } from 'lucide-react';

// 6桁の数字パスワード生成（覚えやすさ重視）
function generateSystemPassword() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [tenantId, setTenantId] = useState(''); // システム用ID
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(null); // { systemPassword } セットアップ完了時の表示

  // トークンがない場合は弾く
  useEffect(() => {
    if (!token) {
      alert('無効な招待URLです。');
      router.push('/');
    }
  }, [token, router]);

  const handleSetup = async () => {
    // ★ tenantId を強制小文字化（URL ケース不整合の予防）
    const normalizedTenantId = tenantId.toLowerCase();

    // テナントIDのバリデーション（半角英数字のみ）
    if (!/^[a-z0-9_-]+$/.test(normalizedTenantId)) {
      alert('テナントIDは半角英数字（ハイフン、アンダーバー可）で入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Supabase Authでユーザー作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('ユーザー作成に失敗しました');

      // 2. profilesテーブルに紐づけデータを作成（このユーザーはこのテナントのスタッフであるという証明）
      const { error: profileError } = await supabase.from('profiles').insert([
        { id: authData.user.id, tenant_id: normalizedTenantId, role: 'staff' }
      ]);
      if (profileError) throw profileError;

      // 3. 初期設定データをapp_settingsに作成（systemPassword をランダム生成）
      const systemPassword = generateSystemPassword();
      const initialSettings = {
        generalConfig: { tenantId: normalizedTenantId, appName: shopName, systemPassword },
        statusConfig: { type: 'template', customLabels: ['未対応', '制作中', '制作完了', '配達中'] },
        shops: [],
        flowerItems: []
      };

      const { error: settingsError } = await supabase.from('app_settings').insert([
        { id: normalizedTenantId, settings_data: initialSettings }
      ]);
      if (settingsError) throw settingsError;

      // 4. システムパスワードを登録メアドに送付
      try {
        await fetch('/api/setup/send-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-setup-token': token },
          body: JSON.stringify({ email, shopName, tenantId: normalizedTenantId, systemPassword }),
        });
      } catch (e) { console.warn('credentials email failed', e); }

      // 完了画面表示（システムパスワードをユーザーに見せる）
      setCompleted({ systemPassword, email });
      return;

    } catch (error) {
      console.error('セットアップエラー:', error.message);
      alert(`エラーが発生しました: ${error.message}\n(※既に同じメールアドレスやテナントIDが登録されている可能性があります)`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) return null;

  // セットアップ完了画面
  if (completed) {
    return (
      <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-[#111111] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-white p-8 rounded-[32px] border border-[#EAEAEA] shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-600"></div>
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 size={32}/>
              </div>
              <h2 className="text-[18px] font-bold text-[#2D4B3E]">🎉 初期設定が完了しました</h2>
              <p className="text-[12px] text-[#555] leading-relaxed">
                ログイン情報を {completed.email} 宛にお送りしました。
              </p>
            </div>

            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 space-y-2">
              <p className="text-[11px] font-bold text-amber-900 tracking-widest">🔑 設定画面ロック解除パスワード（重要）</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white border border-amber-300 rounded-lg px-4 py-3 font-mono text-[24px] font-bold text-amber-900 text-center tracking-[0.3em]">
                  {completed.systemPassword}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(completed.systemPassword); alert('コピーしました'); }}
                  className="h-12 w-12 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center justify-center"
                  title="コピー"
                >
                  <Copy size={16}/>
                </button>
              </div>
              <p className="text-[10px] text-amber-800 leading-relaxed">
                ⚠️ このパスワードは設定画面（料金・スタッフ・店舗情報等）の編集時に必要です。<br/>
                必ず控えておくか、登録メアドに届いたメールを保存してください。<br/>
                設定画面のスタッフ管理から変更も可能です。
              </p>
            </div>

            <button
              onClick={() => router.push('/staff/settings')}
              className="w-full h-14 bg-[#2D4B3E] hover:bg-[#1f352b] text-white rounded-xl font-bold text-[14px] tracking-widest flex items-center justify-center gap-2 shadow-md"
            >
              管理画面へ移動 <ArrowRight size={18}/>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-[#111111] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center space-y-2">
          <h1 className="font-serif italic text-[32px] font-black tracking-tight text-[#2D4B3E]">NocoLde</h1>
          <p className="text-[12px] font-bold tracking-widest text-[#999999] uppercase">Cloud System Setup</p>
        </div>

        <div className="bg-white p-8 md:p-10 rounded-[32px] border border-[#EAEAEA] shadow-xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#2D4B3E]"></div>

          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-[#2D4B3E]/10 rounded-full flex items-center justify-center mx-auto text-[#2D4B3E] mb-4">
              <Sparkles size={28} />
            </div>
            <h2 className="text-[18px] font-bold text-[#2D4B3E]">システムへようこそ</h2>
            <p className="text-[13px] text-[#555555] leading-relaxed">
              初期設定を行い、専用システムを開設してください。
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
                <Key size={14}/> テナントID (URL用・半角小文字英数字)
              </label>
              <input
                type="text"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value.toLowerCase())}
                placeholder="例: my_flower_shop"
                className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 text-[14px] font-bold outline-none focus:bg-white focus:border-[#2D4B3E] transition-all font-mono"
              />
              <p className="text-[10px] text-[#999] mt-1">※URLの一部になります。すべて小文字で保存されます（例: ohana → noodleflorix.com/order/ohana/...）</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
                <Store size={14}/> ショップ名 (会社名)
              </label>
              <input 
                type="text" 
                value={shopName} 
                onChange={(e) => setShopName(e.target.value)} 
                placeholder="例: 株式会社フローリックス" 
                className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 text-[14px] font-bold outline-none focus:bg-white focus:border-[#2D4B3E] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
                <Mail size={14}/> 管理者メールアドレス
              </label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="admin@example.com" 
                className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 text-[14px] font-bold outline-none focus:bg-white focus:border-[#2D4B3E] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
                <Lock size={14}/> 新しいログインパスワード
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="6文字以上の英数字" 
                className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 text-[14px] font-bold outline-none focus:bg-white focus:border-[#2D4B3E] transition-all tracking-widest"
              />
            </div>
          </div>

          <button 
            disabled={!tenantId || !shopName || !email || !password || isSubmitting}
            onClick={handleSetup}
            className="w-full h-14 bg-[#2D4B3E] hover:bg-[#1f352b] text-white rounded-xl font-bold text-[14px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 shadow-md"
          >
            {isSubmitting ? '環境を構築中...' : <><>設定を完了し利用を開始</> <ArrowRight size={18}/></>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest animate-pulse">Loading...</div>}>
      <SetupContent />
    </Suspense>
  );
}