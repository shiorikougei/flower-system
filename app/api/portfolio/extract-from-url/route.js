// URL から og:image 等のメタ情報を取得する API
// POST /api/portfolio/extract-from-url
// Body: { url }
// 用途: Instagram URL を貼って投稿画像を取得 → 作品として登録

import { NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/utils/rateLimit';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const allowed = await rateLimit({ key: `extract-url:${ip}`, max: 30, windowSec: 60 });
    if (!allowed) {
      return NextResponse.json({ error: 'リクエスト過多です' }, { status: 429 });
    }

    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'url必要' }, { status: 400 });

    // URL 形式チェック
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return NextResponse.json({ error: 'URLの形式が不正です' }, { status: 400 }); }

    // 安全のため http(s) のみ許可
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'http/https URLのみ対応' }, { status: 400 });
    }

    // メタ情報を取得
    const html = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FLORIX-bot/1.0; +https://noodleflorix.com)',
      },
    }).then(r => r.ok ? r.text() : '');

    if (!html) {
      return NextResponse.json({ error: 'ページが取得できませんでした' }, { status: 500 });
    }

    // og:image / og:title / og:description を抽出
    const extract = (prop) => {
      const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
      const match = html.match(re);
      return match ? match[1] : null;
    };

    const image = extract('og:image');
    const title = extract('og:title');
    const description = extract('og:description');

    if (!image) {
      return NextResponse.json({ error: '画像が取得できませんでした（Instagram の場合、公開投稿のみ対応）' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      image,
      title: title || '',
      description: description || '',
      sourceUrl: url,
    });
  } catch (err) {
    console.error('[extract-from-url]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
