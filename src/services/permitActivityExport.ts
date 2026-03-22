import type { AdminActivityLog, StudentProfile } from '../types'

function escapeCsvValue(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function formatPermitAction(action: string) {
  if (action === 'print_permit') {
    return 'Printed permit'
  }

  if (action === 'download_permit') {
    return 'Downloaded permit'
  }

  return action
}

export function downloadPermitActivityCsv(activityLogs: AdminActivityLog[], students: StudentProfile[]) {
  const studentLookup = new Map(students.map((student) => [student.id, student]))
  const rows = activityLogs.map((log) => {
    const student = studentLookup.get(log.targetProfileId)
    const source = typeof log.details.source === 'string' ? log.details.source : ''

    return [
      student?.name ?? '',
      student?.email ?? '',
      student?.studentId ?? '',
      formatPermitAction(log.action),
      log.createdAt,
      source,
    ]
  })

  const csvContent = [
    ['student_name', 'student_email', 'student_id', 'action', 'created_at', 'source'],
    ...rows,
  ]
    .map((row) => row.map((value) => escapeCsvValue(String(value ?? ''))).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = 'permit-activity.csv'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}