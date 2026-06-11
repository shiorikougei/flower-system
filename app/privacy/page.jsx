// [Phase1-④] プライバシーポリシー
// 個人情報保護法対応。注文フォーム・見積フォームからリンクされる

export const metadata = {
  title: 'プライバシーポリシー',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FBFAF9] py-12 px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-[#EAEAEA] p-8 md:p-12 shadow-sm">
        <h1 className="text-[24px] md:text-[28px] font-bold text-[#2D4B3E] mb-2">プライバシーポリシー</h1>
        <p className="text-[11px] text-[#999] mb-8">最終改訂日: 2026年6月11日</p>

        <Section title="1. 個人情報の取得">
          <p>本サービス（以下「当サービス」）では、お客様が花の注文・お見積もり依頼・お問い合わせをご利用いただく際に、以下の個人情報を取得します。</p>
          <ul>
            <li>お名前（注文者・お届け先）</li>
            <li>メールアドレス</li>
            <li>電話番号</li>
            <li>郵便番号・住所</li>
            <li>注文内容（用途・カラー・お届け日時など）</li>
            <li>LINE連携をご利用の場合、LINEユーザーID・表示名</li>
            <li>クレジットカード決済をご利用の場合、決済処理に必要な情報（Stripe社が処理し、当サービスはカード番号自体を保持しません）</li>
          </ul>
        </Section>

        <Section title="2. 個人情報の利用目的">
          <p>取得した個人情報は、以下の目的でのみ利用します。</p>
          <ul>
            <li>ご注文・お見積もり依頼の受付およびお届け対応</li>
            <li>注文確認・進捗報告・完成写真送付などのご連絡</li>
            <li>決済処理（クレジットカード決済時）</li>
            <li>お客様からのお問い合わせへの対応</li>
            <li>商品入荷お知らせのご案内（ご希望の方のみ）</li>
            <li>サービス改善のための統計分析（個人を特定できない形に加工）</li>
          </ul>
        </Section>

        <Section title="3. 個人情報の第三者提供">
          <p>当サービスは、お客様の個人情報を以下の場合を除き、第三者に提供しません。</p>
          <ul>
            <li>お客様の同意がある場合</li>
            <li>商品お届けのため、配送業者（佐川急便等）に必要な情報を提供する場合</li>
            <li>クレジットカード決済処理のため、Stripe社（決済代行業者）に必要な情報を提供する場合</li>
            <li>メール送信のため、Resend社（メール配信業者）に必要な情報を提供する場合</li>
            <li>法令に基づき開示が求められた場合</li>
          </ul>
        </Section>

        <Section title="4. 個人情報の保管・管理">
          <p>取得した個人情報は、適切な安全管理措置を講じて保管します。</p>
          <ul>
            <li>SSL/TLSによる通信の暗号化</li>
            <li>データベースのアクセス権限を最小限に制限</li>
            <li>不要となった個人情報は速やかに削除</li>
            <li>定期的なセキュリティレビューの実施</li>
          </ul>
        </Section>

        <Section title="5. お客様の権利（開示・訂正・削除）">
          <p>お客様は、ご自身の個人情報について以下を請求できます。</p>
          <ul>
            <li><strong>開示請求</strong>: 当サービスが保有しているお客様の情報の開示</li>
            <li><strong>訂正請求</strong>: 情報が誤っている場合の訂正</li>
            <li><strong>利用停止・削除請求</strong>: 個人情報の利用停止または削除</li>
            <li><strong>第三者提供の停止請求</strong>: 第三者提供の停止</li>
          </ul>
          <p>ご請求の際は、ご利用のお花屋さんまでメール・お電話にてご連絡ください。本人確認の上、原則として 14 日以内にご対応します。</p>
        </Section>

        <Section title="6. Cookieおよびアクセス解析">
          <p>当サービスは、利便性向上のためCookieを使用する場合があります。Cookieによってお客様個人が識別されることはありません。ブラウザの設定でCookieを無効化することも可能です。</p>
        </Section>

        <Section title="7. お子さまの個人情報">
          <p>当サービスは、原則として18歳未満のお客様から個人情報を取得しません。お子さまが保護者の同意なく個人情報を提供したことが判明した場合、速やかに削除します。</p>
        </Section>

        <Section title="8. プライバシーポリシーの変更">
          <p>本プライバシーポリシーは、必要に応じて変更することがあります。重要な変更がある場合は、当サービス上で告知します。</p>
        </Section>

        <Section title="9. お問い合わせ窓口">
          <p>本プライバシーポリシーに関するお問い合わせ、個人情報の取り扱いに関するご質問は、ご利用のお花屋さんまたは以下の窓口までご連絡ください。</p>
          <div className="bg-[#FBFAF9] rounded-xl p-4 mt-3 border border-[#EAEAEA]">
            <p className="font-bold">運営: NocoLde</p>
            <p>サービス名: FLORIX</p>
            <p>お問い合わせ: marusyou.reishin@gmail.com</p>
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-[16px] md:text-[18px] font-bold text-[#2D4B3E] border-b border-[#EAEAEA] pb-2 mb-3">
        {title}
      </h2>
      <div className="text-[13px] text-[#333] leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:my-2">
        {children}
      </div>
    </section>
  );
}
