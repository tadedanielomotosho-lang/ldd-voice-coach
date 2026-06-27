import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient, createServiceClient } from '@/lib/supabase/server'
import { CreateSessionSchema } from '@/lib/validations'
import { normalizeAudioMimeType } from '@/lib/utils'
import { processSessionAnalysis } from '@/lib/analysis/processSession'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const { supabase, attachCookies } = createRouteHandlerClient(request)
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return attachCookies(
        NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
      )
    }

    const formData   = await request.formData()
    const audioFile  = formData.get('audio_file') as File | null
    const bodyJson   = formData.get('data') as string | null

    if (!audioFile || !bodyJson) {
      return NextResponse.json({ error: 'Missing audio file or session data' }, { status: 400 })
    }

    // Validate fields
    const parsed = CreateSessionSchema.safeParse(JSON.parse(bodyJson))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    // Size check — 25MB
    if (audioFile.size > 26_214_400) {
      return NextResponse.json({ error: 'Audio file exceeds 25MB limit' }, { status: 400 })
    }

    const { student_id, student_name, session_name, presentation_topic } = parsed.data

    let resolvedStudentId = student_id
    let resolvedStudentName = student_name?.trim() ?? ''

    if (resolvedStudentId) {
      const { data: student } = await supabase
        .from('students')
        .select('id, name')
        .eq('id', resolvedStudentId)
        .eq('tutor_id', user.id)
        .single()

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      }
      resolvedStudentName = student.name
    } else if (student_name) {
      const trimmedName = student_name.trim()
      resolvedStudentName = trimmedName
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('tutor_id', user.id)
        .ilike('name', trimmedName)
        .maybeSingle()

      if (existing) {
        resolvedStudentId = existing.id
      } else {
        const { data: created, error: createErr } = await supabase
          .from('students')
          .insert({ name: trimmedName, tutor_id: user.id })
          .select('id')
          .single()

        if (createErr || !created) {
          return NextResponse.json({ error: createErr?.message || 'Failed to create student' }, { status: 500 })
        }
        resolvedStudentId = created.id
      }
    } else {
      return NextResponse.json({ error: 'Student name is required' }, { status: 400 })
    }

    const dateLabel = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
    const resolvedSessionName = session_name?.trim() || `${resolvedStudentName} — ${dateLabel}`
    const resolvedTopic = presentation_topic?.trim() || 'Presentation practice'

    // Upload audio using service client (bypasses Storage RLS for server upload)
    const service = createServiceClient()
    const sessionId    = crypto.randomUUID()
    const ext          = audioFile.name.split('.').pop() || 'webm'
    const storagePath  = `${user.id}/${sessionId}/recording.${ext}`

    const audioBuffer = await audioFile.arrayBuffer()
    const contentType = normalizeAudioMimeType(audioFile.type)
    const { error: uploadErr } = await service.storage
      .from('audio')
      .upload(storagePath, audioBuffer, {
        contentType,
        upsert:      false,
      })

    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 })
    }

    // Insert session
    const { data: session, error: sessionErr } = await service
      .from('sessions')
      .insert({
        id:                   sessionId,
        tutor_id:             user.id,
        student_id:           resolvedStudentId,
        session_name:         resolvedSessionName,
        presentation_topic:   resolvedTopic,
        audio_storage_path:   storagePath,
        audio_mime_type:      contentType,
        status:               'pending',
        recorded_at:          new Date().toISOString(),
      })
      .select()
      .single()

    if (sessionErr) {
      return NextResponse.json({ error: sessionErr.message }, { status: 500 })
    }

    // Queue analysis job
    await service.from('analysis_jobs').insert({ session_id: sessionId })

    const audioBuf = Buffer.from(audioBuffer)
    const filename = `recording.${ext}`

    // Analyse before responding so the report is ready when the user lands
    await processSessionAnalysis(sessionId, {
      buffer:   audioBuf,
      mimeType: contentType,
      filename,
    })

    return attachCookies(
      NextResponse.json({ session: { ...session, status: 'done' } }, { status: 201 })
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return attachCookies(NextResponse.json({ error: msg }, { status: 500 }))
  }
}

export async function GET(request: NextRequest) {
  const { supabase, attachCookies } = createRouteHandlerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return attachCookies(
      NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
    )
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*, students(id, name)')
    .eq('tutor_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return attachCookies(NextResponse.json({ error: error.message }, { status: 500 }))
  return attachCookies(NextResponse.json({ sessions: data }))
}
