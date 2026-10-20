import OpenAI from 'openai'
import { toFile } from 'openai/uploads'

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === 'your_openai_api_key') {
    throw new Error(
      'OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server.'
    )
  }
  return new OpenAI({
    apiKey,
    timeout:    90_000,
    maxRetries: 2,
  })
}

export function detectAudioFile(
  audioBuffer: Buffer,
  mimeType: string,
  filename: string
): { filename: string; mimeType: string } {
  const header = audioBuffer.subarray(0, 16)
  let ext = ''
  let type = ''

  if (header.length >= 4 && header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) {
    ext = 'webm'
    type = 'audio/webm'
  } else if (header.includes(Buffer.from('ftyp'))) {
    ext = 'm4a'
    type = 'audio/mp4'
  } else if (header.subarray(0, 4).toString('ascii') === 'RIFF') {
    ext = 'wav'
    type = 'audio/wav'
  } else if (header.subarray(0, 4).toString('ascii') === 'OggS') {
    ext = 'ogg'
    type = 'audio/ogg'
  } else if (header.subarray(0, 3).toString('ascii') === 'ID3' || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)) {
    ext = 'mp3'
    type = 'audio/mpeg'
  }

  if (!ext) {
    const declared = mimeType.split(';')[0].trim()
    const map: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/x-m4a': 'm4a',
      'audio/aac': 'aac',
    }
    ext = map[declared] || 'webm'
    type = declared || 'audio/webm'
  }

  const base = filename.replace(/\.[^.]+$/, '') || 'recording'
  return { filename: `${base}.${ext}`, mimeType: type }
}

function audioUpload(audioBuffer: Buffer, mimeType: string, filename: string): Blob {
  const type = mimeType.split(';')[0].trim() || 'audio/webm'
  // Copy out of the Buffer pool so Whisper receives only the recording bytes.
  const bytes = Uint8Array.from(audioBuffer)
  if (typeof File !== 'undefined') return new File([bytes], filename, { type })
  return new Blob([bytes], { type })
}

function safeFilename(mimeType: string, filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '') || 'recording'
  const ext = filename.split('.').pop()
  if (ext && ext !== filename) return filename

  const type = mimeType.split(';')[0].trim()
  const map: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp4':  'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg':  'ogg',
    'audio/wav':  'wav',
    'audio/x-m4a':'m4a',
    'audio/aac':  'aac',
  }
  return `${base}.${map[type] || 'webm'}`
}

async function transcribeWithFetch(
  audioBuffer: Buffer,
  mimeType: string,
  filename: string,
  language?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!
  const formData = new FormData()
  const upload = audioUpload(audioBuffer, mimeType, filename)
  formData.append('file', upload, filename)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'text')
  if (language) formData.append('language', language)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body:    formData,
  })

  if (!response.ok) {
    const body = await response.text()
    if (response.status === 401) {
      throw new Error('OpenAI API key is invalid or expired. Update OPENAI_API_KEY in .env.local')
    }
    throw new Error(`Whisper API error (${response.status}): ${body}`)
  }

  return response.text()
}

function formatWhisperError(message: string): string {
  if (/invalid file format|could not be decoded|unsupported/i.test(message)) {
    return 'This recording could not be read. Record again in the browser, or upload an MP3 or M4A file.'
  }
  return message
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename: string = 'audio.webm'
): Promise<string> {
  if (!audioBuffer.length) {
    throw new Error('The recording was empty. Please record again.')
  }

  const detected = detectAudioFile(audioBuffer, mimeType, filename)
  const name = detected.filename || safeFilename(mimeType, filename)
  const type = detected.mimeType || mimeType.split(';')[0].trim()
  let lastError = 'Whisper failed'

  for (const language of ['en', undefined]) {
    try {
      return await transcribeWithFetch(audioBuffer, type, name, language)
    } catch (fetchErr) {
      lastError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      if (!/invalid|format|400|unprocessable/i.test(lastError)) break
    }
  }

  try {
    const openai = getOpenAI()
    const file = await toFile(audioBuffer, name, { type })
    const response = await openai.audio.transcriptions.create({
      file,
      model:           'whisper-1',
      response_format: 'text',
    })
    return typeof response === 'string' ? response : String(response)
  } catch (sdkErr) {
    const sdkMsg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr)
    throw new Error(formatWhisperError(lastError || sdkMsg))
  }
}

export function countWords(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length
}
