function mapRowsToFinancialImportRows(rows: unknown[][]): FinancialImportRow[] {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];
  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(String(cell ?? '')));
  return dataRows
    .map((row, index) => {
      const normalizedEntries = normalizedHeaders.reduce<Record<string, unknown>>((result, header, columnIndex) => {
        if (header) {
          result[header] = row[columnIndex] ?? '';
        }
        return result;
      }, {});
      const studentName = typeof normalizedEntries.student_name === 'string' && normalizedEntries.student_name.trim()
        ? normalizedEntries.student_name.trim()
        : undefined;
      let studentId: string | undefined = undefined;
      let email: string | undefined = undefined;
      if (typeof normalizedEntries.student_id_or_email === 'string') {
        const value = normalizedEntries.student_id_or_email.trim();
        if (value.includes('@')) {
          email = value;
        } else if (value) {
          studentId = value;
        }
      }
      const amountPaid = parseNumber(normalizedEntries.amount_paid);
      const totalFees = parseNumber(normalizedEntries.total_fees);
      return {
        rowNumber: index + 2,
        studentName,
        studentId,
        email,
        amountPaid,
        totalFees,
      };
    })
    .filter((row) => {
      // Only allow updates, not creation
      const hasId = row.studentId || row.email;
      const canUpdate = hasId && (typeof row.amountPaid === 'number' || typeof row.totalFees === 'number');
      return Boolean(canUpdate);
    });
}
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

// parseList function kept for future use
// function parseList(value: unknown): string[] | undefined {
//   if (typeof value !== 'string' || !value.trim()) {
//     return undefined;
//   }
//   const items = value
//     .split(/\r?\n|,|;/)
//     .map((item) => item.trim())
//     .filter(Boolean);
//   return items.length > 0 ? items : undefined;
// }

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