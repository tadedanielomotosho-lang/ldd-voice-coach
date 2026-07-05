'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertTriangle, MessageSquare } from 'lucide-react'
import DownloadReportPdfButton from '@/components/DownloadReportPdfButton'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import RetryAnalysisButton from '@/components/RetryAnalysisButton'
import { useRealtimeSession } from '@/lib/hooks/useRealtimeSession'
import { getLddCoachFeedback } from '@/lib/report/coachFeedback'
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
  const [processError, setProcessError] = useState<string | null>(null)
  const processStarted = useRef(false)

  const realtimeStatus = useRealtimeSession(id)

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

  // Fast poll until report is ready (retry / legacy sessions only)
  useEffect(() => {
    if (analysis) return
    if (realtimeStatus === 'error') {
      setLoading(false)
      return
    }
    const interval = setInterval(() => fetchReport(), 1000)
    return () => clearInterval(interval)
  }, [id, analysis, realtimeStatus])

  // Fallback if analysis was not started (e.g. closed tab before process began)
  useEffect(() => {
    if (!id || analysis || !realtimeStatus || realtimeStatus !== 'pending') return

    const timer = setTimeout(() => {
      if (processStarted.current || analysis) return
      processStarted.current = true
      fetch(`/api/sessions/${id}/process`, { method: 'POST', credentials: 'same-origin' })
        .then(async res => {
          const data = await res.json()
          if (!res.ok) {
            setProcessError(formatProcessError(data.error || 'Analysis failed'))
            setLoading(false)
          }
        })
        .catch(() => {
          setProcessError('Could not reach the server. Check your connection and try again.')
          setLoading(false)
        })
    }, 12000)

    return () => clearTimeout(timer)
  }, [id, analysis, realtimeStatus])

  if (loading || !analysis) {
    if (realtimeStatus === 'error' || processError) {
      return (
        <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analysis failed</h2>
          <p className="text-red-600 dark:text-red-400 text-sm">{processError || error || 'Something went wrong.'}</p>
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

  const student       = getJoinedStudent(session?.students)
  const coachFeedback = getLddCoachFeedback(analysis)

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

      {/* LDD Coach feedback — short actionable summary for participants */}
      {coachFeedback.length > 0 && (
        <div className="bg-brand-50 dark:bg-brand-950/30 rounded-xl border border-brand-200 dark:border-brand-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">LDD Coach feedback</h2>
          </div>
          <ul className="space-y-3">
            {coachFeedback.map((point, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="text-brand-600 dark:text-brand-400 font-bold shrink-0">{i + 1}.</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-brand-200 dark:border-brand-800">
            Download the PDF for full strengths, detailed coaching, scores, and structure breakdown.
          </p>
        </div>
      )}

      {/* Full transcript */}
      {analysis.transcript && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Full transcript</h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{analysis.transcript}</p>
          </div>
        </div>
      )}
    </div>
  )
}
