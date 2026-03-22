import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, LogOut, RefreshCcw, Save, Upload } from 'lucide-react'
import BrandMark from './BrandMark'
import { useAuth } from '../context/AuthContext'
import { downloadFinancialImportTemplate } from '../services/adminImportTemplate'
import { downloadPermitActivityCsv } from '../services/permitActivityExport'
import { clearStudentBalance, fetchAdminActivityLogs, fetchAllStudentProfiles, importStudentFinancials, updateStudentFinancials } from '../services/profileService'
import { parseFinancialSpreadsheet } from '../services/spreadsheetImport'
import type { AdminActivityLog, FinancialImportRow, FinancialImportUpdate, StudentProfile } from '../types'

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

function getActivityTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
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
            <BrandMark
              titleClassName="text-2xl sm:text-3xl font-bold text-gray-900"
              subtitleClassName="text-sm text-slate-600"
            />
            <p className="mt-3 text-sm text-slate-600">Student clearance control</p>
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
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Recent Permit Activity</h2>
                <p className="text-sm text-slate-600">Students who have printed or downloaded permits.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                  {permitActivityLogs.length} tracked event(s)
                </span>
                <button
                  type="button"
                  onClick={handleExportPermitActivity}
                  disabled={permitActivityLogs.length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {permitActivityLogs.slice(0, 8).map((log) => {
                    const student = students.find((entry) => entry.id === log.targetProfileId)
                    return (
                      <tr key={log.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{student?.name ?? log.targetProfileId}</td>
                        <td className="px-3 py-2">{log.action === 'print_permit' ? 'Printed permit' : 'Downloaded permit'}</td>
                        <td className="px-3 py-2">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</td>
                      </tr>
                    )
                  })}
                  {permitActivityLogs.length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-slate-500" colSpan={3}>No permit activity has been recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-medium">
                  <FileSpreadsheet className="h-4 w-4" />
                  Bulk Financial Import
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Upload a .xlsx or .csv file with columns such as <strong>student_id</strong> or <strong>email</strong>, plus <strong>amount_paid</strong> and optional <strong>total_fees</strong>.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={downloadFinancialImportTemplate}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </button>
                <label
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${importing ? 'bg-slate-400' : dragActive ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} cursor-pointer`}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(event) => void handleDrop(event)}
                >
                  <Upload className="h-4 w-4" />
                  {importing ? 'Importing...' : dragActive ? 'Drop File Here' : 'Upload Spreadsheet'}
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    disabled={importing}
                    onChange={(event) => void handleImportFile(event)}
                  />
                </label>
              </div>
            </div>
            {importPreviewRows.length > 0 && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Import Preview</h3>
                    <p className="text-xs text-slate-600">
                      Reviewing {importPreviewRows.length} row(s) from {importFileName}. {pendingImportUpdates.length} row(s) are ready to apply.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={clearImportPreview}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
                    >
                      Clear Preview
                    </button>
                    <button
                      type="button"
                      disabled={importing || pendingImportUpdates.length === 0}
                      onClick={() => void handleApplyImport()}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      Apply Import
                    </button>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Match Key</th>
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2">Amount Paid</th>
                        <th className="px-3 py-2">Total Fees</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.slice(0, 12).map((row) => (
                        <tr key={`${row.rowNumber}-${row.matcher}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2">{row.matcher}</td>
                          <td className="px-3 py-2">{row.studentName ?? '-'}</td>
                          <td className="px-3 py-2">{typeof row.amountPaid === 'number' ? `$${row.amountPaid.toFixed(2)}` : '-'}</td>
                          <td className="px-3 py-2">{typeof row.totalFees === 'number' ? `$${row.totalFees.toFixed(2)}` : '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded px-2 py-1 text-xs font-medium ${row.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {row.status === 'ready' ? 'Ready' : row.reason ?? 'Skipped'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreviewRows.length > 12 && (
                    <p className="mt-2 text-xs text-slate-500">Showing the first 12 rows in the preview.</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg sm:text-xl">Students</h2>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showPrintedOnly}
                onChange={(event) => setShowPrintedOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
              Show printed students only
            </label>
          </div>
          <div className="space-y-3 sm:space-y-2">
            {visibleStudents.map(student => (
              <div key={student.id} className="p-4 sm:p-5 bg-gray-50 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const printSummary = getStudentPrintSummary(student.id)

                      return (
                        <>
                    <div className="font-medium text-sm sm:text-base truncate">{student.name}</div>
                    <div className="text-xs sm:text-sm text-gray-600 mb-2">ID: {student.id} | {student.email}</div>
                    <div className="text-xs sm:text-sm text-gray-600 mb-2">
                      Permit activity: {printSummary.total === 0
                        ? 'No print/download activity yet'
                        : `${printSummary.printCount} print(s), ${printSummary.downloadCount} download(s), last ${printSummary.lastAction === 'print_permit' ? 'print' : 'download'} on ${printSummary.lastAt ? new Date(printSummary.lastAt).toLocaleString() : 'unknown time'}`}
                    </div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${printSummary.hasPrinted ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
                        {printSummary.hasPrinted ? `Printed ${printSummary.printCount}x` : 'Not printed'}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${printSummary.downloadCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                        {printSummary.downloadCount > 0 ? `Downloaded ${printSummary.downloadCount}x` : 'Not downloaded'}
                      </span>
                    </div>
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
                        </>
                      )
                    })()}
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
            {visibleStudents.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                {showPrintedOnly ? 'No students have printed a permit yet.' : 'No students found.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}