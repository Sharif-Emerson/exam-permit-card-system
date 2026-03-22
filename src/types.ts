export type Role = 'admin' | 'student'

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
  course: string | null
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
  course: string
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
}

export interface StudentAccountUpdateInput {
  name?: string
  email?: string
  password?: string
  profileImage?: string | null
}

export interface FinancialImportRow {
  rowNumber: number
  studentId?: string
  email?: string
  userId?: string
  amountPaid?: number
  totalFees?: number
}

export interface FinancialImportUpdate {
  rowNumber: number
  studentId: string
  amountPaid?: number
  totalFees?: number
}

export interface FinancialImportResult {
  updatedCount: number
  skippedRows: Array<{ rowNumber: number; reason: string }>
}

export type PermitActivityAction = 'print_permit' | 'download_permit'

export interface AdminActivityLog {
  id: string
  adminId: string
  targetProfileId: string
  action: string
  details: Record<string, unknown>
  createdAt: string
}