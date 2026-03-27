import { apiBaseUrl } from '../../config/provider'
import type {
  AdminActivityLog,
  AdminActivityLogPage,
  AdminProfileUpdateInput,
  AppProfile,
  CreateStudentInput,
  CreateSupportRequestInput,
  DatabaseProfileRow,
  PermitActivityAction,
  PermitActivityRecord,
  StudentAccountUpdateInput,
  StudentExam,
  StudentListPage,
  StudentListQuery,
  StudentProfile,
  TrashedStudentProfile,
  SupportContact,
  SystemFeeSettings,
  SupportRequest,
  SupportRequestUpdateInput,
} from '../../types'
import { requestWithApiFallback } from '../rest/request'
import { getStoredAuthToken } from '../rest/tokenStorage'
import { ensureStudentProfile, mapProfile } from '../shared/profileMapper'
import type { DataAdapter, FinancialUpdateValues } from './types'

function getConfigError() {
  return apiBaseUrl ? null : 'REST API is not configured. Add VITE_API_BASE_URL to your .env file.'
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

  return requestWithApiFallback(path, { ...init, headers })
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
    student_category: record.student_category === 'international' || record.studentCategory === 'international' ? 'international' : 'local',
    phone_number: record.phone_number == null ? (record.phoneNumber == null ? null : String(record.phoneNumber)) : String(record.phone_number),
    course: record.course == null ? null : String(record.course),
    program: record.program == null ? null : String(record.program),
    college: record.college == null ? null : String(record.college),
    department: record.department == null ? null : String(record.department),
    semester: record.semester == null ? null : String(record.semester),
    course_units_json: typeof record.course_units_json === 'string' ? record.course_units_json : null,
    course_units: Array.isArray(record.course_units)
      ? record.course_units.filter((unit): unit is string => typeof unit === 'string')
      : null,
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
    monthly_print_count: record.monthly_print_count == null ? (record.monthlyPrintCount == null ? null : Number(record.monthlyPrintCount)) : Number(record.monthly_print_count),
    monthly_print_limit: record.monthly_print_limit == null ? (record.monthlyPrintLimit == null ? null : Number(record.monthlyPrintLimit)) : Number(record.monthly_print_limit),
    granted_prints_remaining: record.granted_prints_remaining == null ? (record.grantedPrintsRemaining == null ? null : Number(record.grantedPrintsRemaining)) : Number(record.granted_prints_remaining),
    can_print_permit: typeof record.can_print_permit === 'boolean' ? record.can_print_permit : typeof record.canPrintPermit === 'boolean' ? record.canPrintPermit : null,
    print_access_message: record.print_access_message == null ? (record.printAccessMessage == null ? null : String(record.printAccessMessage)) : String(record.print_access_message),
    total_fees: Number(record.total_fees ?? record.totalFees ?? 0),
    amount_paid: Number(record.amount_paid ?? record.amountPaid ?? 0),
  }
}

