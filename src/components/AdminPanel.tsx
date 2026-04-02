import { ChangeEvent, DragEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useState, useRef } from 'react'

  // Ref to preserve search input focus
import {
  BarChart2, Bell, CheckCircle2, CreditCard, Download, FileCheck,
  FileSpreadsheet, FileUp, LayoutDashboard, LogOut, Menu,
  Moon, Pencil, QrCode, RefreshCcw, Save, Search, Settings, Shield, Sun, Trash2, Upload, Users, X,
} from 'lucide-react'
import { KIU_COLLEGES, KIU_COURSES, KIU_CURRICULUM, KIU_DEPARTMENT_DEFAULT_PROGRAM, KIU_DEPARTMENTS, KIU_SEMESTERS, KiuCourseUnit } from '../config/universityData'
import BrandMark from './BrandMark'
import PermitCard from './PermitCard'
import ConfirmDialog from './ConfirmDialog'
import { SaveConfirmationDialog } from './SaveConfirmationDialog'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { publicApiBaseUrl } from '../config/provider'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { downloadFinancialImportTemplate, downloadStudentAccountsImportTemplate } from '../services/adminImportTemplate'
import { downloadAdminDashboardCsv, downloadAdminDashboardExcel, printAdminDashboardReport } from '../services/adminDashboardExport'
import { downloadPermitActivityCsv } from '../services/permitActivityExport'
import { adminUpdateStudentProfile, applyStudentAccountsImport, bulkSyncCurriculum, clearStudentBalance, createAssistantAdmin, createStudentProfile, deleteAdminActivityLog, deleteStudentProfile, fetchAdminActivityLogsPage, fetchAssistantAdmins, fetchStudentProfilesPage, fetchSupportRequests, fetchSystemFeeSettings, fetchTrashedStudentProfiles, grantStudentPermitPrintAccess, importStudentFinancials, permanentlyDeleteTrashedStudent, permanentlyPurgeAllTrashedStudents, previewStudentAccountsImport, purgePermitActivityLogs, restoreStudentProfile, updateAssistantAdmin, updateStudentAccount, updateStudentFinancials, updateSupportRequest, updateSystemFeeSettings, fetchStudentProfileById } from '../services/profileService'
import { parseFinancialSpreadsheet } from '../services/spreadsheetImport'
import type { AdminActivityLog, AdminPermission, AdminProfileUpdateInput, AssistantAdminAccount, AuthUser, CreateStudentInput, FinancialImportRow, FinancialImportUpdate, StudentCategory, StudentProfile, StudentExam, SupportRequest, SupportRequestStatus, SystemFeeSettings, TrashedStudentProfile, UniversityDeadline } from '../types'
import type { StudentProvisionPreviewRow } from '../adapters/data/types'
import { DIALOG_Z } from '../constants/dialogLayers'
import SignOutDialog from './SignOutDialog'

type PaymentDrafts = Record<string, string>
type ImportPreviewRow = {
  rowNumber: number
  matcher: string
  amountPaid?: number
  totalFees?: number
  status: 'ready' | 'create' | 'skipped'
  reason?: string
  studentName?: string
}
type NavSection = 'dashboard' | 'students' | 'dustbin' | 'support' | 'permits' | 'import' | 'reports' | 'permit-cards' | 'assistants' | 'settings'
type BulkImportSubSection = 'financial' | 'student_accounts' | 'api'

type AdminPermitDesignFields = {
  photo: boolean
  department: boolean
  semester: boolean
  course: boolean
}

type AdminPermitDesignState = {
  logo: string
  name: string
  fields: AdminPermitDesignFields
}

const DEFAULT_ADMIN_PERMIT_DESIGN: AdminPermitDesignState = {
  logo: '',
  name: '',
  fields: { photo: true, department: true, semester: true, course: true },
}

const STUDENT_PAGE_SIZE = 24
const ACTIVITY_PAGE_SIZE = 12
const SYSTEM_STUDENT_EMAIL_DOMAIN = 'kiu.examcard.com'
const DEFAULT_SYSTEM_FEE_SETTINGS: SystemFeeSettings = {
  localStudentFee: 3000,
  internationalStudentFee: 6000,
  currencyCode: 'USD',
}

type EditDraft = Omit<AdminProfileUpdateInput, 'totalFees' | 'courseUnits'> & {
  totalFees: string
  courseUnitsText: string
}

type CreateStudentDraft = Omit<CreateStudentInput, 'totalFees' | 'amountPaid' | 'courseUnits'> & {
  totalFees: string
  amountPaid: string
  courseUnitsText: string
  currentYearOfStudy: string
}

const YEAR_OF_STUDY_OPTIONS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5']

type CreatedStudentWelcome = {
  name: string
  email: string
  studentId: string
  password: string
  generatedPassword: boolean
}

type FeeSettingsDraft = {
  localStudentFee: string
  internationalStudentFee: string
  currencyCode: string
  deadlines: UniversityDeadline[]
}

type AdminCapabilityProfile = {
  scope: 'super-admin' | 'registrar' | 'finance' | 'operations'
  label: string
  sections: NavSection[]
  canImportFinancials: boolean
  canGenerateBulkPermits: boolean
  canSendReminders: boolean
  canExportReports: boolean
}

type DashboardAlert = {
  id: string
  title: string
  message: string
  tone: 'critical' | 'warning' | 'info'
  actionLabel?: string
  onAction?: () => void
}

type SupportReplyDrafts = Record<string, string>
type SupportStatusDrafts = Record<string, SupportRequestStatus>
type AssistantAdminRole = 'support_help' | 'department_prints'
type AssistantAdminDraft = {
  name: string
  email: string
  phoneNumber: string
  password: string
  role: AssistantAdminRole
  departments: string[]
}
type AssistantAdminEditDraft = {
  role: AssistantAdminRole
  departments: string[]
}
type PendingConfirmation = {
  title: string
  message: string
  confirmLabel: string
  tone: 'danger' | 'primary' | 'success'
  action: () => Promise<void>
}

function getActivityTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getPaymentCompletionPercent(amountPaid: number, totalFees: number) {
  if (totalFees <= 0) {
    return 0
  }

  return Math.min(Math.max((amountPaid / totalFees) * 100, 0), 100)
}

function parseCurrencyDraft(value: string) {
  const normalizedValue = value.trim().replace(/,/g, '')

  if (!normalizedValue) {
    return Number.NaN
  }

  return Number(normalizedValue)
}

function getDaysUntilDate(targetDate: string) {
  const targetTime = new Date(targetDate).getTime()

  if (Number.isNaN(targetTime)) {
    return null
  }

  const diffMs = targetTime - Date.now()
  return Math.max(Math.ceil(diffMs / (24 * 60 * 60 * 1000)), 0)
}

function readAdminNotificationReadSet(adminId: string): Set<string> {
  if (typeof window === 'undefined') {
    return new Set()
  }

  try {
    const raw = localStorage.getItem(`admin-notifications-read:${adminId}`)
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

function persistAdminNotificationReadSet(adminId: string, ids: Set<string>) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(`admin-notifications-read:${adminId}`, JSON.stringify([...ids]))
}

function hasAnyPermission(permissions: Set<AdminPermission>, required: AdminPermission[]) {
  return required.some((permission) => permissions.has(permission))
}

function getAdminCapabilityLabel(scope: AdminCapabilityProfile['scope']) {
  switch (scope) {
    case 'super-admin':
      return 'Super Admin'
    case 'registrar':
      return 'Registrar Desk'
    case 'finance':
      return 'Finance Desk'
    default:
      return 'Operations Desk'
  }
}

function getAdminSections(permissions: Set<AdminPermission>): NavSection[] {
  const sections = new Set<NavSection>(['dashboard', 'settings'])

  if (permissions.size > 0) {
    sections.add('assistants')
  }

  if (permissions.has('view_students')) {
    sections.add('students')
  }

  if (permissions.has('manage_student_profiles')) {
    sections.add('dustbin')
  }

  if (permissions.has('view_audit_logs')) {
    sections.add('permits')
  }

  if (permissions.has('manage_support_requests')) {
    sections.add('support')
  }

  if (permissions.has('manage_student_profiles')) {
    sections.add('permit-cards')
  }

  if (permissions.has('manage_financials') || permissions.has('manage_student_profiles')) {
    sections.add('import')
  }

  if (hasAnyPermission(permissions, ['export_reports', 'view_audit_logs'])) {
    sections.add('reports')
  }

  return Array.from(sections)
}

function getAdminCapabilityProfile(user: AuthUser | null | undefined): AdminCapabilityProfile {
  const permissions = new Set(user?.role === 'admin' ? user.permissions ?? [] : [])
  const scope = user?.role === 'admin' ? user.scope ?? 'operations' : 'operations'
  return {
    scope,
    label: getAdminCapabilityLabel(scope),
    sections: getAdminSections(permissions),
    canImportFinancials: permissions.has('manage_financials'),
    canGenerateBulkPermits: permissions.has('manage_student_profiles'),
    canSendReminders: hasAnyPermission(permissions, ['manage_student_profiles', 'manage_financials', 'manage_support_requests']),
    canExportReports: permissions.has('export_reports'),
  }
}

function getPermitStatusCounts(students: StudentProfile[]) {
  const now = Date.now()
  let issued = 0
  let pending = 0
  let expired = 0

  for (const student of students) {
    const examTimestamp = Number.isNaN(new Date(student.examDate).getTime()) ? null : new Date(student.examDate).getTime()

    if (examTimestamp !== null && examTimestamp < now) {
      expired += 1
      continue
    }

    if (student.feesBalance === 0) {
      issued += 1
    } else {
      pending += 1
    }
  }

  return {
    issued,
    pending,
    rejected: 0,
    expired,
  }
}

function formatAdminActionLabel(action: string) {
  switch (action) {
    case 'print_permit':
      return 'Permit printed'
    case 'download_permit':
      return 'Permit downloaded'
    case 'update_student_financials':
      return 'Financials updated'
    case 'bulk_import_student_financials':
      return 'Bulk financial import'
    case 'bulk_import_student_accounts':
      return 'Bulk student account import'
    case 'admin_update_student_profile':
      return 'Student profile updated'
    default:
      return action.replace(/_/g, ' ')
  }
}

type AdminSettingsDraft = {
  name: string
  email: string
  phoneNumber: string
  currentPassword: string
  password: string
  confirmPassword: string
}

function formatFeeDraftValue(value: number) {
  return value.toFixed(2)
}

function getFeeForStudentCategory(feeSettings: SystemFeeSettings, studentCategory: StudentCategory) {
  return studentCategory === 'international' ? feeSettings.internationalStudentFee : feeSettings.localStudentFee
}

function createFeeSettingsDraft(feeSettings: SystemFeeSettings): FeeSettingsDraft {
  return {
    localStudentFee: formatFeeDraftValue(feeSettings.localStudentFee),
    internationalStudentFee: formatFeeDraftValue(feeSettings.internationalStudentFee),
    currencyCode: String(feeSettings.currencyCode ?? 'USD').trim().toUpperCase(),
    deadlines: [...(feeSettings.deadlines ?? [])],
  }
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

function programFromDepartment(department: string | null | undefined): string {
  const d = typeof department === 'string' ? department.trim() : ''
  if (!d) {
    return ''
  }
  const direct = KIU_DEPARTMENT_DEFAULT_PROGRAM[d]
  if (direct) {
    return direct
  }
  const lower = d.toLowerCase()
  for (const [name, prog] of Object.entries(KIU_DEPARTMENT_DEFAULT_PROGRAM)) {
    if (name.toLowerCase() === lower) {
      return prog
    }
  }
  return ''
}

type DepartmentColorStyle = {
  cardBorder: string
  cardTint: string
  pill: string
}

const DEPARTMENT_COLOR_STYLES: DepartmentColorStyle[] = [
  { cardBorder: 'border-blue-200', cardTint: 'bg-blue-50/30', pill: 'bg-blue-100 text-blue-700' },
  { cardBorder: 'border-violet-200', cardTint: 'bg-violet-50/30', pill: 'bg-violet-100 text-violet-700' },
  { cardBorder: 'border-cyan-200', cardTint: 'bg-cyan-50/30', pill: 'bg-cyan-100 text-cyan-700' },
  { cardBorder: 'border-pink-200', cardTint: 'bg-pink-50/30', pill: 'bg-pink-100 text-pink-700' },
  { cardBorder: 'border-indigo-200', cardTint: 'bg-indigo-50/30', pill: 'bg-indigo-100 text-indigo-700' },
  { cardBorder: 'border-teal-200', cardTint: 'bg-teal-50/30', pill: 'bg-teal-100 text-teal-700' },
]

function getDepartmentColorStyle(department: string | null | undefined): DepartmentColorStyle {
  const key = String(department ?? '').trim()
  if (!key) {
    return { cardBorder: 'border-slate-200', cardTint: 'bg-slate-50/30', pill: 'bg-slate-100 text-slate-700' }
  }
  const hash = [...key].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 0)
  return DEPARTMENT_COLOR_STYLES[hash % DEPARTMENT_COLOR_STYLES.length]
}

function inferProgramAndCourseForEdit(student: StudentProfile): { program: string; course: string } {
  const rawProgram = (student.program ?? '').trim()
  const rawCourse = (student.course ?? '').trim()
  let program = rawProgram
  let course = rawCourse

  if (program) {
    const ciKey = Object.keys(KIU_CURRICULUM).find((k) => k.toLowerCase() === program.toLowerCase())
    if (ciKey) {
      program = ciKey
    }
  }

  if (!program || !KIU_CURRICULUM[program]) {
    const fromDept = programFromDepartment(student.department)
    if (fromDept && KIU_CURRICULUM[fromDept]) {
      program = fromDept
    }
  }

  if (!program) {
    program = rawProgram
  }

  if (program && KIU_CURRICULUM[program] && !course) {
    course = KIU_CURRICULUM[program].defaultCourse
  }
  if (!course) {
    course = rawCourse
  }
  return { program, course }
}

function createExamsFromCurriculum(units: KiuCourseUnit[]): StudentExam[] {
  return units.map((u, index) => ({
    id: `exam-${Date.now()}-${index}`,
    title: u.unitName,
    examDate: '', // Admin sets this manually or it defaults to empty
    examTime: u.time,
    venue: u.venue,
    seatNumber: '', // Seat number removal confirmed
  }))
}

function createEmptyStudentDraft(feeSettings: SystemFeeSettings = DEFAULT_SYSTEM_FEE_SETTINGS, studentCategory: StudentCategory = 'local'): CreateStudentDraft {
  return {
    name: '',
    email: '',
    password: '',
    studentId: '',
    enrollmentStatus: 'active',
    studentCategory,
    phoneNumber: '',
    course: '',
    program: '',
    college: '',
    department: '',
    currentYearOfStudy: '',
    semester: '',
    courseUnitsText: '',
    profileImage: '',
    totalFees: formatFeeDraftValue(getFeeForStudentCategory(feeSettings, studentCategory)),
    amountPaid: '0',
    instructions: '',
    examDate: '',
    examTime: '',
    venue: '',
    seatNumber: '',
    exams: [],
  }
}

function buildSystemStudentEmail(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  const localPart = normalized || `student.${Date.now()}`
  return `${localPart}@${SYSTEM_STUDENT_EMAIL_DOMAIN}`
}

function parseCourseUnitsText(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((unit) => unit.trim())
    .filter(Boolean)
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const getRandomIndex = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const values = new Uint32Array(1)
      crypto.getRandomValues(values)
      return values[0] % alphabet.length
    }

    return Math.floor(Math.random() * alphabet.length)
  }

  const token = Array.from({ length: 10 }, () => alphabet[getRandomIndex()]).join('')
  return `Permit-${token}`
}



