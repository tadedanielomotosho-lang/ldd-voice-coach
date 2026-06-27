import { createClient } from '@/lib/supabase/server'
import { formatDate, formatScore, getJoinedStudent } from '@/lib/utils'
import Link from 'next/link'
import { Users, BarChart2, TrendingUp, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ count: studentCount }, { count: analysisCount }, { data: sessions }, { data: avgData }] =
    await Promise.all([
      supabase.from('students').select('*, sessions!inner(id)', { count: 'exact', head: true }).eq('tutor_id', user!.id),
      supabase.from('analyses').select('*',  { count: 'exact', head: true }).eq('tutor_id', user!.id),
      supabase.from('sessions')
        .select('id, session_name, presentation_topic, status, created_at, students(name)')
        .eq('tutor_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('analyses').select('overall_score').eq('tutor_id', user!.id),
    ])

  const avgScore = avgData && avgData.length > 0
    ? Math.round(avgData.reduce((s, r) => s + Number(r.overall_score), 0) / avgData.length)
    : 0

  const stats = [
    { label: 'Total students',  value: studentCount || 0, icon: Users,     color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950'    },
    { label: 'Total analyses',  value: analysisCount || 0,icon: BarChart2, color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-950'},
    { label: 'Average score',   value: `${avgScore}%`,    icon: TrendingUp,color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950'},
  ]

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      done:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
      processing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
      pending:    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
      error:      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    }
    return map[s] || map.pending
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Overview of your coaching activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent sessions */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Recent sessions</h2>
          <Link href="/reports" className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400">View all</Link>
        </div>
        {!sessions?.length ? (
          <div className="px-6 py-12 text-center">
            <Clock className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No sessions yet.</p>
            <Link href="/upload" className="inline-block mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium">Upload your first recording</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sessions.map((s) => {
              const student = getJoinedStudent(s.students)
              return (
                <div key={s.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.session_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {student?.name} · {s.presentation_topic}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(s.status)}`}>
                      {s.status}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(s.created_at)}</span>
                    {s.status === 'done' && (
                      <Link href={`/reports/${s.id}`} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium">
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
