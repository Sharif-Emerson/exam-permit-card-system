import { useCallback, useEffect, useState } from 'react'
import { LogOut, RefreshCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchStudentProfilesPage, getDataConfigError } from '../services/profileService'
import type { StudentProfile } from '../types'

export default function AdminPanel() {
  const { user, signOut, loading: authLoading, configError: authConfigError } = useAuth()
  const navigate = useNavigate()
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const configError = authConfigError ?? getDataConfigError()

  const loadStudents = useCallback(async () => {
    if (configError) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const page = await fetchStudentProfilesPage({ page: 1, pageSize: 100 })
      setStudents(page.items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load students')
    } finally {
      setLoading(false)
    }
  }, [configError])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (authLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">Loading…</p>
      </div>
    )
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 dark:bg-slate-950">
        <p className="text-red-600 dark:text-red-400">{configError}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 dark:bg-slate-950">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Administration</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {user?.name} · {user?.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadStudents()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      {error ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-200 px-4 py-3 text-lg font-semibold text-slate-900 dark:border-slate-800 dark:text-white">
          Students
        </h2>
        {loading ? (
          <p className="p-6 text-sm text-slate-600 dark:text-slate-300">Loading students…</p>
        ) : students.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 dark:text-slate-400">No students found.</p>
        ) : (
          <p className="border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Roster loaded from the REST API. This screen was rebuilt for the non-Supabase stack; use the student portal for permits and contact the team if you need bulk tools, messaging, or exam edits restored in admin.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Registration</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Exam</th>
                  <th className="px-4 py-3 font-medium">Venue / seat</th>
                  <th className="px-4 py-3 font-medium text-right">Paid</th>
                  <th className="px-4 py-3 font-medium text-right">Fees</th>
                  <th className="px-4 py-3 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((s) => (
                  <tr key={s.id} className="text-slate-800 dark:text-slate-200">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3">{s.email}</td>
                    <td className="px-4 py-3">{s.studentId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{s.phoneNumber?.trim() || '—'}</td>
                    <td className="px-4 py-3 max-w-[10rem] truncate" title={s.department}>
                      {s.department?.trim() || '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[12rem] truncate" title={s.course}>
                      {s.course?.trim() || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.examDate?.trim() ? `${s.examDate}${s.examTime ? ` · ${s.examTime}` : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[10rem] truncate" title={`${s.venue} ${s.seatNumber}`}>
                      {[s.venue, s.seatNumber].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.amountPaid.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.totalFees.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.feesBalance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
