import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicEnv, getSupabaseConfigError, cleanEnvValue } from '@/lib/env'

type CookieToSet = {
  name: string
  value: string
  options?: Parameters<NextResponse['cookies']['set']>[2]
}

export async function createClient() {
  const configError = getSupabaseConfigError()
  if (configError) throw new Error(configError)

  const { url, anonKey } = getSupabasePublicEnv()
  const cookieStore = await cookies()
  return createServerClient(url!, anonKey!, {
      cookies: {
        getAll()            { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export function createServiceClient() {
  const { url } = getSupabasePublicEnv()
  const serviceKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase server credentials')
  }
  return createSupabaseClient(url, serviceKey, { auth: { persistSession: false } })
}

/** Use in Route Handlers so auth cookies refresh on API requests (middleware skips /api). */
export function createRouteHandlerClient(request: NextRequest) {
  const configError = getSupabaseConfigError()
  if (configError) throw new Error(configError)

  const { url, anonKey } = getSupabasePublicEnv()
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(url!, anonKey!, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  function attachCookies(response: NextResponse) {
    supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
      response.cookies.set(name, value)
    })
    return response
  }

  return { supabase, attachCookies }
}
