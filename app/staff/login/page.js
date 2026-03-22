'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase'; // ★絶対パスに修正
import { MessageCircle } from 'lucide-react'; // ★LINE用のアイコンを追加

export default function AdminAuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
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
      {/* ★ 横幅をキュッと絞って、スッキリした1カラムレイアウトに変更！ */}
      <div className="w-full max-w-[440px] bg-white rounded-[40px] shadow-2xl border border-[#EAEAEA] animate-in fade-in zoom-in-95 duration-500">
        
        <div className="p-10 lg:p-12 flex flex-col justify-center relative">
          <div className="w-full space-y-8">
            
            {/* サイドバーの代わりにロゴを一番上に配置 */}
            <div className="text-center space-y-1 mb-6">
              <h1 className="font-serif italic text-[36px] font-black tracking-tight text-[#2D4B3E]">FLORIX</h1>
              <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#999999]">Florist Platform</p>
            </div>

            <div className="space-y-2 text-center">
              <h2 className="text-[22px] font-bold text-[#111111] tracking-tight">
                Welcome Back
              </h2>
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
                  className={`w-full h-14 bg-[#2D4B3E] text-white rounded-2xl font-bold text-[14px] shadow-lg shadow-[#2D4B3E]/20 hover:bg-[#1f352b] hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-widest ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Processing...' : 'Login'}
                </button>
              </div>
            </form>

            {/* ★ 公式LINEへのリンクボタンを追加！ */}
            <div className="text-center pt-8 border-t border-[#EAEAEA]">
              <p className="text-[11px] font-bold text-[#999999] mb-3">
                アカウント発行・その他のお問い合わせ
              </p>
              <a 
                href="https://lin.ee/TSX8Dhc" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#06C755] text-white rounded-xl text-[12px] font-bold hover:bg-[#05b34c] transition-all shadow-sm active:scale-95 w-full"
              >
                <MessageCircle size={18} /> 公式LINEで問い合わせる
              </a>
            </div>

          </div>
        </div>
      </div>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&display=swap'); .font-serif { font-family: 'Noto Serif JP', serif; }`}</style>
    </div>
  );
}