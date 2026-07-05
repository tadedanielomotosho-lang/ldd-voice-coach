import OpenAI from 'openai'
import { LDDFrameworkSchema, type LDDFrameworkResult } from './types'
import { buildAnalysisPrompt } from './prompt'

const openai = new OpenAI({
  apiKey:     process.env.OPENAI_API_KEY,
  timeout:    90_000,
  maxRetries: 2,
})

export async function analysePresentation(
  transcript: string,
  topic:      string
): Promise<LDDFrameworkResult> {
  const prompt = buildAnalysisPrompt(transcript, topic)

  const response = await openai.chat.completions.create({
    model:           'gpt-4o-mini',
    temperature:     0.1,
    max_tokens:      1400,
    response_format: { type: 'json_object' },
    messages: [
      {
        role:    'system',
        content: 'You are an expert communication coach. Always respond with valid JSON only.',
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
