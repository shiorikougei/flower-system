import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { purpose, color, vibe, price, appName } = await req.json();
    
    // 【重要】本番環境では、ここでOpenAI等のAPIを呼び出します！
    // 例: const response = await openai.chat.completions.create({...})
    
    // APIを繋ぐまでは、安全な定型文を返すダミーとして動かします。
    const generatedText = `【${purpose}のご注文】\n今回は${color}をメインに、${vibe}雰囲気でお作りしました✨\n\n大切な方への贈り物として当店を選んでいただき、本当にありがとうございます。\nお花が空間を華やかに彩り、皆様に笑顔をお届けできますように。\n\n---\n▼ こちらの商品（¥${price || '金額未設定'}）はプロフィールURLから簡単にご注文いただけます！\n\n#${appName} #お花屋さん #フラワーアレンジメント #スタンド花 #${purpose} #${vibe} #${color.replace(/系.*/, '')} #花のある暮らし`;

    return NextResponse.json({ caption: generatedText });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
  }
}