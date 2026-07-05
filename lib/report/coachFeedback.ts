import type { Analysis, CoachingItem, FeedbackItem, LDDFrameworkResult } from '@/types'

type RawAnalysis = Partial<LDDFrameworkResult & { ldd_coach_feedback?: string[] }>

function firstSentence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^[^.!?]+[.!?]/)
  return match ? match[0].trim() : trimmed
}

function buildFallbackCoachFeedback(
  strengths: FeedbackItem[],
  areas: FeedbackItem[],
  coaching: CoachingItem[]
): string[] {
  const points: string[] = []

  if (strengths.length) {
    points.push(
      `Build on your strength in ${strengths[0].title.toLowerCase()}: ${firstSentence(strengths[0].detail)}`
    )
  }

  for (const area of areas.slice(0, 3)) {
    points.push(
      `Priority focus — ${area.title}: ${firstSentence(area.detail)}`
    )
  }

  if (coaching[0]) {
    const quote = coaching[0].what_you_said
    points.push(
      `Try saying "${coaching[0].suggested_version}" instead of "${quote.slice(0, 60)}${quote.length > 60 ? '…' : ''}"`
    )
  }

  if (points.length === 0) {
    points.push('Review your recording and practice opening with a clear hook and purpose statement.')
  }

  return points.slice(0, 5)
}

export function getLddCoachFeedback(analysis: Analysis): string[] {
  const raw = analysis.raw_ai_response as RawAnalysis | null
  if (raw?.ldd_coach_feedback?.length) {
    return raw.ldd_coach_feedback
  }

  const strengths = analysis.strengths ?? raw?.strengths ?? []
  const areas     = analysis.areas_for_improvement ?? raw?.areas_for_improvement ?? []
  const coaching  = analysis.transcript_coaching ?? []

  return buildFallbackCoachFeedback(strengths, areas, coaching)
}
