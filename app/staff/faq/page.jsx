// [UX-#39] FAQ管理画面
// settings.faqItems に保存。空ならDEFAULT_FAQ_ITEMSが公開ページで使用される

"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { Plus, Edit2, Trash2, Save, X, RotateCcw, ChevronUp, ChevronDown, HelpCircle } from "lucide-react";
import { DEFAULT_FAQ_ITEMS } from "@/utils/faqData";

export default function StaffFaqPage() {
  const [tenantId, setTenantId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    initData();
  }, []);

  async function initData() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/staff/login";
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session.user.id)
        .single();
      const tId = profile?.tenant_id;
      if (!tId) throw new Error("tenant_id が取得できません");
      setTenantId(tId);

      const { data: settingsRow } = await supabase
        .from("app_settings")
        .select("settings_data")
        .eq("id", tId)
        .single();
      const settings = settingsRow?.settings_data || {};
      const faqItems = Array.isArray(settings.faqItems) && settings.faqItems.length > 0
        ? settings.faqItems
        : DEFAULT_FAQ_ITEMS.map(it => ({ ...it })); // デフォルトをコピーして編集可能に
      setItems(faqItems);
    } catch (e) {
      console.error("[faq init]", e);
      alert(`読み込みエラー: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function persist(newItems) {
    setSaving(true);
    try {
      const { data: settingsRow } = await supabase
        .from("app_settings")
        .select("settings_data")
        .eq("id", tenantId)
        .single();
      const settings = settingsRow?.settings_data || {};
      const payload = { ...settings, faqItems: newItems };
      const { error } = await supabase
        .from("app_settings")
        .upsert({ id: tenantId, settings_data: payload });
      if (error) throw error;
      setItems(newItems);
      setMessage({ type: "success", text: "保存しました" });
      setTimeout(() => setMessage(null), 2500);
    } catch (e) {
      console.error("[faq save]", e);
      setMessage({ type: "error", text: `保存失敗: ${e.message}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveItem(item) {
    let newItems;
    if (item._isNew) {
      const { _isNew, ...rest } = item;
      newItems = [...items, rest];
    } else {
      newItems = items.map((it, idx) => (idx === item._index ? {
        category: item.category,
        question: item.question,
        answer: item.answer,
      } : it));
    }
    await persist(newItems);
    setEditing(null);
  }

  async function handleDelete(idx) {
    if (!confirm(`「${items[idx].question}」を削除します。よろしいですか？`)) return;
    const newItems = items.filter((_, i) => i !== idx);
    await persist(newItems);
  }

  async function handleMove(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    await persist(newItems);
  }

  async function handleResetDefaults() {
    if (!confirm("FAQをデフォルト（最初に用意されている16件）に戻します。\n現在の編集内容は失われます。よろしいですか？")) return;
    await persist(DEFAULT_FAQ_ITEMS.map(it => ({ ...it })));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center">
        <p className="text-[#999] text-[13px]">読み込み中...</p>
      </div>
    );
  }

  // カテゴリ別にグルーピング
  const grouped = {};
  items.forEach((it, idx) => {
    const cat = it.category || "その他";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ ...it, _index: idx });
  });

  // 既存カテゴリリスト
  const existingCategories = Array.from(new Set(items.map(it => it.category).filter(Boolean)));

  return (
    <div className="min-h-screen bg-[#FBFAF9] p-6 md:p-10">
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-[24px] font-bold text-[#2D4B3E]">よくあるご質問 管理</h1>
            <p className="text-[12px] text-[#666] mt-1">お客様向け FAQ ページの内容を編集します。Google検索のリッチリザルトにも反映されます。</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleResetDefaults}
              disabled={saving}
              className="px-4 h-10 bg-white border border-[#EAEAEA] text-[#666] rounded-xl text-[12px] font-bold hover:bg-[#FBFAF9] flex items-center gap-1"
            >
              <RotateCcw size={14}/> デフォルトに戻す
            </button>
            <button
              onClick={() => setEditing({ _isNew: true, category: existingCategories[0] || "ご注文・配送", question: "", answer: "" })}
              disabled={saving}
              className="px-4 h-10 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold flex items-center gap-1"
            >
              <Plus size={14}/> 新規追加
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-xl text-[12px] font-bold ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* ヒント */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-[11px] text-blue-900 leading-relaxed flex items-start gap-2">
            <HelpCircle size={14} className="mt-0.5 shrink-0"/>
            <span>
              <strong>SEO効果UPのコツ</strong>: 質問は「お客様が検索しそうな自然な言葉」で。回答は <strong>2〜4文</strong> で要点を絞る。
              この内容は <strong>FAQPage構造化データ</strong>として Googleの検索結果カードに直接表示されます。
            </span>
          </p>
        </div>

        {/* カテゴリ別表示 */}
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="mb-6">
            <h2 className="text-[14px] font-bold text-[#2D4B3E] mb-3 pb-2 border-b border-[#EAEAEA]">{cat}</h2>
            <div className="space-y-2">
              {list.map((it) => (
                <div key={it._index} className="bg-white rounded-xl p-4 border border-[#EAEAEA]">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#111]">Q. {it.question}</p>
                      <p className="text-[12px] text-[#555] mt-1.5 leading-relaxed">A. {it.answer}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMove(it._index, -1)}
                        disabled={saving || it._index === 0}
                        className="w-7 h-7 bg-[#FBFAF9] rounded-lg flex items-center justify-center disabled:opacity-30"
                        title="上へ"
                      >
                        <ChevronUp size={12}/>
                      </button>
                      <button
                        onClick={() => handleMove(it._index, 1)}
                        disabled={saving || it._index === items.length - 1}
                        className="w-7 h-7 bg-[#FBFAF9] rounded-lg flex items-center justify-center disabled:opacity-30"
                        title="下へ"
                      >
                        <ChevronDown size={12}/>
                      </button>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setEditing({ ...it })}
                        disabled={saving}
                        className="w-7 h-7 bg-[#FBFAF9] rounded-lg flex items-center justify-center"
                        title="編集"
                      >
                        <Edit2 size={12}/>
                      </button>
                      <button
                        onClick={() => handleDelete(it._index)}
                        disabled={saving}
                        className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center"
                        title="削除"
                      >
                        <Trash2 size={12} className="text-red-600"/>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-white border border-dashed border-[#EAEAEA] rounded-2xl p-12 text-center">
            <p className="text-[14px] font-bold text-[#999]">FAQ項目がありません</p>
            <p className="text-[11px] text-[#CCC] mt-2">「新規追加」または「デフォルトに戻す」から始めましょう</p>
          </div>
        )}
      </div>

      {editing && (
        <EditFaqModal
          item={editing}
          existingCategories={existingCategories}
          onClose={() => setEditing(null)}
          onSave={handleSaveItem}
        />
      )}
    </div>
  );
}

