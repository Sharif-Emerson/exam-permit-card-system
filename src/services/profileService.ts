import { activeDataAdapter } from '../adapters/data'
import type { FinancialUpdateValues } from '../adapters/data/types'
import type { AdminActivityLog, AppProfile, FinancialImportResult, FinancialImportUpdate, PermitActivityAction, StudentAccountUpdateInput, StudentProfile } from '../types'

export function getDataConfigError() {
  return activeDataAdapter.getConfigError()
}

export async function fetchProfileById(userId: string): Promise<AppProfile> {
  return activeDataAdapter.fetchProfileById(userId)
}

export async function fetchStudentProfileById(userId: string): Promise<StudentProfile> {
  return activeDataAdapter.fetchStudentProfileById(userId)
}

export async function fetchAllStudentProfiles(): Promise<StudentProfile[]> {
  return activeDataAdapter.fetchAllStudentProfiles()
}

export async function fetchAdminActivityLogs(): Promise<AdminActivityLog[]> {
  return activeDataAdapter.fetchAdminActivityLogs()
}

export async function updateStudentAccount(studentId: string, values: StudentAccountUpdateInput): Promise<StudentProfile> {
  return activeDataAdapter.updateStudentAccount(studentId, values)
}

export async function updateStudentFinancials(studentId: string, values: FinancialUpdateValues, adminId: string) {
  return activeDataAdapter.updateStudentFinancials(studentId, values, adminId)
}

export async function clearStudentBalance(studentId: string, adminId: string) {
  return activeDataAdapter.clearStudentBalance(studentId, adminId)
}

export async function recordPermitActivity(studentId: string, action: PermitActivityAction) {
  return activeDataAdapter.recordPermitActivity(studentId, action)
}

export async function importStudentFinancials(updates: FinancialImportUpdate[], adminId: string): Promise<FinancialImportResult> {
  let updatedCount = 0
  const skippedRows: FinancialImportResult['skippedRows'] = []

  for (const update of updates) {
    try {
      await activeDataAdapter.updateStudentFinancials(
        update.studentId,
        {
          amountPaid: update.amountPaid,
          totalFees: update.totalFees,
        },
        adminId,
      )
      updatedCount += 1
    } catch (error) {
      skippedRows.push({
        rowNumber: update.rowNumber,
        reason: error instanceof Error ? error.message : 'Unable to import this row',
      })
    }
  }

  return { updatedCount, skippedRows }
}