import express from 'express'
import rateLimit from 'express-rate-limit'

import cors from 'cors'
import multer from 'multer'
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/node'
import fs from 'fs/promises'
import path from 'path'
import './lib/load-env.js'
import {
  createStudentProfile,
  createSupportRequest,
  addSupportRequestMessage,
  deleteAdminActivityLogById,
  deletePermitActivityLogs,
  markActivityLogRead,
  markAllPermitActivityLogsRead,
  deleteStudentProfile,
  getConfiguredDbPath,
  getPermitByToken,
  getProfileById,
  getSystemSettings,
  getSessionUser,
  getUploadsDir,
  adminUpdateStudentProfile,
  consumeStudentPermitPrintGrant,
  getUserByEmail,
  getUserByPhoneNumber,
  getUserByStudentId,
  grantStudentPermitPrintAccess,
  insertActivityLog,
  listActivityLogs,
  listActivityLogsPage,
  listProfiles,
  listAssistantAdmins,
  createAssistantAdmin,
  updateAssistantAdmin,
  updateAssistantAdminCredentials,
  clearAdminFirstLoginFlag,
  deleteAssistantAdmin,
  listProfilesPage,
  listTrashedStudentProfiles,
  permanentlyDeleteTrashedProfile,
  permanentlyPurgeAllTrashedProfiles,
  listSupportRequests,
  listSemesterRegistrations,
  createSemesterRegistration,
  updateSemesterRegistrationStatus,
  deleteSemesterRegistrationById,
  deleteSupportRequestById,
  resetUserPassword,
  restoreStudentProfile,
  revokeSession,
  updateSupportRequest,
  updateStudentAccount,
  updateSystemSettings,
  updateProfileFinancials,
  verifyPassword,
  getCustomCurriculum,
  saveCustomCurriculum,
  clearCustomCurriculum,
  // Session helpers
  createSession,
} from './lib/database.js'
import { sendSms } from './lib/notification.js'
import * as oidcFlow from './lib/oidc-flow.js'
import { getSisStatus, previewSisConnection } from './lib/sis-client.js'
import { isPermitIntegrityEnabled, signPermitPayload, verifyPermitPayload } from './lib/permit-integrity.js'
// Default session TTL for login tokens (in hours)
const sessionTtlHours = 24

const authWindowMs = 15 * 60 * 1000
const loginLimiter = rateLimit({
  windowMs: authWindowMs,
  max: Math.max(5, Number(process.env.RATE_LIMIT_LOGIN_MAX ?? (process.env.NODE_ENV === 'production' ? 40 : 300))),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
})

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Math.max(3, Number(process.env.RATE_LIMIT_RESET_PASSWORD_MAX ?? 10)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts. Try again later.' },
})

const permitPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Math.max(20, Number(process.env.RATE_LIMIT_PERMIT_PUBLIC_MAX ?? 180)),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many permit requests. Please try again shortly.' },
})



// Initialize multer for file uploads
const upload = multer();

// Set uploads directory
const uploadsDir = getUploadsDir();


const corsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(cors({
  origin(origin, callback) {
    if (!origin || isLoopbackOrigin(origin) || !corsAllowedOrigins || corsAllowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    // Return 403 Forbidden instead of throwing an error
    callback(null, false)
  },
}))

// Profile photo upload endpoint (must be after app is initialized)
app.post('/uploads/profile-photo', upload.single('photo'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'No file uploaded.' })
    return
  }
  const ext = path.extname(request.file.originalname) || '.jpg'
  const fileName = `profile_${Date.now()}_${Math.floor(Math.random()*10000)}${ext}`
  const filePath = path.join(uploadsDir, fileName)
  await fs.writeFile(filePath, request.file.buffer)
  // Assuming uploadsDir is served statically at /uploads
  const fileUrl = `/uploads/${fileName}`
  response.json({ url: fileUrl })
})


function isLoopbackOrigin(origin) {
  if (typeof origin !== 'string' || !origin.trim()) {
    return false
  }

  try {
    const { protocol, hostname } = new URL(origin)

    if (protocol !== 'http:' && protocol !== 'https:') {
      return false
    }

    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

async function notifyStudentOnAdminSupportReply(requestRecord, adminMessage) {
  if (!adminMessage?.trim()) {
    return
  }
  try {
    const studentProfile = getProfileById(requestRecord.studentId)
    const phone = typeof studentProfile?.phoneNumber === 'string' ? studentProfile.phoneNumber.trim() : ''
    if (phone) {
      await sendSms(phone, `Admin replied to "${requestRecord.subject || 'support request'}": ${adminMessage.trim().slice(0, 120)}`)
    }
  } catch (error) {
    console.warn('[support-notify] SMS failed:', error instanceof Error ? error.message : error)
  }
}


const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const SYSTEM_STUDENT_EMAIL_DOMAIN = (process.env.SYSTEM_STUDENT_EMAIL_DOMAIN ?? 'kiu.examcard.com').trim().toLowerCase()

function isValidEmailAddress(value) {
  return typeof value === 'string' && value.length <= 254 && emailPattern.test(value)
}

function isValidProfileImage(value) {
  return typeof value === 'string'
    && value.length <= 300_000
    && (/^https?:\/\//i.test(value) || /^data:image\//i.test(value))
}

function isValidCurrencyAmount(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
}

function isValidSupportStatus(value) {
  return value === 'open' || value === 'in_progress' || value === 'resolved'
}

function normalizePhoneNumber(value) {
  const rawValue = String(value ?? '').trim()

  if (!rawValue) {
    return ''
  }

  const normalized = rawValue.replace(/[^\d+]/g, '')

  if (normalized.startsWith('+')) {
    return `+${normalized.slice(1).replace(/\D/g, '')}`
  }

  return normalized.replace(/\D/g, '')
}

function isValidPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value)
  return normalized.length >= 10 && normalized.length <= 16
}

function isStrongPassword(value) {
  if (typeof value !== 'string') {
    return false
  }
  const password = value.trim()
  if (password.length < 8 || password.length > 128) {
    return false
  }
  return /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
}

function normalizeHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseNumber(value) {
  if (value == null || value === '') {
    return undefined
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isFinite(numericValue) ? numericValue : undefined
}

function parseList(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  const items = value
    .split(/\r?\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : undefined
}

function parseStudentCategory(value) {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalizedValue = value.trim().toLowerCase()

  if (normalizedValue === 'local' || normalizedValue === 'international') {
    return normalizedValue
  }

  return null
}

function parseEnrollmentStatus(value) {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalizedValue = value.trim().toLowerCase()

  if (normalizedValue === 'active' || normalizedValue === 'on_leave' || normalizedValue === 'graduated') {
    return normalizedValue
  }

  return null
}

function buildSystemStudentEmailLocalPart(name) {
  const normalized = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
  return normalized || 'student'
}

function generateUniqueSystemStudentEmail(name) {
  const baseLocalPart = buildSystemStudentEmailLocalPart(name)
  let counter = 0

  while (counter < 5000) {
    const localPart = counter === 0 ? baseLocalPart : `${baseLocalPart}.${counter}`
    const candidate = `${localPart}@${SYSTEM_STUDENT_EMAIL_DOMAIN}`
    if (!getUserByEmail(candidate)) {
      return candidate
    }
    counter += 1
  }

  return `${baseLocalPart}.${Date.now()}@${SYSTEM_STUDENT_EMAIL_DOMAIN}`
}

function resolveUserByIdentifier(identifier) {
  const normalizedIdentifier = String(identifier ?? '').trim()

  if (!normalizedIdentifier) {
    return null
  }

  const lowerIdentifier = normalizedIdentifier.toLowerCase()

  if (isValidEmailAddress(lowerIdentifier)) {
    return getUserByEmail(lowerIdentifier)
  }

  if (isValidPhoneNumber(normalizedIdentifier)) {
    return getUserByPhoneNumber(normalizedIdentifier)
  }

  return getUserByStudentId(normalizedIdentifier)
}

function normalizeVerificationValue(value) {
  const rawValue = String(value ?? '').trim()

  if (!rawValue) {
    return ''
  }

  if (isValidEmailAddress(rawValue.toLowerCase())) {
    return rawValue.toLowerCase()
  }

  if (isValidPhoneNumber(rawValue)) {
    return normalizePhoneNumber(rawValue)
  }

  return rawValue.toLowerCase()
}

function doesVerificationMatchProfile(profile, user, identifier, verification) {
  const normalizedIdentifier = normalizeVerificationValue(identifier)
  const normalizedVerification = normalizeVerificationValue(verification)

  if (!normalizedVerification) {
    return false
  }

  const candidates = profile.role === 'student'
    ? [profile.email, profile.studentId, profile.phoneNumber]
    : [user.email, user.phone_number]

  return candidates
    .filter((candidate) => typeof candidate === 'string' && candidate.trim())
    .map((candidate) => normalizeVerificationValue(candidate))
    .some((candidate) => candidate === normalizedVerification && candidate !== normalizedIdentifier)
}

function getDefaultFeeForStudentCategory(studentCategory) {
  const feeSettings = getSystemSettings()
  return studentCategory === 'international'
    ? feeSettings.international_student_fee
    : feeSettings.local_student_fee
}

function getIdentityConflictMessage({ email, phoneNumber, studentId, excludeUserId } = {}) {
  if (email) {
    const existingUser = getUserByEmail(email)

    if (existingUser && existingUser.id !== excludeUserId) {
      return existingUser.role === 'admin'
        ? 'That email address is already used by an admin login. Student and admin accounts must use different email addresses.'
        : 'That email address is already used by another student login.'
    }
  }

  if (phoneNumber) {
    const existingUser = getUserByPhoneNumber(phoneNumber)

    if (existingUser && existingUser.id !== excludeUserId) {
      return existingUser.role === 'admin'
        ? 'That phone number is already used by an admin login. Student and admin accounts must use different phone numbers.'
        : 'That phone number is already used by another login.'
    }
  }

  if (studentId) {
    const existingUser = getUserByStudentId(studentId)

    if (existingUser && existingUser.id !== excludeUserId) {
      return 'That registration number is already assigned to another student account.'
    }
  }

  return null
}

function mapRowsToFinancialImports(rows) {
  const [headerRow, ...dataRows] = rows

  if (!headerRow) {
    return []
  }

  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(String(cell ?? '')))

  return dataRows
    .map((row, index) => {
      const normalizedRow = normalizedHeaders.reduce((result, header, columnIndex) => {
        if (header) {
          result[header] = row[columnIndex] ?? ''
        }

        return result
      }, {})

      return {
        rowNumber: index + 2,
        studentName: normalizedRow.studentname ? String(normalizedRow.studentname).trim() : undefined,
        studentId: normalizedRow.studentid ? String(normalizedRow.studentid).trim() : undefined,
        studentCategory: parseStudentCategory(normalizedRow.studentcategory ?? normalizedRow.category) ?? undefined,
        email: normalizedRow.email ? String(normalizedRow.email).trim() : undefined,
        userId: normalizedRow.id ? String(normalizedRow.id).trim() : normalizedRow.userid ? String(normalizedRow.userid).trim() : undefined,
        phoneNumber: normalizedRow.phonenumber
          ? String(normalizedRow.phonenumber).trim()
          : normalizedRow.phone
            ? String(normalizedRow.phone).trim()
            : undefined,
        course: normalizedRow.course ? String(normalizedRow.course).trim() : undefined,
        program: normalizedRow.program ? String(normalizedRow.program).trim() : undefined,
        college: normalizedRow.college ? String(normalizedRow.college).trim() : undefined,
        department: normalizedRow.department ? String(normalizedRow.department).trim() : undefined,
        semester: normalizedRow.semester ? String(normalizedRow.semester).trim() : undefined,
        courseUnits: parseList(normalizedRow.courseunits ?? normalizedRow.units),
        instructions: normalizedRow.instructions ? String(normalizedRow.instructions).trim() : undefined,
        examDate: normalizedRow.examdate ? String(normalizedRow.examdate).trim() : undefined,
        examTime: normalizedRow.examtime ? String(normalizedRow.examtime).trim() : undefined,
        venue: normalizedRow.venue ? String(normalizedRow.venue).trim() : undefined,
        seatNumber: normalizedRow.seatnumber ? String(normalizedRow.seatnumber).trim() : undefined,
        amountPaid: parseNumber(normalizedRow.amountpaid ?? normalizedRow.paid ?? normalizedRow.amount),
        totalFees: parseNumber(normalizedRow.totalfees ?? normalizedRow.fees ?? normalizedRow.total),
      }
    })
    .filter((row) => {
      const canUpdate = (row.studentId || row.email || row.userId) && (typeof row.amountPaid === 'number' || typeof row.totalFees === 'number')
      const canCreate = row.studentName && row.studentId && row.email && row.course && typeof row.totalFees === 'number'
      return Boolean(canUpdate || canCreate)
    })
}

function getImportedStudentPassword(row) {
  const seedSource = row.studentId ?? row.email?.split('@')[0] ?? `row${row.rowNumber}`
  const normalizedSeed = seedSource.replace(/[^a-z0-9]/gi, '').slice(-24) || `row${row.rowNumber}`
  return `Permit-${normalizedSeed}`
}

function buildImportedStudentInput(row, requestUser = null) {
  if (!row.studentName) {
    return { reason: 'Student name is required to create a new student account.' }
  }

  if (!row.studentId) {
    return { reason: 'Registration number is required to create a new student account.' }
  }

  if (!row.email) {
    return { reason: 'Email is required to create a new student account.' }
  }

  if (!row.course) {
    return { reason: 'Course is required to create a new student account.' }
  }

  if (typeof row.totalFees !== 'number') {
    return { reason: 'Expected fees are required to create a new student account.' }
  }

  const baseStudent = {
      name: row.studentName,
      email: row.email,
      student_id: row.studentId,
      student_category: row.studentCategory ?? 'local',
      phone_number: row.phoneNumber ? normalizePhoneNumber(row.phoneNumber) || null : null,
      course: row.course,
      program: row.program ?? null,
      college: row.college ?? null,
      department: row.department ?? null,
      semester: row.semester ?? null,
      course_units: row.courseUnits ?? [],
      total_fees: row.totalFees,
      amount_paid: row.amountPaid ?? 0,
      instructions: row.instructions ?? null,
      exam_date: row.examDate ?? null,
      exam_time: row.examTime ?? null,
      venue: row.venue ?? null,
      seat_number: row.seatNumber ?? null,
      campus_id: requestUser?.campusId ?? 'main-campus',
      campus_name: requestUser?.campusName ?? 'Main Campus',
  }

  return {
    createStudent: {
      ...baseStudent,
      password: getImportedStudentPassword(row),
    },
  }
}

function getStudentImportMaxRows() {
  const raw = Number(process.env.STUDENT_IMPORT_MAX_ROWS ?? '5000')
  return Math.min(Math.max(Number.isFinite(raw) ? raw : 5000, 1), 20000)
}

function mapRowsToStudentProvisionRows(dataRows, headerRow) {
  const normalizedHeaders = headerRow.map((cell) => normalizeHeader(String(cell ?? '')))

  return dataRows
    .map((row, index) => {
      const normalizedRow = normalizedHeaders.reduce((result, header, columnIndex) => {
        if (header) {
          result[header] = row[columnIndex] ?? ''
        }

        return result
      }, {})

      return {
        rowNumber: index + 2,
        studentName: normalizedRow.studentname ? String(normalizedRow.studentname).trim() : undefined,
        studentId: normalizedRow.studentid ? String(normalizedRow.studentid).trim() : undefined,
        studentCategory: parseStudentCategory(normalizedRow.studentcategory ?? normalizedRow.category) ?? undefined,
        email: normalizedRow.email ? String(normalizedRow.email).trim().toLowerCase() : undefined,
        phoneNumber: normalizedRow.phonenumber
          ? String(normalizedRow.phonenumber).trim()
          : normalizedRow.phone
            ? String(normalizedRow.phone).trim()
            : undefined,
        course: normalizedRow.course ? String(normalizedRow.course).trim() : undefined,
        program: normalizedRow.program ? String(normalizedRow.program).trim() : undefined,
        college: normalizedRow.college ? String(normalizedRow.college).trim() : undefined,
        department: normalizedRow.department ? String(normalizedRow.department).trim() : undefined,
        semester: normalizedRow.semester ? String(normalizedRow.semester).trim() : undefined,
        courseUnits: parseList(normalizedRow.courseunits ?? normalizedRow.units),
        totalFees: parseNumber(normalizedRow.totalfees ?? normalizedRow.fees ?? normalizedRow.total),
        amountPaid: parseNumber(normalizedRow.amountpaid ?? normalizedRow.paid ?? normalizedRow.amount),
      }
    })
    .filter((row) => row.studentName && row.studentId && row.email && row.course)
}

async function parseStudentProvisionSpreadsheet(buffer, originalName) {
  const normalizedName = String(originalName ?? '').trim().toLowerCase()
  const maxRows = getStudentImportMaxRows()

  if (normalizedName.endsWith('.csv')) {
    const result = Papa.parse(buffer.toString('utf8'), {
      skipEmptyLines: true,
    })

    if (result.errors.length > 0) {
      throw new Error(result.errors[0]?.message || 'Unable to parse the uploaded CSV file.')
    }

    const rows = mapRowsToStudentProvisionRows(result.data.slice(1), result.data[0] ?? [])

    if (rows.length > maxRows) {
      throw new Error(`Student import is limited to ${maxRows} rows per upload. Split the file and import in batches.`)
    }

    return rows
  }

  if (normalizedName.endsWith('.xlsx')) {
    const sheet = await readXlsxFile(buffer)
    const rows = mapRowsToStudentProvisionRows(sheet.slice(1), sheet[0] ?? [])

    if (rows.length > maxRows) {
      throw new Error(`Student import is limited to ${maxRows} rows per upload. Split the file and import in batches.`)
    }

    return rows
  }

  if (normalizedName.endsWith('.xls')) {
    throw new Error('Legacy .xls files are not supported. Save the file as .xlsx or .csv and try again.')
  }

  throw new Error('Unsupported file type. Upload a .xlsx or .csv file.')
}

function resolveStudentProvisionPreview(rows, defaultTotalFees, requestUser) {
  const students = listProfiles('student')

  return rows.map((row) => {
    const existing = students.find((profile) => (row.email && profile.email.toLowerCase() === row.email.toLowerCase())
      || (row.studentId && profile.student_id?.toLowerCase() === row.studentId.toLowerCase()))

    if (existing) {
      return {
        ...row,
        status: 'skipped',
        reason: 'A student with this email or registration number already exists.',
      }
    }

    const totalFees = typeof row.totalFees === 'number' ? row.totalFees : defaultTotalFees
    const enriched = { ...row, totalFees, amountPaid: row.amountPaid ?? 0 }
    const imported = buildImportedStudentInput(enriched, requestUser)

    if (!imported.createStudent) {
      return {
        ...row,
        totalFees,
        status: 'skipped',
        reason: imported.reason ?? 'Unable to create this student from the row.',
      }
    }

    return {
      ...enriched,
      status: 'create',
      reason: `New account with generated temporary password ${imported.createStudent.password}.`,
    }
  })
}

function requireStudentProvisionApiKey(request, response, next) {
  const expected = process.env.STUDENT_PROVISION_API_KEY?.trim()

  if (!expected) {
    response.status(503).json({ message: 'Student provisioning API is disabled. Set STUDENT_PROVISION_API_KEY on the server.' })
    return
  }

  const provided = request.header('X-Provision-Key')

  if (provided !== expected) {
    response.status(401).json({ message: 'Invalid or missing X-Provision-Key header.' })
    return
  }

  next()
}

function normalizeBatchStudentPayload(entry) {
  if (!entry || typeof entry !== 'object') {
    return { error: 'Each student must be a JSON object.' }
  }

  const name = typeof entry.name === 'string' ? entry.name.trim() : ''
  const email = typeof entry.email === 'string' ? entry.email.trim().toLowerCase() : ''
  const student_id = typeof entry.student_id === 'string'
    ? entry.student_id.trim()
    : typeof entry.registration_number === 'string'
      ? entry.registration_number.trim()
      : ''
  const course = typeof entry.course === 'string' ? entry.course.trim() : ''

  if (!name || !email || !student_id || !course) {
    return { error: 'Each student needs name, email, student_id (or registration_number), and course.' }
  }

  const studentCategory = parseStudentCategory(entry.student_category ?? entry.studentCategory)
  if (studentCategory === null && (entry.student_category != null || entry.studentCategory != null)) {
    return { error: 'student_category must be local or international when provided.' }
  }

  const totalFeesRaw = parseNumber(entry.total_fees ?? entry.totalFees)
  const settings = getSystemSettings()
  const total_fees = typeof totalFeesRaw === 'number' ? totalFeesRaw : settings.local_student_fee
  const base = {
    name,
    email,
    student_id,
    student_category: studentCategory ?? 'local',
    course,
    program: typeof entry.program === 'string' ? entry.program.trim() || null : null,
    college: typeof entry.college === 'string' ? entry.college.trim() || null : null,
    department: typeof entry.department === 'string' ? entry.department.trim() || null : null,
    semester: typeof entry.semester === 'string' ? entry.semester.trim() || null : null,
    course_units: Array.isArray(entry.course_units)
      ? entry.course_units.map((unit) => String(unit ?? '').trim()).filter(Boolean)
      : [],
    total_fees,
    amount_paid: parseNumber(entry.amount_paid ?? entry.amountPaid) ?? 0,
    campus_id: String(process.env.DEFAULT_CAMPUS_ID ?? 'main-campus').trim() || 'main-campus',
    campus_name: String(process.env.DEFAULT_CAMPUS_NAME ?? 'Main Campus').trim() || 'Main Campus',
  }

  return {
    createStudent: {
      ...base,
      password: getImportedStudentPassword({ studentId: student_id, email, rowNumber: 0 }),
    },
  }
}

async function parseSpreadsheetRows(buffer, originalName) {
  const normalizedName = String(originalName ?? '').trim().toLowerCase()

  if (normalizedName.endsWith('.csv')) {
    const result = Papa.parse(buffer.toString('utf8'), {
      skipEmptyLines: true,
    })

    if (result.errors.length > 0) {
      throw new Error(result.errors[0]?.message || 'Unable to parse the uploaded CSV file.')
    }

    const rows = mapRowsToFinancialImports(result.data)

    if (rows.length > 500) {
      throw new Error('Spreadsheet import is limited to 500 rows per upload.')
    }

    return rows
  }

  if (normalizedName.endsWith('.xlsx')) {
    const rows = mapRowsToFinancialImports(await readXlsxFile(buffer))

    if (rows.length > 500) {
      throw new Error('Spreadsheet import is limited to 500 rows per upload.')
    }

    return rows
  }

  if (normalizedName.endsWith('.xls')) {
    throw new Error('Legacy .xls files are not supported. Save the file as .xlsx or .csv and try again.')
  }

  throw new Error('Unsupported file type. Upload a .xlsx or .csv file.')
}

function authenticate(request, response, next) {
  const authorization = request.header('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Missing bearer token.' })
    return
  }

  const token = authorization.slice('Bearer '.length)
  const sessionUser = getSessionUser(token)

  if (!sessionUser) {
    response.status(401).json({ message: 'Invalid or expired token.' })
    return
  }

  const user = createAuthenticatedUser(sessionUser)

  request.userId = user.id
  request.userRole = user.role
  request.user = user
  request.adminScope = user.role === 'admin' ? user.scope : null
  request.adminPermissions = user.role === 'admin' ? user.permissions : []
  request.accessToken = token
  next()
}

