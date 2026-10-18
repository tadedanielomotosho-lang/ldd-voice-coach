'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Target,
  Sparkles,
} from 'lucide-react'
import DownloadReportPdfButton from '@/components/DownloadReportPdfButton'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import RetryAnalysisButton from '@/components/RetryAnalysisButton'
import HighlightedRedraft from '@/components/HighlightedRedraft'
import { useRealtimeSession } from '@/lib/hooks/useRealtimeSession'
import {
  getExecutiveSummary,
  getLddCoachFeedback,
  getPracticeGoal,
} from '@/lib/report/coachFeedback'
import { getReportSummary } from '@/lib/report/generateReportPdf'
import { formatDate, formatDuration, getJoinedStudent, formatProcessError } from '@/lib/utils'
import type { Analysis } from '@/types'

export default function ReportPage() {
  const params   = useParams()
  const id       = params.id as string

  const [analysis, setAnalysis]   = useState<Analysis | null>(null)
  const [session,  setSession]    = useState<Record<string,unknown> | null>(null)
  const [audioUrl, setAudioUrl]   = useState<string | null>(null)
  const [loading,  setLoading]    = useState(true)
  const [error,    setError]      = useState<string | null>(null)
  const [jobError, setJobError] = useState<string | null>(null)
  const [polledStatus, setPolledStatus] = useState<string | null>(null)
  const processInFlight = useRef(false)
  const sessionStatusRef = useRef<string | null>(null)

  const realtimeStatus = useRealtimeSession(id)
  const sessionStatus = polledStatus || realtimeStatus
  sessionStatusRef.current = sessionStatus

  async function triggerProcess() {
    if (processInFlight.current) return
    processInFlight.current = true
    try {
      // Errors land on the session job row; the status poll shows them.
      await fetch(`/api/sessions/${id}/process`, {
        method: 'POST',
        credentials: 'same-origin',
      })
    } catch {
      // A dropped request is retried while this page stays open.
    } finally {
      processInFlight.current = false
    }
  }

  async function fetchReport() {
    try {
      const res  = await fetch(`/api/reports/${id}`)
      if (res.status === 404) return
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAnalysis(data.analysis)
      setSession(data.analysis.sessions)
      setAudioUrl(data.audioUrl)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [id])

  // Keep asking until a report row exists, including after an error retry.
  useEffect(() => {
    if (analysis) return

    async function pollStatus() {
      try {
        const res = await fetch(`/api/sessions/${id}`, { credentials: 'same-origin' })
        if (!res.ok) return
        const data = await res.json()
        const status = data?.session?.status
        if (typeof status === 'string') setPolledStatus(status)
        const message = data?.job?.error_message
        setJobError(typeof message === 'string' && message.trim()
          ? formatProcessError(message)
          : null)
        if (status === 'error') setLoading(false)
      } catch {
        // The report poll retries.
      }
    }

    void pollStatus()
    const interval = setInterval(() => {
      void fetchReport()
      void pollStatus()
    }, 1500)
    return () => clearInterval(interval)
  }, [id, analysis])

  // Start analysis if the upload request never claimed the job.
  // Repeat while this page is open so a dead worker is picked up after its heartbeat goes stale.
  useEffect(() => {
    if (!id || analysis) return

    const first = setTimeout(() => { void triggerProcess() }, 12000)
    const retry = setInterval(() => {
      if (sessionStatusRef.current === 'error') return
      void triggerProcess()
    }, 30000)
    return () => {
      clearTimeout(first)
      clearInterval(retry)
    }
  }, [id, analysis])

  if (loading || !analysis) {
    if (sessionStatus === 'error') {
      return (
        <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analysis failed</h2>
          <p className="text-red-600 dark:text-red-400 text-sm">{jobError || error || 'Something went wrong.'}</p>
          <div className="flex gap-3 justify-center pt-2 flex-wrap">
            <RetryAnalysisButton sessionId={id} />
            <Link href="/upload" className="text-sm text-brand-600 font-medium px-4 py-2">New recording</Link>
            <Link href="/reports" className="text-sm text-gray-600 font-medium px-4 py-2">Back to reports</Link>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 px-4 text-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-gray-700 dark:text-gray-300 font-medium">Analysing your recording…</p>
        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
          Short clips (under 30 seconds) usually finish in 10–20 seconds. Longer recordings may take 1–2 minutes.
        </p>
      </div>
    )
  }

  const student          = getJoinedStudent(session?.students)
  const coachFeedback    = getLddCoachFeedback(analysis)
  const executiveSummary = getExecutiveSummary(analysis)
  const practiceGoal     = getPracticeGoal(analysis)
  const { strengths, areas } = getReportSummary(analysis)

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <Link href="/reports" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
          <ArrowLeft className="w-4 h-4" />
          All reports
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{String(session?.session_name || '')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
              {student?.name} · {String(session?.presentation_topic || '')} · {formatDate(String(session?.created_at || ''))}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <DownloadReportPdfButton sessionId={id} />
              <RetryAnalysisButton
                sessionId={id}
                force
                className="inline-flex items-center gap-2 rounded-lg border border-brand-200 dark:border-brand-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 disabled:opacity-50"
              />
              <DeleteSessionButton
                sessionId={id}
                sessionName={String(session?.session_name || '')}
                redirectTo="/reports"
                variant="button"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recording playback</p>
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{analysis.word_count} words</span>
            {session?.audio_duration_seconds != null && (
              <span>{formatDuration(Number(session.audio_duration_seconds))}</span>
            )}
          </div>
        </div>
      )}

      {/* Coach summary only on screen — full coaching lives in the PDF */}
      <div className="bg-brand-50 dark:bg-brand-950/30 rounded-xl border border-brand-200 dark:border-brand-800 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Coach summary</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Scores and detailed dimension coaching are in the downloaded PDF. The improved script with highlighted changes is shown below.
        </p>

        {executiveSummary && (
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {executiveSummary}
          </p>
        )}

        {coachFeedback.length > 0 && (
          <ul className="space-y-3">
            {coachFeedback.map((point, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="text-brand-600 dark:text-brand-400 font-bold shrink-0">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}

        {practiceGoal && (
          <div className="flex gap-3 rounded-lg bg-white/70 dark:bg-gray-900/50 border border-brand-100 dark:border-brand-900 p-4">
            <Target className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400 mb-1">
                Next practice goal
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{practiceGoal}</p>
            </div>
          </div>
        )}
      </div>

      {/* Strengths then improvements */}
      {(strengths.length > 0 || areas.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {strengths.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Strengths</h2>
              </div>
              <ul className="space-y-4">
                {strengths.map((item, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {areas.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-600" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Priority improvements</h2>
              </div>
              <ul className="space-y-4">
                {areas.map((item, i) => (
                  <li key={i}>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <HighlightedRedraft analysis={analysis} />
    </div>
  )
}
