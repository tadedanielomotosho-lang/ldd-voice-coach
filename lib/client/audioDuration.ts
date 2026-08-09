/** Read duration in seconds from an audio File (browser metadata). */
export function getAudioDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'

    const finish = (value: number | null) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }

    audio.onloadedmetadata = () => {
      const d = audio.duration
      if (!Number.isFinite(d) || d <= 0) {
        finish(null)
        return
      }
      finish(Math.max(1, Math.round(d)))
    }
    audio.onerror = () => finish(null)
    audio.src = url
  })
}
