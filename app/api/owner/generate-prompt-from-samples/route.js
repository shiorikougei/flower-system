// 過去のキャプションサンプルを元に、その店舗専用のキャプション生成プロンプトを自動構築
// POST /api/owner/generate-prompt-from-samples
// Body: { samples: string[], tenantName?: string }
// Returns: { prompt: string }
//
// 使い方:
//   - オーナーページの「キャプション生成プロンプト」セクションで使用
//   - 店舗が過去に書いてきたインスタ投稿などのキャプション5〜10件を貼り付け
//   - そのトーン・絵文字・構成・ハッシュタグ戦略を AI が分析し、
//     新規キャプションを同じスタイルで生成するための指示文を作成

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { incrementUsage } from '@/utils/aiUsage';
import { requireOwner } from '@/utils/adminAuth';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    // ★ NocoLde スーパー管理者のみ実行可（OpenAI課金踏み台防止）
    const auth = await requireOwner(request);
    if (!auth.ok) return auth.response;

    const { samples, tenantName, tenantId } = await request.json();
    if (!Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json({ error: 'samples (string配列) が必要です' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY が環境変数に設定されていません' },
        { status: 500 }
      );
    }

    const sampleText = samples
      .map((s, i) => `[サンプル${i + 1}]\n${String(s).trim()}`)
      .join('\n\n---\n\n');

    const systemMessage =
      'あなたはSNS（特にInstagram）の花屋向け投稿キャプションのスタイル分析専門家です。' +
      '与えられた過去キャプション群を分析し、その店舗の文体・絵文字使い・構成・ハッシュタグ戦略を踏襲した' +
      '新規キャプション生成用のシステムプロンプトを日本語で作成してください。' +
      '出力は生成用プロンプトのみで、説明・前置き・後置きは一切不要です。';

    const userMessage = `店舗名: ${tenantName || '（未設定）'}

以下が過去のキャプション例です。

${sampleText}

これらを分析し、新しいお花投稿用キャプションを「同じ店舗が書いたように見えるトーン」で生成するための、AIへの指示文（システムプロンプト）を作成してください。

【生成プロンプトに必ず含めるルール】
1. 入力変数として {purpose}=用途, {color}=色, {vibe}=雰囲気, {appName}=店舗名 を必ず参照する指示
2. {price} 変数があれば文末付近に金額を入れる、なければ金額に触れない、という条件分岐の指示
3. ハッシュタグの数・種類の傾向を真似する指示
4. 絵文字の頻度・種類を真似する指示
5. 文の長さの目安
6. 顧客への感謝表現のトーン

【出力例フォーマット】
「あなたは{appName}という花屋のSNS担当です。以下の条件でキャプションを作成してください...」`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[generate-prompt-from-samples] OpenAI error:', errText);
      return NextResponse.json({ error: `OpenAI API エラー: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const generatedPrompt = data.choices?.[0]?.message?.content?.trim() || '';
    if (!generatedPrompt) {
      return NextResponse.json({ error: 'プロンプト生成に失敗しました' }, { status: 500 });
    }

    // ★ 利用回数カウント（tenantId 指定時のみ）
    let usageInfo = null;
    if (tenantId) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const result = await incrementUsage(supabase, tenantId, 'prompt', { allowOverLimit: true });
        usageInfo = {
          used: result.usage.total,
          freeQuota: result.pricing.freeQuotaPerMonth,
          overage: result.overage,
          overageJpy: result.overage * result.pricing.pricePerExtraJpy,
        };
      } catch (e) {
        console.warn('[generate-prompt] usage count failed', e?.message);
      }
    }

    return NextResponse.json({ prompt: generatedPrompt, usage: usageInfo });
  } catch (err) {
    console.error('[generate-prompt-from-samples] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
