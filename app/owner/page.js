'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import {
  Building2, Mail, ArrowUpCircle, Bot, Lock, Unlock,
  CheckCircle, XCircle, RefreshCw, Save, Sparkles, Store,
  MessageSquare, Trash2, AlertTriangle, Wand2, X, FileText, ToggleLeft, ToggleRight
} from 'lucide-react';
import { FEATURE_GROUPS, ALL_FEATURE_KEYS } from '@/utils/features';

const DEFAULT_AI_PROMPT = '以下のテキストからお花の「価格」「用途」「カラー」「イメージ」をJSON形式で抽出してください。価格はカンマなしの数値で出力してください。';
const DEFAULT_CAPTION_PROMPT = `あなたは {appName} の SNS担当です。お花の注文を受けて完成した作品をInstagramに投稿します。以下の条件でキャプションを作成してください。

【条件】
- 用途: {purpose}
- カラー: {color}
- 雰囲気: {vibe}
- 金額表示: {price}
- 店舗名: {appName}

【トーン】
- 温かみのある柔らかい文体、絵文字を散りばめる🌸💐✨
- 改行多めで読みやすく
- 末尾にハッシュタグ5〜8個`;

export default function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState('tenants');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // --- SaaS運営データ ---
  const [tenants, setTenants] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInvitePlan, setNewInvitePlan] = useState('10000');
  
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [clientRequests, setClientRequests] = useState([]); 

  // オーナー用パスワード
  const [isAuth, setIsAuth] = useState(false);
  const [password, setPassword] = useState('');

  // ★ 料金保存中のローディング状態を管理
  const [savingPriceId, setSavingPriceId] = useState(null);

  // ★ データベースから「実在する全てのテナント」を取得
  const loadOwnerData = async () => {
    setIsLoading(true);
    try {
      const { data: ownerMeta } = await supabase.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
      if (ownerMeta?.settings_data) {
        setInvitations(ownerMeta.settings_data.invitations || []);
        setUpgradeRequests(ownerMeta.settings_data.upgradeRequests || []);
        setClientRequests(ownerMeta.settings_data.clientRequests || []);
      }

      const { data: allRows, error: scanError } = await supabase.from('app_settings').select('*');
      if (scanError) throw scanError;

      const shopTenants = allRows
        .filter(row => !['nocolde_owner', 'gallery', 'default'].includes(row.id) && !row.id.endsWith('_gallery'))
        .map(row => {
          const s = row.settings_data || {};
          const config = s.generalConfig || {};
          return {
            id: row.id,
            name: config.appName || '未設定のショップ',
            status: s.status || 'active',
            price: s.monthlyPrice || 10000,
            features: s.features || { b2b: false, deliveryOutsource: false },
            aiPrompt: s.aiPrompt || DEFAULT_AI_PROMPT,
            captionPrompt: s.captionPrompt || DEFAULT_CAPTION_PROMPT,
            showPriceInCaption: typeof s.showPriceInCaption === 'boolean' ? s.showPriceInCaption : true,
            updatedAt: row.updated_at
          };
        });

      setTenants(shopTenants);
    } catch (err) {
      console.error('データ読み込みエラー:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuth) loadOwnerData();
  }, [isAuth]);

  const handleLogin = () => {
    if (password === 'nocolde2026') setIsAuth(true);
    else alert('アクセス権限がありません。');
  };

  const saveOwnerMetaData = async (updatedInvitations = invitations, updatedUpgrades = upgradeRequests, updatedFeedbacks = clientRequests) => {
    setIsSaving(true);
    try {
      await supabase.from('app_settings').upsert({ 
        id: 'nocolde_owner', 
        settings_data: { 
          invitations: updatedInvitations,
          upgradeRequests: updatedUpgrades,
          clientRequests: updatedFeedbacks
        } 
      });
      setInvitations(updatedInvitations);
      setUpgradeRequests(updatedUpgrades);
      setClientRequests(updatedFeedbacks);
    } catch (error) {
      alert('メタデータの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFeature = async (tenantId, featureKey) => {
    setTenants(prev => prev.map(t => {
      if (t.id === tenantId) {
        const currentFeatures = t.features || { b2b: false, deliveryOutsource: false };
        return { ...t, features: { ...currentFeatures, [featureKey]: !currentFeatures[featureKey] } };
      }
      return t;
    }));

    setIsSaving(true);
    try {
      const { data: current } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      const currentSettings = current?.settings_data || {};
      const currentFeatures = currentSettings.features || { b2b: false, deliveryOutsource: false };
      
      const nextFeatures = { ...currentFeatures, [featureKey]: !currentFeatures[featureKey] };
      const nextData = { ...currentSettings, features: nextFeatures };
      
      await supabase.from('app_settings').update({ settings_data: nextData }).eq('id', tenantId);
    } catch (e) { 
      alert('通信エラーで保存できませんでした。'); 
      loadOwnerData();
    } finally { 
      setIsSaving(false); 
    }
  };

  const toggleLock = async (tenantId) => {
    const target = tenants.find(t => t.id === tenantId);
    const newStatus = target.status === 'active' ? 'locked' : 'active';
    const confirmMsg = newStatus === 'locked' 
      ? `【警告】この店舗のシステム利用を強制停止（ロック）しますか？\n未入金などの場合に実行してください。` 
      : `この店舗のロックを解除し、利用を再開させますか？`;
      
    if (!confirm(confirmMsg)) return;

    setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, status: newStatus } : t));
    
    setIsSaving(true);
    try {
      const { data: current } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      const nextData = { ...(current?.settings_data || {}), status: newStatus };
      await supabase.from('app_settings').update({ settings_data: nextData }).eq('id', tenantId);
    } catch (e) {
      alert('更新に失敗しました。');
      loadOwnerData();
    } finally {
      setIsSaving(false);
    }
  };

  const handlePriceChange = (tenantId, newPrice) => {
    setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, price: newPrice } : t));
  };

  const handleSavePrice = async (tenantId, newPrice) => {
    setSavingPriceId(tenantId);
    try {
      const { data: current } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
      const nextData = { ...(current?.settings_data || {}), monthlyPrice: Number(newPrice) };
      await supabase.from('app_settings').update({ settings_data: nextData }).eq('id', tenantId);
      alert('月額料金を更新しました！');
    } catch (e) {
      console.error(e);
      alert('料金の更新に失敗しました。');
    } finally {
      setSavingPriceId(null);
    }
  };

  const updateTenantPrompt = (tenantId, newPrompt) => {
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, aiPrompt: newPrompt } : t));
  };

  // ★ キャプション生成プロンプト編集
  const updateTenantCaptionPrompt = (tenantId, newPrompt) => {
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, captionPrompt: newPrompt } : t));
  };

  // ★ 金額表示トグル
  const updateTenantShowPrice = (tenantId, show) => {
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, showPriceInCaption: show } : t));
  };

  // ★ サンプル取り込みモーダル用
  const [sampleModalTenant, setSampleModalTenant] = useState(null);
  const [sampleText, setSampleText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // ★ 機能設定モーダル
  const [featureModalTenant, setFeatureModalTenant] = useState(null);

  // ★ 全店出勤状況
  const [attendanceOverview, setAttendanceOverview] = useState(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

  const loadAttendanceOverview = async () => {
    setIsLoadingAttendance(true);
    try {
      const res = await fetch('/api/owner/attendance-overview');
      const data = await res.json();
      setAttendanceOverview(data);
    } catch (e) { console.warn(e); }
    finally { setIsLoadingAttendance(false); }
  };

  useEffect(() => {
    if (activeTab === 'attendance' && isAuth) loadAttendanceOverview();
    // eslint-disable-next-line
  }, [activeTab, isAuth]);

  // ★ AI利用状況
  const [usageList, setUsageList] = useState([]);
  const [usageMonth, setUsageMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [aiPricing, setAiPricing] = useState({ freeQuotaPerMonth: 100, pricePerExtraJpy: 5 });
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  const loadUsage = async (monthKey = usageMonth) => {
    setIsLoadingUsage(true);
    try {
      // pricing
      const { data: ownerRow } = await supabase.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
      const cfg = ownerRow?.settings_data?.aiPricingConfig;
      const pricing = {
        freeQuotaPerMonth: Number(cfg?.freeQuotaPerMonth ?? 100),
        pricePerExtraJpy: Number(cfg?.pricePerExtraJpy ?? 5),
      };
      setAiPricing(pricing);

      // 全テナント
      const { data: rows } = await supabase.from('app_settings').select('id, settings_data').neq('id', 'nocolde_owner');
      const list = (rows || [])
        .filter(r => !['gallery', 'default'].includes(r.id) && !r.id.endsWith('_gallery'))
        .map(r => {
          const s = r.settings_data || {};
          const m = s.aiUsage?.[monthKey] || { caption: 0, prompt: 0, total: 0 };
          const total = Number(m.total || 0);
          const overage = Math.max(0, total - pricing.freeQuotaPerMonth);
          return {
            tenantId: r.id,
            tenantName: s.generalConfig?.appName || r.id,
            caption: Number(m.caption || 0),
            prompt: Number(m.prompt || 0),
            total,
            overage,
            overageJpy: overage * pricing.pricePerExtraJpy,
          };
        });
      setUsageList(list);
    } catch (e) {
      console.error('loadUsage', e);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'usage' && isAuth) loadUsage(usageMonth);
    // eslint-disable-next-line
  }, [activeTab, usageMonth, isAuth]);

  // ★ AI利用超過分の請求書PDFを発行
  const printInvoice = (usage) => {
    const issueDate = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    const [yy, mm] = usage.monthKey ? usage.monthKey.split('-') : [new Date().getFullYear(), String(new Date().getMonth()+1).padStart(2,'0')];
    const periodLabel = `${yy}年${parseInt(mm)}月分`;
    const taxExcluded = Math.floor(usage.overageJpy / 1.1);
    const tax = usage.overageJpy - taxExcluded;
    const ownerName = 'NocoLde';
    const ownerInvoice = 'T0000000000000';
    const dueDate = (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      d.setDate(0); // 翌月末
      return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    })();

    const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"/><title>請求書_${usage.tenantId}_${usage.monthKey}</title>
      <style>
        @page { size: A4 portrait; margin: 20mm; }
        * { box-sizing: border-box; }
        body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; color: #222; margin: 0; padding: 0; }
        .container { max-width: 170mm; margin: 0 auto; }
        .title { text-align: center; font-size: 26pt; font-weight: 900; letter-spacing: 0.5em; padding: 6mm 0; border-bottom: 2pt double #222; margin-bottom: 8mm; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 8mm; font-size: 10pt; }
        .target { font-size: 14pt; font-weight: bold; padding: 4mm 0; border-bottom: 0.5pt solid #999; margin-bottom: 6mm; }
        .amount-block { background: #fafafa; border: 1.5pt solid #222; padding: 8mm; margin: 8mm 0; text-align: center; }
        .amount-label { font-size: 10pt; color: #666; margin-bottom: 2mm; }
        .amount-value { font-size: 28pt; font-weight: 900; color: #117768; letter-spacing: 0.1em; }
        .amount-tax { font-size: 9pt; color: #666; margin-top: 2mm; }
        .description { font-size: 11pt; padding: 4mm 0; margin-bottom: 4mm; }
        table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 10pt; }
        th, td { padding: 2.5mm 3mm; border-bottom: 0.5pt solid #ddd; }
        th { background: #f4f4f4; font-weight: bold; }
        .due { background: #fff7ed; border: 1pt solid #f97316; padding: 4mm; margin: 6mm 0; font-size: 11pt; color: #c2410c; text-align: center; font-weight: bold; }
        .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 12mm; padding-top: 6mm; border-top: 0.5pt solid #999; }
        .issuer-info { font-size: 10pt; line-height: 1.7; }
        .issuer-name { font-size: 14pt; font-weight: 900; margin-bottom: 2mm; }
      </style></head><body>
      <div class="container">
        <div class="title">請 求 書</div>
        <div class="meta">
          <div>No. INV-${usage.tenantId.slice(0,6)}-${usage.monthKey.replace('-','')}</div>
          <div>発行日: ${issueDate}</div>
        </div>
        <div class="target">${usage.tenantName} 御中</div>
        <div class="amount-block">
          <div class="amount-label">ご請求金額（税込）</div>
          <div class="amount-value">¥ ${usage.overageJpy.toLocaleString()} -</div>
          <div class="amount-tax">（内訳: 本体 ¥${taxExcluded.toLocaleString()} / 消費税 ¥${tax.toLocaleString()}）</div>
        </div>
        <div class="description">下記の通りご請求申し上げます。</div>
        <table>
          <thead><tr><th>項目</th><th style="width:30mm; text-align:center;">数量</th><th style="width:30mm; text-align:right;">単価</th><th style="width:30mm; text-align:right;">金額(税抜)</th></tr></thead>
          <tbody>
            <tr>
              <td>AI生成機能 ${periodLabel}<br/><span style="font-size:9pt; color:#666;">無料枠 ${aiPricing.freeQuotaPerMonth}回 / 利用 ${usage.total}回 / 超過 ${usage.overage}回</span></td>
              <td style="text-align:center;">${usage.overage}回</td>
              <td style="text-align:right;">¥${aiPricing.pricePerExtraJpy.toLocaleString()}</td>
              <td style="text-align:right;">¥${Math.floor(usage.overageJpy / 1.1).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        <div class="due">お支払い期日: ${dueDate}</div>
        <div class="footer">
          <div class="issuer-info">
            <div class="issuer-name">${ownerName}</div>
            <div>登録番号: ${ownerInvoice}</div>
            <div style="margin-top:3mm; color:#666;">お支払いに関するお問い合わせ:</div>
            <div>support@nocolde.com</div>
          </div>
        </div>
      </div>
      <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  };

  const saveAiPricing = async () => {
    try {
      const { data: ownerRow } = await supabase.from('app_settings').select('settings_data').eq('id', 'nocolde_owner').single();
      const nextData = { ...(ownerRow?.settings_data || {}), aiPricingConfig: aiPricing };
      await supabase.from('app_settings').upsert({ id: 'nocolde_owner', settings_data: nextData });
      alert('料金プランを保存しました');
      loadUsage(usageMonth);
    } catch (e) {
      alert('保存失敗');
    }
  };

  const handleGenerateFromSamples = async () => {
    if (!sampleModalTenant) return;
    const samples = sampleText
      .split(/\n\s*---+\s*\n|\n\n\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
    if (samples.length === 0) {
      alert('過去キャプションを1件以上貼り付けてください\n（複数件は空行3つ or "---" で区切ってください）');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/owner/generate-prompt-from-samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ samples, tenantName: sampleModalTenant.name, tenantId: sampleModalTenant.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API エラー');
      updateTenantCaptionPrompt(sampleModalTenant.id, data.prompt);
      setSampleModalTenant(null);
      setSampleText('');
      alert('プロンプトを自動生成しました ✨\n忘れずに「SAVE ALL PROMPTS」で保存してください！');
    } catch (err) {
      alert(`生成に失敗しました: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAllPrompts = async () => {
    setIsSaving(true);
    try {
      for (const t of tenants) {
        const { data: current } = await supabase.from('app_settings').select('settings_data').eq('id', t.id).single();
        const nextData = {
          ...(current?.settings_data || {}),
          aiPrompt: t.aiPrompt,
          captionPrompt: t.captionPrompt,
          showPriceInCaption: t.showPriceInCaption,
        };
        await supabase.from('app_settings').update({ settings_data: nextData }).eq('id', t.id);
      }
      alert('すべてのプロンプトを保存しました。');
    } catch(e) {
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTenant = async (tenantId) => {
    const target = tenants.find(t => t.id === tenantId);
    const confirmMsg = `【超危険】テナント「${target.name}」を完全に削除しますか？\nこの操作は取り消せません。\n※現在Supabase上にある関連設定データ等も削除されます。`;
    if (!confirm(confirmMsg)) return;

    setIsSaving(true);
    try {
      await supabase.from('app_settings').delete().eq('id', tenantId);
      setTenants(tenants.filter(t => t.id !== tenantId));
      alert(`${target.name} を削除しました。`);
    } catch (e) {
      alert('削除中にエラーが発生しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = () => {
    if (!newInviteEmail) return;
    const token = Math.random().toString(36).substring(2, 15);
    const setupUrl = `${window.location.origin}/setup?token=${token}`;
    
    const newInvite = {
      id: Date.now(),
      email: newInviteEmail,
      price: newInvitePlan,
      token: token,
      url: setupUrl,
      date: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
    
    const updated = [newInvite, ...invitations];
    saveOwnerMetaData(updated, upgradeRequests, clientRequests);
    setNewInviteEmail('');
    
    navigator.clipboard.writeText(`システムのご案内です。以下のURLから初期設定を行ってください。\n${setupUrl}`);
    alert('招待URLを発行し、クリップボードにコピーしました！');
  };

  // ★ 追加：招待履歴の削除処理
  const handleDeleteInvite = (inviteId) => {
    if (!confirm('この招待履歴を削除しますか？')) return;
    const updated = invitations.filter(inv => inv.id !== inviteId);
    saveOwnerMetaData(updated, upgradeRequests, clientRequests);
  };

  const handleApproveUpgrade = (reqId) => {
    if(!confirm('この機能のアップグレードを承認し、店舗に機能を解放しますか？')) return;
    const req = upgradeRequests.find(r => r.id === reqId);
    
    toggleFeature(req.tenantId, req.featureKey);
    const updatedReqs = upgradeRequests.map(r => r.id === reqId ? { ...r, status: 'approved' } : r);
    saveOwnerMetaData(invitations, updatedReqs, clientRequests);
    alert('機能を解放しました！');
  };

  const handleRejectUpgrade = (reqId) => {
    if(!confirm('この依頼を却下しますか？')) return;
    const updatedReqs = upgradeRequests.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r);
    saveOwnerMetaData(invitations, updatedReqs, clientRequests);
  };

  const handleCompleteFeedback = (fbId) => {
    const updatedFbs = clientRequests.map(fb => fb.id === fbId ? { ...fb, status: 'completed' } : fb);
    saveOwnerMetaData(invitations, upgradeRequests, updatedFbs);
  };

  const handleClearAllOrders = async () => {
    if (!confirm(`【超危険】\nこれまでにテストで入力した『すべての注文データ』を完全に削除します。\n本当によろしいですか？`)) return;
    const finalConfirm = prompt('確認のため、半角大文字で「DELETE」と入力してください。');
    if (finalConfirm !== 'DELETE') return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('orders').delete().not('id', 'is', null);
      if (error) throw error;
      alert('すべての注文データをクリーンアップしました！');
    } catch (e) {
      alert('注文データのクリーンアップに失敗しました。\n(SupabaseのTable Editorから直接削除してください)');
    } finally {
      setIsSaving(false);
    }
  };

  const pendingUpgradesCount = upgradeRequests.filter(r => r.status === 'pending').length;
  const newFeedbacksCount = clientRequests.filter(r => r.status === 'new').length;

  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center font-sans">
        <div className="bg-[#111111] p-10 rounded-2xl border border-[#333333] shadow-2xl w-96 space-y-6 text-center">
          <h1 className="text-2xl font-black text-white tracking-widest font-serif italic">NocoLde</h1>
          <p className="text-[10px] text-[#2D4B3E] tracking-[0.3em]">SUPER ADMIN</p>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            onKeyDown={(e)=>e.key==='Enter'&&handleLogin()} 
            className="w-full bg-black border border-[#333333] rounded-lg px-4 py-3 text-white text-center outline-none focus:border-[#2D4B3E]" 
            placeholder="PASSWORD" 
          />
          <button onClick={handleLogin} className="w-full bg-[#2D4B3E] hover:bg-[#1f352b] text-white font-bold py-3 rounded-lg tracking-widest transition-all">LOGIN</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row text-gray-300 font-sans">
      <aside className="w-full md:w-64 bg-[#111111] border-r border-[#222222] md:fixed h-full z-20">
        <div className="p-8 flex flex-col gap-1 border-b border-[#222222]">
          <span className="font-serif italic text-[24px] font-black tracking-tight text-white">NocoLde</span>
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-[#2D4B3E] pt-1">Cloud Control</span>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => setActiveTab('tenants')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'tenants' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}><Building2 size={16}/> 店舗・機能管理</button>
          <button onClick={() => setActiveTab('invites')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'invites' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}><Mail size={16}/> アカウント発行</button>
          <button onClick={() => setActiveTab('upgrades')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center justify-between ${activeTab === 'upgrades' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>
            <div className="flex items-center gap-3"><ArrowUpCircle size={16}/> <span>アップグレード依頼</span></div>
            {pendingUpgradesCount > 0 && <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full">{pendingUpgradesCount}</span>}
          </button>
          <button onClick={() => setActiveTab('feedbacks')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center justify-between ${activeTab === 'feedbacks' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}>
            <div className="flex items-center gap-3"><MessageSquare size={16}/> <span>要望・フィードバック</span></div>
            {newFeedbacksCount > 0 && <span className="bg-blue-600 text-white text-[9px] px-2 py-0.5 rounded-full">{newFeedbacksCount}</span>}
          </button>
          <button onClick={() => setActiveTab('ai')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'ai' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}><Bot size={16}/> AIプロンプト設定</button>
          <button onClick={() => setActiveTab('usage')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'usage' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}><Sparkles size={16}/> AI利用状況・請求</button>
          <button onClick={() => setActiveTab('attendance')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'attendance' ? 'bg-[#2D4B3E] text-white' : 'text-gray-500 hover:bg-[#222222]'}`}><CheckCircle size={16}/> 全店 出勤状況</button>

          <div className="pt-8 pb-4">
            <button onClick={() => setActiveTab('danger')} className={`w-full text-left px-6 py-4 rounded-lg transition-all text-[12px] font-bold tracking-widest flex items-center gap-3 ${activeTab === 'danger' ? 'bg-red-900/30 text-red-500 border border-red-900/50' : 'text-gray-500 hover:bg-red-900/10 hover:text-red-500'}`}><AlertTriangle size={16}/> 危険な操作・初期化</button>
          </div>
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 p-8 md:p-12">
        <header className="flex justify-between items-center mb-10 border-b border-[#222222] pb-6">
          <h2 className="text-xl font-bold text-white tracking-widest uppercase">
            {activeTab === 'tenants' && 'TENANT MANAGEMENT'}
            {activeTab === 'invites' && 'ISSUE INVITATION'}
            {activeTab === 'upgrades' && 'UPGRADE REQUESTS'}
            {activeTab === 'feedbacks' && 'CLIENT FEEDBACKS'}
            {activeTab === 'ai' && 'AI PROMPT SETTINGS'}
            {activeTab === 'usage' && 'AI USAGE & BILLING'}
            {activeTab === 'attendance' && 'ATTENDANCE OVERVIEW'}
            {activeTab === 'danger' && 'DANGER ZONE'}
          </h2>
          <div className="flex items-center gap-4">
            {isSaving && <span className="text-[#2D4B3E] text-sm animate-pulse font-mono flex items-center gap-2"><RefreshCw size={14} className="animate-spin"/> Syncing...</span>}
            <button onClick={loadOwnerData} className="p-2 hover:bg-[#222222] rounded-full transition-all text-gray-500"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''}/></button>
          </div>
        </header>

        {activeTab === 'tenants' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-[#111111] rounded-2xl border border-[#222222] overflow-x-auto shadow-2xl">
              <table className="w-full text-left min-w-[850px]">
                <thead className="bg-[#1a1a1a] border-b border-[#333333] text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                  <tr>
                    <th className="px-6 py-4">店舗名 (ID)</th>
                    <th className="px-6 py-4">月額料金設定</th>
                    <th className="px-6 py-4">機能の個別解放</th>
                    <th className="px-6 py-4 text-center">ステータス</th>
                    <th className="px-6 py-4 text-right">強制操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222222] text-[13px]">
                  {tenants.map(t => {
                    const f = t.features || { b2b: false, deliveryOutsource: false };
                    return (
                      <tr key={t.id} className="hover:bg-[#1a1a1a] transition-all">
                        <td className="px-6 py-5">
                          <div className="font-bold text-white text-[14px]">{t.name}</div>
                          <div className="text-[10px] text-gray-500 font-mono mt-1">{t.id}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">¥</span>
                            <input 
                              type="number" 
                              value={t.price} 
                              onChange={(e) => handlePriceChange(t.id, e.target.value)} 
                              className="bg-black border border-[#333333] rounded px-3 py-1.5 w-24 text-white outline-none focus:border-[#2D4B3E] font-mono" 
                            />
                            <button 
                              onClick={() => handleSavePrice(t.id, t.price)}
                              disabled={savingPriceId === t.id}
                              className="px-3 py-1.5 bg-[#2D4B3E] text-white text-[10px] font-bold rounded hover:bg-[#1f352b] transition-all disabled:opacity-50"
                            >
                              {savingPriceId === t.id ? '更新中...' : '更新'}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {(() => {
                            const enabledCount = ALL_FEATURE_KEYS.filter(k => f?.[k]).length;
                            return (
                              <button
                                onClick={() => setFeatureModalTenant(t)}
                                className="bg-[#2D4B3E]/10 border border-[#2D4B3E]/40 text-emerald-400 px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest hover:bg-[#2D4B3E]/20 flex items-center gap-2"
                              >
                                <Sparkles size={12}/>
                                機能設定 ({enabledCount}/{ALL_FEATURE_KEYS.length})
                              </button>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest flex items-center justify-center gap-1 w-fit mx-auto ${t.status === 'active' ? 'bg-[#2D4B3E]/20 text-green-400 border border-[#2D4B3E]/50' : 'bg-red-900/20 text-red-500 border border-red-900/50'}`}>
                            {t.status === 'active' ? <><Unlock size={10}/> ACTIVE</> : <><Lock size={10}/> LOCKED</>}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => toggleLock(t.id)}
                              className={`px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest transition-all ${t.status === 'active' ? 'bg-orange-600/10 text-orange-500 hover:bg-orange-600 hover:text-white border border-orange-900' : 'bg-[#2D4B3E]/10 text-[#2D4B3E] hover:bg-[#2D4B3E] hover:text-white border border-[#2D4B3E]'}`}
                            >
                              {t.status === 'active' ? 'ロックする' : 'ロック解除'}
                            </button>
                            <button 
                              onClick={() => handleDeleteTenant(t.id)}
                              className="p-2 rounded-lg text-gray-500 hover:bg-red-900/30 hover:text-red-500 transition-all border border-transparent hover:border-red-900/50"
                              title="テナントを削除"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {tenants.length === 0 && !isLoading && (
                    <tr><td colSpan="5" className="px-6 py-12 text-center text-gray-600 italic font-mono">No tenants found in database.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. 招待 */}
        {activeTab === 'invites' && (
          <div className="space-y-10 animate-in fade-in">
            <div className="bg-[#111111] p-8 rounded-2xl border border-[#222222] shadow-2xl flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-[11px] font-bold text-gray-500 tracking-widest">クライアントのメールアドレス</label>
                <input type="email" value={newInviteEmail} onChange={(e) => setNewInviteEmail(e.target.value)} placeholder="client@example.com" className="w-full bg-black border border-[#333333] rounded-xl px-4 py-3 text-white outline-none focus:border-[#2D4B3E]" />
              </div>
              <div className="w-full md:w-48 space-y-2">
                <label className="text-[11px] font-bold text-gray-500 tracking-widest">初期の月額料金設定</label>
                <select value={newInvitePlan} onChange={(e) => setNewInvitePlan(e.target.value)} className="w-full bg-black border border-[#333333] rounded-xl px-4 py-3 text-white outline-none focus:border-[#2D4B3E]">
                  <option value="0">無料デモ (¥0)</option>
                  <option value="10000">標準プラン (¥10,000)</option>
                  <option value="20000">プロプラン (¥20,000)</option>
                </select>
              </div>
              <button onClick={handleInvite} className="h-[50px] px-8 bg-[#2D4B3E] text-white font-bold rounded-xl tracking-widest hover:bg-[#1f352b] transition-all whitespace-nowrap">
                招待URLを発行
              </button>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 tracking-widest border-b border-[#222222] pb-2">発行済みのアカウントURL一覧</h3>
              <div className="grid gap-4">
                {invitations.map(inv => (
                  <div key={inv.id} className="bg-[#111111] p-6 rounded-xl border border-[#222222] flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-white text-[15px]">{inv.email}</p>
                      <p className="text-[11px] text-gray-500 mt-1 font-mono">発行日: {inv.date} | 設定料金: ¥{Number(inv.price).toLocaleString()}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <input type="text" value={inv.url} readOnly className="w-full max-w-md bg-black text-[#2D4B3E] border border-[#333333] text-[11px] p-2.5 rounded-lg outline-none font-mono" />
                        <button onClick={() => {navigator.clipboard.writeText(inv.url); alert('URLをコピーしました！')}} className="text-xs bg-[#222222] hover:bg-[#333333] text-gray-300 px-3 py-2.5 rounded-lg transition-all whitespace-nowrap">コピー</button>
                        {/* ★ ここに削除ボタンを追加！ */}
                        <button onClick={() => handleDeleteInvite(inv.id)} className="text-red-400 hover:text-red-500 bg-[#222222] hover:bg-[#333333] px-3 py-2.5 rounded-lg transition-all" title="削除">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest ${inv.status === 'pending' ? 'bg-orange-900/30 text-orange-500 border border-orange-900/50' : 'bg-[#2D4B3E]/20 text-[#2D4B3E] border border-[#2D4B3E]/50'}`}>
                        {inv.status === 'pending' ? '未登録 (招待済)' : '本登録完了'}
                      </span>
                    </div>
                  </div>
                ))}
                {invitations.length === 0 && <p className="text-xs text-gray-600 italic">まだ招待したアカウントはありません。</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'upgrades' && (
          <div className="space-y-6 animate-in fade-in">
            {upgradeRequests.length === 0 ? <div className="text-center py-20 text-gray-600 font-mono tracking-widest border border-dashed border-[#333333] rounded-2xl">NO PENDING REQUESTS.</div> : (
              upgradeRequests.map(req => (
                <div key={req.id} className={`bg-[#111111] p-6 md:p-8 rounded-2xl border ${req.status === 'pending' ? 'border-[#2D4B3E] shadow-[0_0_15px_rgba(45,75,62,0.3)]' : 'border-[#222222] opacity-60'} flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all`}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3"><span className={`text-[9px] px-2 py-0.5 rounded font-bold tracking-widest ${req.status === 'pending' ? 'bg-[#2D4B3E] text-white' : req.status === 'approved' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>{req.status === 'pending' ? 'NEW REQUEST' : req.status === 'approved' ? 'APPROVED' : 'REJECTED'}</span><span className="text-[11px] text-gray-500 font-mono">{req.date}</span></div>
                    <h4 className="font-bold text-white text-[18px]"><span className="text-emerald-400">{req.featureName}</span> の利用申請</h4>
                    <p className="text-[13px] text-gray-400 flex items-center gap-2"><Building2 size={14}/> 申請元テナント: {req.tenantName}</p>
                  </div>
                  {req.status === 'pending' && (
                    <div className="flex gap-3 w-full md:w-auto">
                      <button onClick={() => handleRejectUpgrade(req.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 border border-[#333333] text-gray-400 text-[12px] font-bold rounded-xl hover:bg-[#222222] hover:text-white transition-all"><XCircle size={16}/> 却下する</button>
                      <button onClick={() => handleApproveUpgrade(req.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-[#2D4B3E] text-white text-[12px] font-bold rounded-xl hover:bg-[#1f352b] transition-all shadow-lg shadow-[#2D4B3E]/20"><CheckCircle size={16}/> 承認・機能を解放</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'feedbacks' && (
          <div className="space-y-4 animate-in fade-in">
            {clientRequests.length === 0 ? <div className="text-center py-20 text-gray-600 font-mono tracking-widest border border-dashed border-[#333333] rounded-2xl">NO FEEDBACKS.</div> : (
              clientRequests.map(fb => (
                <div key={fb.id} className={`bg-[#111111] p-6 rounded-xl border ${fb.status === 'new' ? 'border-[#333333] border-l-4 border-l-[#2D4B3E]' : 'border-[#222222] opacity-60'} transition-all`}>
                  <div className="flex justify-between items-start mb-3"><div className="flex items-center gap-2"><span className={`text-[10px] px-2 py-0.5 rounded font-bold tracking-widest ${fb.status === 'new' ? 'bg-blue-600 text-white' : 'border border-gray-600 text-gray-400'}`}>{fb.status === 'new' ? 'NEW' : '対応完了'}</span><span className="text-[10px] text-gray-400 font-bold bg-[#222222] px-2 py-0.5 rounded">{fb.type}</span></div><span className="text-[10px] text-gray-500 font-mono">{fb.date} | {fb.tenantName}</span></div>
                  <p className="text-[13px] text-gray-300 whitespace-pre-wrap leading-relaxed">{fb.text}</p>
                  {fb.status === 'new' && <div className="mt-4 flex gap-2"><button onClick={() => handleCompleteFeedback(fb.id)} className="text-[11px] font-bold border border-[#333333] text-white px-5 py-2 rounded-lg hover:bg-[#2D4B3E] hover:border-[#2D4B3E] transition-all">対応済みにする</button></div>}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-10 animate-in fade-in">
            {/* キャプション生成プロンプト（画像解析プロンプトはURL取込機能の正式リリースまで非表示） */}
            <section className="space-y-6">
              <header className="space-y-2">
                <h3 className="text-[16px] font-bold text-amber-400 flex items-center gap-2"><Wand2 size={18}/> 店舗別 SNSキャプション生成プロンプト</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">投稿用キャプション自動生成のAI指示文。過去キャプションを取り込むと、その店舗のトーンを真似した指示文を自動構築できます ✨</p>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tenants.map(t => (
                  <div key={`cap-${t.id}`} className="bg-[#111111] p-6 rounded-2xl border border-amber-900/30 shadow-xl flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-bold flex items-center gap-2"><Store size={16} className="text-amber-500" /> {t.name}</h4>
                      <button
                        onClick={() => { setSampleModalTenant(t); setSampleText(''); }}
                        className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/40 px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-amber-500/20 transition-all"
                      >
                        <Wand2 size={12}/> 過去から自動生成
                      </button>
                    </div>

                    {/* 金額表示トグル */}
                    <label className="flex items-center gap-2 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(t.showPriceInCaption)}
                        onChange={(e) => updateTenantShowPrice(t.id, e.target.checked)}
                        className="w-4 h-4 accent-amber-500"
                      />
                      <span className="text-[12px] font-bold text-amber-200">キャプション内に金額を表示する</span>
                    </label>

                    <textarea
                      value={t.captionPrompt ?? DEFAULT_CAPTION_PROMPT}
                      onChange={(e) => updateTenantCaptionPrompt(t.id, e.target.value)}
                      className="w-full h-56 bg-black border border-[#333333] rounded-xl p-4 text-[12px] text-amber-50 outline-none resize-none font-mono focus:border-amber-600 transition-colors flex-1"
                      placeholder="キャプション生成用のAI指示文..."
                    />
                    <p className="text-[10px] text-gray-600 mt-2">利用可能な変数: {`{purpose} {color} {vibe} {price} {appName}`}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-end pt-6 border-t border-[#222222]">
              <button onClick={saveAllPrompts} disabled={isSaving} className="flex items-center justify-center w-full md:w-auto gap-2 bg-[#2D4B3E] text-white px-10 py-4 rounded-xl font-bold text-[13px] tracking-widest hover:bg-[#1f352b] transition-all disabled:opacity-50 shadow-lg shadow-[#2D4B3E]/20"><Save size={16}/> {isSaving ? 'SAVING...' : 'SAVE ALL PROMPTS'}</button>
            </div>
          </div>
        )}

        {/* ★ 過去キャプションから自動生成モーダル */}
        {/* ★ 機能設定モーダル */}
        {featureModalTenant && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setFeatureModalTenant(null)}
          >
            <div
              className="bg-[#0a0a0a] border border-[#222222] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#222222] flex items-center justify-between">
                <div>
                  <h3 className="text-emerald-400 font-bold text-[16px] flex items-center gap-2"><Sparkles size={18}/> 機能ON/OFF</h3>
                  <p className="text-[11px] text-gray-500 mt-1">対象: <span className="text-white font-bold">{featureModalTenant.name}</span></p>
                </div>
                <button onClick={() => setFeatureModalTenant(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-6">
                {FEATURE_GROUPS.map(group => (
                  <div key={group.name}>
                    <h4 className="text-[12px] font-bold text-emerald-400 tracking-widest mb-3">{group.name}</h4>
                    <div className="space-y-2">
                      {group.items.map(item => {
                        const isOn = item.alwaysOn || (featureModalTenant.features?.[item.key] === true);
                        return (
                          <div
                            key={item.key}
                            onClick={() => {
                              if (item.alwaysOn) return;
                              toggleFeature(featureModalTenant.id, item.key);
                              // モーダル内state更新
                              setFeatureModalTenant(prev => ({
                                ...prev,
                                features: {
                                  ...(prev.features || {}),
                                  [item.key]: !prev.features?.[item.key],
                                },
                              }));
                            }}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                              item.alwaysOn ? 'border-[#333333] bg-[#1a1a1a] cursor-not-allowed opacity-70' :
                              isOn ? 'border-emerald-700 bg-emerald-950/30 cursor-pointer hover:border-emerald-500' :
                              'border-[#333333] bg-black cursor-pointer hover:border-[#555555]'
                            }`}
                          >
                            <div className={`mt-0.5 w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${isOn ? 'bg-emerald-600' : 'bg-[#333333]'}`}>
                              <div className={`w-5 h-5 bg-white rounded-full transition-all ${isOn ? 'translate-x-4' : ''}`}></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[13px] font-bold ${isOn ? 'text-white' : 'text-gray-400'}`}>
                                {item.label}{item.alwaysOn && <span className="text-[9px] text-gray-600 ml-2">基本機能</span>}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {sampleModalTenant && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => !isGenerating && setSampleModalTenant(null)}
          >
            <div
              className="bg-[#0a0a0a] border border-amber-900/40 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-amber-900/30 flex items-center justify-between">
                <div>
                  <h3 className="text-amber-400 font-bold text-[16px] flex items-center gap-2"><Wand2 size={18}/> 過去キャプションから自動生成</h3>
                  <p className="text-[11px] text-gray-500 mt-1">対象店舗: <span className="text-white font-bold">{sampleModalTenant.name}</span></p>
                </div>
                <button
                  onClick={() => !isGenerating && setSampleModalTenant(null)}
                  className="text-gray-500 hover:text-white"
                >
                  <X size={20}/>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200 leading-relaxed">
                  💡 過去のInstagram投稿キャプションを5〜10件、下のテキストエリアに貼り付けてください。<br/>
                  複数件は <code className="bg-black/40 px-1.5 rounded">空行3つ</code> または <code className="bg-black/40 px-1.5 rounded">---</code> で区切ってください。
                </div>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  placeholder={`例:\n本日納品させていただいたスタンド花...\n#花のある暮らし #札幌花屋\n\n---\n\n今回はピンク系の華やかなアレンジを...\n#フラワーアレンジメント`}
                  className="w-full h-80 bg-black border border-[#333333] rounded-xl p-4 text-[12px] text-emerald-50 outline-none resize-none font-mono focus:border-amber-600 transition-colors"
                  disabled={isGenerating}
                />
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setSampleModalTenant(null)}
                    disabled={isGenerating}
                    className="flex-1 h-11 rounded-xl border border-[#333333] text-gray-400 font-bold text-[12px] hover:bg-[#111] disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleGenerateFromSamples}
                    disabled={isGenerating}
                    className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-[12px] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? '生成中...' : <><Wand2 size={14}/> プロンプトを自動生成</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-8 animate-in fade-in">
            <header className="space-y-2">
              <h3 className="text-[16px] font-bold text-cyan-400 flex items-center gap-2"><Sparkles size={18}/> AI 利用状況と請求</h3>
              <p className="text-[12px] text-gray-500 leading-relaxed">各店舗の月別 AI 生成回数と、無料枠超過時の請求額を表示します。</p>
            </header>

            {/* 料金プラン設定 */}
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 shadow-xl">
              <h4 className="text-white font-bold mb-4 text-[13px] tracking-widest">PRICING PLAN</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 tracking-widest">月の無料枠（回数）</label>
                  <input type="number" value={aiPricing.freeQuotaPerMonth} onChange={(e) => setAiPricing({ ...aiPricing, freeQuotaPerMonth: Number(e.target.value) })}
                    className="w-full mt-1 bg-black border border-[#333333] rounded-xl p-3 text-[14px] text-white font-mono focus:border-cyan-600 outline-none"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 tracking-widest">超過分の単価（円/回）</label>
                  <input type="number" value={aiPricing.pricePerExtraJpy} onChange={(e) => setAiPricing({ ...aiPricing, pricePerExtraJpy: Number(e.target.value) })}
                    className="w-full mt-1 bg-black border border-[#333333] rounded-xl p-3 text-[14px] text-white font-mono focus:border-cyan-600 outline-none"/>
                </div>
                <button onClick={saveAiPricing} className="h-12 bg-cyan-600 hover:bg-cyan-500 text-black font-bold rounded-xl text-[12px] tracking-widest flex items-center justify-center gap-2"><Save size={14}/> 料金プランを保存</button>
              </div>
            </div>

            {/* 月選択 */}
            <div className="flex items-center gap-3">
              <label className="text-[12px] text-gray-500 font-bold tracking-widest">対象月:</label>
              <input type="month" value={usageMonth} onChange={(e) => setUsageMonth(e.target.value)}
                className="bg-black border border-[#333333] rounded-xl p-2.5 text-[13px] text-white font-mono focus:border-cyan-600 outline-none"/>
              <button onClick={() => loadUsage(usageMonth)} className="p-2.5 hover:bg-[#222222] rounded-full transition-all text-gray-500">
                <RefreshCw size={16} className={isLoadingUsage ? 'animate-spin' : ''}/>
              </button>
            </div>

            {/* 利用状況テーブル */}
            <div className="bg-[#111111] border border-[#222222] rounded-2xl shadow-xl overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-black/50 border-b border-[#222222]">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 tracking-widest">店舗</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-500 tracking-widest">キャプション</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-500 tracking-widest">プロンプト</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-500 tracking-widest">合計</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-500 tracking-widest">超過</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-500 tracking-widest">請求額</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-500 tracking-widest">請求書</th>
                  </tr>
                </thead>
                <tbody>
                  {usageList.length === 0 && (
                    <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-600 italic font-mono">この月のデータはまだありません</td></tr>
                  )}
                  {usageList.map(u => (
                    <tr key={u.tenantId} className="border-b border-[#222222]/50 hover:bg-black/30 transition-colors">
                      <td className="px-6 py-4 text-white font-bold">{u.tenantName}<span className="text-gray-600 text-[10px] font-mono ml-2">({u.tenantId})</span></td>
                      <td className="px-4 py-4 text-right text-gray-300 font-mono">{u.caption}</td>
                      <td className="px-4 py-4 text-right text-gray-300 font-mono">{u.prompt}</td>
                      <td className="px-4 py-4 text-right text-white font-bold font-mono">{u.total} / {aiPricing.freeQuotaPerMonth}</td>
                      <td className={`px-4 py-4 text-right font-mono ${u.overage > 0 ? 'text-amber-400 font-bold' : 'text-gray-700'}`}>
                        {u.overage > 0 ? `+${u.overage}` : '—'}
                      </td>
                      <td className={`px-4 py-4 text-right font-mono font-bold ${u.overageJpy > 0 ? 'text-cyan-400' : 'text-gray-700'}`}>
                        {u.overageJpy > 0 ? `¥${u.overageJpy.toLocaleString()}` : '無料枠内'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {u.overageJpy > 0 ? (
                          <button
                            onClick={() => printInvoice({ ...u, monthKey: usageMonth })}
                            className="inline-flex items-center gap-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-cyan-500/20 transition-all"
                            title="請求書をPDF発行"
                          >
                            <FileText size={11}/> 発行
                          </button>
                        ) : <span className="text-gray-700 text-[10px]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {usageList.some(u => u.overageJpy > 0) && (
                  <tfoot className="bg-black/50 border-t border-cyan-900/40">
                    <tr>
                      <td colSpan="5" className="px-6 py-3 text-right text-gray-400 font-bold tracking-widest">この月の請求総額</td>
                      <td className="px-6 py-3 text-right text-cyan-400 font-bold font-mono text-[14px]">
                        ¥{usageList.reduce((s, u) => s + u.overageJpy, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 text-[11px] text-cyan-200 leading-relaxed">
              💡 計測対象: キャプション生成 + プロンプト自動生成 の合計回数。<br/>
              月をまたぐと自動でカウントがリセットされ、過去月のデータは保持されます。
            </div>
          </div>
        )}

        {/* ★ 全店出勤状況 */}
        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-in fade-in">
            <header className="space-y-2 flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-cyan-400 flex items-center gap-2"><CheckCircle size={18}/> 全店舗 出勤状況</h3>
                <p className="text-[12px] text-gray-500 leading-relaxed">現在出勤中のスタッフを店舗別に表示します</p>
              </div>
              <button onClick={loadAttendanceOverview} className="p-2 hover:bg-[#222222] rounded-full text-gray-500">
                <RefreshCw size={16} className={isLoadingAttendance ? 'animate-spin' : ''}/>
              </button>
            </header>

            {!attendanceOverview ? (
              <div className="bg-[#111111] border border-[#222222] rounded-2xl p-12 text-center text-gray-600 italic font-mono">読込中...</div>
            ) : attendanceOverview.totalOpen === 0 ? (
              <div className="bg-[#111111] border border-[#222222] rounded-2xl p-12 text-center text-gray-600 italic font-mono">現在出勤中のスタッフはいません</div>
            ) : (
              <>
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 text-center">
                  <p className="text-[10px] text-cyan-400 font-bold tracking-widest">CURRENTLY WORKING</p>
                  <p className="text-[36px] font-bold text-white mt-1">{attendanceOverview.totalOpen}<span className="text-[14px] text-cyan-400 ml-2">名</span></p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attendanceOverview.byTenant.map(t => (
                    <div key={t.tenantId} className="bg-[#111111] border border-[#222222] rounded-2xl p-5">
                      <div className="border-b border-[#222222] pb-3 mb-3">
                        <p className="text-[10px] text-gray-500 font-mono">{t.tenantId}</p>
                        <p className="text-[14px] font-bold text-white mt-0.5">{t.tenantName}</p>
                        <p className="text-[10px] text-cyan-400 mt-1">{t.records.length}名 出勤中</p>
                      </div>
                      <div className="space-y-2">
                        {t.records.map(r => (
                          <div key={r.id} className="flex items-center justify-between bg-black p-2.5 rounded-lg">
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-bold text-white truncate">{r.staffName}</p>
                              <p className="text-[9px] text-gray-500 font-mono">
                                {new Date(r.clockInAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}〜
                              </p>
                            </div>
                            {r.isOnBreak && (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">☕休憩中</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'danger' && (
          <div className="space-y-6 animate-in fade-in">
            <header className="mb-6 space-y-2">
               <h3 className="text-[16px] font-bold text-red-500 flex items-center gap-2"><AlertTriangle size={18}/> 危険な操作 (データ初期化)</h3>
               <p className="text-[12px] text-gray-500 leading-relaxed">システムの本稼働前などに、不要なテストデータを一括で消去するためのメニューです。<br/>一度削除したデータは復元できません。</p>
            </header>
            <div className="bg-[#1a1111] p-8 rounded-2xl border border-red-900/50 shadow-xl space-y-4">
              <h4 className="text-white font-bold text-[14px]">すべてのテスト注文データを削除する</h4>
              <p className="text-[12px] text-gray-400">現在データベースに登録されている、すべての店舗の「注文データ（履歴・伝票）」を完全に消去し、真っ新な状態に戻します。（店舗の設定は消えません）</p>
              <button onClick={handleClearAllOrders} disabled={isSaving} className="mt-4 flex items-center justify-center gap-2 bg-red-600 text-white px-8 py-3 rounded-xl font-bold text-[13px] tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/50 disabled:opacity-50"><Trash2 size={16}/> 注文データを全件削除</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}