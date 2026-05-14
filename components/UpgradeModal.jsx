'use client';
// ===============================================================
// 機能アップグレードフォームモーダル
// ---------------------------------------------------------------
// サイドバーの「機能アップグレード問い合わせ」から開く
// 未開放の機能をチェック → 料金プレビュー → 同意 → 即時ON + 通知
// ===============================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { FEATURE_GROUPS } from '@/utils/features';
import { DEFAULT_PRICING, calcMonthlyFee, calcWithManualOverride } from '@/utils/subscriptionPricing';
import { X, CheckCircle2, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';

export default function UpgradeModal({ open, onClose, tenantSettings }) {
  const [selected, setSelected] = useState({});
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  // 現在の features
  const currentFeatures = tenantSettings?.features || {};
  // pricing は基本マスター（サーバーから動的取得しないシンプル版）
  const pricing = DEFAULT_PRICING;

  // ★ 手動オーバーライド（モデル店舗・特別契約）
  //    オーナーがサブスク管理タブで保存すると tenantSettings.subscriptionBilling にミラーされる
  const billing = tenantSettings?.subscriptionBilling || {};
  const m = billing.manualPriceJpy;
  const hasManual = m != null && m !== '' && Number(m) >= 0;

  // 未開放の機能リスト
  const availableUpgrades = useMemo(() => {
    return FEATURE_GROUPS.flatMap(g =>
      g.items
        .filter(i => !i.alwaysOn && !currentFeatures[i.key])
        .map(i => ({ ...i, groupName: g.name, price: pricing.featurePrices[i.key] || 0 }))
    );
  }, [currentFeatures]);

  // 選択合計（手動オーバーライドがあれば固定額のまま）
  const summary = useMemo(() => {
    if (hasManual) {
      return calcWithManualOverride(Number(m), pricing.taxRate);
    }
    const previewFeatures = { ...currentFeatures };
    Object.keys(selected).forEach(k => { if (selected[k]) previewFeatures[k] = true; });
    return calcMonthlyFee(previewFeatures, pricing);
  }, [selected, currentFeatures, hasManual, m]);

  const currentFee = useMemo(() => {
    if (hasManual) return calcWithManualOverride(Number(m), pricing.taxRate);
    return calcMonthlyFee(currentFeatures, pricing);
  }, [currentFeatures, hasManual, m]);
  const diff = summary.total - currentFee.total;

  const submitUpgrade = async () => {
    const featureKeys = Object.keys(selected).filter(k => selected[k]);
    if (featureKeys.length === 0) { alert('機能を1つ以上選択してください'); return; }
    if (!agree) { alert('利用規約に同意してください'); return; }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('ログインが必要です');
      const res = await fetch('/api/admin/auto-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ featureKeys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(data);
    } catch (e) { alert('エラー: ' + e.message); }
    finally { setSubmitting(false); }
  };

  if (!open) return null;

  // 完了画面
  if (done) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center">
            <CheckCircle2 size={36} className="text-green-600"/>
          </div>
          <h3 className="text-[16px] font-bold text-[#2D4B3E]">🎉 機能を有効化しました</h3>
          <p className="text-[12px] text-[#555] leading-relaxed">
            {done.enabled.length} 個の機能が <strong>即時利用可能</strong> になりました。<br/>
            当月分はお試し期間として <strong>無料</strong>、料金は翌月分から発生いたします。
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
            翌月からの月額料金: <strong className="text-[14px]">¥{done.newMonthlyFee?.toLocaleString()}/月</strong>（税込）
          </div>
          <button onClick={() => { setDone(null); setSelected({}); setAgree(false); onClose(); window.location.reload(); }} className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl font-bold text-[13px]">
            閉じる（ページ更新）
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-[#EAEAEA] flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-[#2D4B3E] flex items-center gap-2">
              <Sparkles size={18}/> 機能アップグレード
            </h3>
            <p className="text-[11px] text-[#999] mt-1">追加したい機能にチェックを入れてください</p>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-[#111]"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {availableUpgrades.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[13px] font-bold text-[#117768]">🎉 全ての機能が既に有効です！</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {availableUpgrades.map(item => (
                  <label key={item.key} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${selected[item.key] ? 'border-[#117768] bg-[#117768]/5' : 'border-[#EAEAEA] hover:border-[#2D4B3E]/40'}`}>
                    <input type="checkbox" checked={Boolean(selected[item.key])}
                      onChange={(e) => setSelected(s => ({ ...s, [item.key]: e.target.checked }))}
                      className="mt-1 w-5 h-5 accent-[#117768]"/>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-bold text-[#111]">{item.label}</p>
                        <p className="text-[14px] font-bold text-[#2D4B3E] shrink-0">+¥{item.price.toLocaleString()}<span className="text-[10px] text-[#999] font-normal">/月</span></p>
                      </div>
                      <p className="text-[11px] text-[#555] mt-0.5">{item.description}</p>
                      <p className="text-[9px] text-[#999] mt-1">[{item.groupName}]</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* 料金変更プレビュー */}
              {Object.values(selected).some(Boolean) && (
                <div className="bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-4 space-y-2">
                  <p className="text-[11px] font-bold text-[#2D4B3E] tracking-widest">料金変更プレビュー</p>

                  {hasManual && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-blue-900 leading-relaxed">
                      📌 お客様は<strong>特別契約（固定料金）</strong>のため、機能を追加しても月額は<strong> ¥{currentFee.total.toLocaleString()}/月 のまま据え置き</strong>です。
                      {billing.manualReason && <><br/><span className="text-[10px] text-blue-700">理由: {billing.manualReason}</span></>}
                    </div>
                  )}

                  <div className="flex justify-between text-[12px] text-[#555]">
                    <span>現在の月額（税込）{hasManual && <span className="text-[10px] text-blue-600 ml-1">[手動]</span>}</span>
                    <span>¥{currentFee.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[14px] font-bold text-[#117768] pt-2 border-t border-[#EAEAEA]">
                    <span>翌月からの月額（税込）{hasManual && <span className="text-[10px] text-blue-600 ml-1">[手動]</span>}</span>
                    <span>¥{summary.total.toLocaleString()}</span>
                  </div>
                  {!hasManual && (
                    <div className="flex justify-between text-[11px] text-[#D97D54] font-bold">
                      <span>差額</span>
                      <span>+¥{diff.toLocaleString()}/月</span>
                    </div>
                  )}
                  {hasManual && diff === 0 && (
                    <div className="flex justify-between text-[11px] text-blue-700 font-bold">
                      <span>差額</span>
                      <span>±¥0（特別契約）</span>
                    </div>
                  )}
                </div>
              )}

              {/* 利用規約同意 */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="text-[11px] text-amber-900 leading-relaxed">
                  <p className="font-bold mb-1">📋 アップグレードの条件</p>
                  <ul className="space-y-1 ml-3">
                    <li>・選択した機能は<strong>即時利用可能</strong>になります</li>
                    <li>・<strong>当月分</strong>はお試し期間として<strong>無料</strong>でご利用いただけます</li>
                    <li>・料金は<strong>翌月分から</strong>発生し、毎月1日に請求書をメールでお送りします</li>
                    <li>・解約は <Link href="/terms" target="_blank" className="underline">利用規約</Link> に従ってください</li>
                  </ul>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 accent-amber-600"/>
                  <span className="text-[12px] font-bold text-amber-900">
                    <Link href="/terms" target="_blank" className="underline inline-flex items-center gap-1">利用規約<ExternalLink size={10}/></Link> に同意します
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-[#EAEAEA] flex gap-2">
          <button onClick={onClose} className="flex-1 h-12 bg-[#EAEAEA] text-[#555] text-[13px] font-bold rounded-xl">キャンセル</button>
          {availableUpgrades.length > 0 && (
            <button
              onClick={submitUpgrade}
              disabled={submitting || !agree || Object.values(selected).every(v => !v)}
              className="flex-[2] h-12 bg-[#2D4B3E] text-white text-[13px] font-bold rounded-xl hover:bg-[#1f352b] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles size={14}/> {submitting ? '処理中...' : '同意して即時アップグレード'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
