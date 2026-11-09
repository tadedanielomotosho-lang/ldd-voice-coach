const dimension = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'number' },
    feedback: { type: 'string' },
  },
  required: ['score', 'feedback'],
} as const

const DIMENSION_KEYS = [
  'hook',
  'purpose',
  'key_points',
  'richness',
  'cta',
  'clarity',
  'tone',
  'pace',
  'pauses',
  'volume',
  'duration',
] as const

function objectSchema(
  properties: Record<string, unknown>,
  required: string[]
): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  }
}

/** Scores only. Small enough that the model can finish it in one reply. */
export function scoreOnlySchema(): Record<string, unknown> {
  const properties = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, dimension]))
  return objectSchema(properties, [...DIMENSION_KEYS])
}

/** Full coaching document. Strict mode so a slightly different shape is not rejected later. */
export function fullAnalysisSchema(): Record<string, unknown> {
  const feedbackItem = objectSchema(
    { title: { type: 'string' }, detail: { type: 'string' } },
    ['title', 'detail']
  )
  const coachingItem = objectSchema(
    {
      what_you_said: { type: 'string' },
      suggested_version: { type: 'string' },
      why_better: { type: 'string' },
    },
    ['what_you_said', 'suggested_version', 'why_better']
  )
  const changeItem = objectSchema(
    {
      label: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      applied_suggestion: { type: 'string' },
    },
    ['label', 'from', 'to', 'applied_suggestion']
  )

  const properties: Record<string, unknown> = {
    ...Object.fromEntries(DIMENSION_KEYS.map((key) => [key, dimension])),
    strengths: { type: 'array', items: feedbackItem },
    areas_for_improvement: { type: 'array', items: feedbackItem },
    transcript_coaching: { type: 'array', items: coachingItem },
    overall_justification: { type: 'string' },
    executive_summary: { type: 'string' },
    practice_goal: { type: 'string' },
    ldd_coach_feedback: { type: 'array', items: { type: 'string' } },
    full_redraft: { type: 'string' },
    redraft_changes: { type: 'array', items: changeItem },
  }

  return objectSchema(properties, Object.keys(properties))
}
