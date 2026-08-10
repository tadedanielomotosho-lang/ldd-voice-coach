export type PriorAttemptContext = {
  overall_score: number
  content_score: number
  delivery_score: number
  hook_score: number
  purpose_score: number
  key_points_score: number
  richness_score: number
  cta_score: number
  clarity_score: number
  tone_score: number
  pace_score: number
  pause_score: number
  volume_score: number
  duration_score: number
  topic?: string | null
  created_at?: string | null
  top_strength?: string | null
  top_improvement?: string | null
}

export type AnalysisTiming = {
  durationSeconds: number | null
  durationEstimated: boolean
  wordCount: number
}

function formatPriorAttempt(prior?: PriorAttemptContext | null): string {
  if (!prior) {
    return `PRIOR ATTEMPT: None on file for this student. Treat this as a baseline attempt. In practice_goal and progress notes, set a clear first practice target (do not invent a prior score).`
  }

  return `PRIOR ATTEMPT (use for progress-oriented coaching; cite score movement where relevant):
- Topic: ${prior.topic || 'unknown'}
- Overall: ${prior.overall_score}/100 | Content: ${prior.content_score}/100 | Delivery: ${prior.delivery_score}/100
- Content dims: Hook ${prior.hook_score}/15, Purpose ${prior.purpose_score}/12, Key points ${prior.key_points_score}/25, Richness ${prior.richness_score}/20, CTA ${prior.cta_score}/13, Clarity ${prior.clarity_score}/15
- Delivery dims: Tone ${prior.tone_score}/20, Pace ${prior.pace_score}/20, Pauses ${prior.pause_score}/20, Volume ${prior.volume_score}/20, Duration ${prior.duration_score}/20
- Prior top strength: ${prior.top_strength || 'n/a'}
- Prior top improvement focus: ${prior.top_improvement || 'n/a'}
${prior.created_at ? `- Recorded: ${prior.created_at}` : ''}

Compare this attempt to the prior one. Name what improved, what slipped, and one next practice goal that builds on the gap.`
}

function formatTiming(timing?: AnalysisTiming | null): string {
  const wordCount = timing?.wordCount ?? 0
  if (!timing || timing.durationSeconds == null || timing.durationSeconds <= 0) {
    return `SPEAKING TIME: unknown (word count ${wordCount}). Infer duration quality from transcript substance only; do not invent an exact clock time.`
  }

  const minutes = Math.floor(timing.durationSeconds / 60)
  const seconds = timing.durationSeconds % 60
  const clock = `${minutes}:${seconds.toString().padStart(2, '0')}`
  const wpm =
    timing.durationSeconds > 0
      ? Math.round((wordCount / timing.durationSeconds) * 60)
      : 0
  const source = timing.durationEstimated
    ? 'estimated from word count (~150 wpm)'
    : 'measured from the audio file'

  return `SPEAKING TIME: ${timing.durationSeconds}s (${clock}), ${source}. Word count: ${wordCount}. Approx rate: ${wpm} wpm.
Use this measured/estimated duration when scoring the duration dimension. Short talks with thin development should not score highly on richness or duration.`
}

