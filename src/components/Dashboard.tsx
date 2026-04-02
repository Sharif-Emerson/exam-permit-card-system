import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  BookOpen,
  CalendarDays,
  CreditCard,
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
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldClose,
  Sun,
  TrendingUp,
  UserCircle2,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { permitPublicBaseUrl } from '../config/provider'
import { examPermitConfig } from '../config/branding'
import { DIALOG_Z } from '../constants/dialogLayers'
import BrandMark from './BrandMark'
import PermitCard from './PermitCard'
import { createSemesterRegistration, createSupportRequest, fetchPermitActivityHistory, fetchSemesterRegistrations, fetchStudentProfileById, fetchSupportContacts, fetchSupportRequests, fetchSystemFeeSettings, recordPermitActivity, sendSupportRequestMessage, updateStudentAccount } from '../services/profileService'
import type { PermitActivityRecord, StudentProfile, SupportContact, SupportRequest, UniversityDeadline } from '../types'
import { FALLBACK_PROFILE_IMAGE } from './PermitCard'
import SignOutDialog from './SignOutDialog'
import Faq from './Faq'
type PermitStatus = 'approved' | 'pending' | 'rejected'
type PortalSection = 'overview' | 'permit_courses' | 'finance' | 'applications' | 'settings' | 'support'
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

type FirstLoginSetupDraft = {
  phoneNumber: string
  password: string
  confirmPassword: string
  profileImage: string
}

type ApplicationDraft = {
  semester: string
}

