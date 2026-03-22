import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  Bell,
  Download,
  FileBadge2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldClose,
  Sun,
  Upload,
  UserCircle2,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiBaseUrl } from '../config/provider'
import { fetchStudentProfileById, recordPermitActivity, updateStudentAccount } from '../services/profileService'
import type { StudentProfile } from '../types'
import { FALLBACK_PROFILE_IMAGE } from './PermitCard'

type PermitStatus = 'approved' | 'pending' | 'rejected'
type PortalSection = 'overview' | 'applications' | 'settings' | 'support'
type HistoryStatusFilter = PermitStatus | 'all'

type PermitApplicationRecord = {
  id: string
  createdAt: string
  semester: string
  status: PermitStatus
  remarks: string
  courseUnits: string[]
  documents: string[]
}

type NotificationItem = {
  id: string
  title: string
  message: string
  tone: 'blue' | 'green' | 'yellow' | 'red'
  createdAt: string
}

type SettingsDraft = {
  name: string
  email: string
  profileImage: string
  password: string
  confirmPassword: string
}

type ApplicationDraft = {
  semester: string
  courseUnits: string
  documents: string[]
}

const portalSections: Array<{ key: PortalSection; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'applications', label: 'Applications', icon: FileText },
  { key: 'settings', label: 'Profile Settings', icon: Settings2 },
  { key: 'support', label: 'Help & Support', icon: FileText },
]

function getHistoryStorageKey(userId: string) {
  return `student-portal-history:${userId}`
}

function getDarkModeStorageKey(userId: string) {
  return `student-portal-dark:${userId}`
}

function readApplicationHistory(userId: string): PermitApplicationRecord[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(getHistoryStorageKey(userId))

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is PermitApplicationRecord => {
      return Boolean(
        item
        && typeof item === 'object'
        && typeof item.id === 'string'
        && typeof item.createdAt === 'string'
        && typeof item.semester === 'string'
        && (item.status === 'approved' || item.status === 'pending' || item.status === 'rejected')
        && typeof item.remarks === 'string'
        && Array.isArray(item.courseUnits)
        && Array.isArray(item.documents),
      )
    })
  } catch {
    return []
  }
}

function writeApplicationHistory(userId: string, history: PermitApplicationRecord[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(history))
}

function deriveSemesterLabel(dateValue?: string) {
  const date = dateValue ? new Date(dateValue) : new Date()
  const month = Number.isNaN(date.getTime()) ? new Date().getMonth() : date.getMonth()

  if (month <= 3) {
    return 'First Semester'
  }

  if (month <= 7) {
    return 'Second Semester'
  }

  return 'Special Session'
}

function deriveAcademicSession(dateValue?: string) {
  const date = dateValue ? new Date(dateValue) : new Date()
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear()
  return `${year}/${year + 1}`
}

function deriveStatus(student: StudentProfile, history: PermitApplicationRecord[]): PermitStatus {
  const latestApplication = history[0]

  if (latestApplication?.status === 'rejected') {
    return 'rejected'
  }

  if (latestApplication?.status === 'pending') {
    return 'pending'
  }

  if (student.feesBalance === 0 && student.exams.length > 0) {
    return 'approved'
  }

  return 'pending'
}

