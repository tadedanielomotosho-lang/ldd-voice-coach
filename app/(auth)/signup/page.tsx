'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } }
      })
      if (error) { setError(error.message); setLoading(false); return }
      if (!data.session) {
        setError('Account created. Check your email to confirm, then sign in.')
        setLoading(false)
        return
      }
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create your account</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start coaching with AI analysis</p>
      </div>
      {error && (
        <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm p-3 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full name</label>
          <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
          <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition" />
        </div>
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium">Sign in</Link>
      </p>
    </form>
  )
}
