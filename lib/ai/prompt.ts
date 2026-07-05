export function buildAnalysisPrompt(transcript: string, topic: string): string {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length
  const coachingCount = wordCount < 80 ? 2 : wordCount < 200 ? 3 : 4

  return `You are an LDD communication coach. Analyze this presentation. Return ONLY valid JSON. Be concise — 1-2 sentences per feedback field.

TRANSCRIPT:
"""
${transcript}
"""

TOPIC: ${topic}

Rules:
- Score each dimension honestly (use full ranges).
- feedback: 1-2 sentences with one quoted phrase where helpful.
- strengths: 2-3 items, detail 1-2 sentences each.
- areas_for_improvement: 2-3 items, detail 1-2 sentences each.
- transcript_coaching: exactly ${coachingCount} items with short quotes and rewrites.
- ldd_coach_feedback: 4-5 short actionable bullets for the participant. Merge strengths, gaps, and next steps from the full analysis. No scores. Use clear coach language (e.g. "Open with…", "Add…", "Practice…"). Max ~25 words each.

JSON:
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
  "ldd_coach_feedback": ["...", "..."]
}`
}
