import type {
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
  SupportRequest,
  SupportRequestUpdateInput,
} from '../../types'

export interface FinancialUpdateValues {
  amountPaid?: number
  totalFees?: number
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
  fetchSystemFeeSettings: () => Promise<SystemFeeSettings>
  updateSystemFeeSettings: (values: SystemFeeSettings) => Promise<SystemFeeSettings>
  createStudentProfile: (values: CreateStudentInput, adminId: string) => Promise<StudentProfile>
  updateStudentAccount: (studentId: string, values: StudentAccountUpdateInput) => Promise<AppProfile>
  adminUpdateStudentProfile: (studentId: string, values: AdminProfileUpdateInput, adminId: string) => Promise<StudentProfile>
  updateStudentFinancials: (studentId: string, values: FinancialUpdateValues, adminId: string) => Promise<void>
  clearStudentBalance: (studentId: string, adminId: string) => Promise<void>
  deleteStudentProfile: (studentId: string, adminId: string) => Promise<void>
  restoreStudentProfile: (trashId: string, adminId: string) => Promise<StudentProfile>
  grantStudentPermitPrintAccess: (studentId: string, additionalPrints: number, adminId: string) => Promise<StudentProfile>
  recordPermitActivity: (studentId: string, action: PermitActivityAction) => Promise<void>
  fetchPermitActivityHistory: () => Promise<PermitActivityRecord[]>
  fetchSupportContacts: () => Promise<SupportContact[]>
  fetchSupportRequests: () => Promise<SupportRequest[]>
  createSupportRequest: (studentId: string, values: CreateSupportRequestInput) => Promise<SupportRequest>
  updateSupportRequest: (requestId: string, values: SupportRequestUpdateInput) => Promise<SupportRequest>
}