/** Turn API base (possibly `/api` or host-relative) into an absolute URL phones can open from a scan. */
function resolvePermitPublicBaseForQr(base: string): string {
  const trimmed = base.trim().replace(/\/$/, '')
  if (!trimmed) {
    return ''
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  if (typeof window !== 'undefined' && trimmed.startsWith('/')) {
    return `${window.location.origin.replace(/\/$/, '')}${trimmed}`
  }
  return trimmed
}

/**
 * Keep payload short: dense multi-line text creates high-version QRs that fail on cameras when shown small.
 * Prefer a single verification URL; otherwise a compact token line invigilator tools can parse or look up.
 */
function buildOfflinePermitQrPayload(student: StudentProfile, publicBaseUrl: string) {
  const absoluteBase = resolvePermitPublicBaseForQr(publicBaseUrl)
  const token = encodeURIComponent(student.permitToken)
  if (absoluteBase) {
    return `${absoluteBase}/permits/${token}`
  }
  const clearance = student.feesBalance <= 0 ? '1' : '0'
  const reg = (student.studentId || 'NA').replace(/\|/g, '_')
  return `KIU-PERMIT|${student.permitToken}|${reg}|${clearance}`
}

type SupportDraft = {
  subject: string
  message: string
}


function normalizeCurrencyCode(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'USD'
}

function formatMoney(value: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizeCurrencyCode(currencyCode),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${normalizeCurrencyCode(currencyCode)} ${value.toFixed(2)}`
  }
}

function toPermitRecordFromSemesterRequest(input: {
  id: string
  requestedSemester: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote?: string
  createdAt: string
}, fallbackUnits: string[] = []): PermitApplicationRecord {
  return {
    id: input.id,
    createdAt: input.createdAt,
    semester: input.requestedSemester,
    status: input.status,
    remarks: input.adminNote?.trim()
      ? input.adminNote
      : input.status === 'approved'
        ? 'Semester registration approved by admin.'
        : input.status === 'rejected'
          ? 'Semester registration rejected by admin.'
          : 'Awaiting admin approval.',
    courseUnits: fallbackUnits,
    documents: [],
  }
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

function buildPermitBlockers(
  student: StudentProfile,
  deadlineList: UniversityDeadline[],
  currencyCode: string,
) {
  const items: Array<{ id: string; title: string; detail: string; tone: 'red' | 'amber' }> = []

  if (student.feesBalance > 0) {
    items.push({
      id: 'fees',
      title: 'Outstanding fees',
      detail: `Your balance is ${formatMoney(student.feesBalance, currencyCode)}. Clear fees at Finance (or your approved channel) before printing your permit.`,
      tone: 'red',
    })
  }

  if (student.canPrintPermit === false) {
    items.push({
      id: 'print-cap',
      title: 'Monthly print limit',
      detail: student.printAccessMessage ?? 'You have used your permitted prints for this month. Contact administration if you need an extra copy.',
      tone: 'amber',
    })
  }

  const enrollment = student.enrollmentStatus ?? 'active'
  if (enrollment === 'on_leave') {
    items.push({
      id: 'enrollment-leave',
      title: 'Enrollment on leave',
      detail: 'The registry must set your status back to active before you can print or download a permit.',
      tone: 'red',
    })
  }
  if (enrollment === 'graduated') {
    items.push({
      id: 'enrollment-graduated',
      title: 'Graduated status',
      detail: 'Permit printing is not available for graduated records. Contact the registry if this is incorrect.',
      tone: 'red',
    })
  }

  if (!(student.studentId ?? '').trim()) {
    items.push({
      id: 'reg-missing',
      title: 'Registration number missing',
      detail: 'Ask an administrator to add your official registration number to your profile.',
      tone: 'amber',
    })
  }

  const hasCustomPhoto = Boolean(student.profileImage?.trim()) && student.profileImage !== FALLBACK_PROFILE_IMAGE
  if (!hasCustomPhoto) {
    items.push({
      id: 'photo',
      title: 'Profile photo',
      detail: 'Upload a clear photo under Profile Settings so your permit matches university records.',
      tone: 'amber',
    })
  }

  const now = Date.now()
  for (const dl of deadlineList) {
    if (!dl.dueAt) {
      continue
    }
    const due = new Date(dl.dueAt).getTime()
    if (Number.isNaN(due) || due >= now) {
      continue
    }
    if (dl.type === 'danger' || dl.type === 'warning') {
      items.push({
        id: `deadline-${dl.id}`,
        title: dl.title || 'Important deadline passed',
        detail: dl.subtitle || 'Review recent notices from the examinations office.',
        tone: 'amber',
      })
    }
  }

  return items
}

function deriveStatus(student: StudentProfile, history: PermitApplicationRecord[]): PermitStatus {
  const latestApplication = history[0]

  // Admin explicitly rejected — always honour
  if (latestApplication?.status === 'rejected') {
    return 'rejected'
  }

  // Admin explicitly approved — always honour
  if (latestApplication?.status === 'approved') {
    return 'approved'
  }

  // Fees cleared — auto-approve regardless of pending application
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
      title: 'Permit schedule updated',
      message: `You have ${student.exams.length} scheduled item${student.exams.length === 1 ? '' : 's'} on your permit card.`,
      tone: 'blue',
      createdAt: new Date().toISOString(),
    })
  }

  return [
    ...history.slice(0, 3).map((item): NotificationItem => ({
      id: item.id,
      title: `Application ${item.status}`,
      message: item.remarks || 'No remarks on file for this application.',
      tone: item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'red' : 'yellow',
      createdAt: item.createdAt,
    })),
    ...baseNotifications,
  ]
}

function readStudentNotificationReadSet(userId: string): Set<string> {
  if (typeof window === 'undefined') {
    return new Set()
  }

  try {
    const raw = localStorage.getItem(`student-notifications-read:${userId}`)
    if (!raw) {
      return new Set()
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return new Set()
    }

    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function persistStudentNotificationReadIds(userId: string, ids: Set<string>) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(`student-notifications-read:${userId}`, JSON.stringify([...ids]))
}

function formatDeadlineCountdown(dueAt?: string): string | null {
  if (!dueAt?.trim()) {
    return null
  }

  const end = new Date(dueAt).getTime()
  if (Number.isNaN(end)) {
    return null
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.ceil((end - startOfToday.getTime()) / dayMs)
  if (days > 1) {
    return `${days} days left`
  }
  if (days === 1) {
    return '1 day left'
  }
  if (days === 0) {
    return 'Due today'
  }
  return 'Past due'
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
      cardClass: 'border-green-200 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-900 dark:text-green-100',
      badgeClass: 'bg-green-600 text-white dark:bg-green-400 dark:text-green-900',
      message: 'Your permit is ready. Download or print it when needed.',
    }
  }

  if (status === 'rejected') {
    return {
      label: 'Rejected',
      icon: ShieldClose,
      cardClass: 'border-red-200 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-900 dark:text-red-100',
      badgeClass: 'bg-red-600 text-white dark:bg-red-400 dark:text-red-900',
      message: 'Your last submission needs correction. Review the remarks and try again.',
    }
  }

  return {
    label: 'Pending',
    icon: ShieldAlert,
    cardClass: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100',
    badgeClass: 'bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-900',
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

/** Sets width imperatively so we avoid a `style` prop (a11y / lint tooling). */
function PaymentProgressBarFill({ percent }: { percent: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el) {
      el.style.width = `${percent}%`
    }
  }, [percent])
  return <div ref={ref} className="h-2.5 rounded-full bg-blue-500 transition-all duration-1000" />
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
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set())
  const [deadlines, setDeadlines] = useState<UniversityDeadline[]>([])
  const [feeCurrencyCode, setFeeCurrencyCode] = useState('USD')
  const [applicationHistory, setApplicationHistory] = useState<PermitApplicationRecord[]>([])
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
  const notificationButtonRef = useRef<HTMLButtonElement>(null)
  const notificationPanelRef = useRef<HTMLDivElement>(null)
  // Add state for button-level loading
  const [refreshing, setRefreshing] = useState(false)

  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft>({
    semester: `${deriveAcademicSession()} ${deriveSemesterLabel()}`,
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
  const [firstLoginDraft, setFirstLoginDraft] = useState<FirstLoginSetupDraft>({
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    profileImage: '',
  })
  const [skipFirstLoginSetup, setSkipFirstLoginSetup] = useState(false)
  const [savingFirstLoginSetup, setSavingFirstLoginSetup] = useState(false)
  const [supportDraft, setSupportDraft] = useState<SupportDraft>({
    subject: '',
    message: '',
  })
  const [supportAttachment, setSupportAttachment] = useState<File | null>(null)
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<string, string>>({})
  const [supportReplyAttachments, setSupportReplyAttachments] = useState<Record<string, File | null>>({})
  const [sendingSupportReplyId, setSendingSupportReplyId] = useState<string | null>(null)
  const getUnreadAdminMessageCount = useCallback((request: SupportRequest) => {
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      return 0
    }
    const latestStudentMessageAt = request.messages
      .filter((entry) => entry.senderRole === 'student')
      .reduce((latest, entry) => (entry.createdAt > latest ? entry.createdAt : latest), '')
    return request.messages.filter((entry) => entry.senderRole === 'admin' && entry.createdAt > latestStudentMessageAt).length
  }, [])


  // Calculate financial metrics
  const totalFees = studentData?.totalFees || 0
  const amountPaid = studentData?.amountPaid || 0
  const feesBalance = studentData?.feesBalance || 0
  const paymentProgress = totalFees > 0 ? Math.min(Math.round((amountPaid / totalFees) * 100), 100) : 0
  const examPeriodDeadline = useMemo(() => {
    return (deadlines ?? []).find((item) => {
      const title = (item.title ?? '').toLowerCase()
      const subtitle = (item.subtitle ?? '').toLowerCase()
      return Boolean(item.dueAt) && (title.includes('exam') || subtitle.includes('exam'))
    }) ?? null
  }, [deadlines])
  const isFullyCleared = feesBalance <= 0 && amountPaid > 0
  const activeFeeCurrency = useMemo(() => normalizeCurrencyCode(feeCurrencyCode), [feeCurrencyCode])

  const portalSections = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'permit_courses', label: 'Digital Permit', icon: <GraduationCap className="h-4 w-4" /> },
    {
      key: 'finance',
      label: 'Finance',
      icon: <CreditCard className="h-4 w-4" />,
      badge: feesBalance > 0 ? 'Due' : isFullyCleared ? '✓' : undefined
    },
    { key: 'applications', label: 'Applications', icon: <FileText className="h-4 w-4" /> },
    { key: 'settings', label: 'Profile Settings', icon: <Settings2 className="h-4 w-4" /> },
    { key: 'support', label: 'Help & Support', icon: <UserCircle2 className="h-4 w-4" /> },
  ]

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
      const [contactsResult, historyResult] = await Promise.allSettled([
        fetchSupportContacts(),
        fetchPermitActivityHistory(),
      ])
      if (contactsResult.status === 'fulfilled') {
        setSupportContacts(contactsResult.value)
      }
      if (historyResult.status === 'fulfilled') {
        setPermitHistory(historyResult.value)
      }
      if (contactsResult.status === 'rejected' && historyResult.status === 'rejected') {
        throw contactsResult.reason
      }
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

      const [profile, settings] = await Promise.allSettled([
        fetchStudentProfileById(user.id),
        fetchSystemFeeSettings(),
      ])

      if (profile.status === 'rejected') {
        throw profile.reason
      }

      setStudentData(profile.value)
      if (settings.status === 'fulfilled') {
        const feeSettings = settings.value
        if (Array.isArray(feeSettings.deadlines)) {
          setDeadlines(feeSettings.deadlines)
        }
        if (typeof feeSettings.currencyCode === 'string' && feeSettings.currencyCode.trim()) {
          setFeeCurrencyCode(feeSettings.currencyCode.trim().toUpperCase())
        }
      }

      if (syncDrafts && profile.status === 'fulfilled' && profile.value) {
        const p = profile.value
        setStudentData(p)
        setSettingsDraft((current) => ({
          ...current,
          name: p.name,
          email: p.email,
          phoneNumber: p.phoneNumber || '',
          profileImage: p.profileImage || '',
        }))
        setFirstLoginDraft((current) => ({
          ...current,
          phoneNumber: p.phoneNumber && p.phoneNumber !== 'Not assigned' ? p.phoneNumber : '',
          profileImage: p.profileImage && p.profileImage !== FALLBACK_PROFILE_IMAGE ? p.profileImage : '',
        }))
      }

      if (initializeLocalState) {
        const semesterRequests = await fetchSemesterRegistrations()
        setApplicationHistory(
          semesterRequests
            .map((entry) => toPermitRecordFromSemesterRequest(entry, profile.status === 'fulfilled' && profile.value?.courseUnits ? profile.value.courseUnits : []))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        )
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
    if (!user?.id || user.role !== 'student') {
      return
    }

    setReadNotificationIds(readStudentNotificationReadSet(user.id))
  }, [user?.id, user?.role])

  useEffect(() => {
    if (!showNotifications || typeof document === 'undefined') {
      return
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (!target) {
        return
      }
      if (notificationPanelRef.current?.contains(target) || notificationButtonRef.current?.contains(target)) {
        return
      }
      setShowNotifications(false)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showNotifications])

  async function handleRefresh() {
    if (!user || user.role !== 'student') {
      return
    }

    try {
      setSuccessMessage('')
      setRefreshing(true)
      await syncStudentProfile({ showLoading: false, clearError: true, syncDrafts: true })
      const semesterRequests = await fetchSemesterRegistrations()
      setApplicationHistory(
        semesterRequests
          .map((entry) => toPermitRecordFromSemesterRequest(entry, studentData?.courseUnits ?? []))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
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

    if (studentData.enrollmentStatus === 'graduated') {
      setError('Graduated students cannot print permits through this portal. Contact the registry if you need help.')
      return
    }
    if (studentData.enrollmentStatus === 'on_leave') {
      setError('Your enrollment is on leave. Contact the registry before printing your permit.')
      return
    }

    try {
      await recordPermitActivity(studentData.id, 'print_permit')
      await loadSupportContactsAndHistory()
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

    if (!supportAttachment && message.length < 10) {
      setError('Support message must be at least 10 characters long.')
      return
    }
    if (supportAttachment && message.length < 2) {
      setError('Support message must be at least 2 characters when attaching a file.')
      return
    }

    try {
      setSubmittingSupport(true)
      setError('')
      setSuccessMessage('')
      const created = await createSupportRequest(user.id, { subject, message }, supportAttachment)
      setSupportRequests((current) => [created, ...current])
      setSupportDraft({ subject: '', message: '' })
      setSupportAttachment(null)
      setSuccessMessage('Support request sent to the admin desk.')
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : 'Unable to send support request'
      setError(nextError)
    } finally {
      setSubmittingSupport(false)
    }
  }

  async function handleSendSupportReply(requestId: string) {
    const message = (supportReplyDrafts[requestId] ?? '').trim()
    const attachment = supportReplyAttachments[requestId] ?? null
    if (!attachment && message.length < 2) {
      setError('Reply message must be at least 2 characters, or add an attachment.')
      return
    }
    try {
      setSendingSupportReplyId(requestId)
      setError('')
      const updated = await sendSupportRequestMessage(requestId, message, attachment)
      setSupportRequests((current) => current.map((item) => (item.id === requestId ? updated : item)))
      setSupportReplyDrafts((current) => ({ ...current, [requestId]: '' }))
      setSupportReplyAttachments((current) => ({ ...current, [requestId]: null }))
      setSuccessMessage('Reply sent to support desk.')
    } catch (replyError) {
      const nextError = replyError instanceof Error ? replyError.message : 'Unable to send support reply.'
      setError(nextError)
    } finally {
      setSendingSupportReplyId(null)
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

    if (studentData.enrollmentStatus === 'graduated') {
      setError('Graduated students cannot print permits through this portal. Contact the registry if you need help.')
      return
    }
    if (studentData.enrollmentStatus === 'on_leave') {
      setError('Your enrollment is on leave. Contact the registry before downloading your permit.')
      return
    }

    try {
      await recordPermitActivity(studentData.id, 'download_permit')
      await loadSupportContactsAndHistory()
      await syncStudentProfile({ syncDrafts: false })
      openPrintDialog()
    } catch (downloadError) {
      const nextError = downloadError instanceof Error ? downloadError.message : 'Unable to download your permit right now.'
      setError(nextError)
    }
  }

  function handleDownloadFinanceStatement() {
    if (!studentData || typeof window === 'undefined') {
      return
    }
    const rows = [
      ['Field', 'Value'],
      ['Student Name', studentData.name],
      ['Registration Number', studentData.studentId || 'N/A'],
      ['Program', studentData.program || studentData.course || 'N/A'],
      ['Semester', studentData.semester || 'N/A'],
      ['Total Fees', formatMoney(studentData.totalFees, activeFeeCurrency)],
      ['Amount Paid', formatMoney(studentData.amountPaid, activeFeeCurrency)],
      ['Outstanding Balance', formatMoney(studentData.feesBalance, activeFeeCurrency)],
      ['Generated At', new Date().toISOString()],
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `statement-${(studentData.studentId || studentData.id || 'student').replace(/[^a-z0-9_-]/gi, '_')}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.URL.revokeObjectURL(url)
  }

  async function handleCompleteFirstLoginSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!studentData) {
      return
    }

    const phone = firstLoginDraft.phoneNumber.trim()
    const password = firstLoginDraft.password
    const confirm = firstLoginDraft.confirmPassword
    const profileImage = firstLoginDraft.profileImage.trim() || FALLBACK_PROFILE_IMAGE

    if (!phone) {
      setError('Phone number is required before continuing.')
      return
    }
    if (password !== confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password) || password.length < 8) {
      setError('Use a strong password with uppercase, lowercase, number, and special character.')
      return
    }

    try {
      setSavingFirstLoginSetup(true)
      setError('')
      await updateStudentAccount(studentData.id, {
        phoneNumber: phone,
        password,
        profileImage,
      })
      setFirstLoginDraft({ phoneNumber: phone, password: '', confirmPassword: '', profileImage })
      await syncStudentProfile({ syncDrafts: true })
      await refreshUser()
      setSuccessMessage('Profile security setup completed successfully.')
    } catch (setupError) {
      const nextError = setupError instanceof Error ? setupError.message : 'Unable to complete first login setup.'
      setError(nextError)
    } finally {
      setSavingFirstLoginSetup(false)
    }
  }

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!studentData || !user) {
      return
    }

    const requestedSemester = applicationDraft.semester.trim()
    if (!requestedSemester) {
      setError('Select a semester to register.')
      return
    }

    setSubmittingApplication(true)
    setError('')
    setSuccessMessage('')
    try {
      await createSemesterRegistration(requestedSemester)
      const semesterRequests = await fetchSemesterRegistrations()
      setApplicationHistory(
        semesterRequests
          .map((entry) => toPermitRecordFromSemesterRequest(entry, studentData.courseUnits ?? []))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
      setSuccessMessage('Semester registration submitted and waiting for admin approval.')
      setActiveSection('applications')
    } catch (submitError) {
      const nextError = submitError instanceof Error ? submitError.message : 'Unable to submit semester registration.'
      setError(nextError)
    } finally {
      setSubmittingApplication(false)
    }
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
        phoneNumber: settingsDraft.phoneNumber.trim() || undefined,
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
  const qrValue = studentData ? buildOfflinePermitQrPayload(studentData, permitPublicBaseUrl) : ''

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
          errorCorrectionLevel: examPermitConfig.qrErrorCorrection,
          margin: examPermitConfig.qrCodeMargin,
          width: examPermitConfig.qrCodeSize,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
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
    if (!studentData) {
      return []
    }
    const base = buildNotifications(studentData, applicationHistory, permitStatus)
    if (examPeriodDeadline?.dueAt && studentData.feesBalance > 0) {
      base.unshift({
        id: 'exam-period-clearance-reminder',
        title: 'Exam clearance reminder',
        message: `Exams start ${formatDate(examPeriodDeadline.dueAt)}. Clear outstanding balance before the exam period.`,
        tone: 'yellow',
        createdAt: new Date().toISOString(),
      })
    }
    return base
  }, [applicationHistory, examPeriodDeadline, permitStatus, studentData])

  const filteredHistory = useMemo(() => {
    return applicationHistory.filter((record) => {
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesSemester = semesterFilter === 'all' || record.semester === semesterFilter
      return matchesStatus && matchesSemester
    })
  }, [applicationHistory, semesterFilter, statusFilter])

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
  const enrollmentBlocksPermit = Boolean(
    studentData && (studentData.enrollmentStatus === 'on_leave' || studentData.enrollmentStatus === 'graduated'),
  )
  const permitOutputLocked = Boolean(
    studentData && (studentData.feesBalance > 0 || studentData.canPrintPermit === false || enrollmentBlocksPermit),
  )
  const permitOutputMessage = !studentData
    ? ''
    : studentData.enrollmentStatus === 'graduated'
      ? 'Graduated students cannot print permits through this portal. Contact the registry if you need help.'
      : studentData.enrollmentStatus === 'on_leave'
        ? 'Your enrollment is on leave. Contact the registry before printing or downloading your permit.'
        : studentData.feesBalance > 0
          ? 'Please clear all outstanding fees before printing or downloading your permit.'
          : studentData.printAccessMessage || 'You have reached the monthly permit print limit. Contact administration for access.'

  const permitBlockers = useMemo(() => {
    if (!studentData) {
      return []
    }
    return buildPermitBlockers(studentData, deadlines, activeFeeCurrency)
  }, [studentData, deadlines, activeFeeCurrency])
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !readNotificationIds.has(n.id)).length,
    [notifications, readNotificationIds],
  )
  const currentSession = applicationHistory[0]?.semester || `${deriveAcademicSession()} ${deriveSemesterLabel()}`

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-green-600" />
          <p className="text-base text-slate-600 dark:text-slate-300">Loading your student dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-xl shadow-red-100/30">
          <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">Unable to load your dashboard</h2>
          <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">{error || 'No student record was found for this account.'}</p>
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-2 text-slate-900 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
      {studentData?.firstLoginRequired && !skipFirstLoginSetup && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/60">
          <div className="flex min-h-full items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Security setup required</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Welcome. Before continuing, set a strong password and add your phone number.
            </p>
            <form onSubmit={(event) => void handleCompleteFirstLoginSetup(event)} className="mt-4 space-y-3">
              <div>
                <label htmlFor="first-login-profile-upload" className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Passport Photo (recommended 3:4 portrait)</label>
                <div className="flex items-start gap-3">
                  <input
                    id="first-login-profile-upload"
                    type="file"
                    accept="image/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      const formData = new FormData()
                      formData.append('photo', file)
                      try {
                        const res = await fetch('/uploads/profile-photo', { method: 'POST', body: formData })
                        if (!res.ok) throw new Error('Upload failed')
                        const data = await res.json()
                        if (typeof data.url === 'string' && data.url.trim()) {
                          setFirstLoginDraft((current) => ({ ...current, profileImage: data.url }))
                        }
                      } catch {
                        setError('Failed to upload photo. You can continue and a placeholder photo will be used.')
                      }
                    }}
                    className="block w-full text-xs text-gray-700 dark:text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                  <img
                    src={firstLoginDraft.profileImage || FALLBACK_PROFILE_IMAGE}
                    alt="Profile preview"
                    className="h-24 w-[72px] rounded-md border object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = FALLBACK_PROFILE_IMAGE
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-300">
                  Use a clear, front-facing passport-style photo. If not uploaded, a default placeholder image will be saved.
                </p>
              </div>
              <div>
                <label htmlFor="first-login-phone" className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Phone Number</label>
                <input
                  id="first-login-phone"
                  type="tel"
                  value={firstLoginDraft.phoneNumber}
                  onChange={(event) => setFirstLoginDraft((current) => ({ ...current, phoneNumber: event.target.value }))}
                  required
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                  placeholder="e.g. +256700123456"
                />
              </div>
              <div>
                <label htmlFor="first-login-password" className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">New Strong Password</label>
                <input
                  id="first-login-password"
                  type="password"
                  value={firstLoginDraft.password}
                  onChange={(event) => setFirstLoginDraft((current) => ({ ...current, password: event.target.value }))}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                  placeholder="e.g. Permit@2027"
                />
                <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-300">Use uppercase, lowercase, number, and special character. Example: Permit@2027</p>
              </div>
              <div>
                <label htmlFor="first-login-confirm-password" className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">Confirm Password</label>
                <input
                  id="first-login-confirm-password"
                  type="password"
                  value={firstLoginDraft.confirmPassword}
                  onChange={(event) => setFirstLoginDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={savingFirstLoginSetup}
                  onClick={() => {
                    setError('')
                    setSuccessMessage('You skipped security setup for now. Please update your password from Profile Settings soon.')
                    setSkipFirstLoginSetup(true)
                  }}
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  disabled={savingFirstLoginSetup}
                  onClick={() => {
                    setError('')
                    setShowSignOut(true)
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFirstLoginSetup}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingFirstLoginSetup ? 'Saving...' : 'Save and Continue'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}
      {studentData && (
        <div hidden className="print-permit-sheet-wrapper">
          <PermitCard
            studentData={studentData}
            qrCodeUrl={qrCodeUrl}
            onRefresh={handleRefresh}
            onSignOut={() => setShowSignOut(true)}
            onPrint={() => { }}
            onDownload={() => { }}
          />
        </div>
      )}

      <div className="student-dashboard-app min-h-screen bg-[radial-gradient(circle_at_8%_12%,_rgba(6,182,212,0.18),_transparent_32%),radial-gradient(circle_at_92%_16%,_rgba(20,184,166,0.16),_transparent_30%),radial-gradient(circle_at_50%_98%,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,_#ecfeff_0%,_#f0fdfa_45%,_#e0f2fe_100%)] text-slate-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,_rgba(30,58,138,0.45),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(127,29,29,0.35),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#052e16_55%,_#1f2937_100%)] dark:text-slate-100">
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
          <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-sky-200/70 bg-[linear-gradient(180deg,_rgba(239,246,255,0.95),_rgba(240,253,250,0.94)_52%,_rgba(254,252,232,0.92))] px-4 py-5 shadow-2xl shadow-sky-200/55 backdrop-blur-xl transition-transform duration-300 dark:border-slate-800 dark:bg-[linear-gradient(180deg,_#0f172a_0%,_#0c1a2e_52%,_#111827_100%)] dark:shadow-none lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between px-2 pb-5">
              <div>
                <BrandMark titleClassName="text-base font-bold leading-tight text-gray-900 dark:text-white" subtitleClassName="text-xs text-emerald-600 dark:text-emerald-300" />
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
              <ul className="space-y-2">
                {portalSections.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection(item.key as any)
                        setSidebarOpen(false)
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${activeSection === item.key
                        ? 'bg-[linear-gradient(135deg,_#1d4ed8,_#0f766e,_#ca8a04)] text-white shadow-lg shadow-sky-300/60 dark:bg-emerald-500 dark:text-slate-950 dark:shadow-none'
                        : 'text-slate-700 hover:bg-white/85 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'}`}
                    >
                      {item.icon}
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${activeSection === item.key
                          ? 'bg-white/20 text-white'
                          : item.badge === 'Due'
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-8 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Need help?</p>
              <p className="mt-2 text-emerald-700 dark:text-emerald-300">
                Visit Help & Support for permit guidance, document tips, and contact channels.
              </p>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className={`sticky top-0 ${showNotifications ? 'z-[120]' : 'z-20'} border-b border-sky-100/80 bg-[linear-gradient(90deg,_rgba(255,255,255,0.82),_rgba(239,246,255,0.78),_rgba(254,252,232,0.75))] px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75 sm:px-6 lg:px-8`}>
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
                    ref={notificationButtonRef}
                    type="button"
                    title="Notifications"
                    aria-label="Notifications"
                    aria-haspopup="dialog"
                    aria-controls="student-notification-center"
                    onClick={() => {
                      setSidebarOpen(false)
                      setShowNotifications((current) => !current)
                    }}
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
                    <div
                      ref={notificationPanelRef}
                      id="student-notification-center"
                      role="dialog"
                      aria-label="Student notifications"
                      className={`fixed inset-x-4 top-20 ${DIALOG_Z.toast} max-h-[70vh] overflow-y-auto rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl shadow-slate-300/30 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95 sm:left-auto sm:right-6 sm:w-[22rem] lg:absolute lg:right-0 lg:top-14 lg:w-[22rem] lg:max-h-[32rem]`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold">Notifications</h2>
                        <div className="flex items-center gap-1">
                          {notifications.length > 0 && user?.id ? (
                            <button
                              type="button"
                              className="rounded-lg px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950/40"
                              onClick={() => {
                                const next = new Set(readNotificationIds)
                                for (const n of notifications) {
                                  next.add(n.id)
                                }
                                setReadNotificationIds(next)
                                persistStudentNotificationReadIds(user.id, next)
                              }}
                            >
                              Mark all read
                            </button>
                          ) : null}
                          <button
                            type="button"
                            title="Close notifications"
                            aria-label="Close notifications"
                            onClick={() => setShowNotifications(false)}
                            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {notifications.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">
                            No notifications yet.
                          </div>
                        )}
                        {notifications.map((notification) => {
                          const isRead = readNotificationIds.has(notification.id)
                          return (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => {
                                if (!user?.id || isRead) {
                                  return
                                }
                                const next = new Set(readNotificationIds)
                                next.add(notification.id)
                                setReadNotificationIds(next)
                                persistStudentNotificationReadIds(user.id, next)
                              }}
                              className={`w-full rounded-2xl border p-3 text-left transition ${getNotificationToneClasses(notification.tone)} ${isRead ? 'opacity-60' : ''}`}
                            >
                              <p className="text-sm font-semibold">{notification.title}</p>
                              <p className="mt-1 text-xs leading-5">{notification.message}</p>
                              <p className="mt-2 text-[11px] opacity-80">{formatDateTime(notification.createdAt)}</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="ml-auto flex items-center gap-3 rounded-full border border-sky-100/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(239,246,255,0.92))] px-3 py-2 shadow-sm shadow-sky-100/70 dark:border-slate-700 dark:bg-slate-900/90">
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
                    <p className="text-xs text-slate-500 dark:text-slate-300">{studentData.course}</p>
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

              {activeSection === 'overview' && <section className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <div className="rounded-[2rem] border border-emerald-200/80 bg-[linear-gradient(135deg,_rgba(236,253,245,0.95),_rgba(239,246,255,0.92)_52%,_rgba(254,252,232,0.9))] p-6 shadow-xl shadow-emerald-200/55 backdrop-blur dark:border-emerald-900/30 dark:bg-[linear-gradient(135deg,_rgba(2,44,34,0.9),_rgba(15,23,42,0.9)_55%,_rgba(120,53,15,0.65))] dark:shadow-none">
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
                    <div className="rounded-3xl border border-sky-100 bg-sky-50/90 p-4 shadow-sm shadow-sky-100/70 dark:border-slate-800 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">Student ID</p>
                      <p className="mt-3 text-lg font-semibold">{studentData.studentId}</p>
                    </div>
                    <div className="rounded-3xl border border-emerald-100 bg-emerald-50/90 p-4 shadow-sm shadow-emerald-100/70 dark:border-slate-800 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">Permit Courses</p>
                      <p className="mt-3 text-lg font-semibold">{studentData.courseUnits?.length || 0} Registered Units</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">View codes in permit preview</p>
                    </div>
                    <div className="rounded-3xl border border-amber-100 bg-amber-50/90 p-4 shadow-sm shadow-amber-100/70 dark:border-slate-800 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">Year / Semester</p>
                      <p className="mt-3 text-lg font-semibold">{studentData.semester || currentSession}</p>
                    </div>
                    <div className="rounded-3xl border border-rose-100 bg-rose-50/90 p-4 shadow-sm shadow-rose-100/70 dark:border-slate-800 dark:bg-slate-900/70">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">Permit Status</p>
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
                  {permitStatus !== 'approved' ? (
                    <button
                      type="button"
                      onClick={() => setActiveSection('applications')}
                      className="mt-5 inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white dark:bg-slate-950/70 dark:text-white dark:hover:bg-slate-900"
                    >
                      Apply for Permit
                    </button>
                  ) : (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white dark:bg-slate-950/70 dark:text-white dark:hover:bg-slate-900"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white dark:bg-slate-950/70 dark:text-white dark:hover:bg-slate-900"
                      >
                        <Printer className="h-4 w-4" />
                        Print
                      </button>
                    </div>
                  )}
                </div>
              </section>}

              <div key={activeSection} className="kiu-page-in-animate">
                {activeSection === 'overview' && (
                  <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
                    <div className="space-y-6">
                      <section className="rounded-[2rem] border border-sky-200/75 bg-[linear-gradient(145deg,_rgba(239,246,255,0.96),_rgba(254,252,232,0.92)_48%,_rgba(254,242,242,0.9))] p-6 shadow-xl shadow-sky-200/45 backdrop-blur dark:border-sky-900/30 dark:bg-[linear-gradient(145deg,_rgba(12,26,46,0.92),_rgba(30,41,59,0.9)_52%,_rgba(69,10,10,0.65))] dark:shadow-none">
                        <div className="mb-5 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-green-600 dark:text-green-300">Permit Card Preview</p>
                            <h2 className="mt-2 text-2xl font-semibold">Digital Exam Permit</h2>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusView.badgeClass}`}>
                            {statusView.label}
                          </span>
                        </div>

                        {permitBlockers.length > 0 && (
                          <div className="mb-5 rounded-2xl border border-amber-200/90 bg-amber-50/95 p-4 dark:border-amber-900/50 dark:bg-amber-950/35">
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">What affects your permit right now</p>
                            <ul className="mt-2 list-inside list-disc space-y-2 text-sm marker:text-amber-600 dark:marker:text-amber-400">
                              {permitBlockers.map((blocker) => (
                                <li
                                  key={blocker.id}
                                  className={blocker.tone === 'red' ? 'text-red-700 dark:text-red-300' : 'text-amber-900 dark:text-amber-100/95'}
                                >
                                  <span className="font-medium">{blocker.title}:</span>{' '}
                                  {blocker.detail}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

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
                                <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">Student Name</p>
                                <h3 className="mt-2 text-xl font-semibold">{studentData.name}</h3>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Registration No. {studentData.studentId}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300">{studentData.course}</p>
                              </div>
                            </div>
                            <div className="w-32 shrink-0 rounded-3xl bg-white/80 p-3 shadow-sm dark:bg-slate-950/70">
                              {qrCodeUrl ? (
                                <>
                                  <img
                                    src={qrCodeUrl}
                                    alt="Verification QR code"
                                    className="mx-auto h-40 w-40 max-w-full rounded-lg bg-white p-1 sm:h-44 sm:w-44"
                                  />
                                  <div className="mt-2 text-[11px] text-green-700 dark:text-green-300 text-center">
                                    Scan to verify
                                  </div>
                                </>
                              ) : (
                                <div className="flex h-40 w-40 max-w-full items-center justify-center rounded-2xl bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:h-44 sm:w-44">
                                  QR unavailable
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-3xl bg-white/70 p-4 dark:bg-slate-950/70">
                              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">Academic Details</p>
                              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                                <p>Semester: {studentData.semester || currentSession}</p>
                                <p>Department: {studentData.department || 'Not assigned'}</p>
                              </div>
                            </div>
                            <div className="rounded-3xl bg-white/70 p-4 dark:bg-slate-950/70">
                              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-300">Fee Clearance</p>
                              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                                <p>Total Fees: {formatMoney(studentData.totalFees, activeFeeCurrency)}</p>
                                <p>Amount Paid: {formatMoney(studentData.amountPaid, activeFeeCurrency)}</p>
                                <p>Balance: {formatMoney(studentData.feesBalance, activeFeeCurrency)}</p>
                                <p className={permitOutputLocked ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}>
                                  {permitOutputLocked ? permitOutputMessage : 'Eligible for printing'}
                                </p>
                                <p className="text-slate-500 dark:text-slate-300">
                                  Prints this month: {studentData.monthlyPrintCount ?? 0}/{studentData.monthlyPrintLimit ?? examPermitConfig.printLimitPerMonth}
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
                              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${permitOutputLocked ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-300' : 'bg-emerald-500 text-white hover:bg-emerald-400'}`}
                              title={permitOutputLocked ? permitOutputMessage : 'Download permit'}
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </button>
                            <button
                              type="button"
                              onClick={handlePrint}
                              disabled={permitOutputLocked}
                              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${permitOutputLocked ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-300' : 'bg-green-600 text-white hover:bg-green-500'}`}
                              title={permitOutputLocked ? permitOutputMessage : 'Print permit'}
                            >
                              <Printer className="h-4 w-4" />
                              Print Permit
                            </button>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[2rem] border border-amber-200/80 bg-[linear-gradient(140deg,_rgba(255,251,235,0.95),_rgba(239,246,255,0.92))] p-6 shadow-xl shadow-amber-200/45 backdrop-blur dark:border-amber-900/30 dark:bg-[linear-gradient(140deg,_rgba(69,26,3,0.72),_rgba(15,23,42,0.9))] dark:shadow-none">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Semester Registration</p>
                            <h2 className="mt-2 text-2xl font-semibold">Register for a new semester</h2>
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

                        <form className="mt-6 space-y-4" onSubmit={(event) => void handleApplicationSubmit(event)}>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                            Select semester
                            <select
                              value={applicationDraft.semester}
                              onChange={(event) => setApplicationDraft({ semester: event.target.value })}
                              size={5}
                              className="mt-2 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                            >
                              {availableSemesters.length === 0 ? (
                                <option value={applicationDraft.semester}>{applicationDraft.semester}</option>
                              ) : availableSemesters.map((semester) => (
                                <option key={semester} value={semester}>{semester}</option>
                              ))}
                            </select>
                          </label>
                          <p className="text-xs text-slate-500 dark:text-slate-300">
                            After admin approval, your semester and course units will be updated automatically.
                          </p>
                          <button
                            type="submit"
                            disabled={submittingApplication}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            {submittingApplication ? 'Submitting...' : 'Submit semester registration'}
                          </button>
                        </form>
                      </section>
                    </div>

                    <div className="space-y-6">
                      <section className="rounded-[2rem] border border-blue-200/80 bg-[linear-gradient(145deg,_rgba(239,246,255,0.96),_rgba(224,242,254,0.92))] p-6 shadow-xl shadow-blue-200/45 backdrop-blur dark:border-blue-900/30 dark:bg-[linear-gradient(145deg,_rgba(10,25,47,0.92),_rgba(30,58,138,0.42))] dark:shadow-none">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Notifications Panel</p>
                        <h2 className="mt-2 text-2xl font-semibold">Latest updates</h2>
                        <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
                          {notifications.map((notification) => (
                            <div key={notification.id} className={`rounded-3xl border p-4 ${getNotificationToneClasses(notification.tone)}`}>
                              <p className="text-sm font-semibold">{notification.title}</p>
                              <p className="mt-1 text-sm leading-6">{notification.message}</p>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-[2rem] border border-rose-200/80 bg-[linear-gradient(145deg,_rgba(255,241,242,0.95),_rgba(254,252,232,0.9))] p-6 shadow-xl shadow-rose-200/45 backdrop-blur dark:border-rose-900/30 dark:bg-[linear-gradient(145deg,_rgba(60,9,9,0.72),_rgba(69,10,10,0.65)_55%,_rgba(51,65,85,0.8))] dark:shadow-none">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Application History</p>
                        <h2 className="mt-2 text-2xl font-semibold">Recent requests</h2>
                        <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
                          {filteredHistory.slice(0, 3).map((record) => (
                            <div key={record.id} className="rounded-3xl border border-rose-100 bg-rose-50/85 p-4 shadow-sm shadow-rose-100/60 dark:border-slate-800 dark:bg-slate-900/70">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold">{record.semester}</p>
                                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getStatusPresentation(record.status).badgeClass}`}>
                                  {record.status}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{formatDateTime(record.createdAt)}</p>
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
                    <section className="rounded-[2rem] border border-blue-200/80 bg-[linear-gradient(145deg,_rgba(239,246,255,0.96),_rgba(250,245,255,0.92))] p-6 shadow-xl shadow-blue-200/45 backdrop-blur dark:border-blue-900/30 dark:bg-[linear-gradient(145deg,_rgba(15,23,42,0.92),_rgba(30,58,138,0.42))] dark:shadow-none">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Filters</p>
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
                      <section className="rounded-[2rem] border border-amber-200/80 bg-[linear-gradient(140deg,_rgba(254,252,232,0.95),_rgba(239,246,255,0.9))] p-6 shadow-xl shadow-amber-200/45 backdrop-blur dark:border-amber-900/30 dark:bg-[linear-gradient(140deg,_rgba(69,26,3,0.72),_rgba(15,23,42,0.9))] dark:shadow-none">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Semester Registration</p>
                        <h2 className="mt-2 text-2xl font-semibold">Submit a semester request</h2>
                        <form className="mt-6 space-y-4" onSubmit={(event) => void handleApplicationSubmit(event)}>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                            Semester
                            <select
                              value={applicationDraft.semester}
                              onChange={(event) => setApplicationDraft({ semester: event.target.value })}
                              size={5}
                              className="mt-2 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                            >
                              {availableSemesters.length === 0 ? (
                                <option value={applicationDraft.semester}>{applicationDraft.semester}</option>
                              ) : availableSemesters.map((semester) => (
                                <option key={semester} value={semester}>{semester}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="submit"
                            disabled={submittingApplication}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          >
                            {submittingApplication ? 'Submitting...' : 'Submit request'}
                          </button>
                        </form>
                      </section>

                      <section className="rounded-[2rem] border border-red-200/80 bg-[linear-gradient(145deg,_rgba(255,241,242,0.95),_rgba(239,246,255,0.92))] p-6 shadow-xl shadow-red-200/45 backdrop-blur dark:border-red-900/30 dark:bg-[linear-gradient(145deg,_rgba(69,10,10,0.72),_rgba(30,41,59,0.88))] dark:shadow-none">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-300">Application History</p>
                        <h2 className="mt-2 text-2xl font-semibold">Permit requests</h2>
                        <div className="mt-6 max-h-80 overflow-x-auto overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800">
                          <table className="min-w-full text-left text-sm">
                            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.25em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
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

                    <section className="rounded-[2rem] border border-yellow-200/80 bg-[linear-gradient(145deg,_rgba(254,252,232,0.95),_rgba(240,249,255,0.9))] p-6 shadow-xl shadow-yellow-200/45 backdrop-blur dark:border-yellow-900/30 dark:bg-[linear-gradient(145deg,_rgba(66,32,6,0.7),_rgba(15,23,42,0.9))] dark:shadow-none">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Printed Permit History</p>
                      <h2 className="mt-2 text-2xl font-semibold">One record per semester</h2>
                      <div className="mt-6 max-h-80 overflow-x-auto overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800">
                        <table className="min-w-full text-left text-sm">
                          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.25em] text-slate-500 dark:bg-slate-900 dark:text-slate-300">
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
                    <section className="rounded-[2rem] border border-blue-200/80 bg-[linear-gradient(145deg,_rgba(239,246,255,0.96),_rgba(224,242,254,0.92))] p-6 shadow-xl shadow-blue-200/45 backdrop-blur dark:border-blue-900/30 dark:bg-[linear-gradient(145deg,_rgba(10,25,47,0.92),_rgba(30,58,138,0.42))] dark:shadow-none">
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
                              className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
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
                              placeholder="e.g. Permit@2027 (leave blank to keep current password)"
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">Use uppercase, lowercase, number, and special character. Example: Permit@2027</p>
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

                    <section className="rounded-[2rem] border border-red-200/80 bg-[linear-gradient(145deg,_rgba(255,241,242,0.95),_rgba(254,252,232,0.9))] p-6 shadow-xl shadow-red-200/45 backdrop-blur dark:border-red-900/30 dark:bg-[linear-gradient(145deg,_rgba(69,10,10,0.72),_rgba(30,41,59,0.88))] dark:shadow-none">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">Preview</p>
                      <h2 className="mt-2 text-2xl font-semibold">Current profile</h2>
                      <div className="mt-6 rounded-[2rem] border border-red-100 bg-[linear-gradient(145deg,_rgba(255,241,242,0.88),_rgba(255,247,237,0.8))] p-5 dark:border-slate-800 dark:bg-slate-900/70">
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
                      <Faq />
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
                          <div>
                            <label htmlFor="support-attachment" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Attachment (optional)</label>
                            <input
                              id="support-attachment"
                              type="file"
                              onChange={(event) => setSupportAttachment(event.target.files?.[0] ?? null)}
                              className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                            />
                            {supportAttachment && (
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                                Selected: {supportAttachment.name}
                              </p>
                            )}
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
                                {getUnreadAdminMessageCount(request) > 0 ? (
                                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                                    {getUnreadAdminMessageCount(request)} unread
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{formatDateTime(request.createdAt)}</p>
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{request.message}</p>
                              {Array.isArray(request.messages) && request.messages.length > 0 ? (
                                <div className="mt-3 space-y-2 rounded-2xl bg-white p-3 text-sm dark:bg-slate-950">
                                  {request.messages.map((entry) => (
                                    <div key={entry.id} className={`rounded-xl px-3 py-2 ${entry.senderRole === 'admin' ? 'bg-blue-50 text-slate-800 dark:bg-blue-950/30 dark:text-slate-200' : 'bg-emerald-50 text-slate-800 dark:bg-emerald-950/30 dark:text-slate-200'}`}>
                                      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                                        {entry.senderRole === 'admin' ? 'Admin' : 'You'} • {formatDateTime(entry.createdAt)}
                                      </p>
                                      <p className="mt-1">{entry.message}</p>
                                      {entry.attachmentUrl ? (
                                        <a
                                          href={entry.attachmentUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline dark:text-blue-300"
                                        >
                                          Attachment: {entry.attachmentName || 'Download file'}
                                        </a>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : request.adminReply ? (
                                <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                  Admin reply: {request.adminReply}
                                </p>
                              ) : null}
                              {request.status !== 'resolved' && (
                                <div className="mt-3">
                                  <textarea
                                    rows={2}
                                    value={supportReplyDrafts[request.id] ?? ''}
                                    onChange={(event) => setSupportReplyDrafts((current) => ({ ...current, [request.id]: event.target.value }))}
                                    placeholder="Add follow-up details or clarifications..."
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                  />
                                  <div className="mt-2 flex justify-end">
                                    <input
                                      type="file"
                                      aria-label={`Attach file for support request ${request.id}`}
                                      title="Attach a file"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null
                                        setSupportReplyAttachments((current) => ({ ...current, [request.id]: file }))
                                      }}
                                      className="mr-2 block text-xs text-slate-500 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium dark:text-slate-300 dark:file:border-slate-700 dark:file:bg-slate-900"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => void handleSendSupportReply(request.id)}
                                      disabled={sendingSupportReplyId === request.id}
                                      className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                      {sendingSupportReplyId === request.id ? 'Sending...' : 'Send follow-up'}
                                    </button>
                                  </div>
                                </div>
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
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-300">Current Balance</p>
                              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatMoney(feesBalance, activeFeeCurrency)}
                              </h2>
                            </div>
                          </div>
                          {examPeriodDeadline && (
                            <div className={`mt-4 rounded-2xl border px-3 py-2 text-xs ${
                              feesBalance > 0
                                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                            }`}>
                              <p className="font-semibold">
                                Exam period: {examPeriodDeadline.title}
                              </p>
                              <p>
                                Starts {formatDate(examPeriodDeadline.dueAt ?? '')}
                                {formatDeadlineCountdown(examPeriodDeadline.dueAt) ? ` (${formatDeadlineCountdown(examPeriodDeadline.dueAt)})` : ''}
                              </p>
                              {feesBalance > 0 && (
                                <p className="mt-1 font-semibold">Reminder: clear your balance before exam period starts.</p>
                              )}
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Payment Statistics */}
                      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                        <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl"></div>
                        <div className="relative z-10 h-full flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-300">Total Paid (Semester)</p>
                            <PieChart className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="mt-2 text-center sm:text-left">
                            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{formatMoney(amountPaid, activeFeeCurrency)}</h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300 flex items-center justify-center sm:justify-start gap-1">
                              {feesBalance <= 0 ? (
                                <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Fully cleared for previous sessions</>
                              ) : (
                                <><TrendingUp className="h-3 w-3 text-blue-500" /> Installment plan active</>
                              )}
                            </p>
                          </div>
                          <div className="mt-4 w-full rounded-full bg-slate-100 dark:bg-slate-800 h-2.5">
                            <PaymentProgressBarFill percent={paymentProgress} />
                          </div>
                          <p className="text-xs text-right mt-1 text-slate-500 font-medium">{paymentProgress}% of Annual Target</p>
                        </div>
                      </section>

                      {/* Upcoming Deadlines */}
                      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none xl:col-span-1 md:col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                          <CalendarDays className="h-5 w-5 text-orange-500" />
                          <h3 className="font-semibold text-slate-900 dark:text-white">Important Deadlines</h3>
                        </div>
                        <div className="space-y-4">
                          {deadlines && deadlines.length > 0 ? (
                            deadlines.map((dl) => {
                              const countdown = formatDeadlineCountdown(dl.dueAt)
                              return (
                                <div key={dl.id} className="flex items-center justify-between border-l-2 border-orange-500 pl-3 gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">{dl.title}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-300">{dl.subtitle}</p>
                                    {countdown ? (
                                      <p className="mt-1 text-[11px] font-semibold text-orange-600 dark:text-orange-400">{countdown}</p>
                                    ) : null}
                                  </div>
                                  <span className="flex-shrink-0 text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded-full dark:bg-orange-900/40 dark:text-orange-300">
                                    {dl.dateLabel}
                                  </span>
                                </div>
                              )
                            })
                          ) : (
                            <>
                              <div className="flex items-center justify-between border-l-2 border-orange-500 pl-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-300">Final Exam Clearance</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-300">Clear all balances to generate permit</p>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded-full dark:bg-orange-900/40 dark:text-orange-300">In 14 Days</span>
                              </div>
                              <div className="flex items-center justify-between border-l-2 border-slate-300 dark:border-slate-600 pl-3">
                                <div>
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-300">Next Semester Reg.</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-300">Early bird registration fee</p>
                                </div>
                                <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-full dark:bg-slate-800 dark:text-slate-300">August 1st</span>
                              </div>
                            </>
                          )}
                        </div>
                      </section>
                    </div>

                    {/* Recent Transactions */}
                    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-xl shadow-blue-100/30 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-none">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Recent Transactions</h2>
                        <button
                          type="button"
                          onClick={handleDownloadFinanceStatement}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex text-center gap-1"
                        >
                          <Download className="h-4 w-4" />
                          Statement
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300">
                              <th className="pb-3 font-medium">Date</th>
                              <th className="pb-3 font-medium">Description</th>
                              <th className="pb-3 font-medium">Method</th>
                              <th className="pb-3 font-medium text-right">Amount</th>
                              <th className="pb-3 font-medium text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {/* Dynamic Transactions based on balance */}
                            {(amountPaid > 0 ? [
                              {
                                date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                                desc: feesBalance === 0 ? 'Full Tuition Settlement' : 'Tuition Installment',
                                method: 'System Sync',
                                amount: formatMoney(amountPaid, activeFeeCurrency),
                                status: 'Completed'
                              },
                              ...(amountPaid > 1000 ? [{
                                date: 'Aug 20, 2023',
                                desc: 'Registration Fee',
                                method: 'Visa Card',
                                amount: formatMoney(Math.min(500, Math.max(0, amountPaid * 0.05)), activeFeeCurrency),
                                status: 'Completed'
                              }] : [])
                            ] : []).map((txn, idx) => (
                              <tr key={idx} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                <td className="py-4 text-slate-600 dark:text-slate-300">{txn.date}</td>
                                <td className="py-4 font-medium text-slate-900 dark:text-white">{txn.desc}</td>
                                <td className="py-4 text-slate-600 dark:text-slate-300">
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-300" />
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

                {activeSection === 'permit_courses' && (
                  <div className="space-y-6">
                    {/* Permit Courses Overview Header */}
                    <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-r from-blue-600 to-indigo-700 p-8 shadow-xl shadow-blue-200/50 dark:border-slate-800 dark:from-slate-900 dark:to-indigo-950 dark:shadow-none mb-6">
                      <div className="absolute right-0 top-0 opacity-10">
                        <GraduationCap className="h-48 w-48 -mt-8 -mr-8" />
                      </div>
                      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="text-white">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 mb-4 text-xs font-semibold backdrop-blur-sm">
                            <TrendingUp className="h-3.5 w-3.5" /> Permit Active Session
                          </span>
                          <h1 className="text-3xl font-bold">{currentSession}</h1>
                          <p className="mt-2 text-blue-100 max-w-md">You are cleared for {studentData.courseUnits?.length || 0} courses on your digital permit. Ensure your details match the university register.</p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950/80">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Digital Permit Details</h2>
                      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                          <p><span className="font-semibold">Name:</span> {studentData.name}</p>
                          <p><span className="font-semibold">Registration No:</span> {studentData.studentId}</p>
                          <p><span className="font-semibold">Program:</span> {studentData.program || studentData.course}</p>
                          <p><span className="font-semibold">Semester:</span> {studentData.semester || currentSession}</p>
                          <p><span className="font-semibold">Status:</span> {statusView.label}</p>
                        </div>
                        <div className="w-32 shrink-0 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                          {qrCodeUrl ? (
                            <>
                              <img
                                src={qrCodeUrl}
                                alt="Permit QR code"
                                className="mx-auto h-40 w-40 max-w-full rounded-lg bg-white p-1 sm:h-44 sm:w-44"
                              />
                              <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-300">Scan to verify</p>
                            </>
                          ) : (
                            <div className="mx-auto flex h-40 w-40 max-w-full items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:h-44 sm:w-44">
                              QR unavailable
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* Courses Grid */}
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Permit Courses</h2>
                      <button className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition" onClick={() => setActiveSection('overview')}>Digital Permit &rarr;</button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {studentData.courseUnits?.map((unit, idx) => {
                        // Extract code and title
                        const parts = unit.split(' ')
                        const code = parts[0]
                        const title = parts.slice(1).join(' ') || code

                        return (
                          <div key={idx} className="group relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-950/70 hover:dark:shadow-none">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                <BookOpen className="h-5 w-5" />
                              </div>
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{code}</span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2 min-h-[2.5rem]">{title}</h3>
                            <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                              <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Scheduled Session</span>
                              <span>Permit Unit</span>
                            </div>
                          </div>
                        )
                      })}
                      {(!studentData.courseUnits || studentData.courseUnits.length === 0) && (
                        <div className="col-span-full rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                          <BookOpen className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-400 mb-3" />
                          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No courses assigned</h3>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">You are not currently enrolled in any course units on your permit.</p>
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