function resolveAdminScope(user) {
  if (user.role !== 'admin') {
    return null
  }

  if (typeof user.admin_scope === 'string' && user.admin_scope.trim()) {
    return user.admin_scope
  }

  if (user.id === 'admin-1') {
    return 'super-admin'
  }

  if (user.id === 'admin-2') {
    return 'registrar'
  }

  if (user.id === 'admin-3') {
    return 'finance'
  }

  if (user.id === 'admin-4') {
    return 'assistant-admin'
  }

  return 'super-admin'
}

function getAdminPermissions(user) {
  const scope = resolveAdminScope(user)
  const fullAdminPermissions = [
    'view_students',
    'manage_student_profiles',
    'manage_financials',
    'manage_support_requests',
    'view_audit_logs',
    'export_reports',
    'write_audit_logs',
  ]

  if (scope === 'assistant-admin') {
    const assistantRole = user.assistant_role === 'support_help' ? 'support_help' : (user.assistant_role === 'invigilator' ? 'invigilator' : 'department_prints')
    if (assistantRole === 'support_help') {
      return [
        'view_students',
        'manage_support_requests',
      ]
    }
    if (assistantRole === 'invigilator') {
      return [
        'view_students',
        'view_audit_logs',
      ]
    }
    return [
      'view_students',
      'manage_student_profiles',
      'view_audit_logs',
      'export_reports',
    ]
  }

  if (scope === 'super-admin' || scope === 'registrar' || scope === 'finance' || scope === 'operations') {
    return fullAdminPermissions
  }

  return []
}

function createAuthenticatedUser(user) {
  if (user.role !== 'admin') {
    return user
  }

  const result = {
    ...user,
    scope: resolveAdminScope(user),
    assistantRole: user.assistant_role === 'support_help' ? 'support_help' : (user.assistant_role === 'department_prints' ? 'department_prints' : (user.assistant_role === 'invigilator' ? 'invigilator' : undefined)),
    assistantDepartments: getAssistantAllowedDepartments(user),
    permissions: getAdminPermissions(user),
  }

  if (Number(user.first_login_required ?? 0) === 1) {
    result.firstLoginRequired = true
  }

  return result
}

function requireAdminPermission(permission, message = 'You do not have access to this action.') {
  return (request, response, next) => {
    if (request.userRole !== 'admin') {
      response.status(403).json({ message: 'Administrator access is required.' })
      return
    }

    if (!request.adminPermissions.includes(permission)) {
      response.status(403).json({ message })
      return
    }

    next()
  }
}

function canAccessProfile(profile, request) {
  if (request.userRole === 'admin') {
    if (request.adminScope === 'assistant-admin') {
      if (profile.role === 'admin') {
        return request.userId === profile.id
      }
      const allowedDepartments = getAssistantAllowedDepartments(request.user)
      if (allowedDepartments.length === 0) {
        return false
      }
      const profileDepartment = String(profile.department ?? profile.department_name ?? '').trim().toLowerCase()
      return allowedDepartments.includes(profileDepartment)
    }
    return true
  }

  return request.userId === profile.id
}

function getAssistantAllowedDepartments(user) {
  if (!user || user.role !== 'admin') {
    return []
  }
  const dbAssigned = typeof user.assistant_departments_json === 'string' ? user.assistant_departments_json : ''
  if (dbAssigned.trim()) {
    try {
      const parsed = JSON.parse(dbAssigned)
      if (Array.isArray(parsed)) {
        const values = parsed.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean)
        if (values.length > 0) {
          return values
        }
      }
    } catch {
      // fallback to env mapping below
    }
  }

  const mappingRaw = String(process.env.ASSISTANT_ADMIN_DEPARTMENTS ?? '').trim()
  if (!mappingRaw) {
    return []
  }
  const emailKey = String(user.email ?? '').trim().toLowerCase()
  if (!emailKey) {
    return []
  }
  const entries = mappingRaw.split(',').map((entry) => entry.trim()).filter(Boolean)
  for (const entry of entries) {
    const [emailPart, departmentsPart] = entry.split('=')
    if (!emailPart || !departmentsPart) {
      continue
    }
    if (emailPart.trim().toLowerCase() !== emailKey) {
      continue
    }
    return departmentsPart
      .split('|')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  }
  return []
}

