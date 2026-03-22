import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/browser'
import type { FinancialImportRow } from '../types'

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseNumber(value: unknown): number | undefined {
  if (value == null || value === '') {
    return undefined
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isFinite(numericValue) ? numericValue : undefined
}

function mapRowsToFinancialImportRows(rows: unknown[][]): FinancialImportRow[] {
  const [headerRow, ...dataRows] = rows

  if (!headerRow) {
    return []
  }

  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(String(cell ?? '')))

  return dataRows
    .map((row, index) => {
      const normalizedEntries = normalizedHeaders.reduce<Record<string, unknown>>((result, header, columnIndex) => {
        if (header) {
          result[header] = row[columnIndex] ?? ''
        }

        return result
      }, {})

      const studentId = typeof normalizedEntries.studentid === 'string' && normalizedEntries.studentid.trim()
        ? normalizedEntries.studentid.trim()
        : undefined
      const email = typeof normalizedEntries.email === 'string' && normalizedEntries.email.trim()
        ? normalizedEntries.email.trim()
        : undefined
      const userId = typeof normalizedEntries.id === 'string' && normalizedEntries.id.trim()
        ? normalizedEntries.id.trim()
        : typeof normalizedEntries.userid === 'string' && normalizedEntries.userid.trim()
          ? normalizedEntries.userid.trim()
          : undefined

      const amountPaid = parseNumber(
        normalizedEntries.amountpaid ?? normalizedEntries.paid ?? normalizedEntries.amount,
      )
      const totalFees = parseNumber(
        normalizedEntries.totalfees ?? normalizedEntries.fees ?? normalizedEntries.total,
      )

      return {
        rowNumber: index + 2,
        studentId,
        email,
        userId,
        amountPaid,
        totalFees,
      }
    })
    .filter((row) => (row.studentId || row.email || row.userId) && (typeof row.amountPaid === 'number' || typeof row.totalFees === 'number'))
}

async function parseCsvFile(file: File) {
  const csvText = await file.text()
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  })

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message || 'Unable to parse the uploaded CSV file.')
  }

  return mapRowsToFinancialImportRows(result.data)
}

async function parseXlsxFile(file: File) {
  const rows = await readXlsxFile(file)
  return mapRowsToFinancialImportRows(rows as unknown[][])
}

export async function parseFinancialSpreadsheet(file: File): Promise<FinancialImportRow[]> {
  const normalizedName = file.name.trim().toLowerCase()

  if (normalizedName.endsWith('.csv')) {
    return parseCsvFile(file)
  }

  if (normalizedName.endsWith('.xlsx')) {
    return parseXlsxFile(file)
  }

  if (normalizedName.endsWith('.xls')) {
    throw new Error('Legacy .xls files are not supported. Save the file as .xlsx or .csv and try again.')
  }

  throw new Error('Unsupported file type. Upload a .xlsx or .csv file.')
}