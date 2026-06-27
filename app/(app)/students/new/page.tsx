'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

export default function NewStudentPage() {
  const router = useRouter()
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [notes,   setNotes]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email || undefined, notes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/students/${data.student.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create student')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <Link href="/students" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">
        <ArrowLeft className="w-4 h-4" />
        Back to students
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add student</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Create a new student profile</p>
      </div>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
        {error && <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm p-3 rounded-lg">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full name <span className="text-red-500">*</span></label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={100}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={500}
            placeholder="Goals, background, areas to focus on…"
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none" />
        </div>
        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</> : 'Create student'}
        </button>
      </form>
    </div>
  )
}
