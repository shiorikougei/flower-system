// [SEO-#8] 商品個別ページのOG画像を動的生成
// 1200x630 でSNSシェア時の見栄えを最適化

import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";
export const alt = "商品画像";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProductOgImage({ params }) {
  const { tenantId, productId } = params;

  let product = null;
  let shopName = "FLORIX";
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const [productRes, settingsRes] = await Promise.all([
      supabaseAdmin.from("products").select("name, price, image_url, description")
        .eq("id", productId).eq("tenant_id", tenantId).maybeSingle(),
      supabaseAdmin.from("app_settings").select("settings_data")
        .eq("id", tenantId).maybeSingle(),
    ]);
    product = productRes.data;
    shopName = settingsRes.data?.settings_data?.shops?.[0]?.name || "FLORIX";
  } catch {}

  if (!product) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FBFAF9",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 60, fontWeight: 900, color: "#2D4B3E" }}>FLORIX</div>
        </div>
      ),
      size
    );
  }

  const price = `¥${Number(product.price).toLocaleString()}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#FBFAF9",
          fontFamily: "sans-serif",
        }}
      >
        {/* 左半分: 商品画像 */}
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain", borderRadius: 12 }}
            />
          ) : (
            <div style={{ fontSize: 40, color: "#CCC" }}>🌸</div>
          )}
        </div>
        {/* 右半分: テキスト */}
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px",
            background: "#2D4B3E",
            color: "white",
          }}
        >
          <div style={{ fontSize: 22, opacity: 0.8, marginBottom: 12 }}>{shopName}</div>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.2, marginBottom: 24 }}>
            {String(product.name || "").slice(0, 30)}
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, color: "#FFC107" }}>{price}</div>
          <div style={{ fontSize: 16, opacity: 0.7, marginTop: 32 }}>
            ご注文・お見積もりはWebから
          </div>
        </div>
      </div>
    ),
    size
  );
}
