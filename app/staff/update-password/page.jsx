'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSuccess, setIsSuccess] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'パスワードは6文字以上で入力してください。' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setIsSuccess(true);
      setMessage({ type: 'success', text: 'パスワードの変更が完了しました！' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center p-4 font-sans text-[#111111]">
      <div className="bg-white w-full max-w-[400px] p-8 rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#EAEAEA] relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-2 bg-[#2D4B3E]"></div>

        <div className="text-center mb-8 mt-2">
          <h1 className="text-[20px] font-black text-[#2D4B3E] tracking-tight mb-2">新しいパスワードの設定</h1>
          <p className="text-[11px] font-bold text-[#999999] leading-relaxed">
            今後のログインで使用する新しいパスワードをご入力ください。
          </p>
        </div>

        {message.text && (
          <div className={`p-4 rounded-xl mb-6 text-[12px] font-bold flex items-start gap-2 animate-in fade-in slide-in-from-top-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
            {message.type === 'error' ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
            <span className="leading-relaxed">{message.text}</span>
          </div>
        )}

        {!isSuccess ? (
          <form onSubmit={handleUpdatePassword} className="space-y-5 animate-in fade-in duration-500">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#999999] pl-1">新しいパスワード (6文字以上)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#999999]">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
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
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'パスワードを変更してログイン'}
            </button>
          </form>
        ) : (
          <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center">
            <button 
              onClick={() => router.push('/staff/orders')} 
              className="w-full h-14 bg-[#2D4B3E] text-white rounded-2xl font-bold text-[13px] tracking-widest flex items-center justify-center gap-2 hover:bg-[#1f352b] transition-all shadow-md mt-2"
            >
              受注管理画面へ移動する <ArrowRight size={16} />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}