function requireAssistantDepartmentAccess(request, response, profile) {
  if (request.userRole !== 'admin' || request.adminScope !== 'assistant-admin') {
    return true
  }
  const allowedDepartments = getAssistantAllowedDepartments(request.user)
  if (allowedDepartments.length === 0) {
    response.status(403).json({ message: 'Assistant admin has no assigned departments. Ask super admin to assign departments.' })
    return false
  }
  const profileDepartment = String(profile?.department ?? '').trim().toLowerCase()
  if (!profileDepartment || !allowedDepartments.includes(profileDepartment)) {
    response.status(403).json({ message: 'You can only manage students in your assigned department(s).' })
    return false
  }
  return true
}

function resolveImportPreview(rows) {
  return rows.map((row) => {
    const matchedProfile = listProfiles('student').find((profile) => {
      return (row.userId && profile.id === row.userId)
        || (row.email && profile.email.toLowerCase() === row.email.toLowerCase())
        || (row.studentId && profile.student_id?.toLowerCase() === row.studentId.toLowerCase())
    })

    if (!matchedProfile) {
      const importedStudent = buildImportedStudentInput(row)

      if (importedStudent.createStudent) {
        return {
          ...row,
          studentName: importedStudent.createStudent.name,
          studentRecordId: null,
          status: 'create',
          reason: `New student account will be created with temporary password ${importedStudent.createStudent.password}.`,
        }
      }

      return {
        ...row,
        studentName: row.studentName,
        studentRecordId: null,
        status: 'skipped',
        reason: importedStudent.reason ?? 'No matching student was found.',
      }
    }

    return {
      ...row,
      studentName: matchedProfile?.name ?? row.studentName,
      studentRecordId: matchedProfile?.id,
      status: 'ready',
      reason: null,
    }
  })
}

app.get('/health', (_request, response) => {
  try {
    getSystemSettings()
    response.json({
      ok: true,
      database: { path: getConfiguredDbPath(), reachable: true },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    response.status(503).json({
      ok: false,
      database: { path: getConfiguredDbPath(), reachable: false },
      message: error instanceof Error ? error.message : 'Database check failed.',
    })
  }
})

app.get('/sis/status', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to view SIS integration status.'), (_request, response) => {
  response.json(getSisStatus())
})

app.post('/sis/sync', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to run SIS sync.'), async (_request, response) => {
  const status = getSisStatus()
  if (!status.enabled) {
    response.status(503).json({
      message: 'SIS connector is not configured yet. Set SIS_BASE_URL and SIS_API_KEY in the backend environment.',
      status,
    })
    return
  }

  const preview = await previewSisConnection()
  if (!preview.ok) {
    response.status(502).json({
      message: 'SIS endpoint is configured but not reachable yet.',
      preview,
    })
    return
  }

  response.status(202).json({
    message: 'SIS connection is active. Full field mapping/import execution will be finalized once your SIS endpoint contract is provided.',
    preview,
  })
})

app.get('/system-settings', authenticate, (request, response) => {
  const settings = getSystemSettings()

  if (request.userRole !== 'admin') {
    response.json({
      deadlines: Array.isArray(settings.deadlines) ? settings.deadlines : [],
      currency_code: settings.currency_code,
    })
    return
  }

  response.json(settings)
})

app.put('/system-settings', authenticate, requireAdminPermission('manage_financials', 'You do not have permission to update fee settings.'), (request, response) => {
  const localStudentFee = parseNumber(request.body.local_student_fee)
  const internationalStudentFee = parseNumber(request.body.international_student_fee)
  const rawCurrencyCode = typeof request.body.currency_code === 'string'
    ? request.body.currency_code.trim().toUpperCase()
    : null

  if (!isValidCurrencyAmount(localStudentFee) || !isValidCurrencyAmount(internationalStudentFee)) {
    response.status(400).json({ message: 'Both local and international student fees must be valid numbers greater than or equal to 0. Commas are allowed (for example: 1,250,000).' })
    return
  }

  if (rawCurrencyCode !== null && !/^[A-Z]{3}$/.test(rawCurrencyCode)) {
    response.status(400).json({ message: 'Currency must be a valid 3-letter ISO code (for example: USD, UGX, EUR).' })
    return
  }

  const payload = {
    local_student_fee: localStudentFee,
    international_student_fee: internationalStudentFee,
  }

  if (rawCurrencyCode) {
    payload.currency_code = rawCurrencyCode
  }

  if (Array.isArray(request.body.deadlines)) {
    payload.deadlines = request.body.deadlines
  }

  const updatedSettings = updateSystemSettings(payload)

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.userId,
    action: 'update_system_fee_settings',
    details: updatedSettings,
    campusId: request.user?.campusId,
    campusName: request.user?.campusName,
  })

  response.json(updatedSettings)
})

app.get('/permits/verify/:token', permitPublicLimiter, (request, response) => {
  const permit = getPermitByToken(request.params.token)

  if (!permit) {
    response.status(404).json({ ok: false, message: 'Permit not found or no longer valid.' })
    return
  }

  const provided = typeof request.query.integrity === 'string' ? request.query.integrity.trim() : ''

  // Compute the expected HMAC from the permit record to verify the provided signature
  const computedSignature = signPermitPayload({
    permitToken: permit.permitToken,
    profileId: permit.profileId,
    cleared: permit.cleared,
    updatedAt: permit.updatedAt ?? '',
  })
  const integrityVerified = Boolean(
    provided
    && computedSignature
    && verifyPermitPayload({
      permitToken: permit.permitToken,
      profileId: permit.profileId,
      cleared: permit.cleared,
      updatedAt: permit.updatedAt ?? '',
    }, provided),
  )

  response.json({
    ok: true,
    studentName: permit.studentName,
    profileId: permit.profileId,
    cleared: permit.cleared,
    integrityEnabled: isPermitIntegrityEnabled(),
    integritySupplied: Boolean(provided),
    integrityVerified,
    examCount: Array.isArray(permit.exams) ? permit.exams.length : 0,
    message: permit.cleared
      ? 'This permit record shows fee clearance in the system.'
      : 'Fees are not fully cleared for this student in the system.',
  })
})

app.get('/permits/:token', permitPublicLimiter, (request, response) => {
  const permit = getPermitByToken(request.params.token)

  if (!permit) {
    response.status(404).json({ message: 'Permit not found.' })
    return
  }

  response.json(permit)
})

app.post('/auth/login', loginLimiter, (request, response) => {
  const identifier = typeof request.body?.identifier === 'string' ? request.body.identifier.trim() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''

  if (!identifier || password.length < 8 || password.length > 128) {
    response.status(400).json({ message: 'Email, phone number, or registration number and password are required.' })
    return
  }

  const user = resolveUserByIdentifier(identifier)
  const passwordMatches = user ? verifyPassword(password, user.password_hash) : false

  if (!user || !passwordMatches) {
    response.status(401).json({ message: 'Invalid login credentials.' })
    return
  }

  if (user.role === 'admin' && user.admin_scope === 'assistant-admin') {
    insertActivityLog({
      adminId: user.id,
      targetProfileId: user.id,
      action: 'assistant_admin_login',
      details: {
        scope: user.admin_scope ?? 'assistant-admin',
        assistantRole: user.assistant_role ?? null,
        identifierUsed: identifier,
      },
    })
  }

  response.json({
    token: createSession(user.id, sessionTtlHours),
    expiresInHours: sessionTtlHours,
    user: createAuthenticatedUser({
      id: user.id,
      email: user.email,
      role: user.role,
      admin_scope: user.admin_scope ?? null,
      name: user.name,
      campus_id: user.campus_id ?? user.campusId,
      campus_name: user.campus_name ?? user.campusName,
      first_login_required: user.first_login_required,
      assistant_role: user.assistant_role,
      assistant_departments_json: user.assistant_departments_json,
    }),
  })
})

app.post('/auth/reset-password', resetPasswordLimiter, (request, response) => {
  const identifier = typeof request.body?.identifier === 'string' ? request.body.identifier.trim() : ''
  const verification = typeof request.body?.verification === 'string' ? request.body.verification.trim() : ''
  const newPassword = typeof request.body?.newPassword === 'string' ? request.body.newPassword.trim() : ''

  if (!identifier || !verification || newPassword.length < 8 || newPassword.length > 128) {
    response.status(400).json({ message: 'Identifier, second verification detail, and a new password are required.' })
    return
  }

  const user = resolveUserByIdentifier(identifier)
  const profile = user ? getProfileById(user.id) : null

  if (!user || !profile || !doesVerificationMatchProfile(profile, user, identifier, verification)) {
    response.status(400).json({ message: 'Verification failed. Use a second registered detail linked to this account.' })
    return
  }

  resetUserPassword(user.id, newPassword)

  response.json({
    message: 'Password reset successful. You can now sign in with the new password.',
  })
})

app.patch('/auth/admin-first-login', authenticate, (request, response) => {
  if (request.userRole !== 'admin' || request.adminScope !== 'assistant-admin') {
    response.status(403).json({ message: 'This endpoint is only for sub-admin first login setup.' })
    return
  }

  if (!request.user?.firstLoginRequired) {
    response.status(400).json({ message: 'First login setup is not required for this account.' })
    return
  }

  const password = typeof request.body?.password === 'string' ? request.body.password.trim() : ''
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''

  if (!isStrongPassword(password)) {
    response.status(400).json({ message: 'Set a strong password with uppercase, lowercase, number, and special character (min 8 chars).' })
    return
  }

  if (email && !isValidEmailAddress(email)) {
    response.status(400).json({ message: 'A valid email address is required.' })
    return
  }

  if (email && email !== request.user.email) {
    const conflict = getIdentityConflictMessage({ email, excludeUserId: request.userId })
    if (conflict) {
      response.status(400).json({ message: conflict })
      return
    }
  }

  const updates = { password }
  if (email && email !== request.user.email) {
    updates.email = email
  }

  updateAssistantAdminCredentials(request.userId, updates)
  clearAdminFirstLoginFlag(request.userId)

  response.json({ message: 'Account setup complete. You can now use the system.' })
})

