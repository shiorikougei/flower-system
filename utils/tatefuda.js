// [2026-10 B2] 立札の表示（新しい自由入力の形と、古いパターン選択の形の両方に対応）
// 既存の注文データは書き換えず、表示側で両方の形を読む
//   新: tateCompany（会社名・団体名）/ tateSender（送り主）/ tateRequest（ご要望）
//   旧: tatePattern + tateInput1（内容）/ tateInput2（宛名）/ tateInput3（贈り主）/ tateInput3a（会社名）/ tateInput3b（役職・氏名）

export function isFreeTatefuda(d) {
  return !!(d && (d.tateSender || d.tateCompany || d.tateRequest));
}

// 表示用の [見出し, 内容] の一覧（入力のある項目だけ）
export function tatefudaRows(d) {
  if (!d) return [];
  if (isFreeTatefuda(d)) {
    return [
      d.tateCompany ? ['会社名', d.tateCompany] : null,
      d.tateSender ? ['送り主', d.tateSender] : null,
      d.tateRequest ? ['ご要望', d.tateRequest] : null,
    ].filter(Boolean);
  }
  return [
    d.tatePattern ? ['パターン', d.tatePattern] : null,
    d.tateInput1 ? ['内容', d.tateInput1] : null,
    d.tateInput2 ? ['宛名', d.tateInput2] : null,
    d.tateInput3 ? ['贈り主', d.tateInput3] : null,
    d.tateInput3a ? ['会社名', d.tateInput3a] : null,
    d.tateInput3b ? ['役職・氏名', d.tateInput3b] : null,
  ].filter(Boolean);
}

// 1 行にまとめた文字（一覧の小さな表示用）
export function tatefudaText(d) {
  return tatefudaRows(d).map(([, v]) => String(v).replace(/\n/g, ' ')).join(' / ');
}

export function hasTatefudaContent(d) {
  return tatefudaRows(d).length > 0;
}
