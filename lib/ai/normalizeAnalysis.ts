const KEY_ALIASES: Record<string, string> = {
  hook: 'hook',
  purpose: 'purpose',
  keypoints: 'key_points',
  keypoint: 'key_points',
  richness: 'richness',
  contentrichness: 'richness',
  cta: 'cta',
  calltoaction: 'cta',
  clarity: 'clarity',
  tone: 'tone',
  pace: 'pace',
  pause: 'pauses',
  pauses: 'pauses',
  pausing: 'pauses',
  volume: 'volume',
  duration: 'duration',
  speakingduration: 'duration',
  strengths: 'strengths',
  strength: 'strengths',
  areasforimprovement: 'areas_for_improvement',
  areas: 'areas_for_improvement',
  improvements: 'areas_for_improvement',
  transcriptcoaching: 'transcript_coaching',
  coaching: 'transcript_coaching',
  overalljustification: 'overall_justification',
  executivesummary: 'executive_summary',
  summary: 'executive_summary',
  practicegoal: 'practice_goal',
  goal: 'practice_goal',
  lddcoachfeedback: 'ldd_coach_feedback',
  coachfeedback: 'ldd_coach_feedback',
  fullredraft: 'full_redraft',
  redraft: 'full_redraft',
  redraftchanges: 'redraft_changes',
}

function compactKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function clampScore(value: unknown, max: number): number | undefined {
  if (value == null || value === '') return undefined
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return undefined
  return Math.round(Math.min(max, Math.max(0, n)) * 100) / 100
}

function unwrapPayload(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const obj = input as Record<string, unknown>
  if ('hook' in obj || 'purpose' in obj || 'tone' in obj) return obj

  for (const key of ['analysis', 'result', 'data', 'response', 'output']) {
    const inner = obj[key]
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      return inner as Record<string, unknown>
    }
  }
  return obj
}

function canonicaliseKeys(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    const canonical = KEY_ALIASES[compactKey(key)] ?? key
    if (out[canonical] == null) out[canonical] = value
  }
  return out
}

function normalizeDimension(value: unknown, max: number): unknown {
  if (value == null) return undefined
  if (typeof value === 'number' || typeof value === 'string') {
    const score = clampScore(value, max)
    return score == null ? undefined : { score, feedback: '' }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return value

  const row = value as Record<string, unknown>
  const feedback = asTrimmed(
    row.feedback ?? row.comment ?? row.notes ?? row.rationale ?? row.detail ?? row.text
  )
  const score = clampScore(row.score ?? row.value ?? row.points ?? row.rating, max)
  if (score == null && !feedback) return undefined
  return { score, feedback: feedback ?? '' }
}

function normalizeFeedbackList(value: unknown, max = 6): unknown {
  if (!Array.isArray(value)) return undefined
  const items = value.slice(0, max).flatMap((item) => {
    if (typeof item === 'string') {
      const text = item.trim()
      if (!text) return []
      return [{ title: text.slice(0, 80), detail: text }]
    }
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const title = asTrimmed(row.title ?? row.name ?? row.label)
    const detail = asTrimmed(row.detail ?? row.feedback ?? row.description ?? row.text ?? title)
    if (!title || !detail) return []
    return [{ title, detail }]
  })
  return items
}

function normalizeCoaching(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined
  return value.slice(0, 15).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const what = asTrimmed(row.what_you_said ?? row.original ?? row.quote ?? row.from)
    const suggested = asTrimmed(row.suggested_version ?? row.suggestion ?? row.rewrite ?? row.to)
    const why = asTrimmed(row.why_better ?? row.why ?? row.reason ?? row.detail)
    if (!what || !suggested || !why) return []
    return [{ what_you_said: what, suggested_version: suggested, why_better: why }]
  })
}

function normalizeBullets(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined
  return value.slice(0, 8).flatMap((item) => {
    const text = asTrimmed(item)
    return text ? [text] : []
  })
}

function normalizeChanges(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined
  return value.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const to = asTrimmed(row.to ?? row.suggested_version ?? row.rewrite)
    if (!to) return []
    return [{
      label: asTrimmed(row.label ?? row.title) ?? 'Update',
      from: asTrimmed(row.from ?? row.what_you_said ?? row.original) ?? '',
      to,
      applied_suggestion: asTrimmed(row.applied_suggestion ?? row.why ?? row.reason ?? row.detail) ?? 'Coaching suggestion applied',
    }]
  })
}

/** Coerce a model JSON object into the analysis shape before schema validation. */
export function normalizeAnalysisPayload(input: unknown): unknown {
  const root = unwrapPayload(input)
  if (!root) return input

  const source = canonicaliseKeys(root)
  return {
    hook:       normalizeDimension(source.hook, 15),
    purpose:    normalizeDimension(source.purpose, 12),
    key_points: normalizeDimension(source.key_points, 25),
    richness:   normalizeDimension(source.richness, 20),
    cta:        normalizeDimension(source.cta, 13),
    clarity:    normalizeDimension(source.clarity, 15),
    tone:       normalizeDimension(source.tone, 20),
    pace:       normalizeDimension(source.pace, 20),
    pauses:     normalizeDimension(source.pauses, 20),
    volume:     normalizeDimension(source.volume, 20),
    duration:   normalizeDimension(source.duration, 20),
    strengths:             normalizeFeedbackList(source.strengths),
    areas_for_improvement: normalizeFeedbackList(source.areas_for_improvement),
    transcript_coaching:   normalizeCoaching(source.transcript_coaching) ?? [],
    overall_justification: asTrimmed(source.overall_justification),
    executive_summary:     asTrimmed(source.executive_summary),
    practice_goal:         asTrimmed(source.practice_goal),
    ldd_coach_feedback:    normalizeBullets(source.ldd_coach_feedback),
    full_redraft:          asTrimmed(source.full_redraft),
    redraft_changes:       normalizeChanges(source.redraft_changes) ?? [],
  }
}