function EditFaqModal({ item, existingCategories, onClose, onSave }) {
  const [form, setForm] = useState({
    _isNew: item._isNew || false,
    _index: item._index,
    category: item.category || "",
    question: item.question || "",
    answer: item.answer || "",
  });
  const [customCategory, setCustomCategory] = useState(false);

  const handleSubmit = () => {
    if (!form.category.trim()) return alert("カテゴリを入力してください");
    if (!form.question.trim()) return alert("質問を入力してください");
    if (!form.answer.trim()) return alert("回答を入力してください");
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-[640px] w-full max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-[18px] font-bold text-[#2D4B3E]">{form._isNew ? "新規FAQ" : "FAQを編集"}</h2>
            <button onClick={onClose}><X size={18}/></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-[#666]">カテゴリ *</label>
              {!customCategory && existingCategories.length > 0 ? (
                <div className="flex gap-2">
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="flex-1 h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px]"
                  >
                    {existingCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCustomCategory(true)}
                    className="h-11 px-3 bg-[#F5F2EE] rounded-xl text-[11px] font-bold"
                  >
                    新規カテゴリ
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px]"
                  placeholder="ご注文・配送 / 立札 / 決済 / お花のお手入れ など"
                />
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#666]">質問 *（お客様目線の自然な言葉で）</label>
              <input
                type="text"
                value={form.question}
                onChange={e => setForm({ ...form, question: e.target.value })}
                className="w-full h-11 bg-[#FBFAF9] border rounded-xl px-4 text-[13px]"
                placeholder="当日のご注文・配送は可能ですか？"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#666]">回答 *（2〜4文で要点を）</label>
              <textarea
                value={form.answer}
                onChange={e => setForm({ ...form, answer: e.target.value })}
                rows={6}
                className="w-full bg-[#FBFAF9] border rounded-xl px-4 py-3 text-[13px] leading-relaxed"
                placeholder="商品により対応可否が異なります。当日対応可能なお花の場合、午前中までのご注文で当日配送承れる場合がございます。"
              />
              <p className="text-[10px] text-[#999] text-right mt-1">{form.answer.length} 文字</p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 h-11 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[12px] font-bold"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 h-11 bg-[#2D4B3E] text-white rounded-xl text-[12px] font-bold flex items-center justify-center gap-1"
            >
              <Save size={14}/> 保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
