const templateContent = [
  ['student_name', 'student_id', 'email', 'phone_number', 'course', 'program', 'college', 'department', 'semester', 'password', 'course_units', 'amount_paid', 'total_fees'],
].map((row) => row.join(',')).join('\n')

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