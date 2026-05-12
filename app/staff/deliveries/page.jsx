'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import {
  MapPin,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Clock,
  Truck,
  Phone,
  Package,
  AlertCircle,
  MessageSquare,
  ListChecks,
  RefreshCw,
  Copy,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';

export default function DeliveriesPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appSettings, setAppSettings] = useState(null);
  const [currentTenantId, setCurrentTenantId] = useState(null);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewRange, setViewRange] = useState(3);

  useEffect(() => {
    initData();
  }, []);

  // ★ セキュリティ修正: tenant_id を取得して、orders / settings の両方をテナントスコープに
  const initData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/staff/login';
        return;
      }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single();
      if (profileError) throw profileError;
      const tId = profile.tenant_id;
      if (!tId) throw new Error('tenant_id が取得できませんでした');
      setCurrentTenantId(tId);

      const [ordersRes, settingsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false }),
        // ★ バグ修正: 'default' ではなく実際の tenant_id で settings を取得
        supabase.from('app_settings').select('settings_data').eq('id', tId).single()
      ]);

      if (ordersRes.error) throw ordersRes.error;
      setOrders(ordersRes.data || []);
      if (settingsRes.data?.settings_data) setAppSettings(settingsRes.data.settings_data);
    } catch (error) {
      console.error('データ取得に失敗しました', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!currentTenantId) return initData();
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('受注データの取得に失敗しました', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (id, newStatus) => {
    try {
      const targetOrder = orders.find(o => o.id === id);
      if (!targetOrder) return;

      const updatedData = { ...(targetOrder.order_data || {}), status: newStatus };

      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      const { error } = await supabase
        .from('orders')
        .update({ order_data: updatedData })
        .eq('id', id)
        .eq('tenant_id', currentTenantId);

      if (error) throw error;

      setOrders(orders.map(o => (o.id === id ? { ...o, order_data: updatedData } : o)));
    } catch (error) {
      alert('ステータスの更新に失敗しました');
    }
  };

  const getCustomLabels = () => {
    const labels = appSettings?.statusConfig?.customLabels;
    return Array.isArray(labels) ? labels : ['制作中', '制作完了', '配達中'];
  };

  const getGoogleMapsUrl = (info) => {
    try {
      if (!info) return '#';
      const address = `${info.address1 || ''} ${info.address2 || ''}`.trim();
      if (!address) return '#';
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    } catch (e) {
      return '#';
    }
  };

  const getPhoneHref = (phone) => {
    if (!phone) return '#';
    const cleaned = String(phone).replace(/[^\d+]/g, '');
    return `tel:${cleaned}`;
  };

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const getDatesInRange = (startStr, range) => {
    const dates = [];
    const base = new Date(startStr);
    for (let i = 0; i < range; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const datesToShow = getDatesInRange(selectedDate, viewRange);

  const deliveryOrders = useMemo(() => {
    const filtered = orders.filter(order => {
      const d = order?.order_data || {};
      return d.receiveMethod === 'delivery' && datesToShow.includes(d.selectedDate);
    });

    filtered.sort((a, b) => {
      const statusA = a.order_data?.status || 'new';
      const statusB = b.order_data?.status || 'new';

      const isDoneA = statusA === '完了';
      const isDoneB = statusB === '完了';
      if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;

      const timeA = a.order_data?.selectedTime || '99:99';
      const timeB = b.order_data?.selectedTime || '99:99';
      return timeA.localeCompare(timeB);
    });

    return filtered;
  }, [orders, datesToShow]);

  const groupedOrders = datesToShow.map(dateStr => ({
    date: dateStr,
    orders: deliveryOrders.filter(o => o.order_data?.selectedDate === dateStr)
  }));

  const formatDateWithDay = (dateStr) => {
    const d = new Date(dateStr);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}月${d.getDate()}日 (${days[d.getDay()]})`;
  };

  const isToday = (dateStr) => new Date().toISOString().split('T')[0] === dateStr;

  const summary = useMemo(() => {
    const all = deliveryOrders;
    const newCount = all.filter(o => (o.order_data?.status || 'new') === 'new').length;
    const doneCount = all.filter(o => o.order_data?.status === '完了').length;
    const pickupNeedCount = all.filter(o => Number(o.order_data?.pickupFee || 0) > 0).length;
    const absenceCount = all.filter(o => o.order_data?.absenceAction === '置き配').length;
    return {
      total: all.length,
      newCount,
      doneCount,
      pickupNeedCount,
      absenceCount
    };
  }, [deliveryOrders]);

  const buildOutsourceText = (order) => {
    const d = order?.order_data || {};
    const targetInfo = d.isRecipientDifferent ? (d.recipientInfo || {}) : (d.customerInfo || {});
    return [
      '【配達委託依頼】',
      `注文ID: ${order.id}`,
      `配達日: ${d.selectedDate || '未設定'}`,
      `時間: ${d.selectedTime || '指定なし'}`,
      `お届け先: ${targetInfo?.name || '未設定'} 様`,
      `電話番号: ${targetInfo?.phone || '未設定'}`,
      `住所: 〒${targetInfo?.zip || ''} ${targetInfo?.address1 || ''} ${targetInfo?.address2 || ''}`.trim(),
      `商品: ${d.flowerType || '未設定'} (${d.flowerPurpose || '-'})`,
      d.absenceAction === '置き配' ? `置き配: ${d.absenceNote || '指定あり'}` : '不在時: 持ち戻り',
      Number(d.pickupFee || 0) > 0 ? '備考: 後日、器の回収あり' : '',
      d.note ? `備考: ${d.note}` : ''
    ].filter(Boolean).join('\n');
  };

  const handleOutsource = async (order) => {
    try {
      const text = buildOutsourceText(order);
      await navigator.clipboard.writeText(text);
      alert('業務委託用の依頼文をコピーしました。LINEやSMSにそのまま貼り付けできます。');
    } catch (e) {
      alert('依頼文のコピーに失敗しました。');
    }
  };

  const handleCopyAddress = async (targetInfo) => {
    try {
      const text = `〒${targetInfo?.zip || ''} ${targetInfo?.address1 || ''} ${targetInfo?.address2 || ''}`.trim();
      await navigator.clipboard.writeText(text);
      alert('住所をコピーしました。');
    } catch (e) {
      alert('住所のコピーに失敗しました。');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F5F6F7] font-sans overflow-hidden text-[#1f2937]">
      <div className="bg-white border-b border-[#E5E7EB] shrink-0 px-4 md:px-6 py-4 z-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1F4D3A] text-white flex items-center justify-center">
                <Truck size={20} />
              </div>
              <div>
                <h1 className="text-[20px] font-bold text-[#1F4D3A] tracking-wide">配達管理</h1>
                <p className="text-[12px] text-[#6B7280] font-medium">自社配達案件を日付ごとに確認</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl border border-[#E5E7EB]">
                {[{ val: 1, label: '1日' }, { val: 3, label: '3日間' }, { val: 7, label: '1週間' }].map(t => (
                  <button
                    key={t.val}
                    onClick={() => setViewRange(t.val)}
                    className={`px-4 py-2 rounded-lg text-[12px] font-bold transition ${
                      viewRange === t.val
                        ? 'bg-white text-[#1F4D3A] border border-[#D1D5DB]'
                        : 'text-[#6B7280] hover:text-[#374151]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-1">
                <button
                  onClick={() => changeDate(-1)}
                  className="p-2 text-[#6B7280] hover:text-[#1F4D3A] rounded-lg hover:bg-white"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-2 px-3">
                  <Calendar size={15} className="text-[#1F4D3A]" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none outline-none text-[14px] font-bold text-[#1F4D3A]"
                  />
                </div>

                <button
                  onClick={() => changeDate(1)}
                  className="p-2 text-[#6B7280] hover:text-[#1F4D3A] rounded-lg hover:bg-white"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="h-10 px-4 rounded-xl border border-[#E5E7EB] bg-white text-[12px] font-bold text-[#374151] hover:border-[#1F4D3A]"
              >
                今日へ戻る
              </button>

              <button
                onClick={fetchOrders}
                className="h-10 px-4 rounded-xl bg-[#1F4D3A] text-white text-[12px] font-bold flex items-center gap-2 hover:bg-[#183C2D]"
              >
                <RefreshCw size={14} />
                更新
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl px-4 py-3">
              <div className="text-[11px] text-[#6B7280] font-bold">対象件数</div>
              <div className="text-[24px] font-bold text-[#111827]">{summary.total}</div>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl px-4 py-3">
              <div className="text-[11px] text-[#6B7280] font-bold">未対応</div>
              <div className="text-[24px] font-bold text-[#B45309]">{summary.newCount}</div>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl px-4 py-3">
              <div className="text-[11px] text-[#6B7280] font-bold">置き配あり</div>
              <div className="text-[24px] font-bold text-[#DC2626]">{summary.absenceCount}</div>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl px-4 py-3">
              <div className="text-[11px] text-[#6B7280] font-bold">器回収あり</div>
              <div className="text-[24px] font-bold text-[#2563EB]">{summary.pickupNeedCount}</div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-x-auto overflow-y-hidden hide-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[#1F4D3A] font-bold animate-pulse">
            読み込み中...
          </div>
        ) : (
          <div className="flex gap-4 p-4 md:p-6 h-full items-start w-max">
            {groupedOrders.map(group => (
              <div
                key={group.date}
                className="w-[88vw] sm:w-[400px] shrink-0 flex flex-col bg-white rounded-2xl border border-[#E5E7EB] max-h-full overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FAFAFA] shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${isToday(group.date) ? 'bg-red-500' : 'bg-[#1F4D3A]'}`}></div>
                      <h2 className="text-[16px] font-bold text-[#1F4D3A] tracking-wide">
                        {formatDateWithDay(group.date)}
                      </h2>
                    </div>
                    <span className="text-[12px] font-bold text-[#6B7280] bg-white border border-[#E5E7EB] px-3 py-1 rounded-lg">
                      {group.orders.length} 件
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-4 hide-scrollbar bg-[#F8F9FA]">
                  {group.orders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#9CA3AF] py-10">
                      <Truck size={32} className="mb-2" />
                      <p className="text-[12px] font-bold">配達予定はありません</p>
                    </div>
                  ) : (
                    group.orders.map((order, index) => {
                      const d = order?.order_data || {};
                      const targetInfo = d.isRecipientDifferent ? (d.recipientInfo || {}) : (d.customerInfo || {});
                      const isDone = d.status === '完了';

                      return (
                        <div
                          key={order.id}
                          className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                            isDone ? 'border-[#D1D5DB] opacity-70' : 'border-[#E5E7EB]'
                          }`}
                        >
                          <div className="px-4 py-3 border-b border-[#F1F5F9] bg-white">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold ${
                                  isDone ? 'bg-[#E5E7EB] text-[#6B7280]' : 'bg-[#1F4D3A] text-white'
                                }`}>
                                  {index + 1}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                      <Truck size={12} />
                                      自社配達
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">
                                      <Clock size={12} />
                                      {d.selectedTime || '指定なし'}
                                    </span>
                                    {isDone && (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-100">
                                        <CheckCircle2 size={12} />
                                        完了
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[18px] font-bold text-[#111827] truncate">
                                    {targetInfo?.name || '未設定'} 様
                                  </div>

                                  <div className="text-[12px] text-[#6B7280] font-medium mt-1">
                                    {d.flowerType || '商品未設定'}
                                    {d.flowerPurpose ? ` / ${d.flowerPurpose}` : ''}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-[12px] font-bold text-[#374151]">
                                <Phone size={14} className="text-[#6B7280]" />
                                {targetInfo?.phone || '未設定'}
                              </div>

                              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3">
                                <div className="text-[11px] font-bold text-[#6B7280] mb-1">お届け先</div>
                                <p className="text-[13px] leading-relaxed font-semibold text-[#111827]">
                                  〒{targetInfo?.zip || ''}
                                  <br />
                                  {targetInfo?.address1 || ''} {targetInfo?.address2 || ''}
                                </p>
                              </div>
                            </div>

                            {(d.absenceAction === '置き配' || d.note || Number(d.pickupFee || 0) > 0 || d.isRecipientDifferent) && (
                              <div className="space-y-2">
                                {d.absenceAction === '置き配' && (
                                  <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5">
                                    <AlertCircle size={15} className="text-orange-600 shrink-0 mt-0.5" />
                                    <div>
                                      <div className="text-[11px] font-bold text-orange-800">置き配指定</div>
                                      <div className="text-[12px] font-bold text-orange-900 leading-relaxed">
                                        {d.absenceNote || '指定あり'}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {Number(d.pickupFee || 0) > 0 && (
                                  <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                                    <RotateCcw size={15} className="text-blue-600 shrink-0 mt-0.5" />
                                    <div>
                                      <div className="text-[11px] font-bold text-blue-800">器回収あり</div>
                                      <div className="text-[12px] font-bold text-blue-900">
                                        後日、器の回収が必要です
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {d.note && (
                                  <div className="flex items-start gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2.5">
                                    <MessageSquare size={15} className="text-yellow-700 shrink-0 mt-0.5" />
                                    <div>
                                      <div className="text-[11px] font-bold text-yellow-800">メモ</div>
                                      <div className="text-[12px] font-bold text-yellow-900 leading-relaxed whitespace-pre-wrap">
                                        {d.note}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <a
                                href={getGoogleMapsUrl(targetInfo)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-11 rounded-xl border border-[#D1D5DB] bg-white flex items-center justify-center gap-2 text-[12px] font-bold text-[#1F4D3A] hover:bg-[#F9FAFB]"
                              >
                                <MapPin size={15} />
                                地図
                              </a>

                              <a
                                href={getPhoneHref(targetInfo?.phone)}
                                className="h-11 rounded-xl border border-[#D1D5DB] bg-white flex items-center justify-center gap-2 text-[12px] font-bold text-[#374151] hover:bg-[#F9FAFB]"
                              >
                                <Phone size={15} />
                                電話
                              </a>

                              <button
                                onClick={() => handleCopyAddress(targetInfo)}
                                className="h-11 rounded-xl border border-[#D1D5DB] bg-white flex items-center justify-center gap-2 text-[12px] font-bold text-[#374151] hover:bg-[#F9FAFB]"
                              >
                                <Copy size={15} />
                                住所コピー
                              </button>

                              <button
                                onClick={() => handleOutsource(order)}
                                className="h-11 rounded-xl bg-[#111827] text-white flex items-center justify-center gap-2 text-[12px] font-bold hover:bg-[#0B1220]"
                              >
                                <Truck size={15} />
                                業務委託に依頼
                              </button>
                            </div>

                            <div className="pt-1">
                              <div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-[#6B7280]">
                                <ListChecks size={14} />
                                ステータス
                              </div>
                              <select
                                value={d.status || 'new'}
                                onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                className="w-full h-11 bg-white border border-[#D1D5DB] rounded-xl px-3 text-[13px] font-bold text-[#1F4D3A] outline-none cursor-pointer focus:border-[#1F4D3A]"
                              >
                                <option value="new">未対応 (新規)</option>
                                {getCustomLabels().map(l => (
                                  <option key={l} value={l}>
                                    {l}
                                  </option>
                                ))}
                                <option value="完了">完了</option>
                                <option value="キャンセル">キャンセル</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}