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
  const measured = session.audio_duration_seconds && session.audio_duration_seconds > 0
    ? Number(session.audio_duration_seconds)
    : null
  const durationEstimated = measured == null
  const durationSeconds = measured ?? (wordCount > 0 ? Math.max(1, Math.round((wordCount / 150) * 60)) : null)

  // 5. Prior attempt for progress-oriented coaching
  const prior = await fetchPriorAttempt(session.student_id, sessionId)

  // 6. Analyse with GPT-4o
  console.log('Analysing with GPT-4o...')
  const analysis = await analyseWithGPT4o(transcript, session.presentation_topic, prior, {
    durationSeconds,
    durationEstimated,
    wordCount,
  })

  // 7. Calculate scores
  const contentScore =
    Number(analysis.hook.score) +
    Number(analysis.purpose.score) +
    Number(analysis.key_points.score) +
    Number(analysis.richness.score) +
    Number(analysis.cta.score) +
    Number(analysis.clarity.score)

  const deliveryScore =
    Number(analysis.tone.score) +
    Number(analysis.pace.score) +
    Number(analysis.pauses.score) +
    Number(analysis.volume.score) +
    Number(analysis.duration.score)

  const overallScore = Math.round((contentScore * 0.6 + deliveryScore * 0.4) * 100) / 100

  if (durationEstimated && durationSeconds) {
    await supabase
      .from('sessions')
      .update({ audio_duration_seconds: durationSeconds })
      .eq('id', sessionId)
  }

  // 8. Write to analyses table
  const analysisRow: Record<string, unknown> = {
    session_id:         sessionId,
    student_id:         session.student_id,
    tutor_id:           session.tutor_id,
    transcript,
    word_count:         wordCount,
    content_score:      contentScore,
    hook_score:         analysis.hook.score,
    purpose_score:      analysis.purpose.score,
    key_points_score:   analysis.key_points.score,
    richness_score:     analysis.richness.score,
    cta_score:          analysis.cta.score,
    clarity_score:      analysis.clarity.score,
    delivery_score:     deliveryScore,
    tone_score:         analysis.tone.score,
    pace_score:         analysis.pace.score,
    pause_score:        analysis.pauses.score,
    volume_score:       analysis.volume.score,
    duration_score:     analysis.duration.score,
    overall_score:      overallScore,
    overall_justification: analysis.overall_justification,
    hook_feedback:      analysis.hook.feedback,
    purpose_feedback:   analysis.purpose.feedback,
    key_points_feedback:analysis.key_points.feedback,
    richness_feedback:  analysis.richness.feedback,
    cta_feedback:       analysis.cta.feedback,
    clarity_feedback:   analysis.clarity.feedback,
    tone_feedback:      analysis.tone.feedback,
    pace_feedback:      analysis.pace.feedback,
    pause_feedback:     analysis.pauses.feedback,
    volume_feedback:    analysis.volume.feedback,
    duration_feedback:  analysis.duration.feedback,
    transcript_coaching:analysis.transcript_coaching,
    raw_ai_response:    analysis,
  }

  const optionalColumns = [
    'overall_justification',
    'richness_score',
    'richness_feedback',
    'duration_score',
    'duration_feedback',
  ]

  let payload = { ...analysisRow }
  let insertErr: { message: string } | null = null
  for (let attempt = 0; attempt < optionalColumns.length + 1; attempt++) {
    ;({ error: insertErr } = await supabase.from('analyses').insert(payload))
    if (!insertErr) break
    const missing = optionalColumns.filter(
      (col) => insertErr!.message.includes(col) && col in payload
    )
    if (missing.length === 0) break
    payload = { ...payload }
    for (const col of missing) delete payload[col]
  }

  if (insertErr) throw new Error(`Failed to save analysis: ${insertErr.message}`)

  // 9. Mark session as done — triggers Realtime broadcast
  await supabase.from('sessions').update({ status: 'done' }).eq('id', sessionId)

  console.log(`Job ${jobId} completed. Overall score: ${overallScore}`)
}

