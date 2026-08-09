import type { Analysis, CoachingItem, FeedbackItem, LDDFrameworkResult } from '@/types'

type RawAnalysis = Partial<LDDFrameworkResult>

function firstSentence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^[^.!?]+[.!?]/)
  return match ? match[0].trim() : trimmed
}

function buildFallbackCoachFeedback(
  strengths: FeedbackItem[],
  areas: FeedbackItem[],
  coaching: CoachingItem[],
  deliveryNotes: { pace?: string | null; pauses?: string | null; volume?: string | null },
  practiceGoal?: string | null
): string[] {
  const points: string[] = []

  if (strengths.length) {
    points.push(
      `Keep building on ${strengths[0].title.toLowerCase()}: ${firstSentence(strengths[0].detail)}`
    )
  }

  for (const area of areas.slice(0, 2)) {
    points.push(
      `Priority focus — ${area.title}: ${firstSentence(area.detail)}`
    )
  }

  const delivery =
    deliveryNotes.pauses ||
    deliveryNotes.pace ||
    deliveryNotes.volume
  if (delivery) {
    points.push(`Delivery cue: ${firstSentence(delivery)}`)
  }

  if (practiceGoal) {
    points.push(`Next practice goal: ${firstSentence(practiceGoal)}`)
  } else if (coaching[0]) {
    const quote = coaching[0].what_you_said
    points.push(
      `Try saying "${coaching[0].suggested_version}" instead of "${quote.slice(0, 60)}${quote.length > 60 ? '…' : ''}"`
    )
  }

  if (points.length === 0) {
    points.push(
      'Review your recording and practise opening with a clear hook, then pause and breathe before each key point.'
    )
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

  return buildFallbackCoachFeedback(
    strengths,
    areas,
    coaching,
    {
      pace:   analysis.pace_feedback,
      pauses: analysis.pause_feedback,
      volume: analysis.volume_feedback,
    },
    raw?.practice_goal
  )
}

export function getOverallJustification(analysis: Analysis): string | null {
  const fromColumn = analysis.overall_justification?.trim()
  if (fromColumn) return fromColumn

  const raw = analysis.raw_ai_response as RawAnalysis | null
  const fromRaw = raw?.overall_justification?.trim()
  if (fromRaw) return fromRaw

  return buildFallbackOverallJustification(analysis)
}

function buildFallbackOverallJustification(analysis: Analysis): string | null {
  const content = Number(analysis.content_score)
  const delivery = Number(analysis.delivery_score)
  if (!Number.isFinite(content) || !Number.isFinite(delivery)) return null

  const contentDims = [
    { name: 'hook', score: Number(analysis.hook_score), max: 20 },
    { name: 'purpose', score: Number(analysis.purpose_score), max: 15 },
    { name: 'key points', score: Number(analysis.key_points_score), max: 30 },
    { name: 'call to action', score: Number(analysis.cta_score), max: 15 },
    { name: 'clarity', score: Number(analysis.clarity_score), max: 20 },
  ]
  const deliveryDims = [
    { name: 'tone', score: Number(analysis.tone_score), max: 25 },
    { name: 'pace', score: Number(analysis.pace_score), max: 25 },
    { name: 'pauses', score: Number(analysis.pause_score), max: 25 },
    { name: 'volume', score: Number(analysis.volume_score), max: 25 },
  ]

  const byStrength = (a: { score: number; max: number }, b: { score: number; max: number }) =>
    b.score / b.max - a.score / a.max

  const strongestContent = [...contentDims].sort(byStrength)[0]
  const weakestContent = [...contentDims].sort(byStrength).at(-1)
  const strongestDelivery = [...deliveryDims].sort(byStrength)[0]
  const weakestDelivery = [...deliveryDims].sort(byStrength).at(-1)

  if (!strongestContent || !weakestContent || !strongestDelivery || !weakestDelivery) {
    return null
  }

  const blend =
    content > delivery + 4
      ? 'Content is the stronger pillar and lifts the weighted overall.'
      : delivery > content + 4
        ? 'Delivery is the stronger pillar and lifts the weighted overall.'
        : 'Content and Delivery are closely matched, so the weighted overall sits near both pillars.'

  return (
    `${blend} Your strongest content driver is ${strongestContent.name}, while ${weakestContent.name} most held content back. ` +
    `On delivery, ${strongestDelivery.name} leads and ${weakestDelivery.name} is the clearest practice target. ` +
    `Overall uses Content (60%) + Delivery (40%), so closing the weakest drivers will move the grade fastest.`
  )
}

export function getExecutiveSummary(analysis: Analysis): string | null {
  const raw = analysis.raw_ai_response as RawAnalysis | null
  const summary = raw?.executive_summary?.trim()
  return summary || null
}

export function getPracticeGoal(analysis: Analysis): string | null {
  const raw = analysis.raw_ai_response as RawAnalysis | null
  const goal = raw?.practice_goal?.trim()
  return goal || null
}

export function getFullRedraft(analysis: Analysis): string | null {
  const raw = analysis.raw_ai_response as RawAnalysis | null
  const redraft = raw?.full_redraft?.trim()
  if (redraft) return redraft

  const coaching = analysis.transcript_coaching ?? []
  if (coaching.length === 0) return null

  // Fallback for older analyses: stitch suggested lines into a practice script
  return coaching
    .map((item) => item.suggested_version.trim())
    .filter(Boolean)
    .join(' ')
}
