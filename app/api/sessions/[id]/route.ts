import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, attachCookies } = createRouteHandlerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return attachCookies(
      NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
    )
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*, students(id, name, email)')
    .eq('id', id)
    .eq('tutor_id', user.id)
    .single()

  if (error) return attachCookies(NextResponse.json({ error: error.message }, { status: 404 }))
  return attachCookies(NextResponse.json({ session: data }))
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, attachCookies } = createRouteHandlerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return attachCookies(
      NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
    )
  }

  const { data: session, error: fetchErr } = await supabase
    .from('sessions')
    .select('id, student_id, audio_storage_path')
    .eq('id', id)
    .eq('tutor_id', user.id)
    .single()

  if (fetchErr || !session) {
    return attachCookies(NextResponse.json({ error: 'Session not found' }, { status: 404 }))
  }

  const service = createServiceClient()

  if (session.audio_storage_path) {
    const { error: storageErr } = await service.storage
      .from('audio')
      .remove([session.audio_storage_path])
    if (storageErr) {
      return attachCookies(
        NextResponse.json({ error: `Could not delete audio: ${storageErr.message}` }, { status: 500 })
      )
    }
  }

  const { error: deleteErr } = await service
    .from('sessions')
    .delete()
    .eq('id', id)
    .eq('tutor_id', user.id)

  if (deleteErr) {
    return attachCookies(NextResponse.json({ error: deleteErr.message }, { status: 500 }))
  }

  // Remove auto-created student if they have no sessions left
  if (session.student_id) {
    const { count } = await service
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', session.student_id)
      .eq('tutor_id', user.id)

    if (count === 0) {
      await service
        .from('students')
        .delete()
        .eq('id', session.student_id)
        .eq('tutor_id', user.id)
    }
  }

  return attachCookies(NextResponse.json({ ok: true }))
}
