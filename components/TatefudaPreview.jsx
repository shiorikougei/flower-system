import React from 'react';

export default function TatefudaPreview({ tatePattern, layout, isOsonae, input1, input2, input3, input3a, input3b }) {
  // 「祝」「御供」「供」を切り分ける
  const topPrefixText = isOsonae 
    ? (layout === 'vertical' && ['p3', 'p4'].includes(tatePattern) ? '供' : '御供')
    : '祝';

  // ★ 縦書き時の文字サイズ自動調整ヘルパー関数
  const getTextStyle = (text, defaultSize) => {
    if (layout !== 'vertical') return {}; // 横型はTailwindに任せる
    
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

  return (
    <div className={`relative mx-auto border border-[#EAEAEA] shadow-lg bg-white flex flex-col items-center font-serif ${layout === 'horizontal' ? 'aspect-[1.414/1] w-full justify-center p-6' : 'aspect-[1/1.414] h-[300px] pt-6 px-4'}`}>
      
      {/* メインの冠文字（祝 / 御供 / 供） */}
      <div className={`font-black ${isOsonae ? 'text-gray-500' : 'text-red-600'} ${layout === 'horizontal' ? 'text-[28px] mb-4' : 'text-[40px] mb-6 leading-none'}`}>
        {topPrefixText}
      </div>

      {/* 宛名・内容・贈り主のレイアウト */}
      <div className={`flex w-full font-bold text-gray-900 ${layout === 'horizontal' ? 'flex-col items-center gap-2 text-[16px]' : 'flex-row-reverse justify-center gap-6 h-[200px]'}`}>
        
        {tatePattern?.includes('p6') || tatePattern?.includes('p8') ? (
          <>
            <div className={layout === 'horizontal' ? 'tracking-widest' : 'tracking-widest'} style={getTextStyle(input2 || '宛名', 18)}>{input2 || '宛名'}様</div>
            {!isOsonae && <div className={layout === 'horizontal' ? 'tracking-widest' : 'tracking-widest'} style={getTextStyle(input1 || '内容', 18)}>{input1 || '内容'}</div>}
            <div className={layout === 'horizontal' ? 'tracking-widest' : 'tracking-widest'} style={getTextStyle(input3 || '贈り主', 18)}>{input3 || '贈り主'}</div>
          </>
        ) : tatePattern?.includes('p4') ? (
          <>
            <div className={layout === 'horizontal' ? 'tracking-[0.3em]' : 'tracking-[0.3em]'} style={getTextStyle(input3a || '会社名', 18)}>{input3a || '会社名'}</div>
            <div className={layout === 'horizontal' ? 'tracking-[0.3em] font-normal mt-4 text-[14px]' : 'tracking-[0.3em] font-normal mt-6'} style={getTextStyle(input3b || '役職・氏名', 14)}>{input3b || '役職・氏名'}</div>
          </>
        ) : (
          <>
            {!isOsonae && <div className={layout === 'horizontal' ? 'tracking-widest' : 'tracking-widest'} style={getTextStyle(input1 || '内容', 18)}>{input1 || '内容'}</div>}
            <div className={layout === 'horizontal' ? 'tracking-widest' : 'tracking-widest'} style={getTextStyle(input3 || '贈り主', 18)}>{input3 || '贈り主'}</div>
          </>
        )}

      </div>
    </div>
  );
}