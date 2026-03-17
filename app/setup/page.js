'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Store, Lock, Mail, ArrowRight, CheckCircle, Building2, Sparkles } from 'lucide-react';

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState(1);
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
    setIsSubmitting(true);
    
    // ★ 本来はここでSupabaseに「新しいテナント環境」を作成する処理が入ります
    // 今回はUIのモックとして、擬似的にローディングを挟んで設定画面へ飛ばします
    setTimeout(() => {
      alert('初期設定が完了しました！管理画面へ移動します。');
      router.push('/staff/settings'); // 店舗の設定画面へ誘導
    }, 2000);
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
              アカウントの招待が確認されました。<br/>初期設定を行い、専用システムを開設してください。
            </p>
          </div>

          <div className="space-y-5">
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
                placeholder="8文字以上の英数字" 
                className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-5 text-[14px] font-bold outline-none focus:bg-white focus:border-[#2D4B3E] transition-all tracking-widest"
              />
            </div>
          </div>

          <button 
            disabled={!shopName || !email || !password || isSubmitting}
            onClick={handleSetup}
            className="w-full h-14 bg-[#2D4B3E] hover:bg-[#1f352b] text-white rounded-xl font-bold text-[14px] tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 shadow-md"
          >
            {isSubmitting ? (
              <>環境を構築中...</>
            ) : (
              <>設定を完了し利用を開始 <ArrowRight size={18}/></>
            )}
          </button>
          
          <p className="text-[10px] text-center text-[#999999]">
            利用を開始することで、利用規約およびプライバシーポリシーに同意したものとみなされます。
          </p>
        </div>
      </div>
    </div>
  );
}

// SuspenseでラップしてuseSearchParamsを安全に利用する
export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-bold text-[#2D4B3E] tracking-widest animate-pulse">Loading...</div>}>
      <SetupContent />
    </Suspense>
  );
}