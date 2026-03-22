import { ChangeEvent, DragEvent, FormEvent, ReactNode, useEffect, useState } from 'react'
import {
  BarChart2, Bell, CheckCircle2, CreditCard, Download, FileCheck,
  FileSpreadsheet, FileUp, LayoutDashboard, LogOut, Menu,
  Pencil, QrCode, RefreshCcw, Save, Search, Settings, Shield, Upload, Users, X,
} from 'lucide-react'
import BrandMark from './BrandMark'
import { useAuth } from '../context/AuthContext'
import { downloadFinancialImportTemplate } from '../services/adminImportTemplate'
import { downloadPermitActivityCsv } from '../services/permitActivityExport'
import { adminUpdateStudentProfile, clearStudentBalance, fetchAdminActivityLogs, fetchAllStudentProfiles, importStudentFinancials, updateStudentFinancials } from '../services/profileService'
import { parseFinancialSpreadsheet } from '../services/spreadsheetImport'
import type { AdminActivityLog, AdminProfileUpdateInput, FinancialImportRow, FinancialImportUpdate, StudentProfile } from '../types'

type PaymentDrafts = Record<string, string>
type ImportPreviewRow = {
  rowNumber: number
  matcher: string
  amountPaid?: number
  totalFees?: number
  status: 'ready' | 'skipped'
  reason?: string
  studentName?: string
}
type NavSection = 'dashboard' | 'students' | 'permits' | 'import' | 'reports' | 'permit-cards' | 'settings'

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

