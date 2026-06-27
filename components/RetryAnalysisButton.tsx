'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'

export default function RetryAnalysisButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRetry() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/process`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Retry failed')
        setLoading(false)
        return
      }
      router.push(`/reports/${sessionId}`)
      router.refresh()
    } catch {
      alert('Retry failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-400 text-xs font-medium disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      Retry
    </button>
  )
}
