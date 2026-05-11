import { describe, expect, it } from 'vitest'
import { parseFinancialSpreadsheet } from './spreadsheetImport'

describe('parseFinancialSpreadsheet', () => {
  it('parses the downloaded financial template CSV (underscored headers)', async () => {
    const csv = 'student_name,student_id_or_email,amount_paid,total_fees\nJane Student,REG001,1000,4500\n'
    const file = new File([csv], 'student-financial-import-template.csv', { type: 'text/csv' })
    const rows = await parseFinancialSpreadsheet(file)
    expect(rows).toHaveLength(1)
    expect(rows[0].studentName).toBe('Jane Student')
    expect(rows[0].studentId).toBe('REG001')
    expect(rows[0].amountPaid).toBe(1000)
    expect(rows[0].totalFees).toBe(4500)
  })

  it('accepts separate student_id and email columns', async () => {
    const csv = 'student_name,student_id,email,amount_paid,total_fees\nJane,REG-002,jane@example.edu,500,3000\n'
    const file = new File([csv], 'export.csv', { type: 'text/csv' })
    const rows = await parseFinancialSpreadsheet(file)
    expect(rows).toHaveLength(1)
    expect(rows[0].studentId).toBe('REG-002')
    expect(rows[0].email).toBe('jane@example.edu')
  })

  it('reads combined column when value is an email', async () => {
    const csv = 'student_name,student_id_or_email,amount_paid,total_fees\nBob,bob@uni.edu,0,6000\n'
    const file = new File([csv], 't.csv', { type: 'text/csv' })
    const rows = await parseFinancialSpreadsheet(file)
    expect(rows).toHaveLength(1)
    expect(rows[0].email).toBe('bob@uni.edu')
    expect(rows[0].studentId).toBeUndefined()
  })
})
