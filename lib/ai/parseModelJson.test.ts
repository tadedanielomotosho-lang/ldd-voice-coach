import assert from 'node:assert/strict'
import test from 'node:test'
import { parseModelJson } from './parseModelJson'

test('parses a fenced JSON object', () => {
  const parsed = parseModelJson('```json\n{"hook":{"score":10,"feedback":"Clear"}}\n```')
  assert.deepEqual(parsed, { hook: { score: 10, feedback: 'Clear' } })
})

test('closes a reply cut off inside a string', () => {
  const parsed = parseModelJson(
    '{"hook":{"score":10,"feedback":"Nice opening"},"full_redraft":"Hello [[wor'
  ) as { hook: { score: number }; full_redraft: string }

  assert.equal(parsed.hook.score, 10)
  assert.equal(parsed.full_redraft, 'Hello [[wor')
})

test('drops a dangling key and keeps the scores already written', () => {
  const parsed = parseModelJson(
    '{"hook":{"score":8,"feedback":"Steady"},"purpose"'
  ) as { hook: { score: number } }

  assert.equal(parsed.hook.score, 8)
  assert.equal('purpose' in parsed, false)
})

test('closes a string that contains a comma', () => {
  const parsed = parseModelJson('{"note":"hello, world') as { note: string }
  assert.equal(parsed.note, 'hello, world')
})
