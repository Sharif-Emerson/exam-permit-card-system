const studentAccountsTemplateContent = [
  ['student_name', 'student_id', 'email', 'course', 'total_fees', 'password', 'password_hash', 'student_category', 'program', 'college', 'department', 'semester'],
  ['Jane Student', 'REG-2026-001', 'jane.student@university.edu', 'BSc Software Engineering', '3000', '', '', 'local', '', '', '', ''],
].map((row) => row.join(',')).join('\n')

export function downloadStudentAccountsImportTemplate() {
  const blob = new Blob([studentAccountsTemplateContent], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'student-accounts-import-template.csv'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}

const templateContent = [
  ['student_name', 'student_id_or_email', 'amount_paid', 'total_fees'],
  ['Jane Student', 'REG001', '1000', '4500'],
].map((row) => row.join(',')).join('\n');

export function downloadFinancialImportTemplate() {
  const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'student-financial-import-template.csv'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}