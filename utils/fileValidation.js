// [Phase2-⑪] ファイルアップロード検証
// 悪意のあるファイル混入・サーバー負荷攻撃の防御

// 許可するMIMEタイプ（画像のみ）
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

// 許可する拡張子（小文字）
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];

// デフォルトのサイズ上限（10MB）
export const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * 画像ファイルのクライアント側検証
 * @param {File} file - 検証対象のFile
 * @param {object} opts - { maxSizeBytes }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file, opts = {}) {
  if (!file) return { valid: false, error: 'ファイルが選択されていません' };

  const maxSize = opts.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES;

  // サイズチェック
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `ファイルサイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB / 上限 ${(maxSize / 1024 / 1024).toFixed(0)}MB）`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: '空のファイルはアップロードできません' };
  }

  // MIMEタイプチェック
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `画像ファイルのみアップロード可能です（jpg / png / gif / webp / heic）`,
    };
  }

  // 拡張子チェック（MIME偽装対策）
  const fileName = String(file.name || '').toLowerCase();
  const ext = fileName.slice(fileName.lastIndexOf('.'));
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `対応していないファイル形式です（${ext}）`,
    };
  }

  // ファイル名サニタイズ（パストラバーサル防止）
  if (/[\\/]/.test(file.name)) {
    return { valid: false, error: 'ファイル名にスラッシュやバックスラッシュは使用できません' };
  }

  return { valid: true };
}

/**
 * 安全なファイル名を生成
 * 元のファイル名は使わず、タイムスタンプ+ランダム文字列+拡張子
 */
export function generateSafeFileName(originalName) {
  const fileName = String(originalName || '').toLowerCase();
  const ext = fileName.slice(fileName.lastIndexOf('.'));
  // 許可された拡張子のみ採用、それ以外は .bin
  const safeExt = ALLOWED_IMAGE_EXTENSIONS.includes(ext) ? ext : '.bin';
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}_${random}${safeExt}`;
}

/**
 * Supabase Storage アップロード前の共通検証関数
 * @returns {{ ok: boolean, error?: string, safeName?: string }}
 */
export function prepareUpload(file, opts = {}) {
  const validation = validateImageFile(file, opts);
  if (!validation.valid) return { ok: false, error: validation.error };
  return {
    ok: true,
    safeName: generateSafeFileName(file.name),
  };
}