app.post('/profiles', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to manage student profiles.'), (request, response) => {
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
  const email = generateUniqueSystemStudentEmail(name)
  const password = typeof request.body.password === 'string' ? request.body.password.trim() : ''
  const passwordHash = typeof request.body.password_hash === 'string' ? request.body.password_hash.trim() : ''
  const studentId = typeof request.body.student_id === 'string' ? request.body.student_id.trim() : ''
  const studentCategory = parseStudentCategory(request.body.student_category)
  const gender = request.body.gender === 'male' || request.body.gender === 'female' || request.body.gender === 'other'
    ? request.body.gender
    : null
  const enrollmentStatus = parseEnrollmentStatus(request.body.enrollment_status)
  const phoneNumber = typeof request.body.phone_number === 'string' ? normalizePhoneNumber(request.body.phone_number) : ''
  const course = typeof request.body.course === 'string' ? request.body.course.trim() : ''
  const program = typeof request.body.program === 'string' ? request.body.program.trim() : ''
  const college = typeof request.body.college === 'string' ? request.body.college.trim() : ''
  const department = typeof request.body.department === 'string' ? request.body.department.trim() : ''
  const semester = typeof request.body.semester === 'string' ? request.body.semester.trim() : ''
  const courseUnits = Array.isArray(request.body.course_units)
    ? request.body.course_units.map((unit) => String(unit ?? '').trim()).filter(Boolean)
    : []
  const profileImage = typeof request.body.profile_image === 'string'
    ? request.body.profile_image.trim()
    : request.body.profile_image === null
      ? null
      : undefined
  const totalFees = parseNumber(request.body.total_fees)
  const amountPaid = parseNumber(request.body.amount_paid) ?? 0
  const instructions = typeof request.body.instructions === 'string' ? request.body.instructions.trim() : ''
  const examDate = typeof request.body.exam_date === 'string' ? request.body.exam_date.trim() : ''
  const examTime = typeof request.body.exam_time === 'string' ? request.body.exam_time.trim() : ''
  const venue = typeof request.body.venue === 'string' ? request.body.venue.trim() : ''
  const seatNumber = typeof request.body.seat_number === 'string' ? request.body.seat_number.trim() : ''

  if (name.length < 2 || name.length > 120) {
    response.status(400).json({ message: 'Name must be between 2 and 120 characters long.' })
    return
  }

  if (!isValidEmailAddress(email)) {
    response.status(400).json({ message: 'Unable to generate a valid student email address.' })
    return
  }

  const hasValidPasswordHash = passwordHash.startsWith('scrypt:') && passwordHash.length > 20
  if (!hasValidPasswordHash && (password.length < 8 || password.length > 128)) {
    response.status(400).json({ message: 'Provide a password (8–128 characters) or a scrypt password_hash from your identity system.' })
    return
  }

  if (!studentId || studentId.length > 80) {
    response.status(400).json({ message: 'Registration number is required and must be 80 characters or fewer.' })
    return
  }

  if (!course || course.length > 120) {
    response.status(400).json({ message: 'Course is required and must be 120 characters or fewer.' })
    return
  }

  if (request.adminScope === 'assistant-admin') {
    const allowedDepartments = getAssistantAllowedDepartments(request.user)
    if (allowedDepartments.length === 0 || !department || !allowedDepartments.includes(department.toLowerCase())) {
      response.status(403).json({ message: 'Assistant admin can only create students in assigned department(s).' })
      return
    }
  }

  if (studentCategory === null) {
    response.status(400).json({ message: 'Student category must be either local or international.' })
    return
  }

  if (enrollmentStatus === null) {
    response.status(400).json({ message: 'Enrollment status must be active, on_leave, or graduated.' })
    return
  }

  if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
    response.status(400).json({ message: 'A valid phone number is required.' })
    return
  }

  const resolvedStudentCategory = studentCategory ?? 'local'
  const resolvedTotalFees = typeof totalFees === 'number' ? totalFees : getDefaultFeeForStudentCategory(resolvedStudentCategory)

  if (!isValidCurrencyAmount(resolvedTotalFees)) {
    response.status(400).json({ message: 'Total fees must be a valid non-negative amount.' })
    return
  }

  if (!isValidCurrencyAmount(amountPaid)) {
    response.status(400).json({ message: 'Amount paid must be a valid non-negative amount.' })
    return
  }

  if (program.length > 120) {
    response.status(400).json({ message: 'Program must be 120 characters or fewer.' })
    return
  }

  if (college.length > 120) {
    response.status(400).json({ message: 'College must be 120 characters or fewer.' })
    return
  }

  if (department.length > 120) {
    response.status(400).json({ message: 'Department must be 120 characters or fewer.' })
    return
  }

  if (semester.length > 80) {
    response.status(400).json({ message: 'Semester must be 80 characters or fewer.' })
    return
  }

  if (courseUnits.length > 24) {
    response.status(400).json({ message: 'Course units are limited to 24 entries.' })
    return
  }

  if (instructions.length > 2000) {
    response.status(400).json({ message: 'Instructions must be 2000 characters or fewer.' })
    return
  }

  if (typeof profileImage === 'string' && !isValidProfileImage(profileImage)) {
    response.status(400).json({ message: 'Profile image must be a valid image URL or data URL under 300 KB.' })
    return
  }

  const identityConflictMessage = getIdentityConflictMessage({
    email,
    phoneNumber,
    studentId,
  })

  if (identityConflictMessage) {
    response.status(400).json({ message: identityConflictMessage })
    return
  }

  try {
    const createdProfile = createStudentProfile({
      name,
      email,
      ...(hasValidPasswordHash ? { password_hash: passwordHash } : { password }),
      student_id: studentId,
      student_category: resolvedStudentCategory,
      gender,
      enrollment_status: enrollmentStatus ?? 'active',
      phone_number: phoneNumber || null,
      course,
      program: program || null,
      college: college || null,
      department: department || null,
      semester: semester || null,
      course_units: courseUnits,
      profile_image: typeof profileImage === 'undefined' ? null : profileImage,
      total_fees: resolvedTotalFees,
      amount_paid: amountPaid,
      instructions: instructions || null,
      exam_date: examDate || null,
      exam_time: examTime || null,
      venue: venue || null,
      seat_number: seatNumber || null,
      campus_id: request.user?.campusId ?? 'main-campus',
      campus_name: request.user?.campusName ?? 'Main Campus',
    })

    insertActivityLog({
      adminId: request.userId,
      targetProfileId: createdProfile.id,
      action: 'create_student_profile',
      details: {
        studentId,
        studentCategory: resolvedStudentCategory,
        email,
        course,
        totalFees: resolvedTotalFees,
      },
      campusId: request.user?.campusId,
      campusName: request.user?.campusName,
    })

    response.status(201).json(createdProfile)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create student profile.'
    const nextMessage = /unique/i.test(message) ? 'That email address, phone number, or registration number is already in use.' : message
    response.status(400).json({ message: nextMessage })
  }
})

app.patch('/profiles/:id/admin', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to manage student profiles.'), (request, response) => {
  const profile = getProfileById(request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }
  if (!requireAssistantDepartmentAccess(request, response, profile)) {
    return
  }

  const name = typeof request.body.name === 'string' ? request.body.name.trim() : undefined
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : undefined
  const studentId = typeof request.body.student_id === 'string' ? request.body.student_id.trim() : undefined
  const studentCategory = parseStudentCategory(request.body.student_category)
  const gender = request.body.gender === 'male' || request.body.gender === 'female' || request.body.gender === 'other'
    ? request.body.gender
    : undefined
  const phoneNumber = typeof request.body.phone_number === 'string' ? normalizePhoneNumber(request.body.phone_number) : undefined
  const course = typeof request.body.course === 'string' ? request.body.course.trim() : undefined
  const program = typeof request.body.program === 'string' ? request.body.program.trim() : undefined
  const college = typeof request.body.college === 'string' ? request.body.college.trim() : undefined
  const department = typeof request.body.department === 'string' ? request.body.department.trim() : undefined
  const semester = typeof request.body.semester === 'string' ? request.body.semester.trim() : undefined
  const courseUnits = Array.isArray(request.body.course_units)
    ? request.body.course_units.map((unit) => String(unit ?? '').trim()).filter(Boolean)
    : undefined
  const profileImage = typeof request.body.profile_image === 'string'
    ? request.body.profile_image.trim()
    : request.body.profile_image === null
      ? null
      : undefined
  const totalFees = parseNumber(request.body.total_fees)

  if (studentCategory === null) {
    response.status(400).json({ message: 'Student category must be either local or international.' })
    return
  }

  if (typeof name !== 'undefined' && (name.length < 2 || name.length > 120)) {
    response.status(400).json({ message: 'Name must be between 2 and 120 characters long.' })
    return
  }

  if (typeof email !== 'undefined' && !isValidEmailAddress(email)) {
    response.status(400).json({ message: 'A valid email address is required.' })
    return
  }

  if (typeof phoneNumber !== 'undefined' && phoneNumber && !isValidPhoneNumber(phoneNumber)) {
    response.status(400).json({ message: 'A valid phone number is required.' })
    return
  }

  if (typeof totalFees !== 'undefined' && !isValidCurrencyAmount(totalFees)) {
    response.status(400).json({ message: 'Total fees must be a valid non-negative amount.' })
    return
  }

  if (typeof program !== 'undefined' && program.length > 120) {
    response.status(400).json({ message: 'Program must be 120 characters or fewer.' })
    return
  }

  if (typeof college !== 'undefined' && college.length > 120) {
    response.status(400).json({ message: 'College must be 120 characters or fewer.' })
    return
  }

  if (typeof department !== 'undefined' && department.length > 120) {
    response.status(400).json({ message: 'Department must be 120 characters or fewer.' })
    return
  }

  if (typeof semester !== 'undefined' && semester.length > 80) {
    response.status(400).json({ message: 'Semester must be 80 characters or fewer.' })
    return
  }

  if (typeof courseUnits !== 'undefined' && courseUnits.length > 24) {
    response.status(400).json({ message: 'Course units are limited to 24 entries.' })
    return
  }

  if (typeof profileImage === 'string' && !isValidProfileImage(profileImage)) {
    response.status(400).json({ message: 'Profile image must be a valid image URL or data URL under 300 KB.' })
    return
  }

  const examDate = typeof request.body.exam_date === 'string' ? request.body.exam_date.trim() : undefined
  const examTime = typeof request.body.exam_time === 'string' ? request.body.exam_time.trim() : undefined
  const venue = typeof request.body.venue === 'string' ? request.body.venue.trim() : undefined
  const seatNumber = typeof request.body.seat_number === 'string' ? request.body.seat_number.trim() : undefined
  const instructions = typeof request.body.instructions === 'string' ? request.body.instructions.trim() : undefined

  if (typeof instructions !== 'undefined' && instructions.length > 2000) {
    response.status(400).json({ message: 'Instructions must be 2000 characters or fewer.' })
    return
  }

  const identityConflictMessage = getIdentityConflictMessage({
    email,
    phoneNumber,
    studentId,
    excludeUserId: request.params.id,
  })

  if (identityConflictMessage) {
    response.status(400).json({ message: identityConflictMessage })
    return
  }

  const updates = {}
  if (typeof name !== 'undefined') updates.name = name
  if (typeof email !== 'undefined') updates.email = email
  if (typeof studentId !== 'undefined') updates.student_id = studentId || null
  if (typeof studentCategory !== 'undefined') updates.student_category = studentCategory
  if (typeof gender !== 'undefined') updates.gender = gender
  if (typeof phoneNumber !== 'undefined') updates.phone_number = phoneNumber || null
  if (typeof course !== 'undefined') updates.course = course || null
  if (typeof program !== 'undefined') updates.program = program || null
  if (typeof college !== 'undefined') updates.college = college || null
  if (typeof department !== 'undefined') updates.department = department || null
  if (typeof semester !== 'undefined') updates.semester = semester || null
  if (typeof courseUnits !== 'undefined') updates.course_units = courseUnits
  if (typeof profileImage !== 'undefined') updates.profile_image = profileImage
  if (typeof totalFees !== 'undefined') updates.total_fees = totalFees
  if (typeof studentCategory !== 'undefined' && typeof totalFees === 'undefined') updates.total_fees = getDefaultFeeForStudentCategory(studentCategory)
  if (typeof examDate !== 'undefined') updates.exam_date = examDate || null
  if (typeof examTime !== 'undefined') updates.exam_time = examTime || null
  if (typeof venue !== 'undefined') updates.venue = venue || null
  if (typeof seatNumber !== 'undefined') updates.seat_number = seatNumber || null
  if (typeof instructions !== 'undefined') updates.instructions = instructions || null
  if (Array.isArray(request.body.exams)) {
    updates.exams = request.body.exams
  }

  try {
    const updatedProfile = adminUpdateStudentProfile(request.params.id, updates)

    if (!updatedProfile) {
      response.status(404).json({ message: 'Profile not found.' })
      return
    }

    insertActivityLog({
      adminId: request.userId,
      targetProfileId: request.params.id,
      action: 'admin_update_student_profile',
      details: updates,
      campusId: request.user?.campusId,
      campusName: request.user?.campusName,
    })

    response.json(updatedProfile)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update student profile.'
    const nextMessage = /unique/i.test(message) ? 'That email address, phone number, or registration number is already in use.' : message
    response.status(400).json({ message: nextMessage })
  }
})

app.post('/auth/logout', authenticate, (request, response) => {
  revokeSession(request.accessToken)
  response.status(204).send()
})

app.get('/auth/me', authenticate, (request, response) => {
  response.json({ user: request.user })
})

app.get('/profiles/:id', authenticate, (request, response) => {
  const profile = getProfileById(request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  if (!canAccessProfile(profile, request)) {
    response.status(403).json({ message: 'You can only access your own profile.' })
    return
  }

  // Attach a server-signed HMAC so real permits are cryptographically distinguishable from fakes
  const permitSignature = signPermitPayload({
    permitToken: profile.permit_token ?? '',
    profileId: profile.id,
    cleared: Number(profile.amount_paid ?? 0) >= Number(profile.total_fees ?? 0),
    updatedAt: profile.updated_at ?? '',
  })

  response.json({ ...profile, permit_signature: permitSignature ?? null })
})

app.get('/profiles', authenticate, requireAdminPermission('view_students', 'You do not have permission to view student records.'), (request, response) => {
  const { role, search, status, page, pageSize, department, program, course, college } = request.query
  const assistantDepartments = request.adminScope === 'assistant-admin' ? getAssistantAllowedDepartments(request.user) : []
  const requestedDepartment = typeof department === 'string' ? department.trim() : ''

  if (request.adminScope === 'assistant-admin' && assistantDepartments.length === 0) {
    response.json({ data: [], meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 }, summary: { totalStudents: 0, clearedStudents: 0, outstandingStudents: 0 } })
    return
  }
  if (request.adminScope === 'assistant-admin' && requestedDepartment && !assistantDepartments.includes(requestedDepartment.toLowerCase())) {
    response.status(403).json({ message: 'You can only view students from your assigned department(s).' })
    return
  }

  if (typeof page !== 'undefined' || typeof pageSize !== 'undefined' || typeof search === 'string' || typeof status === 'string') {
    const result = listProfilesPage({
      role: typeof role === 'string' ? role : undefined,
      search: typeof search === 'string' ? search : undefined,
      status: status === 'paid' || status === 'outstanding' ? status : 'all',
      department: request.adminScope === 'assistant-admin'
        ? (requestedDepartment || undefined)
        : (typeof department === 'string' ? department : undefined),
      departments: request.adminScope === 'assistant-admin' && !requestedDepartment
        ? assistantDepartments
        : undefined,
      program: typeof program === 'string' ? program : undefined,
      course: typeof course === 'string' ? course : undefined,
      college: typeof college === 'string' ? college : undefined,
      page: typeof page === 'string' ? Number(page) : undefined,
      pageSize: typeof pageSize === 'string' ? Number(pageSize) : undefined,
    })

    response.json({
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
      summary: {
        totalStudents: result.totalStudents,
        clearedStudents: result.clearedStudents,
        outstandingStudents: result.outstandingStudents,
      },
    })
    return
  }

  const result = typeof role === 'string'
    ? listProfiles(role)
    : listProfiles(undefined)

  if (request.adminScope === 'assistant-admin') {
    const scoped = result.filter((profile) => {
      const profileDepartment = String(profile?.department ?? '').trim().toLowerCase()
      return Boolean(profileDepartment) && assistantDepartments.includes(profileDepartment)
    })
    response.json({ data: scoped })
    return
  }

  response.json({ data: result })
})

