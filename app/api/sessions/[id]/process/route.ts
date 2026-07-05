import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'
import { processSessionAnalysis } from '@/lib/analysis/processSession'
import { normalizeAudioMimeType, formatProcessError } from '@/lib/utils'

export const maxDuration = 300

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, attachCookies } = createRouteHandlerClient(request)
  try {
    const { id } = await params
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return attachCookies(
        NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
      )
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', id)
      .eq('tutor_id', user.id)
      .single()

    if (!session) {
      return attachCookies(NextResponse.json({ error: 'Session not found' }, { status: 404 }))
    }
    if (session.status === 'done') {
      return attachCookies(NextResponse.json({ message: 'Already complete' }))
    }

    let cachedAudio
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const audioFile = formData.get('audio_file') as File | null
      if (audioFile && audioFile.size > 0) {
        const buffer = Buffer.from(await audioFile.arrayBuffer())
        cachedAudio = {
          buffer,
          mimeType: normalizeAudioMimeType(audioFile.type),
          filename: audioFile.name || 'recording.webm',
        }
      }
    }

    await processSessionAnalysis(id, cachedAudio)
    return attachCookies(NextResponse.json({ success: true }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed'
    return attachCookies(
      NextResponse.json({ error: formatProcessError(msg) }, { status: 500 })
    )
  }
}
