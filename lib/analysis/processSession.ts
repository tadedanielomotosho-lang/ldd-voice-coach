import { createServiceClient } from '@/lib/supabase/server'
import { transcribeAudio, countWords } from '@/lib/ai/whisper'
import { analysePresentation } from '@/lib/ai/analyser'
import { calculateScores } from '@/lib/ai/scorer'
import { downloadSessionAudio } from '@/lib/analysis/downloadAudio'
import { fetchPriorAttempt } from '@/lib/analysis/priorAttempt'
import { insertAnalysisRow } from '@/lib/analysis/insertAnalysis'
import { estimateDurationFromWords } from '@/lib/analysis/duration'
import {
  claimAnalysisJob,
  startAnalysisHeartbeat,
  type AnalysisJobRow,
} from '@/lib/analysis/jobClaim'

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
    audio_duration_seconds: number | null
  },
  audio: CachedAudio,
  jobId?: string
) {
  const transcript = await transcribeAudio(audio.buffer, audio.mimeType, audio.filename)
  const wordCount  = countWords(transcript)
  const prior      = await fetchPriorAttempt(service, session.student_id, sessionId)

  const measured = session.audio_duration_seconds && session.audio_duration_seconds > 0
    ? Number(session.audio_duration_seconds)
    : null
  const durationEstimated = measured == null
  const durationSeconds = measured ?? (estimateDurationFromWords(wordCount) || null)

  const analysis = await analysePresentation(
    transcript,
    session.presentation_topic,
    prior,
    {
      durationSeconds,
      durationEstimated,
      wordCount,
    }
  )
  const scores = calculateScores(analysis)

  if (durationEstimated && durationSeconds) {
    await service
      .from('sessions')
      .update({ audio_duration_seconds: durationSeconds })
      .eq('id', sessionId)
  }

  await insertAnalysisRow(service, {
    session_id:            sessionId,
    student_id:            session.student_id,
    tutor_id:              session.tutor_id,
    transcript,
    word_count:            wordCount,
    content_score:         scores.content_score,
    hook_score:            analysis.hook.score,
    purpose_score:         analysis.purpose.score,
    key_points_score:      analysis.key_points.score,
    richness_score:        analysis.richness.score,
    cta_score:             analysis.cta.score,
    clarity_score:         analysis.clarity.score,
    delivery_score:        scores.delivery_score,
    tone_score:            analysis.tone.score,
    pace_score:            analysis.pace.score,
    pause_score:           analysis.pauses.score,
    volume_score:          analysis.volume.score,
    duration_score:        analysis.duration.score,
    overall_score:         scores.overall_score,
    overall_justification: analysis.overall_justification,
    hook_feedback:         analysis.hook.feedback,
    purpose_feedback:      analysis.purpose.feedback,
    key_points_feedback:   analysis.key_points.feedback,
    richness_feedback:     analysis.richness.feedback,
    cta_feedback:          analysis.cta.feedback,
    clarity_feedback:      analysis.clarity.feedback,
    tone_feedback:         analysis.tone.feedback,
    pace_feedback:         analysis.pace.feedback,
    pause_feedback:        analysis.pauses.feedback,
    volume_feedback:       analysis.volume.feedback,
    duration_feedback:     analysis.duration.feedback,
    transcript_coaching:   analysis.transcript_coaching,
    raw_ai_response:       analysis,
  })

  await service.from('sessions').update({ status: 'done' }).eq('id', sessionId)

  if (jobId) {
    await service.from('analysis_jobs').update({
      status: 'done',
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)
  }
}

async function loadJob(
  service: ReturnType<typeof createServiceClient>,
  sessionId: string
): Promise<AnalysisJobRow | null> {
  const { data, error } = await service
    .from('analysis_jobs')
    .select('id, status, started_at, attempt_count')
    .eq('session_id', sessionId)
    .order('queued_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  return (data?.[0] as AnalysisJobRow | undefined) ?? null
}

async function markJob(
  service: ReturnType<typeof createServiceClient>,
  jobId: string | undefined,
  status: 'done' | 'error',
  errorMessage: string | null
) {
  if (!jobId) return
  await service.from('analysis_jobs').update({
    status,
    error_message: errorMessage,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId)
}

export async function processSessionAnalysis(
  sessionId: string,
  cachedAudio?: CachedAudio,
  options?: { force?: boolean }
): Promise<void> {
  assertOpenAIKey()

  const service = createServiceClient()
  const force = Boolean(options?.force)
  const startedAt = Date.now()

  const { data: session, error: sessionErr } = await service
    .from('sessions')
    .select('*, students(*)')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) throw new Error('Session not found')
  if (!session.audio_storage_path) throw new Error('No audio file for session')

  const { data: existingRows, error: existingErr } = await service
    .from('analyses')
    .select('id')
    .eq('session_id', sessionId)
    .limit(1)

  if (existingErr) throw new Error(existingErr.message)

  const job = await loadJob(service, sessionId)

  if (existingRows && existingRows.length > 0 && !force) {
    await service.from('sessions').update({ status: 'done' }).eq('id', sessionId)
    await markJob(service, job?.id, 'done', null)
    return
  }

  if (job) {
    const claim = await claimAnalysisJob(service, job, session.status, force)
    if (claim === 'busy') return
    if (claim === 'exhausted') {
      const message = 'Analysis timed out repeatedly. Please retry.'
      await service.from('sessions').update({ status: 'error' }).eq('id', sessionId)
      await markJob(service, job.id, 'error', message)
      throw new Error(message)
    }
  }

  await service.from('sessions').update({ status: 'processing' }).eq('id', sessionId)

  const stopHeartbeat = job ? startAnalysisHeartbeat(service, job.id) : null

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
    const { data: saved } = await service
      .from('analyses')
      .select('created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)

    const savedAt = saved?.[0]?.created_at ? Date.parse(saved[0].created_at) : 0
    if (savedAt >= startedAt - 5000) {
      await service.from('sessions').update({ status: 'done' }).eq('id', sessionId)
      await markJob(service, job?.id, 'done', null)
      return
    }

    await service.from('sessions').update({ status: 'error' }).eq('id', sessionId)
    await markJob(service, job?.id, 'error', msg)
    throw err
  } finally {
    stopHeartbeat?.()
  }
}
