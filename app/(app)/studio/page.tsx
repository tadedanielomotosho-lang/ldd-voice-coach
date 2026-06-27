'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, Square, Pause, Play, Trash2, Send, Loader2, AlertCircle } from 'lucide-react'
import { useRecorder } from '@/lib/hooks/useRecorder'
import { formatDuration, normalizeAudioMimeType } from '@/lib/utils'

export default function StudioPage() {
  const router    = useRouter()
  const recorder  = useRecorder()
  const [studentName, setStudentName] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [micDenied,   setMicDenied]   = useState(false)

  async function handleStart() {
    try {
      setMicDenied(false)
      await recorder.start()
    } catch {
      setMicDenied(true)
    }
  }

  async function handleSubmit() {
    if (!recorder.audioBlob || !studentName.trim()) {
      setError('Please enter a student name before submitting'); return
    }
    setSubmitting(true)
    setError(null)
    try {
      const ext  = recorder.mimeType.includes('mp4') ? 'mp4' : recorder.mimeType.includes('ogg') ? 'ogg' : 'webm'
      const file = new File([recorder.audioBlob], `recording.${ext}`, { type: normalizeAudioMimeType(recorder.mimeType) })
      const fd   = new FormData()
      fd.append('audio_file', file)
      fd.append('data', JSON.stringify({
        student_name: studentName.trim(),
      }))
      const res  = await fetch('/api/sessions', { method: 'POST', body: fd, credentials: 'same-origin' })
      const data = await res.json()
      if (res.status === 401) {
        router.push('/login?reason=session-expired')
        return
      }
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      router.push(`/reports/${data.session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recording studio</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Record a presentation directly in your browser</p>
      </div>

      {micDenied && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-4 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          Microphone access denied. Please allow microphone access in your browser settings and try again.
        </div>
      )}

      {/* Session metadata */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Student name</label>
          <input type="text" required value={studentName} onChange={e => setStudentName(e.target.value)}
            placeholder="e.g. Sarah Johnson"
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {/* Recorder */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        {/* Timer display */}
        <div className="text-center mb-6">
          <div className="text-5xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
            {formatDuration(recorder.duration)}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 capitalize">
            {recorder.isIdle ? 'Ready to record' : recorder.state}
          </p>
        </div>

        {/* Pulse indicator */}
        {recorder.isRecording && (
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">Recording</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {recorder.isIdle && (
            <button onClick={handleStart}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
              <Mic className="w-5 h-5" />
              Start recording
            </button>
          )}
          {recorder.isRecording && (
            <>
              <button onClick={recorder.pause}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2.5 rounded-xl transition-colors">
                <Pause className="w-4 h-4" />
                Pause
              </button>
              <button onClick={recorder.stop}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-medium px-5 py-2.5 rounded-xl transition-colors">
                <Square className="w-4 h-4" />
                Stop
              </button>
            </>
          )}
          {recorder.isPaused && (
            <>
              <button onClick={recorder.resume}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors">
                <Play className="w-4 h-4" />
                Resume
              </button>
              <button onClick={recorder.stop}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-medium px-5 py-2.5 rounded-xl transition-colors">
                <Square className="w-4 h-4" />
                Stop
              </button>
            </>
          )}
        </div>

        {/* Playback + submit */}
        {recorder.isStopped && recorder.audioUrl && (
          <div className="mt-6 space-y-4">
            <audio controls src={recorder.audioUrl} className="w-full" />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button onClick={recorder.discard}
                className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm">
                <Trash2 className="w-4 h-4" />
                Discard
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing your recording…</> : <><Send className="w-4 h-4" />Submit for analysis</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
