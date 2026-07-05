import type { SupabaseClient } from '@supabase/supabase-js'
import type { CachedAudio } from './processSession'

const RETRIES = 3

export async function downloadSessionAudio(
  service: SupabaseClient,
  storagePath: string,
  mimeType: string | null
): Promise<CachedAudio> {
  const filename = storagePath.split('/').pop() || 'audio.webm'
  let lastError = 'Unknown error'

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }

    const { data: fileData, error: downloadErr } = await service.storage
      .from('audio')
      .download(storagePath)

    if (!downloadErr && fileData) {
      return {
        buffer:   Buffer.from(await fileData.arrayBuffer()),
        mimeType: mimeType || 'audio/webm',
        filename,
      }
    }

    lastError = downloadErr?.message || lastError

    const { data: signed, error: signErr } = await service.storage
      .from('audio')
      .createSignedUrl(storagePath, 300)

    if (!signErr && signed?.signedUrl) {
      try {
        const response = await fetch(signed.signedUrl)
        if (response.ok) {
          return {
            buffer:   Buffer.from(await response.arrayBuffer()),
            mimeType: mimeType || 'audio/webm',
            filename,
          }
        }
        lastError = `HTTP ${response.status}`
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
      }
    } else if (signErr) {
      lastError = signErr.message
    }
  }

  throw new Error(`Failed to download audio: ${lastError}`)
}
