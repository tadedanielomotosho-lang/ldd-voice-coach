'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'

import { formatProcessError } from '@/lib/utils'

type Props = {
  sessionId: string
  /** When true, deletes the prior analysis and regenerates with the latest coaching rubric. */
  force?: boolean
  label?: string
  className?: string
}

export default function RetryAnalysisButton({
  sessionId,
  force = false,
  label,
  className,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRetry() {
    if (force) {
      const ok = window.confirm(
        'Re-analyse this recording with the latest coaching feedback? This replaces the current report.'
      )
      if (!ok) return
    }

    setLoading(true)
    try {
      const url = force
        ? `/api/sessions/${sessionId}/process?force=1`
        : `/api/sessions/${sessionId}/process`
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const data = await res.json()
        alert(formatProcessError(data.error || 'Retry failed'))
        setLoading(false)
        return
      }
      router.refresh()
      window.location.reload()
    } catch {
      alert('Retry failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className={
        className ||
        'flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-400 text-xs font-medium disabled:opacity-50'
      }
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      {label || (force ? 'Re-analyse with latest feedback' : 'Retry')}
    </button>
  )
}
