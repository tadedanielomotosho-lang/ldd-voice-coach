import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicEnv } from '@/lib/env'

export async function middleware(request: NextRequest) {
  const { url, anonKey, isConfigured } = getSupabasePublicEnv()

  if (!isConfigured) {
    console.error(
      '[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Add them in Vercel → Settings → Environment Variables, then redeploy.'
    )
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(url!, anonKey!, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof supabaseResponse.cookies.set>[2] }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    const { pathname } = request.nextUrl

    const appRoutes = ['/dashboard', '/students', '/studio', '/upload', '/reports']
    const isAppRoute = appRoutes.some(r => pathname.startsWith(r))

    if (isAppRoute && !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if ((pathname === '/login' || pathname === '/signup') && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  } catch (err) {
    console.error('[middleware] auth check failed:', err)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/students/:path*',
    '/studio/:path*',
    '/upload/:path*',
    '/reports/:path*',
    '/login',
    '/signup',
    '/reset-password',
    '/update-password',
  ],
}
