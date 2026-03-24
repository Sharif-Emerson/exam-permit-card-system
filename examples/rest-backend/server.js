import fs from 'node:fs/promises'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import readXlsxFile from 'read-excel-file/node'
import './lib/load-env.js'
import {
  createSession,
  createStudentProfile,
  createSupportRequest,
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
  listProfilesPage,
  listTrashedStudentProfiles,
  listSupportRequests,
  resetUserPassword,
  restoreStudentProfile,
  revokeSession,
  updateSupportRequest,
  updateStudentAccount,
  updateSystemSettings,
  updateProfileFinancials,
  verifyPassword,
} from './lib/database.js'

const app = express()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
})

const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? '12')
const uploadsDir = getUploadsDir()
const corsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null

app.use(cors({
  origin(origin, callback) {
    if (!origin || !corsAllowedOrigins || corsAllowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Origin is not allowed by CORS.'))
  },
}))
app.use(express.json({ limit: '256kb' }))
app.use((request, response, next) => {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.setHeader('Pragma', 'no-cache')
  response.setHeader('Expires', '0')

  next()
})

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

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
    && value <= 1_000_000
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
        password: normalizedRow.password ? String(normalizedRow.password).trim() : undefined,
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
  if (typeof row.password === 'string' && row.password.trim()) {
    return row.password.trim()
  }

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

  return {
    createStudent: {
      name: row.studentName,
      email: row.email,
      password: getImportedStudentPassword(row),
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
    return 'operations'
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

  if (scope === 'super-admin' || scope === 'registrar' || scope === 'finance' || scope === 'operations') {
    return fullAdminPermissions
  }

  return []
}

function createAuthenticatedUser(user) {
  if (user.role !== 'admin') {
    return user
  }

  return {
    ...user,
    scope: resolveAdminScope(user),
    permissions: getAdminPermissions(user),
  }
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
    return true
  }

  return request.userId === profile.id
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
          reason: row.password?.trim()
            ? 'New student account will be created with the provided password.'
            : `New student account will be created with temporary password ${importedStudent.createStudent.password}.`,
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
  response.json({ ok: true, database: getConfiguredDbPath() })
})

app.get('/system-settings', authenticate, (request, response) => {
  if (request.userRole !== 'admin') {
    response.status(403).json({ message: 'Administrator access is required.' })
    return
  }

  response.json(getSystemSettings())
})

app.put('/system-settings', authenticate, requireAdminPermission('manage_financials', 'You do not have permission to update fee settings.'), (request, response) => {
  const localStudentFee = parseNumber(request.body.local_student_fee)
  const internationalStudentFee = parseNumber(request.body.international_student_fee)

  if (!isValidCurrencyAmount(localStudentFee) || !isValidCurrencyAmount(internationalStudentFee)) {
    response.status(400).json({ message: 'Both local and international student fees must be valid non-negative amounts.' })
    return
  }

  const updatedSettings = updateSystemSettings({
    local_student_fee: localStudentFee,
    international_student_fee: internationalStudentFee,
  })

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

app.get('/permits/:token', (request, response) => {
  const permit = getPermitByToken(request.params.token)

  if (!permit) {
    response.status(404).json({ message: 'Permit not found.' })
    return
  }

  response.json(permit)
})

app.post('/auth/login', (request, response) => {
  const identifier = typeof request.body?.identifier === 'string' ? request.body.identifier.trim() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''

  if (!identifier || password.length < 8 || password.length > 128) {
    response.status(400).json({ message: 'Email, phone number, or registration number and password are required.' })
    return
  }

  const user = resolveUserByIdentifier(identifier)

  if (!user || !verifyPassword(password, user.password_hash)) {
    response.status(401).json({ message: 'Invalid login credentials.' })
    return
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
    }),
  })
})

