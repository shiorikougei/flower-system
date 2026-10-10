// [セキュリティ 2026-10] 外部の URL をサーバーから読みに行くときの安全な取得
// - http(s) だけ
// - 社内・ローカルのアドレス（127.x / 10.x / 192.168.x / 169.254.x など）には行かない（SSRF 対策）
// - リダイレクトは毎回あて先を確かめて最大 3 回まで
// - 時間（8 秒）と大きさ（2MB）の上限

import dns from 'dns/promises';
import net from 'net';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return false;
}

async function assertPublicUrl(u) {
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('http/https のみ対応');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new Error('このアドレスには接続できません');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateAddress(a.address))) throw new Error('このアドレスには接続できません');
}

export async function safeFetchText(rawUrl, { headers = {} } = {}) {
  let current = new URL(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(current.toString(), { headers, redirect: 'manual', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current);
      continue;
    }
    if (!res.ok || !res.body) return '';
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) { try { await reader.cancel(); } catch {} break; }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c))));
  }
  throw new Error('リダイレクトが多すぎます');
}