export default function AdminPanel() {
  const [refreshing, setRefreshing] = useState(false)
  const { user, signOut, refreshUser } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const { setHasUnsavedChanges, registerSaveHandler, registerDiscardHandler, unregisterDiscardHandler } = useUnsavedChanges()
  // Removed unused variable 'location'
  const adminCapability = getAdminCapabilityProfile(user)
  const canViewStudents = adminCapability.sections.includes('students')
  const canViewPermitActivity = adminCapability.sections.includes('permits')
  const canManageSupportRequests = adminCapability.sections.includes('support')
  const canManageStudentProfiles = adminCapability.sections.includes('permit-cards')
  const canManageFinancials = adminCapability.canImportFinancials
  const bulkImportTabs = useMemo((): BulkImportSubSection[] => {
    const tabs: BulkImportSubSection[] = []
    if (canManageFinancials) {
      tabs.push('financial')
    }
    if (canManageStudentProfiles) {
      tabs.push('student_accounts', 'api')
    }
    return tabs
  }, [canManageFinancials, canManageStudentProfiles])
  const canDeleteAuditLogs = Boolean(user?.role === 'admin' && user.permissions?.includes('write_audit_logs'))
  const canAccessReports = adminCapability.sections.includes('reports')
  const showAssistantAdminPanel = user?.role === 'admin'
  const canManageAssistantAdmins = user?.role === 'admin' && user.scope === 'super-admin'
  const [students, setStudents] = useState<StudentProfile[]>([])
  // Ref for search input (no focus logic)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [paymentDrafts, setPaymentDrafts] = useState<PaymentDrafts>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([])
  const [pendingImportUpdates, setPendingImportUpdates] = useState<FinancialImportUpdate[]>([])
  const [bulkImportSubSection, setBulkImportSubSection] = useState<BulkImportSubSection>('financial')
  const [studentAccountsImporting, setStudentAccountsImporting] = useState(false)
  const [studentAccountsDragActive, setStudentAccountsDragActive] = useState(false)
  const [studentImportFileName, setStudentImportFileName] = useState('')
  const [studentImportPreviewRows, setStudentImportPreviewRows] = useState<StudentProvisionPreviewRow[]>([])
  const [pendingStudentImportFile, setPendingStudentImportFile] = useState<File | null>(null)
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([])
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([])
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<SupportReplyDrafts>({})
  const [supportStatusDrafts, setSupportStatusDrafts] = useState<SupportStatusDrafts>({})
  const [loadingSupportRequests, setLoadingSupportRequests] = useState(false)
  const [savingSupportRequestId, setSavingSupportRequestId] = useState<string | null>(null)
  const [activityPage, setActivityPage] = useState(1)
  const [activityTotalItems, setActivityTotalItems] = useState(0)
  const [activityTotalPages, setActivityTotalPages] = useState(1)
  const [showPrintedOnly, setShowPrintedOnly] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [activeSection, setActiveSection] = useState<NavSection>('students')
  const [searchInputValue, setSearchInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSignOut, setShowSignOut] = useState(false) // 2. Add showSignOut state
  const [signingOut, setSigningOut] = useState(false) // 2. Add signingOut state
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'outstanding'>('all')
  const [filterDepartment, setFilterDepartment] = useState<string>('')
  const [filterProgram, setFilterProgram] = useState<string>('')
  const [filterCourse, setFilterCourse] = useState<string>('')
  const [filterCollege, setFilterCollege] = useState<string>('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(STUDENT_PAGE_SIZE)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStudents, setTotalStudents] = useState(0)
  const [clearedStudents, setClearedStudents] = useState(0)
  const [outstandingStudents, setOutstandingStudents] = useState(0)
  const [trashedStudents, setTrashedStudents] = useState<TrashedStudentProfile[]>([])
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null)
  const [showCreateStudent, setShowCreateStudent] = useState(false)
  const [systemFeeSettings, setSystemFeeSettings] = useState<SystemFeeSettings>(DEFAULT_SYSTEM_FEE_SETTINGS)
  const [feeSettingsDraft, setFeeSettingsDraft] = useState<FeeSettingsDraft>(() => createFeeSettingsDraft(DEFAULT_SYSTEM_FEE_SETTINGS))
  const activeCurrencyCode = useMemo(
    () => normalizeCurrencyCode(systemFeeSettings.currencyCode),
    [systemFeeSettings.currencyCode],
  )
  const [editDraft, setEditDraft] = useState<EditDraft>({
    name: '', email: '', studentId: '', studentCategory: 'local', phoneNumber: '', profileImage: '', course: '', program: '', college: '', department: '', semester: '', courseUnitsText: '', totalFees: '',
  })
  const [createDraft, setCreateDraft] = useState<CreateStudentDraft>(() => createEmptyStudentDraft(DEFAULT_SYSTEM_FEE_SETTINGS))
  const [createPasswordGenerated, setCreatePasswordGenerated] = useState(false)
  const [createdStudentWelcome, setCreatedStudentWelcome] = useState<CreatedStudentWelcome | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingStudentId, setDeletingStudentId] = useState('')
  const [restoringStudentId, setRestoringStudentId] = useState('')
  const [grantingPrintAccessId, setGrantingPrintAccessId] = useState('')
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [unsavedLeaveIntent, setUnsavedLeaveIntent] = useState<null | 'edit' | 'create'>(null)
  const [savingCreate, setSavingCreate] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotificationCenter, setShowNotificationCenter] = useState(false)
  const [readAdminAlertIds, setReadAdminAlertIds] = useState<Set<string>>(() => new Set())
  const [bulkPrintStudents, setBulkPrintStudents] = useState<StudentProfile[]>([])
  const [bulkPrintQrCodes, setBulkPrintQrCodes] = useState<Record<string, string>>({})
  const [bulkPrinting, setBulkPrinting] = useState(false)
  const [bulkPrintConfirm, setBulkPrintConfirm] = useState<{ students: StudentProfile[]; title: string } | null>(null)
  const [selectedPermitStudentIds, setSelectedPermitStudentIds] = useState<string[]>([])
  const [lastSyncAt, setLastSyncAt] = useState('')
  const [lastReminderAt, setLastReminderAt] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingFeeStructure, setSavingFeeStructure] = useState(false)
  const [savingDeadlines, setSavingDeadlines] = useState(false)
  const [assistantAdmins, setAssistantAdmins] = useState<AssistantAdminAccount[]>([])
  const [assistantAdminsLoading, setAssistantAdminsLoading] = useState(false)
  const [assistantAdminsSaving, setAssistantAdminsSaving] = useState(false)
  const [assistantAdminEditingId, setAssistantAdminEditingId] = useState('')
  const [assistantAdminUpdatingId, setAssistantAdminUpdatingId] = useState<string | null>(null)
  const [assistantAdminDraft, setAssistantAdminDraft] = useState<AssistantAdminDraft>({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    role: 'department_prints',
    departments: [],
  })
  const [assistantAdminEditDraft, setAssistantAdminEditDraft] = useState<AssistantAdminEditDraft>({
    role: 'department_prints',
    departments: [],
  })
  const [settingsDraft, setSettingsDraft] = useState<AdminSettingsDraft>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phoneNumber: '',
    currentPassword: '',
    password: '',
    confirmPassword: '',
  })
  // Permit design settings
  const [permitDesign, setPermitDesign] = useState<AdminPermitDesignState>(() => {
    try {
      const raw = localStorage.getItem('permitDesign')
      if (!raw) {
        return DEFAULT_ADMIN_PERMIT_DESIGN
      }
      const parsed = JSON.parse(raw) as Partial<AdminPermitDesignState>
      return {
        ...DEFAULT_ADMIN_PERMIT_DESIGN,
        ...parsed,
        fields: { ...DEFAULT_ADMIN_PERMIT_DESIGN.fields, ...parsed.fields },
      }
    } catch {
      return DEFAULT_ADMIN_PERMIT_DESIGN
    }
  })

  function handlePermitDesignChange(field: 'logo' | 'name', value: string) {
    setPermitDesign((current) => {
      const next = { ...current, [field]: value }
      localStorage.setItem('permitDesign', JSON.stringify(next))
      return next
    })
  }
  function handlePermitFieldToggle(field: keyof AdminPermitDesignFields) {
    setPermitDesign((current) => {
      const next = { ...current, fields: { ...current.fields, [field]: !current.fields[field] } }
      localStorage.setItem('permitDesign', JSON.stringify(next))
      return next
    })
  }

  const loadAssistantAdmins = useCallback(async (options?: { silent?: boolean }) => {
    if (!canManageAssistantAdmins) {
      setAssistantAdmins([])
      return
    }

    try {
      if (!options?.silent) {
        setAssistantAdminsLoading(true)
      }
      const nextAssistants = await fetchAssistantAdmins()
      setAssistantAdmins(nextAssistants)
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load assistant admins.'
      setError(nextError)
    } finally {
      if (!options?.silent) {
        setAssistantAdminsLoading(false)
      }
    }
  }, [canManageAssistantAdmins])

  async function handleCreateAssistantAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canManageAssistantAdmins) {
      setError('Only super admin can create assistant admins.')
      return
    }

    const normalizedName = assistantAdminDraft.name.trim()
    const normalizedEmail = assistantAdminDraft.email.trim().toLowerCase()
    const normalizedPhoneNumber = assistantAdminDraft.phoneNumber.trim()
    const normalizedPassword = assistantAdminDraft.password.trim()
    const normalizedDepartments = assistantAdminDraft.departments.map((value) => value.trim()).filter(Boolean)

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      setError('Name, email, and temporary password are required for assistant admin creation.')
      return
    }

    if (assistantAdminDraft.role === 'department_prints' && normalizedDepartments.length === 0) {
      setError('Assign at least one department for department print assistants.')
      return
    }

    try {
      setAssistantAdminsSaving(true)
      setError('')
      await createAssistantAdmin({
        name: normalizedName,
        email: normalizedEmail,
        phoneNumber: normalizedPhoneNumber || undefined,
        password: normalizedPassword,
        role: assistantAdminDraft.role,
        departments: assistantAdminDraft.role === 'department_prints' ? normalizedDepartments : [],
      })
      setAssistantAdminDraft({
        name: '',
        email: '',
        phoneNumber: '',
        password: '',
        role: 'department_prints',
        departments: [],
      })
      await loadAssistantAdmins({ silent: true })
      setSuccessMessage('Assistant admin account created successfully.')
    } catch (createError) {
      const nextError = createError instanceof Error ? createError.message : 'Unable to create assistant admin.'
      setError(nextError)
    } finally {
      setAssistantAdminsSaving(false)
    }
  }

  function handleStartAssistantEdit(assistant: AssistantAdminAccount) {
    setAssistantAdminEditingId(assistant.id)
    setAssistantAdminEditDraft({
      role: assistant.role,
      departments: assistant.departments,
    })
  }

  function handleCancelAssistantEdit() {
    setAssistantAdminEditingId('')
    setAssistantAdminEditDraft({ role: 'department_prints', departments: [] })
  }

  async function handleSaveAssistantEdit(assistantId: string) {
    if (!canManageAssistantAdmins) {
      setError('Only super admin can update assistant admins.')
      return
    }

    const normalizedDepartments = assistantAdminEditDraft.departments.map((value) => value.trim()).filter(Boolean)
    if (assistantAdminEditDraft.role === 'department_prints' && normalizedDepartments.length === 0) {
      setError('Assign at least one department for department print assistants.')
      return
    }

    try {
      setAssistantAdminUpdatingId(assistantId)
      setError('')
      await updateAssistantAdmin(assistantId, {
        role: assistantAdminEditDraft.role,
        departments: assistantAdminEditDraft.role === 'department_prints' ? normalizedDepartments : [],
      })
      await loadAssistantAdmins({ silent: true })
      handleCancelAssistantEdit()
      setSuccessMessage('Assistant admin updated successfully.')
    } catch (updateError) {
      const nextError = updateError instanceof Error ? updateError.message : 'Unable to update assistant admin.'
      setError(nextError)
    } finally {
      setAssistantAdminUpdatingId(null)
    }
  }

  const loadStudents = useCallback(async (options?: {
    silent?: boolean
    page?: number
    search?: string
    status?: 'all' | 'paid' | 'outstanding'
    department?: string
    program?: string
    course?: string
    college?: string
  }) => {
    const silent = options?.silent ?? false
    const nextPage = options?.page ?? page
    const nextSearch = options?.search ?? searchQuery
    const nextStatus = options?.status ?? filterStatus
    const nextDepartment = options?.department ?? filterDepartment
    const nextProgram = options?.program ?? filterProgram
    const nextCourse = options?.course ?? filterCourse
    const nextCollege = options?.college ?? filterCollege

    try {
      if (!silent) {
        setLoading(true)
        // Only clear error on non-silent loads to avoid unnecessary re-renders
        setError('')
      }
      const nextStudentPage = await fetchStudentProfilesPage({
        page: nextPage,
        pageSize,
        search: nextSearch,
        status: nextStatus,
        department: nextDepartment,
        program: nextProgram,
        course: nextCourse,
        college: nextCollege,
      })
      const nextStudents = nextStudentPage.items

      setStudents(nextStudents)
      setTotalItems(nextStudentPage.totalItems)
      setTotalPages(nextStudentPage.totalPages)
      setTotalStudents(nextStudentPage.totalStudents)
      setClearedStudents(nextStudentPage.clearedStudents)
      setOutstandingStudents(nextStudentPage.outstandingStudents)
      // Preserve user-typed payment drafts during silent refreshes
      // Only reset to server values on initial load or non-silent refreshes
      setPaymentDrafts((currentDrafts) => {
        const nextDrafts: PaymentDrafts = {}
        for (const student of nextStudents) {
          // Field is "payment to add this time", not running total — default empty, keep in-progress typing on refresh
          nextDrafts[student.id] = currentDrafts[student.id] ?? ''
        }
        return nextDrafts
      })
      setLastSyncAt(new Date().toISOString())
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load students'
      setError(nextError)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [filterStatus, page, pageSize, searchQuery, filterDepartment, filterProgram, filterCourse, filterCollege])

  const loadTrashedStudents = useCallback(async () => {
    if (!canManageStudentProfiles) {
      setTrashedStudents([])
      return
    }

    try {
      const nextTrashedStudents = await fetchTrashedStudentProfiles()
      setTrashedStudents(nextTrashedStudents)
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load deleted student records.'
      setError(nextError)
    }
  }, [canManageStudentProfiles])

  const loadActivityLogs = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const nextActivityPage = await fetchAdminActivityLogsPage({
        page: activityPage,
        pageSize: ACTIVITY_PAGE_SIZE,
      })
      setActivityLogs(nextActivityPage.items)
      setActivityTotalItems(nextActivityPage.totalItems)
      setActivityTotalPages(nextActivityPage.totalPages)
      if (!options?.silent) {
        setLastSyncAt(new Date().toISOString())
      }
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load activity logs'
      setError(nextError)
    }
  }, [activityPage])

  const loadSupportRequestQueue = useCallback(async (options?: { silent?: boolean }) => {
    if (!canManageSupportRequests) {
      setSupportRequests([])
      setSupportReplyDrafts({})
      setSupportStatusDrafts({})
      return
    }

    try {
      if (!options?.silent) {
        setLoadingSupportRequests(true)
      }

      const nextSupportRequests = await fetchSupportRequests()
      setSupportRequests(nextSupportRequests)
      setSupportReplyDrafts((current) => {
        const nextDrafts: SupportReplyDrafts = {}

        for (const request of nextSupportRequests) {
          nextDrafts[request.id] = current[request.id] ?? request.adminReply ?? ''
        }

        return nextDrafts
      })
      setSupportStatusDrafts((current) => {
        const nextDrafts: SupportStatusDrafts = {}

        for (const request of nextSupportRequests) {
          nextDrafts[request.id] = current[request.id] ?? request.status
        }

        return nextDrafts
      })
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load support requests'
      setError(nextError)
    } finally {
      if (!options?.silent) {
        setLoadingSupportRequests(false)
      }
    }
  }, [canManageSupportRequests])

  const loadFeeSettings = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      return
    }

    try {
      const nextFeeSettings = await fetchSystemFeeSettings()
      setSystemFeeSettings(nextFeeSettings)
      setFeeSettingsDraft(createFeeSettingsDraft(nextFeeSettings))
    } catch (loadError) {
      const nextError = loadError instanceof Error ? loadError.message : 'Unable to load fee structure settings.'
      setError(nextError)
    }
  }, [user])

  // Debounce the search input value to update searchQuery
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInputValue)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInputValue])

  // Initial load - non-silent to show loading state
  useEffect(() => {
    // Only run once on mount to load initial data
    void loadStudents({ search: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Search-triggered loads - silent to avoid UI blinking
  useEffect(() => {
    // Skip on initial mount since we already loaded above
    if (searchQuery === '') {
      return
    }
    // Only trigger loadStudents when searchQuery changes, not on every keystroke
    // Use silent: true to avoid unnecessary loading state changes
    void loadStudents({ search: searchQuery, silent: true })
  }, [searchQuery, loadStudents])

  useEffect(() => {
    void loadTrashedStudents()
  }, [loadTrashedStudents])

  const handleSavePayment = useCallback(async (event: { preventDefault: () => void }, student: StudentProfile) => {
    event.preventDefault()
    if (!user) return


    if (!canManageFinancials) {
      setError('Your admin view does not allow financial updates.')
      return
    }

    const paymentIncrement = parseCurrencyDraft(paymentDrafts[student.id] ?? '')

    if (Number.isNaN(paymentIncrement) || paymentIncrement <= 0) {
      setError('Enter the amount on this bank slip or payment (greater than zero). It will be added to what is already recorded.')
      return
    }

    const nextAmountPaid = Number((student.amountPaid + paymentIncrement).toFixed(2))

    try {
      setSavingId(student.id)
      setError('')
      setSuccessMessage('')
      await updateStudentFinancials(student.id, { amountPaid: nextAmountPaid }, user.id)
      setPaymentDrafts((cur) => ({ ...cur, [student.id]: '' }))
      await loadStudents()
      // Fetch and update the individual student profile to ensure permit status is up-to-date
      const updatedProfile = await fetchStudentProfileById(student.id)
      setStudents((prev) => prev.map((s) => (s.id === student.id ? updatedProfile : s)))
      setSuccessMessage(
        `Posted ${formatMoney(paymentIncrement, activeCurrencyCode)} for ${student.name} (e.g. new bank slip). Cumulative amount received: ${formatMoney(nextAmountPaid, activeCurrencyCode)} of ${formatMoney(student.totalFees, activeCurrencyCode)} expected.`,
      )
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to save payment changes'
      setError(nextError)
    } finally {
      setSavingId(null)
    }
  }, [user, canManageFinancials, paymentDrafts, loadStudents, activeCurrencyCode])

  const handleSaveEdit = useCallback(async (event: { preventDefault: () => void }): Promise<boolean> => {
    event.preventDefault()

    if (!editingStudent || !user) {
      return false
    }

    if (!canManageStudentProfiles) {
      setError('Your admin view does not allow student profile edits.')
      return false
    }

    const totalFeesNum = parseCurrencyDraft(editDraft.totalFees)
    const courseUnits = parseCourseUnitsText(editDraft.courseUnitsText)

    if (Number.isNaN(totalFeesNum) || totalFeesNum < 0) {
      setError('Expected total fees must be a valid positive number.')
      return false
    }

    try {
      setSavingEdit(true)
      setError('')
      setSuccessMessage('')
      await adminUpdateStudentProfile(
        editingStudent.id,
        {
          name: editDraft.name,
          email: editDraft.email,
          studentId: editDraft.studentId,
          studentCategory: editDraft.studentCategory,
          phoneNumber: editDraft.phoneNumber,
          profileImage: editDraft.profileImage || null,
          course: editDraft.course,
          program: editDraft.program,
          college: editDraft.college,
          department: editDraft.department,
          semester: editDraft.semester,
          courseUnits,
          totalFees: totalFeesNum,
          exams: editDraft.exams,
        },
        user.id,
      )
      await loadStudents()
      setSuccessMessage(`Student profile updated for ${editDraft.name}.`)
      setEditingStudent(null)
      return true
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update student profile'
      setError(nextError)
      return false
    } finally {
      setSavingEdit(false)
    }
  }, [user, editingStudent, canManageStudentProfiles, editDraft, loadStudents])

  const handleCreateStudent = useCallback(async (event: { preventDefault: () => void }): Promise<boolean> => {
    event.preventDefault()
    if (!user) {
      return false
    }

    if (!canManageStudentProfiles) {
      setError('Your admin view does not allow student profile edits.')
      return false
    }

    const resolvedProgram = (createDraft.program ?? '').trim()
    const resolvedDepartment = (createDraft.department ?? '').trim()
    const resolvedYearOfStudy = (createDraft.currentYearOfStudy ?? '').trim()
    const resolvedSemester = (createDraft.semester ?? '').trim()
    const resolvedCourse = resolvedProgram || resolvedDepartment || 'General Studies'
    const resolvedSemesterLabel = resolvedSemester
      ? (resolvedYearOfStudy ? `${resolvedYearOfStudy} - ${resolvedSemester}` : resolvedSemester)
      : undefined
    const generatedEmail = buildSystemStudentEmail(createDraft.name)
    const totalFeesNum = getFeeForStudentCategory(systemFeeSettings, createDraft.studentCategory)
    const amountPaidNum = 0
    const courseUnits: string[] = []

    try {
      setSavingCreate(true)
      setError('')
      setSuccessMessage('')
      setCreatedStudentWelcome(null)
      const assignedPassword = createDraft.password
      const createdProfile = await createStudentProfile({
        name: createDraft.name,
        email: generatedEmail,
        enrollmentStatus: createDraft.enrollmentStatus ?? 'active',
        password: assignedPassword,
        studentId: createDraft.studentId,
        studentCategory: createDraft.studentCategory,
        phoneNumber: createDraft.phoneNumber,
        course: resolvedCourse,
        program: resolvedProgram,
        college: undefined,
        department: resolvedDepartment,
        semester: resolvedSemesterLabel,
        courseUnits,
        profileImage: null,
        totalFees: totalFeesNum,
        amountPaid: amountPaidNum,
        instructions: undefined,
        examDate: undefined,
        examTime: undefined,
        venue: undefined,
        seatNumber: undefined,
        exams: [],
      }, user.id)
      const createdStudentMatcher = createdProfile.studentId || createdProfile.email || createdProfile.name
      setActiveSection('students')
      setFilterStatus('all')
      setSearchQuery(createdStudentMatcher)
      setPage(1)
      await loadStudents({
        page: 1,
        search: createdStudentMatcher,
        status: 'all',
      })
      setSuccessMessage(`Student profile created for ${createDraft.name}.`)
      setCreatedStudentWelcome({
        name: createDraft.name,
        email: generatedEmail,
        studentId: createDraft.studentId,
        password: assignedPassword,
        generatedPassword: createPasswordGenerated,
      })
      setShowCreateStudent(false)
      setCreateDraft(createEmptyStudentDraft(systemFeeSettings))
      setCreatePasswordGenerated(false)
      return true
    } catch (createError) {
      const nextError = createError instanceof Error ? createError.message : 'Unable to create student profile'
      setError(nextError)
      return false
    } finally {
      setSavingCreate(false)
    }
  }, [user, canManageStudentProfiles, createDraft, systemFeeSettings, loadStudents, createPasswordGenerated])

  // Auto-save handler registration
  useEffect(() => {
    // Register save handler for unsaved changes
    registerSaveHandler(async () => {
      if (editingStudent) {
        return await handleSaveEdit({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)
      }
      if (showCreateStudent) {
        return await handleCreateStudent({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)
      }
      // Save any pending payment drafts
      const pendingPayments = Object.entries(paymentDrafts).filter(([_, value]) => value !== '')
      if (pendingPayments.length > 0) {
        // Trigger save for all pending payments
        for (const [studentId] of pendingPayments) {
          const student = students.find(s => s.id === studentId)
          if (student) {
            await handleSavePayment({ preventDefault: () => {} } as FormEvent<HTMLFormElement>, student)
          }
        }
        return true
      }
      return true
    })

    return () => {
      registerSaveHandler(() => Promise.resolve(false))
    }
  }, [editingStudent, showCreateStudent, paymentDrafts, students, registerSaveHandler, handleSaveEdit, handleCreateStudent, handleSavePayment])

  // Track unsaved changes while edit/create dialogs are open (do not auto-save: that closed the dialog after idle time while scrolling)
  useEffect(() => {
    if (editingStudent || showCreateStudent) {
      setHasUnsavedChanges(true)
    } else {
      setHasUnsavedChanges(false)
    }
  }, [editingStudent, showCreateStudent, setHasUnsavedChanges])

  useEffect(() => {
    registerDiscardHandler(() => {
      setEditingStudent(null)
      setShowCreateStudent(false)
      setCreateDraft(createEmptyStudentDraft(systemFeeSettings))
      setCreatePasswordGenerated(false)
    })
    return unregisterDiscardHandler
  }, [registerDiscardHandler, unregisterDiscardHandler, systemFeeSettings])

  useEffect(() => {
    if (!canViewPermitActivity) {
      setActivityLogs([])
      setActivityTotalItems(0)
      setActivityTotalPages(1)
      return
    }

    void loadActivityLogs()
  }, [canViewPermitActivity, loadActivityLogs])

  useEffect(() => {
    if (!canManageSupportRequests) {
      setSupportRequests([])
      setSupportReplyDrafts({})
      setSupportStatusDrafts({})
      return
    }

    if (activeSection === 'support') {
      void loadSupportRequestQueue()
    }
  }, [activeSection, canManageSupportRequests, loadSupportRequestQueue])

  useEffect(() => {
    void loadFeeSettings()
  }, [loadFeeSettings])

  useEffect(() => {
    if (!user?.id || user.role !== 'admin') {
      return
    }

    setReadAdminAlertIds(readAdminNotificationReadSet(user.id))
  }, [user?.id, user.role])

  useEffect(() => {
    setPage(1)
  }, [filterStatus])

  useEffect(() => {
    setSelectedPermitStudentIds((current) => current.filter((studentId) => students.some((student) => student.id === studentId)))
  }, [students])

  useEffect(() => {
    if (!adminCapability.sections.includes(activeSection)) {
      setActiveSection(adminCapability.sections[0] ?? 'dashboard')
    }
  }, [activeSection, adminCapability.sections])

  useEffect(() => {
    if (bulkImportTabs.length === 0) {
      return
    }
    if (!bulkImportTabs.includes(bulkImportSubSection)) {
      setBulkImportSubSection(bulkImportTabs[0])
    }
  }, [bulkImportTabs, bulkImportSubSection])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadStudents({ silent: true })
      if (canManageStudentProfiles) {
        void loadTrashedStudents()
      }
      if (canViewPermitActivity) {
        void loadActivityLogs({ silent: true })
      }
      if (canManageSupportRequests && activeSection === 'support') {
        void loadSupportRequestQueue({ silent: true })
      }
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeSection, canManageStudentProfiles, canManageSupportRequests, canViewPermitActivity, loadActivityLogs, loadStudents, loadSupportRequestQueue, loadTrashedStudents])

  useEffect(() => {
    if (activeSection !== 'settings') {
      return
    }

    if (!canManageAssistantAdmins) {
      return
    }

    void loadAssistantAdmins()
  }, [activeSection, canManageAssistantAdmins, loadAssistantAdmins])

  useEffect(() => {
    if (typeof window === 'undefined' || !user) {
      return
    }

    let timeoutId = window.setTimeout(() => {
      void signOut()
    }, 15 * 60 * 1000)

    const resetTimeout = () => {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        void signOut()
      }, 15 * 60 * 1000)
    }

    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']
    for (const eventName of events) {
      window.addEventListener(eventName, resetTimeout, { passive: true })
    }

    return () => {
      window.clearTimeout(timeoutId)
      for (const eventName of events) {
        window.removeEventListener(eventName, resetTimeout)
      }
    }
  }, [signOut, user])

  // Only sync user info to settingsDraft on initial mount or when user changes significantly
  // Avoid syncing during typing to prevent input reset issues
   
  useEffect(() => {
    setSettingsDraft((current) => {
      // Only update if the values are empty or significantly different
      // This prevents resetting fields while user is typing
      const shouldUpdate = !current.name || !current.email || current.phoneNumber === undefined
      if (!shouldUpdate) {
        return current
      }
      return {
        ...current,
        name: user?.name ?? '',
        email: user?.email ?? '',
        phoneNumber: user?.phoneNumber === 'Not assigned' ? '' : user?.phoneNumber ?? '',
      }
    })
    // Intentionally only depend on user?.id to avoid resetting drafts on every user property change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const permitActivityLogs = activityLogs
    .filter((log) => log.action === 'print_permit' || log.action === 'download_permit')
    .sort((left, right) => getActivityTimestamp(right.createdAt) - getActivityTimestamp(left.createdAt))

  function getStudentPrintSummary(studentId: string) {
    const studentLogs = permitActivityLogs.filter((log) => log.targetProfileId === studentId)

    const printCount = studentLogs.filter((log) => log.action === 'print_permit').length
    const downloadCount = studentLogs.filter((log) => log.action === 'download_permit').length

    if (studentLogs.length === 0) {
      return {
        total: 0,
        printCount: 0,
        downloadCount: 0,
        hasPrinted: false,
        lastAction: null as string | null,
        lastAt: null as string | null,
      }
    }

    const [latestLog] = studentLogs
    return {
      total: studentLogs.length,
      printCount,
      downloadCount,
      hasPrinted: printCount > 0,
      lastAction: latestLog.action,
      lastAt: latestLog.createdAt,
    }
  }

  const visibleStudents = showPrintedOnly
    ? students.filter((student) => getStudentPrintSummary(student.id).hasPrinted)
    : students

  let filteredStudents = visibleStudents
  if (filterDepartment) {
    filteredStudents = filteredStudents.filter((student) => student.department === filterDepartment)
  }
  if (filterProgram) {
    filteredStudents = filteredStudents.filter((student) => student.program === filterProgram)
  }
  if (filterCourse) {
    filteredStudents = filteredStudents.filter((student) => student.course === filterCourse)
  }
  if (filterCollege) {
    filteredStudents = filteredStudents.filter((student) => student.college === filterCollege)
  }
  const hasActiveStudentFilters = Boolean(searchQuery.trim()) || filterStatus !== 'all' || showPrintedOnly || filterDepartment || filterProgram || filterCourse || filterCollege
  const permitDepartmentOptions = useMemo(
    () => Array.from(new Set(students.map((student) => (student.department ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [students],
  )
  const permitProgramOptions = useMemo(
    () => Array.from(new Set(students.map((student) => (student.program ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [students],
  )
  const permitCourseOptions = useMemo(() => {
    const fromStudents = students
      .filter((student) => !filterProgram || (student.program ?? '').trim() === filterProgram)
      .map((student) => (student.course ?? '').trim())
      .filter(Boolean)
    const fromCurriculum = filterProgram && KIU_CURRICULUM[filterProgram]?.defaultCourse
      ? [KIU_CURRICULUM[filterProgram].defaultCourse]
      : []
    return Array.from(new Set([...fromStudents, ...fromCurriculum])).sort((a, b) => a.localeCompare(b))
  }, [students, filterProgram])
  const activeStudentFilterLabels = [
    searchQuery.trim() ? `Search: ${searchQuery.trim()}` : null,
    filterStatus === 'paid' ? 'Status: Cleared only' : null,
    filterStatus === 'outstanding' ? 'Status: Outstanding only' : null,
    showPrintedOnly ? 'Permit activity: Printed only' : null,
    filterDepartment ? `Department: ${filterDepartment}` : null,
    filterProgram ? `Program: ${filterProgram}` : null,
    filterCourse ? `Course: ${filterCourse}` : null,
    filterCollege ? `College: ${filterCollege}` : null,
  ].filter((label): label is string => Boolean(label))
  const openSupportRequestCount = supportRequests.filter((request) => request.status !== 'resolved').length
  const permitEventCount = permitActivityLogs.length
  const pageStart = totalItems === 0 ? 0 : ((page - 1) * pageSize) + 1
  const pageEnd = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems)
  const activityPageStart = activityTotalItems === 0 ? 0 : ((activityPage - 1) * ACTIVITY_PAGE_SIZE) + 1
  const activityPageEnd = activityTotalItems === 0 ? 0 : Math.min(activityPage * ACTIVITY_PAGE_SIZE, activityTotalItems)
  const selectedPermitStudents = students.filter((student) => selectedPermitStudentIds.includes(student.id))
  let clearedSelectedPermitStudents = selectedPermitStudents.filter((student) => student.feesBalance === 0)
  if (filterDepartment) {
    clearedSelectedPermitStudents = clearedSelectedPermitStudents.filter((student) => student.department === filterDepartment)
  }
  if (filterProgram) {
    clearedSelectedPermitStudents = clearedSelectedPermitStudents.filter((student) => student.program === filterProgram)
  }
  if (filterCourse) {
    clearedSelectedPermitStudents = clearedSelectedPermitStudents.filter((student) => student.course === filterCourse)
  }
  if (filterCollege) {
    clearedSelectedPermitStudents = clearedSelectedPermitStudents.filter((student) => student.college === filterCollege)
  }

  const courseBreakdown = students.reduce<Record<string, { total: number; cleared: number }>>((acc, s) => {
    const course = s.course || 'Unknown'
    if (!acc[course]) acc[course] = { total: 0, cleared: 0 }
    acc[course].total++
    if (s.feesBalance === 0) acc[course].cleared++
    return acc
  }, {})
  const courseNames = Object.keys(courseBreakdown)
  const maxCourseCount = Math.max(...courseNames.map((c) => courseBreakdown[c].total), 1)
  const permitStatusCounts = getPermitStatusCounts(students)
  const upcomingExamEntries = students
    .flatMap((student) => student.exams.map((exam) => ({ student, exam, examTimestamp: new Date(exam.examDate).getTime() })))
    .filter((item) => !Number.isNaN(item.examTimestamp))
    .sort((left, right) => left.examTimestamp - right.examTimestamp)
    .slice(0, 8)
  const recentSystemActivity = activityLogs.slice(0, 6)
  const departmentOutstandingBreakdown = students.reduce<Record<string, number>>((acc, student) => {
    if (student.feesBalance <= 0) {
      return acc
    }

    const key = student.department ?? student.course ?? 'Unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const busiestOutstandingDepartment = Object.entries(departmentOutstandingBreakdown).sort((left, right) => right[1] - left[1])[0] ?? null
  // Automated alert: students with outstanding balances and exams within 7 days
  const studentsWithUpcomingUnpaidExams = students.filter(student => {
    if (student.feesBalance <= 0 || !student.exams?.length) return false
    return student.exams.some(exam => {
      const examTimestamp = new Date(exam.examDate).getTime()
      return !Number.isNaN(examTimestamp) && examTimestamp - Date.now() <= 7 * 24 * 60 * 60 * 1000 && examTimestamp > Date.now()
    })
  })

  const dashboardAlerts: DashboardAlert[] = [
    ...(outstandingStudents > 0 ? [{
      id: 'outstanding',
      title: 'Pending approvals require action',
      message: `${outstandingStudents} student account(s) still have unpaid balances and cannot be issued permits.`,
      tone: 'critical' as const,
      actionLabel: 'Review Students',
      onAction: () => setActiveSection('students'),
    }] : []),
    ...(permitStatusCounts.expired > 0 ? [{
      id: 'expired',
      title: 'Expired permits detected',
      message: `${permitStatusCounts.expired} permit record(s) are now expired and should be archived or reviewed.`,
      tone: 'warning' as const,
      actionLabel: 'Open Reports',
      onAction: () => setActiveSection('reports'),
    }] : []),
    ...(studentsWithUpcomingUnpaidExams.length > 0 ? [{
      id: 'auto-unpaid-upcoming',
      title: 'Automatic Alert: Outstanding Balances',
      message: `${studentsWithUpcomingUnpaidExams.length} student(s) still owe fees and need follow-up.`,
      tone: 'warning' as const,
      actionLabel: 'Send Reminders',
      onAction: () => {
        void handleSendReminders()
      },
    }] : []),
  ]
  const notificationCenterAlerts: DashboardAlert[] = [
    ...dashboardAlerts,
    ...(canManageSupportRequests && openSupportRequestCount > 0 ? [{
      id: 'support-queue',
      title: 'Support queue needs review',
      message: `${openSupportRequestCount} support request(s) are still open or in progress.`,
      tone: 'info' as const,
      actionLabel: 'Open Support',
      onAction: () => setActiveSection('support'),
    }] : []),
    ...(canViewPermitActivity && permitEventCount > 0 ? [{
      id: 'permit-events',
      title: 'Permit activity ready for review',
      message: `${permitEventCount} permit print/download event(s) are available in the activity log.`,
      tone: 'info' as const,
      actionLabel: 'Open Permit Activity',
      onAction: () => setActiveSection('permits'),
    }] : []),
  ]
  const notificationBadgeCount = notificationCenterAlerts.filter((alert) => !readAdminAlertIds.has(alert.id)).length

  function handleNotificationAlertAction(action?: () => void) {
    setShowNotificationCenter(false)
    action?.()
  }

  async function handleGenerateBulkPermits() {
    if (!adminCapability.canGenerateBulkPermits) {
      setError('Your admin view does not allow bulk permit generation.')
      return
    }

    let printableStudents = students.filter((student) => student.feesBalance === 0)
    if (filterDepartment) {
      printableStudents = printableStudents.filter((student) => student.department === filterDepartment)
    }
    if (filterProgram) {
      printableStudents = printableStudents.filter((student) => student.program === filterProgram)
    }
    if (filterCourse) {
      printableStudents = printableStudents.filter((student) => student.course === filterCourse)
    }
    if (filterCollege) {
      printableStudents = printableStudents.filter((student) => student.college === filterCollege)
    }

    await handleBulkPrintStudents(
      printableStudents,
      'Bulk_Permits_All_Eligible',
      'No cleared students are currently available for bulk permit generation.',
    )
  }

  function handleVerifyStudent() {
    if (!canViewStudents) {
      setError('Your admin view does not allow student verification actions.')
      return
    }

    setActiveSection('students')
    setSuccessMessage('Student verification view opened. Search by name, email, or registration number to review a record.')
  }

  function resetStudentView() {
    setSearchInputValue('')
    setSearchQuery('')
    setFilterStatus('all')
    setShowPrintedOnly(false)
    setFilterDepartment('')
    setFilterProgram('')
    setFilterCourse('')
    setFilterCollege('')
    setPage(1)
    void loadStudents({
      page: 1,
      search: '',
      status: 'all',
      department: '',
      program: '',
      course: '',
      college: '',
      silent: true,
    })
  }

  function handleExportDashboardCsv() {
    if (!adminCapability.canExportReports) {
      setError('Your admin view does not allow report exports.')
      return
    }

    downloadAdminDashboardCsv(students, activityLogs)
    setSuccessMessage('Exported the dashboard report in CSV format.')
  }

  function handleExportDashboardExcel() {
    if (!adminCapability.canExportReports) {
      setError('Your admin view does not allow report exports.')
      return
    }

    downloadAdminDashboardExcel(students, activityLogs)
    setSuccessMessage('Exported the dashboard report in Excel format.')
  }

  function handlePrintDashboardReport() {
    if (!adminCapability.canExportReports) {
      setError('Your admin view does not allow report exports.')
      return
    }

    try {
      printAdminDashboardReport(students, activityLogs)
      setSuccessMessage('Print preview opened! The print dialog should appear. Use it to save as PDF or print.')
    } catch (printError) {
      const nextError = printError instanceof Error ? printError.message : 'Unable to open the print preview.'
      setError(nextError)
    }
  }

  async function handleSendReminders() {
    if (!adminCapability.canSendReminders) {
      setError('Your admin view does not allow reminder actions.')
      return
    }

    if (outstandingStudents === 0) {
      setError('There are no outstanding student balances to remind right now.')
      return
    }

    setLastReminderAt(new Date().toISOString())
    setSuccessMessage(`Queued in-app reminder notices for ${outstandingStudents} outstanding student account(s). Email and SMS gateways are not configured in this demo environment.`)
  }

  function handleExportPermitActivity() {
    if (!adminCapability.canExportReports) {
      setError('Your admin view does not allow permit activity exports.')
      return
    }

    if (permitActivityLogs.length === 0) {
      setError('There is no permit activity to export yet.')
      return
    }

    setError('')
    setSuccessMessage('')
    downloadPermitActivityCsv(permitActivityLogs, students)
    setSuccessMessage(`Exported ${permitActivityLogs.length} permit activity row(s).`)
  }

  async function handleBulkPrintCleared() {
    let printableStudents = filteredStudents.filter((student) => student.feesBalance === 0);
    if (filterDepartment) {
      printableStudents = printableStudents.filter((student) => student.department === filterDepartment);
    }
    if (filterProgram) {
      printableStudents = printableStudents.filter((student) => student.program === filterProgram);
    }
    if (filterCourse) {
      printableStudents = printableStudents.filter((student) => student.course === filterCourse);
    }
    if (filterCollege) {
      printableStudents = printableStudents.filter((student) => student.college === filterCollege);
    }
    await handleBulkPrintStudents(printableStudents, `Cleared_Permits_Page_${page}`, 'There are no cleared students on this page to print.')
  }

  async function handlePrintSelectedPermits() {
    await handleBulkPrintStudents(
      clearedSelectedPermitStudents,
      `Selected_Permits_Page_${page}`,
      'Select at least one cleared student on this page before printing.',
    )
  }

  async function handleBulkPrintStudents(printableStudents: StudentProfile[], title: string, emptyMessage: string) {

    if (!canManageStudentProfiles) {
      setError('Your admin view does not allow permit card operations.')
      return
    }

    if (printableStudents.length === 0) {
      setError(emptyMessage)
      return
    }

    // Show count confirmation before printing
    setBulkPrintConfirm({ students: printableStudents, title })
  }

  async function executeBulkPrint(printableStudents: StudentProfile[], title: string) {
    setBulkPrintConfirm(null)

    if (typeof window === 'undefined') {
      return
    }

    try {
      setBulkPrinting(true)
      setError('')
      setSuccessMessage('')
      const { default: QRCode } = await import('qrcode')

      const qrEntries = await Promise.all(printableStudents.map(async (student) => {
        const qrValue = publicApiBaseUrl
          ? `${publicApiBaseUrl}/permits/${encodeURIComponent(student.permitToken)}`
          : ''

        const qrCodeUrl = qrValue
          ? await QRCode.toDataURL(qrValue, { errorCorrectionLevel: 'M', margin: 1, width: 160 })
          : ''

        return [student.id, qrCodeUrl] as const
      }))

      setBulkPrintStudents(printableStudents)
      setBulkPrintQrCodes(Object.fromEntries(qrEntries))
      setSuccessMessage(`Preparing ${printableStudents.length} permit(s) for printing.`)

      const previousTitle = document.title
      const cleanup = () => {
        setBulkPrintStudents([])
        setBulkPrintQrCodes({})
        document.title = previousTitle
      }

      window.addEventListener('afterprint', cleanup, { once: true })
      document.title = title
      window.setTimeout(() => {
        window.print()
        window.setTimeout(cleanup, 750)
      }, 50)
    } catch (bulkPrintError) {
      const nextError = bulkPrintError instanceof Error ? bulkPrintError.message : 'Unable to prepare bulk permit printing'
      setError(nextError)
    } finally {
      setBulkPrinting(false)
    }
  }



  async function handleClear(student: StudentProfile) {
    if (!user) {
      return
    }

    if (!canManageFinancials) {
      setError('Your admin view does not allow financial updates.')
      return
    }

    try {
      setSavingId(student.id)
      setError('')
      setSuccessMessage('')
      await clearStudentBalance(student.id, user.id)
      await loadStudents()
      // Fetch and update the individual student profile to ensure permit status is up-to-date
      const updatedProfile = await fetchStudentProfileById(student.id)
      setStudents((prev) => prev.map((s) => (s.id === student.id ? updatedProfile : s)))
      setSuccessMessage(`${student.name} has been cleared for printing.`)
    } catch (clearError) {
      const nextError = clearError instanceof Error ? clearError.message : 'Unable to clear student balance'
      setError(nextError)
    } finally {
      setSavingId(null)
    }
  }

  function handleEditStudent(student: StudentProfile) {
    if (!canManageStudentProfiles) {
      setError('Your admin view does not allow student profile edits.')
      return
    }

    setEditingStudent(student)
    const { program: inferredProgram, course: inferredCourse } = inferProgramAndCourseForEdit(student)
    setEditDraft({
      name: student.name,
      email: student.email,
      studentId: student.studentId ?? '',
      studentCategory: student.studentCategory ?? 'local',
      phoneNumber: student.phoneNumber === 'Not assigned' ? '' : student.phoneNumber ?? '',
      profileImage: student.profileImage ?? '',
      course: inferredCourse,
      program: inferredProgram,
      college: student.college ?? '',
      department: student.department ?? '',
      semester: student.semester ?? '',
      courseUnitsText: student.courseUnits?.join('\n') ?? '',
      totalFees: student.totalFees.toFixed(2),
      exams: student.exams ?? [],
    })
  }

  function handleOpenCreateStudent() {
    if (!canManageStudentProfiles) {
      setError('Your admin view does not allow student profile edits.')
      return
    }

    setCreateDraft(createEmptyStudentDraft(systemFeeSettings))
    setCreatePasswordGenerated(false)
    setShowCreateStudent(true)
  }

  function handleGenerateTemporaryPassword() {
    const nextPassword = generateTemporaryPassword()
    setCreateDraft((current) => ({ ...current, password: nextPassword }))
    setCreatePasswordGenerated(true)
  }





  async function moveStudentToTrash(student: StudentProfile) {
    if (!user) {
      return
    }

    try {
      setDeletingStudentId(student.id)
      setError('')
      setSuccessMessage('')
      await deleteStudentProfile(student.id, user.id)
      setEditingStudent(null)
      await loadStudents({ page: 1, status: 'all' })
      await loadTrashedStudents()
      setSuccessMessage(`Student profile moved to trash for ${student.name}. It can be restored during the trash retention window.`)
    } catch (deleteError) {
      const nextError = deleteError instanceof Error ? deleteError.message : 'Unable to delete student profile.'
      setError(nextError)
    } finally {
      setDeletingStudentId('')
    }
  }

  function handleDeleteStudentProfile(student: StudentProfile) {
    setPendingConfirmation({
      title: 'Move Student To Trash',
      message: `${student.name} will be removed from the active student list and can be restored during the trash retention window.`,
      confirmLabel: 'Move To Trash',
      tone: 'danger',
      action: async () => {
        await moveStudentToTrash(student)
      },
    })
  }

  async function handleDeleteStudent() {
    if (!editingStudent) {
      return
    }

    await handleDeleteStudentProfile(editingStudent)
  }

  function handleRestoreStudentProfile(student: TrashedStudentProfile) {
    setPendingConfirmation({
      title: 'Restore Student Record',
      message: `${student.name} will return to the active student list immediately if there are no email, phone, or registration conflicts.`,
      confirmLabel: 'Restore Student',
      tone: 'success',
      action: async () => {
        await restoreStudentFromTrash(student)
      },
    })
  }

  async function restoreStudentFromTrash(student: TrashedStudentProfile) {
    if (!user) {
      return
    }

    try {
      setRestoringStudentId(student.id)
      setError('')
      setSuccessMessage('')
      const restoredStudent = await restoreStudentProfile(student.id, user.id)
      await loadStudents({ page: 1, status: 'all' })
      await loadTrashedStudents()
      setSuccessMessage(`Restored student profile for ${restoredStudent.name}.`)
    } catch (restoreError) {
      const nextError = restoreError instanceof Error ? restoreError.message : 'Unable to restore student profile.'
      setError(nextError)
    } finally {
      setRestoringStudentId('')
    }
  }

  async function handleConfirmPendingAction() {
    if (!pendingConfirmation) {
      return
    }

    try {
      await pendingConfirmation.action()
    } finally {
      setPendingConfirmation(null)
    }
  }

  async function handleDeletePermitActivityLog(log: AdminActivityLog) {
    if (!canDeleteAuditLogs) {
      setError('You do not have permission to delete activity logs.')
      return
    }

    try {
      setError('')
      await deleteAdminActivityLog(log.id)
      await loadActivityLogs({ silent: true })
      setSuccessMessage('That permit activity entry was removed.')
    } catch (deleteLogError) {
      const nextError = deleteLogError instanceof Error ? deleteLogError.message : 'Unable to delete the activity log.'
      setError(nextError)
    }
  }

  function handleRequestPurgePermitActivity() {
    if (!canDeleteAuditLogs) {
      setError('You do not have permission to delete activity logs.')
      return
    }

    if (permitActivityLogs.length === 0) {
      setError('There is no permit activity to clear.')
      return
    }

    setError('')
    setPendingConfirmation({
      title: 'Clear all permit activity?',
      message: 'This permanently deletes every recorded permit print and download event. Other admin audit entries are kept.',
      confirmLabel: 'Clear permit activity',
      tone: 'danger',
      action: async () => {
        await purgePermitActivityLogs()
        setActivityPage(1)
        await loadActivityLogs({ silent: true })
        setSuccessMessage('Permit activity log cleared.')
      },
    })
  }

  function handlePermanentTrashRow(student: TrashedStudentProfile) {
    if (!canManageStudentProfiles || !user?.id) {
      return
    }

    setPendingConfirmation({
      title: 'Permanently delete from trash?',
      message: `${student.name} cannot be recovered after this step.`,
      confirmLabel: 'Delete forever',
      tone: 'danger',
      action: async () => {
        await permanentlyDeleteTrashedStudent(student.id)
        await loadTrashedStudents()
        setSuccessMessage('The trashed record was permanently deleted.')
      },
    })
  }

  function handlePurgeEntireTrash() {
    if (!canManageStudentProfiles) {
      return
    }

    if (trashedStudents.length === 0) {
      return
    }

    setPendingConfirmation({
      title: 'Empty trash permanently?',
      message: `${trashedStudents.length} deleted student record(s) will be removed with no recovery path.`,
      confirmLabel: 'Empty trash',
      tone: 'danger',
      action: async () => {
        await permanentlyPurgeAllTrashedStudents()
        await loadTrashedStudents()
        setSuccessMessage('Trash emptied permanently.')
      },
    })
  }

  async function handleGrantPrintAccess(student: StudentProfile) {
    if (!user) {
      return
    }

    if (!canManageStudentProfiles) {
      setError('Your admin view does not allow permit access changes.')
      return
    }

    try {
      setGrantingPrintAccessId(student.id)
      setError('')
      setSuccessMessage('')
      const updatedStudent = await grantStudentPermitPrintAccess(student.id, 1, user.id)
      await loadStudents({ page, search: searchQuery, status: filterStatus })
      setSuccessMessage(`Granted one extra permit print copy for ${updatedStudent.name}. ${updatedStudent.grantedPrintsRemaining ?? 0} extra print copy remains for this month.`)
    } catch (grantError) {
      const nextError = grantError instanceof Error ? grantError.message : 'Unable to grant permit print access.'
      setError(nextError)
    } finally {
      setGrantingPrintAccessId('')
    }
  }
  
  function resolveImportRows(rows: FinancialImportRow[]): { updates: FinancialImportUpdate[]; previewRows: ImportPreviewRow[] } {
    const updates: FinancialImportUpdate[] = []
    const previewRows: ImportPreviewRow[] = []
    const seenRowKeys = new Set<string>()
  
    for (const row of rows) {
      const matcher = row.studentId ?? row.email ?? row.userId ?? 'Unknown row'
      const duplicateKey = row.userId
        ? `id:${row.userId.toLowerCase()}`
        : row.email
          ? `email:${row.email.toLowerCase()}`
          : row.studentId
            ? `student:${row.studentId.toLowerCase()}`
            : `row:${row.rowNumber}`
  
      if (seenRowKeys.has(duplicateKey)) {
        previewRows.push({
          rowNumber: row.rowNumber,
          matcher,
          studentName: row.studentName,
          amountPaid: row.amountPaid,
          totalFees: row.totalFees,
          status: 'skipped',
          reason: 'This spreadsheet contains another row with the same student key.',
        })
        continue
      }
  
      seenRowKeys.add(duplicateKey)
  
      const matchedStudent = students.find((student) => {
        const matchesById = row.userId && student.id.toLowerCase() === row.userId.toLowerCase()
        const matchesByEmail = row.email && student.email.toLowerCase() === row.email.toLowerCase()
        const matchesByStudentId = row.studentId && student.studentId.toLowerCase() === row.studentId.toLowerCase()
        return matchesById || matchesByEmail || matchesByStudentId
      })
  
      if (!matchedStudent) {
        previewRows.push({
          rowNumber: row.rowNumber,
          matcher,
          studentName: row.studentName,
          amountPaid: row.amountPaid,
          totalFees: row.totalFees,
          status: 'skipped',
          reason: 'No matching student was found. Only existing students can be updated.',
        })
        continue;
      }
  
      updates.push({
        rowNumber: row.rowNumber,
        action: 'update',
        studentId: matchedStudent.id,
        amountPaid: row.amountPaid,
        totalFees: row.totalFees,
      })
  
      previewRows.push({
        rowNumber: row.rowNumber,
        matcher,
        amountPaid: row.amountPaid,
        totalFees: row.totalFees,
        status: 'ready',
        studentName: matchedStudent.name,
      })
    }
  
    return { updates, previewRows }
  }
  
  async function prepareImport(file: File) {
    if (!user) {
      return
    }
  
    if (!canManageFinancials) {
      setError('Your admin view does not allow financial imports.')
      return
    }
  
    try {
      setImporting(true)
      setError('')
      setSuccessMessage('')
      const rows = await parseFinancialSpreadsheet(file)
  
      if (rows.length === 0) {
        throw new Error('No valid financial rows were found in the uploaded spreadsheet.')
      }
  
      const resolvedImport = resolveImportRows(rows)
      setImportFileName(file.name)
      setPendingImportUpdates(resolvedImport.updates)
      setImportPreviewRows(resolvedImport.previewRows)
      setSuccessMessage(`Prepared ${resolvedImport.updates.length} row(s) from ${file.name} for review.`)
    } catch (importError) {
      const nextError = importError instanceof Error ? importError.message : 'Unable to import the spreadsheet'
      setError(nextError)
    } finally {
      setImporting(false)
    }
  }
  
  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.[0]) {
      return
    }
  
    const file = event.target.files[0]
    await prepareImport(file)
    event.target.value = ''
  }
  
  async function handleApplyImport() {
    if (!user || pendingImportUpdates.length === 0) {
      return
    }
  
    if (!canManageFinancials) {
      setError('Your admin view does not allow financial imports.')
      return
    }
  
    try {
      setImporting(true)
      setError('')
      const importResult = await importStudentFinancials(pendingImportUpdates, user.id)
      await loadStudents({ page: 1, status: 'all' })
  
      const failedRows = new Map(importResult.skippedRows.map((item) => [item.rowNumber, item.reason]))
      setImportPreviewRows((current) =>
        current.map((row) =>
          failedRows.has(row.rowNumber)
            ? { ...row, status: 'skipped', reason: failedRows.get(row.rowNumber) }
            : row,
        ),
      )
  
      setPendingImportUpdates([])
      setSuccessMessage(
        `Imported ${importResult.updatedCount} student payment update(s) and created ${importResult.createdCount} new student account(s) from ${importFileName}.${
          importResult.skippedRows.length > 0 ? ` ${importResult.skippedRows.length} row(s) failed.` : ''
        }`,
      )
  
      if (importResult.skippedRows.length > 0) {
        setError(
          importResult.skippedRows
            .slice(0, 5)
            .map((item) => `Row ${item.rowNumber}: ${item.reason}`)
            .join(' '),
        )
      }
    } catch (importError) {
      const nextError = importError instanceof Error ? importError.message : 'Unable to apply the import'
      setError(nextError)
    } finally {
      setImporting(false)
    }
  }
  
  function clearImportPreview() {
    setImportFileName('')
    setImportPreviewRows([])
    setPendingImportUpdates([])
  }

  async function prepareStudentAccountsImport(file: File) {
    if (!user) {
      return
    }

    if (!canManageStudentProfiles) {
      setError('Your admin view does not allow student account imports.')
      return
    }

    try {
      setStudentAccountsImporting(true)
      setError('')
      setSuccessMessage('')
      const rows = await previewStudentAccountsImport(file)
      setStudentImportFileName(file.name)
      setStudentImportPreviewRows(rows)
      setPendingStudentImportFile(file)
      const readyCount = rows.filter((row) => row.status === 'create').length
      setSuccessMessage(`Prepared ${rows.length} row(s) from ${file.name}. ${readyCount} row(s) are ready to create.`)
    } catch (importError) {
      const nextError = importError instanceof Error ? importError.message : 'Unable to preview the student import file'
      setError(nextError)
      setStudentImportFileName('')
      setStudentImportPreviewRows([])
      setPendingStudentImportFile(null)
    } finally {
      setStudentAccountsImporting(false)
    }
  }

  async function handleStudentImportFile(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.[0]) {
      return
    }

    const file = event.target.files[0]
    await prepareStudentAccountsImport(file)
    event.target.value = ''
  }

  async function handleApplyStudentAccountsImport() {
    if (!user || !pendingStudentImportFile) {
      return
    }

    if (!canManageStudentProfiles) {
      setError('Your admin view does not allow student account imports.')
      return
    }

    try {
      setStudentAccountsImporting(true)
      setError('')
      const importResult = await applyStudentAccountsImport(pendingStudentImportFile)
      await loadStudents({ page: 1, status: 'all' })

      const failedRows = new Map(importResult.skippedRows.map((item) => [item.rowNumber, item.reason]))
      setStudentImportPreviewRows((current) =>
        current.map((row) =>
          failedRows.has(row.rowNumber)
            ? { ...row, status: 'skipped' as const, reason: failedRows.get(row.rowNumber) }
            : row,
        ),
      )

      setPendingStudentImportFile(null)
      setSuccessMessage(
        `Created ${importResult.createdCount} student account(s) from ${studentImportFileName}.${
          importResult.skippedRows.length > 0 ? ` ${importResult.skippedRows.length} row(s) skipped or failed.` : ''
        }`,
      )

      if (importResult.skippedRows.length > 0) {
        setError(
          importResult.skippedRows
            .slice(0, 5)
            .map((item) => `Row ${item.rowNumber}: ${item.reason}`)
            .join(' '),
        )
      }
    } catch (importError) {
      const nextError = importError instanceof Error ? importError.message : 'Unable to apply the student import'
      setError(nextError)
    } finally {
      setStudentAccountsImporting(false)
    }
  }

  function clearStudentImportPreview() {
    setStudentImportFileName('')
    setStudentImportPreviewRows([])
    setPendingStudentImportFile(null)
  }

  function handleStudentImportDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setStudentAccountsDragActive(true)
  }

  function handleStudentImportDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setStudentAccountsDragActive(true)
  }

  function handleStudentImportDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setStudentAccountsDragActive(false)
  }

  async function handleStudentImportDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setStudentAccountsDragActive(false)

    const file = event.dataTransfer.files?.[0]

    if (!file) {
      return
    }

    await prepareStudentAccountsImport(file)
  }

  const handleSaveAdminSettings = useCallback(async (event: { preventDefault: () => void }) => {
    event.preventDefault()

    if (!user) {
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
      await updateStudentAccount(user.id, {
        name: settingsDraft.name,
        email: settingsDraft.email,
        phoneNumber: settingsDraft.phoneNumber || undefined,
        currentPassword: settingsDraft.currentPassword || undefined,
        password: settingsDraft.password || undefined,
      })
      await refreshUser()
      setSettingsDraft((current) => ({
        ...current,
        currentPassword: '',
        password: '',
        confirmPassword: '',
      }))
      setSuccessMessage('Admin account settings updated successfully.')
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update admin account settings.'
      setError(nextError)
    } finally {
      setSavingSettings(false)
    }
  }, [user, settingsDraft, refreshUser])

  async function handleSaveFeeStructure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canManageFinancials) {
      setError('Your admin view does not allow financial updates.')
      return
    }

    const localStudentFee = parseCurrencyDraft(feeSettingsDraft.localStudentFee)
    const internationalStudentFee = parseCurrencyDraft(feeSettingsDraft.internationalStudentFee)
    const rawCurrency = String(feeSettingsDraft.currencyCode ?? '').trim().toUpperCase()

    if (Number.isNaN(localStudentFee) || localStudentFee < 0 || Number.isNaN(internationalStudentFee) || internationalStudentFee < 0) {
      setError('Both local and international student fees must be valid numbers greater than or equal to 0. Example: 1250000 or 1,250,000.')
      return
    }

    if (!/^[A-Z]{3}$/.test(rawCurrency)) {
      setError('Currency must be a valid 3-letter ISO code (for example: USD, UGX, EUR).')
      return
    }

    const nextCurrencyCode = rawCurrency

    try {
      setSavingFeeStructure(true)
      setError('')
      setSuccessMessage('')
      const nextFeeSettings = await updateSystemFeeSettings({
        localStudentFee,
        internationalStudentFee,
        currencyCode: nextCurrencyCode,
        deadlines: [...(systemFeeSettings.deadlines ?? [])],
      })
      setSystemFeeSettings(nextFeeSettings)
      setFeeSettingsDraft(createFeeSettingsDraft(nextFeeSettings))
      setCreateDraft((current) => ({
        ...current,
        totalFees: formatFeeDraftValue(getFeeForStudentCategory(nextFeeSettings, current.studentCategory)),
      }))
      await loadStudents({ page: 1, status: 'all' })
      setSuccessMessage('Fee structure settings updated successfully and applied to existing students.')
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update fee structure settings.'
      setError(nextError)
    } finally {
      setSavingFeeStructure(false)
    }
  }

  async function handleSaveDeadlines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canManageFinancials) {
      setError('Your admin view does not allow financial updates.')
      return
    }

    try {
      setSavingDeadlines(true)
      setError('')
      setSuccessMessage('')
      const nextFeeSettings = await updateSystemFeeSettings({
        localStudentFee: systemFeeSettings.localStudentFee,
        internationalStudentFee: systemFeeSettings.internationalStudentFee,
        currencyCode: normalizeCurrencyCode(systemFeeSettings.currencyCode),
        deadlines: feeSettingsDraft.deadlines,
      })
      setSystemFeeSettings(nextFeeSettings)
      setFeeSettingsDraft(createFeeSettingsDraft(nextFeeSettings))
      setSuccessMessage('Deadline settings updated successfully.')
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update deadline settings.'
      setError(nextError)
    } finally {
      setSavingDeadlines(false)
    }
  }

  function togglePermitSelection(studentId: string) {
    setSelectedPermitStudentIds((current) => current.includes(studentId)
      ? current.filter((id) => id !== studentId)
      : [...current, studentId])
  }

  function handleSelectClearedStudentsOnPage() {
    let clearedStudents = students.filter((student) => student.feesBalance === 0)
    if (filterDepartment) {
      clearedStudents = clearedStudents.filter((student) => student.department === filterDepartment)
    }
    if (filterProgram) {
      clearedStudents = clearedStudents.filter((student) => student.program === filterProgram)
    }
    if (filterCourse) {
      clearedStudents = clearedStudents.filter((student) => student.course === filterCourse)
    }
    if (filterCollege) {
      clearedStudents = clearedStudents.filter((student) => student.college === filterCollege)
    }
    const clearedIds = clearedStudents.map((student) => student.id)

    if (clearedIds.length === 0) {
      setSelectedPermitStudentIds([])
      return
    }

    const allSelected = clearedIds.every((studentId) => selectedPermitStudentIds.includes(studentId))
    setSelectedPermitStudentIds(allSelected ? [] : clearedIds)
  }

  const allClearedStudentsOnPageSelected = filteredStudents
    .filter((student) => student.feesBalance === 0)
    .every((student) => selectedPermitStudentIds.includes(student.id))
    && filteredStudents.some((student) => student.feesBalance === 0)

  const navItems: { id: string; key: NavSection; label: string; icon: ReactNode; badge?: number }[] = [
    { id: 'dashboard', key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'students', key: 'students', label: 'Students', icon: <Users className="w-5 h-5" />, badge: outstandingStudents > 0 ? outstandingStudents : undefined },
    { id: 'dustbin', key: 'dustbin', label: 'General Dustbin', icon: <Trash2 className="w-5 h-5" />, badge: trashedStudents.length > 0 ? trashedStudents.length : undefined },
    { id: 'support-requests', key: 'support', label: 'Support Requests', icon: <Bell className="w-5 h-5" />, badge: openSupportRequestCount > 0 ? openSupportRequestCount : undefined },
    { id: 'sub-admins', key: 'assistants', label: 'Sub-Admins', icon: <Shield className="w-5 h-5" /> },
    { id: 'permit-activity', key: 'permits', label: 'Permit Activity', icon: <FileCheck className="w-5 h-5" />, badge: permitEventCount > 0 ? permitEventCount : undefined },
    { id: 'permit-cards', key: 'permit-cards', label: 'Permit Cards', icon: <CreditCard className="w-5 h-5" />, badge: clearedStudents > 0 ? clearedStudents : undefined },
    { id: 'bulk-import', key: 'import', label: 'Bulk Import', icon: <FileUp className="w-5 h-5" /> },
    { id: 'reports', key: 'reports', label: 'Reports', icon: <BarChart2 className="w-5 h-5" /> },
    { id: 'settings', key: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ]
  const visibleNavItems = navItems.filter((item) => adminCapability.sections.includes(item.key))
  const quickActions = [
    {
      key: 'bulk-import',
      label: 'Bulk Import',
      description: 'Financial spreadsheet updates, student account CSV/XLSX, or HTTP batch integration details.',
      icon: <FileUp className="h-5 w-5" />,
      disabled: !canManageFinancials && !canManageStudentProfiles,
      action: () => setActiveSection('import'),
    },
    {
      key: 'generate-permits',
      label: 'Generate Bulk Permits',
      description: 'Prepare print-ready permit cards for all cleared students.',
      icon: <CreditCard className="h-5 w-5" />,
      disabled: !adminCapability.canGenerateBulkPermits,
      action: () => {
        void handleGenerateBulkPermits()
      },
    },
    {
      key: 'verify-student',
      label: 'Verify Student',
      description: 'Open the student verification workspace for identity and balance checks.',
      icon: <Users className="h-5 w-5" />,
      disabled: !canViewStudents,
      action: handleVerifyStudent,
    },
    {
      key: 'export-reports',
      label: 'Export Reports',
      description: 'Download the current dashboard summary in CSV format.',
      icon: <Download className="h-5 w-5" />,
      disabled: !adminCapability.canExportReports,
      action: handleExportDashboardCsv,
    },
    {
      key: 'analytics',
      label: 'Analytics',
      description: 'Open the analytics view for financial and permit issuance insights.',
      icon: <BarChart2 className="h-5 w-5" />,
      disabled: !canAccessReports,
      action: () => setActiveSection('reports'),
    },
    {
      key: 'send-reminders',
      label: 'Send Reminders',
      description: 'Queue reminder notifications for students with pending balances.',
      icon: <Bell className="h-5 w-5" />,
      disabled: !adminCapability.canSendReminders,
      action: () => {
        void handleSendReminders()
      },
    },
    {
      key: 'settings',
      label: 'Settings',
      description: 'Review system integrations, session controls, and account scope.',
      icon: <Settings className="h-5 w-5" />,
      disabled: !adminCapability.sections.includes('settings'),
      action: () => setActiveSection('settings'),
    },
    {
      key: 'bulk-sync-curriculum',
      label: 'Sync All Students with Curriculum',
      description: 'Align all students\' course units and exams with the official curriculum.',
      icon: <RefreshCcw className="h-5 w-5" />,
      disabled: !adminCapability.canGenerateBulkPermits,
      action: async () => {
        setError('')
        setSuccessMessage('')
        try {
          const data = await bulkSyncCurriculum()
          setSuccessMessage(
            `Bulk curriculum sync complete. Students in system: ${data.totalStudents}. Updated: ${data.updated}. No match or error: ${data.failed.length}.`,
          )
          await loadStudents()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Bulk curriculum sync failed')
        }
      },
    },
  ]

  // Renamed to avoid duplicate function name


  async function handleSaveSupportRequest(requestId: string) {
    if (!canManageSupportRequests) {
      setError('Your admin view does not allow support request updates.')
      return
    }

    const nextStatus = supportStatusDrafts[requestId]
    const nextReply = (supportReplyDrafts[requestId] ?? '').trim()

    try {
      setSavingSupportRequestId(requestId)
      setError('')
      setSuccessMessage('')

      const updatedRequest = await updateSupportRequest(requestId, {
        status: nextStatus,
        adminReply: nextReply,
      })

      setSupportRequests((current) => current.map((request) => (
        request.id === requestId ? updatedRequest : request
      )))
      setSupportReplyDrafts((current) => ({ ...current, [requestId]: updatedRequest.adminReply }))
      setSupportStatusDrafts((current) => ({ ...current, [requestId]: updatedRequest.status }))
      setSuccessMessage(`Updated support request for ${updatedRequest.studentName}.`)
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update support request.'
      setError(nextError)
    } finally {
      setSavingSupportRequestId(null)
    }
  }

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragActive(true)
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragActive(false)
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragActive(false)

    const file = event.dataTransfer.files?.[0]

    if (!file) {
      return
    }

    await prepareImport(file)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="text-gray-500 dark:text-slate-300">Loading student accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {bulkPrintStudents.length > 0 && (
        <div hidden className="admin-bulk-print-wrapper">
          {bulkPrintStudents.map((student) => (
            <div key={student.id} className="admin-bulk-print-item">
              <PermitCard
                studentData={student}
                qrCodeUrl={bulkPrintQrCodes[student.id] ?? ''}
                onRefresh={() => {}}
                onSignOut={() => {}}
                onPrint={() => {}}
                onDownload={() => {}}
              />
            </div>
          ))}
        </div>
      )}

      <div className="admin-theme-shell flex h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_15%,_rgba(59,130,246,0.16),_transparent_34%),radial-gradient(circle_at_90%_18%,_rgba(239,68,68,0.13),_transparent_30%),radial-gradient(circle_at_50%_100%,_rgba(234,179,8,0.16),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#f1f5f9_100%)] text-gray-900 dark:bg-slate-950 dark:text-slate-100">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white shadow-lg transition-transform duration-300 dark:border-r dark:border-slate-800 dark:bg-slate-950 lg:static lg:translate-x-0 lg:shadow-none lg:border-r lg:border-gray-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5 dark:border-slate-800">
          <BrandMark
            titleClassName="text-base font-bold leading-tight text-gray-900 dark:text-white"
            subtitleClassName="text-xs text-emerald-600 dark:text-emerald-300"
          />
          <button
            type="button"
            title="Close sidebar"
            aria-label="Close sidebar"
            className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-500">Menu</p>
          <ul className="space-y-1">
            {visibleNavItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeSection === item.key
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className={activeSection === item.key ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-400 dark:text-slate-500'}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        activeSection === item.key ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Admin profile + logout at bottom */}
        <div className="border-t border-gray-200 p-4 dark:border-slate-800">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              {user?.name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{user?.name ?? 'Admin'}</p>
              <p className="text-[11px] text-gray-400 dark:text-slate-500">{adminCapability.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSignOut(true)} // 3. Replace signOut with setShowSignOut(true)
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* â”€â”€ Main area â”€â”€ */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top header */}
        <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
          <button
            type="button"
            title="Open sidebar"
            aria-label="Open sidebar"
            className="text-gray-500 hover:text-gray-700 dark:text-slate-300 dark:hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search */}
          <form
            className="flex max-w-sm flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            onSubmit={(e) => e.preventDefault()}
          >
            <Search className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search students"
              placeholder="Search students..."
              value={searchInputValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchInputValue(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
            />

            {searchQuery && (
              <button
                type="button"
                title="Clear search"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <span className="flex items-center gap-2">
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="hidden sm:inline">Theme</span>
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                title="Open notification center"
                aria-label="Open notification center"
                aria-haspopup="dialog"
                aria-controls="admin-notification-center"
                onClick={() => setShowNotificationCenter((current) => !current)}
                className="relative text-gray-500 hover:text-gray-700 dark:text-slate-300 dark:hover:text-white"
              >
                <Bell className="h-5 w-5" />
                {notificationBadgeCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {notificationBadgeCount > 9 ? '9+' : String(notificationBadgeCount)}
                  </span>
                )}
              </button>

              {showNotificationCenter && (
                <div
                  id="admin-notification-center"
                  role="dialog"
                  aria-label="Admin notifications"
                  className={`fixed inset-x-4 top-20 ${DIALOG_Z.toast} max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-950 sm:left-auto sm:right-6 sm:w-80 lg:absolute lg:right-0 lg:top-11 lg:max-h-[32rem]`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Notifications</h2>
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Operational alerts, support queue updates, and permit activity notices.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {notificationCenterAlerts.length > 0 && user?.id ? (
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                          onClick={() => {
                            const next = new Set(readAdminAlertIds)
                            for (const alert of notificationCenterAlerts) {
                              next.add(alert.id)
                            }
                            setReadAdminAlertIds(next)
                            persistAdminNotificationReadSet(user.id, next)
                          }}
                        >
                          Mark all read
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Close notification center"
                        aria-label="Close notification center"
                        onClick={() => setShowNotificationCenter(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {notificationCenterAlerts.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      No new notifications right now.
                    </div>
                  ) : (
                    notificationCenterAlerts.map((alert) => {
                      const isRead = readAdminAlertIds.has(alert.id)

                      function markThisRead() {
                        if (!user?.id || isRead) {
                          return
                        }
                        const next = new Set(readAdminAlertIds)
                        next.add(alert.id)
                        setReadAdminAlertIds(next)
                        persistAdminNotificationReadSet(user.id, next)
                      }

                      return (
                        <div
                          key={alert.id}
                          role="presentation"
                          className={`mt-3 rounded-2xl border p-4 text-left shadow-sm transition ${
                            alert.tone === 'critical'
                              ? 'border-red-200 bg-red-50'
                              : alert.tone === 'warning'
                                ? 'border-amber-200 bg-amber-50'
                                : 'border-blue-200 bg-blue-50'
                          } ${isRead ? 'opacity-60' : ''}`}
                        >
                          <button
                            type="button"
                            title={alert.message}
                            onClick={markThisRead}
                            className="w-full text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                                <p className="mt-1 text-xs leading-5 text-gray-600">{alert.message}</p>
                              </div>
                              <Bell className="h-4 w-4 shrink-0 text-gray-400" />
                            </div>
                          </button>
                          {alert.actionLabel && alert.onAction && (
                            <button
                              type="button"
                              onClick={() => {
                                handleNotificationAlertAction(alert.onAction)
                                markThisRead()
                              }}
                              className="mt-3 rounded-lg border border-white/80 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              {alert.actionLabel}
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => void loadStudents()}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Profile chip */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                {user?.name?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-100">{user?.name ?? 'Admin'}</span>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">{adminCapability.label}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Alert banners */}
        {(error || successMessage || createdStudentWelcome) && (
          <div className="flex-shrink-0 px-6 pt-4">
            {error && (
              <div className="mb-2 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  title="Dismiss error"
                  aria-label="Dismiss error"
                  onClick={() => setError('')}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {successMessage && (
              <div className="mb-2 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                <span className="flex-1">{successMessage}</span>
                <button
                  type="button"
                  title="Dismiss message"
                  aria-label="Dismiss message"
                  onClick={() => setSuccessMessage('')}
                  className="text-green-400 hover:text-green-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {createdStudentWelcome && (
              <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Welcome Message</p>
                    <h2 className="mt-1 text-base font-semibold text-emerald-950">New student account ready</h2>
                  </div>
                  <button
                    type="button"
                    title="Dismiss welcome message"
                    aria-label="Dismiss welcome message"
                    onClick={() => setCreatedStudentWelcome(null)}
                    className="text-emerald-500 hover:text-emerald-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mb-3 text-sm text-emerald-800">
                  Share these sign-in details with {createdStudentWelcome.name} and ask them to change the password after first login.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Student Name</p>
                    <p className="mt-1 font-medium text-emerald-950">{createdStudentWelcome.name}</p>
                  </div>
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Registration Number</p>
                    <p className="mt-1 font-medium text-emerald-950">{createdStudentWelcome.studentId}</p>
                  </div>
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Email</p>
                    <p className="mt-1 font-medium text-emerald-950">{createdStudentWelcome.email}</p>
                  </div>
                  <div className="rounded-md bg-white/70 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">
                      {createdStudentWelcome.generatedPassword ? 'Temporary Password' : 'Assigned Password'}
                    </p>
                    <p className="mt-1 font-medium text-emerald-950">{createdStudentWelcome.password}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <input
            id="admin-financial-import-input"
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            disabled={importing}
            onChange={(e) => void handleImportFile(e)}
          />
          <input
            id="admin-student-import-input"
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            disabled={studentAccountsImporting}
            onChange={(e) => void handleStudentImportFile(e)}
          />

          <div key={activeSection} className="kiu-page-in-animate"> {/* 4. Wrap activeSection renders */}
            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeSection === 'dashboard' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-sm text-gray-500">Operational overview for {adminCapability.label.toLowerCase()}.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-700 shadow-sm shadow-blue-100/70">Real-time refresh every 30s</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 shadow-sm shadow-amber-100/70">Session timeout after 15 min inactivity</span>
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700 shadow-sm shadow-rose-100/70">Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Waiting'}</span>
                  </div>
                </div>

                {dashboardAlerts.length > 0 && (
                  <div className="grid gap-3 lg:grid-cols-3">
                    {dashboardAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-2xl border p-4 shadow-sm ${
                          alert.tone === 'critical'
                            ? 'border-red-200 bg-red-50'
                            : alert.tone === 'warning'
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-blue-200 bg-blue-50'
                        }`}
                        title={alert.message}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                            <p className="mt-1 text-xs leading-5 text-gray-600">{alert.message}</p>
                          </div>
                          <Bell className="h-4 w-4 text-gray-400" />
                        </div>
                        {alert.actionLabel && alert.onAction && (
                          <button
                            type="button"
                            onClick={alert.onAction}
                            className="mt-3 rounded-lg border border-white/80 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {alert.actionLabel}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-blue-200/80 bg-[linear-gradient(145deg,_rgba(239,246,255,0.96),_rgba(254,252,232,0.9))] p-5 shadow-sm shadow-blue-200/40">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center justify-between mb-6">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                        onClick={async () => {
                          setRefreshing(true)
                          await loadStudents()
                          setRefreshing(false)
                        }}
                        aria-label="Refresh student list"
                        disabled={refreshing}
                      >
                        {refreshing ? (
                          <span className="flex items-center gap-2"><RefreshCcw className="w-4 h-4 animate-spin" />Refreshing...</span>
                        ) : (
                          <><RefreshCcw className="w-4 h-4" />Refresh</>
                        )}
                      </button>
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">Quick Actions</h2>
                      <p className="text-sm text-gray-500">High-frequency actions for permit operations, reporting, and alerts.</p>
                    </div>
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm shadow-blue-100/70">Access scope: {adminCapability.label}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {quickActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        disabled={action.disabled}
                        onClick={action.action}
                        className="rounded-2xl border border-blue-100 bg-white/90 p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-emerald-600">{action.icon}</span>
                          {action.disabled && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Restricted</span>}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-gray-900">{action.label}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{action.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Analytics cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
                  {/* --- People counts --- */}
                  <div className="col-span-2 sm:col-span-2 rounded-xl border border-blue-300 bg-[linear-gradient(145deg,_rgba(219,234,254,0.95),_rgba(239,246,255,0.92))] p-5 shadow-sm shadow-blue-200/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Students</p>
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <p className="mt-2 text-4xl font-bold text-blue-700">{totalStudents}</p>
                    <div className="mt-2 flex gap-3 text-xs text-blue-500">
                      <span className="font-semibold text-emerald-600">{clearedStudents} cleared</span>
                      <span className="text-amber-600">{outstandingStudents} outstanding</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-blue-400">enrolled student accounts</p>
                  </div>
                  <div className="col-span-2 sm:col-span-2 rounded-xl border border-indigo-300 bg-[linear-gradient(145deg,_rgba(224,231,255,0.95),_rgba(238,242,255,0.92))] p-5 shadow-sm shadow-indigo-200/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Administrators</p>
                      <Shield className="h-5 w-5 text-indigo-500" />
                    </div>
                    <p className="mt-2 text-4xl font-bold text-indigo-700">{1 + assistantAdmins.length}</p>
                    <div className="mt-2 flex gap-3 text-xs">
                      <span className="font-semibold text-indigo-600">1 super-admin</span>
                      <span className="text-indigo-400">{assistantAdmins.length} sub-admin{assistantAdmins.length !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-indigo-400">active admin accounts</p>
                  </div>
                  {/* --- Permit stats --- */}
                  <div className="rounded-xl border border-emerald-200 bg-[linear-gradient(145deg,_rgba(209,250,229,0.95),_rgba(236,253,245,0.92))] p-5 shadow-sm shadow-emerald-200/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Cleared</p>
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-emerald-700">{clearedStudents}</p>
                    <p className="mt-1 text-xs text-emerald-400">fees fully paid</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-[linear-gradient(145deg,_rgba(254,243,199,0.95),_rgba(255,251,235,0.92))] p-5 shadow-sm shadow-amber-200/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Outstanding</p>
                      <FileSpreadsheet className="h-5 w-5 text-amber-400" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-amber-700">{outstandingStudents}</p>
                    <p className="mt-1 text-xs text-amber-400">balance remaining</p>
                  </div>
                  <div className="rounded-xl border border-purple-200 bg-[linear-gradient(145deg,_rgba(243,232,255,0.95),_rgba(250,245,255,0.92))] p-5 shadow-sm shadow-purple-200/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Permit Events</p>
                      <FileCheck className="h-5 w-5 text-purple-400" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-purple-700">{permitEventCount}</p>
                    <p className="mt-1 text-xs text-purple-400">prints &amp; downloads</p>
                  </div>
                  <div className="rounded-xl border border-slate-300 bg-[linear-gradient(145deg,_rgba(241,245,249,0.95),_rgba(248,250,252,0.92))] p-5 shadow-sm shadow-slate-200/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issued</p>
                      <CreditCard className="h-5 w-5 text-slate-400" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-slate-800">{permitStatusCounts.issued}</p>
                    <p className="mt-1 text-xs text-slate-500">active permits</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-[linear-gradient(145deg,_rgba(255,228,230,0.95),_rgba(255,241,242,0.92))] p-5 shadow-sm shadow-rose-200/60">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">Expired</p>
                      <Shield className="h-5 w-5 text-rose-400" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-rose-700">{permitStatusCounts.expired}</p>
                    <p className="mt-1 text-xs text-rose-400">expired records</p>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl border border-red-200/80 bg-[linear-gradient(145deg,_rgba(255,241,242,0.94),_rgba(255,251,235,0.9))] shadow-sm shadow-red-200/40">
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                      <div>
                        <h2 className="font-semibold text-gray-800">Pending Approvals</h2>
                        <p className="text-xs text-gray-400">Students who still need clearance before permit issuance</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection('students')}
                        className="rounded-lg border border-red-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Review list
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {students.filter((student) => student.feesBalance > 0).slice(0, 5).map((student) => (
                        <div key={student.id} className="flex items-center justify-between gap-4 px-5 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-400">{student.studentId} • {student.department ?? student.course}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-red-600">{formatMoney(student.feesBalance, activeCurrencyCode)}</p>
                            <p className="text-xs text-gray-400">Remaining balance</p>
                          </div>
                        </div>
                      ))}
                      {students.filter((student) => student.feesBalance > 0).length === 0 && (
                        <div className="px-5 py-8 text-center text-sm text-gray-400">No pending approvals at the moment.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200/80 bg-[linear-gradient(145deg,_rgba(239,246,255,0.95),_rgba(240,249,255,0.92))] shadow-sm shadow-blue-200/40">
                    <div className="border-b border-gray-100 px-5 py-4">
                      <h2 className="font-semibold text-gray-800">Permit Assignment Overview</h2>
                      <p className="text-xs text-gray-400">Assigned permit items pulled from current student records</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {upcomingExamEntries.slice(0, 5).map((item) => (
                        <div key={`${item.student.id}-${item.exam.id}`} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-gray-900">{item.exam.title}</p>
                              <p className="text-xs text-gray-400">{item.student.name} • {item.student.studentId}</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Assigned</span>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">{item.exam.venue} • Seat {item.exam.seatNumber}</p>
                        </div>
                      ))}
                      {upcomingExamEntries.length === 0 && (
                        <div className="px-5 py-8 text-center text-sm text-gray-400">No permit assignments are available yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-amber-200/80 bg-[linear-gradient(145deg,_rgba(254,252,232,0.95),_rgba(255,247,237,0.92))] p-6 shadow-sm shadow-amber-200/45">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-gray-800">Permit Status Breakdown</h2>
                      <FileCheck className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-emerald-50 p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-700">{permitStatusCounts.issued}</p>
                        <p className="mt-1 text-xs text-emerald-500">Issued</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 p-4 text-center">
                        <p className="text-2xl font-bold text-amber-700">{permitStatusCounts.pending}</p>
                        <p className="mt-1 text-xs text-amber-500">Pending</p>
                      </div>
                      <div className="rounded-xl bg-rose-50 p-4 text-center">
                        <p className="text-2xl font-bold text-rose-700">{permitStatusCounts.rejected}</p>
                        <p className="mt-1 text-xs text-rose-500">Rejected</p>
                      </div>
                      <div className="rounded-xl bg-slate-100 p-4 text-center">
                        <p className="text-2xl font-bold text-slate-800">{permitStatusCounts.expired}</p>
                        <p className="mt-1 text-xs text-slate-500">Expired</p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-gray-400">Rejected permits are not currently tracked by the backend workflow, so this value remains informational until that state is added.</p>
                  </div>

                  <div className="rounded-xl border border-blue-200/80 bg-[linear-gradient(145deg,_rgba(239,246,255,0.95),_rgba(250,245,255,0.9))] p-6 shadow-sm shadow-blue-200/40">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-gray-800">Analytics &amp; Insights</h2>
                      <BarChart2 className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-400">Most At-Risk Department</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{busiestOutstandingDepartment?.[0] ?? 'No outstanding balances'}</p>
                        <p className="text-xs text-gray-500">{busiestOutstandingDepartment ? `${busiestOutstandingDepartment[1]} student(s) still pending financial clearance.` : 'All currently loaded students are financially cleared.'}</p>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50/85 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-400">Reminder Queue</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{outstandingStudents}</p>
                        <p className="text-xs text-gray-500">Students who would receive fee reminders from the current in-app notification workflow.</p>
                      </div>
                      <div className="rounded-xl border border-rose-100 bg-rose-50/80 p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-400">Recent Reminder Activity</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{lastReminderAt ? new Date(lastReminderAt).toLocaleString() : 'No reminders queued in this session'}</p>
                        <p className="text-xs text-gray-500">External email, SMS, and biometric integrations are not yet connected in this environment.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent permit activity table */}
                <div className="rounded-xl border border-blue-200/80 bg-[linear-gradient(145deg,_rgba(239,246,255,0.95),_rgba(248,250,252,0.92))] shadow-sm shadow-blue-200/40">
                  <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <h2 className="font-semibold text-gray-800">Recent Permit Activity</h2>
                    <p className="text-xs text-gray-400">{permitActivityLogs.length} event{permitActivityLogs.length !== 1 ? 's' : ''} on this page</p>
                    <button
                      type="button"
                      onClick={handleExportPermitActivity}
                      disabled={!adminCapability.canExportReports || permitActivityLogs.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-5 py-3 text-left">Student</th>
                          <th className="px-5 py-3 text-left">Action</th>
                          <th className="px-5 py-3 text-left">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {permitActivityLogs.slice(0, 8).map((log) => {
                          const student = students.find((s) => s.id === log.targetProfileId)
                          return (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 font-medium text-gray-800">{student?.name ?? log.targetProfileId}</td>
                              <td className="px-5 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${log.action === 'print_permit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                  {log.action === 'print_permit' ? 'Printed' : 'Downloaded'}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-gray-500">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</td>
                            </tr>
                          )
                        })}
                        {permitActivityLogs.length === 0 && (
                          <tr>
                            <td className="px-5 py-6 text-center text-gray-400" colSpan={3}>No permit activity recorded yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-blue-100 px-5 py-3 text-xs text-blue-700">
                    <span>Page {activityPage} of {activityTotalPages}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={activityPage <= 1}
                        onClick={() => setActivityPage((current) => Math.max(current - 1, 1))}
                        className="rounded-lg border border-blue-200 bg-white/90 px-3 py-1.5 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={activityPage >= activityTotalPages}
                        onClick={() => setActivityPage((current) => Math.min(current + 1, activityTotalPages))}
                        className="rounded-lg border border-blue-200 bg-white/90 px-3 py-1.5 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-rose-200/80 bg-[linear-gradient(145deg,_rgba(255,241,242,0.95),_rgba(248,250,252,0.9))] shadow-sm shadow-rose-200/40">
                    <div className="border-b border-gray-100 px-5 py-4">
                      <h2 className="font-semibold text-gray-800">Audit Trail</h2>
                      <p className="text-xs text-gray-400">Recent administrative actions captured by the backend</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {recentSystemActivity.map((log) => (
                        <div key={log.id} className="flex items-start justify-between gap-3 px-5 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{formatAdminActionLabel(log.action)}</p>
                            <p className="text-xs text-gray-400">Actor: {log.adminId} • Target: {log.targetProfileId}</p>
                          </div>
                          <span className="text-xs text-gray-400">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</span>
                        </div>
                      ))}
                      {recentSystemActivity.length === 0 && (
                        <div className="px-5 py-8 text-center text-sm text-gray-400">No admin activity logs are available yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-yellow-200/80 bg-[linear-gradient(145deg,_rgba(254,252,232,0.95),_rgba(255,247,237,0.9))] shadow-sm shadow-yellow-200/40">
                    <div className="border-b border-gray-100 px-5 py-4">
                      <h2 className="font-semibold text-gray-800">Section Shortcuts</h2>
                      <p className="text-xs text-gray-400">Jump into the areas available for this admin scope</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
                      {visibleNavItems
                    .filter((n) => n.key !== 'dashboard')
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.key)}
                        className="flex flex-col items-center gap-2 rounded-xl border border-yellow-200 bg-[linear-gradient(145deg,_rgba(255,255,255,0.94),_rgba(254,249,195,0.7))] p-5 shadow-sm shadow-yellow-100/70 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <span className="text-emerald-600">{item.icon}</span>
                        <span className="text-xs font-medium text-gray-700">{item.label}</span>
                      </button>
                    ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STUDENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeSection === 'students' && (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Students</h1>
                    <p className="text-sm text-gray-500">
                      {showPrintedOnly
                        ? `Showing ${filteredStudents.length} printed student(s) on this page out of ${totalItems} matched student record(s)`
                        : `Showing ${pageStart}-${pageEnd} of ${totalItems} student(s)`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start">
                    {canManageFinancials && (
                      <button
                        type="button"
                        onClick={() => setActiveSection('import')}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <FileUp className="h-3.5 w-3.5" />
                        Open Bulk Import
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenCreateStudent}
                      disabled={!canManageStudentProfiles}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Add Student
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPermitActivity}
                      disabled={!adminCapability.canExportReports || permitActivityLogs.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['all', 'paid', 'outstanding'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFilterStatus(status)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
                          filterStatus === status
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {status === 'all'
                          ? `All (${totalStudents})`
                          : status === 'paid'
                            ? `Cleared (${clearedStudents})`
                            : `Outstanding (${outstandingStudents})`}
                      </button>
                    ))}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                      <input
                        type="checkbox"
                        checked={showPrintedOnly}
                        onChange={(e) => setShowPrintedOnly(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600"
                      />
                      Show printed students only
                    </label>
                  </div>
                </div>

                {hasActiveStudentFilters && (
                  <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Student filters are active</p>
                      <p className="text-xs text-amber-800">
                        {activeStudentFilterLabels.join(' • ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetStudentView}
                      className="inline-flex items-center gap-2 self-start rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reset Student View
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-5 py-3 text-left">Student</th>
                          <th className="px-5 py-3 text-left">Course</th>
                          <th className="px-5 py-3 text-left">Expected Fees</th>
                          <th className="px-5 py-3 text-left">Amount Received</th>
                          <th className="px-5 py-3 text-left">Remaining Balance</th>
                          <th className="px-5 py-3 text-left">Status</th>
                          <th className="px-5 py-3 text-left">Permit Activity</th>
                          <th className="px-5 py-3 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredStudents.map((student) => {
                          const summary = getStudentPrintSummary(student.id)
                          return (
                            <tr key={student.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3">
                                <div className="font-medium text-gray-900">{student.name}</div>
                                <div className="text-xs text-gray-400">{student.studentId} Â· {student.email}</div>
                                <div className="mt-1 text-xs text-gray-400">
                                  {student.program ?? student.course} Â· {student.department ?? 'No department'}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-gray-600">
                                <div>{student.course || '-'}</div>
                                <div className="text-xs text-gray-400">{student.semester ?? 'No semester set'}</div>
                              </td>
                              <td className="px-5 py-3 text-gray-700">{formatMoney(student.totalFees, activeCurrencyCode)}</td>
                              <td className="px-5 py-3 font-medium text-green-700">{formatMoney(student.amountPaid, activeCurrencyCode)}</td>
                              <td className="px-5 py-3">
                                <span className={`font-semibold ${student.feesBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  {formatMoney(student.feesBalance, activeCurrencyCode)}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${student.feesBalance === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {student.feesBalance === 0 ? 'Cleared' : 'Outstanding'}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-xs text-gray-500">
                                {summary.total === 0
                                  ? 'None'
                                  : (
                                    <>
                                      {summary.printCount > 0 && <span>Printed {summary.printCount}x</span>}
                                      {summary.printCount > 0 && summary.downloadCount > 0 && <span>, </span>}
                                      {summary.downloadCount > 0 && <span>Downloaded {summary.downloadCount}x</span>}
                                    </>
                                  )}
                              </td>
                              <td className="px-5 py-3">
                                <form
                                  className="flex items-center gap-2"
                                  onSubmit={(e) => void handleSavePayment(e, student)}
                                >
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={paymentDrafts[student.id] ?? ''}
                                    onChange={(e) =>
                                      setPaymentDrafts((cur) => ({ ...cur, [student.id]: e.target.value }))
                                    }
                                    aria-label={`Bank slip or payment amount to add for ${student.name}`}
                                    title={`Amount on this slip only — adds to cumulative total (already recorded: ${formatMoney(student.amountPaid, activeCurrencyCode)})`}
                                    placeholder="Slip amount"
                                    className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                  />
                                  <button
                                    type="submit"
                                    disabled={!canManageFinancials || savingId === student.id}
                                    title="Post this slip — adds to cumulative amount received"
                                    aria-label={`Post bank slip payment for ${student.name}`}
                                    className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    <Save className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canManageFinancials || savingId === student.id || student.feesBalance === 0}
                                    onClick={() => void handleClear(student)}
                                    title="Mark fully paid"
                                    className="rounded bg-green-500 p-1.5 text-white hover:bg-green-600 disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </button>
                                </form>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!canManageStudentProfiles}
                                    onClick={() => handleEditStudent(student)}
                                    title="Edit student profile"
                                    className="rounded bg-blue-500 p-1.5 text-white hover:bg-blue-600 disabled:opacity-50"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canManageStudentProfiles || grantingPrintAccessId === student.id}
                                    onClick={() => void handleGrantPrintAccess(student)}
                                    title="Grant one extra permit print for this month"
                                    aria-label={`Grant one extra permit print for ${student.name}`}
                                    className="rounded bg-indigo-500 p-1.5 text-white hover:bg-indigo-600 disabled:opacity-50"
                                  >
                                    <Shield className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canManageStudentProfiles || deletingStudentId === student.id}
                                    onClick={() => void handleDeleteStudentProfile(student)}
                                    title="Remove student profile"
                                    aria-label={`Remove ${student.name}`}
                                    className="rounded bg-red-500 p-1.5 text-white hover:bg-red-600 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {filteredStudents.length === 0 && (
                          <tr>
                            <td className="px-5 py-8 text-center text-gray-400" colSpan={8}>
                              {searchQuery
                                ? `No students match "${searchQuery}"`
                                : showPrintedOnly
                                  ? 'No students have printed a permit yet.'
                                  : 'No students found.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 text-sm text-gray-600">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((current) => Math.max(current - 1, 1))}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
                  <div className="border-b border-amber-100 px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-800">Trash</h2>
                        <p className="text-xs text-gray-400">Deleted student records stay here until the retention period expires.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          {trashedStudents.length} in trash
                        </span>
                        {canManageStudentProfiles && trashedStudents.length > 0 ? (
                          <button
                            type="button"
                            onClick={handlePurgeEntireTrash}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Empty trash permanently
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {trashedStudents.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-gray-400">No deleted student records are waiting in trash.</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {trashedStudents.map((student) => (
                        <div key={student.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-400">{student.studentId ?? 'No registration number'} · {student.email}</p>
                            {(() => {
                              const daysUntilPurge = getDaysUntilDate(student.purgeAfterAt)

                              return (
                            <p className="mt-1 text-xs text-gray-500">
                              Deleted {new Date(student.deletedAt).toLocaleString()} · auto-purge {new Date(student.purgeAfterAt).toLocaleDateString()}
                              {daysUntilPurge !== null ? ` • ${daysUntilPurge} day${daysUntilPurge === 1 ? '' : 's'} left` : ''}
                            </p>
                              )
                            })()}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!canManageStudentProfiles || restoringStudentId === student.id}
                              onClick={() => handleRestoreStudentProfile(student)}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <RefreshCcw className="h-4 w-4" />
                              {restoringStudentId === student.id ? 'Restoring…' : 'Restore'}
                            </button>
                            <button
                              type="button"
                              disabled={!canManageStudentProfiles}
                              onClick={() => handlePermanentTrashRow(student)}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete forever
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'dustbin' && (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">General Dustbin</h1>
                    <p className="text-sm text-gray-500">Deleted records are retained for a limited period and can be restored or permanently removed.</p>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    Student records in trash: {trashedStudents.length}
                  </span>
                </div>

                <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
                  <div className="border-b border-amber-100 px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="font-semibold text-gray-800">Deleted Student Records</h2>
                        <p className="text-xs text-gray-400">Records auto-purge on their retention date unless restored first.</p>
                      </div>
                      {canManageStudentProfiles && trashedStudents.length > 0 ? (
                        <button
                          type="button"
                          onClick={handlePurgeEntireTrash}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Empty dustbin permanently
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {trashedStudents.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-gray-400">No deleted student records are waiting in the dustbin.</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {trashedStudents.map((student) => (
                        <div key={student.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-400">{student.studentId ?? 'No registration number'} · {student.email}</p>
                            {(() => {
                              const daysUntilPurge = getDaysUntilDate(student.purgeAfterAt)

                              return (
                                <p className="mt-1 text-xs text-gray-500">
                                  Deleted {new Date(student.deletedAt).toLocaleString()} · auto-purge {new Date(student.purgeAfterAt).toLocaleDateString()}
                                  {daysUntilPurge !== null ? ` • ${daysUntilPurge} day${daysUntilPurge === 1 ? '' : 's'} left` : ''}
                                </p>
                              )
                            })()}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!canManageStudentProfiles || restoringStudentId === student.id}
                              onClick={() => handleRestoreStudentProfile(student)}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <RefreshCcw className="h-4 w-4" />
                              {restoringStudentId === student.id ? 'Restoring…' : 'Restore'}
                            </button>
                            <button
                              type="button"
                              disabled={!canManageStudentProfiles}
                              onClick={() => handlePermanentTrashRow(student)}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete forever
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-blue-200 bg-white shadow-sm">
                  <div className="border-b border-blue-100 px-5 py-4">
                    <h2 className="font-semibold text-gray-800">Permit Activity Cleanup</h2>
                    <p className="text-xs text-gray-400">Permit print/download logs can be permanently cleared from here.</p>
                  </div>
                  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-gray-600">Current permit activity rows on this page: {permitActivityLogs.length}</p>
                    <button
                      type="button"
                      onClick={handleRequestPurgePermitActivity}
                      disabled={!canDeleteAuditLogs || permitActivityLogs.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear permit activity permanently
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(activeSection === 'support' || activeSection === 'assistants') && (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{activeSection === 'assistants' ? 'Sub-Admin Management' : 'Support Requests'}</h1>
                    <p className="text-sm text-gray-500">{activeSection === 'assistants' ? 'Create and manage delegated admin accounts for support/help and department permit printing.' : 'Review student help tickets, update statuses, and send replies from the admin desk.'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {activeSection === 'support' ? (
                      <>
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5">Open or in progress: {openSupportRequestCount}</span>
                        <button
                          type="button"
                          onClick={() => void loadSupportRequestQueue()}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <RefreshCcw className="h-3.5 w-3.5" />
                          Refresh Queue
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5">Accounts: {canManageAssistantAdmins ? assistantAdmins.length : 0}</span>
                        <button
                          type="button"
                          onClick={() => void loadAssistantAdmins()}
                          disabled={assistantAdminsLoading || !canManageAssistantAdmins}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCcw className={`h-3.5 w-3.5 ${assistantAdminsLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {activeSection === 'support' && (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Open</p>
                    <p className="mt-2 text-3xl font-bold text-amber-700">{supportRequests.filter((request) => request.status === 'open').length}</p>
                    <p className="mt-1 text-xs text-amber-500">Awaiting the first admin response</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">In Progress</p>
                    <p className="mt-2 text-3xl font-bold text-blue-700">{supportRequests.filter((request) => request.status === 'in_progress').length}</p>
                    <p className="mt-1 text-xs text-blue-500">Active cases still being worked</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Resolved</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-700">{supportRequests.filter((request) => request.status === 'resolved').length}</p>
                    <p className="mt-1 text-xs text-emerald-500">Closed with an admin response</p>
                  </div>
                </div>
                )}

                {activeSection === 'assistants' && showAssistantAdminPanel && (
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-6 py-4">
                      <h2 className="font-semibold text-gray-800">Assistant Admin Delegation</h2>
                      <p className="mt-1 text-xs text-gray-400">Create sub-admin accounts for support/help and department-based permit printing.</p>
                      {!canManageAssistantAdmins && (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Only the super admin account can create or edit sub-admin accounts. Sign in with the main admin account to manage this area.
                        </p>
                      )}
                    </div>
                    <form className="space-y-4 border-b border-gray-100 px-6 py-5" onSubmit={(event) => void handleCreateAssistantAdmin(event)}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="assistant-admin-name" className="mb-2 block text-sm font-medium text-gray-700">Full name</label>
                          <input
                            id="assistant-admin-name"
                            type="text"
                            required
                            minLength={2}
                            maxLength={120}
                            disabled={!canManageAssistantAdmins}
                            value={assistantAdminDraft.name}
                            onChange={(event) => setAssistantAdminDraft((current) => ({ ...current, name: event.target.value }))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div>
                          <label htmlFor="assistant-admin-email" className="mb-2 block text-sm font-medium text-gray-700">Email address</label>
                          <input
                            id="assistant-admin-email"
                            type="email"
                            required
                            disabled={!canManageAssistantAdmins}
                            value={assistantAdminDraft.email}
                            onChange={(event) => setAssistantAdminDraft((current) => ({ ...current, email: event.target.value }))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div>
                          <label htmlFor="assistant-admin-phone" className="mb-2 block text-sm font-medium text-gray-700">Phone number (optional)</label>
                          <input
                            id="assistant-admin-phone"
                            type="tel"
                            disabled={!canManageAssistantAdmins}
                            value={assistantAdminDraft.phoneNumber}
                            onChange={(event) => setAssistantAdminDraft((current) => ({ ...current, phoneNumber: event.target.value }))}
                            placeholder="e.g. +256700123456"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div>
                          <label htmlFor="assistant-admin-password" className="mb-2 block text-sm font-medium text-gray-700">Temporary password</label>
                          <input
                            id="assistant-admin-password"
                            type="password"
                            required
                            minLength={8}
                            maxLength={128}
                            disabled={!canManageAssistantAdmins}
                            value={assistantAdminDraft.password}
                            onChange={(event) => setAssistantAdminDraft((current) => ({ ...current, password: event.target.value }))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div>
                          <label htmlFor="assistant-admin-role" className="mb-2 block text-sm font-medium text-gray-700">Assistant role</label>
                          <select
                            id="assistant-admin-role"
                            disabled={!canManageAssistantAdmins}
                            value={assistantAdminDraft.role}
                            onChange={(event) => {
                              const nextRole = event.target.value === 'support_help' ? 'support_help' : 'department_prints'
                              setAssistantAdminDraft((current) => ({
                                ...current,
                                role: nextRole,
                                departments: nextRole === 'department_prints' ? current.departments : [],
                              }))
                            }}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          >
                            <option value="department_prints">Department Prints</option>
                            <option value="support_help">Support and Help</option>
                          </select>
                        </div>
                        {assistantAdminDraft.role === 'department_prints' && (
                          <div>
                            <label htmlFor="assistant-admin-departments" className="mb-2 block text-sm font-medium text-gray-700">Assigned departments</label>
                            <select
                              id="assistant-admin-departments"
                              multiple
                              disabled={!canManageAssistantAdmins}
                              value={assistantAdminDraft.departments}
                              onChange={(event) => {
                                const selected = Array.from(event.target.selectedOptions).map((option) => option.value)
                                setAssistantAdminDraft((current) => ({ ...current, departments: selected }))
                              }}
                              className="h-32 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            >
                              {KIU_DEPARTMENTS.map((department) => (
                                <option key={department} value={department}>{department}</option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">Hold Ctrl/Cmd to select multiple departments.</p>
                          </div>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={assistantAdminsSaving || !canManageAssistantAdmins}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Users className="h-4 w-4" />
                        {assistantAdminsSaving ? 'Creating...' : 'Create sub-admin'}
                      </button>
                    </form>

                    <div className="space-y-3 px-6 py-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-800">Existing sub-admin accounts</h3>
                        <button
                          type="button"
                          onClick={() => void loadAssistantAdmins()}
                          disabled={assistantAdminsLoading || !canManageAssistantAdmins}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCcw className={`h-3.5 w-3.5 ${assistantAdminsLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </div>

                      {!canManageAssistantAdmins && (
                        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">Sign in as `admin@example.com` to view and manage existing sub-admin accounts.</p>
                      )}

                      {canManageAssistantAdmins && assistantAdmins.length === 0 && !assistantAdminsLoading && (
                        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">No sub-admin accounts created yet.</p>
                      )}

                      {canManageAssistantAdmins && assistantAdmins.length > 0 && (
                        <div className="space-y-2">
                          {assistantAdmins.map((assistant) => (
                            <div key={assistant.id} className="rounded-lg border border-gray-200 px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-gray-800">{assistant.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600">
                                    {assistant.role === 'support_help' ? 'Support and Help' : 'Department Prints'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleStartAssistantEdit(assistant)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Edit
                                  </button>
                                </div>
                              </div>
                              <p className="mt-1 text-xs text-gray-500">{assistant.email}{assistant.phoneNumber ? ` • ${assistant.phoneNumber}` : ''}</p>
                              {assistant.role === 'department_prints' && (
                                <p className="mt-1 text-xs text-gray-500">Departments: {assistant.departments.length > 0 ? assistant.departments.join(', ') : 'None assigned'}</p>
                              )}

                              {assistantAdminEditingId === assistant.id && (
                                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <label htmlFor={`assistant-edit-role-${assistant.id}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Role</label>
                                      <select
                                        id={`assistant-edit-role-${assistant.id}`}
                                        value={assistantAdminEditDraft.role}
                                        onChange={(event) => {
                                          const nextRole = event.target.value === 'support_help' ? 'support_help' : 'department_prints'
                                          setAssistantAdminEditDraft((current) => ({
                                            ...current,
                                            role: nextRole,
                                            departments: nextRole === 'department_prints' ? current.departments : [],
                                          }))
                                        }}
                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                      >
                                        <option value="department_prints">Department Prints</option>
                                        <option value="support_help">Support and Help</option>
                                      </select>
                                    </div>

                                    {assistantAdminEditDraft.role === 'department_prints' && (
                                      <div>
                                        <label htmlFor={`assistant-edit-departments-${assistant.id}`} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Departments</label>
                                        <select
                                          id={`assistant-edit-departments-${assistant.id}`}
                                          multiple
                                          value={assistantAdminEditDraft.departments}
                                          onChange={(event) => {
                                            const selected = Array.from(event.target.selectedOptions).map((option) => option.value)
                                            setAssistantAdminEditDraft((current) => ({ ...current, departments: selected }))
                                          }}
                                          className="h-28 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                        >
                                          {KIU_DEPARTMENTS.map((department) => (
                                            <option key={department} value={department}>{department}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-3 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleSaveAssistantEdit(assistant.id)}
                                      disabled={assistantAdminUpdatingId === assistant.id}
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      <Save className="h-3.5 w-3.5" />
                                      {assistantAdminUpdatingId === assistant.id ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelAssistantEdit}
                                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === 'support' && (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-5 py-4">
                    <h2 className="font-semibold text-gray-800">Support Queue</h2>
                    <p className="text-xs text-gray-400">Student-submitted requests routed to administrators with support permissions.</p>
                  </div>
                  {loadingSupportRequests ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-400">Loading support requests...</div>
                  ) : supportRequests.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-400">No support requests have been submitted yet.</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {supportRequests.map((request) => {
                        const isSaving = savingSupportRequestId === request.id

                        return (
                          <div key={request.id} className="px-5 py-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold text-gray-900">{request.subject}</h3>
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    request.status === 'resolved'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : request.status === 'in_progress'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {request.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">{request.studentName} • {request.registrationNumber || request.studentEmail}</p>
                                <p className="mt-1 text-xs text-gray-400">Submitted {new Date(request.createdAt).toLocaleString()} • Updated {new Date(request.updatedAt).toLocaleString()}</p>
                              </div>
                              <div className="text-xs text-gray-500">
                                <p>Email: {request.studentEmail}</p>
                                <p>Request ID: {request.id}</p>
                              </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
                              {request.message}
                            </div>

                            <div className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
                              <div>
                                <label htmlFor={`support-status-${request.id}`} className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                                <select
                                  id={`support-status-${request.id}`}
                                  value={supportStatusDrafts[request.id] ?? request.status}
                                  onChange={(event) => setSupportStatusDrafts((current) => ({
                                    ...current,
                                    [request.id]: event.target.value as SupportRequestStatus,
                                  }))}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                >
                                  <option value="open">Open</option>
                                  <option value="in_progress">In progress</option>
                                  <option value="resolved">Resolved</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`support-reply-${request.id}`} className="mb-2 block text-sm font-medium text-gray-700">Admin reply</label>
                                <textarea
                                  id={`support-reply-${request.id}`}
                                  rows={3}
                                  value={supportReplyDrafts[request.id] ?? request.adminReply}
                                  onChange={(event) => setSupportReplyDrafts((current) => ({
                                    ...current,
                                    [request.id]: event.target.value,
                                  }))}
                                  placeholder="Explain the resolution or next action for the student."
                                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleSaveSupportRequest(request.id)}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <Save className="h-4 w-4" />
                                {isSaving ? 'Saving...' : 'Save Update'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                )}
              </div>
            )}

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PERMIT ACTIVITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeSection === 'permits' && (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Permit Activity</h1>
                    <p className="text-sm text-gray-500">Showing {activityPageStart}-{activityPageEnd} of {activityTotalItems} event(s)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canDeleteAuditLogs ? (
                      <button
                        type="button"
                        onClick={handleRequestPurgePermitActivity}
                        disabled={permitActivityLogs.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 shadow-sm hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear all
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleExportPermitActivity}
                      disabled={permitActivityLogs.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-5 py-3 text-left">Student</th>
                          <th className="px-5 py-3 text-left">Student ID</th>
                          <th className="px-5 py-3 text-left">Action</th>
                          <th className="px-5 py-3 text-left">Time</th>
                          {canDeleteAuditLogs ? <th className="px-5 py-3 text-right"> </th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {permitActivityLogs.map((log) => {
                          const student = students.find((s) => s.id === log.targetProfileId)
                          return (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 font-medium text-gray-800">{student?.name ?? log.targetProfileId}</td>
                              <td className="px-5 py-3 text-gray-500">{student?.studentId ?? '-'}</td>
                              <td className="px-5 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${log.action === 'print_permit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                  {log.action === 'print_permit' ? 'Printed' : 'Downloaded'}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-gray-500">
                                {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                              </td>
                              {canDeleteAuditLogs ? (
                                <td className="px-5 py-3 text-right">
                                  <button
                                    type="button"
                                    title="Delete this activity row"
                                    aria-label="Delete this activity row"
                                    onClick={() => void handleDeletePermitActivityLog(log)}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          )
                        })}
                        {permitActivityLogs.length === 0 && (
                          <tr>
                            <td className="px-5 py-8 text-center text-gray-400" colSpan={canDeleteAuditLogs ? 5 : 4}>No permit activity has been recorded yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3 text-sm text-gray-600">
                    <span>Page {activityPage} of {activityTotalPages}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={activityPage <= 1}
                        onClick={() => setActivityPage((current) => Math.max(current - 1, 1))}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={activityPage >= activityTotalPages}
                        onClick={() => setActivityPage((current) => Math.min(current + 1, activityTotalPages))}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bulk import: financials, student accounts (spreadsheet), HTTP batch + OIDC notes */}
            {activeSection === 'import' && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Bulk import and integrations</h1>
                  <p className="text-sm text-gray-500">
                    Choose financial updates, new student accounts from a spreadsheet, or server-to-server batch provisioning details.
                  </p>
                </div>

                {bulkImportTabs.length > 1 ? (
                  <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
                    {bulkImportTabs.includes('financial') ? (
                      <button
                        type="button"
                        onClick={() => setBulkImportSubSection('financial')}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          bulkImportSubSection === 'financial'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Financial spreadsheet
                      </button>
                    ) : null}
                    {bulkImportTabs.includes('student_accounts') ? (
                      <button
                        type="button"
                        onClick={() => setBulkImportSubSection('student_accounts')}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          bulkImportSubSection === 'student_accounts'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Student accounts
                      </button>
                    ) : null}
                    {bulkImportTabs.includes('api') ? (
                      <button
                        type="button"
                        onClick={() => setBulkImportSubSection('api')}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          bulkImportSubSection === 'api'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        HTTP API and SSO
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {bulkImportSubSection === 'financial' && canManageFinancials && (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-1 text-lg font-semibold text-gray-900">Bulk financial import</h2>
                    <p className="mb-4 text-sm text-gray-500">Upload a .xlsx or .csv file to update student financial data in bulk.</p>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <p className="max-w-sm text-sm text-gray-600">
                        Use columns such as{' '}
                        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">student_name</code>,{' '}
                        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">student_id</code> or{' '}
                        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">email</code>, plus{' '}
                        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">amount_paid</code> and optional{' '}
                        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">total_fees</code>.
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          disabled={!canManageFinancials}
                          onClick={downloadFinancialImportTemplate}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Download className="h-4 w-4" />
                          Download template
                        </button>
                        <label
                          htmlFor="admin-financial-import-input"
                          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${!canManageFinancials ? 'cursor-not-allowed bg-emerald-300' : importing ? 'cursor-pointer bg-emerald-400' : dragActive ? 'cursor-pointer bg-emerald-700' : 'cursor-pointer bg-emerald-600 hover:bg-emerald-700'}`}
                          onDragEnter={handleDragEnter}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => void handleDrop(e)}
                        >
                          <Upload className="h-4 w-4" />
                          {importing ? 'Importing...' : dragActive ? 'Drop file here' : 'Upload spreadsheet'}
                        </label>
                      </div>
                    </div>

                    {importPreviewRows.length > 0 && (
                      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-800">Import preview</h3>
                            <p className="text-xs text-gray-500">
                              {importPreviewRows.length} row(s) from {importFileName} — {pendingImportUpdates.length} row(s) are ready to apply.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={clearImportPreview}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              disabled={!canManageFinancials || importing || pendingImportUpdates.length === 0}
                              onClick={() => void handleApplyImport()}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Apply import
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Row</th>
                                <th className="px-3 py-2 text-left">Key</th>
                                <th className="px-3 py-2 text-left">Student</th>
                                <th className="px-3 py-2 text-left">Amount received</th>
                                <th className="px-3 py-2 text-left">Expected fees</th>
                                <th className="px-3 py-2 text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {importPreviewRows.slice(0, 12).map((row) => (
                                <tr key={`${row.rowNumber}-${row.matcher}`} className="bg-white">
                                  <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                                  <td className="px-3 py-2 text-gray-700">{row.matcher}</td>
                                  <td className="px-3 py-2 text-gray-700">{row.studentName ?? '-'}</td>
                                  <td className="px-3 py-2 text-gray-700">
                                    {typeof row.amountPaid === 'number' ? formatMoney(row.amountPaid, activeCurrencyCode) : '-'}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700">
                                    {typeof row.totalFees === 'number' ? formatMoney(row.totalFees, activeCurrencyCode) : '-'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`rounded px-2.5 py-1 text-xs font-medium ${
                                      row.status === 'ready'
                                        ? 'bg-green-100 text-green-700'
                                        : row.status === 'create'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-red-100 text-red-700'
                                    }`}>
                                      {row.status === 'ready' ? 'Update' : row.status === 'create' ? 'Create' : (row.reason ?? 'Skipped')}
                                    </span>
                                    {row.status !== 'ready' && row.reason ? (
                                      <p className="mt-1 max-w-xs text-[11px] text-gray-500">{row.reason}</p>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importPreviewRows.length > 12 && (
                            <p className="mt-2 text-xs text-gray-400">Showing the first 12 rows.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {bulkImportSubSection === 'student_accounts' && canManageStudentProfiles && (
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-1 text-lg font-semibold text-gray-900">Student accounts (spreadsheet)</h2>
                    <p className="mb-4 text-sm text-gray-500">
                      Create many student logins from .xlsx or .csv. Use either a plain <code className="rounded bg-gray-100 px-1 text-xs">password</code> column or a{' '}
                      <code className="rounded bg-gray-100 px-1 text-xs">password_hash</code> value prefixed with <code className="rounded bg-gray-100 px-1 text-xs">scrypt:</code>.
                      Missing <code className="rounded bg-gray-100 px-1 text-xs">total_fees</code> defaults to the system local fee.
                    </p>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <p className="max-w-md text-sm text-gray-600">
                        Required columns include <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">student_name</code>,{' '}
                        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">student_id</code>, <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">email</code>, and{' '}
                        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">course</code>. Row limits are enforced on the server (<code className="rounded bg-gray-100 px-1 text-xs">STUDENT_IMPORT_MAX_ROWS</code>, default 5000, max 20000).
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          disabled={!canManageStudentProfiles}
                          onClick={downloadStudentAccountsImportTemplate}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Download className="h-4 w-4" />
                          Download template
                        </button>
                        <label
                          htmlFor="admin-student-import-input"
                          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${!canManageStudentProfiles ? 'cursor-not-allowed bg-emerald-300' : studentAccountsImporting ? 'cursor-pointer bg-emerald-400' : studentAccountsDragActive ? 'cursor-pointer bg-emerald-700' : 'cursor-pointer bg-emerald-600 hover:bg-emerald-700'}`}
                          onDragEnter={handleStudentImportDragEnter}
                          onDragOver={handleStudentImportDragOver}
                          onDragLeave={handleStudentImportDragLeave}
                          onDrop={(e) => void handleStudentImportDrop(e)}
                        >
                          <Upload className="h-4 w-4" />
                          {studentAccountsImporting ? 'Working...' : studentAccountsDragActive ? 'Drop file here' : 'Upload spreadsheet'}
                        </label>
                      </div>
                    </div>

                    {studentImportPreviewRows.length > 0 && (
                      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-800">Import preview</h3>
                            <p className="text-xs text-gray-500">
                              {studentImportPreviewRows.length} row(s) from {studentImportFileName} —{' '}
                              {studentImportPreviewRows.filter((r) => r.status === 'create').length} row(s) ready to create.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={clearStudentImportPreview}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              disabled={
                                !canManageStudentProfiles
                                || studentAccountsImporting
                                || !pendingStudentImportFile
                                || studentImportPreviewRows.filter((r) => r.status === 'create').length === 0
                              }
                              onClick={() => void handleApplyStudentAccountsImport()}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Apply import
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              <tr>
                                <th className="px-3 py-2 text-left">Row</th>
                                <th className="px-3 py-2 text-left">Name</th>
                                <th className="px-3 py-2 text-left">Reg. no.</th>
                                <th className="px-3 py-2 text-left">Email</th>
                                <th className="px-3 py-2 text-left">Course</th>
                                <th className="px-3 py-2 text-left">Fees</th>
                                <th className="px-3 py-2 text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {studentImportPreviewRows.slice(0, 12).map((row) => (
                                <tr key={row.rowNumber} className="bg-white">
                                  <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                                  <td className="px-3 py-2 text-gray-700">{row.studentName ?? '-'}</td>
                                  <td className="px-3 py-2 text-gray-700">{row.studentId ?? '-'}</td>
                                  <td className="px-3 py-2 text-gray-700">{row.email ?? '-'}</td>
                                  <td className="px-3 py-2 text-gray-700">{row.course ?? '-'}</td>
                                  <td className="px-3 py-2 text-gray-700">
                                    {typeof row.totalFees === 'number' ? formatMoney(row.totalFees, activeCurrencyCode) : '-'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span
                                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                                        row.status === 'create' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                      }`}
                                    >
                                      {row.status === 'create' ? 'Create' : (row.reason ?? 'Skipped')}
                                    </span>
                                    {row.status === 'skipped' && row.reason ? (
                                      <p className="mt-1 max-w-xs text-[11px] text-gray-500">{row.reason}</p>
                                    ) : null}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {studentImportPreviewRows.length > 12 && (
                            <p className="mt-2 text-xs text-gray-400">Showing the first 12 rows.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {bulkImportSubSection === 'api' && canManageStudentProfiles && (
                  <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">HTTP batch provisioning</h2>
                    <p className="text-sm text-gray-600">
                      Your student information system can create accounts by calling the REST API with a shared secret. Set <code className="rounded bg-gray-100 px-1 text-xs">STUDENT_PROVISION_API_KEY</code> on the server, then send{' '}
                      <code className="rounded bg-gray-100 px-1 text-xs">X-Provision-Key</code> on each request. Maximum{' '}
                      <strong className="font-medium text-gray-800">500</strong> students per request; split larger cohorts into multiple calls.
                    </p>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Endpoint</p>
                      <code className="block overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-emerald-100">
                        POST {publicApiBaseUrl}/integrations/students/batch
                      </code>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Example body</p>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-100">
{`{
  "students": [
    {
      "name": "Jane Student",
      "email": "jane.student@university.edu",
      "student_id": "REG-2026-001",
      "course": "BSc Software Engineering",
      "student_category": "local",
      "total_fees": 3000,
      "password": "choose-a-strong-password"
    }
  ]
}`}
                      </pre>
                      <p className="mt-2 text-xs text-gray-500">
                        Use <code className="rounded bg-gray-100 px-1 text-xs">password</code> (8–128 characters) or, instead of <code className="rounded bg-gray-100 px-1 text-xs">password</code>, a <code className="rounded bg-gray-100 px-1 text-xs">password_hash</code> string beginning with <code className="rounded bg-gray-100 px-1 text-xs">scrypt:</code>.
                      </p>
                    </div>
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                      <p className="font-semibold">SIS connector setup (ready for your endpoint)</p>
                      <p className="mt-1">
                        The backend now supports staged SIS configuration through environment variables:
                        <code className="mx-1 rounded bg-white px-1">SIS_BASE_URL</code>,
                        <code className="mx-1 rounded bg-white px-1">SIS_STUDENTS_PATH</code>,
                        <code className="mx-1 rounded bg-white px-1">SIS_AUTH_TYPE</code>, and
                        <code className="mx-1 rounded bg-white px-1">SIS_API_KEY</code>.
                        Health endpoints are available at <code className="mx-1 rounded bg-white px-1">GET /sis/status</code> and <code className="mx-1 rounded bg-white px-1">POST /sis/sync</code>.
                      </p>
                    </div>
                    <h2 className="pt-2 text-lg font-semibold text-gray-900">University sign-in (OIDC)</h2>
                    <p className="text-sm text-gray-600">
                      When the backend is configured with <code className="rounded bg-gray-100 px-1 text-xs">OIDC_ISSUER</code>, <code className="rounded bg-gray-100 px-1 text-xs">OIDC_CLIENT_ID</code>,{' '}
                      <code className="rounded bg-gray-100 px-1 text-xs">OIDC_CLIENT_SECRET</code>, <code className="rounded bg-gray-100 px-1 text-xs">OIDC_REDIRECT_URI</code>, and{' '}
                      <code className="rounded bg-gray-100 px-1 text-xs">FRONTEND_ORIGIN</code>, students who already exist in this portal can use{' '}
                      <span className="font-medium text-gray-800">Sign in with university</span> on the login page. New students must still be provisioned first (spreadsheet or API).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REPORTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {activeSection === 'reports' && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Reports &amp; Analytics</h1>
                    <p className="text-sm text-gray-500">Financial clearance breakdown, permit trends, and exportable operational summaries.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!adminCapability.canExportReports}
                      onClick={handleExportDashboardCsv}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      disabled={!adminCapability.canExportReports}
                      onClick={handleExportDashboardExcel}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export Excel
                    </button>
                    <button
                      type="button"
                      disabled={!adminCapability.canExportReports}
                      onClick={handlePrintDashboardReport}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      <CreditCard className="h-4 w-4" />
                      Print / Save PDF
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Bar chart: students by course */}
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 font-semibold text-gray-800">Students by Course</h2>
                    {courseNames.length === 0 ? (
                      <p className="text-sm text-gray-400">No course data available.</p>
                    ) : (
                      <div className="space-y-3">
                        {courseNames.map((course) => {
                          const { total, cleared } = courseBreakdown[course]
                          const barPct = Math.round((total / maxCourseCount) * 100)
                          return (
                            <div key={course}>
                              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                                <span className="truncate font-medium">{course}</span>
                                <span>{cleared}/{total} cleared</span>
                              </div>
                              <div className="space-y-1">
                                <div className="h-5 rounded-full bg-gray-100 p-1">
                                  <progress
                                    className="payment-progress payment-progress-clear h-full"
                                    max={total || 1}
                                    value={cleared}
                                    aria-label={`${course} clearance progress`}
                                    title={`${cleared} of ${total} students cleared in ${course}`}
                                  />
                                </div>
                                <p className="text-[11px] text-gray-400">Relative class size: {barPct}% of the largest course cohort</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Cleared
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
                        Outstanding
                      </span>
                    </div>
                  </div>

                  {/* Donut chart: clearance ratio */}
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-4 font-semibold text-gray-800">Clearance Status</h2>
                    {totalStudents === 0 ? (
                      <p className="text-sm text-gray-400">No student data yet.</p>
                    ) : (
                      (() => {
                        const r = 60
                        const cx = 80
                        const cy = 80
                        const clearedAngle = (clearedStudents / totalStudents) * 360
                        function toCartesian(angleDeg: number) {
                          const rad = ((angleDeg - 90) * Math.PI) / 180
                          return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
                        }
                        const start = toCartesian(0)
                        const end = toCartesian(clearedAngle)
                        const largeArc = clearedAngle > 180 ? 1 : 0
                        const dCleared =
                          clearedStudents === totalStudents
                            ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
                            : `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
                        return (
                          <div className="flex items-center gap-6">
                            <svg width="160" height="160" viewBox="0 0 160 160">
                              <circle cx={cx} cy={cy} r={r} fill="#fef3c7" />
                              <path d={dCleared} fill="#10b981" />
                              <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
                              <text x={cx} y={cy - 5} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#111827">
                                {Math.round((clearedStudents / totalStudents) * 100)}%
                              </text>
                              <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6b7280">cleared</text>
                            </svg>
                            <div className="space-y-3 text-sm">
                              <div>
                                <p className="text-xs uppercase tracking-wide text-gray-400">Cleared</p>
                                <p className="text-2xl font-bold text-emerald-600">{clearedStudents}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-gray-400">Outstanding</p>
                                <p className="text-2xl font-bold text-amber-500">{outstandingStudents}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wide text-gray-400">Total</p>
                                <p className="text-2xl font-bold text-gray-700">{totalStudents}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })()
                    )}
                  </div>

                  {/* Permit issuance summary */}
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
                    <h2 className="mb-4 font-semibold text-gray-800">Permit Issuance Summary</h2>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="rounded-lg bg-blue-50 p-4 text-center">
                        <p className="text-2xl font-bold text-blue-700">
                          {permitActivityLogs.filter((l) => l.action === 'print_permit').length}
                        </p>
                        <p className="mt-1 text-xs text-blue-500">Total Prints</p>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-4 text-center">
                        <p className="text-2xl font-bold text-purple-700">
                          {permitActivityLogs.filter((l) => l.action === 'download_permit').length}
                        </p>
                        <p className="mt-1 text-xs text-purple-500">Total Downloads</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-700">
                          {new Set(permitActivityLogs.map((l) => l.targetProfileId)).size}
                        </p>
                        <p className="mt-1 text-xs text-emerald-500">Students with Activity</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-4 text-center">
                        <p className="text-2xl font-bold text-gray-700">
                          {totalStudents - new Set(permitActivityLogs.map((l) => l.targetProfileId)).size}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">No Activity Yet</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
                    <h2 className="mb-4 font-semibold text-gray-800">Integration Readiness</h2>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-emerald-500">Student Database Sync</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-800">Available Through REST Profiles</p>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-emerald-500">Exam Scheduling</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-800">Available Through Assigned Exams</p>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-amber-500">Notification Gateway</p>
                        <p className="mt-1 text-sm font-semibold text-amber-800">In-App Only In This Demo</p>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-blue-500">Payment Verification</p>
                        <p className="mt-1 text-sm font-semibold text-blue-800">Supported Through Financial Updates</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── PERMIT CARDS ── */}
            {activeSection === 'permit-cards' && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Permit Card Management</h1>
                  <p className="text-sm text-gray-500">
                    {clearedStudents} cleared student(s) eligible to print. {outstandingStudents} still have outstanding balances.
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-gray-900">Permit layout (student-facing card)</h2>
                  <p className="mt-1 text-xs text-gray-500">Saved in this browser; student permit cards read these settings on load.</p>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-gray-700">
                      Custom logo URL
                      <input
                        type="text"
                        value={permitDesign.logo}
                        onChange={(e) => handlePermitDesignChange('logo', e.target.value)}
                        placeholder="Leave empty for default"
                        className="rounded border border-gray-300 px-2 py-1 text-sm font-normal"
                      />
                    </label>
                    <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-gray-700">
                      Institution name override
                      <input
                        type="text"
                        value={permitDesign.name}
                        onChange={(e) => handlePermitDesignChange('name', e.target.value)}
                        placeholder="Leave empty for default"
                        className="rounded border border-gray-300 px-2 py-1 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-700">
                    {(
                      [
                        ['photo', 'Photo'],
                        ['department', 'Department'],
                        ['semester', 'Semester'],
                        ['course', 'Course on permit'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={permitDesign.fields[key]}
                          onChange={() => handlePermitFieldToggle(key)}
                          className="rounded border-gray-300"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs font-medium text-gray-700">
                    Department:
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="ml-2 rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="">All departments</option>
                      {permitDepartmentOptions.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-700">
                    Program:
                    <select
                      value={filterProgram}
                      onChange={(e) => {
                        const nextProgram = e.target.value
                        setFilterProgram(nextProgram)
                        const alignedCourse = nextProgram ? (KIU_CURRICULUM[nextProgram]?.defaultCourse ?? '') : ''
                        setFilterCourse(alignedCourse)
                      }}
                      className="ml-2 rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="">All programs</option>
                      {permitProgramOptions.map((program) => (
                        <option key={program} value={program}>{program}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-700">
                    Course:
                    <select
                      value={filterCourse}
                      onChange={(e) => setFilterCourse(e.target.value)}
                      className="ml-2 rounded border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="">All courses</option>
                      {permitCourseOptions.map((course) => (
                        <option key={course} value={course}>{course}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-700">
                    College:
                    <input
                      type="text"
                      value={filterCollege}
                      onChange={e => setFilterCollege(e.target.value)}
                      placeholder="Filter by college"
                      className="ml-2 rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!canManageStudentProfiles || bulkPrinting || filteredStudents.every((student) => student.feesBalance > 0)}
                    onClick={() => void handleBulkPrintCleared()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    {bulkPrinting ? 'Preparing print...' : 'Print Cleared Permits On This Page'}
                  </button>
                  <button
                    type="button"
                    disabled={!canManageStudentProfiles}
                    onClick={handleSelectClearedStudentsOnPage}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {allClearedStudentsOnPageSelected ? 'Clear Page Selection' : 'Select Cleared Students On This Page'}
                  </button>
                  <button
                    type="button"
                    disabled={!canManageStudentProfiles || bulkPrinting || clearedSelectedPermitStudents.length === 0}
                    onClick={() => void handlePrintSelectedPermits()}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    Print Selected Permits ({clearedSelectedPermitStudents.length})
                  </button>
                  <span className="text-xs text-gray-500">Bulk printing uses the currently loaded page and current filters, including department and program.</span>
                </div>

                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{clearedStudents}</p>
                    <p className="mt-1 text-xs text-emerald-500">Cleared — Can Print</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">{outstandingStudents}</p>
                    <p className="mt-1 text-xs text-amber-500">Outstanding — Blocked</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">
                      {new Set(permitActivityLogs.map((l) => l.targetProfileId)).size}
                    </p>
                    <p className="mt-1 text-xs text-blue-500">Have Printed / Downloaded</p>
                  </div>
                </div>

                {/* Card grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredStudents.map((student) => {
                    const summary = getStudentPrintSummary(student.id)
                    const cleared = student.feesBalance === 0
                    const departmentStyle = getDepartmentColorStyle(student.department)
                    const departmentLabel = (student.department ?? '').trim() || 'Unassigned'

                    return (
                      <div
                        key={student.id}
                        className={`rounded-xl border bg-white p-5 shadow-sm ${
                          cleared ? 'border-emerald-200' : 'border-amber-200'
                        } ${departmentStyle.cardBorder} ${departmentStyle.cardTint}`}
                        title={`Department: ${departmentLabel}`}
                      >
                        <div className="mb-2 flex justify-end">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${departmentStyle.pill}`}>
                            {departmentLabel}
                          </span>
                        </div>
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedPermitStudentIds.includes(student.id)}
                              onChange={() => togglePermitSelection(student.id)}
                              disabled={!canManageStudentProfiles}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600"
                              aria-label={`Select ${student.name} for bulk permit printing`}
                            />
                            <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-400">{student.studentId} - {student.email}</p>
                            <p className="text-xs text-gray-400">{student.program ?? 'No program'} - {student.semester ?? 'No semester'}</p>
                            </div>
                          </div>
                          <span
                            className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              cleared ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {cleared ? 'Cleared' : 'Blocked'}
                          </span>
                        </div>

                        <div
                          className={`mb-3 flex h-24 items-center justify-center rounded-lg ${
                            cleared ? 'bg-gray-50' : 'bg-amber-50'
                          }`}
                        >
                          {cleared ? (
                            <div className="flex flex-col items-center gap-1 text-gray-400">
                              <QrCode className="h-10 w-10" />
                              <span className="text-[10px]">QR generated on permit</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-amber-400">
                              <Shield className="h-10 w-10" />
                              <span className="text-[10px] font-medium">Remaining: {formatMoney(student.feesBalance, activeCurrencyCode)}</span>
                            </div>
                          )}
                        </div>

                        <div className="mb-3 flex items-center gap-2">
                          <form
                            className="flex items-center gap-2"
                            onSubmit={(e) => void handleSavePayment(e, student)}
                          >
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={paymentDrafts[student.id] ?? ''}
                              onChange={(e) =>
                                setPaymentDrafts((cur) => ({ ...cur, [student.id]: e.target.value }))
                              }
                              aria-label={`Bank slip or payment amount to add for ${student.name}`}
                              title={`Amount on this slip only — adds to cumulative total (already recorded: ${formatMoney(student.amountPaid, activeCurrencyCode)})`}
                              placeholder="Slip amount"
                              className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300"
                            />
                            <button
                              type="submit"
                              disabled={!canManageFinancials || savingId === student.id}
                              title="Post this slip — adds to cumulative amount received"
                              aria-label={`Post bank slip payment for ${student.name}`}
                              className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!canManageFinancials || savingId === student.id || student.feesBalance === 0}
                              onClick={() => void handleClear(student)}
                              title="Mark fully paid"
                              aria-label={`Mark ${student.name} as fully paid`}
                              className="rounded bg-green-500 p-1.5 text-white hover:bg-green-600 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                          <button
                            type="button"
                            disabled={!canManageStudentProfiles}
                            onClick={() => handleEditStudent(student)}
                            title="Edit student profile"
                            aria-label={`Edit profile for ${student.name}`}
                            className="rounded bg-blue-500 p-1.5 text-white hover:bg-blue-600 disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canManageStudentProfiles || grantingPrintAccessId === student.id}
                            onClick={() => void handleGrantPrintAccess(student)}
                            title="Grant one extra permit print for this month"
                            aria-label={`Grant one extra permit print for ${student.name}`}
                            className="rounded bg-indigo-500 p-1.5 text-white hover:bg-indigo-600 disabled:opacity-50"
                          >
                            <Shield className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={!canManageStudentProfiles || deletingStudentId === student.id}
                            onClick={() => void handleDeleteStudentProfile(student)}
                            title="Remove student profile"
                            aria-label={`Remove ${student.name}`}
                            className="rounded bg-red-500 p-1.5 text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mb-3">
                          <div className="mb-1 flex justify-between text-xs text-gray-500">
                            <span>Received: {formatMoney(student.amountPaid, activeCurrencyCode)}</span>
                            <span>Expected: {formatMoney(student.totalFees, activeCurrencyCode)}</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <progress
                              className={`payment-progress h-full ${cleared ? 'payment-progress-clear' : 'payment-progress-warning'}`}
                              max={student.totalFees > 0 ? student.totalFees : 1}
                              value={Math.min(student.amountPaid, student.totalFees > 0 ? student.totalFees : 1)}
                              aria-label={`${student.name} payment completion`}
                              title={`${Math.round(getPaymentCompletionPercent(student.amountPaid, student.totalFees))}% fees paid`}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {student.courseUnits && student.courseUnits.length > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                              {student.courseUnits.length} course units
                            </span>
                          )}
                          {summary.printCount > 0 && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              Printed {summary.printCount}x
                            </span>
                          )}
                          {summary.downloadCount > 0 && (
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                              Downloaded {summary.downloadCount}x
                            </span>
                          )}
                          {summary.total === 0 && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">
                              No print activity
                            </span>
                          )}
                          {summary.lastAt && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">
                              Last: {new Date(summary.lastAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {filteredStudents.length === 0 && (
                    <div className="col-span-3 rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
                      No students found.
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm text-gray-600 shadow-sm">
                  <span>Page {page} of {totalPages}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((current) => Math.max(current - 1, 1))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {activeSection === 'settings' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                  <p className="text-sm text-gray-500">System configuration and account information.</p>
                </div>

                {canManageFinancials && (
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-6 py-4">
                      <h2 className="font-semibold text-gray-800">Fee Structure</h2>
                      <p className="mt-1 text-xs text-gray-400">Set the default exam clearance fees used for new local and international student accounts.</p>
                    </div>
                    <form className="space-y-4 px-6 py-5" onSubmit={(event) => void handleSaveFeeStructure(event)}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="fee-settings-local" className="mb-2 block text-sm font-medium text-gray-700">Local student fee</label>
                          <input
                            id="fee-settings-local"
                            type="number"
                            min="0"
                            step="0.01"
                            value={feeSettingsDraft.localStudentFee}
                            onChange={(event) => setFeeSettingsDraft((current) => ({ ...current, localStudentFee: event.target.value }))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div>
                          <label htmlFor="fee-settings-international" className="mb-2 block text-sm font-medium text-gray-700">International student fee</label>
                          <input
                            id="fee-settings-international"
                            type="number"
                            min="0"
                            step="0.01"
                            value={feeSettingsDraft.internationalStudentFee}
                            onChange={(event) => setFeeSettingsDraft((current) => ({ ...current, internationalStudentFee: event.target.value }))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="fee-settings-currency" className="mb-2 block text-sm font-medium text-gray-700">Fee currency (ISO 4217)</label>
                          <input
                            id="fee-settings-currency"
                            type="text"
                            maxLength={3}
                            value={feeSettingsDraft.currencyCode}
                            onChange={(event) => setFeeSettingsDraft((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))}
                            list="admin-fee-currency-suggestions"
                            placeholder="USD"
                            className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                          <datalist id="admin-fee-currency-suggestions">
                            <option value="USD" />
                            <option value="UGX" />
                            <option value="EUR" />
                            <option value="GBP" />
                            <option value="KES" />
                            <option value="TZS" />
                            <option value="RWF" />
                            <option value="ZAR" />
                          </datalist>
                          <p className="mt-1 text-xs text-gray-500">Used for fee labels and money formatting across the admin and student portals.</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Saves default fees only. Deadline changes use the button below.</p>
                      <button
                        type="submit"
                        disabled={savingFeeStructure || savingDeadlines}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {savingFeeStructure ? 'Saving...' : 'Save fee structure'}
                      </button>
                    </form>

                    <form className="space-y-4 border-t border-gray-100 px-6 py-5" onSubmit={(event) => void handleSaveDeadlines(event)}>
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">Important Deadlines</h3>
                          <p className="text-[10px] text-gray-400 uppercase tracking-tight">Shown on all student dashboards</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFeeSettingsDraft(prev => ({
                            ...prev,
                            deadlines: [...prev.deadlines, { id: `dl-${Date.now()}`, title: '', subtitle: '', dateLabel: '', type: 'info' as const }]
                          }))}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          + Add Deadline
                        </button>
                      </div>
                      <div className="space-y-3">
                        {feeSettingsDraft.deadlines.map((deadline, idx) => (
                          <div key={deadline.id} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] items-end rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Title</label>
                              <input
                                type="text"
                                value={deadline.title}
                                onChange={(e) => {
                                  const next = [...feeSettingsDraft.deadlines]
                                  next[idx] = { ...deadline, title: e.target.value }
                                  setFeeSettingsDraft(prev => ({ ...prev, deadlines: next }))
                                }}
                                className="w-full border-b border-gray-200 bg-transparent py-1 text-xs focus:border-emerald-400 focus:outline-none"
                                placeholder="e.g. Final Exam Clearance"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Subtitle</label>
                              <input
                                type="text"
                                value={deadline.subtitle}
                                onChange={(e) => {
                                  const next = [...feeSettingsDraft.deadlines]
                                  next[idx] = { ...deadline, subtitle: e.target.value }
                                  setFeeSettingsDraft(prev => ({ ...prev, deadlines: next }))
                                }}
                                className="w-full border-b border-gray-200 bg-transparent py-1 text-xs focus:border-emerald-400 focus:outline-none"
                                placeholder="e.g. Clear all balances"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Date/Label</label>
                              <input
                                type="text"
                                value={deadline.dateLabel}
                                onChange={(e) => {
                                  const next = [...feeSettingsDraft.deadlines]
                                  next[idx] = { ...deadline, dateLabel: e.target.value }
                                  setFeeSettingsDraft(prev => ({ ...prev, deadlines: next }))
                                }}
                                className="w-full border-b border-gray-200 bg-transparent py-1 text-xs focus:border-emerald-400 focus:outline-none"
                                placeholder="e.g. In 14 Days"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Due (countdown)</label>
                              <input
                                type="date"
                                value={deadline.dueAt ? deadline.dueAt.slice(0, 10) : ''}
                                onChange={(e) => {
                                  const next = [...feeSettingsDraft.deadlines]
                                  const v = e.target.value
                                  next[idx] = {
                                    ...deadline,
                                    ...(v ? { dueAt: `${v}T23:59:59.000Z` } : { dueAt: undefined }),
                                  }
                                  setFeeSettingsDraft(prev => ({ ...prev, deadlines: next }))
                                }}
                                className="w-full border-b border-gray-200 bg-transparent py-1 text-xs focus:border-emerald-400 focus:outline-none"
                                title="Optional — drives the live countdown on student dashboards"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Type</label>
                              <select
                                value={deadline.type}
                                onChange={(e) => {
                                  const next = [...feeSettingsDraft.deadlines]
                                  next[idx] = { ...deadline, type: e.target.value as any }
                                  setFeeSettingsDraft(prev => ({ ...prev, deadlines: next }))
                                }}
                                className="w-full border-b border-gray-200 bg-transparent py-1 text-xs focus:border-emerald-400 focus:outline-none"
                                aria-label="Deadline type"
                                title="Deadline type"
                              >
                                <option value="info">Info (Blue)</option>
                                <option value="danger">Danger (Red)</option>
                                <option value="warning">Warning (Amber)</option>
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const next = feeSettingsDraft.deadlines.filter((_, i) => i !== idx)
                                setFeeSettingsDraft(prev => ({ ...prev, deadlines: next }))
                              }}
                              className="rounded p-1 text-red-400 hover:bg-red-50"
                              aria-label="Remove deadline"
                              title="Remove deadline"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        {feeSettingsDraft.deadlines.length === 0 && (
                          <p className="text-center py-4 text-xs text-gray-400 font-medium border-2 border-dashed border-gray-100 rounded-xl">No global deadlines set. Add one to show on student dashboards.</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Saves dashboard deadlines only, using the fee amounts already stored on the server.</p>
                      <button
                        type="submit"
                        disabled={savingDeadlines || savingFeeStructure}
                        className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {savingDeadlines ? 'Saving...' : 'Save deadlines'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-6 py-4">
                    <h2 className="font-semibold text-gray-800">Account Settings</h2>
                    <p className="mt-1 text-xs text-gray-400">Update your admin name, email, phone number, or password.</p>
                  </div>
                  <form className="space-y-4 px-6 py-5" onSubmit={(event) => void handleSaveAdminSettings(event)}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="admin-settings-name" className="mb-2 block text-sm font-medium text-gray-700">Full name</label>
                        <input
                          id="admin-settings-name"
                          type="text"
                          required
                          minLength={2}
                          maxLength={120}
                          value={settingsDraft.name}
                          onChange={(event) => setSettingsDraft((current) => ({ ...current, name: event.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-settings-email" className="mb-2 block text-sm font-medium text-gray-700">Email address</label>
                        <input
                          id="admin-settings-email"
                          type="email"
                          required
                          value={settingsDraft.email}
                          onChange={(event) => setSettingsDraft((current) => ({ ...current, email: event.target.value }))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-settings-phone" className="mb-2 block text-sm font-medium text-gray-700">Phone number</label>
                        <input
                          id="admin-settings-phone"
                          type="tel"
                          value={settingsDraft.phoneNumber}
                          onChange={(event) => setSettingsDraft((current) => ({ ...current, phoneNumber: event.target.value }))}
                          placeholder="e.g. +256700123456"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-settings-password" className="mb-2 block text-sm font-medium text-gray-700">New password</label>
                        <input
                          id="admin-settings-password"
                          type="password"
                          value={settingsDraft.password}
                          onChange={(event) => setSettingsDraft((current) => ({ ...current, password: event.target.value }))}
                          placeholder="Leave blank to keep current password"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                      <div>
                        <label htmlFor="admin-settings-current-password" className="mb-2 block text-sm font-medium text-gray-700">Current password</label>
                        <input
                          id="admin-settings-current-password"
                          type="password"
                          value={settingsDraft.currentPassword}
                          onChange={(event) => setSettingsDraft((current) => ({ ...current, currentPassword: event.target.value }))}
                          placeholder="Required to change password"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>
                    </div>
                    <div className="max-w-md">
                      <label htmlFor="admin-settings-confirm-password" className="mb-2 block text-sm font-medium text-gray-700">Confirm password</label>
                      <input
                        id="admin-settings-confirm-password"
                        type="password"
                        value={settingsDraft.confirmPassword}
                        onChange={(event) => setSettingsDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                        placeholder="Repeat new password"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {savingSettings ? 'Saving...' : 'Save account settings'}
                    </button>
                  </form>
                </div>

                <div className="mt-8 rounded-[1.5rem] border border-red-100 bg-red-50 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <LogOut className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Sign out</p>
                        <p className="text-xs text-gray-400">End your current admin session</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSignOut(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={pendingConfirmation !== null}
        title={pendingConfirmation?.title ?? ''}
        message={pendingConfirmation?.message ?? ''}
        confirmLabel={pendingConfirmation?.confirmLabel ?? 'Confirm'}
        tone={
          pendingConfirmation?.tone === 'danger'
            ? 'danger'
            : pendingConfirmation?.tone === 'success'
              ? 'success'
              : 'primary'
        }
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => void handleConfirmPendingAction()}
      />

      <ConfirmDialog
        open={bulkPrintConfirm !== null}
        title="Confirm Bulk Print"
        message={`You are about to print ${bulkPrintConfirm?.students.length ?? 0} permit${(bulkPrintConfirm?.students.length ?? 0) === 1 ? '' : 's'}. Proceed?`}
        confirmLabel={`Print ${bulkPrintConfirm?.students.length ?? 0} Permit${(bulkPrintConfirm?.students.length ?? 0) === 1 ? '' : 's'}`}
        cancelLabel="Cancel"
        tone="primary"
        onCancel={() => setBulkPrintConfirm(null)}
        onConfirm={() => { if (bulkPrintConfirm) void executeBulkPrint(bulkPrintConfirm.students, bulkPrintConfirm.title) }}
      />

      <SaveConfirmationDialog
        isOpen={unsavedLeaveIntent !== null}
        onConfirm={async () => {
          if (unsavedLeaveIntent === 'edit') {
            const ok = await handleSaveEdit({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)
            if (ok) {
              setUnsavedLeaveIntent(null)
            }
          } else if (unsavedLeaveIntent === 'create') {
            const ok = await handleCreateStudent({ preventDefault: () => {} } as FormEvent<HTMLFormElement>)
            if (ok) {
              setUnsavedLeaveIntent(null)
            }
          }
        }}
        onDontSave={() => {
          if (unsavedLeaveIntent === 'edit') {
            setEditingStudent(null)
          } else if (unsavedLeaveIntent === 'create') {
            setShowCreateStudent(false)
            setCreateDraft(createEmptyStudentDraft(systemFeeSettings))
            setCreatePasswordGenerated(false)
          }
          setUnsavedLeaveIntent(null)
        }}
        onCancel={() => setUnsavedLeaveIntent(null)}
      />

      {editingStudent && (
        <div
          className={`fixed inset-0 ${DIALOG_Z.modalBackdrop} flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-6`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-edit-student-title"
        >
          <div className={`relative ${DIALOG_Z.modalContent} max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 id="admin-edit-student-title" className="text-base font-semibold text-gray-900">Edit Student Profile</h2>
              <button
                type="button"
                title="Close edit student dialog"
                aria-label="Close edit student dialog"
                onClick={() => setUnsavedLeaveIntent('edit')}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSaveEdit(e)} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-student-name" className="mb-1 block text-xs font-medium text-gray-700">Full Name</label>
                  <input
                    id="edit-student-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label htmlFor="edit-student-email" className="mb-1 block text-xs font-medium text-gray-700">Email</label>
                  <input
                    id="edit-student-email"
                    type="email"
                    required
                    value={editDraft.email}
                    onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label htmlFor="edit-student-id" className="mb-1 block text-xs font-medium text-gray-700">Registration No.</label>
                  <input
                    id="edit-student-id"
                    type="text"
                    value={editDraft.studentId}
                    onChange={(e) => setEditDraft((d) => ({ ...d, studentId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="e.g. STU-001"
                  />
                </div>
                <div>
                  <label htmlFor="edit-student-phone" className="mb-1 block text-xs font-medium text-gray-700">Phone Number</label>
                  <input
                    id="edit-student-phone"
                    type="tel"
                    value={editDraft.phoneNumber ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, phoneNumber: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="e.g. +256700123456"
                  />
                </div>
                <div>
                  <label htmlFor="edit-student-category" className="mb-1 block text-xs font-medium text-gray-700">Student Category</label>
                  <select
                    id="edit-student-category"
                    value={editDraft.studentCategory ?? 'local'}
                    onChange={(event) => {
                      const nextCategory = event.target.value === 'international' ? 'international' : 'local'
                      setEditDraft((draft) => ({
                        ...draft,
                        studentCategory: nextCategory,
                        totalFees: formatFeeDraftValue(getFeeForStudentCategory(systemFeeSettings, nextCategory)),
                      }))
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="local">Local Student</option>
                    <option value="international">International Student</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-student-course" className="mb-1 block text-xs font-medium text-gray-700">Course</label>
                  <select
                    id="edit-student-course"
                    value={editDraft.course}
                    onChange={(e) => setEditDraft((d) => ({ ...d, course: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select Course</option>
                    {KIU_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                    {editDraft.course && !KIU_COURSES.includes(editDraft.course) && (
                      <option value={editDraft.course}>{editDraft.course} (Current)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-student-profile-image" className="mb-1 block text-xs font-medium text-gray-700">Profile Photo</label>
                  <div className="flex gap-2 items-center">
                    <input
                      id="edit-student-profile-image-upload"
                      type="file"
                      accept="image/*"
                      title="Upload profile photo"
                      placeholder="Choose image file"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('profilePhoto', file);
                        try {
                          const res = await fetch('/uploads/profile-photo', {
                            method: 'POST',
                            body: formData,
                          });
                          if (!res.ok) throw new Error('Upload failed');
                          const data = await res.json();
                          if (data.url) {
                            setEditDraft((d) => ({ ...d, profileImage: data.url }));
                          }
                        } catch {
                          alert('Failed to upload image.');
                        }
                      }}
                      className="block w-full text-xs text-gray-700 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    {editDraft.profileImage && (
                      <img src={editDraft.profileImage} alt="Profile preview" className="h-8 w-8 rounded-full object-cover border" />
                    )}
                  </div>
                  <input
                    id="edit-student-profile-image"
                    type="url"
                    value={editDraft.profileImage ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, profileImage: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 mt-2"
                    placeholder="https://example.com/student-photo.jpg"
                  />
                </div>
                <div>
                  <label htmlFor="edit-student-total-fees" className="mb-1 block text-xs font-medium text-gray-700">Expected Total Fees ({activeCurrencyCode})</label>
                  <input
                    id="edit-student-total-fees"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editDraft.totalFees}
                    onChange={(e) => setEditDraft((d) => ({ ...d, totalFees: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label htmlFor="edit-student-program" className="mb-1 block text-xs font-medium text-gray-700">Program</label>
                  <select
                    id="edit-student-program"
                    value={editDraft.program ?? ''}
                    onChange={(event) => {
                      const nextProgram = event.target.value
                      const curriculum = KIU_CURRICULUM[nextProgram]
                      setEditDraft((d) => {
                        const units = (curriculum && d.semester) ? curriculum.semesters[d.semester] : null
                        return {
                          ...d,
                          program: nextProgram,
                          course: curriculum ? curriculum.defaultCourse : d.course,
                          courseUnitsText: units ? units.map(u => u.unitName).join('\n') : (nextProgram ? '' : d.courseUnitsText),
                          exams: units ? createExamsFromCurriculum(units) : (nextProgram ? [] : d.exams)
                        }
                      })
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select Program</option>
                    {KIU_COURSES.map(p => <option key={p} value={p}>{p}</option>)}
                    {editDraft.program && !KIU_COURSES.includes(editDraft.program) && (
                      <option value={editDraft.program}>{editDraft.program} (Current)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-student-college" className="mb-1 block text-xs font-medium text-gray-700">College</label>
                  <select
                    id="edit-student-college"
                    value={editDraft.college ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, college: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select College</option>
                    {KIU_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                    {editDraft.college && !KIU_COLLEGES.includes(editDraft.college) && (
                      <option value={editDraft.college}>{editDraft.college} (Current)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-student-department" className="mb-1 block text-xs font-medium text-gray-700">Department</label>
                  <select
                    id="edit-student-department"
                    value={editDraft.department ?? ''}
                    onChange={(e) => {
                      const nextDept = e.target.value
                      setEditDraft((d) => {
                        const inferredProg = programFromDepartment(nextDept)
                        if (!inferredProg || !KIU_CURRICULUM[inferredProg]) {
                          return { ...d, department: nextDept }
                        }
                        const curriculum = KIU_CURRICULUM[inferredProg]
                        const units = (curriculum && d.semester) ? curriculum.semesters[d.semester] : null
                        return {
                          ...d,
                          department: nextDept,
                          program: inferredProg,
                          course: curriculum.defaultCourse,
                          courseUnitsText: units ? units.map((u) => u.unitName).join('\n') : (inferredProg ? '' : d.courseUnitsText),
                          exams: units ? createExamsFromCurriculum(units) : (inferredProg ? [] : d.exams),
                        }
                      })
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select Department</option>
                    {KIU_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    {editDraft.department && !KIU_DEPARTMENTS.includes(editDraft.department) && (
                      <option value={editDraft.department}>{editDraft.department} (Current)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-student-semester" className="mb-1 block text-xs font-medium text-gray-700">Semester</label>
                  <select
                    id="edit-student-semester"
                    value={editDraft.semester ?? ''}
                    onChange={(e) => {
                      const nextSemester = e.target.value
                      const curriculum = editDraft.program ? KIU_CURRICULUM[editDraft.program] : null
                      setEditDraft((d) => {
                        const units = (curriculum && nextSemester) ? curriculum.semesters[nextSemester] : null
                        return {
                          ...d,
                          semester: nextSemester,
                          courseUnitsText: units ? units.map(u => u.unitName).join('\n') : (nextSemester ? '' : d.courseUnitsText),
                          exams: units ? createExamsFromCurriculum(units) : (nextSemester ? [] : d.exams)
                        }
                      })
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select Semester</option>
                    {KIU_SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                    {editDraft.semester && !KIU_SEMESTERS.includes(editDraft.semester) && (
                      <option value={editDraft.semester}>{editDraft.semester} (Current)</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="edit-student-course-units" className="mb-1 block text-xs font-medium text-gray-700">Course Units</label>
                <textarea
                  id="edit-student-course-units"
                  value={editDraft.courseUnitsText}
                  onChange={(e) => setEditDraft((d) => ({ ...d, courseUnitsText: e.target.value }))}
                  className="min-h-28 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Enter one course unit per line"
                />
                <p className="mt-1 text-xs text-gray-400">One course unit per line. Comma-separated values also work.</p>
              </div>

              {/* Examination Schedule Editor (Automated Units & Venues) */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-blue-800">Assigned Exams (Automated)</h3>
                  <button
                    type="button"
                    onClick={() => setEditDraft((d) => ({ ...d, exams: [...(d.exams ?? []), { id: `exam-${Date.now()}`, title: '', venue: '', examTime: '', examDate: '', seatNumber: '' }] }))}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    + Add Custom Exam
                  </button>
                </div>
                {(!editDraft.exams || editDraft.exams.length === 0) ? (
                  <p className="py-4 text-center text-xs text-blue-400 font-medium">No exams assigned. Select a program and semester above to auto-populate the university schedule.</p>
                ) : (
                  <div className="space-y-3">
                    {editDraft.exams.map((exam, idx) => (
                      <div key={exam.id} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto] items-end rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
                        <div className="flex-1">
                          <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Exam Title</label>
                          <input
                            type="text"
                            value={exam.title}
                            onChange={(e) => {
                              const nextExams = [...(editDraft.exams ?? [])]
                              nextExams[idx] = { ...exam, title: e.target.value }
                              setEditDraft((d) => ({ ...d, exams: nextExams }))
                            }}
                            className="w-full border-b border-gray-100 py-1 text-xs focus:border-blue-400 focus:outline-none"
                            placeholder="Unit Title"
                          />
                        </div>
                        <div className="w-full sm:w-auto">
                          <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Venue</label>
                          <input
                            type="text"
                            value={exam.venue}
                            onChange={(e) => {
                              const nextExams = [...(editDraft.exams ?? [])]
                              nextExams[idx] = { ...exam, venue: e.target.value }
                              setEditDraft((d) => ({ ...d, exams: nextExams }))
                            }}
                            className="w-full border-b border-gray-100 py-1 text-xs focus:border-blue-400 focus:outline-none"
                            placeholder="Venue"
                          />
                        </div>
                        <div className="w-full sm:w-24">
                          <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Time</label>
                          <input
                            type="text"
                            value={exam.examTime}
                            onChange={(e) => {
                              const nextExams = [...(editDraft.exams ?? [])]
                              nextExams[idx] = { ...exam, examTime: e.target.value }
                              setEditDraft((d) => ({ ...d, exams: nextExams }))
                            }}
                            className="w-full border-b border-gray-100 py-1 text-xs focus:border-blue-400 focus:outline-none"
                            placeholder="09:00 AM"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextExams = (editDraft.exams ?? []).filter((_, i) => i !== idx)
                            setEditDraft((d) => ({ ...d, exams: nextExams }))
                          }}
                          className="rounded p-1 text-red-400 hover:bg-red-50"
                          aria-label="Remove exam"
                          title="Remove exam"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void handleDeleteStudent()}
                  disabled={deletingStudentId === editingStudent.id || savingEdit}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {deletingStudentId === editingStudent.id ? 'Removing\u2026' : 'Remove Student'}
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setUnsavedLeaveIntent('edit')}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {savingEdit ? 'Saving\u2026' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {showCreateStudent && (
        <div
          className={`fixed inset-0 ${DIALOG_Z.modalBackdrop} flex items-center justify-center bg-black/40 p-4`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-create-student-title"
        >
          <div className={`relative ${DIALOG_Z.modalContent} max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl`}>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 id="admin-create-student-title" className="text-base font-semibold text-gray-900">Add New Student</h2>
              <button
                type="button"
                title="Close add student dialog"
                aria-label="Close add student dialog"
                onClick={() => setUnsavedLeaveIntent('create')}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(event) => void handleCreateStudent(event)} className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="create-student-name" className="mb-1 block text-xs font-medium text-gray-700">Username</label>
                  <input
                    id="create-student-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={createDraft.name}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label htmlFor="create-student-email" className="mb-1 block text-xs font-medium text-gray-700">Email (auto-generated)</label>
                  <input
                    id="create-student-email"
                    type="email"
                    required
                    readOnly
                    value={buildSystemStudentEmail(createDraft.name)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label htmlFor="create-student-password" className="mb-1 block text-xs font-medium text-gray-700">Initial Password</label>
                  <div className="flex gap-2">
                    <input
                      id="create-student-password"
                      type="text"
                      required
                      minLength={8}
                      maxLength={128}
                      value={createDraft.password}
                      onChange={(event) => {
                        setCreateDraft((current) => ({ ...current, password: event.target.value }))
                        setCreatePasswordGenerated(false)
                      }}
                      placeholder="e.g. Permit@2027"
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateTemporaryPassword}
                      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Generate
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Generate a temporary password automatically or enter one manually.</p>
                  <p className="mt-1 text-xs text-gray-500">Use uppercase, lowercase, number, and special character. Example: Permit@2027</p>
                </div>
                <div>
                  <label htmlFor="create-student-id" className="mb-1 block text-xs font-medium text-gray-700">Registration No.</label>
                  <input
                    id="create-student-id"
                    type="text"
                    required
                    maxLength={80}
                    value={createDraft.studentId}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, studentId: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="e.g. STU-001"
                  />
                </div>
                <div>
                  <label htmlFor="create-student-enrollment-status" className="mb-1 block text-xs font-medium text-gray-700">Enrollment Status</label>
                  <select
                    id="create-student-enrollment-status"
                    value={createDraft.enrollmentStatus ?? 'active'}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, enrollmentStatus: event.target.value as 'active' | 'on_leave' | 'graduated' }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="create-student-program-core" className="mb-1 block text-xs font-medium text-gray-700">Program</label>
                  <select
                    id="create-student-program-core"
                    required
                    value={createDraft.program ?? ''}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, program: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select Program</option>
                    {KIU_COURSES.map((program) => <option key={program} value={program}>{program}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="create-student-phone" className="mb-1 block text-xs font-medium text-gray-700">Phone Number</label>
                  <input
                    id="create-student-phone"
                    type="tel"
                    value={createDraft.phoneNumber ?? ''}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, phoneNumber: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="e.g. +256700123456"
                  />
                </div>
                <div>
                  <label htmlFor="create-student-year" className="mb-1 block text-xs font-medium text-gray-700">Current Year of Study</label>
                  <select
                    id="create-student-year"
                    required
                    value={createDraft.currentYearOfStudy}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, currentYearOfStudy: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select Year</option>
                    {YEAR_OF_STUDY_OPTIONS.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="create-student-semester" className="mb-1 block text-xs font-medium text-gray-700">Semester</label>
                  <select
                    id="create-student-semester"
                    required
                    value={createDraft.semester ?? ''}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, semester: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select Semester</option>
                    {KIU_SEMESTERS.map((semester) => <option key={semester} value={semester}>{semester}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="create-student-department-core" className="mb-1 block text-xs font-medium text-gray-700">Department</label>
                  <select
                    id="create-student-department-core"
                    required
                    value={createDraft.department ?? ''}
                    onChange={(event) => setCreateDraft((current) => ({ ...current, department: event.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Select Department</option>
                    {KIU_DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUnsavedLeaveIntent('create')}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCreate}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingCreate ? 'Creating...' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </>
  )
}

