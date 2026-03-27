import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  BookOpen,
  CalendarDays,
  CreditCard,
  DollarSign,
  Download,
  FileBadge2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PieChart,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldClose,
  Sun,
  TrendingUp,
  Upload,
  UserCircle2,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { publicApiBaseUrl } from '../config/provider'
import PermitCard from './PermitCard'
import { createSupportRequest, fetchPermitActivityHistory, fetchStudentProfileById, fetchSupportContacts, fetchSupportRequests, recordPermitActivity, updateStudentAccount } from '../services/profileService'
import type { PermitActivityRecord, StudentProfile, SupportContact, SupportRequest } from '../types'
import { FALLBACK_PROFILE_IMAGE } from './PermitCard'
import SignOutDialog from './SignOutDialog'
import Select from 'react-select'

type PermitStatus = 'approved' | 'pending' | 'rejected'
type PortalSection = 'overview' | 'academics' | 'finance' | 'applications' | 'settings' | 'support'
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
  phoneNumber: string
  profileImage: string
  currentPassword: string
  password: string
  confirmPassword: string
}

type ApplicationDraft = {
  semester: string
  courseUnits: string[]
  documents: string[]
  checklist: string[]
}

type SupportDraft = {
  subject: string
  message: string
}

const portalSections: Array<{ key: PortalSection; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'academics', label: 'Enrolled Courses', icon: BookOpen },
  { key: 'finance', label: 'Finance', icon: Wallet },
  { key: 'applications', label: 'Applications', icon: FileText },
  { key: 'settings', label: 'Profile Settings', icon: Settings2 },
  { key: 'support', label: 'Help & Support', icon: UserCircle2 },
]

const requiredDocumentChecklist = [
  { id: 'course-registration', label: 'Current course registration details' },
  { id: 'student-id', label: 'Valid student identification' },
  { id: 'payment-evidence', label: 'Payment evidence when requested' },
] as const

