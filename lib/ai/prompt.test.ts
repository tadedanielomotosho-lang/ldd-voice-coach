import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAnalysisPrompt } from './prompt'

test('coaching treats the talk as a 2-minute presentation', () => {
  const prompt = buildAnalysisPrompt('I want to tell you one idea.', 'Practice', null, {
    durationSeconds: 120,
    durationEstimated: false,
    wordCount: 6,
  })

  assert.match(prompt, /2-minute/)
  assert.match(prompt, /Do not suggest more depth, more richness/)
  assert.match(prompt, /about 90 seconds to 2 minutes 30 seconds/)
  assert.doesNotMatch(prompt, /Short talks with thin development should not score highly/)
  assert.doesNotMatch(prompt, /upgrade content richness/)
  assert.doesNotMatch(prompt, /Expand…/)
})
