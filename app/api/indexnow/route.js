// [GEO-5] IndexNow ping API
// 認証済みユーザのみ叩ける（cookie + tenantスコープ）
//
// POST /api/indexnow
// body: { urls: string[] }

import { NextResponse } from "next/server";
import { pingIndexNow } from "@/utils/indexNow";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const { urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ ok: false, error: "urls required" }, { status: 400 });
    }
    if (urls.length > 10000) {
      return NextResponse.json({ ok: false, error: "too many urls (max 10000)" }, { status: 400 });
    }

    // 認証チェック（スタッフセッションを確認）
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const result = await pingIndexNow(urls);
    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      submitted: urls.length,
      error: result.error,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e?.message || "internal error" }, { status: 500 });
  }
}
