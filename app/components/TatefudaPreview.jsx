import React from 'react';

export default function TatefudaPreview({ tatePattern, layout, isOsonae, input1, input2, input3, input3a, input3b }) {
  // ★ ここで「祝」「御供」「供」を切り分ける
  const topPrefixText = isOsonae 
    ? (layout === 'vertical' && ['p3', 'p4'].includes(tatePattern) ? '供' : '御供')
    : '祝';

  return (
    <div className={`relative mx-auto border border-[#EAEAEA] shadow-lg bg-white flex flex-col items-center font-serif ${layout === 'horizontal' ? 'aspect-[1.414/1] w-full justify-center p-6' : 'aspect-[1/1.414] h-[300px] pt-6 px-4'}`}>
      
      {/* メインの冠文字（祝 / 御供 / 供） */}
      <div className={`font-black ${isOsonae ? 'text-gray-500' : 'text-red-600'} ${layout === 'horizontal' ? 'text-[28px] mb-4' : 'text-[40px] mb-6 leading-none'}`}>
        {topPrefixText}
      </div>

      {/* 宛名・内容・贈り主のレイアウト */}
      <div className={`flex w-full font-bold text-gray-900 ${layout === 'horizontal' ? 'flex-col items-center gap-2 text-[16px]' : 'flex-row-reverse justify-center gap-6 text-[18px]'}`}>
        
        {tatePattern.includes('p6') || tatePattern.includes('p8') ? (
          <>
            <div className={`tracking-widest ${layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{input2 || '宛名'} 様</div>
            {!isOsonae && <div className={`tracking-widest ${layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{input1 || '内容'}</div>}
            <div className={`tracking-widest ${layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{input3 || '贈り主'}</div>
          </>
        ) : tatePattern.includes('p4') ? (
          <>
            <div className={`tracking-[0.3em] ${layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{input3a || '会社名'}</div>
            <div className={`tracking-[0.3em] font-normal ${layout === 'horizontal' ? 'mt-4 text-[14px]' : 'mt-6 text-[14px] [writing-mode:vertical-rl]'}`}>{input3b || '役職・氏名'}</div>
          </>
        ) : (
          <>
            {!isOsonae && <div className={`tracking-widest ${layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{input1 || '内容'}</div>}
            <div className={`tracking-widest ${layout === 'vertical' ? '[writing-mode:vertical-rl]' : ''}`}>{input3 || '贈り主'}</div>
          </>
        )}

      </div>
    </div>
  );
}