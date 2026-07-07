'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signInAction } from '../actions'

function LoginForm() {
  const searchParams = useSearchParams()
  const sessionExpired = searchParams.get('reason') === 'session-expired'
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await signInAction(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Welcome back</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to your coach account</p>
      </div>
      {sessionExpired && (
        <div className="bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-sm p-3 rounded-lg border border-amber-200 dark:border-amber-800">
          Your session expired. Please sign in again, then retry your recording.
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm p-3 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
          <input type="email" name="email" required
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
          <input type="password" name="password" required
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition" />
        </div>
      </div>
      <div className="flex items-center justify-end">
        <Link href="/reset-password" className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Forgot password?
        </Link>
      </div>
      <button type="submit" disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        No account?{' '}
        <Link href="/signup" className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium">
          Create one
        </Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5 animate-pulse">
        <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
