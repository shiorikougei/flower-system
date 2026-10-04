// [Phase1-④] プライバシーポリシー
// 個人情報保護法対応。注文フォーム・見積フォームからリンクされる
// [2026-10 B3] 本文は components/PrivacyPolicyContent.jsx。お店ごとのページは /order/{店}/{ショップ}/privacy

import PrivacyPolicyContent from '@/components/PrivacyPolicyContent';

export const metadata = {
  title: 'プライバシーポリシー',
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent />;
}
