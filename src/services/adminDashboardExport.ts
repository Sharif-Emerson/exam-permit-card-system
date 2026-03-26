import type { AdminActivityLog, StudentProfile } from '../types'

function escapeCsvValue(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function downloadBlob(content: BlobPart, type: string, fileName: string) {
  const blob = new Blob([content], { type })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}

function getStudentRows(students: StudentProfile[]) {
  return students.map((student) => ({
    studentName: student.name,
    studentEmail: student.email,
    studentId: student.studentId,
    course: student.course,
    department: student.department ?? '',
    semester: student.semester ?? '',
    totalFees: student.totalFees.toFixed(2),
    amountPaid: student.amountPaid.toFixed(2),
    remainingBalance: student.feesBalance.toFixed(2),
    permitStatus: student.feesBalance === 0 ? 'Issued' : 'Pending',
  }))
}

function getActivityRows(activityLogs: AdminActivityLog[], students: StudentProfile[]) {
  const studentLookup = new Map(students.map((student) => [student.id, student]))

  return activityLogs.map((log) => {
    const student = studentLookup.get(log.targetProfileId)

    return {
      studentName: student?.name ?? log.targetProfileId,
      studentId: student?.studentId ?? '',
      action: log.action,
      source: typeof log.details.source === 'string' ? log.details.source : '',
      createdAt: log.createdAt,
    }
  })
}

export function downloadAdminDashboardCsv(students: StudentProfile[], activityLogs: AdminActivityLog[]) {
  const studentRows = getStudentRows(students)
  const activityRows = getActivityRows(activityLogs, students)

  const csvContent = [
    ['student_name', 'student_email', 'student_id', 'course', 'department', 'semester', 'total_fees', 'amount_paid', 'remaining_balance', 'permit_status'],
    ...studentRows.map((row) => Object.values(row)),
    [],
    ['activity_student_name', 'activity_student_id', 'activity_action', 'activity_source', 'activity_created_at'],
    ...activityRows.map((row) => Object.values(row)),
  ]
    .map((row) => row.map((value) => escapeCsvValue(String(value ?? ''))).join(','))
    .join('\n')

  downloadBlob(csvContent, 'text/csv;charset=utf-8', 'admin-dashboard-report.csv')
}

export function downloadAdminDashboardExcel(students: StudentProfile[], activityLogs: AdminActivityLog[]) {
  const studentRows = getStudentRows(students)
  const activityRows = getActivityRows(activityLogs, students)

  const studentTable = studentRows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.studentName)}</td>
        <td>${escapeHtml(row.studentEmail)}</td>
        <td>${escapeHtml(row.studentId)}</td>
        <td>${escapeHtml(row.course)}</td>
        <td>${escapeHtml(row.department)}</td>
        <td>${escapeHtml(row.semester)}</td>
        <td>${escapeHtml(row.totalFees)}</td>
        <td>${escapeHtml(row.amountPaid)}</td>
        <td>${escapeHtml(row.remainingBalance)}</td>
        <td>${escapeHtml(row.permitStatus)}</td>
      </tr>
    `)
    .join('')

  const activityTable = activityRows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.studentName)}</td>
        <td>${escapeHtml(row.studentId)}</td>
        <td>${escapeHtml(row.action)}</td>
        <td>${escapeHtml(row.source)}</td>
        <td>${escapeHtml(row.createdAt)}</td>
      </tr>
    `)
    .join('')

  const workbook = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <title>Admin Dashboard Report</title>
      </head>
      <body>
        <h2>Student Summary</h2>
        <table border="1">
          <tr>
            <th>Student Name</th>
            <th>Student Email</th>
            <th>Student ID</th>
            <th>Course</th>
            <th>Department</th>
            <th>Semester</th>
            <th>Total Fees</th>
            <th>Amount Paid</th>
            <th>Remaining Balance</th>
            <th>Permit Status</th>
          </tr>
          ${studentTable}
        </table>
        <h2>Recent Activity</h2>
        <table border="1">
          <tr>
            <th>Student Name</th>
            <th>Student ID</th>
            <th>Action</th>
            <th>Source</th>
            <th>Created At</th>
          </tr>
          ${activityTable}
        </table>
      </body>
    </html>
  `

  downloadBlob(workbook, 'application/vnd.ms-excel;charset=utf-8', 'admin-dashboard-report.xls')
}

export function printAdminDashboardReport(students: StudentProfile[], activityLogs: AdminActivityLog[]) {
  const studentRows = getStudentRows(students)
  const activityRows = getActivityRows(activityLogs, students).slice(0, 20)

  const studentTable = studentRows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.studentName)}</td>
        <td>${escapeHtml(row.studentId)}</td>
        <td>${escapeHtml(row.course)}</td>
        <td>${escapeHtml(row.amountPaid)}</td>
        <td>${escapeHtml(row.remainingBalance)}</td>
        <td>${escapeHtml(row.permitStatus)}</td>
      </tr>
    `)
    .join('')

  const activityTable = activityRows
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.studentName)}</td>
        <td>${escapeHtml(row.action)}</td>
        <td>${escapeHtml(row.source)}</td>
        <td>${escapeHtml(row.createdAt)}</td>
      </tr>
    `)
    .join('')

  const clearedCount = students.filter((student) => student.feesBalance === 0).length
  const outstandingCount = students.filter((student) => student.feesBalance > 0).length

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Admin Dashboard Report</title>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
          h1, h2 { margin-bottom: 8px; }
          p { color: #475569; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 28px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 12px; }
          th { background: #e2e8f0; }
          .summary { display: flex; gap: 12px; margin: 18px 0 10px; flex-wrap: wrap; }
          .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; min-width: 140px; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; }
          .value { font-size: 22px; font-weight: bold; color: #0f172a; }
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
            🖨️ Print / Save as PDF
          </button>
          <button onclick="window.parent.closePrintOverlay()" style="padding: 10px 20px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-left: 10px;">
            ✕ Close
          </button>
        </div>
        <h1>Admin Dashboard Report</h1>
        <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
        <div class="summary">
          <div class="card"><div class="label">Students</div><div class="value">${students.length}</div></div>
          <div class="card"><div class="label">Cleared</div><div class="value">${clearedCount}</div></div>
          <div class="card"><div class="label">Outstanding</div><div class="value">${outstandingCount}</div></div>
          <div class="card"><div class="label">Activity</div><div class="value">${activityLogs.length}</div></div>
        </div>
        <h2>Student Summary</h2>
        <table>
          <tr>
            <th>Name</th>
            <th>Student ID</th>
            <th>Course</th>
            <th>Amount Paid</th>
            <th>Balance</th>
            <th>Status</th>
          </tr>
          ${studentTable}
        </table>
        <h2>Recent Activity</h2>
        <table>
          <tr>
            <th>Student</th>
            <th>Action</th>
            <th>Source</th>
            <th>Created At</th>
          </tr>
          ${activityTable}
        </table>
        <div class="no-print" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #cbd5e1;">
          <p style="font-size: 12px; color: #64748b;">
            <strong>Tip:</strong> Click the print button above or press <kbd style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px;">Ctrl+P</kbd> (Windows) or <kbd style="background: #e2e8f0; padding: 2px 6px; border-radius: 3px;">⌘+P</kbd> (Mac) to save as PDF.
          </p>
        </div>
      </body>
    </html>
  `

  // Create an overlay iframe instead of opening a new window (avoids popup blockers)
  const overlay = document.createElement('div')
  overlay.id = 'print-overlay'
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  const iframe = document.createElement('iframe')
  iframe.style.cssText = `
    width: 90%;
    height: 90%;
    border: none;
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  `

  overlay.appendChild(iframe)
  document.body.appendChild(overlay)

  // Write content to iframe
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(overlay)
    throw new Error('Unable to create print preview')
  }

  iframeDoc.open()
  iframeDoc.write(htmlContent)
  iframeDoc.close()

  // Add close function to window for the close button
  ;(window as any).closePrintOverlay = () => {
    document.body.removeChild(overlay)
  }

  // Auto-trigger print after content loads
  iframe.contentWindow?.focus()
  setTimeout(() => {
    iframe.contentWindow?.print()
  }, 500)
}