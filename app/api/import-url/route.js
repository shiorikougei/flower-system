import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { url } = await req.json();
    
    // 【重要】本番環境では、ここでスクレイピング（OGP取得）を行います！
    // ※InstagramなどのSNSは通常ブロックされるため、専用のAPI等が必要です。

    return NextResponse.json({
      url: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=500&q=80',
      caption: '豪華な赤いバラのスタンド花です🌹\nお値段 33,000円〜承っております✨\n#開店祝い #スタンド花 #赤系',
      price: '33000',
      purpose: '開店祝い',
      color: '暖色系 (赤・ピンク・オレンジ)',
      vibe: '豪華'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch URL' }, { status: 500 });
  }
}