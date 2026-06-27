import { createClient, createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate, getInitials } from '@/lib/utils'
import { UserPlus, ChevronRight } from 'lucide-react'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Remove auto-created students that no longer have any sessions
  const service = createServiceClient()
  const { data: allStudents } = await service
    .from('students')
    .select('id, sessions(id)')
    .eq('tutor_id', user!.id)

  const orphanIds = (allStudents ?? [])
    .filter(s => !(s.sessions as { id: string }[])?.length)
    .map(s => s.id)

  if (orphanIds.length) {
    await service.from('students').delete().in('id', orphanIds).eq('tutor_id', user!.id)
  }

  const { data: students } = await supabase
    .from('students')
    .select('*, sessions!inner(id)')
    .eq('tutor_id', user!.id)
    .order('name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Students</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{students?.length || 0} students enrolled</p>
        </div>
        <Link href="/students/new"
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <UserPlus className="w-4 h-4" />
          Add student
        </Link>
      </div>

      {!students?.length ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-6 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400">No students yet. Add your first student to get started.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {students.map((s) => {
            const sessions = s.sessions as { id: string }[]
            return (
              <Link key={s.id} href={`/students/${s.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center text-brand-700 dark:text-brand-300 text-sm font-semibold shrink-0">
                  {getInitials(s.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{s.email || 'No email'} · {sessions?.length || 0} sessions</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span>{formatDate(s.created_at)}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
