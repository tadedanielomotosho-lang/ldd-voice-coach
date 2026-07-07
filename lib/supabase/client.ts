import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicEnv } from '@/lib/env'

export function createClient() {
  const { url, anonKey, isConfigured } = getSupabasePublicEnv()
  if (!isConfigured) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  return createBrowserClient(url!, anonKey!)
}