function toSystemFeeSettings(payload: unknown): SystemFeeSettings {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The API returned invalid fee settings.')
  }

  const record = payload as Record<string, unknown>

  return {
    localStudentFee: Number(record.local_student_fee ?? record.localStudentFee ?? 0),
    internationalStudentFee: Number(record.international_student_fee ?? record.internationalStudentFee ?? 0),
    deadlines: Array.isArray(record.deadlines) ? record.deadlines : undefined,
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

function toStudentListPage(payload: unknown): StudentListPage {
  const items = extractCollection(payload)
    .map(toDatabaseProfileRow)
    .map(mapProfile)
    .filter((profile): profile is StudentProfile => profile.role === 'student')

  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const meta = record.meta && typeof record.meta === 'object' ? record.meta as Record<string, unknown> : {}
  const summary = record.summary && typeof record.summary === 'object' ? record.summary as Record<string, unknown> : {}

  return {
    items,
    page: Number(meta.page ?? 1) || 1,
    pageSize: Number(meta.pageSize ?? items.length ?? 1) || 1,
    totalItems: Number(meta.totalItems ?? items.length) || items.length,
    totalPages: Number(meta.totalPages ?? 1) || 1,
    totalStudents: Number(summary.totalStudents ?? items.length) || items.length,
    clearedStudents: Number(summary.clearedStudents ?? items.filter((student) => student.feesBalance === 0).length) || 0,
    outstandingStudents: Number(summary.outstandingStudents ?? items.filter((student) => student.feesBalance > 0).length) || 0,
  }
}

function toTrashedStudentProfile(payload: unknown): TrashedStudentProfile {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The API returned an invalid trashed student payload.')
  }

  const record = payload as Record<string, unknown>

  return {
    id: String(record.id ?? ''),
    profileId: String(record.profile_id ?? record.profileId ?? ''),
    role: 'student',
    name: String(record.name ?? ''),
    email: String(record.email ?? ''),
    studentId: record.student_id == null ? (record.studentId == null ? undefined : String(record.studentId)) : String(record.student_id),
    deletedAt: String(record.deleted_at ?? record.deletedAt ?? ''),
    purgeAfterAt: String(record.purge_after_at ?? record.purgeAfterAt ?? ''),
    deletedByAdminId: record.deleted_by_admin_id == null ? (record.deletedByAdminId == null ? null : String(record.deletedByAdminId)) : String(record.deleted_by_admin_id),
    restoredAt: record.restored_at == null ? (record.restoredAt == null ? null : String(record.restoredAt)) : String(record.restored_at),
    restoredByAdminId: record.restored_by_admin_id == null ? (record.restoredByAdminId == null ? null : String(record.restoredByAdminId)) : String(record.restored_by_admin_id),
  }
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

function toAdminActivityLogPage(payload: unknown): AdminActivityLogPage {
  const items = extractCollection(payload).map(toAdminActivityLog)
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const meta = record.meta && typeof record.meta === 'object' ? record.meta as Record<string, unknown> : {}

  return {
    items,
    page: Number(meta.page ?? 1) || 1,
    pageSize: Number(meta.pageSize ?? items.length ?? 1) || 1,
    totalItems: Number(meta.totalItems ?? items.length) || items.length,
    totalPages: Number(meta.totalPages ?? 1) || 1,
  }
}

function toSupportRequest(payload: unknown): SupportRequest {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The API returned an invalid support request payload.')
  }

  const record = payload as Record<string, unknown>

  return {
    id: String(record.id ?? ''),
    studentId: String(record.student_id ?? record.studentId ?? ''),
    studentName: String(record.student_name ?? record.studentName ?? ''),
    studentEmail: String(record.student_email ?? record.studentEmail ?? ''),
    registrationNumber: String(record.registration_number ?? record.registrationNumber ?? ''),
    subject: String(record.subject ?? ''),
    message: String(record.message ?? ''),
    status: record.status === 'resolved' || record.status === 'in_progress' ? record.status : 'open',
    adminReply: String(record.admin_reply ?? record.adminReply ?? ''),
    createdAt: String(record.created_at ?? record.createdAt ?? ''),
    updatedAt: String(record.updated_at ?? record.updatedAt ?? ''),
    resolvedAt: record.resolved_at == null ? null : String(record.resolved_at),
  }
}

function toPermitActivityRecord(payload: unknown): PermitActivityRecord {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The API returned an invalid permit activity record.')
  }

  const record = payload as Record<string, unknown>
  const action = String(record.action ?? '')

  if (
    action !== 'download_permit' &&
    action !== 'print_permit' &&
    action !== 'create_permit' &&
    action !== 'view_permit'
  ) {
    throw new Error('The API returned an invalid permit activity action.')
  }

  return {
    id: String(record.id ?? ''),
    studentId: String(record.student_id ?? record.studentId ?? ''),
    action,
    semester: String(record.semester ?? 'General'),
    source: String(record.source ?? 'student-portal'),
    createdAt: String(record.created_at ?? record.createdAt ?? ''),
  }
}

