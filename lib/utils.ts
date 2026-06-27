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
