import type { Analysis, CoachingItem, FeedbackItem, LDDFrameworkResult } from '@/types'

export type RedraftChange = {
  label: string
  from: string
  to: string
  applied_suggestion: string
}

export type RedraftSegment =
  | { type: 'text'; text: string }
  | { type: 'highlight'; text: string }

/** Split a redraft script into plain vs [[highlighted]] segments. */
export function parseRedraftSegments(script: string): RedraftSegment[] {
  const segments: RedraftSegment[] = []
  const re = /\[\[([\s\S]+?)\]\]/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(script)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', text: script.slice(last, match.index) })
    }
    const inner = match[1]?.trim()
    if (inner) segments.push({ type: 'highlight', text: inner })
    last = match.index + match[0].length
  }

  if (last < script.length) {
    segments.push({ type: 'text', text: script.slice(last) })
  }

  return segments.filter((s) => s.text.length > 0)
}

/** Plain practise script with highlight markers removed. */
export function stripRedraftMarkers(script: string): string {
  return script.replace(/\[\[([\s\S]+?)\]\]/g, '$1').replace(/\s+/g, ' ').trim()
}

export function getRedraftChanges(analysis: Analysis): RedraftChange[] {
  const raw = analysis.raw_ai_response as Partial<LDDFrameworkResult> | null
  if (raw?.redraft_changes?.length) {
    return raw.redraft_changes.map((item) => ({
      label: item.label?.trim() || 'Update',
      from: item.from?.trim() || '',
      to: item.to?.trim() || '',
      applied_suggestion: item.applied_suggestion?.trim() || '',
    }))
  }

  return buildFallbackRedraftChanges(analysis)
}

function buildFallbackRedraftChanges(analysis: Analysis): RedraftChange[] {
  const raw = analysis.raw_ai_response as Partial<LDDFrameworkResult> | null
  const coaching: CoachingItem[] = analysis.transcript_coaching ?? raw?.transcript_coaching ?? []
  const areas: FeedbackItem[] = analysis.areas_for_improvement ?? raw?.areas_for_improvement ?? []
  const changes: RedraftChange[] = []

  for (const item of coaching.slice(0, 4)) {
    changes.push({
      label: 'Line rewrite',
      from: item.what_you_said,
      to: item.suggested_version,
      applied_suggestion: item.why_better,
    })
  }

  for (const area of areas.slice(0, 3)) {
    if (changes.some((c) => c.label === area.title)) continue
    changes.push({
      label: area.title,
      from: '',
      to: '',
      applied_suggestion: area.detail,
    })
  }

  return changes.slice(0, 8)
}
