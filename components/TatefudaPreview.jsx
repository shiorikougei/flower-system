import React from 'react';

export default function TatefudaPreview({ tatePattern, layout, isOsonae, input1, input2, input3, input3a, input3b }) {
  // 「祝」「御供」「供」を切り分ける
  const topPrefixText = isOsonae 
    ? (layout === 'vertical' && ['p3', 'p4'].includes(tatePattern) ? '供' : '御供')
    : '祝';

  // ★ 縦書き時の文字サイズ自動調整ヘルパー関数
  //   連名（改行あり）の場合は、最も長い行の文字数で計算
  const getTextStyle = (text, defaultSize) => {
    if (layout !== 'vertical') {
      // 横型: 連名でも改行を保持
      return { whiteSpace: 'pre-line' };
    }

    const str = String(text || '');
    // 改行で分割して、最も長い行の文字数を取得
    const lines = str.split(/\n/).filter(l => l !== undefined);
    const maxLen = Math.max(4, ...lines.map(l => l.length));
    // 行数も加味（連名が増えると幅も少し縮める）
    const lineCount = Math.max(1, lines.length);
    const availableHeight = 200; // プレビュー枠内の縦の利用可能スペース（px）

    // 縦幅を文字数で割って最適なフォントサイズを計算
    const calculatedSize = Math.floor(availableHeight / maxLen);
    // 最小9px、最大はdefaultSizeに制限して小さくなりすぎないようにする
    let finalSize = Math.min(defaultSize, Math.max(calculatedSize, 9));
    // 連名（2行以上）の場合はさらに小さくする
    if (lineCount > 1) finalSize = Math.max(9, Math.floor(finalSize * 0.9));

    return {
      fontSize: `${finalSize}px`,
      lineHeight: '1.2',
      writingMode: 'vertical-rl',
      whiteSpace: 'pre-line',  // ★ 改行を保持
    };
  };

  // ★ 立札の色ルール:
  //   - 祝/御供/供 + 内容(ご開店・御生誕等) = 赤
  //   - お相手様の名前・贈り主の名前・会社名・役職 = 黒
  const nameColor = 'text-gray-900';  // 名前・会社名（黒）
  const redColor = 'text-red-600';    // 祝の文字・お祝い内容（赤）

  // ★ 横型の時、連名で行数が多いとフォントサイズを下げる
  const input3Lines = String(input3 || '').split(/\n/).filter(Boolean).length || 1;
  const horizontalNameSize = input3Lines > 2 ? 'text-[14px]' : 'text-[16px]';

  return (
    <>
      <div className={`relative mx-auto border border-[#EAEAEA] shadow-lg bg-white flex flex-col items-center font-serif ${layout === 'horizontal' ? 'aspect-[1.414/1] w-full max-w-[500px] justify-center py-5 px-6' : 'aspect-[1/1.414] h-[320px] pt-5 px-4 pb-3'}`}>

        {/* メインの冠文字 — 祝=赤 / 供・御供=グレー */}
        <div className={`font-black ${isOsonae ? 'text-gray-700' : redColor} ${layout === 'horizontal' ? 'text-[26px] mb-2' : 'text-[36px] mb-3 leading-none'}`}>
          {topPrefixText}
        </div>

        {/* 宛名・内容・贈り主のレイアウト */}
        <div className={`flex w-full font-bold ${layout === 'horizontal' ? `flex-col items-center gap-1 ${horizontalNameSize}` : 'flex-row-reverse justify-center gap-5 h-[220px] items-center'}`}>

          {tatePattern?.includes('p6') || tatePattern?.includes('p8') ? (
            <>
              {/* お相手様の宛名 → 黒 */}
              <div className={`tracking-widest ${nameColor}`} style={getTextStyle(input2 || '宛名', 18)}>{input2 || '宛名'}様</div>
              {/* お祝い内容（ご開店・御生誕等） → 赤 */}
              {!isOsonae && <div className={`tracking-widest ${redColor}`} style={getTextStyle(input1 || '内容', 18)}>{input1 || '内容'}</div>}
              {/* 贈り主名 → 黒 */}
              <div className={`tracking-widest ${nameColor}`} style={getTextStyle(input3 || '贈り主', 18)}>{input3 || '贈り主'}</div>
            </>
          ) : tatePattern?.includes('p4') ? (
            <>
              {/* 会社名・役職氏名 → 黒 */}
              <div className={`tracking-[0.3em] ${nameColor}`} style={getTextStyle(input3a || '会社名', 18)}>{input3a || '会社名'}</div>
              <div className={`tracking-[0.3em] font-normal mt-4 text-[14px] ${nameColor}`} style={getTextStyle(input3b || '役職・氏名', 14)}>{input3b || '役職・氏名'}</div>
            </>
          ) : (
            <>
              {/* お祝い内容（ご開店・御生誕等） → 赤 */}
              {!isOsonae && <div className={`tracking-widest ${redColor}`} style={getTextStyle(input1 || '内容', 18)}>{input1 || '内容'}</div>}
              {/* 贈り主名 → 黒（連名は1行ずつスタック） */}
              <div className={`tracking-widest ${nameColor} ${layout === 'horizontal' ? 'text-center leading-tight' : ''}`} style={getTextStyle(input3 || '贈り主', 18)}>{input3 || '贈り主'}</div>
            </>
          )}

        </div>
      </div>

      {/* ★ プレビュー下の注意書き */}
      <p className="mt-3 text-[11px] text-[#555555] leading-relaxed text-center px-2">
        サンプルレイアウトでデザインの崩れがある場合でも、スタッフが修正して作成するのでご安心ください。
      </p>
    </>
  );
}