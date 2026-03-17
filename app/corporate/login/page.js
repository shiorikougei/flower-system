'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function CorporateLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      /* // ▼ 実際のSupabase連携時のコード
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (authError) throw authError;
      
      // 法人アカウントかどうかのチェック（role確認など）
      // if (data.user.user_metadata.role !== 'corporate') throw new Error('法人アカウントではありません');
      */

      // 今回はUIの動作確認用に擬似的なローディングを入れています
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ログイン成功時、専用ポータルへ遷移
      router.push('/corporate');

    } catch (err) {
      setError('メールアドレスまたはパスワードが正しくありません。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col justify-center items-center p-6 font-sans text-[#111111]">
      
      {/* ヘッダーロゴ部分 */}
      <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="font-serif italic text-[36px] font-black tracking-tight text-[#2D4B3E] leading-none">FLORIX</h1>
        <p className="text-[11px] font-bold tracking-[0.2em] text-[#999999] mt-2 uppercase">Corporate Portal</p>
      </div>

      {/* ログインフォームカード */}
      <div className="w-full max-w-[420px] bg-white rounded-[32px] border border-[#EAEAEA] shadow-xl p-8 md:p-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="mb-8 text-center">
          <h2 className="text-[20px] font-bold text-[#2D4B3E]">ログイン</h2>
          <p className="text-[12px] text-[#999999] mt-2 font-medium">法人専用ポータルへアクセスします</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 animate-in fade-in">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12px] font-bold text-red-700 leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* メールアドレス（ログインID） */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
              <Mail size={14} /> メールアドレス (ログインID)
            </label>
            <input 
              type="email" 
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="mail@example.com" 
              className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] focus:border-[#2D4B3E] focus:bg-white outline-none transition-all"
            />
          </div>

          {/* パスワード */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
                <Lock size={14} /> パスワード
              </label>
              {/* パスワードリセットへの導線（今回はダミーリンク） */}
              <Link href="#" className="text-[10px] font-bold text-[#999999] hover:text-[#2D4B3E] underline underline-offset-2">
                お忘れですか？
              </Link>
            </div>
            <input 
              type="password" 
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••" 
              className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] tracking-widest focus:border-[#2D4B3E] focus:bg-white outline-none transition-all"
            />
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-14 bg-[#2D4B3E] text-white rounded-[16px] font-bold text-[15px] tracking-widest shadow-md hover:bg-[#1f352b] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 group"
            >
              {isLoading ? '認証中...' : 'ログインする'}
              {!isLoading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
          
        </form>
      </div>

    </div>
  );
}