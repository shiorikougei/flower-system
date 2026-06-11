// [後方互換] 旧 /staff/scan/[productId] へのアクセスを新URL /scan/[productId] にリダイレクト
// 既に印刷済みのQRコードがあった場合の救済

'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LegacyScanRedirect() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.productId;

  useEffect(() => {
    if (productId) router.replace(`/scan/${productId}`);
  }, [productId, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FBFAF9]">
      <p className="text-[12px] text-[#999]">リダイレクト中...</p>
    </main>
  );
}
