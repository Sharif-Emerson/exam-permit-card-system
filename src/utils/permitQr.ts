import type { StudentProfile } from '../types'

/**
 * Build a human-readable QR payload that any QR scanner can display offline
 * without needing an internet connection.
 *
 * All key permit details are embedded as plain text so invigilators can
 * verify a student's permit by simply scanning it with any camera app.
 */
export function buildPermitQrPayload(student: StudentProfile): string {
  const cleared = student.feesBalance <= 0

  const lines: string[] = [
    'KIU EXAM PERMIT',
    `Name: ${student.name}`,
    `ID: ${student.studentId || 'N/A'}`,
    `Course: ${student.course}`,
  ]

  if (student.semester) {
    lines.push(`Semester: ${student.semester}`)
  }

  if (student.department) {
    lines.push(`Dept: ${student.department}`)
  }

  lines.push(`Status: ${cleared ? 'CLEARED' : 'OUTSTANDING'}`)
  lines.push(`Token: ${student.permitToken}`)

  return lines.join('\n')
}
