const templateContent = [
  ['student_id', 'email', 'amount_paid', 'total_fees'],
  ['STU001', 'student1@example.com', '1500.00', '3000.00'],
  ['STU002', 'student2@example.com', '3000.00', '3000.00'],
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