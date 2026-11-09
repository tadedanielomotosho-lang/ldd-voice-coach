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
- Content dims: Hook ${prior.hook_score}/15, Purpose ${prior.purpose_score}/12, Key points ${prior.key_points_score}/25, Clear point ${prior.richness_score}/20, CTA ${prior.cta_score}/13, Clarity ${prior.clarity_score}/15
- Delivery dims: Tone ${prior.tone_score}/20, Pace ${prior.pace_score}/20, Pauses ${prior.pause_score}/20, Volume ${prior.volume_score}/20, Duration ${prior.duration_score}/20
- Prior top strength: ${prior.top_strength || 'n/a'}
- Prior top improvement focus: ${prior.top_improvement || 'n/a'}
${prior.created_at ? `- Recorded: ${prior.created_at}` : ''}

Compare this attempt to the prior one. Name what improved, what slipped, and one next practice goal that builds on the gap.`
}

function formatTiming(timing?: AnalysisTiming | null): string {
  const wordCount = timing?.wordCount ?? 0
  if (!timing || timing.durationSeconds == null || timing.durationSeconds <= 0) {
    return `SPEAKING TIME: unknown (word count ${wordCount}). Assume the target is a 2-minute talk. Do not invent an exact clock time, and do not call the talk too thin or ask for more depth.`
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
The expected format is a 2-minute talk (about 90 seconds to 2 minutes 30 seconds). Score duration against that window. Do not treat a talk near 2 minutes as too short or too thin.`
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

FORMAT: This practice presentation is 2 minutes. Judge structure, clarity, hook, purpose, close, and delivery inside that length. Do not suggest more depth, more richness, more examples, more facts, or a longer explanation. Do not call the talk thin, shallow, generic for lack of substance, or underdeveloped. One clear point is the right amount of content.

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
- key_points (0–25): Organised points, transitions, logical flow for a 2-minute talk. One or two points is enough. Do not ask for more points to add depth.
  0–8 unstructured · 9–14 some structure · 15–20 clear points · 21–25 tight structure + smooth transitions.
- richness (0–20): Whether the single main idea is specific enough for a 2-minute talk. This is not a depth score. A short talk with one clear point scores in the top band. Do not withhold points for missing subtopics, background, extra examples, or "richer" development.
  0–6 no main point at all · 7–12 the point is hard to find · 13–16 the point is clear · 17–20 one specific point that fits 2 minutes.
  Feedback must not suggest adding depth or richness, and this dimension must not appear in areas_for_improvement.
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
- duration (0–20): Fit for this 2-minute practice. About 90 seconds to 2 minutes 30 seconds is the target. Do not say a talk in that window needs more content or more time. Only mention length when it is far outside the window (well under a minute, or well over 3 minutes). If it is long, suggest cutting repetition, not adding depth.
  0–6 empty, under 30 seconds, or far past 4 minutes · 7–11 under 1 minute or over about 3.5 minutes · 12–15 close to the window · 16–20 about 90 seconds to 2.5 minutes.

════════════════════════════════════════
OUTPUT FIELD RULES
════════════════════════════════════════
- Each dimension feedback: 3–5 sentences. Structure: (1) strength with quote/evidence, (2) gap with quote/evidence, (3) exact next action + example, (4) for pace/pauses/volume/duration include where/when/timing cues. Do NOT mention numeric scores in any feedback text (scores are shown only in the PDF download).
- For richness: one sentence that the main point is clear enough for 2 minutes, or that the point itself is hard to find. Do not ask for more detail.
- For duration: if the talk is near 2 minutes, say the length fits this practice. Do not suggest adding material.
- strengths: 2–3 items. title + detail (2–3 sentences, with a quote). No numeric scores.
- areas_for_improvement: 2–3 items, ordered by impact. title + detail (2–3 sentences: why it matters + what to practise + example). No numeric scores. Never use depth, richness, thin content, or "add more detail" as an item.
- transcript_coaching: exactly ${coachingCount} items. Prefer grammar, the opening, the purpose, transitions, the close, and delivery (pace, pauses, volume). Do not rewrite a line to add depth, examples, or extra facts. Keep quotes short.
- overall_justification: 2–4 sentences shown directly under the overall score. Justify the overall grade using Overall = Content (60%) + Delivery (40%). Name the 1–2 strongest drivers and the 1–2 gaps that most held the grade back. Do not cite depth, richness, or "not enough content" as a reason the grade is lower. Do not invent an overall percentage. No raw numeric scores in this paragraph.
- executive_summary: 3–5 sentences for the first page. Balanced overview: overall impression, 1–2 standout strengths, top 1–2 priorities (hook, purpose, structure, close, clarity, or delivery), and the next practice focus. Do not mention depth or richness. No raw numeric scores in this paragraph.
- practice_goal: 1–2 sentences. One concrete drill for the next 2-minute recording. Do not set a goal to add depth, examples, or a longer talk.
- ldd_coach_feedback: 5 bullets for the first-page summary. Order: (1) encourage with a specific strength + quote, (2–4) prioritised actions (include at least one delivery bullet covering pace, pause/breath, or volume), (5) practice_goal restated briefly. No numeric scores. ~30–45 words each. Use coach verbs: "Open with…", "Pause after…", "Project…", "Practise…". Do not ask the speaker to make the talk richer, deeper, or longer.
- full_redraft: A complete polished rewrite the participant can practise aloud in about 2 minutes. MUST implement the coaching suggestions that are in scope (transcript_coaching, areas_for_improvement, stronger hook/purpose/close, grammar, [pause] cues). Do not lengthen the script with extra examples, background, or deeper explanation. Keep the same amount of content and the same core message.
  HIGHLIGHTING RULE (required): Wrap every phrase that is NEW or SUBSTANTIALLY CHANGED versus the original transcript in double square brackets like [[this new or revised phrase]]. Leave unchanged connective wording unmarked. Do not wrap the entire script — only the changed/added parts. [pause] markers stay as [pause] (not inside [[ ]]).
- redraft_changes: 4–8 items that catalogue the highlights for the reader. Each item: label (short name of the change), from (original quote, or "" if pure addition), to (the new phrase WITHOUT [[ ]] brackets), applied_suggestion (which coaching point it fulfils — e.g. stronger opening, clearer close, grammar fix). Do not catalogue a "richer detail" or depth upgrade.

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