app.patch('/profiles/:id/account', authenticate, (request, response) => {
  if (request.userId !== request.params.id) {
    response.status(403).json({ message: 'You can only update your own account.' })
    return
  }

  const profile = getProfileById(request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  const name = typeof request.body.name === 'string' ? request.body.name.trim() : undefined
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : undefined
  const gender = request.body.gender === 'male' || request.body.gender === 'female' || request.body.gender === 'other'
    ? request.body.gender
    : undefined
  const phoneNumber = typeof request.body.phoneNumber === 'string' ? normalizePhoneNumber(request.body.phoneNumber) : undefined
  const currentPassword = typeof request.body.currentPassword === 'string' ? request.body.currentPassword : undefined
  const password = typeof request.body.password === 'string' ? request.body.password : undefined
  const profileImage = typeof request.body.profileImage === 'string'
    ? request.body.profileImage
    : request.body.profileImage === null
      ? null
      : undefined
  const isFirstLoginRequired = profile.role === 'student' && Number(profile.first_login_required ?? 0) === 1

  if (profile.role === 'student') {
    if (typeof name === 'string' && name !== profile.name) {
      response.status(400).json({ message: 'Students cannot change their registered full name. Contact the admin desk for identity corrections.' })
      return
    }

    if (typeof email === 'string' && email !== profile.email) {
      response.status(400).json({ message: 'Students cannot change their registered email address. Contact the admin desk for identity corrections.' })
      return
    }
  } else {
    if (!name || name.length < 2 || name.length > 120) {
      response.status(400).json({ message: 'Name must be between 2 and 120 characters long.' })
      return
    }

    if (!isValidEmailAddress(email)) {
      response.status(400).json({ message: 'A valid email address is required.' })
      return
    }
  }

  if (typeof phoneNumber === 'string' && phoneNumber && !isValidPhoneNumber(phoneNumber)) {
    response.status(400).json({ message: 'A valid phone number is required.' })
    return
  }

  if (typeof password === 'string' && password.trim() && (password.trim().length < 8 || password.trim().length > 128)) {
    response.status(400).json({ message: 'Password must be between 8 and 128 characters long.' })
    return
  }

  if (isFirstLoginRequired) {
    if (!phoneNumber || !isValidPhoneNumber(phoneNumber)) {
      response.status(400).json({ message: 'Please add your phone number to continue.' })
      return
    }

    if (!password || !isStrongPassword(password)) {
      response.status(400).json({ message: 'Set a strong password with uppercase, lowercase, number, and special character.' })
      return
    }
  }

  if (typeof profileImage === 'string' && !isValidProfileImage(profileImage)) {
    response.status(400).json({ message: 'Profile image must be a valid image URL or data URL under 300 KB.' })
    return
  }

  const identityConflictMessage = getIdentityConflictMessage({
    email: profile.role === 'admin' ? email : undefined,
    phoneNumber,
    excludeUserId: request.params.id,
  })

  if (identityConflictMessage) {
    response.status(400).json({ message: identityConflictMessage })
    return
  }

  try {
    const updates = {
      ...(profile.role === 'admin' ? { name, email } : {}),
      ...(typeof gender !== 'undefined' ? { gender } : {}),
      ...(typeof phoneNumber === 'string' ? { phoneNumber } : {}),
      currentPassword,
      password,
      profileImage,
    }

    const updatedProfile = updateStudentAccount(request.params.id, updates)

    if (!updatedProfile) {
      response.status(404).json({ message: 'Profile not found.' })
      return
    }

    response.json(updatedProfile)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update account details.'
    const nextMessage = /unique/i.test(message)
      ? 'That email address is already in use.'
      : message

    response.status(400).json({ message: nextMessage })
  }
})

app.patch('/profiles/:id/financials', authenticate, requireAdminPermission('manage_financials', 'You do not have permission to manage student financials.'), (request, response) => {
  const profile = getProfileById(request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }
  if (!requireAssistantDepartmentAccess(request, response, profile)) {
    return
  }

  const previousAmountPaid = Number(profile.amount_paid ?? 0)
  const previousTotalFees = Number(profile.total_fees ?? 0)

  const amountPaid = parseNumber(request.body.amountPaid)
  const totalFees = parseNumber(request.body.totalFees)

  if (typeof amountPaid === 'undefined' && typeof totalFees === 'undefined') {
    response.status(400).json({ message: 'Provide amountPaid or totalFees to update financials.' })
    return
  }

  if ((typeof amountPaid !== 'undefined' && !isValidCurrencyAmount(amountPaid)) || (typeof totalFees !== 'undefined' && !isValidCurrencyAmount(totalFees))) {
    response.status(400).json({ message: 'Financial values must be valid non-negative amounts.' })
    return
  }

  const updatedProfile = updateProfileFinancials(
    request.params.id,
    amountPaid,
    totalFees,
  )

  if (!updatedProfile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  const newAmountPaid = Number(updatedProfile.amount_paid ?? 0)
  const newTotalFees = Number(updatedProfile.total_fees ?? 0)
  const paymentIncrement = Number((newAmountPaid - previousAmountPaid).toFixed(2))
  const totalFeesDelta = Number((newTotalFees - previousTotalFees).toFixed(2))

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.params.id,
    action: 'update_student_financials',
    details: {
      previousAmountPaid: Number(previousAmountPaid.toFixed(2)),
      cumulativeAmountPaid: Number(newAmountPaid.toFixed(2)),
      paymentIncrementRecorded: paymentIncrement,
      previousTotalFees: Number(previousTotalFees.toFixed(2)),
      totalFees: Number(newTotalFees.toFixed(2)),
      totalFeesDelta,
    },
  })

  response.json(updatedProfile)

  if (updatedProfile.amount_paid < updatedProfile.total_fees) {
    if (updatedProfile.phone_number) {
      sendSms(updatedProfile.phone_number, `Payment reminder: Outstanding balance $${updatedProfile.total_fees - updatedProfile.amount_paid}.`).catch(() => {})
    }
  }
})

app.get('/profiles-trash', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to access deleted student records.'), (_request, response) => {
  response.json({ items: listTrashedStudentProfiles() })
})

app.delete('/profiles-trash', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to purge deleted student records.'), (request, response) => {
  if (request.query.purge !== 'all') {
    response.status(400).json({ message: 'Use ?purge=all to permanently remove every student record currently in trash.' })
    return
  }

  const deleted = permanentlyPurgeAllTrashedProfiles()
  response.json({ ok: true, deleted })
})

app.delete('/profiles-trash/:id', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to purge deleted student records.'), (request, response) => {
  const ok = permanentlyDeleteTrashedProfile(request.params.id)

  if (!ok) {
    response.status(404).json({ message: 'Trash entry not found or already restored.' })
    return
  }

  response.json({ ok: true })
})

app.post('/profiles-trash/:id/restore', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to restore student profiles.'), (request, response) => {
  try {
    const restoredProfile = restoreStudentProfile(request.params.id, request.userId)

    if (!restoredProfile) {
      response.status(404).json({ message: 'Deleted student record not found.' })
      return
    }

    insertActivityLog({
      adminId: request.userId,
      targetProfileId: restoredProfile.id,
      action: 'restore_student_profile',
      details: {
        restoredProfileId: restoredProfile.id,
        studentId: restoredProfile.studentId,
        studentName: restoredProfile.name,
        email: restoredProfile.email,
      },
    })

    response.json(restoredProfile)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to restore the deleted student profile.'
    response.status(400).json({ message })
  }
})

app.delete('/profiles/:id', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to delete student profiles.'), (request, response) => {
  const profile = getProfileById(request.params.id)

  if (!profile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  if (profile.role !== 'student') {
    response.status(400).json({ message: 'Only student profiles can be deleted from this workspace.' })
    return
  }
  if (!requireAssistantDepartmentAccess(request, response, profile)) {
    return
  }

  const deletedProfile = deleteStudentProfile(request.params.id, request.userId)

  if (!deletedProfile) {
    response.status(404).json({ message: 'Profile not found.' })
    return
  }

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.userId,
    action: 'delete_student_profile',
    details: {
      deletedProfileId: request.params.id,
      studentId: profile.studentId,
      studentName: profile.name,
      email: profile.email,
    },
  })

  response.json({ ok: true, deletedProfile })
})

app.post('/profiles/:id/permit-print-grants', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to grant permit print access.'), (request, response) => {
  const additionalPrints = parseNumber(request.body?.additionalPrints)

  if (typeof additionalPrints !== 'undefined' && (!Number.isInteger(additionalPrints) || additionalPrints < 1 || additionalPrints > 12)) {
    response.status(400).json({ message: 'Additional print access must be a whole number between 1 and 12.' })
    return
  }

  const profile = getProfileById(request.params.id)
  if (!profile) {
    response.status(404).json({ message: 'Student profile not found.' })
    return
  }
  if (!requireAssistantDepartmentAccess(request, response, profile)) {
    return
  }
  const updatedProfile = grantStudentPermitPrintAccess(request.params.id, additionalPrints ?? 1)

  if (!updatedProfile) {
    response.status(404).json({ message: 'Student profile not found.' })
    return
  }

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.params.id,
    action: 'grant_student_permit_print_access',
    details: {
      additionalPrints: additionalPrints ?? 1,
      studentName: updatedProfile.name,
      studentId: updatedProfile.student_id,
      email: updatedProfile.email,
    },
    campusId: request.user?.campusId,
    campusName: request.user?.campusName,
  })

  response.json(updatedProfile)

  if (updatedProfile.phone_number) {
    sendSms(updatedProfile.phone_number, 'Your exam permit is now ready for download and printing.').catch(() => {})
  }
})

app.post('/admin-activity-logs', authenticate, requireAdminPermission('write_audit_logs', 'You do not have permission to record admin activity.'), (request, response) => {
  insertActivityLog({
    adminId: request.body.admin_id ?? request.userId,
    targetProfileId: request.body.target_profile_id,
    action: request.body.action,
    details: request.body.details ?? {},
  })
  response.status(201).json({ ok: true })
})

// --- Bulk Curriculum Sync Helper and Endpoint ---
import { KIU_CURRICULUM, KIU_DEPARTMENT_DEFAULT_PROGRAM, KIU_SEMESTERS } from '../../src/config/universityData.ts'

// Effective curriculum — updated to custom if uploaded, otherwise falls back to embedded KIU_CURRICULUM
let effectiveCurriculum = KIU_CURRICULUM

function refreshEffectiveCurriculum() {
  try {
    const custom = getCustomCurriculum()
    if (custom && typeof custom === 'object' && !Array.isArray(custom) && Object.keys(custom).length > 0) {
      effectiveCurriculum = custom
    } else {
      effectiveCurriculum = KIU_CURRICULUM
    }
  } catch {
    effectiveCurriculum = KIU_CURRICULUM
  }
}
// Load any previously uploaded custom curriculum at startup
refreshEffectiveCurriculum()

function trimStr(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function curriculumKeyCaseInsensitive(name) {
  const n = trimStr(name)
  if (!n) {
    return null
  }
  const lower = n.toLowerCase()
  return Object.keys(effectiveCurriculum).find((key) => key.toLowerCase() === lower) ?? null
}

function findCurriculumForStudent(student) {
  const program = trimStr(student.program)
  const course = trimStr(student.course)
  const department = trimStr(student.department)

  if (program && effectiveCurriculum[program]) {
    return effectiveCurriculum[program]
  }
  if (course && effectiveCurriculum[course]) {
    return effectiveCurriculum[course]
  }

  const programKey = curriculumKeyCaseInsensitive(program)
  if (programKey) {
    return effectiveCurriculum[programKey]
  }
  const courseKey = curriculumKeyCaseInsensitive(course)
  if (courseKey) {
    return effectiveCurriculum[courseKey]
  }

  for (const curriculum of Object.values(effectiveCurriculum)) {
    const dc = trimStr(curriculum?.defaultCourse)
    if (dc && (dc === program || dc === course)) {
      return curriculum
    }
  }

  if (department) {
    const deptProgram = KIU_DEPARTMENT_DEFAULT_PROGRAM[department]
    if (deptProgram && KIU_CURRICULUM[deptProgram]) {
      return KIU_CURRICULUM[deptProgram]
    }
    const deptLower = department.toLowerCase()
    for (const [deptName, progName] of Object.entries(KIU_DEPARTMENT_DEFAULT_PROGRAM)) {
      if (deptName.toLowerCase() === deptLower && progName && KIU_CURRICULUM[progName]) {
        return KIU_CURRICULUM[progName]
      }
    }
  }

  const haystack = `${program} ${course} ${department}`.toLowerCase().replace(/\s+/g, ' ')
  const sortedKeys = Object.keys(KIU_CURRICULUM).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    if (haystack.includes(key.toLowerCase())) {
      return KIU_CURRICULUM[key]
    }
  }

  return null
}

function normalizeSemesterLabel(value) {
  return trimStr(value).replace(/[–—]/g, '-').replace(/\s+/g, ' ')
}

function getSemesterUnits(curriculum, semesterRaw) {
  const semester = normalizeSemesterLabel(semesterRaw)
  if (!curriculum?.semesters) {
    return null
  }
  if (semester && curriculum.semesters[semester]) {
    return curriculum.semesters[semester]
  }
  if (semester) {
    const lower = semester.toLowerCase()
    const key = Object.keys(curriculum.semesters).find((k) => k.toLowerCase() === lower)
    if (key) {
      return curriculum.semesters[key]
    }
    const normKey = Object.keys(curriculum.semesters).find((k) => normalizeSemesterLabel(k).toLowerCase() === lower)
    if (normKey) {
      return curriculum.semesters[normKey]
    }
  }
  return null
}

/**
 * Prefer the student's semester; if it does not match any block (missing, typo, legacy label),
 * use the first semester with content (KIU_SEMESTERS order) so bulk sync still updates most students.
 */
function resolveSemesterUnits(curriculum, student) {
  const units = getSemesterUnits(curriculum, student.semester)
  if (units && Array.isArray(units) && units.length > 0) {
    return units
  }
  for (const sem of KIU_SEMESTERS) {
    const block = curriculum.semesters?.[sem]
    if (Array.isArray(block) && block.length > 0) {
      return block
    }
  }
  const firstKey = Object.keys(curriculum.semesters ?? {})[0]
  const block = firstKey ? curriculum.semesters[firstKey] : null
  if (Array.isArray(block) && block.length > 0) {
    return block
  }
  return null
}

