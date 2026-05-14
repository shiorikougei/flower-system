'use client';
// ===============================================================
// 機能ゲート（FeatureGate）
// ---------------------------------------------------------------
// サブスク機能 ON のテナントだけにページ本体を表示。
// 未契約テナントが URL 直打ちで入っても、ロック画面が出る。
//
// 使い方:
//   import FeatureGate from '@/components/FeatureGate';
//   export default function CustomersPage() {
//     return (
//       <FeatureGate feature="customers" label="顧客管理">
//         {/* 本来のページ */}
//       </FeatureGate>
//     );
//   }
//
// 動作:
//   - tenantSettings.features?.[feature] が true ならそのまま表示
//   - false なら「サブスク未契約のためご利用いただけません」のロック画面
// ===============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { Lock, Sparkles, ChevronLeft } from 'lucide-react';
import { isFeatureEnabled } from '@/utils/features';

export default function FeatureGate({ feature, label, children }) {
  const [state, setState] = useState({ loading: true, enabled: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { if (!cancelled) setState({ loading: false, enabled: false }); return; }
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        const tenantId = profile?.tenant_id;
        if (!tenantId) { if (!cancelled) setState({ loading: false, enabled: false }); return; }
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
        const ok = isFeatureEnabled(data?.settings_data, feature);
        if (!cancelled) setState({ loading: false, enabled: ok });
      } catch {
        if (!cancelled) setState({ loading: false, enabled: false });
      }
    })();
    return () => { cancelled = true; };
  }, [feature]);

  if (state.loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-[12px] text-[#999] animate-pulse">確認中...</p>
      </div>
    );
  }
  if (state.enabled) return children;

  // 未契約: ロック画面
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#EAEAEA] rounded-2xl p-8 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-amber-50 rounded-full flex items-center justify-center">
          <Lock size={32} className="text-amber-600"/>
        </div>
        <h2 className="text-[16px] font-bold text-[#2D4B3E]">{label || feature} はサブスク未契約です</h2>
        <p className="text-[12px] text-[#555] leading-relaxed">
          この機能をご利用いただくには、サブスクオプションの追加が必要です。<br/>
          サイドバー下部の「機能アップグレード」から即時お申し込みいただけます。
        </p>
        <div className="flex gap-2 pt-2">
          <Link href="/staff" className="flex-1 h-11 bg-[#EAEAEA] text-[#555] text-[12px] font-bold rounded-xl flex items-center justify-center gap-1">
            <ChevronLeft size={14}/> ホームに戻る
          </Link>
          <Link href="/terms" className="flex-1 h-11 bg-[#2D4B3E] text-white text-[12px] font-bold rounded-xl flex items-center justify-center gap-1">
            <Sparkles size={14}/> 利用規約を見る
          </Link>
        </div>
      </div>
    </div>
  );
}
