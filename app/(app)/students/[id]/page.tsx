import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, getInitials, scoreColor } from '@/lib/utils'
import { ArrowLeft, FileText } from 'lucide-react'

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === 'new') return null // handled by separate page

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .eq('tutor_id', user!.id)
    .single()

  if (!student) notFound()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, session_name, presentation_topic, status, created_at, analyses(overall_score)')
    .eq('student_id', id)
    .order('created_at', { ascending: false })

  const completedSessions = sessions?.filter(s => s.status === 'done') || []
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((sum, s) => {
        const a = s.analyses as { overall_score: number }[] | null
        return sum + (a?.[0]?.overall_score || 0)
      }, 0) / completedSessions.length)
    : null

  return (
    <div className="space-y-6">
      <Link href="/students" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        <ArrowLeft className="w-4 h-4" />
        Back to students
      </Link>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 dark:text-brand-300 text-lg font-semibold">
          {getInitials(student.name)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{student.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{student.email || 'No email'} · Enrolled {formatDate(student.created_at)}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {avgScore !== null && (
            <div className="text-center px-4 py-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              <p className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Average score</p>
            </div>
          )}
          <Link href={`/upload?student=${encodeURIComponent(student.name)}`}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            New session
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Session history</h2>
        </div>
        {!sessions?.length ? (
          <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
            No sessions yet for this student.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sessions.map(s => {
              const analysis = (s.analyses as { overall_score: number }[] | null)?.[0]
              return (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{s.session_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.presentation_topic}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm shrink-0">
                    {analysis && (
                      <span className={`font-semibold ${scoreColor(analysis.overall_score)}`}>
                        {Math.round(analysis.overall_score)}%
                      </span>
                    )}
                    <span className="text-gray-400 text-xs">{formatDate(s.created_at)}</span>
                    {s.status === 'done' && (
                      <Link href={`/reports/${s.id}`} className="text-brand-600 hover:text-brand-700 dark:text-brand-400 text-xs font-medium">
                        View report
                      </Link>
                    )}
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