function buildSyncPayloadFromKiuUnits(studentId, kiuUnits) {
  if (!Array.isArray(kiuUnits) || kiuUnits.length === 0) {
    return { course_units: [], exams: [] }
  }

  const course_units = kiuUnits
    .map((u) => {
      if (typeof u === 'string') {
        return u.trim()
      }
      if (u && typeof u === 'object' && typeof u.unitName === 'string') {
        return u.unitName.trim()
      }
      return ''
    })
    .filter(Boolean)

  const exams = kiuUnits.map((u, index) => {
    const unitName = u && typeof u === 'object' && typeof u.unitName === 'string'
      ? u.unitName.trim()
      : `Course unit ${index + 1}`
    const venue = u && typeof u === 'object' && typeof u.venue === 'string' ? u.venue.trim() : 'To be announced'
    const time = u && typeof u === 'object' && typeof u.time === 'string' ? u.time.trim() : 'To be announced'
    return {
      id: `${studentId}-curriculum-${index + 1}`,
      title: unitName,
      examDate: 'To be announced',
      examTime: time,
      venue,
      seatNumber: 'To be assigned',
    }
  })

  return { course_units, exams }
}

// Bulk sync endpoint: aligns all students' course_units and exams with curriculum
app.post('/admin/bulk-sync-curriculum', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to sync curriculum.'), async (request, response) => {
  try {
    const allStudents = listProfiles('student')
    const totalStudents = allStudents.length
    let updated = 0
    const failed = []
    for (const student of allStudents) {
      const curriculum = findCurriculumForStudent(student)
      if (!curriculum) {
        failed.push({ id: student.id, reason: 'No curriculum match for program/course' })
        continue
      }
      const kiuUnits = resolveSemesterUnits(curriculum, student)
      if (!kiuUnits) {
        failed.push({ id: student.id, reason: 'No semester block found in curriculum' })
        continue
      }
      try {
        const { course_units, exams } = buildSyncPayloadFromKiuUnits(student.id, kiuUnits)
        adminUpdateStudentProfile(student.id, {
          course_units,
          exams,
        })
        updated++
      } catch (err) {
        failed.push({ id: student.id, reason: err instanceof Error ? err.message : 'Unknown error' })
      }
    }
    insertActivityLog({
      adminId: request.userId,
      targetProfileId: request.userId,
      action: 'bulk_sync_curriculum',
      details: { updated, failedCount: failed.length, totalStudents },
      campusId: request.user?.campusId,
      campusName: request.user?.campusName,
    })
    response.json({ updated, failed, totalStudents })
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : 'Bulk sync failed.' })
  }
});

// Curriculum management endpoints
app.get('/admin/curriculum', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to view curriculum settings.'), (_request, response) => {
  const custom = getCustomCurriculum()
  const source = custom ? 'custom' : 'embedded'
  const curriculum = custom ?? KIU_CURRICULUM
  const programs = Object.keys(curriculum)
  response.json({ source, programCount: programs.length, programs, curriculum })
})

app.put('/admin/curriculum', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to update curriculum settings.'), (request, response) => {
  if (request.adminScope !== 'super-admin') {
    response.status(403).json({ message: 'Only super admin can upload a custom curriculum.' })
    return
  }
  const body = request.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    response.status(400).json({ message: 'Request body must be a JSON object mapping program names to curriculum entries.' })
    return
  }
  // Validate structure: each key maps to an object with a semesters property
  const keys = Object.keys(body)
  if (keys.length === 0) {
    response.status(400).json({ message: 'Curriculum must contain at least one program.' })
    return
  }
  for (const key of keys) {
    const entry = body[key]
    if (!entry || typeof entry !== 'object' || typeof entry.semesters !== 'object' || Array.isArray(entry.semesters)) {
      response.status(400).json({ message: `Invalid curriculum entry for program "${key}": expected { semesters: { ... } }.` })
      return
    }
  }
  saveCustomCurriculum(body)
  refreshEffectiveCurriculum()
  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.userId,
    action: 'upload_custom_curriculum',
    details: { programCount: keys.length },
    campusId: request.user?.campusId,
    campusName: request.user?.campusName,
  })
  response.json({ ok: true, programCount: keys.length })
})

app.delete('/admin/curriculum', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to reset curriculum settings.'), (request, response) => {
  if (request.adminScope !== 'super-admin') {
    response.status(403).json({ message: 'Only super admin can reset the curriculum.' })
    return
  }
  clearCustomCurriculum()
  refreshEffectiveCurriculum()
  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.userId,
    action: 'reset_curriculum',
    details: {},
    campusId: request.user?.campusId,
    campusName: request.user?.campusName,
  })
  response.json({ ok: true })
})

app.post('/permit-activity', authenticate, (request, response) => {
  const { studentId, action } = request.body ?? {}
  const profile = getProfileById(request.userId)

  if (request.userRole !== 'student') {
    response.status(403).json({ message: 'Only student accounts can record permit activity.' })
    return
  }

  if (studentId !== request.userId) {
    response.status(403).json({ message: 'You can only record activity for your own permit.' })
    return
  }

  if (action !== 'print_permit' && action !== 'download_permit') {
    response.status(400).json({ message: 'Unsupported permit activity.' })
    return
  }

  if (profile?.can_print_permit === false) {
    response.status(403).json({ message: profile?.print_access_message || 'You have reached the monthly permit print limit. Contact administration for access.' })
    return
  }

  const amountPaid = Number(profile?.amount_paid ?? 0)
  const totalFees = Number(profile?.total_fees ?? 0)
  if (amountPaid + 0.005 < totalFees) {
    response.status(403).json({ message: 'Clear all outstanding fees before printing or downloading your permit.' })
    return
  }

  const enrollmentStatus = profile?.enrollment_status ?? 'active'
  if (enrollmentStatus === 'on_leave' || enrollmentStatus === 'graduated') {
    response.status(403).json({
      message: enrollmentStatus === 'graduated'
        ? 'Graduated students cannot print exam permits through this portal. Contact the registry if you need assistance.'
        : 'Your enrollment is on leave. Contact the registry before printing or downloading a permit.',
    })
    return
  }

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.userId,
    action,
    details: {
      source: 'student-portal',
      semester: profile?.semester ?? null,
    },
  })

  consumeStudentPermitPrintGrant(request.userId)

  response.status(201).json({ ok: true })
})

app.get('/permit-activity', authenticate, (request, response) => {
  const requestedStudentId = request.userRole === 'student'
    ? request.userId
    : typeof request.query?.studentId === 'string'
      ? request.query.studentId
      : ''

  if (!requestedStudentId) {
    response.status(400).json({ message: 'A student activity record is required.' })
    return
  }

  const profile = getProfileById(requestedStudentId)

  if (!profile || profile.role !== 'student') {
    response.status(404).json({ message: 'Student profile not found.' })
    return
  }

  if (request.userRole === 'admin' && !request.adminPermissions.includes('view_students')) {
    response.status(403).json({ message: 'You do not have permission to view student permit history.' })
    return
  }

  const data = listActivityLogs()
    .filter((entry) => entry.target_profile_id === requestedStudentId && (entry.action === 'print_permit' || entry.action === 'download_permit'))
    .map((entry) => ({
      id: entry.id,
      studentId: requestedStudentId,
      action: entry.action,
      semester: typeof entry.details.semester === 'string' && entry.details.semester.trim() ? entry.details.semester : (profile.semester || 'General'),
      source: typeof entry.details.source === 'string' ? entry.details.source : 'student-portal',
      createdAt: entry.createdAt,
    }))

  response.json({ data })
})

app.delete('/admin-activity-logs/all-permit-events', authenticate, requireAdminPermission('write_audit_logs', 'You do not have permission to delete permit activity.'), (_request, response) => {
  const deleted = deletePermitActivityLogs()
  response.json({ ok: true, deleted })
})

app.patch('/admin-activity-logs/permit-events/mark-all-read', authenticate, requireAdminPermission('view_audit_logs', 'You do not have permission to update activity logs.'), (_request, response) => {
  const marked = markAllPermitActivityLogsRead()
  response.json({ ok: true, marked })
})

app.patch('/admin-activity-logs/:id/read', authenticate, requireAdminPermission('view_audit_logs', 'You do not have permission to update activity logs.'), (request, response) => {
  const ok = markActivityLogRead(request.params.id)

  if (!ok) {
    response.status(404).json({ message: 'Activity log not found.' })
    return
  }

  response.json({ ok: true })
})

app.delete('/admin-activity-logs/:id', authenticate, requireAdminPermission('write_audit_logs', 'You do not have permission to delete audit activity.'), (request, response) => {
  const ok = deleteAdminActivityLogById(request.params.id)

  if (!ok) {
    response.status(404).json({ message: 'Activity log not found.' })
    return
  }

  response.json({ ok: true })
})

app.get('/admin-activity-logs', authenticate, requireAdminPermission('view_audit_logs', 'You do not have permission to view audit activity.'), (request, response) => {
  const { page, pageSize } = request.query

  if (typeof page !== 'undefined' || typeof pageSize !== 'undefined') {
    const result = listActivityLogsPage({
      page: typeof page === 'string' ? Number(page) : undefined,
      pageSize: typeof pageSize === 'string' ? Number(pageSize) : undefined,
    })

    response.json({
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      },
    })
    return
  }

  response.json({ data: listActivityLogs() })
})
app.get('/support-requests', authenticate, (request, response) => {
  if (request.userRole === 'admin' && !request.adminPermissions.includes('manage_support_requests')) {
    response.status(403).json({ message: 'You do not have permission to view support requests.' })
    return
  }

  const data = request.userRole === 'admin'
    ? listSupportRequests()
    : listSupportRequests({ studentId: request.userId })

  response.json({ data })
})

app.get('/support-contacts', authenticate, (_request, response) => {
  const data = listProfiles('admin')
    .filter((profile) => profile.role === 'admin')
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phoneNumber: profile.phoneNumber ?? 'Not assigned',
      scope: profile.id === 'admin-1'
        ? 'super-admin'
        : profile.id === 'admin-2'
          ? 'registrar'
          : profile.id === 'admin-3'
            ? 'finance'
            : profile.id === 'admin-4'
              ? 'assistant-admin'
              : 'operations',
    }))

  response.json({ data })
})

app.get('/admin/assistants', authenticate, requireAdminPermission('view_students', 'You do not have permission to view assistants.'), (request, response) => {
  if (request.adminScope !== 'super-admin') {
    response.status(403).json({ message: 'Only super admin can manage assistant admins.' })
    return
  }
  response.json({ data: listAssistantAdmins() })
})

app.post('/admin/assistants', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to create assistant admins.'), (request, response) => {
  if (request.adminScope !== 'super-admin') {
    response.status(403).json({ message: 'Only super admin can create assistant admins.' })
    return
  }
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const phoneNumber = typeof request.body?.phoneNumber === 'string' ? normalizePhoneNumber(request.body.phoneNumber) : ''
  const password = typeof request.body?.password === 'string' ? request.body.password.trim() : ''
  const role = ['invigilator', 'support_help', 'department_prints'].includes(request.body?.role) ? request.body.role : 'department_prints'
  const departments = Array.isArray(request.body?.departments) ? request.body.departments.map((item) => String(item ?? '').trim()).filter(Boolean) : []

  if (name.length < 2 || name.length > 120) {
    response.status(400).json({ message: 'Assistant name must be between 2 and 120 characters.' })
    return
  }
  if (!isValidEmailAddress(email)) {
    response.status(400).json({ message: 'A valid assistant email is required.' })
    return
  }
  if (!password || password.length < 8 || password.length > 128) {
    response.status(400).json({ message: 'Assistant temporary password must be 8-128 characters.' })
    return
  }
  if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
    response.status(400).json({ message: 'Phone number is invalid.' })
    return
  }
  if (role === 'department_prints' && departments.length === 0) {
    response.status(400).json({ message: 'Assign at least one department for department print assistants.' })
    return
  }

  try {
    const created = createAssistantAdmin({
      name,
      email,
      phone_number: phoneNumber || null,
      password,
      role,
      departments,
      campus_id: request.user?.campusId ?? 'main-campus',
      campus_name: request.user?.campusName ?? 'Main Campus',
    })
    response.status(201).json(created)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to create assistant admin.' })
  }
})

app.patch('/admin/assistants/:id', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to update assistant admins.'), (request, response) => {
  if (request.adminScope !== 'super-admin') {
    response.status(403).json({ message: 'Only super admin can update assistant admins.' })
    return
  }
  const role = ['invigilator', 'support_help', 'department_prints'].includes(request.body?.role) ? request.body.role : 'department_prints'
  const departments = Array.isArray(request.body?.departments) ? request.body.departments.map((item) => String(item ?? '').trim()).filter(Boolean) : []
  if (role === 'department_prints' && departments.length === 0) {
    response.status(400).json({ message: 'Assign at least one department for department print assistants.' })
    return
  }
  const updated = updateAssistantAdmin(request.params.id, { role, departments })
  if (!updated) {
    response.status(404).json({ message: 'Assistant admin not found.' })
    return
  }
  response.json(updated)
})

