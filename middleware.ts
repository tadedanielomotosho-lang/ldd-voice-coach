import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabasePublicEnv } from '@/lib/env'

/** Refresh Supabase auth cookies on each request — required for sign-in to work in production. */
export async function middleware(request: NextRequest) {
  const { url, anonKey, isConfigured } = getSupabasePublicEnv()
  if (!isConfigured) return NextResponse.next({ request })

  let supabaseResponse = NextResponse.next({ request })

  try {
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

    await supabase.auth.getUser()
  } catch (err) {
    console.error('[middleware] session refresh failed:', err)
  }

  return supabaseResponse
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
    '/api/:path*',
  ],
}
