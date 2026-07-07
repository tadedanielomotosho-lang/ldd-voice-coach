export function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '')
  return trimmed || undefined
}

export function getSupabasePublicEnv() {
  const url = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  let isValidUrl = false
  if (url) {
    try {
      const parsed = new URL(url)
      isValidUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      isValidUrl = false
    }
  }

  return {
    url,
    anonKey,
    isConfigured: Boolean(isValidUrl && anonKey),
  }
}
