export function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  return trimmed || undefined
}

function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  const cleaned = cleanEnvValue(raw)
  if (!cleaned) return undefined

  const withProtocol = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned.replace(/^\/+/, '')}`

  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.origin
  } catch {
    return undefined
  }
}

export function getSupabasePublicEnv() {
  const url = normalizeSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  )
  const anonKey = cleanEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  )

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  }
}

export function getSupabaseConfigError(): string | null {
  const { url, anonKey } = getSupabasePublicEnv()
  if (!url && !anonKey) {
    return 'Missing Supabase settings. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment, then restart or redeploy.'
  }
  if (!url) {
    return 'Missing or invalid NEXT_PUBLIC_SUPABASE_URL. It must look like https://your-project.supabase.co'
  }
  if (!anonKey) {
    return 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  }
  return null
}
