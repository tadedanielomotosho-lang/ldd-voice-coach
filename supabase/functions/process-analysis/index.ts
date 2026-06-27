// Supabase Edge Function — LDD Voice Coach Analysis Pipeline
// Triggered by pg_cron every 10 seconds

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY        = Deno.env.get('OPENAI_API_KEY')!
const MAX_ATTEMPTS          = 3

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

Deno.serve(async (_req) => {
  try {
    // Atomically claim one queued job
    const { data: job, error: jobErr } = await supabase
      .from('analysis_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('status', 'queued')
      .lt('attempt_count', MAX_ATTEMPTS)
      .select()
      .limit(1)
      .maybeSingle()

    if (jobErr) throw jobErr
    if (!job)   return new Response(JSON.stringify({ message: 'No jobs to process' }), { status: 200 })

    console.log(`Processing job ${job.id} for session ${job.session_id}`)

    try {
      await processJob(job.session_id, job.id)

      await supabase.from('analysis_jobs').update({
        status:       'done',
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)

      return new Response(JSON.stringify({ success: true, job_id: job.id }), { status: 200 })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Job ${job.id} failed:`, msg)

      // Increment attempt count; re-queue or mark error
      const newCount = (job.attempt_count || 0) + 1
      await supabase.from('analysis_jobs').update({
        status:        newCount >= MAX_ATTEMPTS ? 'error' : 'queued',
        error_message: msg,
        attempt_count: newCount,
      }).eq('id', job.id)

      if (newCount >= MAX_ATTEMPTS) {
        await supabase.from('sessions').update({ status: 'error' }).eq('id', job.session_id)
      }

      return new Response(JSON.stringify({ error: msg }), { status: 500 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
})

async function processJob(sessionId: string, jobId: string) {
  // 1. Fetch session
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('*, students(*)')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) throw new Error('Session not found')
  if (!session.audio_storage_path) throw new Error('No audio file for session')

  await supabase.from('sessions').update({ status: 'processing' }).eq('id', sessionId)

  // 2. Get signed URL for audio
  const { data: signedUrlData, error: urlErr } = await supabase.storage
    .from('audio')
    .createSignedUrl(session.audio_storage_path, 300) // 5 min

  if (urlErr || !signedUrlData) throw new Error('Failed to get audio signed URL')

  // 3. Fetch audio bytes
  const audioResponse = await fetch(signedUrlData.signedUrl)
  if (!audioResponse.ok) throw new Error('Failed to fetch audio file')
  const audioBuffer = await audioResponse.arrayBuffer()

  // 4. Transcribe with Whisper
  console.log('Transcribing with Whisper...')
  const transcript = await transcribeWithWhisper(
    audioBuffer,
    session.audio_mime_type || 'audio/webm',
    session.audio_storage_path.split('/').pop() || 'audio.webm'
  )

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length

  // 5. Analyse with GPT-4o
  console.log('Analysing with GPT-4o...')
  const analysis = await analyseWithGPT4o(transcript, session.presentation_topic)

  // 6. Calculate scores
  const contentScore =
    analysis.hook.score +
    analysis.purpose.score +
    analysis.key_points.score +
    analysis.cta.score +
    analysis.clarity.score

  const deliveryScore =
    analysis.tone.score +
    analysis.pace.score +
    analysis.pauses.score +
    analysis.volume.score

  const overallScore = Math.round((contentScore * 0.6 + deliveryScore * 0.4) * 100) / 100

  // 7. Write to analyses table
  const { error: insertErr } = await supabase.from('analyses').insert({
    session_id:         sessionId,
    student_id:         session.student_id,
    tutor_id:           session.tutor_id,
    transcript,
    word_count:         wordCount,
    content_score:      contentScore,
    hook_score:         analysis.hook.score,
    purpose_score:      analysis.purpose.score,
    key_points_score:   analysis.key_points.score,
    cta_score:          analysis.cta.score,
    clarity_score:      analysis.clarity.score,
    delivery_score:     deliveryScore,
    tone_score:         analysis.tone.score,
    pace_score:         analysis.pace.score,
    pause_score:        analysis.pauses.score,
    volume_score:       analysis.volume.score,
    overall_score:      overallScore,
    hook_feedback:      analysis.hook.feedback,
    purpose_feedback:   analysis.purpose.feedback,
    key_points_feedback:analysis.key_points.feedback,
    cta_feedback:       analysis.cta.feedback,
    clarity_feedback:   analysis.clarity.feedback,
    tone_feedback:      analysis.tone.feedback,
    pace_feedback:      analysis.pace.feedback,
    pause_feedback:     analysis.pauses.feedback,
    volume_feedback:    analysis.volume.feedback,
    transcript_coaching:analysis.transcript_coaching,
    raw_ai_response:    analysis,
  })

  if (insertErr) throw new Error(`Failed to save analysis: ${insertErr.message}`)

  // 8. Mark session as done — triggers Realtime broadcast
  await supabase.from('sessions').update({ status: 'done' }).eq('id', sessionId)

  console.log(`Job ${jobId} completed. Overall score: ${overallScore}`)
}

async function transcribeWithWhisper(
  audioBuffer: ArrayBuffer,
  mimeType:    string,
  filename:    string
): Promise<string> {
  const formData = new FormData()
  const blob = new Blob([audioBuffer], { type: mimeType })
  formData.append('file', blob, filename)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'text')
  formData.append('language', 'en')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body:    formData,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Whisper API error: ${err}`)
  }

  return response.text()
}

async function analyseWithGPT4o(transcript: string, topic: string): Promise<Record<string, unknown>> {
  const prompt = buildPrompt(transcript, topic)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:           'gpt-4o',
      temperature:     0.3,
      max_tokens:      3000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert communication coach. Always respond with valid JSON only.' },
        { role: 'user',   content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`GPT-4o API error: ${err}`)
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const raw  = data.choices[0]?.message?.content
  if (!raw) throw new Error('GPT-4o returned empty response')

  return JSON.parse(raw)
}

function buildPrompt(transcript: string, topic: string): string {
  return `You are an expert communication coach applying the LDD Voice Coach Framework.

Analyze this presentation transcript and return ONLY a valid JSON object.

TRANSCRIPT:
"""
${transcript}
"""

PRESENTATION TOPIC: ${topic}

Score each dimension and provide 2-3 sentence feedback coaching notes.

Return this exact JSON structure:
{
  "hook":       { "score": <0-20>, "feedback": "<coaching>" },
  "purpose":    { "score": <0-15>, "feedback": "<coaching>" },
  "key_points": { "score": <0-30>, "feedback": "<coaching>" },
  "cta":        { "score": <0-15>, "feedback": "<coaching>" },
  "clarity":    { "score": <0-20>, "feedback": "<coaching>" },
  "tone":       { "score": <0-25>, "feedback": "<coaching>" },
  "pace":       { "score": <0-25>, "feedback": "<coaching>" },
  "pauses":     { "score": <0-25>, "feedback": "<coaching>" },
  "volume":     { "score": <0-25>, "feedback": "<coaching>" },
  "transcript_coaching": [
    { "what_you_said": "<quote>", "suggested_version": "<rewrite>", "why_better": "<reason>" }
  ]
}

Include 3-5 transcript_coaching items targeting specific improvement moments.`
}
