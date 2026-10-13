'use client';
// [2026-10 画面リニューアル] 注文詳細のページ
//   これまで受注一覧の上に浮かぶ箱（モーダル）で出していた注文詳細を、注文ごとのページにした。
//   中身は components/OrderDetailModal.jsx をそのまま使う（asPage）。
//   ボタンを押したときの処理は、受注一覧（app/staff/orders/page.js）と同じ。
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/utils/supabase';
import { logAction } from '@/utils/auditLog';
import { ensureOperationAllowed } from '@/utils/staffRole';
import { getStaffTenant, getStaffSettings } from '@/utils/staffContext';

const OrderDetailModal = dynamic(() => import('@/components/OrderDetailModal'), { ssr: false });

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [appSettings, setAppSettings] = useState({});
  const [tenantId, setTenantId] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | notfound

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { session, tenantId: tId } = await getStaffTenant();
        if (!session) { window.location.href = '/staff/login'; return; }
        if (!tId) throw new Error('tenant_id が取得できませんでした');
        setTenantId(tId);
        const [orderRes, settings] = await Promise.all([
          // ★ セキュリティ: 自分のお店の注文だけ
          supabase.from('orders').select('*').eq('id', String(orderId)).eq('tenant_id', tId).maybeSingle(),
          getStaffSettings(tId),
        ]);
        if (cancelled) return;
        if (settings) setAppSettings(settings);
        if (!orderRes.data) { setState('notfound'); return; }
        setOrder(orderRes.data);
        setState('ready');
      } catch (e) {
        console.error('注文の取得に失敗:', e);
        if (!cancelled) setState('notfound');
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  // 受注一覧が使い回している注文の一覧（ブラウザに保存）も同じ内容にそろえる
  const syncListCache = (updater) => {
    if (!tenantId) return;
    const key = `florix_orders_cache_${tenantId}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (Array.isArray(cached)) sessionStorage.setItem(key, JSON.stringify(updater(cached)));
    } catch { /* 保存できなくても続ける */ }
  };

  const backToList = () => {
    if (window.history.length > 1) router.back();
    else router.push('/staff/orders');
  };

  // ---- ここから下の 4 つは、受注一覧（app/staff/orders/page.js）と同じ処理 ----
  const handleUpdateStatus = async (id, newStatus, staffName) => {
    const guard = ensureOperationAllowed('ステータス更新');
    if (!guard.allowed) { alert(guard.message); return false; }
    try {
      const currentHistory = order.order_data.statusHistory || [];
      const newHistoryEntry = { status: newStatus, staff: staffName || '-', date: new Date().toISOString() };
      const updatedData = {
        ...order.order_data,
        currentStatus: newStatus,
        status: newStatus,
        statusHistory: [newHistoryEntry, ...currentHistory],
      };
      const { error: updateErr } = await supabase.from('orders').update({ order_data: updatedData }).eq('id', id).eq('tenant_id', tenantId);
      if (updateErr) throw updateErr;
      setOrder(prev => ({ ...prev, order_data: updatedData }));
      syncListCache(list => list.map(o => o.id === id ? { ...o, order_data: updatedData } : o));
      logAction({ action: 'order_status_change', targetType: 'order', targetId: id, description: `ステータスを「${newStatus}」に変更` });
      return true;
    } catch (err) {
      alert('更新に失敗しました。');
      return false;
    }
  };

  const handleUpdatePayment = async (id, currentData, opts = {}) => {
    if (!opts.skipConfirm) {
      if (!confirm('この注文を「入金済」として処理しますか？')) return;
    }
    try {
      let updatedData;
      if (opts.alreadyUpdated) {
        updatedData = currentData;
      } else {
        const oldStatus = currentData.paymentStatus || '';
        let newStatus = '入金済';
        if (oldStatus.includes('引き取り時')) newStatus = '入金済（引き取り時受領）';
        updatedData = { ...currentData, paymentStatus: newStatus };
        await supabase.from('orders').update({ order_data: updatedData }).eq('id', id).eq('tenant_id', tenantId);
      }
      setOrder(prev => ({ ...prev, order_data: updatedData }));
      syncListCache(list => list.map(o => o.id === id ? { ...o, order_data: updatedData } : o));
      if (!opts.skipConfirm) alert('入金済みに更新しました！');
      logAction({ action: 'order_payment_confirm', targetType: 'order', targetId: id, description: '入金済みに更新' });
    } catch (error) {
      console.error(error);
      alert('更新に失敗しました。');
    }
  };

  const handleArchive = async (id, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'new';
    if (!confirm(`この注文を${isArchive ? '完了' : '未完了'}にしますか？`)) return;
    try {
      const updatedData = { ...order.order_data, status: newStatus };
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', id).eq('tenant_id', tenantId);
      syncListCache(list => list.map(o => o.id === id ? { ...o, order_data: updatedData } : o));
      logAction({ action: 'order_archive', targetType: 'order', targetId: id, description: isArchive ? '注文を完了' : '注文を未完了に戻す' });
      // 受注一覧のときと同じく、完了・未完了にしたら一覧に戻る
      backToList();
    } catch (err) { alert('更新失敗'); }
  };

  const handleDelete = async (id) => {
    const inputPass = prompt('この注文を削除しますか？\n実行するには管理者パスワードを入力してください。');
    if (inputPass === null) return;
    const systemPass = appSettings?.generalConfig?.systemPassword || '7777';
    if (inputPass !== systemPass) {
      alert('パスワードが違います。');
      return;
    }
    if (!confirm('本当に削除してもよろしいですか？\nこの操作は取り消せません。')) return;
    try {
      const { error } = await supabase.from('orders').delete().eq('id', id).eq('tenant_id', tenantId);
      if (error) throw error;
      syncListCache(list => list.filter(o => o.id !== id));
      alert('注文を削除しました。');
      logAction({ action: 'order_delete', targetType: 'order', targetId: id, description: '注文を削除' });
      router.push('/staff/orders');
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました。');
    }
  };

  if (state === 'loading') {
    return <div className="min-h-screen bg-[#F6F4EF] flex items-center justify-center text-[16px] text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>;
  }
  if (state === 'notfound') {
    return (
      <div className="min-h-screen bg-[#F6F4EF] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[16px] font-bold text-[#1F2A24]">この注文は見つかりませんでした。</p>
        <button type="button" onClick={() => router.push('/staff/orders')} className="h-11 px-5 rounded-xl bg-[#2D4B3E] text-white text-[15px] font-bold">受注一覧に戻る</button>
      </div>
    );
  }

  return (
    <OrderDetailModal
      asPage
      order={order}
      appSettings={appSettings}
      onClose={backToList}
      onUpdateStatus={handleUpdateStatus}
      onUpdatePayment={handleUpdatePayment}
      onArchive={handleArchive}
      onDelete={handleDelete}
    />
  );
}
