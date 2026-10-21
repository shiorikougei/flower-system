// [2026-10] 画面に返すエラー文を安全にする
//   - こちらで書いた日本語のエラー文（「入力内容を確認してください」など）は、そのまま画面に出す
//   - データベースや決済サービスの英語のエラー文（表や列の名前、鍵の一部などが入ることがある）は出さず、
//     ふつうの文に置き換える。元のエラーはサーバーの記録（console.error）で確かめる

const JAPANESE = /[぀-ヿ一-鿿]/;
const LEAKY = /(sk_|pk_|rk_|whsec_|api[_ -]?key|secret|token|password|relation|column|violates|constraint|duplicate key|syntax|supabase|postgres|pgrst|stripe|resend|https?:\/\/|select |insert |update |delete |null value|jwt)/i;

export const GENERIC_ERROR = 'エラーが起きました。少しおいてもう一度お試しください';

export function publicErrorMessage(err, fallback = GENERIC_ERROR) {
  const msg = typeof err === 'string' ? err : err?.message;
  if (typeof msg !== 'string' || !msg) return fallback;
  if (!JAPANESE.test(msg)) return fallback;
  if (LEAKY.test(msg)) return fallback;
  return msg.slice(0, 300);
}
