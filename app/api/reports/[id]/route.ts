import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: analysis, error } = await supabase
    .from('analyses')
    .select(`
      *,
      sessions(
        id, session_name, presentation_topic, audio_storage_path,
        audio_mime_type, audio_duration_seconds, status, recorded_at, created_at,
        students(id, name, email)
      )
    `)
    .eq('session_id', id)
    .eq('tutor_id', user.id)
    .single()

  if (error || !analysis) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // Generate signed URL for audio playback
  let audioUrl: string | null = null
  const session = analysis.sessions as Record<string, unknown>
  if (session?.audio_storage_path) {
    const { data: signed } = await supabase.storage
      .from('audio')
      .createSignedUrl(session.audio_storage_path as string, 3600)
    audioUrl = signed?.signedUrl || null
  }

  return NextResponse.json({ analysis, audioUrl })
}