function buildNotifications(student: StudentProfile, history: PermitApplicationRecord[], permitStatus: PermitStatus): NotificationItem[] {
  const baseNotifications: NotificationItem[] = []

  if (permitStatus === 'approved') {
    baseNotifications.push({
      id: 'approved-status',
      title: 'Permit approved',
      message: 'Your exam permit is available for download and printing.',
      tone: 'green',
      createdAt: new Date().toISOString(),
    })
  }

  if (permitStatus === 'pending') {
    baseNotifications.push({
      id: 'pending-status',
      title: 'Permit under review',
      message: student.feesBalance > 0
        ? 'Your permit remains pending until outstanding fees are cleared.'
        : 'Your latest permit request is being reviewed.',
      tone: 'yellow',
      createdAt: new Date().toISOString(),
    })
  }

  if (permitStatus === 'rejected') {
    baseNotifications.push({
      id: 'rejected-status',
      title: 'Permit application rejected',
      message: history[0]?.remarks || 'Please review the remarks and submit again.',
      tone: 'red',
      createdAt: history[0]?.createdAt || new Date().toISOString(),
    })
  }

  if (student.exams.length > 0) {
    baseNotifications.push({
      id: 'exam-ready',
      title: 'Exam details updated',
      message: `You have ${student.exams.length} scheduled exam${student.exams.length === 1 ? '' : 's'} on your permit card.`,
      tone: 'blue',
      createdAt: new Date().toISOString(),
    })
  }

  return [
    ...history.slice(0, 3).map((item): NotificationItem => ({
      id: item.id,
      title: `Application ${item.status}`,
      message: item.remarks,
      tone: item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'yellow',
      createdAt: item.createdAt,
    })),
    ...baseNotifications,
  ]
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value || 'Not scheduled'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getStatusPresentation(status: PermitStatus) {
  if (status === 'approved') {
    return {
      label: 'Approved',
      icon: ShieldCheck,
      cardClass: 'border-green-200 bg-green-50 text-green-900',
      badgeClass: 'bg-green-600 text-white',
      message: 'Your permit is ready. Download or print it before your exam date.',
    }
  }

  if (status === 'rejected') {
    return {
      label: 'Rejected',
      icon: ShieldClose,
      cardClass: 'border-red-200 bg-red-50 text-red-900',
      badgeClass: 'bg-red-600 text-white',
      message: 'Your last submission needs correction. Review the remarks and try again.',
    }
  }

  return {
    label: 'Pending',
    icon: ShieldAlert,
    cardClass: 'border-amber-200 bg-amber-50 text-amber-900',
    badgeClass: 'bg-amber-500 text-white',
    message: 'Your permit is pending review. Keep your profile and fee information up to date.',
  }
}

function getNotificationToneClasses(tone: NotificationItem['tone']) {
  if (tone === 'green') {
    return 'border-green-200 bg-green-50 text-green-800'
  }

  if (tone === 'yellow') {
    return 'border-amber-200 bg-amber-50 text-amber-800'
  }

  if (tone === 'red') {
    return 'border-red-200 bg-red-50 text-red-800'
  }

  return 'border-blue-200 bg-blue-50 text-blue-800'
}

export default function Dashboard() {
  const { user, signOut, refreshUser } = useAuth()
  const [studentData, setStudentData] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [activeSection, setActiveSection] = useState<PortalSection>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [applicationHistory, setApplicationHistory] = useState<PermitApplicationRecord[]>([])
  const [darkMode, setDarkMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all')
  const [semesterFilter, setSemesterFilter] = useState('all')
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft>({
    semester: `${deriveAcademicSession()} ${deriveSemesterLabel()}`,
    courseUnits: '',
    documents: [],
  })
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    name: '',
    email: '',
    profileImage: '',
    password: '',
    confirmPassword: '',
  })

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
        setSettingsDraft({
          name: profile.name,
          email: profile.email,
          profileImage: profile.profileImage,
          password: '',
          confirmPassword: '',
        })
        setApplicationHistory(readApplicationHistory(user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))

        if (typeof window !== 'undefined') {
          setDarkMode(window.localStorage.getItem(getDarkModeStorageKey(user.id)) === 'true')
        }
      } catch (loadError) {
        const nextError = loadError instanceof Error ? loadError.message : 'Unable to load your dashboard'
        setError(nextError)
      } finally {
        setLoading(false)
      }
    }

    void loadStudentProfile()
  }, [user])

  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(getDarkModeStorageKey(user.id), String(darkMode))
  }, [darkMode, user])

  useEffect(() => {
    if (!user) {
      return
    }

    writeApplicationHistory(user.id, applicationHistory)
  }, [applicationHistory, user])

  async function handleRefresh() {
    if (!user || user.role !== 'student') {
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccessMessage('')
      const profile = await fetchStudentProfileById(user.id)
      setStudentData(profile)
      setSettingsDraft((current) => ({
        ...current,
        name: profile.name,
        email: profile.email,
        profileImage: profile.profileImage,
      }))
    } catch (refreshError) {
      const nextError = refreshError instanceof Error ? refreshError.message : 'Unable to refresh dashboard details'
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
      // Keep printing available even if telemetry fails.
    }

    openPrintDialog()
  }

  async function handleDownload() {
    if (!studentData || studentData.feesBalance > 0) {
      return
    }

    try {
      await recordPermitActivity(studentData.id, 'download_permit')
    } catch {
      // Keep downloads available even if telemetry fails.
    }

    openPrintDialog()
  }

  function handleDocumentSelection(event: ChangeEvent<HTMLInputElement>) {
    const documents = Array.from(event.target.files ?? []).map((file) => file.name)
    setApplicationDraft((current) => ({ ...current, documents }))
  }

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!studentData || !user) {
      return
    }

    const courseUnits = applicationDraft.courseUnits
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean)

    if (courseUnits.length === 0) {
      setError('Add at least one course unit before submitting your permit request.')
      return
    }

    setSubmittingApplication(true)
    setError('')
    setSuccessMessage('')

    const nextStatus: PermitStatus = studentData.feesBalance === 0 && studentData.exams.length > 0 ? 'approved' : 'pending'
    const nextRecord: PermitApplicationRecord = {
      id: `${user.id}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      semester: applicationDraft.semester,
      status: nextStatus,
      remarks: nextStatus === 'approved'
        ? 'Submitted and matched to your cleared permit record.'
        : studentData.feesBalance > 0
          ? 'Submitted. Outstanding fees must be cleared before approval.'
          : 'Submitted successfully and awaiting review.',
      courseUnits,
      documents: applicationDraft.documents,
    }

    setApplicationHistory((current) => [nextRecord, ...current])
    setApplicationDraft({
      semester: applicationDraft.semester,
      courseUnits: '',
      documents: [],
    })
    setSuccessMessage(nextStatus === 'approved' ? 'Permit request approved and added to your history.' : 'Permit request submitted successfully.')
    setActiveSection('applications')
    setSubmittingApplication(false)
  }

  async function handleSettingsSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!studentData || !user) {
      return
    }

    if (settingsDraft.password && settingsDraft.password !== settingsDraft.confirmPassword) {
      setError('Password confirmation does not match.')
      return
    }

    try {
      setSavingSettings(true)
      setError('')
      setSuccessMessage('')
      const updatedProfile = await updateStudentAccount(studentData.id, {
        name: settingsDraft.name,
        email: settingsDraft.email,
        profileImage: settingsDraft.profileImage || null,
        password: settingsDraft.password || undefined,
      })
      setStudentData(updatedProfile)
      await refreshUser()
      setSettingsDraft((current) => ({
        ...current,
        password: '',
        confirmPassword: '',
      }))
      setSuccessMessage('Profile settings updated successfully.')
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update your profile settings'
      setError(nextError)
    } finally {
      setSavingSettings(false)
    }
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

  const permitStatus = useMemo(() => {
    return studentData ? deriveStatus(studentData, applicationHistory) : 'pending'
  }, [applicationHistory, studentData])

  const statusView = getStatusPresentation(permitStatus)
  const notifications = useMemo(() => {
    return studentData ? buildNotifications(studentData, applicationHistory, permitStatus) : []
  }, [applicationHistory, permitStatus, studentData])

  const filteredHistory = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return applicationHistory.filter((record) => {
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesSemester = semesterFilter === 'all' || record.semester === semesterFilter
      const matchesQuery = !normalizedQuery
        || record.semester.toLowerCase().includes(normalizedQuery)
        || record.remarks.toLowerCase().includes(normalizedQuery)
        || record.courseUnits.some((unit) => unit.toLowerCase().includes(normalizedQuery))

      return matchesStatus && matchesSemester && matchesQuery
    })
  }, [applicationHistory, searchQuery, semesterFilter, statusFilter])

  const availableSemesters = useMemo(() => {
    return Array.from(new Set(applicationHistory.map((record) => record.semester)))
  }, [applicationHistory])

  const profileImage = studentData?.profileImage?.trim() ? studentData.profileImage : FALLBACK_PROFILE_IMAGE
  const unreadNotifications = notifications.length
  const currentSession = applicationHistory[0]?.semester || `${deriveAcademicSession(studentData?.examDate)} ${deriveSemesterLabel(studentData?.examDate)}`

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-base text-slate-600">Loading your student dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-xl shadow-red-100/30">
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Unable to load your dashboard</h2>
          <p className="mb-5 text-sm text-slate-600">{error || 'No student record was found for this account.'}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-slate-900 transition-colors hover:bg-slate-300"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.55),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(187,247,208,0.55),_transparent_28%),linear-gradient(180deg,_#eff6ff_0%,_#f8fafc_50%,_#eefbf3_100%)] text-slate-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,_rgba(30,41,59,0.95),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(20,83,45,0.5),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#052e16_100%)] dark:text-slate-100">
        {sidebarOpen && (
          <button
            type="button"
            title="Close navigation"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          />
        )}

        <div className="flex min-h-screen">
          <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-white/60 bg-white/85 px-4 py-5 shadow-2xl shadow-slate-200/60 backdrop-blur-xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950/85 dark:shadow-none lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between px-2 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600 dark:text-blue-300">Student Portal</p>
                <h1 className="mt-1 text-xl font-semibold">Exam Permit Hub</h1>
              </div>
              <button
                type="button"
                title="Close sidebar"
                aria-label="Close sidebar"
                onClick={() => setSidebarOpen(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-6 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-emerald-50 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
              <div className="flex items-center gap-3">
                <img
                  src={profileImage}
                  alt={`${studentData.name} profile`}
                  className="h-14 w-14 rounded-2xl object-cover shadow-md"
                  onError={(event) => {
                    event.currentTarget.onerror = null
                    event.currentTarget.src = FALLBACK_PROFILE_IMAGE
                  }}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{studentData.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{studentData.studentId}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${statusView.badgeClass}`}>
                    {statusView.label}
                  </span>
                </div>
              </div>
            </div>

            <nav className="space-y-2">
              {portalSections.map((section) => {
                const Icon = section.icon

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => {
                      setActiveSection(section.key)
                      setSidebarOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all ${activeSection === section.key
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-300/60 dark:bg-emerald-500 dark:text-slate-950 dark:shadow-none'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </button>
                )
              })}
            </nav>

            <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Need help?</p>
              <p className="mt-2 text-emerald-700 dark:text-emerald-300">
                Visit Help & Support for permit guidance, document tips, and contact channels.
              </p>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 border-b border-white/60 bg-white/75 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                <button
                  type="button"
                  title="Open navigation"
                  aria-label="Open navigation"
                  onClick={() => setSidebarOpen(true)}
                  className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>

                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search applications, semesters, or remarks"
                    className="w-full rounded-full border border-white/70 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-950"
                  />
                </div>

                <button
                  type="button"
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  onClick={() => setDarkMode((current) => !current)}
                  className="rounded-full border border-slate-200 bg-white p-3 text-slate-700 shadow-sm transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>

                <div className="relative">
                  <button
                    type="button"
                    title="Notifications"
                    aria-label="Notifications"
                    onClick={() => setShowNotifications((current) => !current)}
                    className="relative rounded-full border border-slate-200 bg-white p-3 text-slate-700 shadow-sm transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadNotifications > 0 && (
                      <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-semibold text-white">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 top-14 z-30 w-[22rem] rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl shadow-slate-300/30 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold">Notifications</h2>
                        <button
                          type="button"
                          title="Close notifications"
                          aria-label="Close notifications"
                          onClick={() => setShowNotifications(false)}
                          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {notifications.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                            No notifications yet.
                          </div>
                        )}
                        {notifications.map((notification) => (
                          <div key={notification.id} className={`rounded-2xl border p-3 ${getNotificationToneClasses(notification.tone)}`}>
                            <p className="text-sm font-semibold">{notification.title}</p>
                            <p className="mt-1 text-xs leading-5">{notification.message}</p>
                            <p className="mt-2 text-[11px] opacity-80">{formatDateTime(notification.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="ml-auto flex items-center gap-3 rounded-full border border-white/70 bg-white/90 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
                  <img
                    src={profileImage}
                    alt={`${studentData.name} avatar`}
                    className="h-10 w-10 rounded-full object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = FALLBACK_PROFILE_IMAGE
                    }}
                  />
                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold">{studentData.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{studentData.course}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </header>

            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
              {(error || successMessage) && (
                <div className="mb-5 space-y-3">
                  {error && (
                    <div className="flex items-start justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                      <span>{error}</span>
                      <button
                        type="button"
                        title="Dismiss error"
                        aria-label="Dismiss error"
                        onClick={() => setError('')}
                        className="rounded-full p-1 hover:bg-red-100 dark:hover:bg-red-900/40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {successMessage && (
                    <div className="flex items-start justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <span>{successMessage}</span>
                      <button
                        type="button"
                        title="Dismiss message"
                        aria-label="Dismiss message"
                        onClick={() => setSuccessMessage('')}
                        className="rounded-full p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <section className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/40 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Welcome Section</p>
                      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome, {studentData.name}</h1>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Manage your exam permit, review status updates, and keep your profile ready for exam-day verification.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Student ID</p>
                      <p className="mt-3 text-lg font-semibold">{studentData.studentId}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Course / Program</p>
                      <p className="mt-3 text-lg font-semibold">{studentData.course || 'Not assigned'}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Year / Semester</p>
                      <p className="mt-3 text-lg font-semibold">{currentSession}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Permit Status</p>
                      <p className="mt-3 text-lg font-semibold">{statusView.label}</p>
                    </div>
                  </div>
                </div>

                <div className={`rounded-[2rem] border p-6 shadow-xl shadow-slate-200/30 ${statusView.cardClass} dark:border-current/20 dark:shadow-none`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-70">Permit Status Card</p>
                      <h2 className="mt-3 text-2xl font-semibold">{statusView.label}</h2>
                      <p className="mt-2 text-sm leading-6 opacity-90">{statusView.message}</p>
                    </div>
                    <statusView.icon className="h-10 w-10 shrink-0" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection('applications')}
                    className="mt-5 inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white dark:bg-slate-950/70 dark:text-white dark:hover:bg-slate-900"
                  >
                    Apply for Permit
                  </button>
                </div>
              </section>

              {activeSection === 'overview' && (
                <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
                  <div className="space-y-6">
                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <div className="mb-5 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Permit Card Preview</p>
                          <h2 className="mt-2 text-2xl font-semibold">Digital Exam Permit</h2>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusView.badgeClass}`}>
                          {statusView.label}
                        </span>
                      </div>

                      <div className="rounded-[2rem] border border-sky-100 bg-[linear-gradient(145deg,_rgba(239,246,255,0.96),_rgba(220,252,231,0.92))] p-5 dark:border-slate-700 dark:bg-[linear-gradient(145deg,_rgba(15,23,42,0.98),_rgba(5,46,22,0.88))]">
                        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                          <div className="flex items-center gap-4">
                            <img
                              src={profileImage}
                              alt="Student profile"
                              className="h-20 w-20 rounded-3xl object-cover shadow-lg"
                              onError={(event) => {
                                event.currentTarget.onerror = null
                                event.currentTarget.src = FALLBACK_PROFILE_IMAGE
                              }}
                            />
                            <div>
                              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Student Name</p>
                              <h3 className="mt-2 text-xl font-semibold">{studentData.name}</h3>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Registration No. {studentData.studentId}</p>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{studentData.course}</p>
                            </div>
                          </div>
                          <div className="rounded-3xl bg-white/80 p-3 shadow-sm dark:bg-slate-950/70">
                            {qrCodeUrl ? (
                              <img src={qrCodeUrl} alt="Verification QR code" className="h-28 w-28" />
                            ) : (
                              <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                QR unavailable
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                          <div className="rounded-3xl bg-white/70 p-4 dark:bg-slate-950/70">
                            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Exam Details</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                              <p>Date: {formatDate(studentData.examDate)}</p>
                              <p>Time: {studentData.examTime || 'To be announced'}</p>
                              <p>Venue: {studentData.venue || 'To be announced'}</p>
                              <p>Seat: {studentData.seatNumber || 'To be assigned'}</p>
                            </div>
                          </div>
                          <div className="rounded-3xl bg-white/70 p-4 dark:bg-slate-950/70">
                            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Fee Clearance</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                              <p>Total Fees: ${studentData.totalFees.toFixed(2)}</p>
                              <p>Amount Paid: ${studentData.amountPaid.toFixed(2)}</p>
                              <p>Balance: ${studentData.feesBalance.toFixed(2)}</p>
                              <p className={studentData.feesBalance === 0 ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-300'}>
                                {studentData.feesBalance === 0 ? 'Eligible for printing' : 'Clear outstanding fees to print'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={handleDownload}
                            disabled={studentData.feesBalance > 0}
                            className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${studentData.feesBalance > 0 ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                            title={studentData.feesBalance > 0 ? 'Please clear all outstanding fees before downloading' : 'Download permit'}
                          >
                            <Download className="h-4 w-4" />
                            Download PDF
                          </button>
                          <button
                            type="button"
                            onClick={handlePrint}
                            disabled={studentData.feesBalance > 0}
                            className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${studentData.feesBalance > 0 ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                            title={studentData.feesBalance > 0 ? 'Please clear all outstanding fees before printing' : 'Print permit'}
                          >
                            <Printer className="h-4 w-4" />
                            Print Permit
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Apply for Exam Permit</p>
                          <h2 className="mt-2 text-2xl font-semibold">Submit a new permit request</h2>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveSection('applications')}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <FileBadge2 className="h-4 w-4" />
                          Open full application view
                        </button>
                      </div>

                      <form className="mt-6 grid gap-4 lg:grid-cols-2" onSubmit={(event) => void handleApplicationSubmit(event)}>
                        <div>
                          <label htmlFor="semester" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Exam session / semester</label>
                          <input
                            id="semester"
                            type="text"
                            value={applicationDraft.semester}
                            onChange={(event) => setApplicationDraft((current) => ({ ...current, semester: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-950"
                          />
                        </div>
                        <div>
                          <label htmlFor="documents" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Upload required documents</label>
                          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:bg-slate-800">
                            <Upload className="h-4 w-4" />
                            <span>{applicationDraft.documents.length > 0 ? applicationDraft.documents.join(', ') : 'Choose files'}</span>
                            <input id="documents" type="file" multiple className="sr-only" onChange={handleDocumentSelection} />
                          </label>
                        </div>
                        <div className="lg:col-span-2">
                          <label htmlFor="courseUnits" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Course units</label>
                          <textarea
                            id="courseUnits"
                            rows={5}
                            value={applicationDraft.courseUnits}
                            onChange={(event) => setApplicationDraft((current) => ({ ...current, courseUnits: event.target.value }))}
                            placeholder="Enter one course unit per line"
                            className="w-full rounded-[1.75rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-950"
                          />
                        </div>
                        <div className="lg:col-span-2 flex justify-end">
                          <button
                            type="submit"
                            disabled={submittingApplication}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                          >
                            <FileBadge2 className="h-4 w-4" />
                            {submittingApplication ? 'Submitting...' : 'Apply for Permit'}
                          </button>
                        </div>
                      </form>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Notifications Panel</p>
                      <h2 className="mt-2 text-2xl font-semibold">Latest updates</h2>
                      <div className="mt-5 space-y-3">
                        {notifications.map((notification) => (
                          <div key={notification.id} className={`rounded-3xl border p-4 ${getNotificationToneClasses(notification.tone)}`}>
                            <p className="text-sm font-semibold">{notification.title}</p>
                            <p className="mt-1 text-sm leading-6">{notification.message}</p>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Application History</p>
                      <h2 className="mt-2 text-2xl font-semibold">Recent requests</h2>
                      <div className="mt-5 space-y-3">
                        {filteredHistory.slice(0, 3).map((record) => (
                          <div key={record.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold">{record.semester}</p>
                              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusPresentation(record.status).badgeClass}`}>
                                {record.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(record.createdAt)}</p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{record.remarks}</p>
                          </div>
                        ))}
                        {filteredHistory.length === 0 && (
                          <div className="rounded-3xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                            No applications match your filters yet.
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {activeSection === 'applications' && (
                <div className="space-y-6">
                  <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Search & Filters</p>
                        <h2 className="mt-2 text-2xl font-semibold">Filter application history</h2>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[28rem]">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Status
                          <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as HistoryStatusFilter)}
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="all">All statuses</option>
                            <option value="approved">Approved</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </label>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          Semester
                          <select
                            value={semesterFilter}
                            onChange={(event) => setSemesterFilter(event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="all">All semesters</option>
                            {availableSemesters.map((semester) => (
                              <option key={semester} value={semester}>{semester}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Apply for Exam Permit</p>
                      <h2 className="mt-2 text-2xl font-semibold">Application form</h2>
                      <form className="mt-6 space-y-4" onSubmit={(event) => void handleApplicationSubmit(event)}>
                        <div>
                          <label htmlFor="application-semester" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Exam session / semester</label>
                          <input
                            id="application-semester"
                            type="text"
                            value={applicationDraft.semester}
                            onChange={(event) => setApplicationDraft((current) => ({ ...current, semester: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label htmlFor="application-course-units" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Course units</label>
                          <textarea
                            id="application-course-units"
                            rows={6}
                            value={applicationDraft.courseUnits}
                            onChange={(event) => setApplicationDraft((current) => ({ ...current, courseUnits: event.target.value }))}
                            placeholder="CSC 401 - Compiler Construction"
                            className="w-full rounded-[1.75rem] border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label htmlFor="application-documents" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Required documents</label>
                          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            <Upload className="h-4 w-4" />
                            <span>{applicationDraft.documents.length > 0 ? applicationDraft.documents.join(', ') : 'Attach files if needed'}</span>
                            <input id="application-documents" type="file" multiple className="sr-only" onChange={handleDocumentSelection} />
                          </label>
                        </div>
                        <button
                          type="submit"
                          disabled={submittingApplication}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileBadge2 className="h-4 w-4" />
                          {submittingApplication ? 'Submitting...' : 'Apply for Permit'}
                        </button>
                      </form>
                    </section>

                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Application History</p>
                      <h2 className="mt-2 text-2xl font-semibold">Permit requests</h2>
                      <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs uppercase tracking-[0.25em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <tr>
                              <th className="px-5 py-4">Date applied</th>
                              <th className="px-5 py-4">Semester</th>
                              <th className="px-5 py-4">Status</th>
                              <th className="px-5 py-4">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredHistory.map((record) => (
                              <tr key={record.id} className="bg-white/80 dark:bg-slate-950/40">
                                <td className="px-5 py-4">{formatDateTime(record.createdAt)}</td>
                                <td className="px-5 py-4">{record.semester}</td>
                                <td className="px-5 py-4">
                                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusPresentation(record.status).badgeClass}`}>
                                    {record.status}
                                  </span>
                                </td>
                                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{record.remarks}</td>
                              </tr>
                            ))}
                            {filteredHistory.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-5 py-8 text-center text-slate-500 dark:text-slate-300">
                                  No applications found for the selected filters.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {activeSection === 'settings' && (
                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Profile Settings</p>
                    <h2 className="mt-2 text-2xl font-semibold">Update your info</h2>
                    <form className="mt-6 space-y-4" onSubmit={(event) => void handleSettingsSave(event)}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="settings-name" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Full name</label>
                          <input
                            id="settings-name"
                            type="text"
                            value={settingsDraft.name}
                            onChange={(event) => setSettingsDraft((current) => ({ ...current, name: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label htmlFor="settings-email" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Email address</label>
                          <input
                            id="settings-email"
                            type="email"
                            value={settingsDraft.email}
                            onChange={(event) => setSettingsDraft((current) => ({ ...current, email: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="settings-image" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Profile image URL</label>
                        <input
                          id="settings-image"
                          type="url"
                          value={settingsDraft.profileImage}
                          onChange={(event) => setSettingsDraft((current) => ({ ...current, profileImage: event.target.value }))}
                          placeholder="https://example.com/profile.jpg"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="settings-password" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">New password</label>
                          <input
                            id="settings-password"
                            type="password"
                            value={settingsDraft.password}
                            onChange={(event) => setSettingsDraft((current) => ({ ...current, password: event.target.value }))}
                            placeholder="Leave blank to keep current password"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label htmlFor="settings-confirm-password" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Confirm password</label>
                          <input
                            id="settings-confirm-password"
                            type="password"
                            value={settingsDraft.confirmPassword}
                            onChange={(event) => setSettingsDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                            placeholder="Repeat new password"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={savingSettings}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                      >
                        <Settings2 className="h-4 w-4" />
                        {savingSettings ? 'Saving...' : 'Save profile settings'}
                      </button>
                    </form>
                  </section>

                  <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Preview</p>
                    <h2 className="mt-2 text-2xl font-semibold">Current profile</h2>
                    <div className="mt-6 rounded-[2rem] bg-slate-50 p-5 dark:bg-slate-900/70">
                      <div className="flex items-center gap-4">
                        <img
                          src={profileImage}
                          alt="Current profile"
                          className="h-20 w-20 rounded-3xl object-cover"
                          onError={(event) => {
                            event.currentTarget.onerror = null
                            event.currentTarget.src = FALLBACK_PROFILE_IMAGE
                          }}
                        />
                        <div>
                          <p className="text-lg font-semibold">{studentData.name}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{studentData.email}</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300">{studentData.studentId}</p>
                        </div>
                      </div>
                      <div className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <p>Program: {studentData.course}</p>
                        <p>Exam session: {currentSession}</p>
                        <p>Permit status: {statusView.label}</p>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeSection === 'support' && (
                <div className="grid gap-6 lg:grid-cols-3">
                  <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                    <FileText className="h-9 w-9 text-blue-600 dark:text-blue-300" />
                    <h2 className="mt-4 text-xl font-semibold">Help & support</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      If your application is pending or rejected, review your remarks, confirm course units, and make sure your fees are fully cleared.
                    </p>
                  </section>

                  <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                    <FileText className="h-9 w-9 text-emerald-600 dark:text-emerald-300" />
                    <h2 className="mt-4 text-xl font-semibold">Document checklist</h2>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      <li>Current course registration details</li>
                      <li>Valid student identification</li>
                      <li>Payment evidence when requested</li>
                    </ul>
                  </section>

                  <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                    <UserCircle2 className="h-9 w-9 text-sky-600 dark:text-sky-300" />
                    <h2 className="mt-4 text-xl font-semibold">Contact desk</h2>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      <p>Email: support@exampro.edu</p>
                      <p>Phone: +234 800 000 0000</p>
                      <p>Office hours: Mon - Fri, 8:00 AM to 4:00 PM</p>
                    </div>
                  </section>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
