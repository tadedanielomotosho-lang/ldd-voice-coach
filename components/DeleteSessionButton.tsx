'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

type Props = {
  sessionId: string
  sessionName?: string
  /** After delete, go here instead of refreshing the current page */
  redirectTo?: string
  variant?: 'icon' | 'button'
}

export default function DeleteSessionButton({
  sessionId,
  sessionName,
  redirectTo,
  variant = 'icon',
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    const label = sessionName ? `"${sessionName}"` : 'this session'
    const confirmed = window.confirm(
      `Delete ${label}?\n\nThis removes the report, analysis, and audio recording. If this is the student's only session, they will also be removed from your student list. This cannot be undone.`
    )
    if (!confirmed) return

    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        router.push('/login?reason=session-expired')
        return
      }
      if (!res.ok) throw new Error(data.error || 'Delete failed')

      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
      setLoading(false)
    }
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="flex items-center gap-2 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
          : <><Trash2 className="w-4 h-4" /> Delete session</>}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      title="Delete session and free storage"
      className="flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      Delete
    </button>
  )
}
