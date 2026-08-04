import OpenAI from 'openai'
import { LDDFrameworkSchema, type LDDFrameworkResult } from './types'
import { buildAnalysisPrompt, type PriorAttemptContext } from './prompt'

function getOpenAI() {
  return new OpenAI({
    apiKey:     process.env.OPENAI_API_KEY,
    timeout:    120_000,
    maxRetries: 2,
  })
}

export async function analysePresentation(
  transcript: string,
  topic:      string,
  prior?:     PriorAttemptContext | null
): Promise<LDDFrameworkResult> {
  const prompt = buildAnalysisPrompt(transcript, topic, prior)

  const response = await getOpenAI().chat.completions.create({
    model:           'gpt-4o-mini',
    temperature:     0.2,
    max_tokens:      4500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role:    'system',
        content:
          'You are an expert LDD communication coach. Follow the scoring rubric exactly. Always respond with valid JSON only. Use correct grammar. Be specific, balanced, actionable, prioritised, encouraging, consistent, and progress-oriented.',
      },
      {
        role:    'user',
        content: prompt,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('OpenAI returned empty response')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Failed to parse GPT-4o JSON: ${raw.slice(0, 200)}`)
  }

  const validated = LDDFrameworkSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`AI response failed validation: ${validated.error.message}`)
  }

  return validated.data
}