export default function AdminPanel() {
  const { user, signOut } = useAuth()
  const [students, setStudents] = useState<StudentProfile[]>([])
  const [paymentDrafts, setPaymentDrafts] = useState<PaymentDrafts>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([])
  const [pendingImportUpdates, setPendingImportUpdates] = useState<FinancialImportUpdate[]>([])
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([])
  const [showPrintedOnly, setShowPrintedOnly] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [activeSection, setActiveSection] = useState<NavSection>('students')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'outstanding'>('all')
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null)
  const [editDraft, setEditDraft] = useState<Omit<AdminProfileUpdateInput, 'totalFees'> & { totalFees: string }>({
    name: '', email: '', studentId: '', course: '', totalFees: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    void loadStudents()
  }, [])

  async function loadStudents() {
    try {
      setLoading(true)
      setError('')
      const [nextStudents, nextActivityLogs] = await Promise.all([
        fetchAllStudentProfiles(),
        fetchAdminActivityLogs(),
      ])
      setStudents(nextStudents)
      setActivityLogs(nextActivityLogs)
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

  const filteredStudents = visibleStudents
    .filter((s) => {
      if (filterStatus === 'paid') return s.feesBalance === 0
      if (filterStatus === 'outstanding') return s.feesBalance > 0
      return true
    })
    .filter((s) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q)
      )
    })

  const totalStudents = students.length
  const clearedStudents = students.filter((s) => s.feesBalance === 0).length
  const outstandingStudents = students.filter((s) => s.feesBalance > 0).length
  const permitEventCount = permitActivityLogs.length

  const courseBreakdown = students.reduce<Record<string, { total: number; cleared: number }>>((acc, s) => {
    const course = s.course || 'Unknown'
    if (!acc[course]) acc[course] = { total: 0, cleared: 0 }
    acc[course].total++
    if (s.feesBalance === 0) acc[course].cleared++
    return acc
  }, {})
  const courseNames = Object.keys(courseBreakdown)
  const maxCourseCount = Math.max(...courseNames.map((c) => courseBreakdown[c].total), 1)

  function handleExportPermitActivity() {
    if (permitActivityLogs.length === 0) {
      setError('There is no permit activity to export yet.')
      return
    }

    setError('')
    setSuccessMessage('')
    downloadPermitActivityCsv(permitActivityLogs, students)
    setSuccessMessage(`Exported ${permitActivityLogs.length} permit activity row(s).`)
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

  function handleEditStudent(student: StudentProfile) {
    setEditingStudent(student)
    setEditDraft({
      name: student.name,
      email: student.email,
      studentId: student.studentId ?? '',
      course: student.course ?? '',
      totalFees: student.totalFees.toFixed(2),
    })
  }

  async function handleSaveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!editingStudent || !user) {
      return
    }

    const totalFeesNum = Number(editDraft.totalFees)

    if (Number.isNaN(totalFeesNum) || totalFeesNum < 0) {
      setError('Total fees must be a valid positive number.')
      return
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
          course: editDraft.course,
          totalFees: totalFeesNum,
        },
        user.id,
      )
      await loadStudents()
      setSuccessMessage(`Student profile updated for ${editDraft.name}.`)
      setEditingStudent(null)
    } catch (saveError) {
      const nextError = saveError instanceof Error ? saveError.message : 'Unable to update student profile'
      setError(nextError)
    } finally {
      setSavingEdit(false)
    }
  }

  function resolveImportRows(rows: FinancialImportRow[]): { updates: FinancialImportUpdate[]; previewRows: ImportPreviewRow[] } {
    const updates: FinancialImportUpdate[] = []
    const previewRows: ImportPreviewRow[] = []

    for (const row of rows) {
      const matcher = row.studentId ?? row.email ?? row.userId ?? 'Unknown row'
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
          amountPaid: row.amountPaid,
          totalFees: row.totalFees,
          status: 'skipped',
          reason: 'No matching student was found.',
        })
        continue
      }

      updates.push({
        rowNumber: row.rowNumber,
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

    try {
      setImporting(true)
      setError('')
      const importResult = await importStudentFinancials(pendingImportUpdates, user.id)
      await loadStudents()

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
        `Imported ${importResult.updatedCount} student payment updates from ${importFileName}.${
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

  const navItems: { key: NavSection; label: string; icon: ReactNode; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { key: 'students', label: 'Students', icon: <Users className="w-5 h-5" />, badge: outstandingStudents > 0 ? outstandingStudents : undefined },
    { key: 'permits', label: 'Permit Activity', icon: <FileCheck className="w-5 h-5" />, badge: permitEventCount > 0 ? permitEventCount : undefined },
    { key: 'permit-cards', label: 'Permit Cards', icon: <CreditCard className="w-5 h-5" />, badge: clearedStudents > 0 ? clearedStudents : undefined },
    { key: 'import', label: 'Bulk Import', icon: <FileUp className="w-5 h-5" /> },
    { key: 'reports', label: 'Reports', icon: <BarChart2 className="w-5 h-5" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ]

  function navigate(section: NavSection) {
    setActiveSection(section)
    setSidebarOpen(false)
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
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="text-gray-500">Loading student accounts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-white shadow-lg transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none lg:border-r lg:border-gray-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
          <BrandMark
            titleClassName="text-base font-bold text-gray-900 leading-tight"
            subtitleClassName="text-xs text-emerald-600"
          />
          <button
            type="button"
            title="Close sidebar"
            aria-label="Close sidebar"
            className="ml-auto text-gray-400 hover:text-gray-600 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Menu</p>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => navigate(item.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeSection === item.key
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className={activeSection === item.key ? 'text-emerald-600' : 'text-gray-400'}>
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        activeSection === item.key ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
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
        <div className="border-t border-gray-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              {user?.name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{user?.name ?? 'Admin'}</p>
              <p className="text-[11px] text-gray-400">{user?.role === 'admin' ? 'Administrator' : 'Staff'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* â”€â”€ Main area â”€â”€ */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top header */}
        <header className="flex h-16 flex-shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            title="Open sidebar"
            aria-label="Open sidebar"
            className="text-gray-500 hover:text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search */}
          <div className="flex max-w-sm flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <input
              type="text"
              aria-label="Search students"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (activeSection !== 'students') setActiveSection('students')
              }}
              className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                title="Clear search"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* Notification bell */}
            <button type="button" className="relative text-gray-500 hover:text-gray-700" title="Outstanding balances">
              <Bell className="h-5 w-5" />
              {outstandingStudents > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {outstandingStudents > 9 ? '9+' : String(outstandingStudents)}
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => void loadStudents()}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Profile chip */}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                {user?.name?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.name ?? 'Admin'}</span>
            </div>
          </div>
        </header>

        {/* Alert banners */}
        {(error || successMessage) && (
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
          </div>
        )}

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">

          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500">Overview of student clearance and permit status.</p>
              </div>

              {/* Analytics cards */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Total Students</p>
                    <Users className="h-5 w-5 text-blue-400" />
                  </div>
                  <p className="mt-2 text-3xl font-bold text-blue-700">{totalStudents}</p>
                  <p className="mt-1 text-xs text-blue-400">enrolled accounts</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Cleared</p>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="mt-2 text-3xl font-bold text-emerald-700">{clearedStudents}</p>
                  <p className="mt-1 text-xs text-emerald-400">fees fully paid</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Outstanding</p>
                    <FileSpreadsheet className="h-5 w-5 text-amber-400" />
                  </div>
                  <p className="mt-2 text-3xl font-bold text-amber-700">{outstandingStudents}</p>
                  <p className="mt-1 text-xs text-amber-400">balance remaining</p>
                </div>
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Permit Events</p>
                    <FileCheck className="h-5 w-5 text-purple-400" />
                  </div>
                  <p className="mt-2 text-3xl font-bold text-purple-700">{permitEventCount}</p>
                  <p className="mt-1 text-xs text-purple-400">prints &amp; downloads</p>
                </div>
              </div>

              {/* Recent permit activity table */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <h2 className="font-semibold text-gray-800">Recent Permit Activity</h2>
                  <button
                    type="button"
                    onClick={handleExportPermitActivity}
                    disabled={permitActivityLogs.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
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
              </div>

              {/* Quick navigation tiles */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {navItems
                  .filter((n) => n.key !== 'dashboard')
                  .map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => navigate(item.key)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <span className="text-emerald-600">{item.icon}</span>
                      <span className="text-xs font-medium text-gray-700">{item.label}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STUDENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeSection === 'students' && (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Students</h1>
                  <p className="text-sm text-gray-500">{filteredStudents.length} student(s) shown</p>
                </div>
                <button
                  type="button"
                  onClick={handleExportPermitActivity}
                  disabled={permitActivityLogs.length === 0}
                  className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
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

              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-5 py-3 text-left">Student</th>
                        <th className="px-5 py-3 text-left">Course</th>
                        <th className="px-5 py-3 text-left">Total Fees</th>
                        <th className="px-5 py-3 text-left">Amount Paid</th>
                        <th className="px-5 py-3 text-left">Balance</th>
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
                            </td>
                            <td className="px-5 py-3 text-gray-600">{student.course || '-'}</td>
                            <td className="px-5 py-3 text-gray-700">${student.totalFees.toFixed(2)}</td>
                            <td className="px-5 py-3 font-medium text-green-700">${student.amountPaid.toFixed(2)}</td>
                            <td className="px-5 py-3">
                              <span className={`font-semibold ${student.feesBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                ${student.feesBalance.toFixed(2)}
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
                                  aria-label={`Payment amount for ${student.name}`}
                                  title={`Payment amount for ${student.name}`}
                                  placeholder="0.00"
                                  className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                />
                                <button
                                  type="submit"
                                  disabled={savingId === student.id}
                                  title="Save payment"
                                  className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={savingId === student.id || student.feesBalance === 0}
                                  onClick={() => void handleClear(student)}
                                  title="Clear balance"
                                  className="rounded bg-green-500 p-1.5 text-white hover:bg-green-600 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                              </form>
                                                          <button
                                                            type="button"
                                                            onClick={() => handleEditStudent(student)}
                                                            title="Edit student profile"
                                                            className="rounded bg-blue-500 p-1.5 text-white hover:bg-blue-600"
                                                          >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                          </button>
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
              </div>
            </div>
          )}

          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ PERMIT ACTIVITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeSection === 'permits' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Permit Activity</h1>
                  <p className="text-sm text-gray-500">{permitActivityLogs.length} event(s) tracked</p>
                </div>
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

              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-5 py-3 text-left">Student</th>
                        <th className="px-5 py-3 text-left">Student ID</th>
                        <th className="px-5 py-3 text-left">Action</th>
                        <th className="px-5 py-3 text-left">Time</th>
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
                          </tr>
                        )
                      })}
                      {permitActivityLogs.length === 0 && (
                        <tr>
                          <td className="px-5 py-8 text-center text-gray-400" colSpan={4}>No permit activity has been recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ BULK IMPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className={activeSection !== 'import' ? 'hidden' : 'block'}>
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Bulk Financial Import</h1>
                <p className="text-sm text-gray-500">Upload a .xlsx or .csv file to update student financial data in bulk.</p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <p className="max-w-sm text-sm text-gray-600">
                    Use columns such as{' '}
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">student_id</code> or{' '}
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">email</code>, plus{' '}
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">amount_paid</code> and optional{' '}
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">total_fees</code>.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={downloadFinancialImportTemplate}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      Download Template
                    </button>
                    <label
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${importing ? 'bg-emerald-400' : dragActive ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                      onDragEnter={handleDragEnter}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => void handleDrop(e)}
                    >
                      <Upload className="h-4 w-4" />
                      {importing ? 'Importing...' : dragActive ? 'Drop File Here' : 'Upload Spreadsheet'}
                      <input
                        type="file"
                        accept=".xlsx,.csv"
                        className="hidden"
                        disabled={importing}
                        onChange={(e) => void handleImportFile(e)}
                      />
                    </label>
                  </div>
                </div>

                {importPreviewRows.length > 0 && (
                  <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">Import Preview</h3>
                        <p className="text-xs text-gray-500">
                          {importPreviewRows.length} row(s) from {importFileName}. â€” {pendingImportUpdates.length} row(s) are ready to apply.
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
                          disabled={importing || pendingImportUpdates.length === 0}
                          onClick={() => void handleApplyImport()}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Apply Import
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
                            <th className="px-3 py-2 text-left">Amount Paid</th>
                            <th className="px-3 py-2 text-left">Total Fees</th>
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
                                {typeof row.amountPaid === 'number' ? `$${row.amountPaid.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {typeof row.totalFees === 'number' ? `$${row.totalFees.toFixed(2)}` : '-'}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`rounded px-2 py-1 text-xs font-medium ${row.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {row.status === 'ready' ? 'Ready' : (row.reason ?? 'Skipped')}
                                </span>
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
            </div>
          </div>

          {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ REPORTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {activeSection === 'reports' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Reports &amp; Analytics</h1>
                <p className="text-sm text-gray-500">Financial clearance breakdown and permit issuance trends.</p>
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
                {students.map((student) => {
                  const summary = getStudentPrintSummary(student.id)
                  const cleared = student.feesBalance === 0

                  return (
                    <div
                      key={student.id}
                      className={`rounded-xl border bg-white p-5 shadow-sm ${
                        cleared ? 'border-emerald-200' : 'border-amber-200'
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-400">{student.studentId} - {student.course || 'No course'}</p>
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
                            <span className="text-[10px] font-medium">Balance: ${student.feesBalance.toFixed(2)}</span>
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
                            aria-label={`Payment amount for ${student.name}`}
                            title={`Payment amount for ${student.name}`}
                            placeholder="0.00"
                            className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-300"
                          />
                          <button
                            type="submit"
                            disabled={savingId === student.id}
                            title="Save payment"
                            aria-label={`Save payment for ${student.name}`}
                            className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={savingId === student.id || student.feesBalance === 0}
                            onClick={() => void handleClear(student)}
                            title="Clear balance"
                            aria-label={`Clear balance for ${student.name}`}
                            className="rounded bg-green-500 p-1.5 text-white hover:bg-green-600 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                        <button
                          type="button"
                          onClick={() => handleEditStudent(student)}
                          title="Edit student profile"
                          aria-label={`Edit profile for ${student.name}`}
                          className="rounded bg-blue-500 p-1.5 text-white hover:bg-blue-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mb-3">
                        <div className="mb-1 flex justify-between text-xs text-gray-500">
                          <span>Paid: ${student.amountPaid.toFixed(2)}</span>
                          <span>Total: ${student.totalFees.toFixed(2)}</span>
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
                {students.length === 0 && (
                  <div className="col-span-3 rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400">
                    No students found.
                  </div>
                )}
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

              {/* Account info */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="font-semibold text-gray-800">Account</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Name</p>
                      <p className="text-xs text-gray-400">Display name for this session</p>
                    </div>
                    <p className="text-sm text-gray-900">{user?.name ?? '—'}</p>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <p className="text-xs text-gray-400">Registered account email</p>
                    </div>
                    <p className="text-sm text-gray-900">{user?.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Role</p>
                      <p className="text-xs text-gray-400">Access level for this account</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        user?.role === 'admin'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {user?.role === 'admin' ? 'Administrator' : 'Staff'}
                    </span>
                  </div>
                </div>
              </div>

              {/* System info */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="font-semibold text-gray-800">System</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Backend</p>
                      <p className="text-xs text-gray-400">REST API base URL</p>
                    </div>
                    <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {window.location.hostname === 'localhost' ? 'http://localhost:4000' : '/api'}
                    </code>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Total Students</p>
                      <p className="text-xs text-gray-400">Currently loaded in system</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{totalStudents}</p>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Permit Events Logged</p>
                      <p className="text-xs text-gray-400">Print and download actions tracked</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{permitEventCount}</p>
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="rounded-xl border border-red-200 bg-white shadow-sm">
                <div className="border-b border-red-100 px-6 py-4">
                  <h2 className="font-semibold text-red-700">Session</h2>
                </div>
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Sign out</p>
                      <p className="text-xs text-gray-400">End your current admin session</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


        </main>
      </div>

      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Edit Student Profile</h2>
              <button
                type="button"
                title="Close edit student dialog"
                aria-label="Close edit student dialog"
                onClick={() => setEditingStudent(null)}
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
                  <label htmlFor="edit-student-course" className="mb-1 block text-xs font-medium text-gray-700">Course</label>
                  <input
                    id="edit-student-course"
                    type="text"
                    value={editDraft.course}
                    onChange={(e) => setEditDraft((d) => ({ ...d, course: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="e.g. BSc Computer Science"
                  />
                </div>
                <div>
                  <label htmlFor="edit-student-total-fees" className="mb-1 block text-xs font-medium text-gray-700">Total Fees ($)</label>
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
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
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
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