app.patch('/admin/assistants/:id/credentials', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to update assistant admins.'), (request, response) => {
  if (request.adminScope !== 'super-admin') {
    response.status(403).json({ message: 'Only super admin can update assistant admin credentials.' })
    return
  }

  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : undefined
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : undefined
  const password = typeof request.body?.password === 'string' ? request.body.password.trim() : undefined

  if (!name && !email && !password) {
    response.status(400).json({ message: 'Provide at least one of name, email, or password to update.' })
    return
  }

  if (name !== undefined && (name.length < 2 || name.length > 120)) {
    response.status(400).json({ message: 'Name must be between 2 and 120 characters.' })
    return
  }

  if (email !== undefined && !isValidEmailAddress(email)) {
    response.status(400).json({ message: 'A valid email address is required.' })
    return
  }

  if (password !== undefined && (password.length < 8 || password.length > 128)) {
    response.status(400).json({ message: 'Password must be between 8 and 128 characters.' })
    return
  }

  if (email) {
    const conflict = getIdentityConflictMessage({ email, excludeUserId: request.params.id })
    if (conflict) {
      response.status(400).json({ message: conflict })
      return
    }
  }

  const updated = updateAssistantAdminCredentials(request.params.id, { name, email, password })
  if (!updated) {
    response.status(404).json({ message: 'Assistant admin not found.' })
    return
  }

  // If super-admin changes the password, clear first_login_required flag
  if (password) {
    clearAdminFirstLoginFlag(request.params.id)
  }

  response.json(updated)
})

app.delete('/admin/assistants/:id', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to delete assistant admins.'), (request, response) => {
  if (request.adminScope !== 'super-admin') {
    response.status(403).json({ message: 'Only super admin can delete assistant admins.' })
    return
  }
  const deleted = deleteAssistantAdmin(request.params.id)
  if (!deleted) {
    response.status(404).json({ message: 'Assistant admin not found.' })
    return
  }
  response.json({ ok: true })
})

app.post('/admin/report-forgery', authenticate, (request, response) => {
  if (request.userRole !== 'admin') {
    response.status(403).json({ message: 'Only admin accounts can submit forgery reports.' })
    return
  }
  const studentId = typeof request.body?.studentId === 'string' ? request.body.studentId.trim() : ''
  const reason = typeof request.body?.reason === 'string' ? request.body.reason.trim() : ''
  const notes = typeof request.body?.notes === 'string' ? request.body.notes.trim() : ''

  if (!studentId) {
    response.status(400).json({ message: 'studentId is required.' })
    return
  }
  if (!reason) {
    response.status(400).json({ message: 'A reason for the forgery report is required.' })
    return
  }

  const profile = getProfileById(studentId)
  if (!profile) {
    response.status(404).json({ message: 'Student profile not found.' })
    return
  }

  const reporter = request.user?.name ?? request.user?.email ?? 'Unknown invigilator'
  insertActivityLog({
    adminId: request.userId,
    targetProfileId: studentId,
    action: 'forgery_reported',
    details: `Forgery reported by ${reporter}. Reason: ${reason}${notes ? `. Notes: ${notes}` : ''}`,
    campusId: 'main-campus',
    campusName: 'Forgery Report',
  })

  response.json({ ok: true, message: 'Forgery report submitted and logged.' })
})

app.post('/support-requests', authenticate, upload.single('attachment'), async (request, response) => {
  if (request.userRole !== 'student') {
    response.status(403).json({ message: 'Only student accounts can create support requests.' })
    return
  }

  const subject = typeof request.body?.subject === 'string' ? request.body.subject.trim() : ''
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : ''
  const attachment = request.file ?? null

  if (subject.length < 4 || subject.length > 120) {
    response.status(400).json({ message: 'Subject must be between 4 and 120 characters long.' })
    return
  }

  if (!attachment && (message.length < 10 || message.length > 2000)) {
    response.status(400).json({ message: 'Message must be between 10 and 2000 characters long.' })
    return
  }
  if (attachment && (message.length < 2 || message.length > 2000)) {
    response.status(400).json({ message: 'Message must be between 2 and 2000 characters long when attaching a file.' })
    return
  }
  if (attachment && attachment.size > 10 * 1024 * 1024) {
    response.status(400).json({ message: 'Attachment size must be 10MB or less.' })
    return
  }

  let attachmentUrl = null
  let attachmentName = null
  let attachmentMimeType = null
  let attachmentSizeBytes = null
  if (attachment) {
    const safeName = attachment.originalname.replace(/[^\w.-]/g, '_')
    const fileName = `support_${Date.now()}_${Math.floor(Math.random() * 10000)}_${safeName}`
    const filePath = path.join(uploadsDir, fileName)
    await fs.writeFile(filePath, attachment.buffer)
    attachmentUrl = `/uploads/${fileName}`
    attachmentName = attachment.originalname
    attachmentMimeType = attachment.mimetype || 'application/octet-stream'
    attachmentSizeBytes = attachment.size
  }

  const created = createSupportRequest(request.userId, {
    subject,
    message,
    attachmentName,
    attachmentUrl,
    attachmentMimeType,
    attachmentSizeBytes,
  })

  if (!created) {
    response.status(404).json({ message: 'Student profile not found.' })
    return
  }

  response.status(201).json(created)
})

app.patch('/support-requests/:id', authenticate, requireAdminPermission('manage_support_requests', 'You do not have permission to manage support requests.'), async (request, response) => {
  const status = typeof request.body?.status === 'string' ? request.body.status : undefined
  const adminReply = typeof request.body?.adminReply === 'string' ? request.body.adminReply.trim() : undefined

  if (typeof status !== 'undefined' && !isValidSupportStatus(status)) {
    response.status(400).json({ message: 'Support request status is invalid.' })
    return
  }

  if (typeof adminReply !== 'undefined' && adminReply.length > 2000) {
    response.status(400).json({ message: 'Admin reply must be 2000 characters or fewer.' })
    return
  }

  if (typeof status === 'undefined' && typeof adminReply === 'undefined') {
    response.status(400).json({ message: 'Provide a status or admin reply to update this request.' })
    return
  }

  const updated = updateSupportRequest(request.params.id, { status, adminReply })

  if (!updated) {
    response.status(404).json({ message: 'Support request not found.' })
    return
  }

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: updated.studentId,
    action: 'admin_update_support_request',
    details: {
      requestId: updated.id,
      status: updated.status,
      hasAdminReply: Boolean(adminReply && adminReply.trim()),
    },
  })

  if (typeof adminReply === 'string' && adminReply.trim()) {
    await notifyStudentOnAdminSupportReply(updated, adminReply)
  }

  response.json(updated)
})

app.delete('/support-requests/:id', authenticate, requireAdminPermission('manage_support_requests', 'You do not have permission to delete support requests.'), (request, response) => {
  const deleted = deleteSupportRequestById(request.params.id)
  if (!deleted) {
    response.status(404).json({ message: 'Support request not found.' })
    return
  }
  response.status(204).end()
})

app.post('/support-requests/:id/messages', authenticate, upload.single('attachment'), async (request, response) => {
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : ''
  const attachment = request.file ?? null

  if (!attachment && (message.length < 2 || message.length > 2000)) {
    response.status(400).json({ message: 'Message must be between 2 and 2000 characters long, or include an attachment.' })
    return
  }
  if (attachment && message.length > 2000) {
    response.status(400).json({ message: 'Message must be 2000 characters or fewer.' })
    return
  }
  if (attachment && attachment.size > 10 * 1024 * 1024) {
    response.status(400).json({ message: 'Attachment size must be 10MB or less.' })
    return
  }

  let attachmentUrl = null
  let attachmentName = null
  let attachmentMimeType = null
  let attachmentSizeBytes = null
  if (attachment) {
    const safeName = attachment.originalname.replace(/[^\w.-]/g, '_')
    const fileName = `support_${Date.now()}_${Math.floor(Math.random() * 10000)}_${safeName}`
    const filePath = path.join(uploadsDir, fileName)
    await fs.writeFile(filePath, attachment.buffer)
    attachmentUrl = `/uploads/${fileName}`
    attachmentName = attachment.originalname
    attachmentMimeType = attachment.mimetype || 'application/octet-stream'
    attachmentSizeBytes = attachment.size
  }

  if (request.userRole === 'admin') {
    if (!request.adminPermissions.includes('manage_support_requests')) {
      response.status(403).json({ message: 'You do not have permission to reply to support requests.' })
      return
    }
    const updated = addSupportRequestMessage(request.params.id, {
      senderRole: 'admin',
      senderId: request.userId,
      message,
      attachmentName,
      attachmentUrl,
      attachmentMimeType,
      attachmentSizeBytes,
    })
    if (!updated) {
      response.status(404).json({ message: 'Support request not found.' })
      return
    }
    insertActivityLog({
      adminId: request.userId,
      targetProfileId: updated.studentId,
      action: 'admin_send_support_message',
      details: {
        requestId: updated.id,
        hasAttachment: Boolean(attachmentUrl),
      },
    })
    await notifyStudentOnAdminSupportReply(updated, message || 'Admin shared an attachment.')
    response.status(201).json(updated)
    return
  }

  const ownRequest = listSupportRequests({ studentId: request.userId }).find((item) => item.id === request.params.id)
  if (!ownRequest) {
    response.status(404).json({ message: 'Support request not found.' })
    return
  }
  const updated = addSupportRequestMessage(request.params.id, {
    senderRole: 'student',
    senderId: request.userId,
    message,
    attachmentName,
    attachmentUrl,
    attachmentMimeType,
    attachmentSizeBytes,
  })
  if (!updated) {
    response.status(404).json({ message: 'Support request not found.' })
    return
  }
  response.status(201).json(updated)
})

app.get('/semester-registrations', authenticate, (request, response) => {
  if (request.userRole === 'admin') {
    if (!request.adminPermissions.includes('manage_student_profiles')) {
      response.status(403).json({ message: 'You do not have permission to view semester registrations.' })
      return
    }
    response.json({ data: listSemesterRegistrations() })
    return
  }
  response.json({ data: listSemesterRegistrations({ studentId: request.userId }) })
})

app.post('/semester-registrations', authenticate, (request, response) => {
  if (request.userRole !== 'student') {
    response.status(403).json({ message: 'Only students can request semester registration.' })
    return
  }
  const requestedSemester = typeof request.body?.requestedSemester === 'string' ? request.body.requestedSemester.trim() : ''
  if (!requestedSemester || requestedSemester.length > 80) {
    response.status(400).json({ message: 'Requested semester is required and must be 80 characters or fewer.' })
    return
  }
  const created = createSemesterRegistration(request.userId, requestedSemester)
  if (!created) {
    response.status(404).json({ message: 'Student profile not found.' })
    return
  }
  response.status(201).json(created)
})

app.patch('/semester-registrations/:id', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to approve semester registrations.'), (request, response) => {
  const status = request.body?.status === 'approved' || request.body?.status === 'rejected' ? request.body.status : 'pending'
  const adminNote = typeof request.body?.adminNote === 'string' ? request.body.adminNote : ''
  const updated = updateSemesterRegistrationStatus(request.params.id, { status, adminNote, resolvedByAdminId: request.userId })
  if (!updated) {
    response.status(404).json({ message: 'Semester registration request not found.' })
    return
  }

  if (updated.status === 'approved') {
    const profile = getProfileById(updated.studentId)
    if (profile) {
      const curriculum = findCurriculumForStudent(profile)
      if (curriculum) {
        const kiuUnits = getSemesterUnits(curriculum, updated.requestedSemester)
        if (Array.isArray(kiuUnits) && kiuUnits.length > 0) {
          const { course_units, exams } = buildSyncPayloadFromKiuUnits(profile.id, kiuUnits)
          adminUpdateStudentProfile(profile.id, {
            semester: updated.requestedSemester,
            course_units,
            exams,
          })
        } else {
          adminUpdateStudentProfile(profile.id, { semester: updated.requestedSemester })
        }
      } else {
        adminUpdateStudentProfile(profile.id, { semester: updated.requestedSemester })
      }
    }
  }

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: updated.studentId,
    action: 'admin_review_semester_registration',
    details: {
      registrationId: updated.id,
      status: updated.status,
      requestedSemester: updated.requestedSemester,
      adminNote: updated.adminNote ?? '',
    },
  })

  response.json(updated)
})

app.delete('/semester-registrations/:id', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to delete semester registrations.'), (request, response) => {
  const deleted = deleteSemesterRegistrationById(request.params.id)
  if (!deleted) {
    response.status(404).json({ message: 'Semester registration request not found.' })
    return
  }
  response.status(204).end()
})

app.post('/admin/advance-semester', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to advance student semesters.'), (request, response) => {
  if (request.adminScope !== 'super-admin') {
    response.status(403).json({ message: 'Only the super admin can advance student semesters.' })
    return
  }
  const allStudents = listProfiles('student')
  const settings = getSystemSettings()
  let advanced = 0
  let carryDebt = 0
  let skipped = 0

  for (const profile of allStudents) {
    const currentSemester = profile.semester
    if (!currentSemester) {
      skipped++
      continue
    }
    const currentIdx = KIU_SEMESTERS.indexOf(currentSemester)
    if (currentIdx === -1 || currentIdx >= KIU_SEMESTERS.length - 1) {
      skipped++
      continue
    }
    const nextSemester = KIU_SEMESTERS[currentIdx + 1]
    const newSemesterFee = profile.student_category === 'international'
      ? settings.international_student_fee
      : settings.local_student_fee
    const totalFees = Number(profile.total_fees ?? 0)
    const amountPaid = Number(profile.amount_paid ?? 0)
    const debt = totalFees - amountPaid

    if (debt > 0.001) {
      // Carry outstanding debt forward: new total = debt + next semester fee, paid resets to 0
      updateProfileFinancials(profile.id, 0, Number((debt + newSemesterFee).toFixed(2)))
      adminUpdateStudentProfile(profile.id, { semester: nextSemester })
      carryDebt++
    } else {
      // Fully cleared: fresh start for next semester
      updateProfileFinancials(profile.id, 0, Number(newSemesterFee.toFixed(2)))
      adminUpdateStudentProfile(profile.id, { semester: nextSemester })
    }
    advanced++
  }

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.userId,
    action: 'admin_advance_all_semesters',
    details: { advanced, carryDebt, skipped },
  })

  response.json({ advanced, carryDebt, skipped })
})

