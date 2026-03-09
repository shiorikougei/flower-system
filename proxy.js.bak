import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value, options))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // 【重要】getUser() ではなく getSession() を使うほうが、ログイン直後は安定します
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // 1. ログイン画面自体へのアクセスは、常に許可
  if (pathname === '/staff/login') {
    return response
  }

  // 2. /staff 以下のページにアクセスしようとしていて、セッション（鍵）がない場合のみリダイレクト
  if (pathname.startsWith('/staff') && !session) {
    // ログインページへ飛ばす
    const url = request.nextUrl.clone()
    url.pathname = '/staff/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/staff/:path*'],
}