// SNS投稿用キャプション生成 API
// POST /api/generate-caption
// Body:
//   { purpose, color, vibe, price, appName, tenantId? }
//   - tenantId が指定されれば、その店舗の captionPrompt / showPriceInCaption 設定を使う
//   - tenantId なし、または設定なしの場合はデフォルトプロンプトを使用
//
// OPENAI_API_KEY が未設定なら、フォールバックでテンプレ文字列を返す

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { incrementUsage, getMonthlyUsage, getAiPricing } from '@/utils/aiUsage';

export const runtime = 'nodejs';

const DEFAULT_CAPTION_PROMPT = `あなたは {appName} の SNS担当です。お花の注文を受けて完成した作品をInstagramに投稿します。以下の条件でキャプションを作成してください。

【条件】
- 用途: {purpose}
- カラー: {color}
- 雰囲気: {vibe}
- 金額表示: {price}（"非表示" の場合は金額に触れない / 数字がある場合は本文末尾にさりげなく入れる）
- 店舗名: {appName}

【トーン】
- 温かみのある柔らかい文体
- 適度に絵文字（🌸💐✨など）を散りばめる
- 改行多めで読みやすく
- 末尾にハッシュタグを5〜8個

【構成】
1. お花の魅力と雰囲気を1〜2文で表現
2. お客様への感謝（軽く）
3. （任意）金額・購入方法
4. ハッシュタグ`;

export async function POST(request) {
  try {
    const body = await request.json();
    const { purpose, color, vibe, price, appName, tenantId } = body;

    // 1. テナント設定から captionPrompt / showPriceInCaption を取得
    let captionPrompt = DEFAULT_CAPTION_PROMPT;
    let showPrice = true;
    let supabase = null;
    if (tenantId) {
      try {
        supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data } = await supabase
          .from('app_settings')
          .select('settings_data')
          .eq('id', tenantId)
          .single();
        const settings = data?.settings_data || {};
        if (settings.captionPrompt) captionPrompt = settings.captionPrompt;
        if (typeof settings.showPriceInCaption === 'boolean') showPrice = settings.showPriceInCaption;
      } catch (e) {
        console.warn('[generate-caption] テナント設定取得失敗、デフォルト使用', e?.message);
      }
    }

    // ★ 利用カウンター: 月の無料枠を超えていないかチェック
    //    超過していても allowOverLimit:true なので利用は許可するが、超過分をレスポンスに含める
    let usageInfo = null;
    if (tenantId && supabase) {
      const result = await incrementUsage(supabase, tenantId, 'caption', { allowOverLimit: true });
      usageInfo = {
        used: result.usage.total,
        freeQuota: result.pricing.freeQuotaPerMonth,
        overage: result.overage,
        overageJpy: result.overage * result.pricing.pricePerExtraJpy,
        pricePerExtraJpy: result.pricing.pricePerExtraJpy,
      };
    }

    // 2. プロンプトに変数を流し込む
    const priceStr = showPrice && price ? `¥${Number(price).toLocaleString()}` : '非表示';
    const filledPrompt = captionPrompt
      .replace(/\{purpose\}/g, purpose || '未指定')
      .replace(/\{color\}/g, color || '未指定')
      .replace(/\{vibe\}/g, vibe || '未指定')
      .replace(/\{price\}/g, priceStr)
      .replace(/\{appName\}/g, appName || 'お花屋さん');

    // 3. OpenAI 呼び出し（キー未設定時はフォールバック）
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const fallback =
        `【${purpose}のご注文】\n${color}をメインに${vibe}雰囲気でお作りしました🌸\n\n` +
        `大切な方への贈り物にありがとうございました。\n` +
        (showPrice && price ? `\n価格: ¥${Number(price).toLocaleString()}\n` : '') +
        `\n#${appName || 'お花屋さん'} #フラワーアレンジメント #${purpose || ''} #${vibe || ''} #花のある暮らし`;
      return NextResponse.json({ caption: fallback, source: 'fallback', usage: usageInfo });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: filledPrompt },
          { role: 'user', content: '上記の条件でキャプションを1つ作成してください。' },
        ],
        temperature: 0.85,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[generate-caption] OpenAI error:', errText);
      return NextResponse.json({ error: `OpenAI API エラー: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const caption = data.choices?.[0]?.message?.content?.trim() || '';
    return NextResponse.json({ caption, source: 'openai', usage: usageInfo });
  } catch (err) {
    console.error('[generate-caption] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate' }, { status: 500 });
  }
}
