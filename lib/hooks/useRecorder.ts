'use client'
import { useState, useRef, useCallback } from 'react'

type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped'

export function useRecorder() {
  const [state,    setState]    = useState<RecorderState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl,  setAudioUrl]  = useState<string | null>(null)
  const [mimeType,  setMimeType]  = useState<string>('audio/webm')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<NodeJS.Timeout | null>(null)
  const streamRef        = useRef<MediaStream | null>(null)

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const start = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser.')
    }
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Audio recording is not supported in this browser.')
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const supported = [
        'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'
      ].find(t => MediaRecorder.isTypeSupported(t)) || ''

      setMimeType(supported || 'audio/webm')
      const mr = new MediaRecorder(stream, supported ? { mimeType: supported } : {})
      mediaRecorderRef.current = mr
      chunksRef.current = []
      setAudioBlob(null)
      setAudioUrl(null)
      setDuration(0)

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: supported || 'audio/webm' })
        const url  = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        setState('stopped')
        stopTimer()
        stream.getTracks().forEach(t => t.stop())
      }

      mr.start(1000)
      setState('recording')
      startTimer()
    } catch (err) {
      console.error('Microphone access denied:', err)
      throw err
    }
  }, [startTimer, stopTimer])

  const pause = useCallback(() => {
    mediaRecorderRef.current?.pause()
    setState('paused')
    stopTimer()
  }, [stopTimer])

  const resume = useCallback(() => {
    mediaRecorderRef.current?.resume()
    setState('recording')
    startTimer()
  }, [startTimer])

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop()
    stopTimer()
  }, [stopTimer])

  const discard = useCallback(() => {
    stop()
    setAudioBlob(null)
    setAudioUrl(null)
    setDuration(0)
    setState('idle')
    chunksRef.current = []
  }, [stop])

  return {
    state, duration, audioBlob, audioUrl, mimeType,
    start, pause, resume, stop, discard,
    isRecording: state === 'recording',
    isPaused:    state === 'paused',
    isStopped:   state === 'stopped',
    isIdle:      state === 'idle',
  }
}
