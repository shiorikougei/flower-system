// [SEO-#22] パンくずナビ + Breadcrumb 構造化データ
//
// 使い方:
//   <Breadcrumbs items={[
//     { label: '店舗トップ', href: '/order/[tid]/[sid]' },
//     { label: '商品一覧', href: '/order/[tid]/[sid]/shop' },
//     { label: 'カート' }  // 最後はリンクなし
//   ]} />

import Link from "next/link";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null;

  // JSON-LD用
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.label,
      item: item.href ? `${BASE_URL}${item.href}` : undefined,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav
        className="text-[11px] text-[#999] mb-4 flex items-center gap-1 flex-wrap"
        aria-label="パンくずリスト"
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <span key={idx} className="flex items-center gap-1">
              {!isLast && item.href ? (
                <Link href={item.href} className="hover:text-[#2D4B3E] hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="text-[#555] font-bold" aria-current="page">
                  {item.label}
                </span>
              )}
              {!isLast && <span className="text-[#CCC]">/</span>}
            </span>
          );
        })}
      </nav>
    </>
  );
}