async function fetchPriorAttempt(studentId: string | null, currentSessionId: string) {
  if (!studentId) return null

  const { data } = await supabase
    .from('analyses')
    .select(`
      overall_score, content_score, delivery_score,
      hook_score, purpose_score, key_points_score, richness_score, cta_score, clarity_score,
      tone_score, pace_score, pause_score, volume_score, duration_score,
      created_at, raw_ai_response,
      sessions(presentation_topic)
    `)
    .eq('student_id', studentId)
    .neq('session_id', currentSessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
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

type Dimension = { score: number; feedback: string }

type AnalysisResult = {
  hook: Dimension
  purpose: Dimension
  key_points: Dimension
  richness: Dimension
  cta: Dimension
  clarity: Dimension
  tone: Dimension
  pace: Dimension
  pauses: Dimension
  volume: Dimension
  duration: Dimension
  transcript_coaching: Array<{
    what_you_said: string
    suggested_version: string
    why_better: string
  }>
  strengths: Array<{ title: string; detail: string }>
  areas_for_improvement: Array<{ title: string; detail: string }>
  overall_justification: string
  executive_summary: string
  practice_goal: string
  ldd_coach_feedback: string[]
  full_redraft: string
}

type TimingInfo = {
  durationSeconds: number | null
  durationEstimated: boolean
  wordCount: number
}

async function analyseWithGPT4o(
  transcript: string,
  topic: string,
  prior: Record<string, unknown> | null,
  timing: TimingInfo
): Promise<AnalysisResult> {
  const prompt = buildPrompt(transcript, topic, prior, timing)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:           'gpt-4o',
      temperature:     0.2,
      max_tokens:      5000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert LDD communication coach. Follow the scoring rubric exactly. Always respond with valid JSON only. Use correct grammar. Be specific, balanced, actionable, prioritised, encouraging, consistent, and progress-oriented. Score content richness and speaking duration honestly.',
        },
        { role: 'user', content: prompt },
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

  return JSON.parse(raw) as AnalysisResult
}

function buildPrompt(
  transcript: string,
  topic: string,
  prior: Record<string, unknown> | null,
  timing: TimingInfo
): string {
  const wordCount = timing.wordCount
  const coachingCount = wordCount < 80 ? 2 : wordCount < 200 ? 3 : 4

  let timingBlock =
    `SPEAKING TIME: unknown (word count ${wordCount}). Infer duration quality from transcript substance only; do not invent an exact clock time.`
  if (timing.durationSeconds && timing.durationSeconds > 0) {
    const minutes = Math.floor(timing.durationSeconds / 60)
    const seconds = timing.durationSeconds % 60
    const clock = `${minutes}:${seconds.toString().padStart(2, '0')}`
    const wpm = Math.round((wordCount / timing.durationSeconds) * 60)
    const source = timing.durationEstimated
      ? 'estimated from word count (~150 wpm)'
      : 'measured from the audio file'
    timingBlock =
      `SPEAKING TIME: ${timing.durationSeconds}s (${clock}), ${source}. Word count: ${wordCount}. Approx rate: ${wpm} wpm.\n` +
      `Use this measured/estimated duration when scoring the duration dimension. Short talks with thin development should not score highly on richness or duration.`
  }

  let priorBlock =
    'PRIOR ATTEMPT: None on file for this student. Treat this as a baseline attempt. In practice_goal and progress notes, set a clear first practice target (do not invent a prior score).'

  if (prior) {
    const raw = prior.raw_ai_response as {
      strengths?: Array<{ title?: string }>
      areas_for_improvement?: Array<{ title?: string }>
      richness?: { score?: number }
      duration?: { score?: number }
    } | null
    const sessions = prior.sessions as
      | { presentation_topic?: string }
      | Array<{ presentation_topic?: string }>
      | null
    const session = Array.isArray(sessions) ? sessions[0] : sessions
    priorBlock = `PRIOR ATTEMPT (use for progress-oriented coaching; cite score movement where relevant):
- Topic: ${session?.presentation_topic || 'unknown'}
- Overall: ${prior.overall_score}/100 | Content: ${prior.content_score}/100 | Delivery: ${prior.delivery_score}/100
- Content dims: Hook ${prior.hook_score}/15, Purpose ${prior.purpose_score}/12, Key points ${prior.key_points_score}/25, Richness ${prior.richness_score ?? raw?.richness?.score ?? 0}/20, CTA ${prior.cta_score}/13, Clarity ${prior.clarity_score}/15
- Delivery dims: Tone ${prior.tone_score}/20, Pace ${prior.pace_score}/20, Pauses ${prior.pause_score}/20, Volume ${prior.volume_score}/20, Duration ${prior.duration_score ?? raw?.duration?.score ?? 0}/20
- Prior top strength: ${raw?.strengths?.[0]?.title || 'n/a'}
- Prior top improvement focus: ${raw?.areas_for_improvement?.[0]?.title || 'n/a'}
- Recorded: ${prior.created_at || 'n/a'}

Compare this attempt to the prior one. Name what improved, what slipped, and one next practice goal that builds on the gap.`
  }

  return `You are an LDD communication coach. Analyse this presentation and return ONLY valid JSON.

Write in clear, correct English with accurate grammar and spelling. Be motivating, never harsh. Use second person ("you").

TRANSCRIPT:
"""
${transcript}
"""

TOPIC: ${topic}

${timingBlock}

${priorBlock}

════════════════════════════════════════
COACHING STANDARDS (apply to EVERY field)
════════════════════════════════════════
1) SPECIFIC — Cite evidence from the transcript (short quoted phrases). Apply evidence to the criterion being scored.
2) BALANCED — Acknowledge a real strength before naming the improvement.
3) ACTIONABLE — Tell the participant exactly what to do next, why it matters, and give a concrete example rewrite or drill.
4) PRIORITISED — Rank gaps by impact.
5) ENCOURAGING — Motivating coach tone.
6) CONSISTENT — Use the scoring bands below every time.
7) PROGRESS-ORIENTED — Compare to prior attempt when available.

════════════════════════════════════════
SCORING RUBRIC (use full ranges honestly)
════════════════════════════════════════
CONTENT (100)
- hook (0–15): Opening earns attention.
  0–4 weak/missing · 5–8 generic · 9–12 clear · 13–15 memorable and topic-linked.
- purpose (0–12): Audience knows the objective early.
  0–3 missing · 4–6 vague · 7–9 clear · 10–12 crisp.
- key_points (0–25): Organised points and transitions (structure only).
  0–8 unstructured · 9–14 some structure · 15–20 clear · 21–25 tight + smooth transitions.
- richness (0–20): Substance and depth — concrete detail, examples, vivid imagery, facts. Thin/generic talks score low.
  0–6 thin/generic · 7–12 surface detail · 13–16 solid substance · 17–20 rich memorable depth.
- cta (0–13): Ends with action, thought, reflection, or next step.
  0–3 none · 4–7 soft · 8–10 clear · 11–13 specific and motivating.
- clarity (0–15): Grammar, word choice, comprehension, coherence.
  0–4 hard to follow · 5–8 issues · 9–12 clear · 13–15 polished.

DELIVERY (100) — use wording cues AND speaking-time data.
- tone (0–20), pace (0–20), pauses (0–20), volume (0–20)
- duration (0–20): Appropriateness of speaking time for developing the presentation.
  0–6 severely underdeveloped or empty · 7–11 short/thin or long/padded · 12–15 adequate · 16–20 well-timed (about 1–3 minutes when content fills the time).

════════════════════════════════════════
OUTPUT FIELD RULES
════════════════════════════════════════
- Each dimension feedback: 3–5 sentences with strength, gap, and next action. No numeric scores in feedback text.
- For richness: cite specific details that earned or lacked depth.
- For duration: name speaking-time quality and what to add or trim.
- overall_justification: 2–4 sentences under the overall score; mention richness and/or duration when they materially affect the grade.
- executive_summary, practice_goal, ldd_coach_feedback, full_redraft: same coaching standards as before. If the original was thin, enrich the redraft while staying speakable.

JSON schema:
{
  "hook":       { "score": <0-15>, "feedback": "..." },
  "purpose":    { "score": <0-12>, "feedback": "..." },
  "key_points": { "score": <0-25>, "feedback": "..." },
  "richness":   { "score": <0-20>, "feedback": "..." },
  "cta":        { "score": <0-13>, "feedback": "..." },
  "clarity":    { "score": <0-15>, "feedback": "..." },
  "tone":       { "score": <0-20>, "feedback": "..." },
  "pace":       { "score": <0-20>, "feedback": "..." },
  "pauses":     { "score": <0-20>, "feedback": "..." },
  "volume":     { "score": <0-20>, "feedback": "..." },
  "duration":   { "score": <0-20>, "feedback": "..." },
  "strengths": [{ "title": "...", "detail": "..." }],
  "areas_for_improvement": [{ "title": "...", "detail": "..." }],
  "transcript_coaching": [{ "what_you_said": "...", "suggested_version": "...", "why_better": "..." }],
  "overall_justification": "...",
  "executive_summary": "...",
  "practice_goal": "...",
  "ldd_coach_feedback": ["...", "...", "...", "...", "..."],
  "full_redraft": "..."
}`
}
