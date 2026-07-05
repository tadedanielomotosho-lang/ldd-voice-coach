'use client'
import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Upload, Mic, X, CheckCircle, Loader2, Square, Pause, Play,
  Trash2, AlertCircle,
} from 'lucide-react'
import { useRecorder } from '@/lib/hooks/useRecorder'
import { formatDuration, normalizeAudioMimeType, formatProcessError } from '@/lib/utils'
import { submitRecording } from '@/lib/client/submitRecording'

type InputMode = 'record' | 'upload'

export default function UploadPage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-6 animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg w-1/2" />
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    }>
      <UploadPageContent />
    </Suspense>
  )
}

function UploadPageContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const preselect    = searchParams.get('student')
  const fileRef      = useRef<HTMLInputElement>(null)
  const errorRef     = useRef<HTMLDivElement>(null)
  const recorder     = useRecorder()

  const [mode,        setMode]        = useState<InputMode>('record')
  const [studentName, setStudentName] = useState(preselect || '')
  const [audioFile,   setAudioFile]   = useState<File | null>(null)
  const [dragging,    setDragging]    = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [micDenied,   setMicDenied]   = useState(false)

  const hasRecording = mode === 'record' && recorder.isStopped && !!recorder.audioBlob
  const hasAudio     = mode === 'upload' ? !!audioFile : hasRecording
  const canSubmit    = hasAudio && studentName.trim().length >= 2

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  function switchMode(next: InputMode) {
    setMode(next)
    setError(null)
    setMicDenied(false)
    if (next === 'record') setAudioFile(null)
    else recorder.discard()
  }

  function handleFile(file: File) {
    const allowed = ['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-m4a','audio/aac']
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|mp4|aac)$/i)) {
      setError('Please upload an audio file (MP3, WAV, M4A, WebM, OGG, AAC)'); return
    }
    if (file.size > 26_214_400) { setError('File size must be under 25MB'); return }
    setError(null)
    setAudioFile(file)
  }

  async function handleStartRecording() {
    try {
      setMicDenied(false)
      setError(null)
      await recorder.start()
    } catch {
      setMicDenied(true)
    }
  }

  function getAudioFile(): File | null {
    if (mode === 'upload') return audioFile
    if (!recorder.audioBlob) return null
    const ext = recorder.mimeType.includes('mp4') ? 'mp4'
      : recorder.mimeType.includes('ogg') ? 'ogg' : 'webm'
    return new File([recorder.audioBlob], `recording.${ext}`, { type: normalizeAudioMimeType(recorder.mimeType) })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = getAudioFile()
    const trimmed = studentName.trim()
    if (!file || !trimmed) {
      setError('Please enter a student name and add a recording'); return
    }
    if (trimmed.length < 2) {
      setError('Student name must be at least 2 characters'); return
    }
    setSubmitting(true)
    setError(null)
    try {
      const sessionId = await submitRecording(file, trimmed)
      router.push(`/reports/${sessionId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed'
      if (msg === 'SESSION_EXPIRED') {
        router.push('/login?reason=session-expired')
        return
      }
      setError(formatProcessError(msg))
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New session</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Record live or upload an audio file for AI analysis</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div ref={errorRef} className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm p-3 rounded-lg">
            {error}
          </div>
        )}

        {micDenied && (
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 p-4 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Microphone access denied. Please allow microphone access in your browser settings and try again.
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Student name</label>
            <input type="text" required minLength={2} value={studentName} onChange={e => setStudentName(e.target.value)}
              placeholder="e.g. Sarah Johnson (at least 2 characters)" maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button type="button" onClick={() => switchMode('record')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              mode === 'record'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            <Mic className="w-4 h-4" />
            Record live
          </button>
          <button type="button" onClick={() => switchMode('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-brand-600 text-white'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            <Upload className="w-4 h-4" />
            Upload file
          </button>
        </div>

        {mode === 'record' ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="text-center mb-6">
              <div className="text-5xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                {formatDuration(recorder.duration)}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 capitalize">
                {recorder.isIdle ? 'Ready to record' : recorder.state}
              </p>
            </div>

            {recorder.isRecording && (
              <div className="flex items-center justify-center gap-2 mb-5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">Recording</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              {recorder.isIdle && (
                <button type="button" onClick={handleStartRecording}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                  <Mic className="w-5 h-5" />
                  Start recording
                </button>
              )}
              {recorder.isRecording && (
                <>
                  <button type="button" onClick={recorder.pause}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium px-5 py-2.5 rounded-xl transition-colors">
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                  <button type="button" onClick={recorder.stop}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-medium px-5 py-2.5 rounded-xl transition-colors">
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
              {recorder.isPaused && (
                <>
                  <button type="button" onClick={recorder.resume}
                    className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors">
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                  <button type="button" onClick={recorder.stop}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-medium px-5 py-2.5 rounded-xl transition-colors">
                    <Square className="w-4 h-4" />
                    Stop
                  </button>
                </>
              )}
            </div>

            {hasRecording && recorder.audioUrl && (
              <div className="mt-6 space-y-3">
                <audio controls src={recorder.audioUrl} className="w-full" />
                <button type="button" onClick={recorder.discard}
                  className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm">
                  <Trash2 className="w-4 h-4" />
                  Discard recording
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950' :
              audioFile ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950' :
                          'border-gray-300 dark:border-gray-700 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            {audioFile ? (
              <div className="flex items-center justify-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{audioFile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); setAudioFile(null) }}
                  className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">Drop audio file or click to browse</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">MP3, WAV, M4A, WebM, OGG, AAC · max 25MB</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm p-3 rounded-lg">
            <p className="font-medium">Submission failed</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        <button type="submit" disabled={submitting || !canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" />Analysing your recording…</>
            : <><Mic className="w-4 h-4" />Submit for analysis</>}
        </button>
      </form>
    </div>
  )
}
