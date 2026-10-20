type AnalysisInsert = Record<string, unknown>

const OPTIONAL_COLUMNS = [
  'overall_justification',
  'richness_score',
  'richness_feedback',
  'duration_score',
  'duration_feedback',
] as const

function isMissingColumn(message: string, column: string): boolean {
  return message.includes(column)
}

function isDuplicateSession(message: string): boolean {
  return /duplicate key|unique constraint|analyses_session_id/i.test(message)
}

function withoutColumns(payload: AnalysisInsert, columns: readonly string[]): AnalysisInsert {
  const next = { ...payload }
  for (const column of columns) delete next[column]
  return next
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writePayload(service: any, payload: AnalysisInsert, sessionId: string) {
  const { data: existing, error: existingErr } = await service
    .from('analyses')
    .select('id')
    .eq('session_id', sessionId)

  if (existingErr) {
    return { error: existingErr as { message: string } }
  }

  const rows = (existing ?? []) as Array<{ id: string }>
  if (rows.length === 1) {
    const updated = await service
      .from('analyses')
      .update({
        ...payload,
        created_at: new Date().toISOString(),
      })
      .eq('id', rows[0].id)
      .select('id')

    if (!updated.error && Array.isArray(updated.data) && updated.data.length > 0) {
      return updated
    }
    if (updated.error) return updated
  }

  if (rows.length > 1) {
    const { error: deleteErr } = await service.from('analyses').delete().eq('session_id', sessionId)
    if (deleteErr) return { error: deleteErr as { message: string } }
  }

  return service.from('analyses').insert(payload)
}

/** Save one analysis per session, omitting optional columns not yet migrated. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertAnalysisRow(service: any, row: AnalysisInsert): Promise<void> {
  const sessionId = String(row.session_id ?? '')
  if (!sessionId) throw new Error('Failed to save analysis: missing session id')

  let payload: AnalysisInsert = { ...row }

  for (let attempt = 0; attempt < OPTIONAL_COLUMNS.length + 2; attempt++) {
    const { error } = await writePayload(service, payload, sessionId)
    if (!error) return

    const message = error.message || 'Unknown database error'
    if (isDuplicateSession(message)) {
      const { error: updateErr } = await service
        .from('analyses')
        .update({ ...payload, created_at: new Date().toISOString() })
        .eq('session_id', sessionId)
      if (!updateErr) return
      const updateMessage = updateErr.message || message
      const missing = OPTIONAL_COLUMNS.filter(
        (column) => isMissingColumn(updateMessage, column) && column in payload
      )
      if (missing.length === 0) {
        throw new Error(`Failed to save analysis: ${updateMessage}`)
      }
      payload = withoutColumns(payload, missing)
      continue
    }

    const missing = OPTIONAL_COLUMNS.filter(
      (column) => isMissingColumn(message, column) && column in payload
    )
    if (missing.length === 0) {
      throw new Error(`Failed to save analysis: ${message}`)
    }
    payload = withoutColumns(payload, missing)
  }

  throw new Error('Failed to save analysis: optional columns could not be reconciled')
}
