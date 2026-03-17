'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../utils/supabase'; // パスは適宜調整してください
import { Store, Lock, Mail, ArrowRight, Sparkles, Key } from 'lucide-react';

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [tenantId, setTenantId] = useState(''); // システム用ID
  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // トークンがない場合は弾く
  useEffect(() => {
    if (!token) {
      alert('無効な招待URLです。');
      router.push('/');
    }
  }, [token, router]);

  const handleSetup = async () => {
    // テナントIDのバリデーション（半角英数字のみ）
    if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) {
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
        { id: authData.user.id, tenant_id: tenantId, role: 'staff' }
      ]);
      if (profileError) throw profileError;

      // 3. 初期設定データをapp_settingsに作成
      const initialSettings = {
        generalConfig: { tenantId: tenantId, appName: shopName },
        statusConfig: { type: 'template', customLabels: ['未対応', '制作中', '制作完了', '配達中'] },
        shops: [],
        flowerItems: []
      };
      
      const { error: settingsError } = await supabase.from('app_settings').insert([
        { id: tenantId, settings_data: initialSettings }
      ]);
      if (settingsError) throw settingsError;

      alert('初期設定が完了しました！管理画面へ移動します。');
      router.push('/staff/settings'); // 店舗の設定画面へ

    } catch (error) {
      console.error('セットアップエラー:', error.message);
      alert(`エラーが発生しました: ${error.message}\n(※既に同じメールアドレスやテナントIDが登録されている可能性があります)`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) return null;

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
                <Key size={14}/> テナントID (URL用・半角英数字)
              </label>
              <input 
                type="text" 
                value={tenantId} 
                onChange={(e) => setTenantId(e.target.value)} 
                placeholder="例: my_flower_shop" 
                className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 text-[14px] font-bold outline-none focus:bg-white focus:border-[#2D4B3E] transition-all font-mono"
              />
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