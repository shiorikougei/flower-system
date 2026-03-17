'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Building2, Mail, Lock, User, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// URLを読み取る処理（useSearchParams）を含むメインコンテンツを分離
function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token'); // URLから招待トークンを取得

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    password: '',
  });

  // ※ 本来はここで招待トークンが有効かどうかの検証をAPIで行います
  useEffect(() => {
    if (!token) {
      // setError('招待URLが無効です。担当者から発行された正しいURLからアクセスしてください。');
    }
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      /* // ▼ 実際のSupabase連携時のコード（認証機能）
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: 'corporate', // 権限を「法人」に設定
            company_name: formData.companyName,
            contact_name: formData.contactName,
          }
        }
      });
      if (authError) throw authError;
      */

      // 今回はUIの動作確認用に擬似的なローディングを入れています
      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsSuccess(true);
      
      // 3秒後に法人専用ログイン画面へ自動遷移
      setTimeout(() => {
        router.push('/corporate/login');
      }, 3000);

    } catch (err) {
      setError('登録に失敗しました。メールアドレスが既に使用されている可能性があります。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* ヘッダーロゴ部分 */}
      <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h1 className="font-serif italic text-[36px] font-black tracking-tight text-[#2D4B3E] leading-none">FLORIX</h1>
        <p className="text-[11px] font-bold tracking-[0.2em] text-[#999999] mt-2 uppercase">Corporate Portal</p>
      </div>

      {/* 登録フォームカード */}
      <div className="w-full max-w-[480px] bg-white rounded-[32px] border border-[#EAEAEA] shadow-xl p-8 md:p-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {isSuccess ? (
          <div className="text-center space-y-6 py-8 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-[24px] font-black text-[#2D4B3E]">登録が完了しました！</h2>
            <p className="text-[14px] text-[#555555] font-medium leading-relaxed">
              {formData.companyName} 様のアカウントを作成しました。<br/>
              まもなく専用ポータルへご案内します。
            </p>
            <div className="pt-4 flex justify-center">
              <div className="w-6 h-6 border-4 border-[#2D4B3E]/20 border-t-[#2D4B3E] rounded-full animate-spin"></div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h2 className="text-[20px] font-bold text-[#2D4B3E]">法人アカウント登録</h2>
              <p className="text-[12px] text-[#999999] mt-2 font-medium">発行された招待リンクからの特別登録ページです</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 animate-in fade-in">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[12px] font-bold text-red-700 leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* 法人名・店舗名 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
                  <Building2 size={14} /> 法人名・店舗名
                </label>
                <input 
                  type="text" 
                  name="companyName"
                  required
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="株式会社〇〇 / ラウンジ〇〇" 
                  className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold focus:border-[#2D4B3E] focus:bg-white outline-none transition-all"
                />
              </div>

              {/* 担当者名 */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
                  <User size={14} /> ご担当者名
                </label>
                <input 
                  type="text" 
                  name="contactName"
                  required
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="山田 太郎" 
                  className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] font-bold focus:border-[#2D4B3E] focus:bg-white outline-none transition-all"
                />
              </div>

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
                <label className="text-[11px] font-bold text-[#999999] tracking-widest flex items-center gap-1.5">
                  <Lock size={14} /> パスワード (半角英数字6文字以上)
                </label>
                <input 
                  type="password" 
                  name="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••" 
                  className="w-full h-14 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl px-4 text-[14px] tracking-widest focus:border-[#2D4B3E] focus:bg-white outline-none transition-all"
                />
              </div>

              <div className="pt-6">
                <button 
                  type="submit" 
                  disabled={isLoading || !token}
                  className="w-full h-14 bg-[#2D4B3E] text-white rounded-[16px] font-bold text-[15px] tracking-widest shadow-md hover:bg-[#1f352b] transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 group"
                >
                  {isLoading ? '登録処理中...' : 'アカウントを作成する'}
                  {!isLoading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </div>
              
              <div className="text-center pt-4">
                <Link href="/corporate/login" className="text-[12px] font-bold text-[#999999] hover:text-[#2D4B3E] underline underline-offset-4">
                  すでにアカウントをお持ちの方はこちら
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}

// ★ 大元のコンポーネント。ここでSuspenseを使ってエラーを回避します
export default function CorporateRegisterPage() {
  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col justify-center items-center p-6 font-sans text-[#111111]">
      <Suspense fallback={<div className="text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>}>
        <RegisterContent />
      </Suspense>
    </div>
  );
}