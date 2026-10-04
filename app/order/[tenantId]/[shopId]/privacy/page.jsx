// [2026-10 B3] お店ごとのプライバシーポリシー
// /order/[tenantId]/[shopId]/privacy
// お問い合わせ窓口に、店舗設定の「お問い合わせ用メールアドレス」と電話番号を表示する

import { createClient } from '@supabase/supabase-js';
import PrivacyPolicyContent from '@/components/PrivacyPolicyContent';
import { shopContactInfo } from '@/utils/email';

export const revalidate = 600;

async function getShop(tenantId, shopId) {
  try {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('settings_data')
      .eq('id', String(tenantId).toLowerCase())
      .maybeSingle();
    const info = shopContactInfo(data?.settings_data || {}, shopId);
    return { name: info.shopName, contactEmail: info.shopEmail, phone: info.shopPhone };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { tenantId, shopId } = await params;
  const shop = await getShop(tenantId, shopId);
  return { title: `プライバシーポリシー | ${shop?.name || 'FLORIX'}` };
}

export default async function ShopPrivacyPage({ params }) {
  const { tenantId, shopId } = await params;
  const shop = await getShop(tenantId, shopId);
  return <PrivacyPolicyContent shop={shop} />;
}
