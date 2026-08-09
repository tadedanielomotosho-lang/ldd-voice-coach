import type { PriorAttemptContext } from '@/lib/ai/prompt'
import type { FeedbackItem } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'

function firstTitle(items: FeedbackItem[] | undefined): string | null {
  return items?.[0]?.title?.trim() || null
}

type PriorRow = {
  overall_score: number
  content_score: number
  delivery_score: number
  hook_score: number
  purpose_score: number
  key_points_score: number
  richness_score?: number | null
  cta_score: number
  clarity_score: number
  tone_score: number
  pace_score: number
  pause_score: number
  volume_score: number
  duration_score?: number | null
  created_at: string
  raw_ai_response: unknown
  sessions:
    | { presentation_topic: string | null }
    | { presentation_topic: string | null }[]
    | null
}

export async function fetchPriorAttempt(
  service: ReturnType<typeof createServiceClient>,
  studentId: string | null | undefined,
  currentSessionId: string
): Promise<PriorAttemptContext | null> {
  if (!studentId) return null

  const fullSelect = `
      overall_score, content_score, delivery_score,
      hook_score, purpose_score, key_points_score, richness_score, cta_score, clarity_score,
      tone_score, pace_score, pause_score, volume_score, duration_score,
      created_at, raw_ai_response,
      sessions(presentation_topic)
    `

  const legacySelect = `
      overall_score, content_score, delivery_score,
      hook_score, purpose_score, key_points_score, cta_score, clarity_score,
      tone_score, pace_score, pause_score, volume_score,
      created_at, raw_ai_response,
      sessions(presentation_topic)
    `

  let data: PriorRow | null = null

  const full = await service
    .from('analyses')
    .select(fullSelect)
    .eq('student_id', studentId)
    .neq('session_id', currentSessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!full.error && full.data) {
    data = full.data as PriorRow
  } else {
    const legacy = await service
      .from('analyses')
      .select(legacySelect)
      .eq('student_id', studentId)
      .neq('session_id', currentSessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (legacy.error || !legacy.data) return null
    data = legacy.data as PriorRow
  }

  if (!data) return null

  const raw = data.raw_ai_response as {
    strengths?: FeedbackItem[]
    areas_for_improvement?: FeedbackItem[]
    richness?: { score?: number }
    duration?: { score?: number }
  } | null

  const sessions = data.sessions
  const session = Array.isArray(sessions) ? sessions[0] : sessions

  return {
    overall_score:    Number(data.overall_score),
    content_score:    Number(data.content_score),
    delivery_score:   Number(data.delivery_score),
    hook_score:       Number(data.hook_score),
    purpose_score:    Number(data.purpose_score),
    key_points_score: Number(data.key_points_score),
    richness_score:   Number(data.richness_score ?? raw?.richness?.score ?? 0),
    cta_score:        Number(data.cta_score),
    clarity_score:    Number(data.clarity_score),
    tone_score:       Number(data.tone_score),
    pace_score:       Number(data.pace_score),
    pause_score:      Number(data.pause_score),
    volume_score:     Number(data.volume_score),
    duration_score:   Number(data.duration_score ?? raw?.duration?.score ?? 0),
    topic:            session?.presentation_topic ?? null,
    created_at:       data.created_at,
    top_strength:     firstTitle(raw?.strengths),
    top_improvement:  firstTitle(raw?.areas_for_improvement),
  }
}
