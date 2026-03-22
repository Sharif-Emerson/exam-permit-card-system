import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, LogOut, RefreshCcw, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { clearStudentBalance, fetchAllStudentProfiles, updateStudentFinancials } from '../services/profileService'
import type { StudentProfile } from '../types'

type PaymentDrafts = Record<string, string>

export default function AdminPanel() {
  const { user, signOut } = useAuth()
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [paymentDrafts, setPaymentDrafts] = useState<PaymentDrafts>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    void loadStudents()
  }, [])

  async function loadStudents() {
    try {
      setLoading(true)
      setError('')
      const nextStudents = await fetchAllStudentProfiles()
      setStudents(nextStudents)
      setPaymentDrafts(
        nextStudents.reduce<PaymentDrafts>((drafts, student) => {
          drafts[student.id] = student.amountPaid.toFixed(2)
          return drafts
        }, {}),
      )
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load students'
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePayment(event: FormEvent<HTMLFormElement>, student: StudentProfile) {
    event.preventDefault()

    if (!user) {
      return
    }

    const draftValue = Number(paymentDrafts[student.id])

    if (Number.isNaN(draftValue) || draftValue < 0) {
      setError('Amount paid must be a valid positive number.')
      return
    }

    try {
      setSavingId(student.id)
      setError('')
      setSuccessMessage('')
      await updateStudentFinancials(student.id, { amountPaid: draftValue }, user.id)
      await loadStudents()
      setSuccessMessage(`Saved payment update for ${student.name}.`)
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to save payment changes'
      setError(nextError)
    } finally {
      setSavingId(null)
    }
  }

  async function handleClear(student: StudentProfile) {
    if (!user) {
      return
    }

    try {
      setSavingId(student.id)
      setError('')
      setSuccessMessage('')
      await clearStudentBalance(student.id, user.id)
      await loadStudents()
      setSuccessMessage(`${student.name} has been cleared for printing.`)
    } catch (clearError) {
      const nextError = clearError instanceof Error ? clearError.message : 'Unable to clear student balance'
      setError(nextError)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading student accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Administration</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Student Clearance Control</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => void loadStudents()}
              className="flex items-center justify-center px-3 sm:px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-lg hover:bg-slate-50 transition-colors text-sm sm:text-base"
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center justify-center px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
        {error && (
          <div className="mb-4 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-4 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm">
            {successMessage}
          </div>
        )}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow border border-slate-200">
          <h2 className="text-lg sm:text-xl mb-4">Students</h2>
          <div className="space-y-3 sm:space-y-2">
            {students.map(student => (
              <div key={student.id} className="p-4 sm:p-5 bg-gray-50 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm sm:text-base truncate">{student.name}</div>
                    <div className="text-xs sm:text-sm text-gray-600 mb-2">ID: {student.id} | {student.email}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <span className="text-gray-600">Total:</span>
                        <span className="font-semibold ml-1">${student.totalFees.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Paid:</span>
                        <span className="font-semibold ml-1 text-green-600">${student.amountPaid.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Balance:</span>
                        <span className={`font-semibold ml-1 ${student.feesBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${student.feesBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                      <progress
                        className={`payment-progress ${student.feesBalance > 0 ? 'payment-progress-danger' : 'payment-progress-clear'}`}
                        value={Math.min((student.amountPaid / student.totalFees) * 100, 100)}
                        max={100}
                      />
                    </div>
                    <form className="mt-4 flex flex-col lg:flex-row gap-3" onSubmit={(event) => void handleSavePayment(event, student)}>
                      <label className="flex-1">
                        <span className="block text-xs font-medium text-slate-600 mb-1">Amount Paid</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={paymentDrafts[student.id] ?? ''}
                          onChange={(event) => setPaymentDrafts((current) => ({ ...current, [student.id]: event.target.value }))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                      </label>
                      <div className="flex gap-3 items-end">
                        <button
                          type="submit"
                          disabled={savingId === student.id}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={savingId === student.id || student.feesBalance === 0}
                          onClick={() => void handleClear(student)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Clear Student
                        </button>
                      </div>
                    </form>
                  </div>
                  <div className="flex-shrink-0">
                    {student.feesBalance > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded whitespace-nowrap">
                        Outstanding
                      </span>
                    )}
                    {student.feesBalance === 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded whitespace-nowrap">
                        Paid
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}