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

const DIMENSIONS = [
  ['hook', 15, 'hook'],
  ['purpose', 12, 'purpose'],
  ['key_points', 25, 'key points'],
  ['richness', 20, 'content richness'],
  ['cta', 13, 'call to action'],
  ['clarity', 15, 'clarity'],
  ['tone', 20, 'tone'],
  ['pace', 20, 'pace'],
  ['pauses', 20, 'pauses'],
  ['volume', 20, 'volume'],
  ['duration', 20, 'speaking time'],
] as const

type DimensionKey = (typeof DIMENSIONS)[number][0]

export type NormalizeContext = {
  transcript?: string | null
}

function compactKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function asTrimmed(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join(' ')
    return joined || undefined
  }
  return undefined
}

function clampScore(value: unknown, max: number): number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(Math.min(max, Math.max(0, value)) * 100) / 100
  }
  const match = String(value).trim().match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined
  const n = Number(match[0])
  if (!Number.isFinite(n)) return undefined
  return Math.round(Math.min(max, Math.max(0, n)) * 100) / 100
}

function unwrapPayload(input: unknown): Record<string, unknown> | null {
  let current: unknown = input
  for (let depth = 0; depth < 3; depth++) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null
    const obj = current as Record<string, unknown>
    if ('hook' in obj || 'purpose' in obj || 'tone' in obj || 'key_points' in obj || 'keyPoints' in obj) {
      return obj
    }
    const nested = ['analysis', 'result', 'data', 'response', 'output']
      .map((key) => obj[key])
      .find((value) => value && typeof value === 'object' && !Array.isArray(value))
    if (!nested) return obj
    current = nested
  }
  return current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : null
}

function canonicaliseKeys(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    const canonical = KEY_ALIASES[compactKey(key)] ?? key
    if (out[canonical] == null) out[canonical] = value
  }
  return out
}

function normalizeDimension(
  value: unknown,
  max: number,
  label: string
): { score: number; feedback: string } | undefined {
  if (value == null) return undefined

  if (typeof value === 'number' || typeof value === 'string') {
    const score = clampScore(value, max)
    if (score == null) return undefined
    return {
      score,
      feedback: `Keep practising your ${label} on the next recording.`,
    }
  }

  if (typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  const score = clampScore(row.score ?? row.value ?? row.points ?? row.rating, max)
  if (score == null) return undefined
  const feedback = asTrimmed(
    row.feedback ?? row.comment ?? row.notes ?? row.rationale ?? row.detail ?? row.text
  )
  return {
    score,
    feedback: feedback ?? `Keep practising your ${label} on the next recording.`,
  }
}

function normalizeFeedbackList(value: unknown, max = 6): Array<{ title: string; detail: string }> {
  if (!Array.isArray(value)) return []
  return value.slice(0, max).flatMap((item) => {
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
}

function normalizeCoaching(value: unknown): Array<{
  what_you_said: string
  suggested_version: string
  why_better: string
}> {
  if (!Array.isArray(value)) return []
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

function normalizeBullets(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).flatMap((item) => {
    const text = asTrimmed(item)
    return text ? [text] : []
  })
}

function normalizeChanges(value: unknown): Array<{
  label: string
  from: string
  to: string
  applied_suggestion: string
}> {
  if (!Array.isArray(value)) return []
  return value.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const to = asTrimmed(row.to ?? row.suggested_version ?? row.rewrite)
    if (!to) return []
    return [{
      label: asTrimmed(row.label ?? row.title) ?? 'Update',
      from: asTrimmed(row.from ?? row.what_you_said ?? row.original) ?? '',
      to,
      applied_suggestion:
        asTrimmed(row.applied_suggestion ?? row.why ?? row.reason ?? row.detail)
        ?? 'Coaching suggestion applied',
    }]
  })
}

type ScoredDimension = { key: DimensionKey; label: string; score: number; feedback: string }

function ranked(dimensions: ScoredDimension[], direction: 'high' | 'low'): ScoredDimension | undefined {
  return [...dimensions].sort((a, b) =>
    direction === 'high' ? b.score - a.score : a.score - b.score
  )[0]
}

/** Coerce a model JSON object into the analysis shape before schema validation. */
export function normalizeAnalysisPayload(input: unknown, context?: NormalizeContext): unknown {
  const root = unwrapPayload(input)
  if (!root) return input

  const source = canonicaliseKeys(root)
  const dimensions = DIMENSIONS.flatMap(([key, max, label]) => {
    const normalized = normalizeDimension(source[key], max, label)
    return normalized ? [{ key, label, ...normalized }] : []
  })
  const byKey = Object.fromEntries(dimensions.map((item) => [item.key, item])) as Partial<
    Record<DimensionKey, ScoredDimension>
  >

  const strengths = normalizeFeedbackList(source.strengths)
  const areas = normalizeFeedbackList(source.areas_for_improvement)
  const strongest = ranked(dimensions, 'high')
  const weakest = ranked(dimensions, 'low')

  const filledStrengths = strengths.length > 0
    ? strengths
    : strongest
      ? [{ title: strongest.label, detail: strongest.feedback }]
      : []

  const filledAreas = areas.length > 0
    ? areas
    : weakest
      ? [{ title: weakest.label, detail: weakest.feedback }]
      : []

  const practiceGoal = asTrimmed(source.practice_goal)
    ?? 'Record the presentation once more and apply the top improvement from your notes.'

  const justification = asTrimmed(source.overall_justification)
    ?? 'This grade reflects the balance of your content and your delivery. The notes below show what is working and what to practise next.'

  const summary = asTrimmed(source.executive_summary)
    ?? (filledStrengths[0]
      ? `${filledStrengths[0].detail} Next, focus on ${filledAreas[0]?.title ?? 'the priorities below'}.`
      : justification)

  let bullets = normalizeBullets(source.ldd_coach_feedback)
  if (bullets.length === 0) {
    bullets = [filledStrengths[0]?.detail, filledAreas[0]?.detail, practiceGoal].filter(
      (item): item is string => Boolean(item)
    )
  }

  const transcript = context?.transcript?.trim()
  const redraft = asTrimmed(source.full_redraft)
    ?? (transcript
      ? transcript
      : 'Practise the notes above aloud on your next recording.')

  const dimensionFields = Object.fromEntries(
    DIMENSIONS.map(([key]) => [key, byKey[key]])
  )

  return {
    ...dimensionFields,
    strengths: filledStrengths,
    areas_for_improvement: filledAreas,
    transcript_coaching: normalizeCoaching(source.transcript_coaching),
    overall_justification: justification,
    executive_summary: summary,
    practice_goal: practiceGoal,
    ldd_coach_feedback: bullets.slice(0, 8),
    full_redraft: redraft,
    redraft_changes: normalizeChanges(source.redraft_changes),
  }
}
