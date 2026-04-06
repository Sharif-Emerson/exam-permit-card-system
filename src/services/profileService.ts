import { activeDataAdapter } from '../adapters/data'
import { fetchEmailStatus as _fetchEmailStatus, sendTestEmail as _sendTestEmail, fetchSisStatus as _fetchSisStatus, triggerSisSync as _triggerSisSync, fetchPublicPermit as _fetchPublicPermit } from '../adapters/data/restDataAdapter'
import type { EmailStatus, SisStatus, SisSyncResult, PermitScanRecord } from '../adapters/data/restDataAdapter'
import type { FinancialUpdateValues, StudentAccountsImportApplyResult, StudentProvisionPreviewRow } from '../adapters/data/types'
import type {
  AssistantAdminAccount,
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
  SemesterRegistration,
  PublicSupportContact,
  StudentIdentityVerifyResult,
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

export async function markActivityLogRead(logId: string): Promise<void> {
  return activeDataAdapter.markActivityLogRead(logId)
}

export async function markAllPermitActivityLogsRead(): Promise<void> {
  return activeDataAdapter.markAllPermitActivityLogsRead()
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

export async function createSupportRequest(studentId: string, values: CreateSupportRequestInput, attachment?: File | null): Promise<SupportRequest> {
  return activeDataAdapter.createSupportRequest(studentId, values, attachment)
}

export async function updateSupportRequest(requestId: string, values: SupportRequestUpdateInput): Promise<SupportRequest> {
  return activeDataAdapter.updateSupportRequest(requestId, values)
}

export async function sendSupportRequestMessage(requestId: string, message: string, attachment?: File | null): Promise<SupportRequest> {
  return activeDataAdapter.sendSupportRequestMessage(requestId, message, attachment)
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

export async function fetchAssistantAdmins(): Promise<AssistantAdminAccount[]> {
  return activeDataAdapter.fetchAssistantAdmins()
}

export async function createAssistantAdmin(values: { name: string; email: string; phoneNumber?: string; password: string; role: 'support_help' | 'department_prints' | 'invigilator'; departments: string[] }): Promise<AssistantAdminAccount> {
  return activeDataAdapter.createAssistantAdmin(values)
}

export async function updateAssistantAdmin(assistantId: string, values: { role: 'support_help' | 'department_prints' | 'invigilator'; departments: string[] }): Promise<AssistantAdminAccount> {
  return activeDataAdapter.updateAssistantAdmin(assistantId, values)
}

export async function updateAssistantAdminCredentials(assistantId: string, values: { name?: string; email?: string; password?: string }): Promise<AssistantAdminAccount> {
  return activeDataAdapter.updateAssistantAdminCredentials(assistantId, values)
}

export async function fetchSemesterRegistrations(): Promise<SemesterRegistration[]> {
  return activeDataAdapter.fetchSemesterRegistrations()
}

export async function createSemesterRegistration(requestedSemester: string): Promise<SemesterRegistration> {
  return activeDataAdapter.createSemesterRegistration(requestedSemester)
}

export async function updateSemesterRegistration(id: string, values: { status: 'approved' | 'rejected'; adminNote?: string }): Promise<SemesterRegistration> {
  return activeDataAdapter.updateSemesterRegistration(id, values)
}

export async function deleteSemesterRegistration(id: string): Promise<void> {
  return activeDataAdapter.deleteSemesterRegistration(id)
}

export async function deleteSupportRequest(id: string): Promise<void> {
  return activeDataAdapter.deleteSupportRequest(id)
}

export async function advanceAllStudentSemesters(): Promise<{ advanced: number; carryDebt: number; skipped: number }> {
  return activeDataAdapter.advanceAllStudentSemesters()
}

export async function fetchPublicSupportContacts(): Promise<PublicSupportContact[]> {
  return activeDataAdapter.fetchPublicSupportContacts()
}

export async function verifyStudentIdentity(identifier: string, verification: string): Promise<StudentIdentityVerifyResult> {
  return activeDataAdapter.verifyStudentIdentity(identifier, verification)
}

export async function adminResetStudentPassword(studentId: string, newPassword: string): Promise<{ message: string }> {
  return activeDataAdapter.adminResetStudentPassword(studentId, newPassword)
}

export type { EmailStatus, SisStatus, SisSyncResult, PermitScanRecord }

export async function fetchEmailStatus(): Promise<EmailStatus> {
  return _fetchEmailStatus()
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
  return _sendTestEmail(to)
}

export async function fetchSisStatus(): Promise<SisStatus> {
  return _fetchSisStatus()
}

export async function triggerSisSync(): Promise<SisSyncResult> {
  return _triggerSisSync()
}

export async function fetchPublicPermit(token: string): Promise<PermitScanRecord> {
  return _fetchPublicPermit(token)
}