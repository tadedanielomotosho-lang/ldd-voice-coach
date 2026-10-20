import assert from 'node:assert/strict'
import test from 'node:test'
import { claimAnalysisJob, type AnalysisJobRow } from './jobClaim'

type Row = {
  id: string
  status: string
  started_at: string | null
  attempt_count: number | null
}

function createJobDb(initial: Row) {
  const row = { ...initial }

  const service = {
    from(table: string) {
      if (table !== 'analysis_jobs') throw new Error(`unexpected table ${table}`)
      return {
        update(patch: Partial<Row> & { error_message?: null }) {
          const filters: Array<{ op: 'eq' | 'lt' | 'is'; col: keyof Row; val: unknown }> = []
          const chain = {
            eq(col: keyof Row, val: unknown) {
              filters.push({ op: 'eq', col, val })
              return chain
            },
            lt(col: keyof Row, val: unknown) {
              filters.push({ op: 'lt', col, val })
              return chain
            },
            is(col: keyof Row, val: unknown) {
              filters.push({ op: 'is', col, val })
              return chain
            },
            select() {
              return chain
            },
            maybeSingle() {
              const matches = filters.every((filter) => {
                const current = row[filter.col]
                if (filter.op === 'eq' || filter.op === 'is') return current === filter.val
                return typeof current === 'string'
                  && typeof filter.val === 'string'
                  && current < filter.val
              })
              if (!matches) return Promise.resolve({ data: null, error: null })
              Object.assign(row, patch)
              return Promise.resolve({ data: { id: row.id }, error: null })
            },
          }
          return chain
        },
      }
    },
  }

  return { service, row }
}

function snapshot(row: Row): AnalysisJobRow {
  return {
    id: row.id,
    status: row.status,
    started_at: row.started_at,
    attempt_count: row.attempt_count,
  }
}

test('only the first worker claims a queued job', async () => {
  const db = createJobDb({
    id: 'job-1',
    status: 'queued',
    started_at: null,
    attempt_count: 0,
  })

  const first = await claimAnalysisJob(db.service, snapshot(db.row), 'pending', false)
  const second = await claimAnalysisJob(
    db.service,
    { id: 'job-1', status: 'queued', started_at: null, attempt_count: 0 },
    'processing',
    false
  )

  assert.equal(first, 'claimed')
  assert.equal(second, 'busy')
  assert.equal(db.row.status, 'processing')
  assert.ok(db.row.started_at)
})

test('a live processing job is not stolen', async () => {
  const status = await claimAnalysisJob(
    { from() { throw new Error('should not write') } },
    {
      id: 'job-2',
      status: 'processing',
      started_at: new Date().toISOString(),
      attempt_count: 0,
    },
    'processing',
    false
  )
  assert.equal(status, 'busy')
})

test('a dead processing job can be claimed again', async () => {
  const db = createJobDb({
    id: 'job-3',
    status: 'processing',
    started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    attempt_count: 1,
  })

  const status = await claimAnalysisJob(db.service, snapshot(db.row), 'processing', false)
  assert.equal(status, 'claimed')
  assert.equal(db.row.attempt_count, 2)
  assert.ok(db.row.started_at && db.row.started_at > new Date(Date.now() - 60_000).toISOString())
})

test('three dead runs stop automatic retries', async () => {
  const status = await claimAnalysisJob(
    { from() { throw new Error('should not write') } },
    {
      id: 'job-4',
      status: 'processing',
      started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      attempt_count: 3,
    },
    'processing',
    false
  )
  assert.equal(status, 'exhausted')
})

test('an errored job can be claimed again for a manual retry', async () => {
  const db = createJobDb({
    id: 'job-5',
    status: 'error',
    started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    attempt_count: 3,
  })

  const status = await claimAnalysisJob(db.service, snapshot(db.row), 'error', false)
  assert.equal(status, 'claimed')
  assert.equal(db.row.status, 'processing')
  assert.equal(db.row.attempt_count, 0)
})
