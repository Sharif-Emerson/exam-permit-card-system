import type { AdminActivityLog, AppProfile, PermitActivityAction, StudentAccountUpdateInput, StudentProfile } from '../../types'

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
  fetchAllStudentProfiles: () => Promise<StudentProfile[]>
  fetchAdminActivityLogs: () => Promise<AdminActivityLog[]>
  updateStudentAccount: (studentId: string, values: StudentAccountUpdateInput) => Promise<StudentProfile>
  updateStudentFinancials: (studentId: string, values: FinancialUpdateValues, adminId: string) => Promise<void>
  clearStudentBalance: (studentId: string, adminId: string) => Promise<void>
  recordPermitActivity: (studentId: string, action: PermitActivityAction) => Promise<void>
}