// [Phase2.5-#113] PII 暗号化ユーティリティ（サーバー専用）
//
// 使い方:
//   import { encryptPiiObject, decryptPiiObject } from '@/utils/piiCrypto';
//
//   // 保存前
//   const encrypted = await encryptPiiObject(supabaseAdmin, customerInfo);
//   await supabase.from('orders').insert({ ..., customer_info: encrypted });
//
//   // 読み取り後
//   const plain = await decryptPiiObject(supabaseAdmin, order.customer_info);

/**
 * 平文を暗号化（DB関数 encrypt_pii を呼ぶ）
 * 失敗時は null を返す（PII を平文で保存しないため）
 */
export async function encryptPiiValue(supabaseAdmin, plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  try {
    const { data, error } = await supabaseAdmin.rpc('encrypt_pii', { plain: String(plain) });
    if (error) {
      console.warn('[piiCrypto] encrypt failed');
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * 暗号文を復号
 */
export async function decryptPiiValue(supabaseAdmin, cipher) {
  if (cipher === null || cipher === undefined || cipher === '') return cipher;
  try {
    const { data, error } = await supabaseAdmin.rpc('decrypt_pii', { cipher: String(cipher) });
    if (error) {
      console.warn('[piiCrypto] decrypt failed');
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * 顧客情報オブジェクト全体を暗号化
 * 暗号化対象: phone, email, zip, address1, address2
 * 名前は注文ステータス表示等で頻繁に使うので残す（マスキングで対応）
 */
const PII_FIELDS = ['phone', 'email', 'zip', 'address1', 'address2'];

export async function encryptPiiObject(supabaseAdmin, obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const field of PII_FIELDS) {
    if (result[field]) {
      result[field] = await encryptPiiValue(supabaseAdmin, result[field]);
    }
  }
  return result;
}

export async function decryptPiiObject(supabaseAdmin, obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = { ...obj };
  for (const field of PII_FIELDS) {
    if (result[field]) {
      result[field] = await decryptPiiValue(supabaseAdmin, result[field]);
    }
  }
  return result;
}

/**
 * 後方互換: 既存の平文データが混在する場合も読み出せるよう、
 * decrypt_pii 関数は復号失敗時に元の値をそのまま返す仕様
 */
