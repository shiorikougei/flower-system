// [Phase2-⑦] 立札パターンマスタ
// 以前は4ファイルに重複定義されており修正漏れバグの温床だった。共通モジュールとして1箇所に集約。
//
// 使い方:
//   import { getTateOptions } from '@/utils/tateMaster';
//   const allTateOptions = getTateOptions(isOsonae);

/**
 * 立札パターンの全選択肢を返す
 * @param {boolean} isOsonae - お供え用かどうか（用途が葬儀/お悔やみ等の場合true）
 * @returns {Array} 立札パターン定義の配列
 *
 * 各パターン:
 *   - id: 'p1' ~ 'p8' - パターンID（既存DBの値とも一致）
 *   - label: ドロップダウン表示用の文字列
 *   - needs: 必要な入力フィールド ['1'=内容, '2'=宛名, '3'=贈り主, '3a'=会社名, '3b'=役職氏名]
 *   - layout: 'horizontal'（横型）or 'vertical'（縦型）
 */
export function getTateOptions(isOsonae) {
  return isOsonae ? [
    { id: 'p1', label: '① 御供｜横型 (背景あり)',       needs: ['3'],            layout: 'horizontal' },
    { id: 'p3', label: '② 御供｜縦型 (シンプル)',       needs: ['3'],            layout: 'vertical'   },
    { id: 'p4', label: '③ 御供｜縦型 (会社名入)',       needs: ['3a', '3b'],     layout: 'vertical'   },
  ] : [
    { id: 'p5', label: '⑤ 祝｜横型 (スタンダード)',     needs: ['1', '3'],       layout: 'horizontal' },
    { id: 'p6', label: '⑥ 祝｜横型 (様へ構成)',         needs: ['1', '2', '3'],  layout: 'horizontal' },
    { id: 'p7', label: '⑦ 祝｜縦型 (二列構成)',         needs: ['1', '3'],       layout: 'vertical'   },
    { id: 'p8', label: '⑧ 祝｜縦型 (三列完成版)',       needs: ['1', '2', '3'],  layout: 'vertical'   },
  ];
}

/**
 * 店舗で有効化されているパターンのみを返す（ユーティリティ）
 */
export function getAvailableTateOptions(isOsonae, enabledTatePatterns) {
  const all = getTateOptions(isOsonae);
  if (!Array.isArray(enabledTatePatterns)) return all;
  return all.filter(opt => enabledTatePatterns.includes(opt.id));
}

/**
 * パターンIDから定義を取得（横断検索）
 */
export function findTatePattern(patternId, isOsonae) {
  const options = getTateOptions(Boolean(isOsonae));
  return options.find(opt => opt.id === patternId);
}