function getHistoryStorageKey(userId: string) {
  return `student-portal-history:${userId}`
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

  if (student.feesBalance === 0) {
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

  return 'border-green-200 bg-green-50 text-green-800'
}

export default function Dashboard() {
  const { user, signOut, refreshUser } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const [studentData, setStudentData] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showSignOut, setShowSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [activeSection, setActiveSection] = useState<PortalSection>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [applicationHistory, setApplicationHistory] = useState<PermitApplicationRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all')
  const [semesterFilter, setSemesterFilter] = useState('all')
  const [submittingApplication, setSubmittingApplication] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [loadingSupport, setLoadingSupport] = useState(false)
  const [submittingSupport, setSubmittingSupport] = useState(false)
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [supportContacts, setSupportContacts] = useState<SupportContact[]>([])
  const [permitHistory, setPermitHistory] = useState<PermitActivityRecord[]>([])
  const hasInitializedProfileRef = useRef(false)
  // Course options for dropdown
  const allCourseUnits = useMemo(() => {
    const units = new Set<string>()
    applicationHistory.forEach((rec) => rec.courseUnits.forEach((u) => units.add(u)))
    if (studentData?.courseUnits) {
      studentData.courseUnits.forEach((u) => units.add(u))
    }
    return Array.from(units).sort()
  }, [applicationHistory, studentData])

  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft>({
    semester: `${deriveAcademicSession()} ${deriveSemesterLabel()}`,
    courseUnits: [],
    documents: [],
    checklist: [],
  })
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    name: '',
    email: '',
    phoneNumber: '',
    profileImage: '',
    currentPassword: '',
    password: '',
    confirmPassword: '',
  })
  const [supportDraft, setSupportDraft] = useState<SupportDraft>({
    subject: '',
    message: '',
  })

  const loadSupportRequests = useCallback(async () => {
    if (!user || user.role !== 'student') {
      return
    }

    try {
      setLoadingSupport(true)
      const requests = await fetchSupportRequests()
      setSupportRequests(requests)
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load support requests'
      setError(nextError)
    } finally {
      setLoadingSupport(false)
    }
  }, [user])

  const loadSupportContactsAndHistory = useCallback(async () => {
    if (!user || user.role !== 'student') {
      return
    }

    try {
      const [contacts, history] = await Promise.all([
        fetchSupportContacts(),
        fetchPermitActivityHistory(),
      ])
      setSupportContacts(contacts)
      setPermitHistory(history)
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load support contacts or permit history.'
      setError(nextError)
    }
  }, [user])

  const syncStudentProfile = useCallback(async (options?: { showLoading?: boolean; clearError?: boolean; syncDrafts?: boolean; initializeLocalState?: boolean }) => {
    if (!user || user.role !== 'student') {
      setLoading(false)
      return null
    }

    const {
      showLoading = false,
      clearError = false,
      syncDrafts = false,
      initializeLocalState = false,
    } = options ?? {}

    try {
      if (showLoading) {
        setLoading(true)
      }

      if (clearError) {
        setError('')
      }

      const profile = await fetchStudentProfileById(user.id)
      setStudentData(profile)

      if (syncDrafts) {
        setSettingsDraft((current) => ({
          ...current,
          name: profile.name,
          email: profile.email,
          phoneNumber: profile.phoneNumber ?? '',
          profileImage: profile.profileImage,
        }))
      }

      if (initializeLocalState) {
        setApplicationHistory(readApplicationHistory(user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        await Promise.all([
          loadSupportRequests(),
          loadSupportContactsAndHistory(),
        ])
      }

      return profile
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load your dashboard'

      if (clearError || !hasInitializedProfileRef.current) {
        setError(nextError)
      }

      return null
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [user, loadSupportRequests, loadSupportContactsAndHistory])


  useEffect(() => {
    if (hasInitializedProfileRef.current) {
      return
    }

    hasInitializedProfileRef.current = true
    void syncStudentProfile({
      showLoading: true,
      clearError: true,
      syncDrafts: true,
      initializeLocalState: true,
    })

  }, [syncStudentProfile])

  useEffect(() => {
    if (!user || user.role !== 'student' || typeof window === 'undefined') {
      return
    }

    const syncSilently = () => {
      void syncStudentProfile()
    }

    const intervalId = window.setInterval(syncSilently, 30000)

    const handleFocus = () => {
      syncSilently()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncSilently()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }

  }, [user, syncStudentProfile])

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
      setSuccessMessage('')
      setRefreshing(true)
      await syncStudentProfile({ showLoading: false, clearError: true, syncDrafts: true })
      await Promise.all([
        loadSupportRequests(),
        loadSupportContactsAndHistory(),
      ])
    } catch (refreshError) {
      const nextError = refreshError instanceof Error ? refreshError.message : 'Unable to refresh dashboard details'
      setError(nextError)
    } finally {
      setRefreshing(false)
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
    if (!studentData) {
      return
    }

    if (studentData.feesBalance > 0) {
      setError('Please clear all outstanding fees before printing your permit.')
      return
    }

    if (studentData.canPrintPermit === false) {
      setError(studentData.printAccessMessage || 'You have reached the monthly permit print limit. Contact administration for access.')
      return
    }

    try {
      await recordPermitActivity(studentData.id, 'print_permit')
      await syncStudentProfile({ syncDrafts: false })
      openPrintDialog()
    } catch (printError) {
      const nextError = printError instanceof Error ? printError.message : 'Unable to print your permit right now.'
      setError(nextError)
    }
  }

  async function handleSubmitSupportRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user || user.role !== 'student') {
      return
    }

    const subject = supportDraft.subject.trim()
    const message = supportDraft.message.trim()

    if (subject.length < 4) {
      setError('Support subject must be at least 4 characters long.')
      return
    }

    if (message.length < 10) {
      setError('Support message must be at least 10 characters long.')
      return
    }

    try {
      setSubmittingSupport(true)
      setError('')
      setSuccessMessage('')
      const created = await createSupportRequest(user.id, { subject, message })
      setSupportRequests((current) => [created, ...current])
      setSupportDraft({ subject: '', message: '' })
      setSuccessMessage('Support request sent to the admin desk.')
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : 'Unable to send support request'
      setError(nextError)
    } finally {
      setSubmittingSupport(false)
    }
  }

  async function handleDownload() {
    if (!studentData) {
      return
    }

    if (studentData.feesBalance > 0) {
      setError('Please clear all outstanding fees before downloading your permit.')
      return
    }

    if (studentData.canPrintPermit === false) {
      setError(studentData.printAccessMessage || 'You have reached the monthly permit print limit. Contact administration for access.')
      return
    }

    try {
      await recordPermitActivity(studentData.id, 'download_permit')
      await syncStudentProfile({ syncDrafts: false })
      openPrintDialog()
    } catch (downloadError) {
      const nextError = downloadError instanceof Error ? downloadError.message : 'Unable to download your permit right now.'
      setError(nextError)
    }
  }

  function handleDocumentSelection(event: ChangeEvent<HTMLInputElement>) {
    const documents = Array.from(event.target.files ?? []).map((file) => file.name)
    setApplicationDraft((current) => ({ ...current, documents }))
  }

  function handleChecklistToggle(itemId: string) {
    setApplicationDraft((current) => ({
      ...current,
      checklist: current.checklist.includes(itemId)
        ? current.checklist.filter((entry) => entry !== itemId)
        : [...current.checklist, itemId],
    }))
  }

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!studentData || !user) {
      return
    }

    const courseUnits = [...applicationDraft.courseUnits]

    if (courseUnits.length === 0) {
      setError('Add at least one course unit before submitting your permit request.')
      return
    }

    if (applicationDraft.checklist.length !== requiredDocumentChecklist.length) {
      setError('Complete the document checklist before submitting your permit request.')
      return
    }

    setSubmittingApplication(true)
    setError('')
    setSuccessMessage('')

    const nextStatus: PermitStatus = studentData.feesBalance === 0 ? 'approved' : 'pending'
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
      documents: [
        ...requiredDocumentChecklist
          .filter((item) => applicationDraft.checklist.includes(item.id))
          .map((item) => item.label),
        ...applicationDraft.documents,
      ],
    }

    setApplicationHistory((current) => [nextRecord, ...current])
    setApplicationDraft({
      semester: applicationDraft.semester,
      courseUnits: [],
      documents: [],
      checklist: [],
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

    if (settingsDraft.password && !settingsDraft.currentPassword.trim()) {
      setError('Enter your current password before choosing a new one.')
      return
    }

    try {
      setSavingSettings(true)
      setError('')
      setSuccessMessage('')
      const updatedProfile = await updateStudentAccount(studentData.id, {
        name: settingsDraft.name,
        email: settingsDraft.email,
        phoneNumber: settingsDraft.phoneNumber || undefined,
        profileImage: settingsDraft.profileImage || null,
        currentPassword: settingsDraft.currentPassword || undefined,
        password: settingsDraft.password || undefined,
      })
      if (updatedProfile.role !== 'student') {
        throw new Error('Unexpected profile response when updating student settings.')
      }
      setStudentData(updatedProfile)
      await refreshUser()
      setSettingsDraft({
        name: updatedProfile.name,
        email: updatedProfile.email,
        phoneNumber: updatedProfile.phoneNumber ?? '',
        profileImage: updatedProfile.profileImage,
        currentPassword: '',
        password: '',
        confirmPassword: '',
      })
      setSuccessMessage('Profile settings updated successfully.')
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update your profile settings'
      setError(nextError)
    } finally {
      setSavingSettings(false)
    }
  }
  // Add state for button-level loading
  const [refreshing, setRefreshing] = useState(false)

  const qrValue = studentData
    ? publicApiBaseUrl
      ? `${publicApiBaseUrl}/permits/${encodeURIComponent(studentData.permitToken)}`
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
        const { default: QRCode } = await import('qrcode')
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

  const permitHistoryBySemester = useMemo(() => {
    const seenSemesters = new Set<string>()

    return [...permitHistory]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .filter((record) => {
        if (seenSemesters.has(record.semester)) {
          return false
        }

        seenSemesters.add(record.semester)
        return true
      })
  }, [permitHistory])

  const profileImage = studentData?.profileImage?.trim() ? studentData.profileImage : FALLBACK_PROFILE_IMAGE
  const permitOutputLocked = Boolean(studentData && (studentData.feesBalance > 0 || studentData.canPrintPermit === false))
  const permitOutputMessage = !studentData
    ? ''
    : studentData.feesBalance > 0
      ? 'Please clear all outstanding fees before printing or downloading your permit.'
      : studentData.printAccessMessage || 'You have reached the monthly permit print limit. Contact administration for access.'
  const unreadNotifications = notifications.length
  const currentSession = applicationHistory[0]?.semester || `${deriveAcademicSession(studentData?.examDate)} ${deriveSemesterLabel(studentData?.examDate)}`

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-green-600" />
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Retry
            </button>
            <button
              type="button"
              onClick={() => setShowSignOut(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-slate-900 transition-colors hover:bg-slate-300"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
        {showSignOut && (
          <SignOutDialog
            signingOut={signingOut}
            onConfirm={async () => {
              setSigningOut(true)
              await signOut()
              setSigningOut(false)
            }}
            onCancel={() => setShowSignOut(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className={`${darkMode ? 'dark' : ''} student-dashboard-shell`}>
      {studentData && (
        <div hidden className="print-permit-sheet-wrapper">
          <PermitCard
            studentData={studentData}
            qrCodeUrl={qrCodeUrl}
            onRefresh={handleRefresh}
            onSignOut={() => setShowSignOut(true)}
            onPrint={() => {}}
            onDownload={() => {}}
          />
        </div>
      )}

      <div className="student-dashboard-app min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.55),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(187,247,208,0.55),_transparent_28%),linear-gradient(180deg,_#eff6ff_0%,_#f8fafc_50%,_#eefbf3_100%)] text-slate-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,_rgba(30,41,59,0.95),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(20,83,45,0.5),_transparent_26%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#052e16_100%)] dark:text-slate-100">
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
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-green-600 dark:text-green-300">Student Portal</p>
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

            <div className="mb-6 rounded-3xl border border-green-100 bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
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
                  onClick={() => setSidebarOpen(false)}
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
                    className="w-full rounded-full border border-white/70 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-950"
                  />
                </div>

                <button
                  type="button"
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  onClick={toggleTheme}
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
                  onClick={() => setShowSignOut(true)}
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
                <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-green-100/40 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-green-600 dark:text-green-300">Welcome Section</p>
                      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome, {studentData.name}</h1>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Manage your exam permit, review status updates, and keep your profile ready for exam-day verification.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <span className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 animate-spin" />Refreshing...</span>
                      ) : (
                        <><RefreshCcw className="h-4 w-4" />Refresh</>
                      )}
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Student ID</p>
                      <p className="mt-3 text-lg font-semibold">{studentData.studentId}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Course / Program</p>
                      <p className="mt-3 text-lg font-semibold">{studentData.program || studentData.course || 'Not assigned'}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{studentData.department || 'Department not assigned'}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Year / Semester</p>
                      <p className="mt-3 text-lg font-semibold">{studentData.semester || currentSession}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{studentData.college || 'College not assigned'}</p>
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

              <div key={activeSection} style={{ animation: 'kiu-page-in 0.3s ease-out both' }}>
                {activeSection === 'overview' && (
                  <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
                    <div className="space-y-6">
                      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-green-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <div className="mb-5 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-green-600 dark:text-green-300">Permit Card Preview</p>
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
                                <>
                                  <img src={qrCodeUrl} alt="Verification QR code" className="h-28 w-28" />
                                  <div className="mt-2 break-all text-xs text-green-700 dark:text-green-300 text-center">
                                    {qrValue}
                                  </div>
                                </>
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
                                <p className={permitOutputLocked ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}>
                                  {permitOutputLocked ? permitOutputMessage : 'Eligible for printing'}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400">
                                  Prints this month: {studentData.monthlyPrintCount ?? 0}/{studentData.monthlyPrintLimit ?? 2}
                                  {(studentData.grantedPrintsRemaining ?? 0) > 0 ? ` • Extra admin prints left: ${studentData.grantedPrintsRemaining}` : ''}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            <button
                              type="button"
                              onClick={handleDownload}
                              disabled={permitOutputLocked}
                              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${permitOutputLocked ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                              title={permitOutputLocked ? permitOutputMessage : 'Download permit'}
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </button>
                            <button
                              type="button"
                              onClick={handlePrint}
                              disabled={permitOutputLocked}
                              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${permitOutputLocked ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : 'bg-green-600 text-white hover:bg-green-500'}`}
                              title={permitOutputLocked ? permitOutputMessage : 'Print permit'}
                            >
                              <Printer className="h-4 w-4" />
                              Print Permit
                            </button>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-green-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
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
                            <select
                              id="semester"
                              value={applicationDraft.semester}
                              onChange={(event) => setApplicationDraft((current) => ({ ...current, semester: event.target.value }))}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-green-300 focus:ring-2 focus:ring-green-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-green-400 dark:focus:ring-green-950"
                            >
                              <option value="">Select semester</option>
                              {availableSemesters.map((sem) => (
                                <option key={sem} value={sem}>{sem}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <p className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Document checklist</p>
                            <div className="space-y-2 rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/70">
                              {requiredDocumentChecklist.map((item) => (
                                <label key={item.id} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={applicationDraft.checklist.includes(item.id)}
                                    onChange={() => handleChecklistToggle(item.id)}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label htmlFor="documents" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Upload required documents</label>
                            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-green-300 bg-green-50 px-4 py-3 text-sm text-slate-600 transition hover:border-green-300 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-green-500 dark:hover:bg-slate-800">
                              <Upload className="h-4 w-4" />
                              <span>{applicationDraft.documents.length > 0 ? applicationDraft.documents.join(', ') : 'Choose files'}</span>
                              <input id="documents" type="file" multiple className="sr-only" onChange={handleDocumentSelection} />
                            </label>
                          </div>
                          <div className="lg:col-span-2">
                            <label htmlFor="courseUnits" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Course units</label>
                            <Select
                              id="courseUnits"
                              isMulti
                              options={allCourseUnits.map((u) => ({ value: u, label: u }))}
                              value={applicationDraft.courseUnits.map((u) => ({ value: u, label: u }))}
                              onChange={(selected) => {
                                const unique = Array.from(new Set(selected.map((s) => s.value)))
                                setApplicationDraft((current) => ({ ...current, courseUnits: unique }))
                              }}
                              classNamePrefix="react-select"
                              placeholder="Select or type to add course units"
                              isClearable={false}
                              isSearchable
                              noOptionsMessage={() => 'Type to add new course unit'}
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              {applicationDraft.courseUnits.length === 0 && <span className="text-slate-400">No course units selected</span>}
                              {applicationDraft.courseUnits.map((u) => (
                                <span key={u} className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{u}</span>
                              ))}
                            </div>
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
                              value={applicationDraft.courseUnits.join('\n')}
                              onChange={(event) => setApplicationDraft((current) => ({ ...current, courseUnits: event.target.value.split('\n').map(v => v.trim()).filter(Boolean) }))}
                              placeholder="CSC 401 - Compiler Construction"
                              className="w-full rounded-[1.75rem] border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>
                          <div>
                            <p className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Document checklist</p>
                            <div className="space-y-2 rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900/70">
                              {requiredDocumentChecklist.map((item) => (
                                <label key={item.id} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={applicationDraft.checklist.includes(item.id)}
                                    onChange={() => handleChecklistToggle(item.id)}
                                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span>{item.label}</span>
                                </label>
                              ))}
                            </div>
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

                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Printed Permit History</p>
                      <h2 className="mt-2 text-2xl font-semibold">One record per semester</h2>
                      <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs uppercase tracking-[0.25em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                            <tr>
                              <th className="px-5 py-4">Semester</th>
                              <th className="px-5 py-4">Latest action</th>
                              <th className="px-5 py-4">Source</th>
                              <th className="px-5 py-4">Last activity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {permitHistoryBySemester.map((record) => (
                              <tr key={record.id} className="bg-white/80 dark:bg-slate-950/40">
                                <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{record.semester}</td>
                                <td className="px-5 py-4">{record.action === 'print_permit' ? 'Printed permit' : 'Downloaded permit'}</td>
                                <td className="px-5 py-4 capitalize">{record.source.replace('-', ' ')}</td>
                                <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{formatDateTime(record.createdAt)}</td>
                              </tr>
                            ))}
                            {permitHistoryBySemester.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-5 py-8 text-center text-slate-500 dark:text-slate-300">
                                  No printed or downloaded permit history is available yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}

                {activeSection === 'settings' && (
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Profile Settings</p>
                      <h2 className="mt-2 text-2xl font-semibold">Update your info</h2>
                      <div className="flex justify-end mb-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                          onClick={() => void syncStudentProfile({ showLoading: true, clearError: true, syncDrafts: true })}
                          aria-label="Refresh profile"
                        >
                          <RefreshCcw className="w-4 h-4" />
                          Refresh
                        </button>
                      </div>
                      <form className="mt-6 space-y-4" onSubmit={(event) => void handleSettingsSave(event)}>
                        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                          Identity and contact changes update both your student profile and your login details. Use a valid email address and reachable phone number.
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor="settings-name" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Full name</label>
                            <input
                              id="settings-name"
                              type="text"
                              value={settingsDraft.name}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, name: event.target.value }))}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                              readOnly={user?.role === 'student'}
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
                              readOnly={user?.role === 'student'}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label htmlFor="settings-phone" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Phone number</label>
                            <input
                              id="settings-phone"
                              type="tel"
                              value={settingsDraft.phoneNumber}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, phoneNumber: event.target.value }))}
                              placeholder="e.g. +256700123456"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="settings-image" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Profile photo</label>
                          <div className="flex gap-3 items-center">
                            <input
                              id="settings-image-upload"
                              type="file"
                              accept="image/*"
                              title="Upload profile photo"
                              placeholder="Choose profile photo"
                              onChange={async (event) => {
                                const file = event.target.files?.[0]
                                if (!file) return

                                const reader = new FileReader()
                                reader.onload = () => {
                                  const result = typeof reader.result === 'string' ? reader.result : ''
                                  if (result) {
                                    setSettingsDraft((current) => ({ ...current, profileImage: result }))
                                    setStudentData((current) => current ? { ...current, profileImage: result } : current)
                                  }
                                }
                                reader.onerror = () => {
                                  alert('Failed to upload image.')
                                }
                                reader.readAsDataURL(file)
                              }}
                              className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                            />
                            {settingsDraft.profileImage && (
                              <img src={settingsDraft.profileImage} alt="Profile preview" className="h-12 w-12 rounded-full object-cover border" />
                            )}
                          </div>
                          <input
                            id="settings-image"
                            type="url"
                            value={settingsDraft.profileImage}
                            onChange={(event) => setSettingsDraft((current) => ({ ...current, profileImage: event.target.value }))}
                            placeholder="https://example.com/profile.jpg"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 mt-2"
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <label htmlFor="settings-current-password" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Current password</label>
                            <input
                              id="settings-current-password"
                              type="password"
                              value={settingsDraft.currentPassword}
                              onChange={(event) => setSettingsDraft((current) => ({ ...current, currentPassword: event.target.value }))}
                              placeholder="Required to change password"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>
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
                          <p>Phone: {studentData.phoneNumber || 'Not assigned'}</p>
                          <p>Student category: {studentData.studentCategory === 'international' ? 'International' : 'Local'}</p>
                          <p>Program: {studentData.program || studentData.course}</p>
                          <p>College: {studentData.college || 'Not assigned'}</p>
                          <p>Exam session: {studentData.semester || currentSession}</p>
                          <p>Department: {studentData.department || 'Not assigned'}</p>
                          <p>Course units: {studentData.courseUnits?.length ? studentData.courseUnits.join(', ') : 'Not assigned'}</p>
                          <p>Permit status: {statusView.label}</p>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeSection === 'support' && (
                  <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-6">
                      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <FileText className="h-9 w-9 text-blue-600 dark:text-blue-300" />
                        <h2 className="mt-4 text-xl font-semibold">Help & support</h2>
                        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          If your application is pending or rejected, review your remarks, confirm your document checklist, and make sure your fees are fully cleared before contacting the admin desk.
                        </p>
                      </section>

                      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <FileText className="h-9 w-9 text-emerald-600 dark:text-emerald-300" />
                        <h2 className="mt-4 text-xl font-semibold">Document checklist</h2>
                        <div className="mt-4 space-y-3">
                          {requiredDocumentChecklist.map((item) => {
                            const checked = applicationDraft.checklist.includes(item.id)

                            return (
                              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/70">
                                <span>{item.label}</span>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${checked ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                                  {checked ? 'Ready' : 'Pending'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </section>

                      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <UserCircle2 className="h-9 w-9 text-sky-600 dark:text-sky-300" />
                        <h2 className="mt-4 text-xl font-semibold">Contact desk</h2>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {supportContacts.length > 0 ? supportContacts.map((contact) => (
                            <div key={contact.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                              <p className="font-semibold text-slate-900 dark:text-white">{contact.name}</p>
                              <p>{contact.scope.replace('-', ' ')}</p>
                              <p>Email: {contact.email}</p>
                              <p>Phone: {contact.phoneNumber}</p>
                            </div>
                          )) : (
                            <p>No admin contacts are available right now.</p>
                          )}
                          <p>Office hours: Mon - Fri, 8:00 AM to 4:00 PM</p>
                        </div>
                      </section>
                    </div>

                    <div className="space-y-6">
                      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Need help</p>
                        <h2 className="mt-2 text-2xl font-semibold">Send a support request</h2>
                        <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmitSupportRequest(event)}>
                          <div>
                            <label htmlFor="support-subject" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Subject</label>
                            <input
                              id="support-subject"
                              type="text"
                              value={supportDraft.subject}
                              onChange={(event) => setSupportDraft((current) => ({ ...current, subject: event.target.value }))}
                              placeholder="Permit approval, fees, profile correction"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>
                          <div>
                            <label htmlFor="support-message" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Message</label>
                            <textarea
                              id="support-message"
                              rows={6}
                              value={supportDraft.message}
                              onChange={(event) => setSupportDraft((current) => ({ ...current, message: event.target.value }))}
                              placeholder="Explain the issue you want the admin desk to resolve."
                              className="w-full rounded-[1.75rem] border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={submittingSupport}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Bell className="h-4 w-4" />
                            {submittingSupport ? 'Sending...' : 'Send support request'}
                          </button>
                        </form>
                      </section>

                      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Support history</p>
                            <h2 className="mt-2 text-2xl font-semibold">Your recent requests</h2>
                          </div>
                          {loadingSupport && <span className="text-sm text-slate-500 dark:text-slate-300">Loading...</span>}
                        </div>
                        <div className="mt-5 space-y-3">
                          {supportRequests.length > 0 ? supportRequests.map((request) => (
                            <div key={request.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold">{request.subject}</p>
                                <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white dark:bg-emerald-500 dark:text-slate-950">
                                  {request.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(request.createdAt)}</p>
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{request.message}</p>
                              {request.adminReply && (
                                <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                  Admin reply: {request.adminReply}
                                </p>
                              )}
                            </div>
                          )) : (
                            <div className="rounded-3xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                              No support requests submitted yet.
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                )}

                {activeSection === 'finance' && (
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {/* Current Balance Card */}
                      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl"></div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                              <Wallet className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Balance</p>
                              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                UGX {studentData.feesBalance.toLocaleString()}
                              </h2>
                            </div>
                          </div>
                          <div className="mt-6 flex gap-3">
                            <button
                              type="button"
                              className="flex-1 rounded-full bg-emerald-500 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 shadow-sm"
                            >
                              Pay Now
                            </button>
                            <button
                              type="button"
                              className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shadow-sm"
                            >
                              Download Invoice
                            </button>
                          </div>
                        </div>
                      </section>

                      {/* Payment Statistics */}
                      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl"></div>
                        <div className="relative z-10 h-full flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Paid (Semester)</p>
                            <PieChart className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="mt-2">
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">UGX 1,500,000</h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-emerald-500" />
                              Fully cleared for previous sessions
                            </p>
                          </div>
                          <div className="mt-4 w-full rounded-full bg-slate-100 dark:bg-slate-800 h-2.5">
                            <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: '75%' }}></div>
                          </div>
                          <p className="text-xs text-right mt-1 text-slate-500">75% of Annual Target</p>
                        </div>
                      </section>
                      
                      {/* Upcoming Deadlines */}
                      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none xl:col-span-1 md:col-span-2">
                         <div className="flex items-center gap-3 mb-4">
                            <CalendarDays className="h-5 w-5 text-orange-500" />
                            <h3 className="font-semibold text-slate-900 dark:text-white">Important Deadlines</h3>
                         </div>
                         <div className="space-y-4">
                           <div className="flex items-center justify-between border-l-2 border-orange-500 pl-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Final Exam Clearance</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Clear all balances to generate permit</p>
                              </div>
                              <span className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded-full dark:bg-orange-900/40 dark:text-orange-300">In 14 Days</span>
                           </div>
                           <div className="flex items-center justify-between border-l-2 border-slate-300 dark:border-slate-600 pl-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Next Semester Reg.</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Early bird registration fee</p>
                              </div>
                              <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-full dark:bg-slate-800 dark:text-slate-300">August 1st</span>
                           </div>
                         </div>
                      </section>
                    </div>

                    {/* Recent Transactions */}
                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent Transactions</h2>
                        <button className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex text-center gap-1">
                           <Download className="h-4 w-4" />
                           Statement
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                              <th className="pb-3 font-medium">Date</th>
                              <th className="pb-3 font-medium">Description</th>
                              <th className="pb-3 font-medium">Method</th>
                              <th className="pb-3 font-medium text-right">Amount</th>
                              <th className="pb-3 font-medium text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {[
                              { date: 'Oct 12, 2023', desc: 'Tuition Installment 2', method: 'Mobile Money', amount: 'UGX 500,000', status: 'Completed' },
                              { date: 'Sep 05, 2023', desc: 'Tuition Installment 1', method: 'Bank Transfer', amount: 'UGX 1,000,000', status: 'Completed' },
                              { date: 'Aug 20, 2023', desc: 'Registration Fee', method: 'Visa Card', amount: 'UGX 150,000', status: 'Completed' },
                            ].map((txn, idx) => (
                              <tr key={idx} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                <td className="py-4 text-slate-600 dark:text-slate-300">{txn.date}</td>
                                <td className="py-4 font-medium text-slate-900 dark:text-white">{txn.desc}</td>
                                <td className="py-4 text-slate-600 dark:text-slate-300">
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-slate-400" />
                                    {txn.method}
                                  </div>
                                </td>
                                <td className="py-4 text-right font-medium text-slate-900 dark:text-white">{txn.amount}</td>
                                <td className="py-4 text-center">
                                  <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                    {txn.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </div>
                )}

                {activeSection === 'academics' && (
                  <div className="space-y-6">
                    {/* Academics Overview Header */}
                    <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-r from-blue-600 to-indigo-700 p-8 shadow-xl shadow-blue-200/50 dark:border-slate-800 dark:from-slate-900 dark:to-indigo-950 dark:shadow-none mb-6">
                       <div className="absolute right-0 top-0 opacity-10">
                         <GraduationCap className="h-48 w-48 -mt-8 -mr-8" />
                       </div>
                       <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                         <div className="text-white">
                           <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 mb-4 text-xs font-semibold backdrop-blur-sm">
                             <TrendingUp className="h-3.5 w-3.5" /> Present Semester
                           </span>
                           <h1 className="text-3xl font-bold">{currentSession}</h1>
                           <p className="mt-2 text-blue-100 max-w-md">You are currently enrolled in {studentData.courseUnits?.length || 0} active course units. Keep up the good work!</p>
                         </div>
                         <div className="flex gap-4">
                           <div className="rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-md border border-white/20 text-center">
                             <p className="text-blue-100 text-xs uppercase tracking-wider font-semibold">Current GPA</p>
                             <p className="text-3xl font-bold text-white mt-1">3.8<span className="text-lg text-blue-200 font-medium">/4.0</span></p>
                           </div>
                           <div className="rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-md border border-white/20 text-center">
                             <p className="text-blue-100 text-xs uppercase tracking-wider font-semibold">Credits</p>
                             <p className="text-3xl font-bold text-white mt-1">{(studentData.courseUnits?.length || 0) * 3}</p>
                           </div>
                         </div>
                       </div>
                    </section>
                    
                    {/* Courses Grid */}
                    <div className="flex items-center justify-between mb-2">
                       <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Enrolled Courses</h2>
                       <button className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition">View full transcript &rarr;</button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {studentData.courseUnits?.map((unit, idx) => {
                        // Mock data for visual richness based on the unit string
                        const [code, ...nameParts] = unit.split(' ')
                        const title = nameParts.join(' ') || unit
                        const progress = Math.floor(Math.random() * 40) + 60 // Random progress between 60-100%

                        return (
                          <div key={idx} className="group relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-950/70 hover:dark:shadow-none">
                            <div className="flex justify-between items-start mb-4">
                               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                  <BookOpen className="h-5 w-5" />
                               </div>
                               <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{code}</span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug lined-clamp-2 min-h-[2.5rem]">{title}</h3>
                            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                               <span className="flex items-center gap-1.5"><UserCircle2 className="h-3.5 w-3.5" /> Dr. Assignment Mock</span>
                               <span>3 Credits</span>
                            </div>
                            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800/50">
                               <div className="flex justify-between items-center mb-1.5">
                                 <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Course Progress</span>
                                 <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{progress}%</span>
                               </div>
                               <div className="w-full bg-slate-100 rounded-full h-1.5 dark:bg-slate-800">
                                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                               </div>
                            </div>
                          </div>
                        )
                      })}
                      {(!studentData.courseUnits || studentData.courseUnits.length === 0) && (
                        <div className="col-span-full rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                          <BookOpen className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No courses loaded</h3>
                          <p className="mt-1 text-sm text-slate-500">You are not currently enrolled in any course units.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>

      {showSignOut && (
        <SignOutDialog
          signingOut={signingOut}
          onConfirm={async () => {
            setSigningOut(true)
            await signOut()
            setSigningOut(false)
          }}
          onCancel={() => setShowSignOut(false)}
        />
      )}
    </div>
  )
}
