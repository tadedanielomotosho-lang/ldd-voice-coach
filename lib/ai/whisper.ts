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
  filename: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!
  const formData = new FormData()
  const upload = audioUpload(audioBuffer, mimeType, filename)
  formData.append('file', upload, filename)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'text')
  formData.append('language', 'en')

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

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
  filename: string = 'audio.webm'
): Promise<string> {
  const name = safeFilename(mimeType, filename)
  const type = mimeType.split(';')[0].trim()

  // Direct fetch is faster and more reliable in Next.js server routes
  try {
    return await transcribeWithFetch(audioBuffer, mimeType, name)
  } catch (fetchErr) {
    const fetchMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    try {
      const openai = getOpenAI()
      const file = await toFile(audioBuffer, name, { type })
      const response = await openai.audio.transcriptions.create({
        file,
        model:           'whisper-1',
        response_format: 'text',
        language:        'en',
      })
      return typeof response === 'string' ? response : String(response)
    } catch (sdkErr) {
      const sdkMsg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr)
      throw new Error(fetchMsg || sdkMsg)
    }
  }
}

export function countWords(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length
}
