import assert from 'node:assert/strict'
import test from 'node:test'
import { detectAudioFile } from './whisper'

test('names a webm recording from its header, not the browser mime', () => {
  const bytes = Buffer.alloc(16)
  bytes[0] = 0x1a
  bytes[1] = 0x45
  bytes[2] = 0xdf
  bytes[3] = 0xa3
  const file = detectAudioFile(bytes, 'video/webm;codecs=opus', 'recording.mp4')
  assert.equal(file.mimeType, 'audio/webm')
  assert.equal(file.filename, 'recording.webm')
})

test('names an m4a recording when the bytes contain ftyp', () => {
  const bytes = Buffer.from('xxxxftypisom', 'ascii')
  const file = detectAudioFile(bytes, 'application/octet-stream', 'blob')
  assert.equal(file.mimeType, 'audio/mp4')
  assert.equal(file.filename, 'blob.m4a')
})
