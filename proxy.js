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

  const { pathname } = request.nextUrl
  
  // ログイン画面そのものへのアクセスは許可
  if (pathname === '/staff/login') return response

  // /staff で始まるページかつ未ログインなら、/staff/login へ飛ばす
  if (pathname.startsWith('/staff') && !user) {
    return NextResponse.redirect(new URL('/staff/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/staff/:path*'],
}