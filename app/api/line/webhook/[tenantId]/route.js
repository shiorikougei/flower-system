// LINE Webhook受信
// POST /api/line/webhook/[tenantId]
//
// 各店舗が LINE Developers でこの URL を Webhook URL に設定する
//   例: https://noodleflorix.com/api/line/webhook/<tenantId>
//
// 処理:
//   1. 署名検証 (Channel Secret)
//   2. follow イベント → ユーザーに「メールアドレス送ってね」と返信
//   3. message イベント → メールっぽい文字列なら customer_line_links に紐付け保存
//
// セキュリティ: 各テナントのCannel Secret を使った署名検証必須

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyLineSignature, sendLinePush } from '@/utils/line';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// メールアドレス検出
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

async function replyText(replyToken, channelAccessToken, text) {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }],
      }),
    });
  } catch (e) {
    console.warn('[line/webhook] reply failed', e.message);
  }
}

async function fetchProfile(channelAccessToken, lineUserId) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${channelAccessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function POST(request, { params }) {
  try {
    const { tenantId } = await params;
    if (!tenantId) return NextResponse.json({ error: 'tenantId必要' }, { status: 400 });

    const rawBody = await request.text();
    const signature = request.headers.get('x-line-signature') || '';

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 設定取得
    const { data: settingsRow } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const lineCfg = settingsRow?.settings_data?.lineConfig || {};
    const channelSecret = lineCfg.channelSecret || '';
    const channelAccessToken = lineCfg.channelAccessToken || '';

    if (!channelSecret || !channelAccessToken) {
      console.warn('[line/webhook] LINE config not set for tenant', tenantId);
      return NextResponse.json({ error: 'LINE未設定' }, { status: 400 });
    }

    // 署名検証
    if (!verifyLineSignature(channelSecret, rawBody, signature)) {
      return NextResponse.json({ error: '署名不正' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const events = payload.events || [];

    for (const ev of events) {
      const lineUserId = ev.source?.userId;
      if (!lineUserId) continue;

      // 友達追加 (follow)
      if (ev.type === 'follow') {
        const profile = await fetchProfile(channelAccessToken, lineUserId);
        await replyText(
          ev.replyToken,
          channelAccessToken,
          `${profile?.displayName || ''}さん、友だち追加ありがとうございます🌸\n\n` +
          'こちらでご注文の進捗をお届けするには、ご注文時にご登録いただいた\n' +
          '【メールアドレス】を このトークに送信してください。\n\n' +
          '例: example@gmail.com'
        );
        continue;
      }

      // ブロック (unfollow) → is_active=false
      if (ev.type === 'unfollow') {
        await supabaseAdmin
          .from('customer_line_links')
          .update({ is_active: false })
          .eq('tenant_id', tenantId)
          .eq('line_user_id', lineUserId);
        continue;
      }

      // メッセージ受信 → メール検出
      if (ev.type === 'message' && ev.message?.type === 'text') {
        const text = String(ev.message.text || '').trim();
        const m = text.match(EMAIL_RE);
        if (m) {
          const email = m[0].toLowerCase();
          const profile = await fetchProfile(channelAccessToken, lineUserId);

          // 過去注文があるか確認（簡易バリデーション）
          const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('id, order_data')
            .eq('tenant_id', tenantId)
            .limit(20);
          const hasOrder = (orders || []).some(
            o => o.order_data?.customerInfo?.email?.toLowerCase() === email
          );

          if (!hasOrder) {
            await replyText(
              ev.replyToken,
              channelAccessToken,
              `「${email}」でのご注文が見つかりません。\n` +
              'ご注文時にお使いになったメールアドレスをご確認ください。'
            );
            continue;
          }

          // upsert（既存なら更新）
          await supabaseAdmin
            .from('customer_line_links')
            .upsert(
              {
                tenant_id: tenantId,
                line_user_id: lineUserId,
                customer_email: email,
                display_name: profile?.displayName || null,
                is_active: true,
                linked_at: new Date().toISOString(),
                last_message_at: new Date().toISOString(),
              },
              { onConflict: 'tenant_id,line_user_id' }
            );

          await replyText(
            ev.replyToken,
            channelAccessToken,
            `${email} とLINEを連携しました 🎉\n\n` +
            'これからご注文の進捗・完成写真などをこちらのトークにもお届けします💐\n' +
            'いつでも「停止」と送信していただければ通知を停止できます。'
          );
        } else if (text === '停止' || text.toLowerCase() === 'stop') {
          // 連携解除
          await supabaseAdmin
            .from('customer_line_links')
            .update({ is_active: false })
            .eq('tenant_id', tenantId)
            .eq('line_user_id', lineUserId);
          await replyText(
            ev.replyToken,
            channelAccessToken,
            'LINE通知を停止しました。\n再開したい場合はもう一度メールアドレスを送信してください。'
          );
        } else {
          await replyText(
            ev.replyToken,
            channelAccessToken,
            'ご注文の進捗をお届けするには、ご注文時のメールアドレスを送信してください。\n例: example@gmail.com'
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[line/webhook] error:', err);
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
