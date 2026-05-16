import React from 'react';

export default function TatefudaPreview({ tatePattern, layout, isOsonae, input1, input2, input3, input3a, input3b }) {
  // 「祝」「御供」「供」を切り分ける
  const topPrefixText = isOsonae 
    ? (layout === 'vertical' && ['p3', 'p4'].includes(tatePattern) ? '供' : '御供')
    : '祝';

  // ★ 縦書き時の文字サイズ自動調整ヘルパー関数
  const getTextStyle = (text, defaultSize) => {
    if (layout !== 'vertical') return {}; // 横型はそのまま
    
    const len = (text || '').length || 4;
    const availableHeight = 200; // プレビュー枠内の縦の利用可能スペース（px）
    
    // 縦幅を文字数で割って最適なフォントサイズを計算
    const calculatedSize = Math.floor(availableHeight / len);
    // 最小9px、最大はdefaultSizeに制限して小さくなりすぎないようにする
    const finalSize = Math.min(defaultSize, Math.max(calculatedSize, 9)); 
    
    return { 
      fontSize: `${finalSize}px`, 
      lineHeight: '1.2',
      writingMode: 'vertical-rl' 
    };
  };

  // ★ 立札の色ルール:
  //   - 祝/御供/供 + 内容(ご開店・御生誕等) = 赤
  //   - お相手様の名前・贈り主の名前・会社名・役職 = 黒
  const nameColor = 'text-gray-900';  // 名前・会社名（黒）
  const redColor = 'text-red-600';    // 祝の文字・お祝い内容（赤）

  return (
    <>
      <div className={`relative mx-auto border border-[#EAEAEA] shadow-lg bg-white flex flex-col items-center font-serif ${layout === 'horizontal' ? 'aspect-[1.414/1] w-full justify-center p-6' : 'aspect-[1/1.414] h-[300px] pt-6 px-4'}`}>

        {/* メインの冠文字 — 祝=赤 / 供・御供=グレー */}
        <div className={`font-black ${isOsonae ? 'text-gray-700' : redColor} ${layout === 'horizontal' ? 'text-[28px] mb-4' : 'text-[40px] mb-6 leading-none'}`}>
          {topPrefixText}
        </div>

        {/* 宛名・内容・贈り主のレイアウト */}
        <div className={`flex w-full font-bold ${layout === 'horizontal' ? 'flex-col items-center gap-2 text-[16px]' : 'flex-row-reverse justify-center gap-6 h-[200px]'}`}>

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
              {/* 贈り主名 → 黒 */}
              <div className={`tracking-widest ${nameColor}`} style={getTextStyle(input3 || '贈り主', 18)}>{input3 || '贈り主'}</div>
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