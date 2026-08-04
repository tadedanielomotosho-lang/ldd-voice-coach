import type { PriorAttemptContext } from '@/lib/ai/prompt'
import type { FeedbackItem } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'

function firstTitle(items: FeedbackItem[] | undefined): string | null {
  return items?.[0]?.title?.trim() || null
}

export async function fetchPriorAttempt(
  service: ReturnType<typeof createServiceClient>,
  studentId: string | null | undefined,
  currentSessionId: string
): Promise<PriorAttemptContext | null> {
  if (!studentId) return null

  const { data, error } = await service
    .from('analyses')
    .select(`
      overall_score, content_score, delivery_score,
      hook_score, purpose_score, key_points_score, cta_score, clarity_score,
      tone_score, pace_score, pause_score, volume_score,
      created_at, raw_ai_response,
      sessions(presentation_topic)
    `)
    .eq('student_id', studentId)
    .neq('session_id', currentSessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const raw = data.raw_ai_response as {
    strengths?: FeedbackItem[]
    areas_for_improvement?: FeedbackItem[]
  } | null

  const sessions = data.sessions as
    | { presentation_topic: string | null }
    | { presentation_topic: string | null }[]
    | null
  const session = Array.isArray(sessions) ? sessions[0] : sessions

  return {
    overall_score:    Number(data.overall_score),
    content_score:    Number(data.content_score),
    delivery_score:   Number(data.delivery_score),
    hook_score:       Number(data.hook_score),
    purpose_score:    Number(data.purpose_score),
    key_points_score: Number(data.key_points_score),
    cta_score:        Number(data.cta_score),
    clarity_score:    Number(data.clarity_score),
    tone_score:       Number(data.tone_score),
    pace_score:       Number(data.pace_score),
    pause_score:      Number(data.pause_score),
    volume_score:     Number(data.volume_score),
    topic:            session?.presentation_topic ?? null,
    created_at:       data.created_at,
    top_strength:     firstTitle(raw?.strengths),
    top_improvement:  firstTitle(raw?.areas_for_improvement),
  }
}
