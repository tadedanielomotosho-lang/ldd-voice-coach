/** A live worker refreshes started_at. Older than this means the worker died. */
export const ANALYSIS_STALE_MS = 75_000
export const ANALYSIS_HEARTBEAT_MS = 20_000
export const ANALYSIS_MAX_AUTO_ATTEMPTS = 3

export type AnalysisJobRow = {
  id: string
  status: string
  started_at: string | null
  attempt_count: number | null
}

export type ClaimResultStatus = 'claimed' | 'busy' | 'exhausted'

/**
 * One worker owns a session at a time.
 * Queued and errored jobs can be claimed immediately.
 * A processing job is claimed only after its heartbeat goes stale.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function claimAnalysisJob(
  service: any,
  job: AnalysisJobRow,
  sessionStatus: string,
  force: boolean
): Promise<ClaimResultStatus> {
  const now = new Date().toISOString()
  const processing = {
    status: 'processing',
    started_at: now,
    error_message: null,
  }

  if (force) {
    const { data, error } = await service
      .from('analysis_jobs')
      .update({ ...processing, attempt_count: 0 })
      .eq('id', job.id)
      .select('id')
      .maybeSingle()
    if (error && error.code !== 'PGRST116') throw new Error(error.message)
    return data ? 'claimed' : 'busy'
  }

  if (job.status === 'processing') {
    if ((job.attempt_count ?? 0) >= ANALYSIS_MAX_AUTO_ATTEMPTS) return 'exhausted'
    const cutoff = new Date(Date.now() - ANALYSIS_STALE_MS).toISOString()
    const staleClaim = {
      ...processing,
      attempt_count: (job.attempt_count ?? 0) + 1,
    }
    const timed = await service
      .from('analysis_jobs')
      .update(staleClaim)
      .eq('id', job.id)
      .eq('status', 'processing')
      .lt('started_at', cutoff)
      .select('id')
      .maybeSingle()
    if (timed.error && timed.error.code !== 'PGRST116') throw new Error(timed.error.message)
    if (timed.data) return 'claimed'

    const missing = await service
      .from('analysis_jobs')
      .update(staleClaim)
      .eq('id', job.id)
      .eq('status', 'processing')
      .is('started_at', null)
      .select('id')
      .maybeSingle()
    if (missing.error && missing.error.code !== 'PGRST116') throw new Error(missing.error.message)
    return missing.data ? 'claimed' : 'busy'
  }

  const resetAttempts = job.status === 'error' || sessionStatus === 'error'
  const { data, error } = await service
    .from('analysis_jobs')
    .update({
      ...processing,
      ...(resetAttempts ? { attempt_count: 0 } : {}),
    })
    .eq('id', job.id)
    .eq('status', job.status)
    .select('id')
    .maybeSingle()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data ? 'claimed' : 'busy'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function startAnalysisHeartbeat(service: any, jobId: string): () => void {
  const beat = () => {
    void service
      .from('analysis_jobs')
      .update({ started_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('status', 'processing')
  }

  const timer = setInterval(beat, ANALYSIS_HEARTBEAT_MS)
  timer.unref?.()
  return () => clearInterval(timer)
}
