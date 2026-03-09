'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../utils/supabase'; // ※パスはご自身の環境に合わせてください

export default function AdminAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // --- 本物のログイン処理 ---
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // ログイン成功！管理画面（受注一覧）へ移動
      router.push('/staff/orders'); 

    } catch (error) {
      alert('ログインに失敗しました。メールアドレスとパスワードをご確認ください。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center p-6 font-sans text-[#111111] text-left">
      <div className="w-full max-w-[1000px] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-[#EAEAEA]">
        
        {/* 左側：ブランドエリア */}
        <div className="md:w-5/12 bg-[#2D4B3E] relative hidden md:flex flex-col justify-between p-10 lg:p-12 overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          <div className="relative z-10 flex flex-col gap-1">
            <span className="font-serif italic text-[28px] lg:text-[32px] tracking-tight text-white">NocoLde</span>
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/60 border-t border-white/20 pt-2 inline-block w-fit">Florist Platform</span>
          </div>
          <div className="relative z-10 space-y-6">
            <h2 className="text-[24px] lg:text-[30px] font-bold text-white leading-tight font-serif italic tracking-wide">Empower your<br />Floral Business.</h2>
            <p className="text-white/80 text-[13px] lg:text-[14px] leading-loose font-medium break-keep">受注管理から配送料の計算まで、お花屋さんの業務をスマートに。</p>
          </div>
        </div>

        {/* 右側：フォームエリア（ログイン専用） */}
        <div className="md:w-7/12 p-10 lg:p-16 flex flex-col justify-center bg-white relative">
          <div className="max-w-sm mx-auto w-full space-y-8">
            <div className="space-y-2">
              <h1 className="text-[28px] font-bold text-[#2D4B3E] tracking-tight font-serif italic">
                Welcome Back
              </h1>
              <p className="text-[13px] text-[#999999] font-medium">
                管理画面へログインしてください
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#555555] uppercase tracking-widest ml-1">メールアドレス</label>
                <input 
                  type="email" 
                  required 
                  placeholder="admin@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full h-14 px-5 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl outline-none focus:bg-white focus:border-[#2D4B3E] transition-all font-medium shadow-sm" 
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#555555] uppercase tracking-widest ml-1">パスワード</label>
                </div>
                <input 
                  type="password" 
                  required 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full h-14 px-5 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl outline-none focus:bg-white focus:border-[#2D4B3E] transition-all font-medium tracking-widest shadow-sm" 
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className={`w-full h-14 bg-[#2D4B3E] text-white rounded-2xl font-bold text-[14px] shadow-lg shadow-[#2D4B3E]/20 hover:bg-[#1f352b] hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-widest ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Processing...' : 'Login'}
                </button>
              </div>
            </form>

            <div className="text-center pt-6 border-t border-[#FBFAF9]">
              <p className="text-[11px] font-medium text-[#999999]">
                ※アカウントの発行については、システム管理者までお問い合わせください。
              </p>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; }`}</style>
    </div>
  );
}