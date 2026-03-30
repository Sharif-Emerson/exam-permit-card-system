import { activeDataAdapter } from '../adapters/data'
import type { FinancialUpdateValues, StudentAccountsImportApplyResult, StudentProvisionPreviewRow } from '../adapters/data/types'
import type {
  AdminActivityLog,
  AdminActivityLogPage,
  AdminProfileUpdateInput,
  AppProfile,
  CreateStudentInput,
  CreateSupportRequestInput,
  FinancialImportResult,
  FinancialImportUpdate,
  SupportContact,
  PermitActivityRecord,
  PermitActivityAction,
  StudentAccountUpdateInput,
  StudentListPage,
  StudentListQuery,
  StudentProfile,
  SystemFeeSettings,
  TrashedStudentProfile,
  SupportRequest,
  SupportRequestUpdateInput,
} from '../types'

export function getDataConfigError() {
  return activeDataAdapter.getConfigError()
}

export async function fetchProfileById(userId: string): Promise<AppProfile> {
  return activeDataAdapter.fetchProfileById(userId)
}

export async function fetchStudentProfileById(userId: string): Promise<StudentProfile> {
  return activeDataAdapter.fetchStudentProfileById(userId)
}

export async function fetchStudentProfilesPage(query?: StudentListQuery): Promise<StudentListPage> {
  return activeDataAdapter.fetchStudentProfilesPage(query)
}

export async function fetchTrashedStudentProfiles(): Promise<TrashedStudentProfile[]> {
  return activeDataAdapter.fetchTrashedStudentProfiles()
}

export async function fetchAdminActivityLogs(): Promise<AdminActivityLog[]> {
  return activeDataAdapter.fetchAdminActivityLogs()
}

export async function fetchAdminActivityLogsPage(query?: { page?: number; pageSize?: number }): Promise<AdminActivityLogPage> {
  return activeDataAdapter.fetchAdminActivityLogsPage(query)
}

export async function deleteAdminActivityLog(logId: string): Promise<void> {
  return activeDataAdapter.deleteAdminActivityLog(logId)
}

export async function purgePermitActivityLogs(): Promise<number> {
  return activeDataAdapter.purgePermitActivityLogs()
}

export async function fetchSystemFeeSettings(): Promise<SystemFeeSettings> {
  return activeDataAdapter.fetchSystemFeeSettings()
}

export async function updateSystemFeeSettings(values: SystemFeeSettings): Promise<SystemFeeSettings> {
  return activeDataAdapter.updateSystemFeeSettings(values)
}

export async function createStudentProfile(values: CreateStudentInput, adminId: string): Promise<StudentProfile> {
  return activeDataAdapter.createStudentProfile(values, adminId)
}

export async function updateStudentAccount(studentId: string, values: StudentAccountUpdateInput): Promise<AppProfile> {
  return activeDataAdapter.updateStudentAccount(studentId, values)
}

export async function adminUpdateStudentProfile(studentId: string, values: AdminProfileUpdateInput, adminId: string): Promise<StudentProfile> {
  return activeDataAdapter.adminUpdateStudentProfile(studentId, values, adminId)
}

export async function updateStudentFinancials(studentId: string, values: FinancialUpdateValues, adminId: string) {
  return activeDataAdapter.updateStudentFinancials(studentId, values, adminId)
}

export async function clearStudentBalance(studentId: string, adminId: string) {
  return activeDataAdapter.clearStudentBalance(studentId, adminId)
}

export async function deleteStudentProfile(studentId: string, adminId: string) {
  return activeDataAdapter.deleteStudentProfile(studentId, adminId)
}

export async function restoreStudentProfile(trashId: string, adminId: string): Promise<StudentProfile> {
  return activeDataAdapter.restoreStudentProfile(trashId, adminId)
}

export async function permanentlyDeleteTrashedStudent(trashId: string): Promise<void> {
  return activeDataAdapter.permanentlyDeleteTrashedStudent(trashId)
}

export async function permanentlyPurgeAllTrashedStudents(): Promise<number> {
  return activeDataAdapter.permanentlyPurgeAllTrashedStudents()
}

export async function grantStudentPermitPrintAccess(studentId: string, additionalPrints: number, adminId: string): Promise<StudentProfile> {
  return activeDataAdapter.grantStudentPermitPrintAccess(studentId, additionalPrints, adminId)
}

export async function recordPermitActivity(studentId: string, action: PermitActivityAction) {
  return activeDataAdapter.recordPermitActivity(studentId, action)
}

export async function fetchPermitActivityHistory(): Promise<PermitActivityRecord[]> {
  return activeDataAdapter.fetchPermitActivityHistory()
}

export async function fetchSupportContacts(): Promise<SupportContact[]> {
  return activeDataAdapter.fetchSupportContacts()
}

export async function fetchSupportRequests(): Promise<SupportRequest[]> {
  return activeDataAdapter.fetchSupportRequests()
}

export async function createSupportRequest(studentId: string, values: CreateSupportRequestInput): Promise<SupportRequest> {
  return activeDataAdapter.createSupportRequest(studentId, values)
}

export async function updateSupportRequest(requestId: string, values: SupportRequestUpdateInput): Promise<SupportRequest> {
  return activeDataAdapter.updateSupportRequest(requestId, values)
}

export async function importStudentFinancials(updates: FinancialImportUpdate[], adminId: string): Promise<FinancialImportResult> {
  let updatedCount = 0
  let createdCount = 0
  const createdStudents: FinancialImportResult['createdStudents'] = []
  const skippedRows: FinancialImportResult['skippedRows'] = []

  for (const update of updates) {
    try {
      if (update.action === 'update') {
        await activeDataAdapter.updateStudentFinancials(
          update.studentId,
          {
            amountPaid: update.amountPaid,
            totalFees: update.totalFees,
          },
          adminId,
        )
        updatedCount += 1
        continue
      }

      // Creation of new students via import is disabled. Only updates to existing students are allowed.
    } catch (error) {
      skippedRows.push({
        rowNumber: update.rowNumber,
        reason: error instanceof Error ? error.message : 'Unable to import this row',
      })
    }
  }

  return { updatedCount, createdCount, createdStudents, skippedRows }
}

export async function bulkSyncCurriculum() {
  return activeDataAdapter.bulkSyncCurriculum()
}

export async function previewStudentAccountsImport(file: File): Promise<StudentProvisionPreviewRow[]> {
  return activeDataAdapter.previewStudentAccountsImport(file)
}

export async function applyStudentAccountsImport(file: File): Promise<StudentAccountsImportApplyResult> {
  return activeDataAdapter.applyStudentAccountsImport(file)
}