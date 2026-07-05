import { z } from 'zod'

export const CoachingItemSchema = z.object({
  what_you_said:     z.string(),
  suggested_version: z.string(),
  why_better:        z.string(),
})

export const FeedbackItemSchema = z.object({
  title:  z.string(),
  detail: z.string(),
})

export const LDDFrameworkSchema = z.object({
  hook:       z.object({ score: z.number().min(0).max(20), feedback: z.string() }),
  purpose:    z.object({ score: z.number().min(0).max(15), feedback: z.string() }),
  key_points: z.object({ score: z.number().min(0).max(30), feedback: z.string() }),
  cta:        z.object({ score: z.number().min(0).max(15), feedback: z.string() }),
  clarity:    z.object({ score: z.number().min(0).max(20), feedback: z.string() }),
  tone:       z.object({ score: z.number().min(0).max(25), feedback: z.string() }),
  pace:       z.object({ score: z.number().min(0).max(25), feedback: z.string() }),
  pauses:     z.object({ score: z.number().min(0).max(25), feedback: z.string() }),
  volume:     z.object({ score: z.number().min(0).max(25), feedback: z.string() }),
  strengths:              z.array(FeedbackItemSchema).min(1).max(6),
  areas_for_improvement:    z.array(FeedbackItemSchema).min(1).max(6),
  transcript_coaching:      z.array(CoachingItemSchema).min(0).max(15),
  ldd_coach_feedback:       z.array(z.string().min(8)).min(3).max(6),
})

export type LDDFrameworkResult = z.infer<typeof LDDFrameworkSchema>
export type CoachingItem       = z.infer<typeof CoachingItemSchema>
export type FeedbackItem       = z.infer<typeof FeedbackItemSchema>
