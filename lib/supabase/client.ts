import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseConfigError, getSupabasePublicEnv } from '@/lib/env'

export function createClient() {
  const configError = getSupabaseConfigError()
  if (configError) throw new Error(configError)

  const { url, anonKey } = getSupabasePublicEnv()
  return createBrowserClient(url!, anonKey!)
}
