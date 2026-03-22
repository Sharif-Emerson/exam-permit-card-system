import { assertSupabaseConfigured, supabase } from '../supabaseClient'
import type { AppProfile, DatabaseProfileRow, StudentProfile } from '../types'

const profileSelect = `
  id,
  email,
  role,
  name,
  student_id,
  course,
  exam_date,
  exam_time,
  venue,
  seat_number,
  instructions,
  profile_image,
  total_fees,
  amount_paid
`

function mapProfile(row: DatabaseProfileRow): AppProfile {
  const totalFees = Number(row.total_fees ?? 0)
  const amountPaid = Number(row.amount_paid ?? 0)
  const feesBalance = Math.max(totalFees - amountPaid, 0)

  if (row.role === 'admin') {
    return {
      id: row.id,
      email: row.email,
      role: 'admin',
      name: row.name,
      totalFees,
      amountPaid,
      feesBalance,
    }
  }

  return {
    id: row.id,
    email: row.email,
    role: 'student',
    name: row.name,
    studentId: row.student_id ?? 'N/A',
    course: row.course ?? 'Not assigned',
    examDate: row.exam_date ?? 'Not scheduled',
    examTime: row.exam_time ?? 'Not scheduled',
    venue: row.venue ?? 'Not assigned',
    seatNumber: row.seat_number ?? 'Not assigned',
    instructions: row.instructions ?? 'No instructions have been added yet.',
    profileImage: row.profile_image ?? 'https://via.placeholder.com/150',
    totalFees,
    amountPaid,
    feesBalance,
  }
}

export async function fetchProfileById(userId: string): Promise<AppProfile> {
  assertSupabaseConfigured()

  const { data, error } = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('id', userId)
    .single<DatabaseProfileRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapProfile(data)
}

export async function fetchStudentProfileById(userId: string): Promise<StudentProfile> {
  const profile = await fetchProfileById(userId)

  if (profile.role !== 'student') {
    throw new Error('This account does not have a student permit record.')
  }

  return profile
}

export async function fetchAllStudentProfiles(): Promise<StudentProfile[]> {
  assertSupabaseConfigured()

  const { data, error } = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('role', 'student')
    .order('name', { ascending: true })
    .returns<DatabaseProfileRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapProfile).filter((profile): profile is StudentProfile => profile.role === 'student')
}

export async function updateStudentFinancials(
  studentId: string,
  values: { amountPaid?: number; totalFees?: number },
  adminId: string,
) {
  assertSupabaseConfigured()

  const payload: { amount_paid?: number; total_fees?: number } = {}

  if (typeof values.amountPaid === 'number') {
    payload.amount_paid = Number(values.amountPaid.toFixed(2))
  }

  if (typeof values.totalFees === 'number') {
    payload.total_fees = Number(values.totalFees.toFixed(2))
  }

  const { error } = await supabase.from('profiles').update(payload).eq('id', studentId)

  if (error) {
    throw new Error(error.message)
  }

  await logAdminAction(adminId, studentId, 'update_student_financials', payload)
}

export async function clearStudentBalance(studentId: string, adminId: string) {
  const profile = await fetchStudentProfileById(studentId)

  await updateStudentFinancials(
    studentId,
    {
      amountPaid: profile.totalFees,
    },
    adminId,
  )
}

async function logAdminAction(adminId: string, targetProfileId: string, action: string, details: Record<string, number>) {
  const { error } = await supabase.from('admin_activity_logs').insert({
    admin_id: adminId,
    target_profile_id: targetProfileId,
    action,
    details,
  })

  if (error) {
    console.warn('Failed to create admin activity log:', error.message)
  }
}