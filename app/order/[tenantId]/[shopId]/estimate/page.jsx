'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';
import { ChevronLeft, Send, CheckCircle2, ImagePlus, X, Loader2 } from 'lucide-react';

// ★ ヒアリング選択肢
const PURPOSE_OPTIONS = [
  '誕生日', '結婚祝い・結婚記念日', '出産祝い', '開店・開業祝い',
  '昇進・就任祝い', '発表会・公演祝い', '退職・送別', 'お見舞い',
  'お供え・お悔やみ', 'プロポーズ', 'その他お祝い', 'その他'
];

const FLOWER_TYPE_OPTIONS = [
  '花束', 'アレンジメント', 'スタンド花', '胡蝶蘭・鉢物',
  'プリザーブドフラワー', 'ドライフラワー', 'お任せ・相談したい'
];

const COLOR_OPTIONS = [
  'おまかせ', '赤系', 'ピンク系', '白系', '黄・オレンジ系',
  '青・紫系', 'グリーン系', '暖色ミックス', '寒色ミックス'
];

const BUDGET_OPTIONS = [
  '〜3,000円', '3,000〜5,000円', '5,000〜10,000円',
  '10,000〜20,000円', '20,000〜30,000円', '30,000円以上', '相場でおまかせ'
];

const DELIVERY_OPTIONS = [
  { value: 'pickup', label: '店頭で受取' },
  { value: 'delivery', label: '自社配達（近隣エリア）' },
  { value: 'shipping', label: '宅配便で配送（佐川急便）' },
  { value: 'undecided', label: '未定・相談したい' },
];

const CARD_OPTIONS = [
  { value: 'none', label: '不要' },
  { value: 'message', label: 'メッセージカード希望' },
  { value: 'tatefuda', label: '立札希望（開店祝い等）' },
];

