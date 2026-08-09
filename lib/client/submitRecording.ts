import { formatProcessError } from '@/lib/utils'
import { getAudioDurationSeconds } from '@/lib/client/audioDuration'

/** Upload recording, start analysis with in-memory audio (avoids storage re-download). */
export async function submitRecording(
  file: File,
  studentName: string,
  options?: { durationSeconds?: number | null }
): Promise<string> {
  const measured =
    options?.durationSeconds && options.durationSeconds > 0
      ? Math.round(options.durationSeconds)
      : await getAudioDurationSeconds(file)

  const fd = new FormData()
  fd.append('audio_file', file)
  fd.append(
    'data',
    JSON.stringify({
      student_name: studentName.trim(),
      ...(measured ? { audio_duration_seconds: measured } : {}),
    })
  )

  const res = await fetch('/api/sessions', { method: 'POST', body: fd, credentials: 'same-origin' })
  const data = await res.json()

  if (res.status === 401) throw new Error('SESSION_EXPIRED')
  if (!res.ok) throw new Error(formatProcessError(data.error || 'Submission failed'))

  const sessionId = data.session.id as string

  const processFd = new FormData()
  processFd.append('audio_file', file)
  void fetch(`/api/sessions/${sessionId}/process`, {
    method:      'POST',
    body:        processFd,
    credentials: 'same-origin',
  })

  return sessionId
}
