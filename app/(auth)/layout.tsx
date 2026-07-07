import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupabasePublicEnv } from '@/lib/env'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (getSupabasePublicEnv().isConfigured) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) redirect('/dashboard')
    } catch {
      // Still render auth pages if the session check fails.
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">LDD Voice Coach</h1>
          <p className="text-white/60 text-sm mt-1">AI-powered communication coaching</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
