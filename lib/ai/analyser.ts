import OpenAI from 'openai'
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { LDDFrameworkSchema, type LDDFrameworkResult } from './types'
import { normalizeAnalysisPayload } from './normalizeAnalysis'
import { parseModelJson } from './parseModelJson'
import { fullAnalysisSchema, scoreOnlySchema } from './responseSchema'
import {
  buildAnalysisPrompt,
  type AnalysisTiming,
  type PriorAttemptContext,
} from './prompt'

const SYSTEM_PROMPT =
  'You are an expert LDD communication coach. Follow the scoring rubric exactly. Always respond with valid JSON only. Use correct grammar. Be specific, balanced, actionable, prioritised, encouraging, consistent, and progress-oriented. Score content richness and speaking duration honestly. Keep each feedback field to 2 sentences so the JSON finishes.'

function getOpenAI() {
  return new OpenAI({
    apiKey:     process.env.OPENAI_API_KEY,
    timeout:    90_000,
    maxRetries: 0,
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

function schemaUnsupported(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /response_format|json_schema|structured/i.test(message) && /not support|invalid|unknown/i.test(message)
}

type Reply = {
  content: string | null | undefined
  finishReason: string | null | undefined
}

async function requestJson(
  prompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
  maxTokens: number
): Promise<Reply> {
  const messages: ChatCompletionCreateParamsNonStreaming['messages'] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]

  const structured: ChatCompletionCreateParamsNonStreaming = {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: maxTokens,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: { name: schemaName, strict: true, schema },
    },
  }

  try {
    const response = await getOpenAI().chat.completions.create(structured)
    const choice = response.choices[0]
    return { content: choice?.message?.content, finishReason: choice?.finish_reason }
  } catch (err) {
    if (!schemaUnsupported(err)) throw err
  }

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: maxTokens,
    messages,
    response_format: { type: 'json_object' },
  })
  const choice = response.choices[0]
  return { content: choice?.message?.content, finishReason: choice?.finish_reason }
}

function readReply(reply: Reply, transcript: string): LDDFrameworkResult {
  if (!reply.content) throw new Error('OpenAI returned an empty analysis.')
  if (reply.finishReason === 'length') {
    try {
      return parseAnalysis(reply.content, transcript)
    } catch {
      throw new Error('The analysis response was cut off before it finished.')
    }
  }
  return parseAnalysis(reply.content, transcript)
}

function compactPrompt(transcript: string, topic: string): string {
  return `Score this presentation. Return JSON with only these keys, each { "score": number, "feedback": "1 or 2 sentences" }.
hook 0-15, purpose 0-12, key_points 0-25, richness 0-20, cta 0-13, clarity 0-15, tone 0-20, pace 0-20, pauses 0-20, volume 0-20, duration 0-20.
Use the whole range honestly. Do not mention the numeric score inside feedback.

TOPIC: ${topic}

TRANSCRIPT:
"""
${transcript}
"""`
}

export async function analysePresentation(
  transcript: string,
  topic:      string,
  prior?:     PriorAttemptContext | null,
  timing?:    AnalysisTiming | null
): Promise<LDDFrameworkResult> {
  const prompt = buildAnalysisPrompt(transcript, topic, prior, timing)
  let lastError = 'Analysis failed'

  try {
    const full = await requestJson(prompt, 'ldd_analysis', fullAnalysisSchema(), 12000)
    return readReply(full, transcript)
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Analysis failed'
  }

  try {
    const scores = await requestJson(
      compactPrompt(transcript, topic),
      'ldd_scores',
      scoreOnlySchema(),
      2500
    )
    return readReply(scores, transcript)
  } catch (err) {
    const message = err instanceof Error ? err.message : lastError
    throw new Error(message || lastError)
  }
}
