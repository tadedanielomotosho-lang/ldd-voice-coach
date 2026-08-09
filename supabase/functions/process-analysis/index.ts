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

  // 5. Prior attempt for progress-oriented coaching
  const prior = await fetchPriorAttempt(session.student_id, sessionId)

  // 6. Analyse with GPT-4o
  console.log('Analysing with GPT-4o...')
  const analysis = await analyseWithGPT4o(transcript, session.presentation_topic, prior)

  // 7. Calculate scores
  const contentScore =
    Number(analysis.hook.score) +
    Number(analysis.purpose.score) +
    Number(analysis.key_points.score) +
    Number(analysis.cta.score) +
    Number(analysis.clarity.score)

  const deliveryScore =
    Number(analysis.tone.score) +
    Number(analysis.pace.score) +
    Number(analysis.pauses.score) +
    Number(analysis.volume.score)

  const overallScore = Math.round((contentScore * 0.6 + deliveryScore * 0.4) * 100) / 100

  // 8. Write to analyses table
  const analysisRow = {
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
    overall_justification: analysis.overall_justification,
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
  }

  let { error: insertErr } = await supabase.from('analyses').insert(analysisRow)

  // Production may not have migration 004 yet — justification still lives in raw_ai_response.
  if (insertErr?.message?.includes('overall_justification')) {
    const { overall_justification: _omit, ...withoutJustificationColumn } = analysisRow
    ;({ error: insertErr } = await supabase.from('analyses').insert(withoutJustificationColumn))
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
      hook_score, purpose_score, key_points_score, cta_score, clarity_score,
      tone_score, pace_score, pause_score, volume_score,
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
  cta: Dimension
  clarity: Dimension
  tone: Dimension
  pace: Dimension
  pauses: Dimension
  volume: Dimension
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

async function analyseWithGPT4o(
  transcript: string,
  topic: string,
  prior: Record<string, unknown> | null
): Promise<AnalysisResult> {
  const prompt = buildPrompt(transcript, topic, prior)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model:           'gpt-4o',
      temperature:     0.2,
      max_tokens:      4500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert LDD communication coach. Follow the scoring rubric exactly. Always respond with valid JSON only. Use correct grammar. Be specific, balanced, actionable, prioritised, encouraging, consistent, and progress-oriented.',
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
  prior: Record<string, unknown> | null
): string {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length
  const coachingCount = wordCount < 80 ? 2 : wordCount < 200 ? 3 : 4

  let priorBlock =
    'PRIOR ATTEMPT: None on file for this student. Treat this as a baseline attempt. In practice_goal and progress notes, set a clear first practice target (do not invent a prior score).'

  if (prior) {
    const raw = prior.raw_ai_response as {
      strengths?: Array<{ title?: string }>
      areas_for_improvement?: Array<{ title?: string }>
    } | null
    const sessions = prior.sessions as
      | { presentation_topic?: string }
      | Array<{ presentation_topic?: string }>
      | null
    const session = Array.isArray(sessions) ? sessions[0] : sessions
    priorBlock = `PRIOR ATTEMPT (use for progress-oriented coaching; cite score movement where relevant):
- Topic: ${session?.presentation_topic || 'unknown'}
- Overall: ${prior.overall_score}/100 | Content: ${prior.content_score}/100 | Delivery: ${prior.delivery_score}/100
- Content dims: Hook ${prior.hook_score}/20, Purpose ${prior.purpose_score}/15, Key points ${prior.key_points_score}/30, CTA ${prior.cta_score}/15, Clarity ${prior.clarity_score}/20
- Delivery dims: Tone ${prior.tone_score}/25, Pace ${prior.pace_score}/25, Pauses ${prior.pause_score}/25, Volume ${prior.volume_score}/25
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

${priorBlock}

════════════════════════════════════════
COACHING STANDARDS (apply to EVERY field)
════════════════════════════════════════
1) SPECIFIC — Cite evidence from the transcript (short quoted phrases). Apply evidence to the criterion being scored. Example for Hook: quote the opening line, say why it works or fails, then suggest a stronger opening.
2) BALANCED — Acknowledge a real strength before naming the improvement. Never open a dimension note with only criticism.
3) ACTIONABLE — Tell the participant exactly what to do next, why it matters, and give a concrete example rewrite or drill.
4) PRIORITISED — Rank gaps by impact. Put the highest-leverage change first in areas_for_improvement and in ldd_coach_feedback.
5) ENCOURAGING — Motivating coach tone. Celebrate effort and progress; frame gaps as practice targets.
6) CONSISTENT — Use the scoring bands below every time. Do not inflate or deflate scores for kindness.
7) PROGRESS-ORIENTED — If a prior attempt exists, compare scores and recommend the next practice goal. If none, set a clear baseline practice goal.

════════════════════════════════════════
SCORING RUBRIC (use full ranges honestly)
════════════════════════════════════════
CONTENT (100)
- hook (0–20): Opening uses story, question, quote, fact, statistic, or scenario that earns attention.
  0–6 weak/missing · 7–12 present but generic · 13–16 clear hook with some pull · 17–20 memorable and topic-linked.
- purpose (0–15): Audience knows the objective early.
  0–4 missing · 5–8 vague · 9–12 clear · 13–15 crisp and audience-aware.
- key_points (0–30): Organised points, transitions, logical flow.
  0–10 unstructured · 11–18 some structure · 19–25 clear points · 26–30 tight structure + smooth transitions.
- cta (0–15): Ends with action, thought, reflection, or next step.
  0–4 none · 5–8 soft/vague · 9–12 clear · 13–15 specific and motivating.
- clarity (0–20): Grammar, word choice, comprehension, coherence. Flag incorrect grammar with a corrected example when relevant.
  0–6 hard to follow · 7–12 mostly clear with issues · 13–16 clear · 17–20 polished and easy to follow.

DELIVERY (100) — infer from wording, fillers, run-ons, punctuation-like breaks, repetition, and energy cues in the transcript. Be explicit about pace, pauses/breathing, and volume.
- tone (0–25): Monotone → slightly varied → varied → highly engaging.
- pace (0–25): Too slow · ideal · too fast.
  Say WHERE it is too fast or too slow (e.g. "in the middle section when you listed benefits…") and suggest a target (e.g. "ease to ~140–160 wpm on explanations; slow for the CTA").
- pauses (0–25): Insufficient · healthy · excessive.
  Suggest WHEN to pause and breathe (e.g. "after the hook, before each key point, and before the CTA — inhale for 2 counts, speak on the exhale"). Note rushed junctions or long rambling stretches that need a breath.
- volume (0–25): Low · inconsistent · strong projection.
  Say if it reads too quiet, fading, or strong enough, and give a practice cue (e.g. "project to the back wall on your opening line and CTA; keep mid-body points one notch lower for contrast").

════════════════════════════════════════
OUTPUT FIELD RULES
════════════════════════════════════════
- Each dimension feedback: 3–5 sentences. Structure: (1) strength with quote, (2) gap with quote/evidence, (3) exact next action + example, (4) for pace/pauses/volume include where/when cues as above. Do NOT mention numeric scores in any feedback text (scores are shown only in the PDF download).
- strengths: 2–3 items. title + detail (2–3 sentences, with a quote). No numeric scores.
- areas_for_improvement: 2–3 items, ordered by impact. title + detail (2–3 sentences: why it matters + what to practise + example). No numeric scores.
- transcript_coaching: exactly ${coachingCount} items. Prefer grammar fixes, weak openings, unclear CTAs, and rushed delivery moments. Keep quotes short.
- overall_justification: 2–4 sentences shown directly under the overall score. Justify the overall grade using Overall = Content (60%) + Delivery (40%). Name the 1–2 strongest score drivers and the 1–2 gaps that most held the grade back. Explicitly say whether Content or Delivery lifted or dragged the blend. Honest and encouraging. Do not invent an overall percentage (the system computes it from your dimension scores). No raw numeric scores in this paragraph.
- executive_summary: 3–5 sentences for the first page. Balanced overview: overall impression, 1–2 standout strengths, top 1–2 priorities (must mention pace OR pauses/breathing OR volume if any delivery gap is material), and the next practice focus. No raw numeric scores in this paragraph.
- practice_goal: 1–2 sentences. One concrete drill for the next recording (include a delivery cue when delivery is a priority).
- ldd_coach_feedback: 5 bullets for the first-page summary. Order: (1) encourage with a specific strength + quote, (2–4) prioritised actions (include at least one delivery bullet covering pace, pause/breath, or volume with a when/where cue), (5) practice_goal restated briefly. No numeric scores. ~30–45 words each. Use coach verbs: "Open with…", "Pause after…", "Project…", "Practise…".
- full_redraft: A complete polished rewrite of the whole presentation the participant can practise aloud. Keep the same core message and roughly similar length. Improve hook, purpose, structure, clarity/grammar, CTA, and natural spoken rhythm (mark short pause points with ... or [pause] where helpful). Write it as a ready-to-deliver script matching the original speaker voice.

JSON schema:
{
  "hook":       { "score": <0-20>, "feedback": "..." },
  "purpose":    { "score": <0-15>, "feedback": "..." },
  "key_points": { "score": <0-30>, "feedback": "..." },
  "cta":        { "score": <0-15>, "feedback": "..." },
  "clarity":    { "score": <0-20>, "feedback": "..." },
  "tone":       { "score": <0-25>, "feedback": "..." },
  "pace":       { "score": <0-25>, "feedback": "..." },
  "pauses":     { "score": <0-25>, "feedback": "..." },
  "volume":     { "score": <0-25>, "feedback": "..." },
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