app.post('/auth/reset-password', (request, response) => {
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

app.post('/profiles', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to manage student profiles.'), (request, response) => {
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : ''
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body.password === 'string' ? request.body.password.trim() : ''
  const studentId = typeof request.body.student_id === 'string' ? request.body.student_id.trim() : ''
  const studentCategory = parseStudentCategory(request.body.student_category)
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
    response.status(400).json({ message: 'A valid email address is required.' })
    return
  }

  if (password.length < 8 || password.length > 128) {
    response.status(400).json({ message: 'Password must be between 8 and 128 characters long.' })
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

  if (studentCategory === null) {
    response.status(400).json({ message: 'Student category must be either local or international.' })
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
      password,
      student_id: studentId,
      student_category: resolvedStudentCategory,
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

  const name = typeof request.body.name === 'string' ? request.body.name.trim() : undefined
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : undefined
  const studentId = typeof request.body.student_id === 'string' ? request.body.student_id.trim() : undefined
  const studentCategory = parseStudentCategory(request.body.student_category)
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

  response.json(profile)
})

app.get('/profiles', authenticate, requireAdminPermission('view_students', 'You do not have permission to view student records.'), (request, response) => {
  const { role, search, status, page, pageSize } = request.query

  if (typeof page !== 'undefined' || typeof pageSize !== 'undefined' || typeof search === 'string' || typeof status === 'string') {
    const result = listProfilesPage({
      role: typeof role === 'string' ? role : undefined,
      search: typeof search === 'string' ? search : undefined,
      status: status === 'paid' || status === 'outstanding' ? status : 'all',
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
  const phoneNumber = typeof request.body.phoneNumber === 'string' ? normalizePhoneNumber(request.body.phoneNumber) : undefined
  const currentPassword = typeof request.body.currentPassword === 'string' ? request.body.currentPassword : undefined
  const password = typeof request.body.password === 'string' ? request.body.password : undefined
  const profileImage = typeof request.body.profileImage === 'string'
    ? request.body.profileImage
    : request.body.profileImage === null
      ? null
      : undefined

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

  insertActivityLog({
    adminId: request.userId,
    targetProfileId: request.params.id,
    action: 'update_student_financials',
    details: {
      amountPaid: request.body.amountPaid,
      totalFees: request.body.totalFees,
    },
  })

  response.json(updatedProfile)
})

app.get('/profiles-trash', authenticate, requireAdminPermission('manage_student_profiles', 'You do not have permission to access deleted student records.'), (_request, response) => {
  response.json({ items: listTrashedStudentProfiles() })
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
    .filter((entry) => entry.targetProfileId === requestedStudentId && (entry.action === 'print_permit' || entry.action === 'download_permit'))
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
            : 'operations',
    }))

  response.json({ data })
})

app.post('/support-requests', authenticate, (request, response) => {
  if (request.userRole !== 'student') {
    response.status(403).json({ message: 'Only student accounts can create support requests.' })
    return
  }

  const subject = typeof request.body?.subject === 'string' ? request.body.subject.trim() : ''
  const message = typeof request.body?.message === 'string' ? request.body.message.trim() : ''

  if (subject.length < 4 || subject.length > 120) {
    response.status(400).json({ message: 'Subject must be between 4 and 120 characters long.' })
    return
  }

  if (message.length < 10 || message.length > 2000) {
    response.status(400).json({ message: 'Message must be between 10 and 2000 characters long.' })
    return
  }

  const created = createSupportRequest(request.userId, { subject, message })

  if (!created) {
    response.status(404).json({ message: 'Student profile not found.' })
    return
  }

  response.status(201).json(created)
})

app.patch('/support-requests/:id', authenticate, requireAdminPermission('manage_support_requests', 'You do not have permission to manage support requests.'), (request, response) => {
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

  response.json(updated)
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

const port = Number(process.env.PORT ?? 4000)

app.use((error, _request, response) => {
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

app.listen(port, () => {
  console.log(`REST backend starter listening on http://localhost:${port}`)
})