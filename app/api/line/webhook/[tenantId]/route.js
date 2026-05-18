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
  // ★ LINE は webhook 検証時に約10秒以内の200応答を求める。
  //   タイムアウト回避のため、検証用の空イベント・設定未完了時も 200 で返す
  //   （本処理は events がある場合のみ実行）
  try {
    const { tenantId } = await params;
    if (!tenantId) {
      console.warn('[line/webhook] no tenantId');
      return NextResponse.json({ ok: true }); // 検証ボタン用に200返却
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-line-signature') || '';

    // ★ 早期判定: 空ボディ / events なし → LINE検証リクエスト等。即200を返す
    let payload;
    try {
      payload = rawBody ? JSON.parse(rawBody) : { events: [] };
    } catch {
      payload = { events: [] };
    }
    const events = payload.events || [];

    // 検証ボタンからのテストは events が空。即座に200返却
    if (events.length === 0) {
      return NextResponse.json({ ok: true });
    }

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

    // ★サブスクで LINE連携 が未契約のテナント / 設定未完了でも 200を返す（再送ループ防止）
    const features = settingsRow?.settings_data?.features || {};
    if (!features.lineIntegration) {
      console.warn('[line/webhook] subscription feature lineIntegration disabled for', tenantId);
      return NextResponse.json({ ok: true, skipped: 'feature_disabled' });
    }

    const lineCfg = settingsRow?.settings_data?.lineConfig || {};
    const channelSecret = lineCfg.channelSecret || '';
    const channelAccessToken = lineCfg.channelAccessToken || '';

    if (!channelSecret || !channelAccessToken) {
      console.warn('[line/webhook] LINE config not set for tenant', tenantId);
      return NextResponse.json({ ok: true, skipped: 'config_missing' });
    }

    // 署名検証
    if (!verifyLineSignature(channelSecret, rawBody, signature)) {
      // 署名不正は不正アクセスの可能性ありなのでログだけ、200は返す（LINE側の自動リトライ抑制）
      console.warn('[line/webhook] signature mismatch for', tenantId);
      return NextResponse.json({ ok: true, skipped: 'signature_invalid' });
    }

    for (const ev of events) {
      const lineUserId = ev.source?.userId;
      if (!lineUserId) continue;

      // 友達追加 (follow) → 自動応答なし
      //   ※ LINE公式マネージャー側のあいさつメッセージで店舗案内を行う
      //   ※ お客様がリッチメニュー「連携」を押した場合のみメアド登録案内を流す
      if (ev.type === 'follow') {
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

      // ★ Postback イベント (リッチメニューのボタン等)
      //   data=action=link_email の場合のみメアド登録案内を返信
      //   ※ 通常のテキストメッセージとは別枠なので、自然文に巻き込まれる心配なし
      if (ev.type === 'postback') {
        const data = ev.postback?.data || '';
        if (data === 'action=link_email' || data.includes('action=link')) {
          await replyText(
            ev.replyToken,
            channelAccessToken,
            '📩 ご注文の進捗をこのトークで受け取るには、\n' +
            'ご登録の【メールアドレス】を送信してください。\n\n' +
            '例: example@gmail.com\n\n' +
            '（オンライン注文歴がなくても、お電話/店頭注文のお客様も登録可能です）'
          );
        } else if (data === 'action=unlink' || data.includes('action=stop')) {
          await supabaseAdmin
            .from('customer_line_links')
            .update({ is_active: false })
            .eq('tenant_id', tenantId)
            .eq('line_user_id', lineUserId);
          await replyText(
            ev.replyToken,
            channelAccessToken,
            'LINE通知を停止しました。\n再開したい場合はリッチメニューの「LINE連携」ボタンをタップしてください。'
          );
        }
        continue;
      }

      // メッセージ受信 → 内容で分岐
      if (ev.type === 'message' && ev.message?.type === 'text') {
        const text = String(ev.message.text || '').trim();
        const m = text.match(EMAIL_RE);
        if (m) {
          const email = m[0].toLowerCase();
          const profile = await fetchProfile(channelAccessToken, lineUserId);

          // 過去注文があるか確認 (案内文分岐のため - 連携自体は過去注文なしでも実行)
          const { data: orders } = await supabaseAdmin
            .from('orders')
            .select('id, order_data')
            .eq('tenant_id', tenantId)
            .limit(50);
          const hasOrder = (orders || []).some(
            o => o.order_data?.customerInfo?.email?.toLowerCase() === email
          );

          // ★ 同じemailで紐付いている他のline_user_id（旧LINE）を全て無効化
          //    LINEアカウント変更時、旧アカウントへの通知を止めるため
          await supabaseAdmin
            .from('customer_line_links')
            .update({ is_active: false })
            .eq('tenant_id', tenantId)
            .eq('customer_email', email)
            .neq('line_user_id', lineUserId);

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

          // ★ 過去注文の有無で案内文を変える
          const replyMsg = hasOrder
            ? `${email} とLINE連携しました 🎉\n\n` +
              'これまでのご注文を確認しました。\n' +
              'ご注文の進捗・完成写真などを今後こちらのトークにもお届けします💐\n\n' +
              'いつでも「停止」と送信していただければ通知を停止できます。'
            : `${email} を登録しました 🌸\n\n` +
              'こちらのメールアドレスでのご注文履歴はまだありませんが、\n' +
              '次回ご注文時から進捗をこのトークにお届けします。\n\n' +
              'お電話・ご来店でご注文の際は、ご登録のメールアドレスを\n' +
              'スタッフへお伝えください。\n\n' +
              'いつでも「停止」と送信していただければ通知を停止できます。';
          await replyText(ev.replyToken, channelAccessToken, replyMsg);
        } else if (text === '📧 LINE連携を希望します' || text === '📧 LINE通知を登録する') {
          // ★ リッチメニュー「テキスト」アクション専用の固有文字列に完全一致した場合のみ
          //   (LINE公式マネージャーUIにはポストバックが無いので、ユニーク文字列の完全一致で代替)
          await replyText(
            ev.replyToken,
            channelAccessToken,
            '📩 ご注文の進捗をこのトークで受け取るには、\n' +
            'ご登録の【メールアドレス】を送信してください。\n\n' +
            '例: example@gmail.com\n\n' +
            '（オンライン注文歴がなくても、お電話/店頭注文のお客様も登録可能です）'
          );
        }
        // ★ それ以外の任意のテキスト → 自動応答なし
        //   通常のお問い合わせは店舗スタッフが手動で対応します
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // ★ 例外時も200を返してLINEの再送ループを防ぐ (本番のエラーログには記録)
    console.error('[line/webhook] error:', err);
    return NextResponse.json({ ok: true, error: err.message || 'サーバーエラー' });
  }
}
