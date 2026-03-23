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

function parseList(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  const items = value
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
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
      const studentName = typeof normalizedEntries.studentname === 'string' && normalizedEntries.studentname.trim()
        ? normalizedEntries.studentname.trim()
        : undefined
      const email = typeof normalizedEntries.email === 'string' && normalizedEntries.email.trim()
        ? normalizedEntries.email.trim()
        : undefined
      const phoneNumber = typeof normalizedEntries.phonenumber === 'string' && normalizedEntries.phonenumber.trim()
        ? normalizedEntries.phonenumber.trim()
        : typeof normalizedEntries.phone === 'string' && normalizedEntries.phone.trim()
          ? normalizedEntries.phone.trim()
          : undefined
      const course = typeof normalizedEntries.course === 'string' && normalizedEntries.course.trim()
        ? normalizedEntries.course.trim()
        : undefined
      const program = typeof normalizedEntries.program === 'string' && normalizedEntries.program.trim()
        ? normalizedEntries.program.trim()
        : undefined
      const college = typeof normalizedEntries.college === 'string' && normalizedEntries.college.trim()
        ? normalizedEntries.college.trim()
        : undefined
      const department = typeof normalizedEntries.department === 'string' && normalizedEntries.department.trim()
        ? normalizedEntries.department.trim()
        : undefined
      const semester = typeof normalizedEntries.semester === 'string' && normalizedEntries.semester.trim()
        ? normalizedEntries.semester.trim()
        : undefined
      const password = typeof normalizedEntries.password === 'string' && normalizedEntries.password.trim()
        ? normalizedEntries.password.trim()
        : undefined
      const courseUnits = parseList(normalizedEntries.courseunits ?? normalizedEntries.units)
      const instructions = typeof normalizedEntries.instructions === 'string' && normalizedEntries.instructions.trim()
        ? normalizedEntries.instructions.trim()
        : undefined
      const examDate = typeof normalizedEntries.examdate === 'string' && normalizedEntries.examdate.trim()
        ? normalizedEntries.examdate.trim()
        : undefined
      const examTime = typeof normalizedEntries.examtime === 'string' && normalizedEntries.examtime.trim()
        ? normalizedEntries.examtime.trim()
        : undefined
      const venue = typeof normalizedEntries.venue === 'string' && normalizedEntries.venue.trim()
        ? normalizedEntries.venue.trim()
        : undefined
      const seatNumber = typeof normalizedEntries.seatnumber === 'string' && normalizedEntries.seatnumber.trim()
        ? normalizedEntries.seatnumber.trim()
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
        studentName,
        studentId,
        email,
        userId,
        phoneNumber,
        course,
        program,
        college,
        department,
        semester,
        password,
        courseUnits,
        instructions,
        examDate,
        examTime,
        venue,
        seatNumber,
        amountPaid,
        totalFees,
      }
    })
    .filter((row) => {
      const canUpdate = (row.studentId || row.email || row.userId) && (typeof row.amountPaid === 'number' || typeof row.totalFees === 'number')
      const canCreate = row.studentName && row.studentId && row.email && row.course && typeof row.totalFees === 'number'
      return Boolean(canUpdate || canCreate)
    })
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