function toSupportContact(payload: unknown): SupportContact {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The API returned an invalid support contact payload.')
  }

  const record = payload as Record<string, unknown>

  return {
    id: String(record.id ?? ''),
    name: String(record.name ?? ''),
    email: String(record.email ?? ''),
    phoneNumber: String(record.phoneNumber ?? record.phone_number ?? 'Not assigned'),
    scope: record.scope === 'registrar' || record.scope === 'finance' || record.scope === 'operations' ? record.scope : 'super-admin',
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
  async fetchStudentProfilesPage(query?: StudentListQuery): Promise<StudentListPage> {
    const params = new URLSearchParams({ role: 'student' })

    if (typeof query?.page === 'number' && Number.isFinite(query.page)) {
      params.set('page', String(query.page))
    }

    if (typeof query?.pageSize === 'number' && Number.isFinite(query.pageSize)) {
      params.set('pageSize', String(query.pageSize))
    }

    if (typeof query?.search === 'string' && query.search.trim()) {
      params.set('search', query.search.trim())
    }

    if (query?.status && query.status !== 'all') {
      params.set('status', query.status)
    }

    const payload = await request(`/profiles?${params.toString()}`, { method: 'GET' })
    return toStudentListPage(payload)
  },
  async fetchTrashedStudentProfiles(): Promise<TrashedStudentProfile[]> {
    const payload = await request('/profiles-trash', { method: 'GET' })
    return extractCollection(payload).map(toTrashedStudentProfile)
  },
  async fetchAdminActivityLogs(): Promise<AdminActivityLog[]> {
    const payload = await request('/admin-activity-logs', { method: 'GET' })
    return extractCollection(payload).map(toAdminActivityLog)
  },
  async fetchAdminActivityLogsPage(query?: { page?: number; pageSize?: number }): Promise<AdminActivityLogPage> {
    const params = new URLSearchParams()

    if (typeof query?.page === 'number' && Number.isFinite(query.page)) {
      params.set('page', String(query.page))
    }

    if (typeof query?.pageSize === 'number' && Number.isFinite(query.pageSize)) {
      params.set('pageSize', String(query.pageSize))
    }

    const payload = await request(`/admin-activity-logs${params.size > 0 ? `?${params.toString()}` : ''}`, { method: 'GET' })
    return toAdminActivityLogPage(payload)
  },
  async fetchSystemFeeSettings(): Promise<SystemFeeSettings> {
    const payload = await request('/system-settings', { method: 'GET' })
    return toSystemFeeSettings(payload)
  },
  async updateSystemFeeSettings(values: SystemFeeSettings): Promise<SystemFeeSettings> {
    const payload = await request('/system-settings', {
      method: 'PUT',
      body: JSON.stringify({
        local_student_fee: Number(values.localStudentFee.toFixed(2)),
        international_student_fee: Number(values.internationalStudentFee.toFixed(2)),
        deadlines: values.deadlines,
      }),
    })

    return toSystemFeeSettings(payload)
  },
  async createStudentProfile(values: CreateStudentInput, _adminId: string): Promise<StudentProfile> {
    const payload: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      password: values.password,
      student_id: values.studentId,
      student_category: values.studentCategory,
      course: values.course,
      total_fees: Number(values.totalFees.toFixed(2)),
      amount_paid: Number((values.amountPaid ?? 0).toFixed(2)),
    }

    if (typeof values.phoneNumber === 'string') payload.phone_number = values.phoneNumber || null
    if (typeof values.program === 'string') payload.program = values.program || null
    if (typeof values.college === 'string') payload.college = values.college || null
    if (typeof values.department === 'string') payload.department = values.department || null
    if (typeof values.semester === 'string') payload.semester = values.semester || null
    if (Array.isArray(values.courseUnits)) payload.course_units = values.courseUnits
    if ('profileImage' in values) payload.profile_image = values.profileImage ?? null
    if (typeof values.instructions === 'string') payload.instructions = values.instructions || null
    if (typeof values.examDate === 'string') payload.exam_date = values.examDate || null
    if (typeof values.examTime === 'string') payload.exam_time = values.examTime || null
    if (typeof values.venue === 'string') payload.venue = values.venue || null
    if (typeof values.seatNumber === 'string') payload.seat_number = values.seatNumber || null

    const result = await request('/profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    return ensureStudentProfile(mapProfile(toDatabaseProfileRow(result)))
  },
  async updateStudentAccount(studentId: string, values: StudentAccountUpdateInput): Promise<AppProfile> {
    const payload: Record<string, unknown> = {}
    if (typeof values.name === 'string') payload.name = values.name
    if (typeof values.email === 'string') payload.email = values.email
    if (typeof values.phoneNumber === 'string') payload.phoneNumber = values.phoneNumber || null
    if (typeof values.currentPassword === 'string') payload.currentPassword = values.currentPassword
    if (typeof values.password === 'string') payload.password = values.password
    if ('profileImage' in values) payload.profileImage = values.profileImage ?? null

    const result = await request(`/profiles/${studentId}/account`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })

    return mapProfile(toDatabaseProfileRow(result))
  },
  async adminUpdateStudentProfile(studentId: string, values: AdminProfileUpdateInput, adminId: string): Promise<StudentProfile> {
    const payload: Record<string, unknown> = {}
    if (typeof values.name === 'string') payload.name = values.name
    if (typeof values.email === 'string') payload.email = values.email
    if (typeof values.studentId === 'string') payload.student_id = values.studentId || null
    if (values.studentCategory === 'local' || values.studentCategory === 'international') payload.student_category = values.studentCategory
    if (typeof values.phoneNumber === 'string') payload.phone_number = values.phoneNumber || null
    if (typeof values.course === 'string') payload.course = values.course || null
    if (typeof values.program === 'string') payload.program = values.program || null
    if (typeof values.college === 'string') payload.college = values.college || null
    if (typeof values.department === 'string') payload.department = values.department || null
    if (typeof values.semester === 'string') payload.semester = values.semester || null
    if (Array.isArray(values.courseUnits)) payload.course_units = values.courseUnits
    if ('profileImage' in values) payload.profile_image = values.profileImage ?? null
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
  async deleteStudentProfile(studentId: string, _adminId: string) {
    await request(`/profiles/${studentId}`, {
      method: 'DELETE',
    })
  },
  async restoreStudentProfile(trashId: string, _adminId: string): Promise<StudentProfile> {
    const result = await request(`/profiles-trash/${trashId}/restore`, {
      method: 'POST',
    })

    return ensureStudentProfile(mapProfile(toDatabaseProfileRow(result)))
  },
  async grantStudentPermitPrintAccess(studentId: string, additionalPrints: number, _adminId: string): Promise<StudentProfile> {
    const result = await request(`/profiles/${studentId}/permit-print-grants`, {
      method: 'POST',
      body: JSON.stringify({ additionalPrints }),
    })

    return ensureStudentProfile(mapProfile(toDatabaseProfileRow(result)))
  },
  async recordPermitActivity(studentId: string, action: PermitActivityAction) {
    await request('/permit-activity', {
      method: 'POST',
      body: JSON.stringify({ studentId, action }),
    })
  },
  async fetchPermitActivityHistory() {
    const payload = await request('/permit-activity', { method: 'GET' })
    return extractCollection(payload).map(toPermitActivityRecord)
  },
  async fetchSupportContacts(): Promise<SupportContact[]> {
    const payload = await request('/support-contacts', { method: 'GET' })
    return extractCollection(payload).map(toSupportContact)
  },
  async fetchSupportRequests(): Promise<SupportRequest[]> {
    const payload = await request('/support-requests', { method: 'GET' })
    return extractCollection(payload).map(toSupportRequest)
  },
  async createSupportRequest(studentId: string, values: CreateSupportRequestInput): Promise<SupportRequest> {
    const payload = await request('/support-requests', {
      method: 'POST',
      body: JSON.stringify({ studentId, ...values }),
    })

    return toSupportRequest(payload)
  },
  async updateSupportRequest(requestId: string, values: SupportRequestUpdateInput): Promise<SupportRequest> {
    const payload = await request(`/support-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    })

    return toSupportRequest(payload)
  },
}
