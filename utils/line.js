// LINE Messaging API ユーティリティ
// ---------------------------------------------------------------
// 各店舗の Channel Access Token を使って、特定の LINE user_id に
// プッシュメッセージを送る。
//
// 使用箇所:
//   - app/api/orders/route.js  （注文確定）
//   - app/api/stripe/webhook/route.js （決済完了）
//   - app/api/staff/send-template-email/route.js （手動送信）
//
// 重要: いずれもメール送信と同時に「LINE併送」を行う設計。
//      設定で LINE が無効なら自動的にスキップする。

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

/**
 * テナントの LINE 設定を取得
 *   { enabled, channelAccessToken, channelSecret, channelId, addFriendUrl }
 *
 * ★サブスク機能 `lineIntegration` がOFFのテナントは強制的に enabled=false にする
 *   （既存のlineConfig.enabledチェック箇所を改修せずにゲーティングできる）
 */
export function getLineConfig(settings) {
  const cfg = settings?.lineConfig || {};
  const features = settings?.features || {};
  const subscriptionEnabled = Boolean(features.lineIntegration);
  return {
    enabled: subscriptionEnabled && Boolean(cfg.enabled),
    subscriptionEnabled,                                // サブスクで有効化されているか
    channelAccessToken: cfg.channelAccessToken || '',
    channelSecret: cfg.channelSecret || '',
    channelId: cfg.channelId || '',
    addFriendUrl: cfg.addFriendUrl || '',
  };
}

/**
 * 特定の LINE user_id にテキストメッセージを送信
 *   - 失敗してもエラーは投げず、{ ok: false, error } を返す（メール送信を止めないため）
 */
export async function sendLinePush({ channelAccessToken, to, text, altText }) {
  if (!channelAccessToken || !to || !text) {
    return { ok: false, error: 'channelAccessToken/to/text 必須' };
  }
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to,
        messages: [
          {
            type: 'text',
            text: String(text).slice(0, 4000), // LINE仕様で4000文字以内
          },
        ],
        notificationDisabled: false,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.warn('[line/push] failed:', res.status, errBody);
      return { ok: false, error: `LINE API ${res.status}: ${errBody}` };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[line/push] error:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * 画像メッセージを送信（完成写真メール時に使用）
 */
export async function sendLineImage({ channelAccessToken, to, imageUrl, altText }) {
  if (!channelAccessToken || !to || !imageUrl) {
    return { ok: false, error: 'channelAccessToken/to/imageUrl 必須' };
  }
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to,
        messages: [
          {
            type: 'image',
            originalContentUrl: imageUrl,
            previewImageUrl: imageUrl,
          },
        ],
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `LINE API ${res.status}: ${errBody}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Webhook 署名検証用（LINE仕様）
 */
import crypto from 'crypto';
export function verifyLineSignature(channelSecret, body, signature) {
  if (!channelSecret || !signature) return false;
  const computed = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  return computed === signature;
}

/**
 * テナントとメールアドレスから、紐付けされたアクティブなLINE user_id を取得
 *   見つからなければ null
 */
export async function findLineUserId(supabaseAdmin, tenantId, email) {
  if (!tenantId || !email) return null;
  const { data } = await supabaseAdmin
    .from('customer_line_links')
    .select('line_user_id')
    .eq('tenant_id', tenantId)
    .eq('customer_email', String(email).toLowerCase())
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data?.line_user_id || null;
}

/**
 * メール送信と同時にLINEへも併送する高レベル関数
 *   - lineConfig.enabled でなければ何もしない
 *   - 紐付け user_id がなければ何もしない
 */
export async function sendLineParallelToEmail({
  supabaseAdmin,
  tenantSettings,
  tenantId,
  customerEmail,
  text,
  imageUrl,
}) {
  const cfg = getLineConfig(tenantSettings);
  if (!cfg.enabled || !cfg.channelAccessToken) return { skipped: true, reason: 'disabled' };

  const lineUserId = await findLineUserId(supabaseAdmin, tenantId, customerEmail);
  if (!lineUserId) return { skipped: true, reason: 'not_linked' };

  // テキスト送信
  const textResult = await sendLinePush({
    channelAccessToken: cfg.channelAccessToken,
    to: lineUserId,
    text,
  });

  // 画像も付ける場合
  if (imageUrl && textResult.ok) {
    await sendLineImage({
      channelAccessToken: cfg.channelAccessToken,
      to: lineUserId,
      imageUrl,
    });
  }

  return textResult;
}
