'use client';
// [2026-10 B2] 立札の入力（自由入力）
// 9/17 打ち合わせで決定:
//   - 送り主の情報が基本。会社名は任意
//   - レイアウト（横型・縦型など）と頭書き（御祝・御供など）はお店が決める
//   - 宛名などは「ご要望」に書いてもらう
//   - プレビューは出さない
// 保存する項目: tateCompany（会社名・団体名）/ tateSender（送り主のお名前）/ tateRequest（ご要望）
// 古い形（tatePattern + tateInput1〜3b）の注文は utils/tatefuda.js で表示する

export default function TatefudaFreeInput({ company, sender, request, onChange, compact = false }) {
  const box = compact
    ? 'space-y-3'
    : 'space-y-4 bg-white p-6 rounded-2xl border border-[#EAEAEA] shadow-sm';
  const input = 'w-full h-12 px-4 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E]';
  return (
    <div className={box}>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-[#555]">会社名・団体名 <span className="font-normal text-[#999]">（任意）</span></span>
        <input type="text" value={company} maxLength={100}
          onChange={(e) => onChange('tateCompany', e.target.value)}
          placeholder="例: 株式会社〇〇"
          className={input}/>
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-[#555]">送り主のお名前 <span className="text-red-500">*</span></span>
        <textarea value={sender} rows={2} maxLength={300}
          onChange={(e) => onChange('tateSender', e.target.value)}
          placeholder={'例: 代表取締役 山田太郎\n（連名の場合は改行して続けてご入力ください）'}
          className="w-full px-4 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E] resize-y leading-relaxed"/>
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-[#555]">ご要望 <span className="font-normal text-[#999]">（任意）</span></span>
        <textarea value={request} rows={2} maxLength={500}
          onChange={(e) => onChange('tateRequest', e.target.value)}
          placeholder="例: 宛名「〇〇様」も入れてほしい"
          className="w-full px-4 py-3 bg-[#FBFAF9] border border-[#EAEAEA] rounded-xl text-[13px] outline-none focus:border-[#2D4B3E] resize-y leading-relaxed"/>
      </label>
      <p className="text-[11px] text-[#555] leading-relaxed bg-[#FBFAF9] rounded-xl p-3 border border-[#EAEAEA]">
        ※ 基本は送り主様の情報だけでお作りできます。「御祝」「御供」などの頭書きは、ご用途に合わせてお店でお入れします。
      </p>
    </div>
  );
}
