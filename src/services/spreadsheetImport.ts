/** Read a cell using the same header normalization as column keys (underscores/spaces stripped). */
function getField(entries: Record<string, unknown>, ...headerAliases: string[]): unknown {
  for (const alias of headerAliases) {
    const key = normalizeHeader(alias)
    if (!key || !(key in entries)) {
      continue
    }
    const value = entries[key]
    if (value !== '' && value != null) {
      return value
    }
  }
  return undefined
}

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
      const studentNameRaw = getField(normalizedEntries, 'student_name', 'name', 'full_name');
      const studentName = typeof studentNameRaw === 'string' && studentNameRaw.trim()
        ? studentNameRaw.trim()
        : undefined;
      let studentId: string | undefined = undefined;
      let email: string | undefined = undefined;
      let userId: string | undefined = undefined;

      const combinedRaw = getField(normalizedEntries, 'student_id_or_email');
      if (typeof combinedRaw === 'string') {
        const value = combinedRaw.trim();
        if (value.includes('@')) {
          email = value.toLowerCase();
        } else if (value) {
          studentId = value;
        }
      }

      const emailCol = getField(normalizedEntries, 'email', 'e_mail');
      if (!email && typeof emailCol === 'string' && emailCol.trim().includes('@')) {
        email = emailCol.trim().toLowerCase();
      }

      const sidRaw = getField(normalizedEntries, 'student_id', 'registration_number', 'reg_number', 'student_number');
      if (!studentId && typeof sidRaw === 'string' && sidRaw.trim()) {
        studentId = sidRaw.trim();
      }

      const userIdRaw = getField(normalizedEntries, 'user_id', 'profile_id');
      if (typeof userIdRaw === 'string' && userIdRaw.trim()) {
        userId = userIdRaw.trim();
      }

      const amountPaid = parseNumber(getField(normalizedEntries, 'amount_paid', 'paid', 'payment'));
      const totalFees = parseNumber(getField(normalizedEntries, 'total_fees', 'fees', 'tuition'));
      return {
        rowNumber: index + 2,
        studentName,
        studentId,
        email,
        userId,
        amountPaid,
        totalFees,
      };
    })
    .filter((row) => {
      // Only allow updates, not creation
      const hasId = Boolean(row.studentId || row.email || row.userId);
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