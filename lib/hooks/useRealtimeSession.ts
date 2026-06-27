'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SessionStatus } from '@/types'

export function useRealtimeSession(sessionId: string | null) {
  const [status, setStatus] = useState<SessionStatus | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const supabase = createClient()

    // Initial fetch
    supabase
      .from('sessions')
      .select('status')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => { if (data) setStatus(data.status as SessionStatus) })

    // Realtime subscription
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          setStatus((payload.new as { status: SessionStatus }).status)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  return status
}
