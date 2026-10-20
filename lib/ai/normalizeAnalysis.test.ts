import assert from 'node:assert/strict'
import test from 'node:test'
import { LDDFrameworkSchema } from './types'
import { normalizeAnalysisPayload } from './normalizeAnalysis'
import { parseModelJson } from './parseModelJson'

const transcript = 'Today I want to talk about how a small pause changes a talk.'

test('coerces aliased string scores and fills the narrative the model left out', () => {
  const normalized = normalizeAnalysisPayload({
    analysis: {
      Hook: '14/15',
      purpose: { score: '11', feedback: 'The aim is clear.' },
      keyPoints: { score: 40, comment: 'The points are ordered.' },
      'content richness': { value: 18, notes: 'The oasis example is specific.' },
      call_to_action: { points: 12, text: 'The close asks for a next step.' },
      clarity: { rating: 13, detail: 'The wording is easy to follow.' },
      tone: { score: 16, feedback: 'The tone stays warm.' },
      pace: { score: 15, feedback: 'The pace is steady.' },
      pause: { score: 14, feedback: 'Breathe after the hook.' },
      volume: { score: 17, feedback: 'The opening is projected.' },
      speaking_duration: { score: 16, feedback: 'The length matches the message.' },
      strengths: ['Opened with a story'],
      improvements: [{ title: 'Call to action', description: 'Name the next step the listener can take.' }],
    },
  }, { transcript })

  const validated = LDDFrameworkSchema.safeParse(normalized)
  assert.equal(validated.success, true)
  if (!validated.success) return

  assert.equal(validated.data.hook.score, 14)
  assert.equal(validated.data.key_points.score, 25)
  assert.equal(validated.data.pauses.score, 14)
  assert.equal(validated.data.cta.score, 12)
  assert.equal(validated.data.richness.score, 18)
  assert.equal(validated.data.duration.score, 16)
  assert.ok(validated.data.overall_justification.length > 0)
  assert.ok(validated.data.executive_summary.length > 0)
  assert.ok(validated.data.practice_goal.length > 0)
  assert.ok(validated.data.ldd_coach_feedback.length >= 1)
  assert.equal(validated.data.strengths[0]?.title, 'Opened with a story')
  assert.equal(validated.data.areas_for_improvement[0]?.title, 'Call to action')
})

test('a cut-off redraft still validates when every score was already written', () => {
  const complete = {
    hook: { score: 10, feedback: 'The opening question earns attention.' },
    purpose: { score: 8, feedback: 'The listener knows why this matters.' },
    key_points: { score: 16, feedback: 'Two points follow in order.' },
    richness: { score: 12, feedback: 'One example could be more specific.' },
    cta: { score: 7, feedback: 'The ending names a next step.' },
    clarity: { score: 11, feedback: 'The sentences are easy to follow.' },
    tone: { score: 14, feedback: 'The tone is warm.' },
    pace: { score: 13, feedback: 'Ease the pace on the example.' },
    pauses: { score: 12, feedback: 'Pause before the close.' },
    volume: { score: 15, feedback: 'Project the opening line.' },
    duration: { score: 14, feedback: 'The length is enough to develop the idea.' },
    full_redraft: 'Practice this [[new opening line',
  }

  const raw = JSON.stringify(complete).slice(0, -6)
  const validated = LDDFrameworkSchema.safeParse(
    normalizeAnalysisPayload(parseModelJson(raw), { transcript })
  )

  assert.equal(validated.success, true)
  if (!validated.success) return
  assert.equal(validated.data.hook.score, 10)
  assert.equal(validated.data.duration.score, 14)
  assert.match(validated.data.full_redraft, /Practice this/)
})

test('rejects a payload that has no scores', () => {
  const validated = LDDFrameworkSchema.safeParse(
    normalizeAnalysisPayload({ summary: 'Nice try' }, { transcript })
  )
  assert.equal(validated.success, false)
})
