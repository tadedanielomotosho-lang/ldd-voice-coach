import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate, scoreColor, getJoinedStudent } from '@/lib/utils'
import { FileText, ChevronRight } from 'lucide-react'
import RetryAnalysisButton from '@/components/RetryAnalysisButton'
import DeleteSessionButton from '@/components/DeleteSessionButton'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, session_name, presentation_topic, status, created_at, students(name), analyses(overall_score, content_score, delivery_score)')
    .eq('tutor_id', user!.id)
    .order('created_at', { ascending: false })

  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      done:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
      processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      pending:    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
      error:      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    }
    return m[s] || m.pending
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{sessions?.length || 0} total sessions</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        {!sessions?.length ? (
          <div className="px-6 py-16 text-center">
            <FileText className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No sessions yet.</p>
            <Link href="/upload" className="inline-block mt-3 text-sm text-brand-600 font-medium">Upload your first recording</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sessions.map(s => {
              const student  = getJoinedStudent(s.students)
              const analysis = (s.analyses as { overall_score: number; content_score: number; delivery_score: number }[] | null)?.[0]
              return (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{s.session_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {student?.name} · {s.presentation_topic}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-sm">
                    {analysis && (
                      <div className="flex items-center gap-3 text-xs">
                        <span className={`font-semibold text-base ${scoreColor(analysis.overall_score)}`}>
                          {Math.round(analysis.overall_score)}%
                        </span>
                      </div>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(s.status)}`}>{s.status}</span>
                    <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                    {s.status === 'done' ? (
                      <Link href={`/reports/${s.id}`} className="flex items-center gap-1 text-brand-600 hover:text-brand-700 dark:text-brand-400 text-xs font-medium">
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : s.status === 'error' ? (
                      <RetryAnalysisButton sessionId={s.id} />
                    ) : (
                      <Link href={`/reports/${s.id}`} className="text-brand-600 hover:text-brand-700 dark:text-brand-400 text-xs font-medium">
                        View
                      </Link>
                    )}
                    <DeleteSessionButton sessionId={s.id} sessionName={s.session_name} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
