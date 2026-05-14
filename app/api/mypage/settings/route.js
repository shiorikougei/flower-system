// マイページ用の店舗設定取得（領収書発行で店舗名・住所等を使うため）
// GET /api/mypage/settings?tenantId=xxx
// セキュリティ: 公開可能な情報（generalConfig, shops[*]）のみ返す

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId が必要' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', tenantId)
      .single();
    const s = data?.settings_data || {};

    // 公開してOKな項目だけ返す
    return NextResponse.json({
      settings: {
        generalConfig: {
          appName: s.generalConfig?.appName || '',
          logoUrl: s.generalConfig?.logoUrl || '',
          receiptStamp: s.generalConfig?.receiptStamp || { mode: 'auto', imageUrl: '' },
        },
        shops: (s.shops || []).map(sh => ({
          id: sh.id,
          name: sh.name,
          address: sh.address,
          phone: sh.phone,
          invoiceNumber: sh.invoiceNumber,
        })),
        // LINE 連携の有効状態と友達追加URLのみ公開（トークン等は秘匿）
        lineConfig: {
          enabled: Boolean(s.lineConfig?.enabled),
          addFriendUrl: s.lineConfig?.addFriendUrl || '',
        },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'サーバーエラー' }, { status: 500 });
  }
}
