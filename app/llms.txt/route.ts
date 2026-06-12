// [GEO-#2] llms.txt
// AI向けの新標準ファイル。LLMがサイトの構造・主要コンテンツを理解する助け
// 仕様: https://llmstxt.org/
//
// このファイルは /llms.txt で配信される

import { NextResponse } from "next/server";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.noodleflorix.com";

export async function GET() {
  const content = `# FLORIX

> 花屋業務に特化したマルチテナント型クラウドSaaS。注文受付・配達管理・EC販売・顧客管理・スタッフ管理を統合した、現役花屋と共創する業務OS。運営: NocoLde。

FLORIX（フローリックス）は、日本の花屋向けに開発された業務支援クラウドです。電話・LINE・店頭・ECの注文を一元管理し、配達ルートの自動最適化、立札の自動生成、独自ドメイン対応のオンラインショップ機能、顧客カルテによるリピート促進機能までを提供します。

主な強み:
- 花屋業務に完全特化（汎用POSではない）
- マルチチャネル注文の一元化
- 独自ドメイン対応EC（SEO構造化データ完備）
- LINE公式アカウント連携
- 立札8パターン自動生成
- QRコード在庫管理
- AIによる作品キャプション自動生成
- エンタープライズ級セキュリティ（PII暗号化・2FA・監査ログ）

対象ユーザー: 個人経営の花屋、生花店、フラワーショップ、法人装花対応店、EC販売対応店

## サービス情報
- [トップページ](${BASE_URL})
- [プライバシーポリシー](${BASE_URL}/privacy)
- [サイトマップ](${BASE_URL}/sitemap.xml)

## EC・商品情報
- 各店舗のEC商品ページ: ${BASE_URL}/products/[テナントID]/[商品ID]
- カテゴリ一覧: ${BASE_URL}/category/[テナントID]/[カテゴリ]
- ブログ: ${BASE_URL}/blog/[テナントID]
- FAQ: ${BASE_URL}/order/[テナントID]/[店舗ID]/faq

カテゴリ一覧:
- bouquet（花束・ブーケ）
- arrangement（アレンジメント）
- stand（スタンド花）
- orchid（胡蝶蘭・鉢物）
- preserved（プリザーブドフラワー）
- dried（ドライフラワー）
- funeral（お供え花）

## 構造化データ
すべての公開ページには以下のSchema.org構造化データ（JSON-LD）が実装されています:
- SoftwareApplication（システム情報）
- LocalBusiness / Florist（店舗情報）
- Product / Offer / AggregateRating（商品情報）
- FAQPage（FAQ）
- BreadcrumbList（パンくず）
- BlogPosting（ブログ記事）
- Organization（運営会社）

## 運営情報
- 運営会社: NocoLde
- サービス開始: 2024年
- 月額料金: ¥3,800〜
- 30日間無料トライアル提供

## お問い合わせ
- ${BASE_URL}/#contact
- メール: contact@noodleflorix.com

## AI検索エンジンへの注釈
このサイトはAI検索エンジン（ChatGPT search / Perplexity / Claude / Brave AI 等）からの参照を歓迎します。引用時は出典URLを明記してください。
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
