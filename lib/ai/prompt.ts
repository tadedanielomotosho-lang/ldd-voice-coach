export function buildAnalysisPrompt(transcript: string, topic: string): string {
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length
  const coachingTarget = wordCount < 80 ? '5-7' : wordCount < 200 ? '7-10' : '10-15'

  return `You are an expert LDD communication coach. Analyze this presentation transcript. Return ONLY valid JSON.

TRANSCRIPT:
"""
${transcript}
"""

TOPIC: ${topic}

REQUIREMENTS:

1. DIMENSION FEEDBACK — For hook, purpose, key_points, cta, clarity, tone, pace, pauses, volume:
   - Write 3-5 detailed sentences per feedback field
   - Quote exact phrases from the transcript using single quotes
   - Explain what worked, what didn't, and give a specific improvement tip

2. STRENGTHS — Provide 3-5 items with a short title and 2-3 sentence detail citing transcript quotes

3. AREAS FOR IMPROVEMENT — Provide 3-5 items with a short title and 2-3 sentence detail citing transcript quotes

4. TRANSCRIPT COACHING — Provide ${coachingTarget} sentence-level rewrites:
   - Pick distinct sentences or phrases from the transcript (grammar, clarity, impact, filler words, weak wording)
   - what_you_said: exact quote (10-50 words)
   - suggested_version: improved rewrite
   - why_better: 1-2 sentences explaining the improvement

Return this JSON structure:
{
  "hook":       { "score": <0-20>, "feedback": "<detailed coaching with quotes>" },
  "purpose":    { "score": <0-15>, "feedback": "<detailed coaching with quotes>" },
  "key_points": { "score": <0-30>, "feedback": "<detailed coaching with quotes>" },
  "cta":        { "score": <0-15>, "feedback": "<detailed coaching with quotes>" },
  "clarity":    { "score": <0-20>, "feedback": "<detailed coaching with quotes>" },
  "tone":       { "score": <0-25>, "feedback": "<detailed coaching with quotes>" },
  "pace":       { "score": <0-25>, "feedback": "<detailed coaching with quotes>" },
  "pauses":     { "score": <0-25>, "feedback": "<detailed coaching with quotes>" },
  "volume":     { "score": <0-25>, "feedback": "<detailed coaching with quotes>" },
  "strengths": [
    { "title": "<strength name>", "detail": "<2-3 sentences with quotes>" }
  ],
  "areas_for_improvement": [
    { "title": "<area name>", "detail": "<2-3 sentences with quotes>" }
  ],
  "transcript_coaching": [
    { "what_you_said": "<quote>", "suggested_version": "<rewrite>", "why_better": "<reason>" }
  ]
}`
}