export function buildAnalysisPrompt(
  transcript: string,
  topic: string,
  prior?: PriorAttemptContext | null,
  timing?: AnalysisTiming | null
): string {
  const wordCount = timing?.wordCount
    ?? transcript.trim().split(/\s+/).filter(Boolean).length
  const coachingCount = wordCount < 80 ? 2 : wordCount < 200 ? 3 : 4

  return `You are an LDD communication coach. Analyse this presentation and return ONLY valid JSON.

Write in clear, correct British/American English with accurate grammar and spelling. Be motivating, never harsh. Use second person ("you").

TRANSCRIPT:
"""
${transcript}
"""

TOPIC: ${topic}

${formatTiming(timing ? { ...timing, wordCount } : { durationSeconds: null, durationEstimated: true, wordCount })}

${formatPriorAttempt(prior)}

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
- hook (0–15): Opening uses story, question, quote, fact, statistic, or scenario that earns attention.
  0–4 weak/missing · 5–8 present but generic · 9–12 clear hook with some pull · 13–15 memorable and topic-linked.
- purpose (0–12): Audience knows the objective early.
  0–3 missing · 4–6 vague · 7–9 clear · 10–12 crisp and audience-aware.
- key_points (0–25): Organised points, transitions, logical flow (structure only — depth is scored in richness).
  0–8 unstructured · 9–14 some structure · 15–20 clear points · 21–25 tight structure + smooth transitions.
- richness (0–20): Substance and depth of the message — concrete detail, examples, vivid imagery, facts, or lived specificity. Thin/generic talks score low even if structured; richer talks earn credit for developed ideas.
  0–6 thin/generic with almost no detail · 7–12 some surface detail · 13–16 solid substance with concrete examples or vivid detail · 17–20 rich, specific, memorable depth.
- cta (0–13): Ends with action, thought, reflection, or next step.
  0–3 none · 4–7 soft/vague · 8–10 clear · 11–13 specific and motivating.
- clarity (0–15): Grammar, word choice, comprehension, coherence. Flag incorrect grammar with a corrected example when relevant.
  0–4 hard to follow · 5–8 mostly clear with issues · 9–12 clear · 13–15 polished and easy to follow.

DELIVERY (100) — infer from wording, fillers, run-ons, punctuation-like breaks, repetition, energy cues, AND the speaking-time data above.
- tone (0–20): Monotone → slightly varied → varied → highly engaging.
- pace (0–20): Too slow · ideal · too fast.
  Say WHERE it is too fast or too slow and suggest a target (e.g. "ease to ~140–160 wpm on explanations; slow for the CTA"). Use the approx wpm when available.
- pauses (0–20): Insufficient · healthy · excessive.
  Suggest WHEN to pause and breathe (e.g. "after the hook, before each key point, and before the CTA").
- volume (0–20): Low · inconsistent · strong projection.
  Give a practice cue (e.g. "project to the back wall on your opening line and CTA").
- duration (0–20): Appropriateness of speaking time for developing the presentation. Use SPEAKING TIME above. Reward enough time to develop ideas; penalise rushed/underdeveloped shorts and long rambling with little substance.
  0–6 severely underdeveloped or mostly empty time · 7–11 short/thin or long/padded · 12–15 adequate development window · 16–20 well-timed for the message (typically about 1–3 minutes for this practice format when the content fills the time).

════════════════════════════════════════
OUTPUT FIELD RULES
════════════════════════════════════════
- Each dimension feedback: 3–5 sentences. Structure: (1) strength with quote/evidence, (2) gap with quote/evidence, (3) exact next action + example, (4) for pace/pauses/volume/duration include where/when/timing cues. Do NOT mention numeric scores in any feedback text (scores are shown only in the PDF download).
- For richness: cite specific details that earned or lacked depth (examples, sensory language, facts). Contrast thin vs developed moments.
- For duration: name the speaking time quality (too short / solid / too long) and what to add or trim next practice.
- strengths: 2–3 items. title + detail (2–3 sentences, with a quote). No numeric scores.
- areas_for_improvement: 2–3 items, ordered by impact. title + detail (2–3 sentences: why it matters + what to practise + example). No numeric scores.
- transcript_coaching: exactly ${coachingCount} items. Prefer grammar fixes, weak openings, unclear CTAs, thin content moments, and rushed delivery moments. Keep quotes short.
- overall_justification: 2–4 sentences shown directly under the overall score. Justify the overall grade using Overall = Content (60%) + Delivery (40%). Mention richness and/or duration when they materially lifted or dragged the grade. Name the 1–2 strongest drivers and the 1–2 gaps that most held the grade back. Do not invent an overall percentage. No raw numeric scores in this paragraph.
- executive_summary: 3–5 sentences for the first page. Balanced overview: overall impression, 1–2 standout strengths (include richness when it is a strength), top 1–2 priorities (mention duration when timing is a material gap; otherwise pace/pauses/volume), and the next practice focus. No raw numeric scores in this paragraph.
- practice_goal: 1–2 sentences. One concrete drill for the next recording (include a delivery or duration cue when that is a priority).
- ldd_coach_feedback: 5 bullets for the first-page summary. Order: (1) encourage with a specific strength + quote, (2–4) prioritised actions (include at least one delivery bullet covering pace, pause/breath, volume, or duration), (5) practice_goal restated briefly. No numeric scores. ~30–45 words each. Use coach verbs: "Open with…", "Pause after…", "Project…", "Practise…", "Expand…".
- full_redraft: A complete polished rewrite the participant can practise aloud. MUST implement every material coaching suggestion from this analysis in the script itself:
  (1) apply ALL transcript_coaching replacements,
  (2) apply ALL areas_for_improvement (hook/purpose/transitions/CTA/etc.),
  (3) upgrade content richness with concrete detail, examples, sensory language, or facts wherever the original was thin,
  (4) insert [pause] markers where pauses/breathing coaching asked for them,
  (5) keep the same core message and speaker voice; aim for about 1–2 minutes of speakable length.
  HIGHLIGHTING RULE (required): Wrap every phrase that is NEW or SUBSTANTIALLY CHANGED versus the original transcript in double square brackets like [[this new or revised phrase]]. Leave unchanged connective wording unmarked. Do not wrap the entire script — only the changed/added parts. [pause] markers stay as [pause] (not inside [[ ]]).
- redraft_changes: 4–8 items that catalogue the highlights for the reader. Each item: label (short name of the change), from (original quote, or "" if pure addition), to (the new phrase WITHOUT [[ ]] brackets), applied_suggestion (which coaching point it fulfils — e.g. richer oasis detail, stronger CTA, grammar fix). Cover richness upgrades and every major suggestion you applied.

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
  "full_redraft": "...sentence with [[highlighted new or changed phrase]] and [pause] markers...",
  "redraft_changes": [{ "label": "...", "from": "...", "to": "...", "applied_suggestion": "..." }]
}`
}
