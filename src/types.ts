export type Role = 'admin' | 'student'
export type AdminScope = 'super-admin' | 'registrar' | 'finance' | 'operations'
export type StudentCategory = 'local' | 'international'
export type AdminPermission =
  | 'view_students'
  | 'manage_student_profiles'
  | 'manage_financials'
  | 'manage_support_requests'
  | 'view_audit_logs'
  | 'export_reports'
  | 'write_audit_logs'

export interface StudentExam {
  id: string
  title: string
  examDate: string
  examTime: string
  venue: string
  seatNumber: string
}

export interface DatabaseProfileRow {
  id: string
  email: string
  role: Role
  name: string
  student_id: string | null
  student_category?: StudentCategory | null
  phone_number?: string | null
  course: string | null
  program?: string | null
  college?: string | null
  department?: string | null
  semester?: string | null
  course_units_json?: string | null
  course_units?: string[] | null
  exam_date: string | null
  exam_time: string | null
  venue: string | null
  seat_number: string | null
  instructions: string | null
  profile_image: string | null
  permit_token: string | null
  exams_json: string | null
  exams?: StudentExam[] | null
  total_fees: number
  amount_paid: number
}

export interface StudentProfile {
  id: string
  email: string
  role: 'student'
  name: string
  studentId: string
  studentCategory: StudentCategory
  phoneNumber?: string
  course: string
  program?: string
  college?: string
  department?: string
  semester?: string
  courseUnits?: string[]
  examDate: string
  examTime: string
  venue: string
  seatNumber: string
  instructions: string
  profileImage: string
  permitToken: string
  exams: StudentExam[]
  totalFees: number
  amountPaid: number
  feesBalance: number
}

export type StudentListStatusFilter = 'all' | 'paid' | 'outstanding'

export interface StudentListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: StudentListStatusFilter
}

export interface StudentListPage {
  items: StudentProfile[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  totalStudents: number
  clearedStudents: number
  outstandingStudents: number
}

export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved'

export interface SupportRequest {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  registrationNumber: string
  subject: string
  message: string
  status: SupportRequestStatus
  adminReply: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export interface CreateSupportRequestInput {
  subject: string
  message: string
}

export interface SupportRequestUpdateInput {
  status?: SupportRequestStatus
  adminReply?: string
}

export interface SupportContact {
  id: string
  name: string
  email: string
  phoneNumber: string
  scope: AdminScope
}

export interface AdminProfile {
  id: string
  email: string
  role: 'admin'
  name: string
  totalFees: number
  amountPaid: number
  feesBalance: number
}

export type AppProfile = StudentProfile | AdminProfile

export interface AuthUser {
  id: string
  email: string
  role: Role
  name: string
  phoneNumber?: string
  scope?: AdminScope
  permissions?: AdminPermission[]
}

export interface StudentAccountUpdateInput {
  name?: string
  email?: string
  phoneNumber?: string
  currentPassword?: string
  password?: string
  profileImage?: string | null
}

export interface AdminProfileUpdateInput {
  name?: string
  email?: string
  studentId?: string
  studentCategory?: StudentCategory
  phoneNumber?: string
  course?: string
  program?: string
  college?: string
  department?: string
  semester?: string
  courseUnits?: string[]
  profileImage?: string | null
  totalFees?: number
}

export interface CreateStudentInput {
  name: string
  email: string
  password: string
  studentId: string
  studentCategory: StudentCategory
  phoneNumber?: string
  course: string
  program?: string
  college?: string
  department?: string
  semester?: string
  courseUnits?: string[]
  profileImage?: string | null
  totalFees: number
  amountPaid?: number
  instructions?: string
  examDate?: string
  examTime?: string
  venue?: string
  seatNumber?: string
}

export interface FinancialImportRow {
  rowNumber: number
  studentName?: string
  studentId?: string
  studentCategory?: StudentCategory
  email?: string
  userId?: string
  phoneNumber?: string
  course?: string
  program?: string
  college?: string
  department?: string
  semester?: string
  password?: string
  courseUnits?: string[]
  instructions?: string
  examDate?: string
  examTime?: string
  venue?: string
  seatNumber?: string
  amountPaid?: number
  totalFees?: number
}

export type FinancialImportUpdate =
  | {
    rowNumber: number
    action: 'update'
    studentId: string
    amountPaid?: number
    totalFees?: number
  }
  | {
    rowNumber: number
    action: 'create'
    createStudent: CreateStudentInput
  }

export interface FinancialImportResult {
  updatedCount: number
  createdCount: number
  createdStudents: Array<{
    rowNumber: number
    name: string
    email: string
    studentId: string
    password: string
  }>
  skippedRows: Array<{ rowNumber: number; reason: string }>
}

export interface SystemFeeSettings {
  localStudentFee: number
  internationalStudentFee: number
}

export type PermitActivityAction = 'print_permit' | 'download_permit'

export interface PermitActivityRecord {
  id: string
  studentId: string
  action: PermitActivityAction
  semester: string
  source: string
  createdAt: string
}

export interface AdminActivityLog {
  id: string
  adminId: string
  targetProfileId: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}

export interface AdminActivityLogPage {
  items: AdminActivityLog[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}