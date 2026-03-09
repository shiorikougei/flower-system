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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ログイン画面そのもの（/staff/login）へのアクセスは許可する
  const isLoginPage = request.nextUrl.pathname === '/staff/login'

  // staff ページにアクセスしようとしていて、かつログインしていない場合
  if (request.nextUrl.pathname.startsWith('/staff') && !isLoginPage && !user) {
    // 修正ポイント：'/staff/login' へ飛ばすように変更！
    return NextResponse.redirect(new URL('/staff/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/staff/:path*'],
}