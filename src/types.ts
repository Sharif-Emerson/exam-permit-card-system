export type Role = 'admin' | 'student'

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