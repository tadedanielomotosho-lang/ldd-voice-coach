'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSupabasePublicEnv } from '@/lib/env'

function configError() {
  return {
    error:
      'App is not configured for sign-in yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.',
  }
}

export async function signInAction(formData: FormData) {
  if (!getSupabasePublicEnv().isConfigured) return configError()

  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message = error.message === 'Invalid login credentials'
        ? 'Invalid email or password. Try again, use Forgot password, or create a new account.'
        : error.message
      return { error: message }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sign in failed. Please try again.' }
  }

  redirect('/dashboard')
}

export async function signUpAction(formData: FormData) {
  if (!getSupabasePublicEnv().isConfigured) return configError()

  const fullName = String(formData.get('fullName') || '').trim()
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')

  if (!fullName || !email || !password) {
    return { error: 'All fields are required.' }
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) return { error: error.message }
    if (!data.session) {
      return { error: 'Account created. Check your email to confirm, then sign in.' }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sign up failed. Please try again.' }
  }

  redirect('/dashboard')
}
