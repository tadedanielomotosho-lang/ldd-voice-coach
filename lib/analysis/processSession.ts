import { createServiceClient } from '@/lib/supabase/server'
import { transcribeAudio, countWords } from '@/lib/ai/whisper'
import { analysePresentation } from '@/lib/ai/analyser'
import { calculateScores } from '@/lib/ai/scorer'
import { downloadSessionAudio } from '@/lib/analysis/downloadAudio'

export type CachedAudio = {
  buffer:   Buffer
  mimeType: string
  filename: string
}

function assertOpenAIKey() {
  const key = process.env.OPENAI_API_KEY
  if (!key || key === 'your_openai_api_key') {
    throw new Error(
      'OpenAI API key is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server.'
    )
  }
}

async function runAnalysis(
  service: ReturnType<typeof createServiceClient>,
  sessionId: string,
  session: {
    student_id: string | null
    tutor_id: string
    presentation_topic: string
    audio_mime_type: string | null
    audio_storage_path: string
  },
  audio: CachedAudio,
  jobId?: string
) {
  const transcript = await transcribeAudio(audio.buffer, audio.mimeType, audio.filename)
  const wordCount  = countWords(transcript)
  const analysis   = await analysePresentation(transcript, session.presentation_topic)
  const scores     = calculateScores(analysis)

  const { error: insertErr } = await service.from('analyses').insert({
    session_id:          sessionId,
    student_id:          session.student_id,
    tutor_id:            session.tutor_id,
    transcript,
    word_count:          wordCount,
    content_score:       scores.content_score,
    hook_score:          analysis.hook.score,
    purpose_score:       analysis.purpose.score,
    key_points_score:    analysis.key_points.score,
    cta_score:           analysis.cta.score,
    clarity_score:       analysis.clarity.score,
    delivery_score:      scores.delivery_score,
    tone_score:          analysis.tone.score,
    pace_score:          analysis.pace.score,
    pause_score:         analysis.pauses.score,
    volume_score:        analysis.volume.score,
    overall_score:       scores.overall_score,
    hook_feedback:       analysis.hook.feedback,
    purpose_feedback:    analysis.purpose.feedback,
    key_points_feedback: analysis.key_points.feedback,
    cta_feedback:        analysis.cta.feedback,
    clarity_feedback:    analysis.clarity.feedback,
    tone_feedback:       analysis.tone.feedback,
    pace_feedback:       analysis.pace.feedback,
    pause_feedback:      analysis.pauses.feedback,
    volume_feedback:     analysis.volume.feedback,
    transcript_coaching: analysis.transcript_coaching,
    raw_ai_response:     analysis,
  })

  if (insertErr) throw new Error(`Failed to save analysis: ${insertErr.message}`)

  await service.from('sessions').update({ status: 'done' }).eq('id', sessionId)

  if (jobId) {
    await service.from('analysis_jobs').update({
      status: 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)
  }
}

export async function processSessionAnalysis(
  sessionId: string,
  cachedAudio?: CachedAudio
): Promise<void> {
  assertOpenAIKey()

  const service = createServiceClient()

  const { data: session, error: sessionErr } = await service
    .from('sessions')
    .select('*, students(*)')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) throw new Error('Session not found')
  if (!session.audio_storage_path) throw new Error('No audio file for session')

  if (session.status === 'processing' && !cachedAudio) {
    // Another request is already analysing with the uploaded audio
    return
  }

  const { data: existing } = await service
    .from('analyses')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (existing) {
    await service.from('sessions').update({ status: 'done' }).eq('id', sessionId)
    return
  }

  const { data: job } = await service
    .from('analysis_jobs')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (session.status === 'error') {
    await service.from('sessions').update({ status: 'pending' }).eq('id', sessionId)
    if (job) {
      await service.from('analysis_jobs').update({
        status: 'queued',
        error_message: null,
        attempt_count: 0,
      }).eq('id', job.id)
    }
  }

  await service.from('sessions').update({ status: 'processing' }).eq('id', sessionId)

  if (job) {
    await service.from('analysis_jobs').update({
      status: 'processing',
      started_at: new Date().toISOString(),
    }).eq('id', job.id)
  }

  try {
    let audio: CachedAudio

    if (cachedAudio) {
      audio = cachedAudio
    } else {
      audio = await downloadSessionAudio(
        service,
        session.audio_storage_path,
        session.audio_mime_type
      )
    }

    await runAnalysis(service, sessionId, session, audio, job?.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed'

    await service.from('sessions').update({ status: 'error' }).eq('id', sessionId)

    if (job) {
      await service.from('analysis_jobs').update({
        status: 'error',
        error_message: msg,
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)
    }

    throw err
  }
}
