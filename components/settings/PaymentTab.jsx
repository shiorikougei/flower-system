'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { CreditCard, Check, AlertCircle, ExternalLink, Loader2, Unlink, Sparkles, Building2 } from 'lucide-react';

/**
 * 決済設定タブ（Stripe Connect）
 *
 * 状態:
 *   - 未接続: 「新規Express」or「既存Standard連携」ボタンを表示
 *   - 接続中: アカウント情報・状態を表示、「切断」ボタン
 *   - 追加情報要: 「オンボーディングを再開」ボタン
 */
export default function PaymentTab() {
  const [status, setStatus] = useState(null);  // null=loading, or {connected, ...}
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error'|'info', text: '' }

  // 初回取得 & URL のクエリパラメータ確認（オンボーディング戻り）
  useEffect(() => {
    fetchStatus();

    // URLに stripe_return / stripe_connected / stripe_error が付いていればメッセージ表示
    const u = new URL(window.location.href);
    if (u.searchParams.get('stripe_return')) {
      setMessage({ type: 'info', text: 'Stripeのオンボーディング画面から戻りました。接続状態を更新しています...' });
      // URLからクエリを消す
      u.searchParams.delete('stripe_return');
      window.history.replaceState({}, '', u.toString());
    } else if (u.searchParams.get('stripe_connected')) {
      setMessage({ type: 'success', text: 'Stripeアカウントを連携しました 🎉' });
      u.searchParams.delete('stripe_connected');
      window.history.replaceState({}, '', u.toString());
    } else if (u.searchParams.get('stripe_error')) {
      setMessage({ type: 'error', text: `エラー: ${u.searchParams.get('stripe_error')}` });
      u.searchParams.delete('stripe_error');
      window.history.replaceState({}, '', u.toString());
    }
  }, []);

  async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/staff/login';
      return null;
    }
    return { Authorization: `Bearer ${session.access_token}` };
  }

  async function fetchStatus() {
    setStatus(null);
    const headers = await getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch('/api/stripe/account', { headers });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setMessage({ type: 'error', text: '接続状態の取得に失敗しました' });
      setStatus({ connected: false });
    }
  }

  async function startExpressOnboarding() {
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/stripe/onboard', { method: 'POST', headers });
      const data = await res.json();
      if (data.url) {
        // Stripeのオンボーディングページへ遷移
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.error || 'URLが取得できませんでした' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'オンボーディング開始に失敗しました' });
    } finally {
      setBusy(false);
    }
  }

  async function startStandardOAuth() {
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/stripe/oauth', { headers });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.error || 'URLが取得できませんでした' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Standard連携の開始に失敗しました' });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm('Stripe接続を解除しますか？解除すると、これ以降の注文で決済を受け付けられなくなります。')) return;
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch('/api/stripe/disconnect', { method: 'POST', headers });
      const data = await res.json();
      if (data.disconnected) {
        setMessage({ type: 'success', text: 'Stripe接続を解除しました' });
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: data.error || '解除に失敗しました' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '解除に失敗しました' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border p-8 shadow-sm space-y-8 animate-in fade-in text-left">
      <div className="flex items-center gap-3 pb-4 border-b border-[#EAEAEA]">
        <div className="w-10 h-10 rounded-xl bg-[#2D4B3E]/10 flex items-center justify-center">
          <CreditCard size={20} className="text-[#2D4B3E]" />
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-[#2D4B3E]">決済設定（Stripe）</h2>
          <p className="text-[11px] text-[#999999] mt-0.5">クレジットカード決済を受け付けるための設定</p>
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`flex items-start gap-2 p-4 rounded-xl border ${
          message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200'
          : message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {message.type === 'error' ? <AlertCircle size={16} className="shrink-0 mt-0.5" />
            : message.type === 'success' ? <Check size={16} className="shrink-0 mt-0.5" />
            : <Sparkles size={16} className="shrink-0 mt-0.5" />}
          <p className="text-[12px] font-bold leading-relaxed">{message.text}</p>
        </div>
      )}

      {/* 状態表示 */}
      {status === null ? (
        <div className="py-12 flex flex-col items-center gap-3 text-[#999999]">
          <Loader2 className="animate-spin" size={24} />
          <p className="text-[12px] font-bold">接続状態を確認中...</p>
        </div>
      ) : status.connected ? (
        <ConnectedView status={status} onDisconnect={disconnect} onResume={startExpressOnboarding} busy={busy} />
      ) : (
        <DisconnectedView onExpress={startExpressOnboarding} onStandard={startStandardOAuth} busy={busy} />
      )}
    </div>
  );
}

// ========== 未接続時の表示 ==========
function DisconnectedView({ onExpress, onStandard, busy }) {
  return (
    <div className="space-y-6">
      <div className="bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl p-5">
        <p className="text-[12px] text-[#555555] leading-relaxed">
          お客様からのクレジットカード決済を受け付けるには、Stripeアカウントの連携が必要です。
          手数料は <span className="font-bold">Stripeの取引手数料のみ</span>（プラットフォーム手数料は不要です）。
          売上金は Stripe から直接お店の銀行口座に振り込まれます。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 新規 Express */}
        <button
          type="button"
          disabled={busy}
          onClick={onExpress}
          className="text-left p-6 bg-white border-2 border-[#2D4B3E] rounded-2xl hover:bg-[#2D4B3E]/5 transition-all disabled:opacity-50 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#2D4B3E]" />
            <span className="text-[14px] font-bold text-[#2D4B3E]">新規でStripe決済を有効化</span>
          </div>
          <p className="text-[11px] text-[#555555] leading-relaxed">
            Stripeアカウントを持っていない方向け。フォームに必要情報を入力するだけで、5〜10分で設定完了します。
          </p>
          <span className="inline-block text-[10px] bg-[#2D4B3E] text-white px-2 py-1 rounded">推奨</span>
        </button>

        {/* 既存 Standard */}
        <button
          type="button"
          disabled={busy}
          onClick={onStandard}
          className="text-left p-6 bg-white border border-[#EAEAEA] rounded-2xl hover:border-[#2D4B3E] transition-all disabled:opacity-50 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#555555]" />
            <span className="text-[14px] font-bold text-[#111111]">既存のStripeアカウントを連携</span>
          </div>
          <p className="text-[11px] text-[#555555] leading-relaxed">
            既にStripeアカウントをお持ちの方向け。Stripeにログインして、このアプリへのアクセスを許可します。
          </p>
        </button>
      </div>

      {busy && (
        <div className="flex items-center justify-center gap-2 text-[#999999] text-[12px] font-bold">
          <Loader2 className="animate-spin" size={16} /> 準備中...
        </div>
      )}
    </div>
  );
}

// ========== 接続済みの表示 ==========
function ConnectedView({ status, onDisconnect, onResume, busy }) {
  const ready = status.chargesEnabled && status.payoutsEnabled && status.detailsSubmitted;
  const needsAction =
    !status.detailsSubmitted ||
    !status.chargesEnabled ||
    !status.payoutsEnabled;

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-xl border ${ready ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex items-start gap-3">
          {ready
            ? <Check size={20} className="text-green-600 shrink-0 mt-0.5" />
            : <AlertCircle size={20} className="text-orange-600 shrink-0 mt-0.5" />}
          <div className="space-y-1">
            <p className={`text-[14px] font-bold ${ready ? 'text-green-700' : 'text-orange-700'}`}>
              {ready ? 'Stripe決済が有効です' : 'まだ追加の入力が必要です'}
            </p>
            <p className="text-[11px] text-[#555555]">
              アカウントID: <code className="bg-white px-2 py-0.5 rounded text-[10px]">{status.accountId}</code>
              <span className="ml-2 inline-block bg-[#2D4B3E] text-white text-[9px] px-2 py-0.5 rounded uppercase">
                {status.type}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <StatusCell label="本人確認" ok={status.detailsSubmitted} />
        <StatusCell label="決済受付" ok={status.chargesEnabled} />
        <StatusCell label="振込" ok={status.payoutsEnabled} />
      </div>

      {needsAction && (
        <button
          type="button"
          disabled={busy}
          onClick={onResume}
          className="w-full h-12 bg-[#2D4B3E] text-white rounded-xl font-bold text-[13px] hover:bg-[#1f352b] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <ExternalLink size={16} /> オンボーディングを再開
        </button>
      )}

      <div className="pt-4 border-t border-[#EAEAEA]">
        <button
          type="button"
          disabled={busy}
          onClick={onDisconnect}
          className="text-[11px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1.5"
        >
          <Unlink size={12} /> Stripe接続を解除する
        </button>
      </div>
    </div>
  );
}

function StatusCell({ label, ok }) {
  return (
    <div className={`p-3 rounded-xl border ${ok ? 'bg-green-50 border-green-200' : 'bg-[#FBFAF9] border-[#EAEAEA]'}`}>
      <p className="text-[10px] font-bold text-[#999999] mb-1">{label}</p>
      <p className={`text-[12px] font-bold ${ok ? 'text-green-700' : 'text-[#999999]'}`}>
        {ok ? '✓ 完了' : '未完了'}
      </p>
    </div>
  );
}