app.post('/imports/financials/preview', authenticate, requireAdminPermission('manage_financials', 'You do not have permission to preview financial imports.'), upload.single('file'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'No file was uploaded.' })
    return
  }

  try {
    const rows = await parseSpreadsheetRows(request.file.buffer, request.file.originalname)
    response.json({ data: resolveImportPreview(rows) })
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to parse the uploaded spreadsheet.' })
  }
})

app.post('/imports/financials/apply', authenticate, requireAdminPermission('manage_financials', 'You do not have permission to apply financial imports.'), upload.single('file'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'No file was uploaded.' })
    return
  }

  let rows

  try {
    rows = await parseSpreadsheetRows(request.file.buffer, request.file.originalname)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to parse the uploaded spreadsheet.' })
    return
  }

  const previewRows = resolveImportPreview(rows)
  const skippedRows = []
  let updatedCount = 0
  let createdCount = 0
  const createdStudents = []

  for (const row of previewRows) {
    if (row.status === 'ready' && row.studentRecordId) {
      updateProfileFinancials(row.studentRecordId, row.amountPaid, row.totalFees)
      insertActivityLog({
        adminId: request.userId,
        targetProfileId: row.studentRecordId,
        action: 'bulk_import_student_financials',
        details: {
          rowNumber: row.rowNumber,
          amountPaid: row.amountPaid,
          totalFees: row.totalFees,
        },
      })

      updatedCount += 1
      continue
    }

    if (row.status === 'create') {
      const importedStudent = buildImportedStudentInput(row, request.user)

      if (!importedStudent.createStudent) {
        skippedRows.push({ rowNumber: row.rowNumber, reason: importedStudent.reason ?? 'Unable to create this student account.' })
        continue
      }

      try {
        const createdProfile = createStudentProfile(importedStudent.createStudent)
        insertActivityLog({
          adminId: request.userId,
          targetProfileId: createdProfile.id,
          action: 'bulk_import_create_student_profile',
          details: {
            rowNumber: row.rowNumber,
            studentId: importedStudent.createStudent.student_id,
            email: importedStudent.createStudent.email,
            course: importedStudent.createStudent.course,
            totalFees: importedStudent.createStudent.total_fees,
            amountPaid: importedStudent.createStudent.amount_paid,
          },
          campusId: request.user?.campusId,
          campusName: request.user?.campusName,
        })

        createdCount += 1
        createdStudents.push({
          rowNumber: row.rowNumber,
          name: createdProfile.name,
          email: createdProfile.email,
          studentId: createdProfile.student_id,
          password: importedStudent.createStudent.password,
        })
      } catch (error) {
        skippedRows.push({
          rowNumber: row.rowNumber,
          reason: error instanceof Error ? error.message : 'Unable to create this student account.',
        })
      }

      continue
    }

    if (!row.studentRecordId) {
      skippedRows.push({ rowNumber: row.rowNumber, reason: row.reason ?? 'No matching student was found.' })
      continue
    }
  }

  await fs.writeFile(path.join(uploadsDir, `${Date.now()}-${request.file.originalname}`), request.file.buffer)

  response.json({ updatedCount, createdCount, createdStudents, skippedRows })
})

app.post('/imports/students/preview', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to import student accounts.'), upload.single('file'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'No file was uploaded.' })
    return
  }

  try {
    const rows = await parseStudentProvisionSpreadsheet(request.file.buffer, request.file.originalname)
    const settings = getSystemSettings()
    const data = resolveStudentProvisionPreview(rows, settings.local_student_fee, request.user)
    response.json({ data })
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to parse the student import file.' })
  }
})

app.post('/imports/students/apply', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to import student accounts.'), upload.single('file'), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: 'No file was uploaded.' })
    return
  }

  let rows

  try {
    rows = await parseStudentProvisionSpreadsheet(request.file.buffer, request.file.originalname)
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'Unable to parse the student import file.' })
    return
  }

  const settings = getSystemSettings()
  const previewRows = resolveStudentProvisionPreview(rows, settings.local_student_fee, request.user)
  let createdCount = 0
  const skippedRows = []
  const createdStudents = []

  for (const row of previewRows) {
    if (row.status !== 'create') {
      if (row.status === 'skipped') {
        skippedRows.push({ rowNumber: row.rowNumber, reason: row.reason ?? 'Skipped' })
      }
      continue
    }

    const imported = buildImportedStudentInput(row, request.user)

    if (!imported.createStudent) {
      skippedRows.push({ rowNumber: row.rowNumber, reason: imported.reason ?? 'Unable to create this student account.' })
      continue
    }

    try {
      const createdProfile = createStudentProfile(imported.createStudent)
      insertActivityLog({
        adminId: request.userId,
        targetProfileId: createdProfile.id,
        action: 'bulk_import_student_accounts',
        details: {
          rowNumber: row.rowNumber,
          studentId: imported.createStudent.student_id,
          email: imported.createStudent.email,
          source: 'student_spreadsheet',
        },
        campusId: request.user?.campusId,
        campusName: request.user?.campusName,
      })

      createdCount += 1
      createdStudents.push({
        rowNumber: row.rowNumber,
        name: createdProfile.name,
        email: createdProfile.email,
        studentId: createdProfile.student_id,
        password: imported.createStudent.password,
      })
    } catch (error) {
      skippedRows.push({
        rowNumber: row.rowNumber,
        reason: error instanceof Error ? error.message : 'Unable to create this student account.',
      })
    }
  }

  await fs.writeFile(path.join(uploadsDir, `students-${Date.now()}-${request.file.originalname}`), request.file.buffer)

  response.json({ createdCount, createdStudents, skippedRows })
})

app.post('/integrations/students/batch', requireStudentProvisionApiKey, (request, response) => {
  const students = request.body?.students

  if (!Array.isArray(students)) {
    response.status(400).json({ message: 'JSON body must include a students array.' })
    return
  }

  if (students.length === 0) {
    response.status(400).json({ message: 'The students array must not be empty.' })
    return
  }

  if (students.length > 500) {
    response.status(400).json({ message: 'Maximum 500 students per request. Send multiple batches for larger cohorts.' })
    return
  }

  const created = []
  const skipped = []

  for (let index = 0; index < students.length; index += 1) {
    const normalized = normalizeBatchStudentPayload(students[index])

    if (normalized.error) {
      skipped.push({ index, reason: normalized.error })
      continue
    }

    try {
      const conflict = getIdentityConflictMessage({
        email: normalized.createStudent.email,
        phoneNumber: null,
        studentId: normalized.createStudent.student_id,
      })

      if (conflict) {
        skipped.push({ index, email: normalized.createStudent.email, reason: conflict })
        continue
      }

      const profile = createStudentProfile(normalized.createStudent)
      const opsAdmin = listProfiles('admin')[0]
      if (opsAdmin) {
        insertActivityLog({
          adminId: opsAdmin.id,
          targetProfileId: profile.id,
          action: 'api_batch_create_student',
          details: {
            index,
            studentId: profile.student_id,
            email: profile.email,
          },
        })
      }
      created.push({ id: profile.id, email: profile.email, student_id: profile.student_id })
    } catch (error) {
      skipped.push({
        index,
        reason: error instanceof Error ? error.message : 'Unable to create student.',
      })
    }
  }

  response.json({
    createdCount: created.length,
    created,
    skippedCount: skipped.length,
    skipped,
  })
})

app.get('/auth/oidc/status', (_request, response) => {
  response.json({
    enabled: oidcFlow.isOidcConfigured(),
    issuer: process.env.OIDC_ISSUER?.trim() ?? null,
  })
})

app.get('/auth/oidc/start', async (_request, response) => {
  try {
    if (!oidcFlow.isOidcConfigured()) {
      response.status(503).json({ message: 'University SSO (OIDC) is not configured on this server.' })
      return
    }

    const url = await oidcFlow.beginOidcLogin()
    response.redirect(url)
  } catch (error) {
    response.status(500).json({ message: error instanceof Error ? error.message : 'Unable to start university sign-in.' })
  }
})

app.get('/auth/oidc/callback', async (request, response) => {
  try {
    if (!oidcFlow.isOidcConfigured()) {
      response.status(503).send('SSO is not configured.')
      return
    }

    const callbackUrl = `${request.protocol}://${request.get('host')}${request.originalUrl}`
    const { email } = await oidcFlow.finishOidcLogin(callbackUrl)
    const user = getUserByEmail(email)

    if (!user || user.role !== 'student') {
      response
        .status(403)
        .send(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem"><p>No student profile is linked to <strong>${email}</strong>.</p><p>Ask your registrar to provision your account (bulk file or API), then try again.</p></body></html>`)
      return
    }

    const token = createSession(user.id, sessionTtlHours)
    const front = String(process.env.FRONTEND_ORIGIN).replace(/\/$/, '')
    response.redirect(`${front}/login#oidc_token=${encodeURIComponent(token)}`)
  } catch (error) {
    response.status(400).send(error instanceof Error ? error.message : 'SSO callback failed.')
  }
})


import net from 'net'

async function findAvailablePort(startPort, maxAttempts = 10) {
  let port = startPort
  for (let i = 0; i < maxAttempts; i++) {
    const isFree = await new Promise((resolve) => {
      const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
          tester.close(() => resolve(true))
        })
        .listen(port)
    })
    if (isFree) return port
    port++
  }
  throw new Error(`No available port found starting from ${startPort}`)
}

// ── Support-desk helpers (no auth required) ──────────────────────────────────

app.get('/public/support-contacts', (_request, response) => {
  // Return support_help sub-admins + main admin contacts for the login page
  const subAdmins = listAssistantAdmins()
    .filter((a) => a.role === 'support_help')
    .map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phoneNumber: a.phoneNumber || 'Not assigned',
      scope: 'support',
    }))

  const admins = listProfiles('admin')
    .filter((p) => p.role === 'admin')
    .slice(0, 2)
    .map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      phoneNumber: p.phoneNumber ?? 'Not assigned',
      scope: 'super-admin',
    }))

  response.json({ data: [...subAdmins, ...admins] })
})

// ── Support-desk: student identity verification ───────────────────────────────

app.post('/admin/support/verify-student', authenticate, requireAdminPermission('manage_support_requests', 'You do not have permission to verify student identities.'), (request, response) => {
  const identifier = typeof request.body?.identifier === 'string' ? request.body.identifier.trim() : ''
  const verification = typeof request.body?.verification === 'string' ? request.body.verification.trim() : ''

  if (!identifier || !verification) {
    response.status(400).json({ message: 'Provide the student identifier and the second verification detail.' })
    return
  }

  const user = resolveUserByIdentifier(identifier)
  const profile = user ? getProfileById(user.id) : null

  if (!user || !profile || profile.role !== 'student') {
    response.status(404).json({ verified: false, message: 'No matching student account found for the provided identifier.' })
    return
  }

  const matches = doesVerificationMatchProfile(profile, user, identifier, verification)
  if (!matches) {
    response.status(400).json({ verified: false, message: 'The second detail did not match this student\'s registered information.' })
    return
  }

  response.json({
    verified: true,
    studentId: profile.id,
    name: profile.name,
    email: profile.email,
    registrationNumber: profile.studentId ?? '',
    course: profile.course ?? '',
    department: profile.department ?? '',
    phoneNumber: profile.phoneNumber ?? '',
  })
})

// ── Support-desk: admin-initiated password reset ──────────────────────────────

app.post('/admin/support/reset-student-password', authenticate, requireAdminPermission('manage_support_requests', 'You do not have permission to reset student passwords.'), (request, response) => {
  const studentId = typeof request.body?.studentId === 'string' ? request.body.studentId.trim() : ''
  const newPassword = typeof request.body?.newPassword === 'string' ? request.body.newPassword.trim() : ''

  if (!studentId) {
    response.status(400).json({ message: 'Student ID is required.' })
    return
  }

  if (!isStrongPassword(newPassword)) {
    response.status(400).json({ message: 'New password must be at least 8 characters with uppercase, lowercase, number, and special character.' })
    return
  }

  const user = getProfileById(studentId)
  if (!user || user.role !== 'student') {
    response.status(404).json({ message: 'Student not found.' })
    return
  }

  resetUserPassword(studentId, newPassword)

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: studentId,
    action: 'admin_reset_student_password',
    details: {
      resetBy: request.userId,
      studentName: user.name,
    },
  })

  response.json({ message: `Password for ${user.name} has been reset successfully.` })
})

let shuttingDown = false

app.use((error, _request, response, next) => {
  void next
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      response.status(400).json({ message: 'Uploaded file is too large. Use a file under 2 MB.' })
      return
    }

    response.status(400).json({ message: error.message })
    return
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ message: 'Invalid JSON body.' })
    return
  }

  console.error(error)
  response.status(500).json({ message: 'Internal server error.' })
})


startServer()

async function startServer() {
  const startPort = Number(process.env.PORT ?? 4000)
  let port
  try {
    port = process.env.REST_BIND_STRICT === '1' ? startPort : await findAvailablePort(startPort)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
  process.env.PORT = String(port)
  const server = app.listen(port, () => {
    console.log(`REST backend starter listening on http://localhost:${port}`)
  })

  // Attach shutdown logic to server
  function shutdown(signal) {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    console.log(`Received ${signal}. Closing REST backend starter...`)
    server.close((error) => {
      if (error) {
        console.error('Failed to close the HTTP server cleanly.', error)
        process.exit(1)
        return
      }
      console.log('REST backend starter stopped cleanly.')
      process.exit(0)
    })
    setTimeout(() => {
      console.error('Forced shutdown after waiting 10 seconds for active requests to finish.')
      process.exit(1)
    }, 10_000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception in REST backend starter.', error)
    shutdown('uncaughtException')
  })
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection in REST backend starter.', reason)
    shutdown('unhandledRejection')
  })
}
