'use client';
import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import { Mail, Lock, AlertCircle, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export default function StaffLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // ★ パスワードリセットモードの切り替え用
  const [isResetMode, setIsResetMode] = useState(false);

  // 通常のログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push('/staff/orders');
    } catch (error) {
      setMessage({ type: 'error', text: 'ログインに失敗しました。メールアドレスとパスワードをご確認ください。' });
    } finally {
      setIsLoading(false);
    }
  };

  // ★ パスワードリセットメールの送信処理
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage({ type: 'error', text: 'メールアドレスを入力してください。' });
      return;
    }
    
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // メールのリンクをクリックした後に飛ばすURLを設定
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/staff/update-password`,
      });
      if (error) throw error;
      
      setMessage({ type: 'success', text: 'パスワード再設定メールを送信しました。メールボックスをご確認ください。' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'メールの送信に失敗しました。アドレスが正しいかご確認ください。' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center p-4 font-sans text-[#111111]">
      <div className="bg-white w-full max-w-[400px] p-8 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#EAEAEA] relative overflow-hidden">
        
        {/* 装飾用の背景 */}
        <div className="absolute top-0 left-0 w-full h-2 bg-[#2D4B3E]"></div>

        <div className="text-center mb-8 mt-2">
          <h1 className="text-[24px] font-black text-[#2D4B3E] tracking-tight font-serif italic mb-2">FLORIX</h1>
          <p className="text-[10px] font-bold text-[#999999] tracking-[0.2em] uppercase">
            {isResetMode ? 'Password Reset' : 'Staff Portal'}
          </p>
        </div>

        {message.text && (
          <div className={`p-4 rounded-xl mb-6 text-[12px] font-bold flex items-start gap-2 animate-in fade-in slide-in-from-top-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
            {message.type === 'error' ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{message.text}</span>
          </div>
        )}

        {!isResetMode ? (
          // ==============================
          // 通常ログインフォーム
          // ==============================
          <form onSubmit={handleLogin} className="space-y-5 animate-in slide-in-from-left-4 duration-300">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#999999] pl-1">メールアドレス</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#999999]">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl pl-12 pr-4 text-[14px] font-bold outline-none focus:border-[#2D4B3E] focus:bg-white transition-all shadow-inner" 
                  placeholder="staff@example.com" 
                  required 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#999999] pl-1">パスワード</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#999999]">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl pl-12 pr-4 text-[14px] font-bold outline-none focus:border-[#2D4B3E] focus:bg-white transition-all shadow-inner tracking-widest" 
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full h-14 mt-4 bg-[#2D4B3E] text-white rounded-2xl font-bold text-[14px] tracking-widest flex items-center justify-center gap-2 hover:bg-[#1f352b] active:scale-[0.98] transition-all shadow-md disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'ログイン'}
            </button>

            <div className="text-center pt-4 border-t border-[#FBFAF9]">
              <button 
                type="button" 
                onClick={() => { setIsResetMode(true); setMessage({type:'', text:''}); }} 
                className="text-[11px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-colors"
              >
                パスワードをお忘れですか？
              </button>
            </div>
          </form>
        ) : (
          // ==============================
          // パスワードリセットフォーム
          // ==============================
          <form onSubmit={handleResetPassword} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
            <p className="text-[12px] text-[#555555] font-bold leading-relaxed bg-[#FBFAF9] p-4 rounded-xl border border-[#EAEAEA]">
              登録しているメールアドレスを入力してください。パスワード再設定用のURLをお送りします。
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#999999] pl-1">メールアドレス</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#999999]">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl pl-12 pr-4 text-[14px] font-bold outline-none focus:border-[#2D4B3E] focus:bg-white transition-all shadow-inner" 
                  placeholder="登録済みのアドレス" 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading} 
              className="w-full h-14 mt-4 bg-[#2D4B3E] text-white rounded-2xl font-bold text-[14px] tracking-widest flex items-center justify-center gap-2 hover:bg-[#1f352b] active:scale-[0.98] transition-all shadow-md disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'リセットメールを送信'}
            </button>

            <div className="text-center pt-4 border-t border-[#FBFAF9]">
              <button 
                type="button" 
                onClick={() => { setIsResetMode(false); setMessage({type:'', text:''}); }} 
                className="text-[11px] font-bold text-[#999999] hover:text-[#2D4B3E] transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft size={12} /> ログイン画面に戻る
              </button>
            </div>
          </form>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&display=swap');
        .font-serif { font-family: 'Noto Serif JP', serif; }
      `}</style>
    </div>
  );
}