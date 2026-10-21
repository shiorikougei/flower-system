'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, ChevronLeft } from 'lucide-react';

function EmailChangeContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';
  const token = searchParams.get('token');

  const [status, setStatus] = useState('processing'); // processing | success | error
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newToken, setNewToken] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('リンクが無効です');
      return;
    }
    fetch('/api/mypage/confirm-email-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setStatus('success');
          setNewEmail(d.newEmail);
          setNewToken(d.newToken);
        } else {
          setStatus('error');
          setMessage(d.error || '変更に失敗しました');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('通信エラーが発生しました');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-sans text-[#1F2A24] flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-[#E6E2DA] shadow-sm max-w-md w-full p-8 text-center space-y-4">
        {status === 'processing' && (
          <>
            <div className="text-[#5C6660] font-bold animate-pulse">処理中...</div>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 size={36} className="text-green-600"/>
            </div>
            <h1 className="text-[18px] font-bold text-[#2D4B3E]">メールアドレスを変更しました</h1>
            <p className="text-[14px] text-[#3B4640] leading-relaxed">
              新しいメールアドレス:<br/>
              <strong className="text-[#1F2A24]">{newEmail}</strong>
            </p>
            <p className="text-[13px] text-[#5C6660]">過去のご注文・記念日リマインダー・パスワード設定はすべて新しいメールアドレスに引き継がれました。</p>
            <button
              onClick={() => router.push(`/order/${tenantId}/${shopId}/mypage?token=${newToken}`)}
              className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl font-bold text-[15px] hover:bg-[#1f352b]"
            >
              マイページへ
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center">
              <AlertCircle size={36} className="text-red-600"/>
            </div>
            <h1 className="text-[16px] font-bold text-red-700">変更できませんでした</h1>
            <p className="text-[14px] text-[#3B4640]">{message}</p>
            <Link
              href={`/order/${tenantId}/${shopId}/history`}
              className="inline-flex items-center justify-center gap-1 w-full h-12 bg-[#FAFAF7] border border-[#E6E2DA] text-[#3B4640] rounded-xl font-bold text-[15px] hover:bg-[#E6E2DA]"
            >
              <ChevronLeft size={14}/> マイページログイン画面へ
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function EmailChangePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold">読み込み中...</div>}>
      <EmailChangeContent />
    </Suspense>
  );
}
