import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

// ここを 'middleware' から 'proxy' に変更しました！
export async function proxy(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session } } = await supabase.auth.getSession()

  // /staff で始まるページに未ログインでアクセスしたらログイン画面へ
  if (req.nextUrl.pathname.startsWith('/staff') && !session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return res
}

export const config = {
  matcher: ['/staff/:path*'],
}