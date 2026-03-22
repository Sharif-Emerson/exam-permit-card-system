import { apiBaseUrl } from '../../config/provider'
import type { AdminActivityLog, AdminProfileUpdateInput, AppProfile, DatabaseProfileRow, PermitActivityAction, StudentAccountUpdateInput, StudentExam, StudentProfile } from '../../types'
import { getStoredAuthToken } from '../rest/tokenStorage'
import { ensureStudentProfile, mapProfile } from '../shared/profileMapper'
import type { DataAdapter, FinancialUpdateValues } from './types'

function getConfigError() {
  return apiBaseUrl ? null : 'REST API is not configured. Add VITE_API_BASE_URL to your .env file.'
}

async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    return null
  }

  return response.json()
}

async function request(path: string, init?: RequestInit) {
  const token = getStoredAuthToken()
  const headers = new Headers(init?.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers })
  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return payload
}

function toDatabaseProfileRow(payload: unknown): DatabaseProfileRow {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The API returned an invalid profile payload.')
  }

  const record = payload as Record<string, unknown>

  const role = record.role === 'admin' ? 'admin' : 'student'

  const exams = Array.isArray(record.exams)
    ? record.exams.filter((exam): exam is StudentExam => typeof exam === 'object' && exam !== null).map((exam, index) => ({
      id: typeof exam.id === 'string' ? exam.id : `exam-${index + 1}`,
      title: typeof exam.title === 'string' ? exam.title : `Exam ${index + 1}`,
      examDate: typeof exam.examDate === 'string' ? exam.examDate : '',
      examTime: typeof exam.examTime === 'string' ? exam.examTime : '',
      venue: typeof exam.venue === 'string' ? exam.venue : '',
      seatNumber: typeof exam.seatNumber === 'string' ? exam.seatNumber : '',
    }))
    : null

  return {
    id: String(record.id ?? ''),
    email: String(record.email ?? ''),
    role,
    name: String(record.name ?? ''),
    student_id: record.student_id == null ? (record.studentId == null ? null : String(record.studentId)) : String(record.student_id),
    course: record.course == null ? null : String(record.course),
    exam_date: record.exam_date == null ? (record.examDate == null ? null : String(record.examDate)) : String(record.exam_date),
    exam_time: record.exam_time == null ? (record.examTime == null ? null : String(record.examTime)) : String(record.exam_time),
    venue: record.venue == null ? null : String(record.venue),
    seat_number: record.seat_number == null ? (record.seatNumber == null ? null : String(record.seatNumber)) : String(record.seat_number),
    instructions: record.instructions == null ? null : String(record.instructions),
    profile_image: record.profile_image == null ? (record.profileImage == null ? null : String(record.profileImage)) : String(record.profile_image),
    permit_token: record.permit_token == null ? (record.permitToken == null ? null : String(record.permitToken)) : String(record.permit_token),
    exams_json: typeof record.exams_json === 'string'
      ? record.exams_json
      : exams
        ? JSON.stringify(exams)
        : null,
    exams,
    total_fees: Number(record.total_fees ?? record.totalFees ?? 0),
    amount_paid: Number(record.amount_paid ?? record.amountPaid ?? 0),
  }
}

function extractCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>

    if (Array.isArray(record.data)) {
      return record.data
    }

    if (Array.isArray(record.items)) {
      return record.items
    }
  }

  return []
}

function toAdminActivityLog(payload: unknown): AdminActivityLog {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The API returned an invalid activity payload.')
  }

  const record = payload as Record<string, unknown>

  return {
    id: String(record.id ?? ''),
    adminId: String(record.admin_id ?? record.adminId ?? ''),
    targetProfileId: String(record.target_profile_id ?? record.targetProfileId ?? ''),
    action: String(record.action ?? ''),
    details: record.details && typeof record.details === 'object' ? record.details as Record<string, unknown> : {},
    createdAt: String(record.created_at ?? record.createdAt ?? ''),
  }
}

async function logAdminAction(adminId: string, targetProfileId: string, details: Record<string, number>) {
  await request('/admin-activity-logs', {
    method: 'POST',
    body: JSON.stringify({
      admin_id: adminId,
      target_profile_id: targetProfileId,
      action: 'update_student_financials',
      details,
    }),
  })
}

export const restDataAdapter: DataAdapter = {
  provider: 'rest',
  isConfigured: Boolean(apiBaseUrl),
  getConfigError,
  async fetchProfileById(userId: string): Promise<AppProfile> {
    const payload = await request(`/profiles/${userId}`, { method: 'GET' })
    return mapProfile(toDatabaseProfileRow(payload))
  },
  async fetchStudentProfileById(userId: string): Promise<StudentProfile> {
    return ensureStudentProfile(await this.fetchProfileById(userId))
  },
  async fetchAllStudentProfiles(): Promise<StudentProfile[]> {
    const payload = await request('/profiles?role=student', { method: 'GET' })
    return extractCollection(payload)
      .map(toDatabaseProfileRow)
      .map(mapProfile)
      .filter((profile): profile is StudentProfile => profile.role === 'student')
  },
  async fetchAdminActivityLogs(): Promise<AdminActivityLog[]> {
    const payload = await request('/admin-activity-logs', { method: 'GET' })
    return extractCollection(payload).map(toAdminActivityLog)
  },
  async updateStudentAccount(studentId: string, values: StudentAccountUpdateInput): Promise<StudentProfile> {
    const payload = await request(`/profiles/${studentId}/account`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    })

    return ensureStudentProfile(mapProfile(toDatabaseProfileRow(payload)))
  },
  async adminUpdateStudentProfile(studentId: string, values: AdminProfileUpdateInput, adminId: string): Promise<StudentProfile> {
    const payload: Record<string, unknown> = {}
    if (typeof values.name === 'string') payload.name = values.name
    if (typeof values.email === 'string') payload.email = values.email
    if (typeof values.studentId === 'string') payload.student_id = values.studentId || null
    if (typeof values.course === 'string') payload.course = values.course || null
    if (typeof values.totalFees === 'number') payload.total_fees = Number(values.totalFees.toFixed(2))

    const result = await request(`/profiles/${studentId}/admin`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })

    try {
      await logAdminAction(adminId, studentId, { ...(typeof values.totalFees === 'number' && { totalFees: values.totalFees }) })
    } catch {
      // Ignore audit logging failures
    }

    return ensureStudentProfile(mapProfile(toDatabaseProfileRow(result)))
  },
  async updateStudentFinancials(studentId: string, values: FinancialUpdateValues, adminId: string) {
    const payload: Record<string, number> = {}

    if (typeof values.amountPaid === 'number') {
      payload.amountPaid = Number(values.amountPaid.toFixed(2))
    }

    if (typeof values.totalFees === 'number') {
      payload.totalFees = Number(values.totalFees.toFixed(2))
    }

    await request(`/profiles/${studentId}/financials`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })

    try {
      await logAdminAction(adminId, studentId, payload)
    } catch {
      // Ignore audit logging failures so the financial update itself succeeds.
    }
  },
  async clearStudentBalance(studentId: string, adminId: string) {
    const profile = await this.fetchStudentProfileById(studentId)
    await this.updateStudentFinancials(studentId, { amountPaid: profile.totalFees }, adminId)
  },
  async recordPermitActivity(studentId: string, action: PermitActivityAction) {
    await request('/permit-activity', {
      method: 'POST',
      body: JSON.stringify({ studentId, action }),
    })
  },
}