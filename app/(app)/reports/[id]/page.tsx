'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'
import DownloadReportPdfButton from '@/components/DownloadReportPdfButton'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import { useRealtimeSession } from '@/lib/hooks/useRealtimeSession'
import { formatDate, formatDuration, scoreColor, scoreToPercent, getJoinedStudent } from '@/lib/utils'
import { CONTENT_DIMENSIONS, DELIVERY_DIMENSIONS } from '@/types'
import type { Analysis, CoachingItem, FeedbackItem, LDDFrameworkResult, ScoreDimension } from '@/types'

function getReportSummary(analysis: Analysis) {
  const raw = analysis.raw_ai_response as Partial<LDDFrameworkResult> | null
  return {
    strengths: analysis.strengths ?? raw?.strengths ?? [],
    areas:     analysis.areas_for_improvement ?? raw?.areas_for_improvement ?? [],
  }
}

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

  // Retry failed sessions
  useEffect(() => {
    if (!id || analysis) return
    if (realtimeStatus !== 'error') return
    processStarted.current = false
  }, [id, analysis, realtimeStatus])

  useEffect(() => {
    if (!id || analysis || processStarted.current) return
    if (realtimeStatus !== 'error') return

    processStarted.current = true
    fetch(`/api/sessions/${id}/process`, { method: 'POST' })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) setProcessError(data.error || 'Analysis failed')
        else fetchReport()
      })
      .catch(() => setProcessError('Could not retry analysis.'))
  }, [id, analysis, realtimeStatus])

  if (loading || !analysis) {
    if (realtimeStatus === 'error' || processError) {
      return (
        <div className="max-w-xl mx-auto mt-16 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analysis failed</h2>
          <p className="text-red-600 dark:text-red-400 text-sm">{processError || error || 'Something went wrong.'}</p>
          <div className="flex gap-3 justify-center pt-2">
            <Link href="/upload" className="text-sm text-brand-600 font-medium px-4 py-2">Try again</Link>
            <Link href="/reports" className="text-sm text-gray-600 font-medium px-4 py-2">Back to reports</Link>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading your report…</p>
      </div>
    )
  }

  const overall  = Math.round(Number(analysis.overall_score))
  const content  = Math.round(Number(analysis.content_score))
  const delivery = Math.round(Number(analysis.delivery_score))
  const student  = getJoinedStudent(session?.students)
  const { strengths, areas } = getReportSummary(analysis)
  const coaching = analysis.transcript_coaching ?? []

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

      {/* Strengths & areas for improvement */}
      {(strengths.length > 0 || areas.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strengths.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">Strengths</h2>
                <span className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded-full">
                  {strengths.length} items
                </span>
              </div>
              <ul className="space-y-4">
                {strengths.map((item: FeedbackItem, i: number) => (
                  <li key={i} className="text-sm">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">{item.title}</p>
                    <p className="text-emerald-800/90 dark:text-emerald-200/90 mt-1 leading-relaxed">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {areas.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2 className="font-semibold text-amber-900 dark:text-amber-100">Areas for improvement</h2>
                <span className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded-full">
                  {areas.length} items
                </span>
              </div>
              <ul className="space-y-4">
                {areas.map((item: FeedbackItem, i: number) => (
                  <li key={i} className="text-sm">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">{item.title}</p>
                    <p className="text-amber-800/90 dark:text-amber-200/90 mt-1 leading-relaxed">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Quick suggestions list */}
      {coaching.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-blue-900 dark:text-blue-100">Suggestions</h2>
            <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
              {coaching.length} items
            </span>
          </div>
          <ul className="space-y-3">
            {coaching.map((item: CoachingItem, i: number) => (
              <li key={i} className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                <span className="text-blue-700/80 dark:text-blue-300/80">&ldquo;{item.what_you_said}&rdquo;</span>
                <span className="mx-2 text-blue-400">→</span>
                <span className="font-medium">&ldquo;{item.suggested_version}&rdquo;</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detailed coaching opportunities */}
      {coaching.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Coaching opportunities
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              {coaching.length} rewrites
            </span>
          </h2>
          <div className="space-y-4">
            {coaching.map((item: CoachingItem, i: number) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Coaching opportunity {i + 1}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800">
                  <div className="p-4 bg-red-50/50 dark:bg-red-950/20">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">What you said</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">&ldquo;{item.what_you_said}&rdquo;</p>
                  </div>
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">Suggested version</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">&ldquo;{item.suggested_version}&rdquo;</p>
                  </div>
                </div>
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/50 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Why this is better</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{item.why_better}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presentation structure */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Presentation structure analysis
          <span className="text-sm font-normal text-gray-500 ml-2">({content}/100)</span>
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {CONTENT_DIMENSIONS.map(dim => (
            <DimensionCard key={dim.key} dim={dim} analysis={analysis} />
          ))}
        </div>
      </div>

      {/* Delivery framework */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Delivery analysis
          <span className="text-sm font-normal text-gray-500 ml-2">({delivery}/100)</span>
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {DELIVERY_DIMENSIONS.map(dim => (
            <DimensionCard key={dim.key} dim={dim} analysis={analysis} />
          ))}
        </div>
      </div>

      {/* Full transcript */}
      {analysis.transcript && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Full transcript</h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{analysis.transcript}</p>
          </div>
        </div>
      )}

      {/* Score summary — at the bottom so feedback is seen first */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Performance summary</h2>
        <div className="flex flex-wrap items-center justify-center gap-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="text-center px-4 py-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Content</p>
            <p className={`text-xl font-bold ${scoreColor(content)}`}>{content}</p>
            <p className="text-xs text-gray-400">/100</p>
          </div>
          <div className="text-center px-4 py-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Delivery</p>
            <p className={`text-xl font-bold ${scoreColor(delivery)}`}>{delivery}</p>
            <p className="text-xs text-gray-400">/100</p>
          </div>
          <div className="text-center px-5 py-3 rounded-xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Overall</p>
            <p className={`text-3xl font-bold ${scoreColor(overall)}`}>{overall}</p>
            <p className="text-xs text-gray-400">/100</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DimensionCard({ dim, analysis }: { dim: ScoreDimension; analysis: Analysis }) {
  const score   = Number(analysis[dim.key])
  const pct     = scoreToPercent(score, dim.maxScore)
  const fb      = analysis[dim.fbKey] as string | null

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium text-sm text-gray-900 dark:text-white">{dim.label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{dim.description}</p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <span className={`text-lg font-bold ${scoreColor(pct)}`}>{Math.round(score)}</span>
          <span className="text-xs text-gray-400">/{dim.maxScore}</span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {fb && <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{fb}</p>}
    </div>
  )
}
