import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export function formatScore(score: number, max: number = 100): string {
  return `${Math.round(score)}/${max}`
}

export function scoreToPercent(score: number, max: number): number {
  return Math.round((score / max) * 100)
}

export function scoreColor(_percent: number): string {
  return 'text-emerald-600 dark:text-emerald-400'
}

export function scoreBg(_percent: number): string {
  return 'bg-emerald-50 dark:bg-emerald-950'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** Browsers often report e.g. audio/webm;codecs=opus — Supabase storage expects the base type. */
export function normalizeAudioMimeType(type: string): string {
  return type.split(';')[0].trim() || 'audio/webm'
}

/** Supabase joins may return an object or a one-item array depending on query shape. */
export function getJoinedStudent(students: unknown): { name: string } | null {
  if (!students) return null
  if (Array.isArray(students)) {
    const first = students[0] as { name?: string } | undefined
    return first?.name ? { name: first.name } : null
  }
  const row = students as { name?: string }
  return row.name ? { name: row.name } : null
}

export function formatProcessError(message: string): string {
  if (/insufficient_quota|exceeded your current quota|billing/i.test(message)) {
    return 'The OpenAI account is out of credit. Add billing at platform.openai.com, then retry this recording.'
  }
  if (/invalid_api_key|incorrect api key|api key/i.test(message) && /invalid|rejected|missing|not configured/i.test(message)) {
    return 'The OpenAI API key was rejected. Update OPENAI_API_KEY and try again.'
  }
  if (/invalid file format|could not process|unsupported audio|audio file is invalid/i.test(message)) {
    return 'This recording could not be read. Record again in the browser, or upload an MP3 or M4A file.'
  }
  if (/connection error|connect timeout|fetch failed|network|econnreset|etimedout|und_err_connect_timeout|gateway timeout|504/i.test(message)) {
    return 'Could not reach the analysis service. Check your internet connection and try again.'
  }
  const trimmed = message.trim()
  if (trimmed.length > 280) return `${trimmed.slice(0, 277)}…`
  return trimmed
}
