import type { LDDFrameworkResult } from './types'

export interface ScoreBreakdown {
  content_score:  number
  delivery_score: number
  overall_score:  number
}

export function calculateScores(result: LDDFrameworkResult): ScoreBreakdown {
  const content_score =
    result.hook.score +
    result.purpose.score +
    result.key_points.score +
    result.cta.score +
    result.clarity.score

  const delivery_score =
    result.tone.score +
    result.pace.score +
    result.pauses.score +
    result.volume.score

  const overall_score =
    Math.round((content_score * 0.6 + delivery_score * 0.4) * 100) / 100

  return {
    content_score:  Math.round(content_score * 100) / 100,
    delivery_score: Math.round(delivery_score * 100) / 100,
    overall_score,
  }
}
