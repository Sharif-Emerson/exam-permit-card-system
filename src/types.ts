export type Role = 'admin' | 'student'
export type AdminScope = 'super-admin' | 'registrar' | 'finance' | 'operations' | 'assistant-admin'
export type StudentCategory = 'local' | 'international'
export type StudentGender = 'male' | 'female' | 'other'
export type EnrollmentStatus = 'active' | 'on_leave' | 'graduated'
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
  enrollment_status?: EnrollmentStatus | null
  gender?: StudentGender | null
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
  monthly_print_count?: number | null
  monthly_print_limit?: number | null
  granted_prints_remaining?: number | null
  can_print_permit?: boolean | null
  print_access_message?: string | null
  total_fees: number
  amount_paid: number
  first_login_required?: number | null
}

export interface StudentProfile {
  id: string
  email: string
  role: 'student'
  name: string
  studentId: string
  studentCategory: StudentCategory
  gender?: StudentGender
  enrollmentStatus?: EnrollmentStatus
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
  permitSignature?: string
  exams: StudentExam[]
  monthlyPrintCount?: number
  monthlyPrintLimit?: number
  grantedPrintsRemaining?: number
  canPrintPermit?: boolean
  printAccessMessage?: string
  permitPrintsUsedThisMonth?: number
  permitPrintsRemainingThisMonth?: number
  permitPrintGrantMonth?: string
  permitPrintGrantsRemaining?: number
  totalFees: number
  amountPaid: number
  feesBalance: number
  firstLoginRequired?: boolean
}

export type StudentListStatusFilter = 'all' | 'paid' | 'outstanding'

export interface StudentListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: StudentListStatusFilter
  department?: string
  program?: string
  course?: string
  college?: string
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

export interface TrashedStudentProfile {
  id: string
  profileId: string
  role: 'student'
  name: string
  email: string
  studentId?: string
  deletedAt: string
  purgeAfterAt: string
  deletedByAdminId?: string | null
  restoredAt?: string | null
  restoredByAdminId?: string | null
}

export type SupportRequestStatus = 'open' | 'in_progress' | 'resolved'

export interface SupportRequestMessage {
  id: string
  requestId: string
  senderRole: 'student' | 'admin'
  senderId: string
  message: string
  attachmentName?: string
  attachmentUrl?: string
  attachmentMimeType?: string
  attachmentSizeBytes?: number
  createdAt: string
}

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
  messages?: SupportRequestMessage[]
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

export interface SemesterRegistration {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  registrationNumber: string
  requestedSemester: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string
  resolvedByAdminId?: string | null
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminProfile {
  id: string
  email: string
  role: 'admin'
  name: string
  phoneNumber?: string
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
  assistantRole?: 'support_help' | 'department_prints'
  assistantDepartments?: string[]
  permissions?: AdminPermission[]
  firstLoginRequired?: boolean
}

export interface AssistantAdminAccount {
  id: string
  name: string
  email: string
  phoneNumber: string
  role: 'support_help' | 'department_prints'
  departments: string[]
  firstLoginRequired: boolean
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
  gender?: StudentGender
  phoneNumber?: string
  course?: string
  program?: string
  college?: string
  department?: string
  semester?: string
  courseUnits?: string[]
  profileImage?: string | null
  totalFees?: number
  /** Profile-level exam announcement (shown on permit when unit rows are still placeholders). */
  examDate?: string | null
  examTime?: string | null
  venue?: string | null
  seatNumber?: string | null
  instructions?: string | null
  exams?: StudentExam[]
}

export interface CreateStudentInput {
  name: string
  email: string
  password: string
  studentId: string
  studentCategory: StudentCategory
  gender?: StudentGender
  enrollmentStatus?: EnrollmentStatus
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
  exams?: StudentExam[]
}

export interface FinancialImportRow {
  rowNumber: number;
  studentName?: string;
  studentId?: string;
  email?: string;
  userId?: string;
  amountPaid?: number;
  totalFees?: number;
}

export type FinancialImportUpdate = {
  rowNumber: number;
  action: 'update';
  studentId: string;
  amountPaid?: number;
  totalFees?: number;
};

export interface FinancialImportResult {
  updatedCount: number;
  createdCount?: number;
  createdStudents?: number[];
  skippedRows: Array<{ rowNumber: number; reason: string }>;
}

export interface UniversityDeadline {
  id: string
  title: string
  subtitle: string
  dateLabel: string // e.g., "In 14 Days" or "August 1st"
  type: 'danger' | 'info' | 'warning'
  /** Optional ISO datetime for live countdown on student dashboards */
  dueAt?: string
}

export interface SystemFeeSettings {
  localStudentFee: number
  internationalStudentFee: number
  currencyCode?: string
  deadlines?: UniversityDeadline[]
}

export type PermitActivityAction = 'print_permit' | 'download_permit' | 'create_permit' | 'view_permit'

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
  isRead: boolean
  createdAt: string
}

export interface AdminActivityLogPage {
  items: AdminActivityLog[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}