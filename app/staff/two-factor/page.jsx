// [Phase2-⑨] 2FA（TOTP）設定ページ
// スタッフ・オーナーアカウントに2段階認証を追加

'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Shield, AlertCircle, CheckCircle2, Smartphone, Trash2, RefreshCw, Lock } from 'lucide-react';

export default function TwoFactorPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [factors, setFactors] = useState([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState(null); // { factorId, qr, secret }
  const [verifyCode, setVerifyCode] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadFactors();
  }, []);

  async function loadFactors() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors([...(data?.totp || []), ...(data?.phone || [])]);
    } catch (e) {
      console.warn('MFA factors取得失敗:', e?.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function startEnroll() {
    setEnrolling(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `FLORIX - ${new Date().toLocaleDateString('ja-JP')}`,
      });
      if (error) throw error;
      setEnrollData({
        factorId: data.id,
        qr: data.totp?.qr_code,
        secret: data.totp?.secret,
      });
    } catch (e) {
      setMessage({ type: 'error', text: e.message || '登録開始失敗' });
      setEnrolling(false);
    }
  }

  async function verifyEnroll() {
    if (!enrollData?.factorId || verifyCode.length !== 6) return;
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      });
      if (chErr) throw chErr;
      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verErr) throw verErr;
      setMessage({ type: 'success', text: '2段階認証を有効化しました！' });
      setEnrolling(false);
      setEnrollData(null);
      setVerifyCode('');
      await loadFactors();
    } catch (e) {
      setMessage({ type: 'error', text: 'コードが違います。もう一度入力してください。' });
      setVerifyCode('');
    }
  }

  async function removeFactor(factorId) {
    if (!confirm('この2段階認証を解除しますか？')) return;
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setMessage({ type: 'success', text: '2段階認証を解除しました' });
      await loadFactors();
    } catch (e) {
      setMessage({ type: 'error', text: e.message || '解除失敗' });
    }
  }

  return (
    <main className="pb-32 font-sans">
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center px-6 md:px-8 sticky top-0 z-10">
        <div>
          <h1 className="text-[18px] font-bold tracking-tight text-[#2D4B3E] flex items-center gap-2">
            <Shield size={18} /> 2段階認証（2FA）
          </h1>
          <p className="text-[11px] text-[#999999] mt-0.5">アカウント乗っ取りから店舗を守る最強の対策</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {message && (
          <div className={`flex items-start gap-2 p-4 rounded-xl border ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <p className="text-[12px] font-bold">{message.text}</p>
          </div>
        )}

        {/* 説明 */}
        <div className="bg-[#FBFAF9] border border-[#EAEAEA] rounded-2xl p-5 space-y-3">
          <h2 className="text-[14px] font-bold text-[#2D4B3E] flex items-center gap-2"><Smartphone size={16} /> 2段階認証とは</h2>
          <p className="text-[12px] text-[#555] leading-relaxed">
            ログイン時に <strong>パスワード + 認証アプリの6桁コード</strong> の両方を求めることで、パスワードが漏洩しても不正ログインを防げます。
          </p>
          <ul className="text-[11px] text-[#555] space-y-1 ml-4 list-disc">
            <li>Google Authenticator（推奨・無料）</li>
            <li>1Password（パスワードマネージャー併用）</li>
            <li>Microsoft Authenticator</li>
          </ul>
        </div>

        {/* 登録済み認証要素 */}
        {isLoading ? (
          <div className="text-center py-8 text-[12px] text-[#999]">読み込み中...</div>
        ) : factors.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <Lock size={32} className="mx-auto text-amber-600 mb-3" />
            <p className="text-[14px] font-bold text-amber-900 mb-1">まだ2段階認証が設定されていません</p>
            <p className="text-[11px] text-amber-700">下のボタンから登録してください（5分で完了）</p>
          </div>
        ) : (
          <div className="bg-white border border-[#EAEAEA] rounded-2xl p-5 space-y-3">
            <h3 className="text-[13px] font-bold text-[#2D4B3E]">登録済みの認証要素</h3>
            {factors.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-[#FBFAF9] rounded-xl border border-[#EAEAEA]">
                <div>
                  <p className="text-[13px] font-bold text-[#111]">{f.friendly_name || 'TOTP'}</p>
                  <p className="text-[10px] text-[#999]">登録日: {new Date(f.created_at).toLocaleDateString('ja-JP')}</p>
                </div>
                <button onClick={() => removeFactor(f.id)} className="text-red-500 hover:text-red-700 p-2">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 登録フロー */}
        {!enrolling && !enrollData && (
          <button
            onClick={startEnroll}
            className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold hover:bg-[#1f352b] flex items-center justify-center gap-2"
          >
            <Shield size={16} /> {factors.length > 0 ? '別のデバイスを追加登録' : '2段階認証を登録する'}
          </button>
        )}

        {enrollData && (
          <div className="bg-white border-2 border-[#2D4B3E] rounded-2xl p-6 space-y-5">
            <h3 className="text-[14px] font-bold text-[#2D4B3E] text-center">認証アプリで読み取り</h3>

            {enrollData.qr && (
              <div className="bg-white p-4 rounded-xl border border-[#EAEAEA] flex justify-center">
                <img src={enrollData.qr} alt="QRコード" className="w-48 h-48" />
              </div>
            )}

            <details className="bg-[#FBFAF9] rounded-xl border border-[#EAEAEA] p-3">
              <summary className="text-[11px] font-bold text-[#555] cursor-pointer">QRが読めない場合は手動入力</summary>
              <div className="mt-2 p-2 bg-white border border-[#EAEAEA] rounded text-[10px] font-mono break-all">
                {enrollData.secret}
              </div>
            </details>

            <div>
              <label className="text-[11px] font-bold text-[#999] block mb-2">アプリに表示された6桁コードを入力</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === 'Enter' && verifyCode.length === 6) verifyEnroll(); }}
                autoFocus
                className="w-full h-14 text-center text-[28px] font-bold tracking-[0.5em] bg-[#FBFAF9] border-2 border-[#EAEAEA] rounded-xl outline-none focus:border-[#2D4B3E] font-mono"
                placeholder="000000"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setEnrolling(false); setEnrollData(null); setVerifyCode(''); }}
                className="flex-1 h-11 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-xl"
              >
                キャンセル
              </button>
              <button
                onClick={verifyEnroll}
                disabled={verifyCode.length !== 6}
                className="flex-1 h-11 bg-[#2D4B3E] text-white text-[12px] font-bold rounded-xl disabled:opacity-50 hover:bg-[#1f352b]"
              >
                登録を完了
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
