/** Fallback estimate when audio metadata is unavailable (~150 wpm). */
export function estimateDurationFromWords(wordCount: number): number {
  if (!wordCount || wordCount < 1) return 0
  return Math.max(1, Math.round((wordCount / 150) * 60))
}
