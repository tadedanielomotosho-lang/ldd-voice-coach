type AnalysisInsert = Record<string, unknown>

const OPTIONAL_COLUMNS = [
  'overall_justification',
  'richness_score',
  'richness_feedback',
  'duration_score',
  'duration_feedback',
] as const

/** Insert analysis row, omitting optional columns not yet migrated in production. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertAnalysisRow(service: any, row: AnalysisInsert): Promise<void> {
  let payload: AnalysisInsert = { ...row }

  for (let attempt = 0; attempt < OPTIONAL_COLUMNS.length + 1; attempt++) {
    const { error } = await service.from('analyses').insert(payload)
    if (!error) return

    const missing = OPTIONAL_COLUMNS.filter(
      (col) => error.message.includes(col) && col in payload
    )

    if (missing.length === 0) {
      throw new Error(`Failed to save analysis: ${error.message}`)
    }

    payload = { ...payload }
    for (const col of missing) {
      delete payload[col]
    }
  }

  throw new Error('Failed to save analysis: optional columns could not be reconciled')
}
