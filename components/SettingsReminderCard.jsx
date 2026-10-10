'use client';
// [2026-10] 設定が足りないときのお知らせ（ダッシュボード）
// 今は「お問い合わせ用メールアドレス（お客様に表示）」が未入力の店舗があるときに表示する。
// 入力すると自動で消える（「確認しました」で消すものではない）

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '@/utils/supabase';

export default function SettingsReminderCard() {
  const [missingShops, setMissingShops] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
        if (!profile?.tenant_id) return;
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', profile.tenant_id).single();
        const shops = Array.isArray(data?.settings_data?.shops) ? data.settings_data.shops : [];
        const missing = shops
          .filter(s => s && s.isActive !== false && !String(s.contactEmail || '').trim())
          .map(s => s.name || '店舗');
        if (!cancelled) setMissingShops(missing);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  if (missingShops.length === 0) return null;

  return (
    <section className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3" aria-label="設定のお願い">
      <div className="flex items-start gap-2">
        <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5"/>
        <div className="space-y-1">
          <p className="text-[14px] font-bold text-amber-900">お客様向けのお問い合わせ用メールアドレスを入力してください</p>
          <p className="text-[12px] text-amber-900 leading-relaxed">
            お客様へのメールの一番下と、お店のプライバシーポリシーに表示されるお問い合わせ先です。
            入力するまでは、メールアドレスが表示されないことがあります（電話番号は表示されます）。
          </p>
          <p className="text-[12px] text-amber-800">未入力の店舗: {missingShops.join('、')}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/staff/settings" className="inline-flex items-center gap-1 h-10 px-4 rounded-xl bg-[#2D4B3E] text-white text-[12px] font-bold hover:bg-[#1f352b]">
          設定を開く（店舗・口座・特別日）<ChevronRight size={14}/>
        </Link>
        <Link href="/staff/help#shop_contact_email" className="inline-flex items-center h-10 px-4 rounded-xl bg-white border border-amber-300 text-amber-900 text-[12px] font-bold hover:bg-amber-100">
          入力のしかた
        </Link>
      </div>
    </section>
  );
}