export default function EstimatePage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = String(params?.tenantId || 'default').toLowerCase();
  const shopId = params?.shopId || 'default';

  const [appSettings, setAppSettings] = useState(null);
  const [form, setForm] = useState({
    // 連絡先
    customerName: '', customerEmail: '', customerPhone: '',
    // 用途・受取
    purpose: '', purposeOther: '',
    deliveryMethod: '',
    desiredDate: '', desiredTime: '',
    deliveryAddress: '',
    recipientName: '',
    // デザイン
    flowerType: '', colorPreference: '', countSpec: '',
    budget: '',
    cardType: 'none', cardContent: '',
    // 参考画像 (URLの配列)
    referenceImages: [],
    // その他自由記入
    otherNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  // ★ 画像アップロード関連
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  // ★ 参考画像のアップロード処理 (複数枚)
  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // 既存枚数 + 新規 で最大10枚まで
    const remaining = 10 - form.referenceImages.length;
    if (remaining <= 0) {
      alert('参考画像は最大10枚までアップロードできます');
      return;
    }
    const filesToUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      alert(`最大10枚までです。最初の${remaining}枚のみアップロードします。`);
    }
    // 各ファイルのサイズチェック (各5MB以下)
    for (const f of filesToUpload) {
      if (f.size > 5 * 1024 * 1024) {
        alert(`「${f.name}」は5MBを超えています。5MB以下の画像を選択してください。`);
        return;
      }
    }

    setUploadingImages(true);
    setUploadProgress({ done: 0, total: filesToUpload.length });
    const newUrls = [];
    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
        const filePath = `${tenantId}/estimates/${fileName}`;
        const { error: upErr } = await supabase.storage.from('portfolio').upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) {
          console.error(upErr);
          continue;
        }
        const { data: pub } = supabase.storage.from('portfolio').getPublicUrl(filePath);
        if (pub?.publicUrl) newUrls.push(pub.publicUrl);
        setUploadProgress({ done: i + 1, total: filesToUpload.length });
      }
      setForm(f => ({ ...f, referenceImages: [...f.referenceImages, ...newUrls] }));
    } catch (err) {
      console.error(err);
      alert('画像のアップロードに失敗しました: ' + err.message);
    } finally {
      setUploadingImages(false);
      // ファイル input をリセット (同じファイル選択しても発火するように)
      if (e.target) e.target.value = '';
    }
  }

  function removeReferenceImage(idx) {
    setForm(f => ({ ...f, referenceImages: f.referenceImages.filter((_, i) => i !== idx) }));
  }

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('settings_data').eq('id', tenantId).single();
        if (data?.settings_data) setAppSettings(data.settings_data);
      } catch {}
    })();
  }, [tenantId]);

  const appName = appSettings?.generalConfig?.appName || 'FLORIX';
  const isDelivery = form.deliveryMethod === 'delivery' || form.deliveryMethod === 'shipping';

  // 構造化データ → 読みやすいテキスト形式に変換（API送信用 + DB保存用）
  function buildRequestContent() {
    const lines = [];
    const purposeLabel = form.purpose === 'その他' ? `その他: ${form.purposeOther || ''}` : form.purpose;
    lines.push(`【ご用途】${purposeLabel}`);
    const dm = DELIVERY_OPTIONS.find(d => d.value === form.deliveryMethod);
    lines.push(`【受取方法】${dm?.label || ''}`);
    if (form.desiredDate) lines.push(`【ご希望日】${form.desiredDate}${form.desiredTime ? ` / 時刻: ${form.desiredTime}` : ''}`);
    if (isDelivery && form.deliveryAddress) lines.push(`【お届け先住所】${form.deliveryAddress}`);
    if (isDelivery && form.recipientName) lines.push(`【お届け先お名前】${form.recipientName} 様`);
    if (form.flowerType) lines.push(`【花の種類】${form.flowerType}`);
    if (form.colorPreference) lines.push(`【色・イメージ】${form.colorPreference}`);
    if (form.countSpec) lines.push(`【本数・サイズ指定】${form.countSpec}`);
    lines.push(`【ご予算】${form.budget}`);
    if (form.cardType !== 'none') {
      const ct = CARD_OPTIONS.find(c => c.value === form.cardType);
      lines.push(`【${ct?.label}】${form.cardContent || '（内容は後日相談）'}`);
    }
    if (form.referenceImages && form.referenceImages.length > 0) {
      lines.push(`【参考画像 (${form.referenceImages.length}枚)】\n${form.referenceImages.join('\n')}`);
    }
    if (form.otherNotes) lines.push(`【その他特記事項】\n${form.otherNotes}`);
    return lines.join('\n');
  }

  async function handleSubmit() {
    setError('');
    // バリデーション
    if (!form.customerName || !form.customerEmail || !form.customerPhone) {
      setError('お名前・メール・電話番号は必須です');
      return;
    }
    if (!form.purpose || !form.deliveryMethod || !form.budget) {
      setError('ご用途・受取方法・ご予算は必須です');
      return;
    }
    if (form.purpose === 'その他' && !form.purposeOther) {
      setError('ご用途「その他」の詳細をご入力ください');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId, shopId,
          customerName: form.customerName,
          customerEmail: form.customerEmail,
          customerPhone: form.customerPhone,
          requestContent: buildRequestContent(),
          requestData: form, // 構造化データも保存（後で見やすく表示するため）
          referenceImages: form.referenceImages, // 参考画像URL配列
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '送信に失敗しました');
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FBFAF9] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-[#EAEAEA] text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-600"/>
          </div>
          <h1 className="text-[18px] font-bold text-[#2D4B3E]">お見積もりのご依頼を受け付けました</h1>
          <p className="text-[12px] text-[#555] leading-relaxed">
            内容を確認の上、お見積もり結果をご登録のメールアドレス宛にお送りいたします。<br/>
            通常 1〜2営業日以内にご連絡いたします🌸
          </p>
          <Link href={`/order/${tenantId}/${shopId}`} className="inline-block px-6 h-12 leading-[48px] bg-[#2D4B3E] text-white rounded-xl text-[13px] font-bold">
            トップに戻る
          </Link>
        </div>
      </div>
    );
  }

  // ★ 共通スタイル
  const inputCls = "w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#117768]";
  const labelCls = "text-[11px] font-bold text-[#555]";
  const sectionCls = "bg-white p-6 rounded-2xl border border-[#EAEAEA] space-y-4";

  return (
    <div className="min-h-screen bg-[#FBFAF9] font-sans pb-20">
      <header className="bg-white border-b border-[#EAEAEA] sticky top-0 z-10">
        <div className="max-w-[700px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={`/order/${tenantId}/${shopId}`} className="flex items-center gap-1 text-[12px] font-bold text-[#555] hover:text-[#2D4B3E]">
            <ChevronLeft size={16}/> 戻る
          </Link>
          <span className="font-serif font-bold text-[16px] text-[#2D4B3E]">{appName}</span>
          <div className="w-12"/>
        </div>
      </header>

      <main className="max-w-[700px] mx-auto px-6 py-10 space-y-5">
        <div>
          <p className="text-[11px] text-[#117768] font-bold tracking-widest">ESTIMATE</p>
          <h1 className="text-[24px] font-bold text-[#2D4B3E] mt-1">お見積もり依頼フォーム</h1>
          <p className="text-[12px] text-[#555] mt-2 leading-relaxed">
            以下のようなご依頼におすすめです：<br/>
            ・バラ12本／99本など本数指定<br/>
            ・複数の花束・アレンジを同時にご注文<br/>
            ・予算がわからない／参考写真からのお見積もり<br/>
            ・お供え花・プリザーブド加工等の特別なご依頼
          </p>
        </div>

        {/* ① お客様情報 */}
        <div className={sectionCls}>
          <p className="text-[12px] font-bold text-[#117768] border-l-4 border-[#117768] pl-3">① お客様情報</p>
          <div className="space-y-2">
            <label className={labelCls}>お名前 <span className="text-red-500">*</span></label>
            <input type="text" value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} className={inputCls}/>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>メールアドレス <span className="text-red-500">*</span></label>
            <input type="email" value={form.customerEmail} onChange={e => setForm({...form, customerEmail: e.target.value})} className={inputCls}/>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>お電話番号 <span className="text-red-500">*</span> <span className="text-[10px] text-[#999]">（緊急連絡用）</span></label>
            <input type="tel" value={form.customerPhone} onChange={e => setForm({...form, customerPhone: e.target.value})} className={inputCls}/>
          </div>
        </div>

        {/* ② 用途・受取 */}
        <div className={sectionCls}>
          <p className="text-[12px] font-bold text-[#117768] border-l-4 border-[#117768] pl-3">② ご用途・お受け取り</p>
          <div className="space-y-2">
            <label className={labelCls}>ご用途 <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PURPOSE_OPTIONS.map(p => (
                <button key={p} type="button"
                  onClick={() => setForm({...form, purpose: p})}
                  className={`p-2.5 rounded-lg text-[11px] font-bold border-2 transition-all ${form.purpose === p ? 'bg-[#117768] border-[#117768] text-white' : 'bg-white border-[#EAEAEA] text-[#555] hover:border-[#117768]'}`}>
                  {p}
                </button>
              ))}
            </div>
            {form.purpose === 'その他' && (
              <input type="text" placeholder="ご用途の詳細をご入力ください"
                value={form.purposeOther} onChange={e => setForm({...form, purposeOther: e.target.value})}
                className={inputCls + ' mt-2'}/>
            )}
          </div>

          <div className="space-y-2">
            <label className={labelCls}>受取方法 <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DELIVERY_OPTIONS.map(d => (
                <button key={d.value} type="button"
                  onClick={() => setForm({...form, deliveryMethod: d.value})}
                  className={`p-3 rounded-lg text-[12px] font-bold border-2 transition-all text-left ${form.deliveryMethod === d.value ? 'bg-[#117768] border-[#117768] text-white' : 'bg-white border-[#EAEAEA] text-[#555] hover:border-[#117768]'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className={labelCls}>ご希望日 <span className="text-[10px] text-[#999]">（任意）</span></label>
              <input type="date" value={form.desiredDate} onChange={e => setForm({...form, desiredDate: e.target.value})} className={inputCls}/>
            </div>
            <div className="space-y-2">
              <label className={labelCls}>ご希望時刻 <span className="text-[10px] text-[#999]">（任意）</span></label>
              <input type="text" placeholder="例: 17時頃 / 午前中"
                value={form.desiredTime} onChange={e => setForm({...form, desiredTime: e.target.value})} className={inputCls}/>
            </div>
          </div>

          {isDelivery && (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-3">
              <p className="text-[11px] font-bold text-blue-900">📍 お届け先情報</p>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-blue-900">お届け先住所</label>
                <input type="text" placeholder="〇〇県〇〇市〇〇1-2-3 〇〇マンション101"
                  value={form.deliveryAddress} onChange={e => setForm({...form, deliveryAddress: e.target.value})} className={inputCls}/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-blue-900">お届け先お名前</label>
                <input type="text" placeholder="〇〇 〇〇"
                  value={form.recipientName} onChange={e => setForm({...form, recipientName: e.target.value})} className={inputCls}/>
              </div>
            </div>
          )}
        </div>

        {/* ③ デザイン */}
        <div className={sectionCls}>
          <p className="text-[12px] font-bold text-[#117768] border-l-4 border-[#117768] pl-3">③ お花のイメージ</p>

          <div className="space-y-2">
            <label className={labelCls}>花の種類 <span className="text-[10px] text-[#999]">（任意）</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FLOWER_TYPE_OPTIONS.map(f => (
                <button key={f} type="button"
                  onClick={() => setForm({...form, flowerType: f})}
                  className={`p-2.5 rounded-lg text-[11px] font-bold border-2 transition-all ${form.flowerType === f ? 'bg-[#117768] border-[#117768] text-white' : 'bg-white border-[#EAEAEA] text-[#555] hover:border-[#117768]'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>色・イメージ <span className="text-[10px] text-[#999]">（任意）</span></label>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_OPTIONS.map(c => (
                <button key={c} type="button"
                  onClick={() => setForm({...form, colorPreference: c})}
                  className={`p-2.5 rounded-lg text-[11px] font-bold border-2 transition-all ${form.colorPreference === c ? 'bg-[#117768] border-[#117768] text-white' : 'bg-white border-[#EAEAEA] text-[#555] hover:border-[#117768]'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>本数・サイズ指定 <span className="text-[10px] text-[#999]">（任意）</span></label>
            <input type="text" placeholder="例: バラ21本、Mサイズ、高さ60cm程度"
              value={form.countSpec} onChange={e => setForm({...form, countSpec: e.target.value})} className={inputCls}/>
          </div>
        </div>

        {/* ④ ご予算 */}
        <div className={sectionCls}>
          <p className="text-[12px] font-bold text-[#117768] border-l-4 border-[#117768] pl-3">④ ご予算 <span className="text-red-500">*</span></p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {BUDGET_OPTIONS.map(b => (
              <button key={b} type="button"
                onClick={() => setForm({...form, budget: b})}
                className={`p-3 rounded-lg text-[12px] font-bold border-2 transition-all ${form.budget === b ? 'bg-[#117768] border-[#117768] text-white' : 'bg-white border-[#EAEAEA] text-[#555] hover:border-[#117768]'}`}>
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* ⑤ メッセージカード / 立札 */}
        <div className={sectionCls}>
          <p className="text-[12px] font-bold text-[#117768] border-l-4 border-[#117768] pl-3">⑤ メッセージカード・立札</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {CARD_OPTIONS.map(c => (
              <button key={c.value} type="button"
                onClick={() => setForm({...form, cardType: c.value})}
                className={`p-3 rounded-lg text-[12px] font-bold border-2 transition-all ${form.cardType === c.value ? 'bg-[#117768] border-[#117768] text-white' : 'bg-white border-[#EAEAEA] text-[#555] hover:border-[#117768]'}`}>
                {c.label}
              </button>
            ))}
          </div>
          {form.cardType !== 'none' && (
            <textarea rows={3}
              placeholder={form.cardType === 'tatefuda' ? '例: 御祝 / 〇〇店御開店御祝 / 株式会社〇〇 代表 〇〇' : '例: お誕生日おめでとう！いつもありがとう。'}
              value={form.cardContent} onChange={e => setForm({...form, cardContent: e.target.value})}
              className="w-full px-4 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#117768] resize-none leading-relaxed"/>
          )}
        </div>

        {/* ⑥ 参考画像アップロード */}
        <div className={sectionCls}>
          <p className="text-[12px] font-bold text-[#117768] border-l-4 border-[#117768] pl-3">⑥ 参考画像 <span className="text-[10px] text-[#999]">（任意・最大10枚）</span></p>
          <p className="text-[11px] text-[#555] leading-relaxed">
            イメージに近いお写真があれば、お手元のスマホ画像・スクショをアップロードしてください。<br/>
            <span className="text-[10px] text-[#999]">※ 1枚あたり最大5MB / JPG・PNG・HEIC等の画像形式</span>
          </p>

          {/* アップロード済みプレビュー */}
          {form.referenceImages.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {form.referenceImages.map((url, idx) => (
                <div key={idx} className="relative aspect-square bg-[#FBFAF9] rounded-lg overflow-hidden border border-[#EAEAEA] group">
                  <img src={url} alt={`参考画像${idx + 1}`} className="w-full h-full object-cover"/>
                  <button
                    type="button"
                    onClick={() => removeReferenceImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-md hover:bg-red-600 transition-all"
                    aria-label="削除"
                  >
                    <X size={14}/>
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">
                    {idx + 1}枚目
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* アップロードボタン (10枚未満時のみ) */}
          {form.referenceImages.length < 10 && (
            <label className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${uploadingImages ? 'border-[#117768] bg-[#117768]/5' : 'border-[#EAEAEA] hover:border-[#117768] hover:bg-[#FBFAF9]'}`}>
              {uploadingImages ? (
                <>
                  <Loader2 className="animate-spin text-[#117768]" size={32}/>
                  <span className="text-[12px] font-bold text-[#117768]">
                    アップロード中... ({uploadProgress.done}/{uploadProgress.total})
                  </span>
                </>
              ) : (
                <>
                  <ImagePlus size={32} className="text-[#117768]"/>
                  <span className="text-[12px] font-bold text-[#117768]">
                    タップして画像を選択
                  </span>
                  <span className="text-[10px] text-[#999]">
                    残り {10 - form.referenceImages.length} 枚まで追加可能
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploadingImages}
                className="hidden"
              />
            </label>
          )}

          {form.referenceImages.length === 10 && (
            <p className="text-[10px] text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠️ 最大枚数 (10枚) に達しました。追加するには既存画像を削除してください。
            </p>
          )}
        </div>

        {/* ⑦ その他特記事項 */}
        <div className={sectionCls}>
          <p className="text-[12px] font-bold text-[#117768] border-l-4 border-[#117768] pl-3">⑦ その他特記事項 <span className="text-[10px] text-[#999]">（任意）</span></p>
          <textarea rows={4}
            placeholder="例: アレルギーで百合は避けてほしい / 母が喜ぶ色合いで / サプライズなので連絡不要 など"
            value={form.otherNotes} onChange={e => setForm({...form, otherNotes: e.target.value})}
            className="w-full px-4 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#117768] resize-none leading-relaxed"/>
        </div>

        {/* 送信 */}
        <div className={sectionCls}>
          {error && <p className="text-[12px] text-red-600 font-bold">{error}</p>}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full h-14 bg-[#117768] hover:bg-[#0d5e54] text-white rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50">
            <Send size={16}/> {submitting ? '送信中...' : 'お見積もりを依頼する'}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-[11px] text-blue-900 leading-relaxed">
          💡 通常 1〜2 営業日以内にメールでお見積もり結果をご連絡いたします。<br/>
          内容にご納得いただいてから正式注文への変換が可能です。
        </div>
      </main>
    </div>
  );
}
