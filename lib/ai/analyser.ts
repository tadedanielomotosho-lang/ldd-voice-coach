import OpenAI from 'openai'
import { LDDFrameworkSchema, type LDDFrameworkResult } from './types'
import { normalizeAnalysisPayload } from './normalizeAnalysis'
import { parseModelJson } from './parseModelJson'
import {
  buildAnalysisPrompt,
  type AnalysisTiming,
  type PriorAttemptContext,
} from './prompt'

const SYSTEM_PROMPT =
  'You are an expert LDD communication coach. Follow the scoring rubric exactly. Always respond with valid JSON only. Use correct grammar. Be specific, balanced, actionable, prioritised, encouraging, consistent, and progress-oriented. Score content richness and speaking duration honestly.'

function getOpenAI() {
  return new OpenAI({
    apiKey:     process.env.OPENAI_API_KEY,
    timeout:    120_000,
    maxRetries: 1,
  })
}

function validationSummary(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  return error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.map(String).join('.') || 'response'}: ${issue.message}`)
    .join('; ')
}

export function parseAnalysis(raw: string, transcript?: string): LDDFrameworkResult {
  let parsed: unknown
  try {
    parsed = parseModelJson(raw)
  } catch {
    throw new Error('The analysis response was not valid JSON.')
  }

  const validated = LDDFrameworkSchema.safeParse(
    normalizeAnalysisPayload(parsed, { transcript })
  )
  if (!validated.success) {
    throw new Error(`AI response failed validation: ${validationSummary(validated.error)}`)
  }
  return validated.data
}

export async function analysePresentation(
  transcript: string,
  topic:      string,
  prior?:     PriorAttemptContext | null,
  timing?:    AnalysisTiming | null
): Promise<LDDFrameworkResult> {
  const prompt = buildAnalysisPrompt(transcript, topic, prior, timing)
  let correction = ''
  let lastError = 'Analysis failed'

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await getOpenAI().chat.completions.create({
      model:           'gpt-4o-mini',
      temperature:     attempt === 0 ? 0.2 : 0,
      max_tokens:      12000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role:    'user',
          content: correction
            ? `${prompt}\n\nThe previous reply could not be saved (${correction}). Return one complete JSON object with every required key. Keep each dimension feedback to 2–3 sentences and the full redraft under 220 words so the JSON is not cut off.`
            : prompt,
        },
      ],
    })

    const choice = response.choices[0]
    const raw = choice?.message?.content
    if (!raw) {
      lastError = 'OpenAI returned an empty analysis.'
      correction = lastError
      continue
    }

    try {
      return parseAnalysis(raw, transcript)
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Analysis response was invalid.'
      if (choice?.finish_reason === 'length') {
        lastError = 'The analysis response was cut off before it finished.'
      }
      correction = lastError
    }
  }

  throw new Error(lastError)
}
