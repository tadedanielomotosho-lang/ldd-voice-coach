import { z } from 'zod'

export const CoachingItemSchema = z.object({
  what_you_said:     z.string().min(1),
  suggested_version: z.string().min(1),
  why_better:        z.string().min(1),
})

export const FeedbackItemSchema = z.object({
  title:  z.string().min(1),
  detail: z.string().min(1),
})

export const RedraftChangeSchema = z.object({
  label:               z.string().min(1),
  from:                z.string(),
  to:                  z.string().min(1),
  applied_suggestion:  z.string().min(1),
})

function clampedScore(max: number) {
  return z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() !== '') {
      const match = value.trim().match(/-?\d+(?:\.\d+)?/)
      if (match) value = Number(match[0])
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return value
    return Math.round(Math.min(max, Math.max(0, value)) * 100) / 100
  }, z.number().min(0).max(max))
}

const DimensionFeedbackSchema = (max: number) =>
  z.object({
    score:    clampedScore(max),
    feedback: z.string().min(1),
  })

export const LDDFrameworkSchema = z.object({
  hook:       DimensionFeedbackSchema(15),
  purpose:    DimensionFeedbackSchema(12),
  key_points: DimensionFeedbackSchema(25),
  richness:   DimensionFeedbackSchema(20),
  cta:        DimensionFeedbackSchema(13),
  clarity:    DimensionFeedbackSchema(15),
  tone:       DimensionFeedbackSchema(20),
  pace:       DimensionFeedbackSchema(20),
  pauses:     DimensionFeedbackSchema(20),
  volume:     DimensionFeedbackSchema(20),
  duration:   DimensionFeedbackSchema(20),
  strengths:              z.array(FeedbackItemSchema).min(1).max(6),
  areas_for_improvement:  z.array(FeedbackItemSchema).min(1).max(6),
  transcript_coaching:    z.array(CoachingItemSchema).min(0).max(15),
  overall_justification:  z.string().min(1),
  executive_summary:      z.string().min(1),
  practice_goal:          z.string().min(1),
  ldd_coach_feedback:     z.array(z.string().min(1)).min(1).max(8),
  full_redraft:           z.string().min(1),
  redraft_changes:        z.array(RedraftChangeSchema).min(0).max(12),
})

export type LDDFrameworkResult = z.infer<typeof LDDFrameworkSchema>
export type CoachingItem       = z.infer<typeof CoachingItemSchema>
export type FeedbackItem       = z.infer<typeof FeedbackItemSchema>
export type RedraftChange      = z.infer<typeof RedraftChangeSchema>
