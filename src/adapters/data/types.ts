import type {
  AssistantAdminAccount,
  AdminActivityLog,
  AdminActivityLogPage,
  AdminProfileUpdateInput,
  AppProfile,
  CreateStudentInput,
  CreateSupportRequestInput,
  PermitActivityRecord,
  PermitActivityAction,
  StudentAccountUpdateInput,
  SystemFeeSettings,
  StudentListPage,
  StudentListQuery,
  StudentProfile,
  TrashedStudentProfile,
  SupportContact,
  SemesterRegistration,
  SupportRequest,
  SupportRequestUpdateInput,
  PublicSupportContact,
  StudentIdentityVerifyResult,
} from '../../types'

export interface FinancialUpdateValues {
  amountPaid?: number
  totalFees?: number
}

export type BulkCurriculumSyncFailure = { id: string; reason: string }

export type BulkCurriculumSyncResult = {
  updated: number
  failed: BulkCurriculumSyncFailure[]
  totalStudents: number
}

export type StudentProvisionPreviewRow = {
  rowNumber: number
  studentName?: string
  studentId?: string
  email?: string
  course?: string
  status: 'create' | 'skipped'
  reason?: string
  totalFees?: number
}

export type StudentAccountsImportApplyResult = {
  createdCount: number
  createdStudents: Array<{
    rowNumber: number
    name: string
    email: string
    studentId: string
    password?: string
  }>
  skippedRows: Array<{ rowNumber: number; reason: string }>
}

export interface DataAdapter {
  provider: string
  isConfigured: boolean
  getConfigError: () => string | null
  fetchProfileById: (userId: string) => Promise<AppProfile>
  fetchStudentProfileById: (userId: string) => Promise<StudentProfile>
  fetchStudentProfilesPage: (query?: StudentListQuery) => Promise<StudentListPage>
  fetchTrashedStudentProfiles: () => Promise<TrashedStudentProfile[]>
  fetchAdminActivityLogs: () => Promise<AdminActivityLog[]>
  fetchAdminActivityLogsPage: (query?: { page?: number; pageSize?: number }) => Promise<AdminActivityLogPage>
  deleteAdminActivityLog: (logId: string) => Promise<void>
  purgePermitActivityLogs: () => Promise<number>
  markActivityLogRead: (logId: string) => Promise<void>
  markAllPermitActivityLogsRead: () => Promise<void>
  fetchSystemFeeSettings: () => Promise<SystemFeeSettings>
  updateSystemFeeSettings: (values: SystemFeeSettings) => Promise<SystemFeeSettings>
  createStudentProfile: (values: CreateStudentInput, adminId: string) => Promise<StudentProfile>
  updateStudentAccount: (studentId: string, values: StudentAccountUpdateInput) => Promise<AppProfile>
  adminUpdateStudentProfile: (studentId: string, values: AdminProfileUpdateInput, adminId: string) => Promise<StudentProfile>
  updateStudentFinancials: (studentId: string, values: FinancialUpdateValues, adminId: string) => Promise<void>
  clearStudentBalance: (studentId: string, adminId: string) => Promise<void>
  deleteStudentProfile: (studentId: string, adminId: string) => Promise<void>
  restoreStudentProfile: (trashId: string, adminId: string) => Promise<StudentProfile>
  permanentlyDeleteTrashedStudent: (trashId: string) => Promise<void>
  permanentlyPurgeAllTrashedStudents: () => Promise<number>
  grantStudentPermitPrintAccess: (studentId: string, additionalPrints: number, adminId: string) => Promise<StudentProfile>
  recordPermitActivity: (studentId: string, action: PermitActivityAction) => Promise<void>
  fetchPermitActivityHistory: () => Promise<PermitActivityRecord[]>
  fetchSupportContacts: () => Promise<SupportContact[]>
  fetchSupportRequests: () => Promise<SupportRequest[]>
  createSupportRequest: (studentId: string, values: CreateSupportRequestInput, attachment?: File | null) => Promise<SupportRequest>
  updateSupportRequest: (requestId: string, values: SupportRequestUpdateInput) => Promise<SupportRequest>
  sendSupportRequestMessage: (requestId: string, message: string, attachment?: File | null) => Promise<SupportRequest>
  bulkSyncCurriculum: () => Promise<BulkCurriculumSyncResult>
  previewStudentAccountsImport: (file: File) => Promise<StudentProvisionPreviewRow[]>
  applyStudentAccountsImport: (file: File) => Promise<StudentAccountsImportApplyResult>
  fetchAssistantAdmins: () => Promise<AssistantAdminAccount[]>
  createAssistantAdmin: (values: { name: string; email: string; phoneNumber?: string; password: string; role: 'support_help' | 'department_prints'; departments: string[] }) => Promise<AssistantAdminAccount>
  updateAssistantAdmin: (assistantId: string, values: { role: 'support_help' | 'department_prints'; departments: string[] }) => Promise<AssistantAdminAccount>
  updateAssistantAdminCredentials: (assistantId: string, values: { name?: string; email?: string; password?: string }) => Promise<AssistantAdminAccount>
  fetchSemesterRegistrations: () => Promise<SemesterRegistration[]>
  createSemesterRegistration: (requestedSemester: string) => Promise<SemesterRegistration>
  updateSemesterRegistration: (id: string, values: { status: 'approved' | 'rejected'; adminNote?: string }) => Promise<SemesterRegistration>
  deleteSupportRequest: (id: string) => Promise<void>
  advanceAllStudentSemesters: () => Promise<{ advanced: number; carryDebt: number; skipped: number }>
  fetchPublicSupportContacts: () => Promise<PublicSupportContact[]>
  verifyStudentIdentity: (identifier: string, verification: string) => Promise<StudentIdentityVerifyResult>
  adminResetStudentPassword: (studentId: string, newPassword: string) => Promise<{ message: string }>
}