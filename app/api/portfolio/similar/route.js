// 過去作品の類似検索API
// GET /api/portfolio/similar?tenantId=xxx&purpose=...&color=...&vibe=...&price=...&limit=6
//
// 各作品にスコアを付けて上位N件を返す
//   purpose 完全一致 = +3点
//   color 完全一致   = +2点
//   vibe 完全一致    = +2点
//   price ±20%以内   = +1点
//   price ±50%以内   = +0.5点
//
// 公開API（お客様の注文ページから叩く）

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId必要' }, { status: 400 });

    const purpose = (searchParams.get('purpose') || '').trim();
    const color = (searchParams.get('color') || '').trim();
    const vibe = (searchParams.get('vibe') || '').trim();
    const price = Number(searchParams.get('price')) || 0;
    const limit = Math.min(Number(searchParams.get('limit')) || 6, 20);

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ギャラリーデータ取得
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', `${tenantId}_gallery`)
      .maybeSingle();

    const allImages = data?.settings_data?.images || [];
    if (allImages.length === 0) return NextResponse.json({ items: [] });

    // スコアリング
    const scored = allImages.map(img => {
      let score = 0;
      const reasons = [];

      if (purpose && img.purpose === purpose) {
        score += 3;
        reasons.push('用途');
      }
      if (color && img.color === color) {
        score += 2;
        reasons.push('色');
      }
      if (vibe && img.vibe === vibe) {
        score += 2;
        reasons.push('イメージ');
      }
      if (price && img.price) {
        const diff = Math.abs(Number(img.price) - price) / price;
        if (diff <= 0.2) { score += 1; reasons.push('予算'); }
        else if (diff <= 0.5) { score += 0.5; }
      }

      return { ...img, _score: score, _matchedReasons: reasons };
    });

    // スコア > 0 のみ、降順ソート、上位 N件
    const filtered = scored
      .filter(item => item._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);

    // 余分な内部情報を削除して返す（caption は提案表示時に使う）
    const result = filtered.map(({ _score, _matchedReasons, ...item }) => ({
      ...item,
      score: _score,
      matchedReasons: _matchedReasons,
    }));

    return NextResponse.json({ items: result, totalChecked: allImages.length });
  } catch (err) {
    console.error('[portfolio/similar] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
