import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // 現在のログイン状態をチェック
  const { data: { session } } = await supabase.auth.getSession()

  // URLが「/staff」で始まり、かつログインしていない場合はログイン画面へ飛ばす
  if (req.nextUrl.pathname.startsWith('/staff') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/staff/:path*'],
}