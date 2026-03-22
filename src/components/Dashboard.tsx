import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { LogOut, RefreshCcw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiBaseUrl } from '../config/provider'
import { fetchStudentProfileById, recordPermitActivity } from '../services/profileService'
import type { StudentProfile } from '../types'
import PermitCard from './PermitCard'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [studentData, setStudentData] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')

  useEffect(() => {
    async function loadStudentProfile() {
      if (!user || user.role !== 'student') {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError('')
        const profile = await fetchStudentProfileById(user.id)
        setStudentData(profile)
      } catch (loadError) {
        const nextError = loadError instanceof Error ? loadError.message : 'Unable to load your permit'
        setError(nextError)
      } finally {
        setLoading(false)
      }
    }

    void loadStudentProfile()
  }, [user])

  async function handleRefresh() {
    if (!user || user.role !== 'student') {
      return
    }

    try {
      setLoading(true)
      setError('')
      const profile = await fetchStudentProfileById(user.id)
      setStudentData(profile)
    } catch (refreshError) {
      const nextError = refreshError instanceof Error ? refreshError.message : 'Unable to refresh permit details'
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }

  function openPrintDialog() {
    if (typeof window === 'undefined') {
      return
    }

    const nextTitle = studentData ? `Exam_Pro_Permit_${studentData.name.replace(/\s+/g, '_')}` : 'Exam_Pro_Permit'
    const previousTitle = document.title
    document.title = nextTitle
    window.print()
    document.title = previousTitle
  }

  async function handlePrint() {
    if (!studentData || studentData.feesBalance > 0) {
      return
    }

    try {
      await recordPermitActivity(studentData.id, 'print_permit')
    } catch {
      // Ignore tracking failures so students can still print.
    }

    openPrintDialog()
  }

  const handleDownload = async () => {
    if (!studentData || studentData.feesBalance > 0) {
      return
    }

    try {
      await recordPermitActivity(studentData.id, 'download_permit')
    } catch {
      // Ignore tracking failures so students can still download.
    }

    openPrintDialog()
  }

  const qrValue = studentData
    ? apiBaseUrl
      ? `${apiBaseUrl}/permits/${encodeURIComponent(studentData.permitToken)}`
      : `permit:${studentData.permitToken}`
    : ''

  useEffect(() => {
    let cancelled = false

    async function buildQrCode() {
      if (!qrValue) {
        setQrCodeUrl('')
        return
      }

      try {
        const nextUrl = await QRCode.toDataURL(qrValue, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 160,
        })

        if (!cancelled) {
          setQrCodeUrl(nextUrl)
        }
      } catch {
        if (!cancelled) {
          setQrCodeUrl('')
        }
      }
    }

    void buildQrCode()

    return () => {
      cancelled = true
    }
  }, [qrValue])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600">Loading exam permit...</p>
        </div>
      </div>
    )
  }

  if (error || !studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-100 p-6 text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to load your permit</h2>
          <p className="text-sm text-slate-600 mb-4">{error || 'No student record was found for this account.'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center gap-2 bg-slate-200 text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <PermitCard studentData={studentData} qrCodeUrl={qrCodeUrl} onRefresh={handleRefresh} onSignOut={() => void signOut()} onPrint={handlePrint} onDownload={handleDownload} />
}