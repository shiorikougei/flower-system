'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Calendar, ChevronRight, Truck, Store, Package, AlertCircle, CheckCircle2
} from 'lucide-react';
import dynamic from 'next/dynamic';
// [2026-10] 注文詳細（大きな部品）は、開いたときに初めて読み込む
const OrderDetailModal = dynamic(() => import('@/components/OrderDetailModal'), { ssr: false });
import { getStaffTenant, getStaffSettings } from '@/utils/staffContext';
import { isOrderPaid, orderTabOf } from '@/utils/orderTabs';
import { logAction } from '@/utils/auditLog';
import HelpTooltip from '@/components/HelpTooltip';
import { ensureOperationAllowed } from '@/utils/staffRole';
import { tatefudaText } from '@/utils/tatefuda';
import { isAbandonedCardOrder, isCardPaymentPending, UNPAID_CARD_HIDE_MINUTES } from '@/utils/orderVisibility';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('未完了');
  const [productFilter, setProductFilter] = useState('all'); // ★ 商品(お花の種類)別フィルタ
  const [sortMode, setSortMode] = useState('納期順'); // ★ ソート: '納期順'(デフォルト) or '登録順'
  const [selectedOrder, setSelectedOrder] = useState(null); 
  const [appSettings, setAppSettings] = useState(null);
  const [currentTenantId, setCurrentTenantId] = useState(null);
  // [2026-10 C2] 「決済が完了していない注文」を見ているとき true
  const [showAbandoned, setShowAbandoned] = useState(false);
  // [2026-10] 注文を開くと注文詳細のページへ
  const router = useRouter();
  // [2026-10] アーカイブは新しい順に 10 件ずつ出す（「もっと見る」で増やす）
  const ARCHIVE_PAGE = 10;
  const [archiveLimit, setArchiveLimit] = useState(ARCHIVE_PAGE);
  useEffect(() => { setArchiveLimit(ARCHIVE_PAGE); }, [filterMode, showAbandoned, productFilter, sortMode]);
  // [2026-10 B6] 見積の参考写真（一覧の小さな写真）。{ [estimateId]: string[] }
  //   新しい注文は order_data.referenceImages を使う。古い注文は見積から読むだけ（注文データには保存しない）
  const [estimateImages, setEstimateImages] = useState({});
  useEffect(() => {
    const ids = [...new Set(orders
      .map(o => o.order_data || {})
      .filter(d => d.fromEstimate && d.estimateId && !(Array.isArray(d.referenceImages) && d.referenceImages.length > 0))
      .map(d => String(d.estimateId)))]
      .filter(id => !(id in estimateImages))
      .slice(0, 100);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch(`/api/staff/estimate-images?ids=${encodeURIComponent(ids.join(','))}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const next = {};
        ids.forEach(id => { next[id] = data?.images?.[id] || []; });
        setEstimateImages(prev => ({ ...prev, ...next }));
      } catch (e) {
        console.warn('[orders] 見積写真の取得に失敗:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  useEffect(() => {
    async function initData() {
      try {
        // [2026-10] ログイン・お店・設定の読み込みは左のメニューと共通（utils/staffContext.js）
        const { session, tenantId: tId } = await getStaffTenant();
        if (!session) {
          window.location.href = '/staff/login';
          return;
        }
        if (!tId) throw new Error('tenant_id が取得できませんでした');
        setCurrentTenantId(tId);

        const CACHE_KEY_ORDERS = `florix_orders_cache_${tId}`;
        const CACHE_KEY_SETTINGS = `florix_settings_cache_${tId}`;

        const cachedOrders = sessionStorage.getItem(CACHE_KEY_ORDERS);
        const cachedSettings = sessionStorage.getItem(CACHE_KEY_SETTINGS);

        if (cachedOrders) {
          try {
            setOrders(JSON.parse(cachedOrders));
            setIsLoading(false); 
          } catch (e) {}
        }
        if (cachedSettings) {
          try {
            setAppSettings(JSON.parse(cachedSettings));
          } catch (e) {}
        }

        const [ordersRes, settingsData] = await Promise.all([
          // ★ セキュリティ修正: tenant_id でフィルタ
          supabase.from('orders').select('*').eq('tenant_id', tId).order('created_at', { ascending: false }),
          getStaffSettings(tId),
        ]);
        const settingsRes = { data: settingsData ? { settings_data: settingsData } : null };

        if (ordersRes.error) throw ordersRes.error;

        if (ordersRes.data) {
          setOrders(ordersRes.data);
          sessionStorage.setItem(CACHE_KEY_ORDERS, JSON.stringify(ordersRes.data));
        }
        
        if (settingsRes.data?.settings_data) {
          setAppSettings(settingsRes.data.settings_data);
          sessionStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(settingsRes.data.settings_data));
        }
      } catch (error) {
        console.error('データ取得エラー:', error);
      } finally {
        setIsLoading(false);
      }
    }

    initData();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus, staffName) => {
    // ★ ① PIN必須なのにスタッフ未選択 → 操作拒否
    const guard = ensureOperationAllowed('ステータス更新');
    if (!guard.allowed) { alert(guard.message); return false; }
    // ★ 担当スタッフは任意化 (未選択でも更新可能)
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const currentHistory = targetOrder.order_data.statusHistory || [];

      const newHistoryEntry = {
        status: newStatus,
        staff: staffName || '-',
        date: new Date().toISOString()
      };

      const updatedData = { 
        ...targetOrder.order_data, 
        currentStatus: newStatus, 
        status: newStatus,
        statusHistory: [newHistoryEntry, ...currentHistory]
      };
      
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      const { error: updateErr } = await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);
      if (updateErr) throw updateErr;

      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      setSelectedOrder({ ...targetOrder, order_data: updatedData });
      // ★ 操作履歴記録
      logAction({ action: 'order_status_change', targetType: 'order', targetId: orderId, description: `ステータスを「${newStatus}」に変更` });
      return true;
    } catch (err) {
      alert('更新に失敗しました。');
      return false;
    }
  };

  // ★ 新規追加：入金ステータス更新処理
  //   opts.skipConfirm: 確認ダイアログをスキップ（モーダル経由で確認済みの場合）
  //   opts.alreadyUpdated: currentData が既に最新（モーダル側でDB更新済み）
  const handleUpdatePayment = async (orderId, currentData, opts = {}) => {
    if (!opts.skipConfirm) {
      if (!confirm('この注文を「入金済」として処理しますか？')) return;
    }
    try {
      let updatedData;
      if (opts.alreadyUpdated) {
        // モーダル経由：DB更新済みなのでローカル反映だけ
        updatedData = currentData;
      } else {
        const oldStatus = currentData.paymentStatus || '';
        let newStatus = '入金済';
        if (oldStatus.includes('引き取り時')) {
          newStatus = '入金済（引き取り時受領）';
        }
        updatedData = { ...currentData, paymentStatus: newStatus };
        // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
        await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);
      }

      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      setSelectedOrder(prev => ({ ...prev, order_data: updatedData }));
      if (!opts.skipConfirm) alert('入金済みに更新しました！');
      // ★ 操作履歴記録
      logAction({ action: 'order_payment_confirm', targetType: 'order', targetId: orderId, description: '入金済みに更新' });
    } catch (error) {
      console.error(error);
      alert('更新に失敗しました。');
    }
  };

  const handleArchive = async (orderId, isArchive) => {
    const newStatus = isArchive ? 'completed' : 'new';
    if (!confirm(`この注文を${isArchive ? '完了' : '未完了'}にしますか？`)) return;
    try {
      const targetOrder = orders.find(o => o.id === orderId);
      const updatedData = { ...targetOrder.order_data, status: newStatus };
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      await supabase.from('orders').update({ order_data: updatedData }).eq('id', orderId).eq('tenant_id', currentTenantId);

      const newOrders = orders.map(o => o.id === orderId ? { ...o, order_data: updatedData } : o);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));

      setSelectedOrder(null);
      // ★ 操作履歴記録
      logAction({ action: 'order_archive', targetType: 'order', targetId: orderId, description: isArchive ? '注文を完了' : '注文を未完了に戻す' });
    } catch (err) { alert('更新失敗'); }
  };

  const handleDelete = async (orderId) => {
    const inputPass = prompt('この注文を削除しますか？\n実行するには管理者パスワードを入力してください。');
    if (inputPass === null) return; 

    const systemPass = appSettings?.generalConfig?.systemPassword || '7777';

    if (inputPass !== systemPass) {
      alert('パスワードが違います。');
      return;
    }

    if (!confirm('本当に削除してもよろしいですか？\nこの操作は取り消せません。')) return;

    try {
      // ★ セキュリティ: tenant_id でも絞り込み（多層防御）
      const { error } = await supabase.from('orders').delete().eq('id', orderId).eq('tenant_id', currentTenantId);
      if (error) throw error;

      const newOrders = orders.filter(o => o.id !== orderId);
      setOrders(newOrders);
      sessionStorage.setItem(`florix_orders_cache_${currentTenantId}`, JSON.stringify(newOrders));
      setSelectedOrder(null);
      alert('注文を削除しました。');
      // ★ 操作履歴記録（重要な削除操作）
      logAction({ action: 'order_delete', targetType: 'order', targetId: orderId, description: '注文を削除' });
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました。');
    }
  };

  // ★ [業務-8] 入金済み判定ヘルパー
  //    payment_status === 'paid' or paymentStatus 文字列に「入金済」「前払い済み」を含む
  //    → utils/orderTabs.js の isOrderPaid（ホームの件数と共通）

  // ★ [業務-9] 3タブフィルタ
  //    - 未完了 : お渡し前のもの全部（入金状態問わず、まだ何かやることがある）
  //    - 未入金 : お渡し完了 かつ 未入金（入金だけ待ってる）
  //    - アーカイブ : お渡し完了 かつ (入金完了 or キャンセル)
  // [2026-10 C2] カード決済が終わらないまま 20 分たった注文は一覧に出さない（データはそのまま）。
  //   「決済が完了していない注文」を開いたときだけ、それらを表示する
  const abandonedOrders = orders.filter(o => isAbandonedCardOrder(o));
  // 分け方は utils/orderTabs.js（ホームの「未完了の注文総数」と共通）
  const baseFilteredOrders = showAbandoned ? abandonedOrders : orders.filter(order => orderTabOf(order) === filterMode);

  // ★ 一覧に存在する商品(お花の種類)の一覧（件数付き）
  const productOptions = (() => {
    const map = new Map();
    baseFilteredOrders.forEach(o => {
      const d = o?.order_data || {};
      let name = d.flowerType;
      // EC注文の場合
      if (d.orderType === 'ec' && Array.isArray(d.cartItems) && d.cartItems.length > 0) {
        name = 'ECご注文';
      }
      if (!name) name = '未設定';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]); // 件数が多い順
  })();

  const productFilteredOrders = baseFilteredOrders.filter(order => {
    if (productFilter === 'all') return true;
    const d = order?.order_data || {};
    let name = d.flowerType;
    if (d.orderType === 'ec' && Array.isArray(d.cartItems) && d.cartItems.length > 0) {
      name = 'ECご注文';
    }
    if (!name) name = '未設定';
    return name === productFilter;
  });

  // ★ ソート: 納期順（予約日+時間が近い順）or 登録順（受注作成日時降順）
  const filteredOrders = (() => {
    if (sortMode !== '納期順') {
      // 登録順 = 作成日時の降順（DB取得時のデフォルト）
      return productFilteredOrders;
    }
    // 納期順 = selectedDate + selectedTime の昇順
    // 納期未設定は最後に回す
    const parseDeliveryTs = (o) => {
      const d = o?.order_data || {};
      // ★ 実フィールド: selectedDate / selectedTime（deliveryDate/Timeは互換用フォールバック）
      const dateStr = d.selectedDate || d.deliveryDate || '';
      if (!dateStr) return Number.POSITIVE_INFINITY;
      // 時間が "HH:mm" や "13:00-14:00" の形式 → 先頭の HH:mm を採用
      let timeStr = d.selectedTime || d.deliveryTime || d.preferredTime || '';
      if (typeof timeStr === 'string') {
        const m = timeStr.match(/(\d{1,2}):(\d{2})/);
        timeStr = m ? `${m[1].padStart(2,'0')}:${m[2]}` : '09:00';
      } else {
        timeStr = '09:00';
      }
      const ts = new Date(`${dateStr}T${timeStr}:00`).getTime();
      return isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
    };
    // [2026-10] アーカイブは新しいものから（10 件ずつ出すため）
    if (filterMode === 'アーカイブ' && !showAbandoned) {
      return [...productFilteredOrders].sort((a, b) => parseDeliveryTs(b) - parseDeliveryTs(a));
    }
    return [...productFilteredOrders].sort((a, b) => parseDeliveryTs(a) - parseDeliveryTs(b));
  })();
  const isArchivePaged = filterMode === 'アーカイブ' && !showAbandoned;
  const shownOrders = isArchivePaged ? filteredOrders.slice(0, archiveLimit) : filteredOrders;

  const safeFormatDate = (dateString, withTime = false) => {
    try {
      if (!dateString) return '日時不明';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '日時不明';
      return withTime ? d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ja-JP');
    } catch (e) {
      return '日時不明';
    }
  };

  const getReceiveMethodBadge = (method) => {
    switch (method) {
      case 'pickup': return <span className="inline-flex items-center gap-1.5 h-8 bg-[#EEF2EF] text-[#2D4B3E] px-3 rounded-lg text-[13px] font-bold"><Store size={15}/> 店頭受取</span>;
      case 'delivery': return <span className="inline-flex items-center gap-1.5 h-8 bg-[#E6F0F4] text-[#1D5670] px-3 rounded-lg text-[13px] font-bold"><Truck size={15}/> 自社配達</span>;
      case 'sagawa': return <span className="inline-flex items-center gap-1.5 h-8 bg-[#F1EEE7] text-[#5A4A2E] px-3 rounded-lg text-[13px] font-bold"><Package size={15}/> 業者配送</span>;
      default: return <span className="inline-flex items-center gap-1.5 h-8 bg-[#F1EEE7] text-[#3B4640] px-3 rounded-lg text-[13px] font-bold">未定</span>;
    }
  };

  const getTotals = (orderData) => {
    if (!orderData || typeof orderData !== 'object') return { item: 0, fee: 0, pickup: 0, ecBoxFee: 0, subTotal: 0, tax: 0, total: 0 };
    const item = Number(orderData.itemPrice) || 0;
    const fee = Number(orderData.calculatedFee) || 0;
    const pickup = Number(orderData.pickupFee) || 0;
    // ★ [BUGFIX] EC箱代 (ecBoxFee) が抜けていたため追加
    const ecBoxFee = Number(orderData.ecBoxFee) || 0;
    const subTotal = item + fee + pickup + ecBoxFee;
    const tax = Math.floor(subTotal * 0.1);
    return { item, fee, pickup, ecBoxFee, subTotal, tax, total: subTotal + tax };
  };

  return (
    <div className="min-h-screen bg-[#F6F4EF] pb-32">
      <div className="bg-[#F6F4EF]/95 backdrop-blur border-b border-[#E0DCD3] sticky top-0 z-30 px-4 md:px-10 pt-5">
        <h1 className="text-[24px] md:text-[28px] font-bold tracking-[0.02em] text-[#1F2A24] flex items-center gap-2">受注一覧 <HelpTooltip articleId="order_status"/> <HelpTooltip articleId="order_payment" size={14}/></h1>

        {/* 表示の切り替え（タイトルのすぐ下に左寄せ） */}
        <div role="tablist" className="mt-2 flex gap-1 border-b border-[#E0DCD3]">
            <button
              role="tab" aria-selected={filterMode === '未完了' && !showAbandoned}
              onClick={() => { setFilterMode('未完了'); setShowAbandoned(false); }}
              className={`h-11 px-4 -mb-px border-b-[3px] text-[15px] transition-all ${filterMode === '未完了' && !showAbandoned ? 'border-[#2D4B3E] text-[#2D4B3E] font-bold' : 'border-transparent text-[#5C6660] hover:text-[#1F2A24]'}`}
            >
              未完了
            </button>
            <button
              role="tab" aria-selected={filterMode === '未入金' && !showAbandoned}
              onClick={() => { setFilterMode('未入金'); setShowAbandoned(false); }}
              className={`h-11 px-4 -mb-px border-b-[3px] text-[15px] transition-all ${filterMode === '未入金' && !showAbandoned ? 'border-[#A2471F] text-[#A2471F] font-bold' : 'border-transparent text-[#5C6660] hover:text-[#1F2A24]'}`}
            >
              未入金
            </button>
            <button
              role="tab" aria-selected={filterMode === 'アーカイブ' && !showAbandoned}
              onClick={() => { setFilterMode('アーカイブ'); setShowAbandoned(false); }}
              className={`h-11 px-4 -mb-px border-b-[3px] text-[15px] transition-all ${filterMode === 'アーカイブ' && !showAbandoned ? 'border-[#2D4B3E] text-[#2D4B3E] font-bold' : 'border-transparent text-[#5C6660] hover:text-[#1F2A24]'}`}
            >
              アーカイブ
            </button>
            {/* [2026-10 C2] 決済が完了していない注文（ふだんの一覧から外したもの）。あるときだけ件数付きで出す */}
            {(abandonedOrders.length > 0 || showAbandoned) && (
              <button
                role="tab" aria-selected={showAbandoned}
                onClick={() => { setShowAbandoned(true); setProductFilter('all'); }}
                className={`h-11 px-4 -mb-px border-b-[3px] text-[15px] transition-all inline-flex items-center gap-1.5 ${showAbandoned ? 'border-[#A2471F] text-[#A2471F] font-bold' : 'border-transparent text-[#5C6660] hover:text-[#1F2A24]'}`}
              >
                決済未完了
                {abandonedOrders.length > 0 && (
                  <span className="ui-num min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#B9562F] text-white text-[12px] font-bold inline-flex items-center justify-center">{abandonedOrders.length}</span>
                )}
              </button>
            )}
        </div>

        {/* 並び順と商品の絞り込みを 1 行に */}
        <div className="py-3 flex items-center gap-x-5 gap-y-2 flex-wrap">
          {/* ★ ソート切替（納期順 / 登録順） */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-[#5C6660]">並び順</span>
            <div className="flex p-0.5 rounded-lg bg-[#E9E5DC]">
            <button
              onClick={() => setSortMode('納期順')}
              aria-pressed={sortMode === '納期順'}
              className={`h-8 px-3 rounded-md text-[13px] transition-all ${sortMode === '納期順' ? 'bg-white text-[#1F2A24] font-bold shadow-sm' : 'text-[#5C6660] hover:text-[#1F2A24]'}`}
            >
              納期順（近い順）
            </button>
            <button
              onClick={() => setSortMode('登録順')}
              aria-pressed={sortMode === '登録順'}
              className={`h-8 px-3 rounded-md text-[13px] transition-all ${sortMode === '登録順' ? 'bg-white text-[#1F2A24] font-bold shadow-sm' : 'text-[#5C6660] hover:text-[#1F2A24]'}`}
            >
              登録順（新しい順）
            </button>
            </div>
          </div>

          {/* ★ 商品(お花の種類)別フィルタ */}
          {productOptions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold text-[#5C6660] mr-0.5">商品</span>
              <button
                onClick={() => setProductFilter('all')}
                aria-pressed={productFilter === 'all'}
                className={`h-8 px-3 rounded-full text-[13px] border transition-all ${productFilter === 'all' ? 'bg-[#2D4B3E] text-white border-[#2D4B3E] font-bold' : 'bg-white text-[#3B4640] border-[#D5D0C6] hover:border-[#2D4B3E]'}`}
              >
                すべて <span className="ui-num ml-0.5 opacity-80">{baseFilteredOrders.length}</span>
              </button>
              {productOptions.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setProductFilter(name)}
                  aria-pressed={productFilter === name}
                  className={`h-8 px-3 rounded-full text-[13px] border transition-all ${productFilter === name ? 'bg-[#2D4B3E] text-white border-[#2D4B3E] font-bold' : 'bg-white text-[#3B4640] border-[#D5D0C6] hover:border-[#2D4B3E]'}`}
                >
                  {name} <span className="ui-num ml-0.5 opacity-80">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <main className="w-full px-4 md:px-10 py-6 space-y-4">
        {/* [2026-10 C2] 決済が完了していない注文を見ているときの説明 */}
        {showAbandoned && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-sky-900 leading-relaxed min-w-0 flex-1">
              <strong>決済が完了していない注文</strong>（カード払いを選んでから{UNPAID_CARD_HIDE_MINUTES}分たっても決済が終わっていないもの）を表示しています。ふだんの受注一覧・カレンダー・印刷には出ません（データは残っています）。<br/>
              あとから決済が完了すると、自動で「入金済」になって一覧に戻ります。
            </p>
            <button type="button" onClick={() => setShowAbandoned(false)} className="h-11 px-4 rounded-xl bg-white border border-sky-300 text-sky-900 text-[14px] font-bold">受注一覧に戻る</button>
          </div>
        )}
        {isLoading ? (
          <div className="text-center py-20 text-[16px] text-[#2D4B3E] font-bold animate-pulse">読み込み中...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-[#D5D0C6] text-[16px] text-[#5C6660] font-bold">
            表示する注文データがありません。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {shownOrders.map(order => {
              const d = order?.order_data || {};
              // ★ Stripe決済反映: DB の payment_status='paid' (Webhookで自動更新) を優先
              const isPaidByCard = order?.payment_status === 'paid';
              const isUnpaid = !isPaidByCard && (!d.paymentStatus || d.paymentStatus.includes('未') || d.paymentStatus === '');
              const displayStatus = (isPaidByCard && (!d.paymentStatus || d.paymentStatus.includes('未')))
                ? '入金済（クレジットカード）'
                : (d.paymentStatus || '未設定');

              // [2026-10 画面リニューアル] 並べ方と色だけを整理（出している情報は前と同じ）
              const methodLabel = { pickup: '店頭受取', delivery: '自社配達', sagawa: '業者配送' }[d.receiveMethod] || '未定';
              const MethodIcon = { pickup: Store, delivery: Truck, sagawa: Package }[d.receiveMethod] || null;
              const dateParts = (d.selectedDate || '').split('-');
              const hasDate = dateParts.length === 3;
              const productText = d.orderType === 'ec' && Array.isArray(d.cartItems) && d.cartItems.length > 0
                ? `${d.cartItems[0].name}${d.cartItems.length > 1 ? ` ほか${d.cartItems.length - 1}点` : ''}`
                : (d.flowerType || '商品未設定');
              const orderTypeText = d.orderType === 'ec' ? 'EC注文'
                : d.fromEstimate ? '見積から'
                : d.isStaffEntered ? `代理入力${d.staffName ? `（${d.staffName}）` : ''}`
                : 'カスタム';
              // ご注文の内容（用途・カラー・イメージ・立札/カード・お届け先）は、色札ではなく 1 行の文字で
              const details = [];
              const purpose = d.flowerPurpose || d.otherPurpose;
              const vibe = d.flowerVibe || d.otherVibe;
              if (purpose) details.push(['用途', purpose]);
              if (d.flowerColor) details.push(['カラー', d.flowerColor]);
              if (vibe) details.push(['イメージ', vibe]);
              // [2026-10 B2] 自由入力（会社名・送り主・ご要望）と古い形の両方に対応
              const tateText = tatefudaText(d);
              if (d.cardType === '立札' && tateText) details.push(['立札', tateText]);
              else if (d.cardType === 'メッセージカード' && d.cardMessage) details.push(['カード', d.cardMessage.slice(0, 30) + (d.cardMessage.length > 30 ? '…' : '')]);
              if (d.isRecipientDifferent && d.recipientInfo?.name) details.push(['お届け先', `${d.recipientInfo.name} 様`]);
              // [2026-10 B6] 見積の参考写真（小さく 1 枚。複数あるときは枚数）
              const refImgs = d.fromEstimate
                ? ((Array.isArray(d.referenceImages) && d.referenceImages.length > 0) ? d.referenceImages : (estimateImages[String(d.estimateId)] || []))
                : [];
              const statusText = d.status === 'new' ? '未対応' : (d.status || '未対応');
              const pill = 'inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[13px] font-bold whitespace-nowrap';

              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/staff/orders/${order.id}`)}
                  className="bg-white rounded-[14px] border border-[#E6E2DA] hover:border-[#2D4B3E]/50 hover:shadow-sm cursor-pointer transition-all group grid grid-cols-[72px_minmax(0,1fr)] md:grid-cols-[96px_minmax(0,1fr)_auto] gap-x-4 md:gap-x-6 gap-y-3 p-4 md:p-5"
                >
                  {/* 納品日 */}
                  <div className="row-span-2 md:row-span-1 flex flex-col items-center justify-center rounded-xl bg-[#F6F4EF] py-2 text-center self-start">
                    <span className="text-[12px] font-bold text-[#5C6660]">納品日</span>
                    {hasDate ? (
                      <>
                        <span className="ui-num text-[24px] md:text-[28px] font-bold leading-tight text-[#1F2A24]">{Number(dateParts[1])}/{Number(dateParts[2])}</span>
                        <span className="ui-num text-[12px] text-[#5C6660]">{dateParts[0]}</span>
                      </>
                    ) : (
                      <span className="text-[14px] font-bold text-[#A2471F] py-1">未指定</span>
                    )}
                  </div>

                  {/* お名前・商品・受取方法・内容 */}
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-baseline flex-wrap gap-x-2">
                      <span className="text-[18px] md:text-[19px] font-bold text-[#1F2A24] group-hover:text-[#2D4B3E]">{d.customerInfo?.name || 'お名前未設定'} 様</span>
                      <span className="text-[15px] text-[#3B4640]">{productText}</span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[14px] text-[#3B4640]">
                      <span className="inline-flex items-center gap-1 font-bold text-[#2D4B3E]">
                        {MethodIcon && <MethodIcon size={15} aria-hidden="true" />}{methodLabel}
                      </span>
                      {d.selectedTime && <span className="inline-flex items-center gap-1"><Calendar size={14} aria-hidden="true" />{d.selectedTime}</span>}
                      {d.receiveMethod === 'sagawa' && d.shippingDate && (
                        <span>発送日: {d.shippingDate.split('-')[1]}/{d.shippingDate.split('-')[2]}</span>
                      )}
                      <span className="text-[#5C6660]">{orderTypeText}</span>
                      <span className="text-[#5C6660]">{safeFormatDate(order.created_at)} 受付</span>
                    </div>
                    {details.length > 0 && (
                      <p className="text-[14px] text-[#3B4640] leading-relaxed line-clamp-2">
                        {details.map(([label, value], i) => (
                          <span key={i}>{i > 0 && <span className="text-[#C9C3B8] mx-1.5" aria-hidden="true">|</span>}<span className="text-[#5C6660]">{label}:</span> {value}</span>
                        ))}
                      </p>
                    )}
                    {refImgs.length > 0 && (
                      <div className="flex items-center gap-2">
                        <img src={refImgs[0]} alt="見積の参考写真" loading="lazy" className="w-12 h-12 rounded-lg object-cover border border-[#E6E2DA] bg-[#F6F4EF]"/>
                        <span className="text-[13px] text-[#3B4640]">見積の参考写真{refImgs.length > 1 ? `（ほか${refImgs.length - 1}枚）` : ''}</span>
                      </div>
                    )}
                    {/* 社内メモ（メモがあるときだけ） */}
                    {d.note && (
                      <div className="flex gap-2 bg-[#FFF8DC] rounded-lg px-3 py-1.5">
                        <span className="text-[13px] font-bold text-[#7A5A00] shrink-0">社内メモ</span>
                        <p className="text-[13px] text-[#4A3B00] whitespace-pre-wrap leading-snug line-clamp-2 min-w-0">{d.note}</p>
                      </div>
                    )}
                  </div>

                  {/* 金額と状態 */}
                  <div className="col-start-2 md:col-start-3 flex md:flex-col items-center md:items-end justify-between gap-2 md:gap-1.5 md:min-w-[150px] md:border-l md:border-[#E6E2DA] md:pl-5 pt-2 md:pt-0 border-t md:border-t-0 border-[#E6E2DA]">
                    <div className="md:text-right">
                      <p className="text-[12px] text-[#5C6660]">合計金額(税込)</p>
                      <p className="ui-num text-[22px] md:text-[24px] font-bold text-[#1F2A24] leading-tight">¥{getTotals(d).total.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap md:flex-col items-end gap-1.5">
                      <span className={`${pill} bg-[#F1EEE7] text-[#3B4640]`}>{statusText}</span>
                      {/* ★ 入金ステータス（クレカ決済はDBカラムを優先） */}
                      {isUnpaid ? (
                        <span className={`${pill} bg-[#FBEBE3] text-[#A2471F]`}><AlertCircle size={13} aria-hidden="true"/>{displayStatus}</span>
                      ) : (
                        <span className={`${pill} bg-[#E4F1EA] text-[#1E6B47]`}><CheckCircle2 size={13} aria-hidden="true"/>{displayStatus}</span>
                      )}
                      {/* [2026-10 C5] 店頭払いで電話確認が必要な注文 */}
                      {d.phoneConfirmation?.status === 'pending' && <span className={`${pill} bg-[#FBEBE3] text-[#A2471F]`}>電話確認待ち</span>}
                      {d.phoneConfirmation?.status === 'card_link_sent' && <span className={`${pill} bg-[#F1EEE7] text-[#3B4640]`}>カード払いのご案内済み</span>}
                      {/* [2026-10 C2] カード決済がまだ終わっていない注文 */}
                      {(isCardPaymentPending(order) || isAbandonedCardOrder(order)) && (
                        <span className={`${pill} bg-[#F1EEE7] text-[#3B4640]`}>{isAbandonedCardOrder(order) ? '決済未完了' : 'カード決済待ち'}</span>
                      )}
                      <span className="hidden md:inline-flex items-center gap-0.5 text-[13px] font-bold text-[#2D4B3E] mt-1 group-hover:underline">詳細を見る <ChevronRight size={14} aria-hidden="true"/></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* [2026-10] アーカイブの続き */}
        {!isLoading && isArchivePaged && filteredOrders.length > shownOrders.length && (
          <div className="pt-2 text-center">
            <button type="button" onClick={() => setArchiveLimit(n => n + ARCHIVE_PAGE)}
              className="h-11 px-6 rounded-xl bg-white border border-[#D5D0C6] text-[14px] font-bold text-[#2D4B3E] hover:border-[#2D4B3E]">
              もっと見る（残り {filteredOrders.length - shownOrders.length} 件）
            </button>
          </div>
        )}
      </main>

      {/* ★ onUpdatePayment を新たに追加！ */}
      {selectedOrder && <OrderDetailModal
        order={selectedOrder}  
        appSettings={appSettings} 
        onClose={() => setSelectedOrder(null)} 
        onUpdateStatus={handleUpdateStatus} 
        onUpdatePayment={handleUpdatePayment} 
        onArchive={handleArchive} 
        onDelete={handleDelete}
      />}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}