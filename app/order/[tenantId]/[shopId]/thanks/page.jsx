'use client';
import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { CheckCircle2 } from 'lucide-react';

function ThanksContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';

  // ★ URLパラメータから payment / order_id / from を取得
  const paymentResult = searchParams.get('payment');   // 'success' if card paid
  const orderId = searchParams.get('order_id');
  const from = searchParams.get('from');               // 'ec' なら EC カタログに戻る

  const [appSettings, setAppSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('settings_data')
          .eq('id', tenantId)
          .single();
        if (error) throw error;
        if (data && data.settings_data) setAppSettings(data.settings_data);
      } catch (err) {
        console.error('設定の読み込みに失敗しました:', err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();

    // ★ Webhookが届かない場合の安全網:
    //   ?payment=success で戻ってきたら、サーバー側でStripeに問い合わせて支払い確認 → 入金済反映
    if (paymentResult === 'success' && orderId) {
      fetch('/api/stripe/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, tenantId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.updated) console.log('注文を入金済に同期しました');
          else if (data.alreadyPaid) console.log('Webhookで既に同期済み');
        })
        .catch(err => console.warn('入金同期に失敗:', err));
    }
  }, [tenantId, paymentResult, orderId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-sans">
        <div className="text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>
      </div>
    );
  }

  const generalConfig = appSettings?.generalConfig || {};
  const appName = generalConfig.appName || 'FLORIX';
  const logoUrl = generalConfig.logoUrl || '';
  const logoSize = generalConfig.logoSize || 100;
  const logoTransparent = generalConfig.logoTransparent || false;

  const shops = appSettings?.shops || [];
  const targetShop = shops.find(s => String(s.id) === String(shopId)) || shops[0] || { name: appName };
  const bankInfo = targetShop.bankInfo || '';

  // クレジットカード決済成功フラグ
  const isCardPaid = paymentResult === 'success';

  return (
    <div className="min-h-screen bg-[#FBFAF9] flex flex-col font-sans text-[#111111]">

      {/* ヘッダー */}
      <header className="h-16 bg-white/80 backdrop-blur-md border-b border-[#EAEAEA] flex items-center justify-center px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 h-full">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={targetShop.name}
              style={{
                height: `${(logoSize / 100) * 32}px`,
                maxHeight: '50px',
                mixBlendMode: logoTransparent ? 'multiply' : 'normal'
              }}
              className="object-contain"
            />
          ) : (
            <span className="font-serif font-bold tracking-tight text-[18px] text-[#2D4B3E]">{targetShop.name}</span>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center pb-20">
        <div className="bg-white p-8 md:p-14 rounded-2xl shadow-sm border border-[#EAEAEA] max-w-lg w-full animate-in fade-in duration-300">

          {/* チェックマーク */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-[#2D4B3E]/10 text-[#2D4B3E]">
            <CheckCircle2 size={40} />
          </div>

          <h1 className="text-[24px] md:text-[28px] font-serif italic text-[#2D4B3E] mb-4">Thank you!</h1>
          <p className="text-[16px] font-bold text-[#111111] mb-6">
            {isCardPaid ? 'ご注文・お支払いが完了しました。' : 'ご注文が完了しました。'}
          </p>

          <div className="text-[13px] text-[#555555] space-y-3 leading-relaxed">
            <p>
              この度は <strong>{targetShop.name}</strong> をご利用いただき、誠にありがとうございます。
            </p>
            <p>ご入力いただいた内容を確認の上、スタッフより手配を進めさせていただきます。</p>
            {orderId && (
              <p className="text-[11px] text-[#999999] mt-2">
                ご注文番号: <code className="bg-[#FBFAF9] px-2 py-0.5 rounded text-[#555555]">{orderId.slice(0, 8)}</code>
              </p>
            )}
          </div>

          {/* ★ カード決済済みの場合のみ「決済完了」セクションを表示 */}
          {isCardPaid && (
            <div className="mt-10 mb-2 w-full bg-[#2D4B3E]/5 border border-[#2D4B3E]/20 rounded-2xl p-6 text-left">
              <p className="text-[13px] font-bold text-[#2D4B3E] mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} />
                クレジットカードでのお支払いが完了しました
              </p>
              <p className="text-[11px] text-[#555555] leading-relaxed">
                お支払い金額および詳細は、Stripeより自動送信されるレシートメールをご確認ください。
              </p>
            </div>
          )}

          {/* ★ カード決済「以外」かつ 銀行振込情報がある場合のみ表示 */}
          {!isCardPaid && bankInfo && (
            <div className="mt-10 mb-8 w-full text-left bg-[#FBFAF9] p-6 md:p-8 rounded-2xl border border-[#EAEAEA] space-y-4">
              <h2 className="text-[13px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 text-center">お支払いについて</h2>
              <div className="space-y-3">
                <p className="text-[11px] text-[#555555] font-bold text-center">銀行振込をご希望の方</p>
                <div className="bg-white p-4 rounded-xl border border-[#EAEAEA]">
                  <pre className="text-[12px] font-bold text-[#555555] font-sans whitespace-pre-wrap leading-relaxed">{bankInfo}</pre>
                </div>
                <p className="text-[10px] text-[#999999] text-center">※お振込手数料はお客様負担となります。</p>
              </div>
            </div>
          )}

          <div className="mt-8">
            {/* ★ EC注文ならカタログに、カスタム注文ならトップに戻る */}
            <button
              onClick={() => {
                if (from === 'ec') {
                  router.push(`/order/${tenantId}/${shopId}/shop`);
                } else {
                  router.push(`/order/${tenantId}/${shopId}`);
                }
              }}
              className="w-full py-4 rounded-xl bg-white border border-[#EAEAEA] text-[#555555] font-bold text-[13px] hover:border-[#2D4B3E] hover:text-[#2D4B3E] transition-all"
            >
              {from === 'ec' ? '商品一覧に戻る' : '最初の画面に戻る'}
            </button>
          </div>

        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');
        .font-serif { font-family: 'Noto Serif JP', serif; }
      `}</style>
    </div>
  );
}

export default function ThanksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center font-sans text-[#2D4B3E] font-bold">読み込み中...</div>}>
      <ThanksContent />
    </Suspense>
  );
}
