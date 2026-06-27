import OpenAI from 'openai'
import { toFile } from 'openai/uploads'

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === 'your_openai_api_key') {
    throw new Error(
      'OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server.'
    )
  }
  return new OpenAI({ apiKey })
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
  const type = mimeType.split(';')[0].trim()
  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type }), filename)
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // SDK file upload can fail in Next.js server — fall back to direct fetch
    if (msg.includes('Invalid URL') || msg.includes('404')) {
      return transcribeWithFetch(audioBuffer, mimeType, name)
    }
    throw err
  }
}

export function countWords(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length
}
