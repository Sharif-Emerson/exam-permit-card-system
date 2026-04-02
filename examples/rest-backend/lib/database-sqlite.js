import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { getBootstrapAdmins, getBootstrapProfiles } from './bootstrap-admins.js'
import { assertNoStudentExamTimeConflicts } from './exam-schedule-validation.js'
import { signPermitPayload } from './permit-integrity.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
const dataDir = path.resolve(backendRoot, 'data')
const seedFile = path.join(dataDir, 'seed.json')
const defaultDbPath = path.join(dataDir, 'app.sqlite')
const configuredUploadsDir = process.env.APP_UPLOADS_DIR?.trim()
const uploadsDir = configuredUploadsDir
  ? path.resolve(backendRoot, configuredUploadsDir)
  : path.resolve(backendRoot, 'uploads')

const configuredDbPath = process.env.APP_DB_PATH?.trim()
const dbPath = configuredDbPath
  ? path.resolve(backendRoot, configuredDbPath)
  : defaultDbPath

await fs.mkdir(path.dirname(dbPath), { recursive: true })
await fs.mkdir(uploadsDir, { recursive: true })

const db = new Database(dbPath)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

const defaultSystemFeeSettings = Object.freeze({
  local_student_fee: 3000,
  international_student_fee: 6000,
  currency_code: 'USD',
})
const fallbackStudentProfileImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><rect width='160' height='160' fill='%23e2e8f0'/><circle cx='80' cy='58' r='28' fill='%2394a3b8'/><path d='M36 132c8-24 28-36 44-36s36 12 44 36' fill='%2394a3b8'/></svg>"
const trashRetentionDays = Math.max(Number(process.env.TRASH_RETENTION_DAYS ?? '30') || 30, 1)

db.exec(`
  CREATE TABLE IF NOT EXISTS campuses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
    admin_scope TEXT CHECK (admin_scope IN ('super-admin', 'registrar', 'finance', 'operations', 'assistant-admin')),
    assistant_role TEXT CHECK (assistant_role IN ('support_help', 'department_prints')),
    assistant_departments_json TEXT NOT NULL DEFAULT '[]',
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
    name TEXT NOT NULL,
    student_id TEXT,
    student_category TEXT NOT NULL DEFAULT 'local' CHECK (student_category IN ('local', 'international')),
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'on_leave', 'graduated')),
    course TEXT,
    program TEXT,
    college TEXT,
    department TEXT,
    semester TEXT,
    course_units_json TEXT NOT NULL DEFAULT '[]',
    exam_date TEXT,
    exam_time TEXT,
    venue TEXT,
    seat_number TEXT,
    instructions TEXT,
    profile_image TEXT,
    permit_token TEXT,
    exams_json TEXT NOT NULL DEFAULT '[]',
    total_fees REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    first_login_required INTEGER NOT NULL DEFAULT 0 CHECK (first_login_required IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_id
  ON profiles(student_id)
  WHERE student_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS profile_exams (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    title TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    exam_time TEXT NOT NULL,
    venue TEXT NOT NULL,
    seat_number TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_profile_exams_profile_id
  ON profile_exams(profile_id);

  CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    target_profile_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(target_profile_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS support_requests (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    admin_reply TEXT NOT NULL DEFAULT '',
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(student_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    local_student_fee REAL NOT NULL DEFAULT 3000,
    international_student_fee REAL NOT NULL DEFAULT 6000,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS support_request_messages (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'admin')),
    sender_id TEXT NOT NULL,
    message TEXT NOT NULL,
    attachment_name TEXT,
    attachment_url TEXT,
    attachment_mime_type TEXT,
    attachment_size_bytes INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES support_requests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS semester_registrations (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    requested_semester TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT NOT NULL DEFAULT '',
    resolved_by_admin_id TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trashed_profiles (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    student_id TEXT,
    deleted_at TEXT NOT NULL,
    purge_after_at TEXT NOT NULL,
    deleted_by_admin_id TEXT,
    restored_at TEXT,
    restored_by_admin_id TEXT,
    snapshot_json TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_trashed_profiles_deleted_at ON trashed_profiles(deleted_at DESC);
  CREATE INDEX IF NOT EXISTS idx_trashed_profiles_purge_after_at ON trashed_profiles(purge_after_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_trashed_profiles_active_profile_id ON trashed_profiles(profile_id)
  WHERE restored_at IS NULL;
`)

function hasColumn(tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName)
}

function ensureColumn(tableName, columnDefinition) {
  const columnName = columnDefinition.trim().split(/\s+/, 1)[0]

  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`)
  }
}

ensureColumn('users', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
ensureColumn('users', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")
ensureColumn('users', 'phone_number TEXT')
ensureColumn('users', "admin_scope TEXT CHECK (admin_scope IN ('super-admin', 'registrar', 'finance', 'operations', 'assistant-admin'))")
ensureColumn('users', "assistant_role TEXT CHECK (assistant_role IN ('support_help', 'department_prints'))")
ensureColumn('users', "assistant_departments_json TEXT NOT NULL DEFAULT '[]'")
ensureColumn('profiles', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
ensureColumn('profiles', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")
ensureColumn('profiles', 'phone_number TEXT')
ensureColumn('profiles', "student_category TEXT NOT NULL DEFAULT 'local'")
ensureColumn('profiles', "gender TEXT CHECK (gender IN ('male', 'female', 'other'))")
ensureColumn('profiles', "enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'on_leave', 'graduated'))")
ensureColumn('profiles', "first_login_required INTEGER NOT NULL DEFAULT 0 CHECK (first_login_required IN (0, 1))")
ensureColumn('profiles', 'permit_token TEXT')
ensureColumn('profiles', 'permit_print_grant_month TEXT')
ensureColumn('profiles', 'permit_print_grants_remaining INTEGER NOT NULL DEFAULT 0')
ensureColumn('profiles', "exams_json TEXT NOT NULL DEFAULT '[]'")
ensureColumn('profiles', 'program TEXT')
ensureColumn('profiles', 'college TEXT')
ensureColumn('profiles', 'department TEXT')
ensureColumn('profiles', 'semester TEXT')
ensureColumn('profiles', "course_units_json TEXT NOT NULL DEFAULT '[]'")
ensureColumn('system_settings', "deadlines_json TEXT NOT NULL DEFAULT '[]'")
ensureColumn('system_settings', "currency_code TEXT NOT NULL DEFAULT 'USD'")
ensureColumn('admin_activity_logs', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
ensureColumn('admin_activity_logs', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")
ensureColumn('support_request_messages', 'attachment_name TEXT')
ensureColumn('support_request_messages', 'attachment_url TEXT')
ensureColumn('support_request_messages', 'attachment_mime_type TEXT')
ensureColumn('support_request_messages', 'attachment_size_bytes INTEGER')

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_campus_id ON users(campus_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number) WHERE phone_number IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_profiles_campus_id ON profiles(campus_id);
  CREATE INDEX IF NOT EXISTS idx_profiles_role_name ON profiles(role, name);
  CREATE INDEX IF NOT EXISTS idx_profiles_role_email ON profiles(role, email);
  CREATE INDEX IF NOT EXISTS idx_profiles_role_phone_number ON profiles(role, phone_number);
  CREATE INDEX IF NOT EXISTS idx_profiles_role_student_id ON profiles(role, student_id);
  CREATE INDEX IF NOT EXISTS idx_profiles_role_program ON profiles(role, program);
  CREATE INDEX IF NOT EXISTS idx_profiles_role_department ON profiles(role, department);
  CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_campus_id ON admin_activity_logs(campus_id);
  CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON admin_activity_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_support_requests_student_id ON support_requests(student_id);
  CREATE INDEX IF NOT EXISTS idx_support_requests_status_updated_at ON support_requests(status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_support_request_messages_request_id ON support_request_messages(request_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_semester_registrations_student_id ON semester_registrations(student_id, created_at DESC);
`)

db.prepare(`
  UPDATE users
  SET campus_id = COALESCE(NULLIF(campus_id, ''), 'main-campus'),
      campus_name = COALESCE(NULLIF(campus_name, ''), 'Main Campus')
`).run()

db.prepare(`
  UPDATE users
  SET admin_scope = CASE
    WHEN role != 'admin' THEN NULL
    WHEN id = 'admin-1' THEN 'super-admin'
    WHEN id = 'admin-2' THEN 'registrar'
    WHEN id = 'admin-3' THEN 'finance'
    WHEN id = 'admin-4' THEN 'assistant-admin'
    WHEN admin_scope IS NOT NULL AND admin_scope != '' THEN admin_scope
    WHEN lower(email) = 'admin@example.com' THEN 'super-admin'
    WHEN lower(email) = 'registrar@example.com' THEN 'registrar'
    WHEN lower(email) = 'finance@example.com' THEN 'finance'
    WHEN lower(email) = 'operations@example.com' THEN 'assistant-admin'
    ELSE 'operations'
  END
`).run()

db.prepare(`
  UPDATE profiles
  SET campus_id = COALESCE(NULLIF(campus_id, ''), 'main-campus'),
  campus_name = COALESCE(NULLIF(campus_name, ''), 'Main Campus'),
  permit_token = COALESCE(NULLIF(permit_token, ''), ''),
  permit_print_grants_remaining = COALESCE(permit_print_grants_remaining, 0),
  exams_json = COALESCE(NULLIF(exams_json, ''), '[]'),
  course_units_json = COALESCE(NULLIF(course_units_json, ''), '[]')
`).run()

db.prepare(`
  UPDATE admin_activity_logs
  SET campus_id = COALESCE(NULLIF(campus_id, ''), 'main-campus'),
      campus_name = COALESCE(NULLIF(campus_name, ''), 'Main Campus')
`).run()

function nowIso() {
  return new Date().toISOString()
}

function addDaysIso(dateValue, days) {
  const baseDate = dateValue instanceof Date ? dateValue : new Date(dateValue)
  return new Date(baseDate.getTime() + (days * 24 * 60 * 60 * 1000)).toISOString()
}

function parseJsonValue(value, fallbackValue) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallbackValue
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallbackValue
  }
}

function normalizeStudentCategory(value) {
  return value === 'international' ? 'international' : 'local'
}

function normalizeEnrollmentStatus(value) {
  return value === 'on_leave' || value === 'graduated' ? value : 'active'
}

function normalizeNumber(value) {
  return typeof value === 'number' ? Number(value.toFixed(2)) : 0
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

function normalizeCurrencyCode(value) {
  const normalized = String(value ?? '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(normalized) ? normalized : defaultSystemFeeSettings.currency_code
}

function ensureSystemSettingsRow() {
  const existing = db.prepare('SELECT id FROM system_settings WHERE id = ?').get('default')

  if (existing) {
    return
  }

  const timestamp = nowIso()
  db.prepare(`
    INSERT INTO system_settings (id, local_student_fee, international_student_fee, currency_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'default',
    defaultSystemFeeSettings.local_student_fee,
    defaultSystemFeeSettings.international_student_fee,
    defaultSystemFeeSettings.currency_code,
    timestamp,
    timestamp,
  )
}

function mapSystemSettings(row) {
  const rawDeadlines = parseJsonValue(row?.deadlines_json, [])
  const deadlines = Array.isArray(rawDeadlines) ? rawDeadlines : []

  return {
    local_student_fee: normalizeNumber(row?.local_student_fee ?? defaultSystemFeeSettings.local_student_fee),
    international_student_fee: normalizeNumber(row?.international_student_fee ?? defaultSystemFeeSettings.international_student_fee),
    currency_code: normalizeCurrencyCode(row?.currency_code),
    deadlines,
  }
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derivedKey}`
}

export function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedKey] = String(passwordHash).split(':')

  if (algorithm !== 'scrypt' || !salt || !storedKey) {
    return false
  }

  const derivedKey = scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(storedKey, 'hex')

  if (derivedKey.length !== storedBuffer.length) {
    return false
  }

  return timingSafeEqual(derivedKey, storedBuffer)
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function createSessionExpiry(sessionTtlHours) {
  const ttlMs = Math.max(sessionTtlHours, 1) * 60 * 60 * 1000
  return new Date(Date.now() + ttlMs).toISOString()
}

function mapUser(row) {
  if (!row) {
    return null
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    admin_scope: row.admin_scope ?? null,
    assistant_role: row.assistant_role ?? null,
    assistant_departments_json: row.assistant_departments_json ?? '[]',
    name: row.name,
    campusId: row.campus_id,
    campusName: row.campus_name,
  }
}

function createPermitToken() {
  return randomBytes(18).toString('hex')
}

function createFallbackExamAssignments(fallbackProfile = null) {
  if (!fallbackProfile || (!fallbackProfile.exam_date && !fallbackProfile.exam_time && !fallbackProfile.venue && !fallbackProfile.seat_number)) {
    return []
  }

  return [
    {
      id: `${fallbackProfile.id}-exam-1`,
      title: fallbackProfile.course ? `${fallbackProfile.course} Exam` : 'Scheduled Exam',
      examDate: fallbackProfile.exam_date ?? 'Not scheduled',
      examTime: fallbackProfile.exam_time ?? 'Not scheduled',
      venue: fallbackProfile.venue ?? 'Not assigned',
      seatNumber: fallbackProfile.seat_number ?? 'Not assigned',
    },
  ]
}

function normalizeExamAssignments(value, fallbackProfile = null) {
  const source = Array.isArray(value) ? value : createFallbackExamAssignments(fallbackProfile)

  return source
    .filter((exam) => typeof exam === 'object' && exam !== null)
    .map((exam, index) => {
      const record = exam

      return {
        id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `${fallbackProfile?.id ?? 'profile'}-exam-${index + 1}`,
        title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : `Exam ${index + 1}`,
        examDate: typeof record.examDate === 'string' && record.examDate.trim() ? record.examDate.trim() : 'Not scheduled',
        examTime: typeof record.examTime === 'string' && record.examTime.trim() ? record.examTime.trim() : 'Not scheduled',
        venue: typeof record.venue === 'string' && record.venue.trim() ? record.venue.trim() : 'Not assigned',
        seatNumber: typeof record.seatNumber === 'string' && record.seatNumber.trim() ? record.seatNumber.trim() : 'Not assigned',
      }
    })
}

function serializeExamAssignments(exams) {
  return JSON.stringify(normalizeExamAssignments(exams))
}

function normalizeCourseUnits(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((unit) => String(unit ?? '').trim())
    .filter(Boolean)
}

function serializeCourseUnits(units) {
  return JSON.stringify(normalizeCourseUnits(units))
}

function parseCourseUnits(row) {
  if (Array.isArray(row?.course_units)) {
    return normalizeCourseUnits(row.course_units)
  }

  try {
    return normalizeCourseUnits(JSON.parse(row?.course_units_json ?? '[]'))
  } catch {
    return []
  }
}

function parseLegacyExamAssignments(row) {
  try {
    const parsed = JSON.parse(row.exams_json ?? '[]')
    return normalizeExamAssignments(parsed, row)
  } catch {
    return normalizeExamAssignments(null, row)
  }
}

function mapExamRecord(row) {
  return {
    id: row.id,
    title: row.title,
    examDate: row.exam_date,
    examTime: row.exam_time,
    venue: row.venue,
    seatNumber: row.seat_number,
  }
}

function normExamField(s) {
  return String(s ?? '').trim().toLowerCase()
}

function isPlaceholderExamDateValue(value) {
  const t = normExamField(value)
  return !t || t === 'not scheduled' || t === 'to be announced' || t === 'tba' || t === 'n/a'
}

function isPlaceholderExamTimeValue(value) {
  return isPlaceholderExamDateValue(value)
}

function isPlaceholderVenueValue(value) {
  const t = normExamField(value)
  return !t || t === 'not assigned' || t === 'to be announced' || t === 'tba' || t === 'n/a'
}

function isPlaceholderSeatValue(value) {
  const t = normExamField(value)
  return !t || t === 'not assigned' || t === 'to be assigned' || t === 'to be announced' || t === 'tba' || t === 'n/a'
}

/** Apply profiles.exam_date (and related) when unit rows still hold curriculum placeholders like “To be announced”. */
function mergeExamsWithProfileAnnouncements(profileRow, exams) {
  if (!Array.isArray(exams) || exams.length === 0) {
    return exams
  }

  const pd = profileRow?.exam_date?.trim()
  const pt = profileRow?.exam_time?.trim()
  const pv = profileRow?.venue?.trim()
  const ps = profileRow?.seat_number?.trim()
  const dateOk = pd && !isPlaceholderExamDateValue(pd)
  const timeOk = pt && !isPlaceholderExamTimeValue(pt)
  const venueOk = pv && !isPlaceholderVenueValue(pv)
  const seatOk = ps && !isPlaceholderSeatValue(ps)

  if (!dateOk && !timeOk && !venueOk && !seatOk) {
    return exams
  }

  return exams.map((exam) => ({
    ...exam,
    examDate: dateOk && isPlaceholderExamDateValue(exam.examDate) ? pd : exam.examDate,
    examTime: timeOk && isPlaceholderExamTimeValue(exam.examTime) ? pt : exam.examTime,
    venue: venueOk && isPlaceholderVenueValue(exam.venue) ? pv : exam.venue,
    seatNumber: seatOk && isPlaceholderSeatValue(exam.seatNumber) ? ps : exam.seatNumber,
  }))
}

function getPermitPrintMonthKey(dateValue = new Date()) {
  const year = dateValue.getUTCFullYear()
  const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getCurrentPermitPrintMonthKey() {
  return getPermitPrintMonthKey(new Date())
}

function getStudentPermitOutputCountForMonth(profileId, monthKey = getCurrentPermitPrintMonthKey()) {
  return Number(db.prepare(`
    SELECT COUNT(*) AS total
    FROM admin_activity_logs
    WHERE target_profile_id = ?
      AND action IN ('print_permit', 'download_permit')
      AND substr(created_at, 1, 7) = ?
  `).get(profileId, monthKey)?.total ?? 0)
}

function getStudentPermitAccess(row) {
  const monthKey = getCurrentPermitPrintMonthKey()
  const monthlyPrintCount = getStudentPermitOutputCountForMonth(row.id, monthKey)
  const grantedPrintsRemaining = row.permit_print_grant_month === monthKey
    ? Number(row.permit_print_grants_remaining ?? 0)
    : 0
  const monthlyPrintLimit = 2 + grantedPrintsRemaining
  const canPrintPermit = monthlyPrintCount < monthlyPrintLimit
  const printAccessMessage = canPrintPermit
    ? grantedPrintsRemaining > 0 && monthlyPrintCount >= 2
      ? `Administration has granted ${grantedPrintsRemaining} extra permit print ${grantedPrintsRemaining === 1 ? 'copy' : 'copies'} for this month.`
      : `You have used ${monthlyPrintCount} of ${monthlyPrintLimit} permit print copies this month.`
    : 'You have used your two monthly permit print copies. Contact administration to request extra print permission.'

  return {
    monthly_print_count: monthlyPrintCount,
    monthly_print_limit: monthlyPrintLimit,
    granted_prints_remaining: grantedPrintsRemaining,
    can_print_permit: canPrintPermit,
    print_access_message: printAccessMessage,
  }
}

function listProfileExamsByIds(profileIds) {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))]
  const examsByProfileId = new Map(uniqueIds.map((profileId) => [profileId, []]))

  if (uniqueIds.length === 0) {
    return examsByProfileId
  }

  const placeholders = uniqueIds.map(() => '?').join(', ')
  const rows = db.prepare(`
    SELECT * FROM profile_exams
    WHERE profile_id IN (${placeholders})
    ORDER BY exam_date ASC, exam_time ASC, title ASC
  `).all(...uniqueIds)

  for (const row of rows) {
    const collection = examsByProfileId.get(row.profile_id)

    if (collection) {
      collection.push(mapExamRecord(row))
    } else {
      examsByProfileId.set(row.profile_id, [mapExamRecord(row)])
    }
  }

  return examsByProfileId
}

function replaceProfileExams(profileId, exams) {
  const timestamp = nowIso()
  const normalizedExams = normalizeExamAssignments(exams, { id: profileId })
  assertNoStudentExamTimeConflicts(normalizedExams)
  const deleteStatement = db.prepare('DELETE FROM profile_exams WHERE profile_id = ?')
  const insertStatement = db.prepare(`
    INSERT INTO profile_exams (id, profile_id, title, exam_date, exam_time, venue, seat_number, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  deleteStatement.run(profileId)

  for (const exam of normalizedExams) {
    insertStatement.run(
      exam.id,
      profileId,
      exam.title,
      exam.examDate,
      exam.examTime,
      exam.venue,
      exam.seatNumber,
      timestamp,
      timestamp,
    )
  }

  return normalizedExams
}

function mapProfile(row, examsByProfileId = new Map()) {
  if (!row) {
    return null
  }

  let exams = examsByProfileId.get(row.id) ?? parseLegacyExamAssignments(row)
  if (row.role === 'student') {
    exams = mergeExamsWithProfileAnnouncements(row, exams)
  }
  const profile = { ...row }
  const permitAccess = row.role === 'student' ? getStudentPermitAccess(row) : {}
  delete profile.campus_id
  delete profile.campus_name
  delete profile.exams_json
  delete profile.course_units_json

  return {
    ...profile,
    ...permitAccess,
    permit_token: row.permit_token,
    course_units: parseCourseUnits(row),
    exams,
  }
}

function mapActivityLog(row) {
  const activityLog = { ...row }
  delete activityLog.campus_id
  delete activityLog.campus_name

  return {
    ...activityLog,
    createdAt: row.created_at,
    details: JSON.parse(row.details ?? '{}'),
  }
}

function upsertCampus(campusId, campusName) {
  const normalizedCampusId = String(campusId ?? 'main-campus').trim() || 'main-campus'
  const normalizedCampusName = String(campusName ?? 'Main Campus').trim() || 'Main Campus'
  const timestamp = nowIso()

  db.prepare(`
    INSERT INTO campuses (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
  `).run(normalizedCampusId, normalizedCampusName, timestamp, timestamp)
}

function syncCampusesFromRecords() {
  const rows = db.prepare(`
    SELECT campus_id AS id, campus_name AS name FROM users
    UNION
    SELECT campus_id AS id, campus_name AS name FROM profiles
  `).all()

  for (const row of rows) {
    if (!row?.id) {
      continue
    }

    upsertCampus(row.id, row.name)
  }
}

function pruneExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso())
}

function backfillExamAssignments() {
  const rows = db.prepare('SELECT * FROM profiles').all()
  const examsByProfileId = listProfileExamsByIds(rows.map((row) => row.id))
  const updateExams = db.prepare('UPDATE profiles SET exams_json = ?, updated_at = ? WHERE id = ?')

  for (const row of rows) {
    let exams = examsByProfileId.get(row.id) ?? []

    if (exams.length === 0) {
      exams = replaceProfileExams(row.id, parseLegacyExamAssignments(row))
    }

    const nextJson = serializeExamAssignments(exams)

    if ((row.exams_json ?? '') !== nextJson) {
      updateExams.run(nextJson, nowIso(), row.id)
    }
  }
}

function backfillPermitTokens() {
  const rows = db.prepare('SELECT id, permit_token FROM profiles').all()
  const updateToken = db.prepare('UPDATE profiles SET permit_token = ?, updated_at = ? WHERE id = ?')

  for (const row of rows) {
    if (typeof row.permit_token === 'string' && row.permit_token.trim()) {
      continue
    }

    updateToken.run(createPermitToken(), nowIso(), row.id)
  }
}

async function seedDatabaseIfNeeded() {
  const existingUser = db.prepare('SELECT id FROM users LIMIT 1').get()

  if (existingUser) {
    return
  }

  const seed = JSON.parse(await fs.readFile(seedFile, 'utf8'))
  const bootstrapAdmins = getBootstrapAdmins()
  const bootstrapProfiles = getBootstrapProfiles()
  const insertCampus = db.prepare(`
    INSERT INTO campuses (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `)
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, phone_number, role, admin_scope, name, campus_id, campus_name, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertProfile = db.prepare(`
    INSERT INTO profiles (
      id, email, phone_number, role, name, campus_id, campus_name, student_id, student_category, gender, enrollment_status, course, program, college,
      department, semester, course_units_json, exam_date, exam_time, venue, seat_number,
      instructions, profile_image, permit_token, exams_json, total_fees, amount_paid, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertLog = db.prepare(`
    INSERT INTO admin_activity_logs (id, admin_id, target_profile_id, action, details, campus_id, campus_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertSystemSettings = db.prepare(`
    INSERT INTO system_settings (id, local_student_fee, international_student_fee, currency_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const timestamp = nowIso()
  db.exec('BEGIN')

  try {
    for (const campus of seed.campuses ?? []) {
      insertCampus.run(
        campus.id,
        campus.name,
        timestamp,
        timestamp,
      )
    }

    for (const user of bootstrapAdmins) {
      insertUser.run(
        user.id,
        user.email,
        normalizePhoneNumber(user.phone_number ?? '') || null,
        user.role,
        user.role === 'admin' ? (user.admin_scope ?? 'operations') : null,
        user.name,
        user.campus_id ?? 'main-campus',
        user.campus_name ?? 'Main Campus',
        hashPassword(user.password ?? 'Permit@2026'),
        timestamp,
        timestamp,
      )
    }

    for (const profile of bootstrapProfiles) {
      const permitToken = createPermitToken()
      const exams = normalizeExamAssignments(profile.exams ?? null, { id: profile.id, ...profile })

      insertProfile.run(
        profile.id,
        profile.email,
        normalizePhoneNumber(profile.phone_number ?? '') || null,
        profile.role,
        profile.name,
        profile.campus_id ?? 'main-campus',
        profile.campus_name ?? 'Main Campus',
        profile.student_id ?? null,
        normalizeStudentCategory(profile.student_category),
        profile.gender === 'male' || profile.gender === 'female' || profile.gender === 'other' ? profile.gender : null,
        normalizeEnrollmentStatus(profile.enrollment_status),
        profile.course ?? null,
        profile.program ?? profile.course ?? null,
        profile.college ?? null,
        profile.department ?? null,
        profile.semester ?? null,
        serializeCourseUnits(profile.course_units ?? profile.courseUnits ?? []),
        profile.exam_date ?? null,
        profile.exam_time ?? null,
        profile.venue ?? null,
        profile.seat_number ?? null,
        profile.instructions ?? null,
        profile.profile_image ?? null,
        permitToken,
        serializeExamAssignments(exams),
        normalizeNumber(profile.total_fees),
        normalizeNumber(profile.amount_paid),
        timestamp,
        timestamp,
      )

      replaceProfileExams(profile.id, exams)
    }

    const seededSystemSettings = seed.systemSettings ?? defaultSystemFeeSettings
    insertSystemSettings.run(
      'default',
      normalizeNumber(seededSystemSettings.local_student_fee ?? defaultSystemFeeSettings.local_student_fee),
      normalizeNumber(seededSystemSettings.international_student_fee ?? defaultSystemFeeSettings.international_student_fee),
      normalizeCurrencyCode(seededSystemSettings.currency_code),
      timestamp,
      timestamp,
    )

    for (const log of seed.activityLogs ?? []) {
      insertLog.run(
        log.id ?? randomBytes(12).toString('hex'),
        log.admin_id,
        log.target_profile_id,
        log.action,
        JSON.stringify(log.details ?? {}),
        log.campus_id ?? 'main-campus',
        log.campus_name ?? 'Main Campus',
        log.created_at ?? timestamp,
      )
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

await seedDatabaseIfNeeded()
ensureSystemSettingsRow()
backfillPermitTokens()
backfillExamAssignments()
syncCampusesFromRecords()

export function getConfiguredDbPath() {
  return dbPath
}

export function getUploadsDir() {
  return uploadsDir
}

export function listCampuses() {
  return db.prepare('SELECT id, name FROM campuses ORDER BY name ASC').all()
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email)
}

export function getUserByPhoneNumber(phoneNumber) {
  return db.prepare('SELECT * FROM users WHERE phone_number = ?').get(normalizePhoneNumber(phoneNumber))
}

export function getUserByStudentId(studentId) {
  return db
    .prepare(
      `SELECT users.* FROM users
       JOIN profiles ON profiles.email = users.email
       WHERE profiles.student_id = ?`,
    )
    .get(studentId)
}

export function createSession(userId, sessionTtlHours) {
  pruneExpiredSessions()
  const token = randomBytes(32).toString('hex')
  const timestamp = nowIso()

  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).run(hashToken(token), userId, createSessionExpiry(sessionTtlHours), timestamp)

  return token
}

export function getSessionUser(token) {
  pruneExpiredSessions()
  const tokenHash = hashToken(token)
  const row = db.prepare(`
    SELECT users.id, users.email, users.role, users.admin_scope, users.assistant_role, users.assistant_departments_json, users.name, users.campus_id, users.campus_name, sessions.expires_at AS expiresAt
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash)

  if (!row) {
    return null
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    return null
  }

  return mapUser(row)
}

export function revokeSession(token) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

export function getProfileById(id) {
  pruneExpiredTrashedProfiles()
  const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id)

  if (!row) {
    return null
  }

  return mapProfile(row, listProfileExamsByIds([id]))
}

export function getSystemSettings() {
  ensureSystemSettingsRow()
  const row = db.prepare('SELECT * FROM system_settings WHERE id = ?').get('default')
  return mapSystemSettings(row)
}

export function updateSystemSettings(updates) {
  ensureSystemSettingsRow()
  const existing = db.prepare('SELECT * FROM system_settings WHERE id = ?').get('default')
  const updatedAt = nowIso()
  const nextLocalStudentFee = typeof updates.local_student_fee === 'number'
    ? normalizeNumber(updates.local_student_fee)
    : normalizeNumber(existing.local_student_fee)
  const nextInternationalStudentFee = typeof updates.international_student_fee === 'number'
    ? normalizeNumber(updates.international_student_fee)
    : normalizeNumber(existing.international_student_fee)
  const nextCurrencyCode = typeof updates.currency_code === 'string'
    ? normalizeCurrencyCode(updates.currency_code)
    : normalizeCurrencyCode(existing.currency_code)

  const prevLocal = normalizeNumber(existing.local_student_fee)
  const prevIntl = normalizeNumber(existing.international_student_fee)
  const feesChanged = Math.abs(nextLocalStudentFee - prevLocal) > 0.0001
    || Math.abs(nextInternationalStudentFee - prevIntl) > 0.0001

  let nextDeadlinesJson = typeof existing.deadlines_json === 'string' && existing.deadlines_json.trim()
    ? existing.deadlines_json
    : '[]'
  if (Array.isArray(updates.deadlines)) {
    nextDeadlinesJson = JSON.stringify(updates.deadlines)
  }

  db.exec('BEGIN')

  try {
    db.prepare(`
      UPDATE system_settings
      SET local_student_fee = ?, international_student_fee = ?, currency_code = ?, deadlines_json = ?, updated_at = ?
      WHERE id = ?
    `).run(nextLocalStudentFee, nextInternationalStudentFee, nextCurrencyCode, nextDeadlinesJson, updatedAt, 'default')

    if (feesChanged) {
      db.prepare(`
        UPDATE profiles
        SET total_fees = CASE
          WHEN role != 'student' THEN total_fees
          WHEN student_category = 'international' THEN ?
          ELSE ?
        END,
        updated_at = CASE
          WHEN role = 'student' THEN ?
          ELSE updated_at
        END
        WHERE role = 'student'
      `).run(nextInternationalStudentFee, nextLocalStudentFee, updatedAt)
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getSystemSettings()
}

export function listProfiles(role) {
  pruneExpiredTrashedProfiles()
  const rows = role
    ? db.prepare('SELECT * FROM profiles WHERE role = ? ORDER BY name ASC').all(role)
    : db.prepare('SELECT * FROM profiles ORDER BY name ASC').all()
  const examsByProfileId = listProfileExamsByIds(rows.map((row) => row.id))

  if (role) {
    return rows.map((row) => mapProfile(row, examsByProfileId))
  }

  return rows.map((row) => mapProfile(row, examsByProfileId))
}

function parseAssistantDepartments(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return []
  }
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((value) => String(value ?? '').trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export function listAssistantAdmins() {
  const rows = db.prepare(`
    SELECT id, email, phone_number, name, assistant_role, assistant_departments_json, campus_id, campus_name
    FROM users
    WHERE role = 'admin' AND admin_scope = 'assistant-admin'
    ORDER BY created_at DESC
  `).all()
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phoneNumber: row.phone_number ?? '',
    role: row.assistant_role === 'support_help' ? 'support_help' : 'department_prints',
    departments: parseAssistantDepartments(row.assistant_departments_json),
    campusId: row.campus_id ?? 'main-campus',
    campusName: row.campus_name ?? 'Main Campus',
  }))
}

export function createAssistantAdmin(input) {
  const id = randomBytes(12).toString('hex')
  const timestamp = nowIso()
  const email = String(input.email ?? '').trim().toLowerCase()
  const name = String(input.name ?? '').trim()
  const phoneNumber = normalizePhoneNumber(input.phone_number) || null
  const password = String(input.password ?? '').trim()
  const role = input.role === 'support_help' ? 'support_help' : 'department_prints'
  const departments = Array.isArray(input.departments) ? input.departments.map((item) => String(item ?? '').trim()).filter(Boolean) : []
  const campusId = String(input.campus_id ?? 'main-campus').trim() || 'main-campus'
  const campusName = String(input.campus_name ?? 'Main Campus').trim() || 'Main Campus'
  const departmentsJson = JSON.stringify(departments)

  upsertCampus(campusId, campusName)
  db.exec('BEGIN')
  try {
    db.prepare(`
      INSERT INTO users (id, email, phone_number, role, admin_scope, assistant_role, assistant_departments_json, name, campus_id, campus_name, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, 'admin', 'assistant-admin', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, email, phoneNumber, role, departmentsJson, name, campusId, campusName, hashPassword(password), timestamp, timestamp)

    db.prepare(`
      INSERT INTO profiles (
        id, email, phone_number, role, name, campus_id, campus_name, student_id, student_category, gender, enrollment_status, course, program, college,
        department, semester, course_units_json, exam_date, exam_time, venue, seat_number, instructions, profile_image,
        permit_token, permit_print_grant_month, permit_print_grants_remaining, exams_json, total_fees, amount_paid, created_at, updated_at
      )
      VALUES (?, ?, ?, 'admin', ?, ?, ?, NULL, 'local', NULL, 'active', NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, 0, '[]', 0, 0, ?, ?)
    `).run(id, email, phoneNumber, name, campusId, campusName, createPermitToken(), timestamp, timestamp)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return listAssistantAdmins().find((item) => item.id === id) ?? null
}

export function updateAssistantAdmin(id, updates) {
  const existing = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'admin' AND admin_scope = 'assistant-admin'`).get(id)
  if (!existing) {
    return null
  }
  const role = updates.role === 'support_help' ? 'support_help' : 'department_prints'
  const departments = Array.isArray(updates.departments) ? updates.departments.map((item) => String(item ?? '').trim()).filter(Boolean) : parseAssistantDepartments(existing.assistant_departments_json)
  const updatedAt = nowIso()
  db.prepare(`
    UPDATE users
    SET assistant_role = ?, assistant_departments_json = ?, updated_at = ?
    WHERE id = ?
  `).run(role, JSON.stringify(departments), updatedAt, id)
  return listAssistantAdmins().find((item) => item.id === id) ?? null
}

export function listProfilesPage({ role, search, status, department, program, course, college, page = 1, pageSize = 25 } = {}) {
  pruneExpiredTrashedProfiles()
  const whereClauses = []
  const params = []

  if (typeof role === 'string' && role.trim()) {
    whereClauses.push('role = ?')
    params.push(role.trim())
  }

  const normalizedSearch = typeof search === 'string' ? search.trim().toLowerCase() : ''

  if (normalizedSearch) {
    const searchValue = `%${normalizedSearch}%`
    whereClauses.push(`(
      LOWER(name) LIKE ?
      OR LOWER(email) LIKE ?
      OR LOWER(COALESCE(student_id, '')) LIKE ?
      OR LOWER(COALESCE(course, '')) LIKE ?
      OR LOWER(COALESCE(program, '')) LIKE ?
      OR LOWER(COALESCE(college, '')) LIKE ?
      OR LOWER(COALESCE(department, '')) LIKE ?
      OR LOWER(COALESCE(semester, '')) LIKE ?
    )`)
    params.push(searchValue, searchValue, searchValue, searchValue, searchValue, searchValue, searchValue, searchValue)
  }

  if (typeof department === 'string' && department.trim()) {
    whereClauses.push("LOWER(COALESCE(department, '')) = LOWER(?)")
    params.push(department.trim())
  }

  if (typeof program === 'string' && program.trim()) {
    whereClauses.push("LOWER(COALESCE(program, '')) = LOWER(?)")
    params.push(program.trim())
  }

  if (typeof course === 'string' && course.trim()) {
    whereClauses.push("LOWER(COALESCE(course, '')) = LOWER(?)")
    params.push(course.trim())
  }

  if (typeof college === 'string' && college.trim()) {
    whereClauses.push("LOWER(COALESCE(college, '')) = LOWER(?)")
    params.push(college.trim())
  }

  if (status === 'paid') {
    whereClauses.push('amount_paid >= total_fees')
  } else if (status === 'outstanding') {
    whereClauses.push('amount_paid < total_fees')
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
  const safePageSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100)
  const safePage = Math.max(Number(page) || 1, 1)
  const offset = (safePage - 1) * safePageSize

  const totalItems = db.prepare(`SELECT COUNT(*) AS total FROM profiles ${whereSql}`).get(...params).total

  const rows = db.prepare(`
    SELECT * FROM profiles
    ${whereSql}
    ORDER BY name ASC
    LIMIT ? OFFSET ?
  `).all(...params, safePageSize, offset)

  const examsByProfileId = listProfileExamsByIds(rows.map((row) => row.id))
  const items = rows.map((row) => mapProfile(row, examsByProfileId))

  const summaryWhere = typeof role === 'string' && role.trim() ? 'WHERE role = ?' : ''
  const summaryParams = typeof role === 'string' && role.trim() ? [role.trim()] : []
  const summaryRow = db.prepare(`
    SELECT
      COUNT(*) AS total_students,
      SUM(CASE WHEN amount_paid >= total_fees THEN 1 ELSE 0 END) AS cleared_students,
      SUM(CASE WHEN amount_paid < total_fees THEN 1 ELSE 0 END) AS outstanding_students
    FROM profiles
    ${summaryWhere}
  `).get(...summaryParams)

  return {
    items,
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages: Math.max(Math.ceil(totalItems / safePageSize), 1),
    totalStudents: Number(summaryRow?.total_students ?? 0),
    clearedStudents: Number(summaryRow?.cleared_students ?? 0),
    outstandingStudents: Number(summaryRow?.outstanding_students ?? 0),
  }
}

export function getPermitByToken(permitToken) {
  pruneExpiredTrashedProfiles()
  const row = db.prepare('SELECT * FROM profiles WHERE permit_token = ? AND role = ?').get(permitToken, 'student')

  if (!row) {
    return null
  }

  let exams = listProfileExamsByIds([row.id]).get(row.id) ?? parseLegacyExamAssignments(row)
  exams = mergeExamsWithProfileAnnouncements(row, exams)

  const cleared = Number(row.amount_paid ?? 0) >= Number(row.total_fees ?? 0)
  const base = {
    permitToken: row.permit_token,
    profileId: row.id,
    studentName: row.name,
    profileImage: row.profile_image,
    cleared,
    exams,
    updatedAt: row.updated_at,
  }
  const integrity = signPermitPayload({
    permitToken: base.permitToken,
    profileId: base.profileId,
    cleared: base.cleared,
    updatedAt: base.updatedAt,
  })
  return integrity ? { ...base, integrity } : base
}

export function updateProfileFinancials(profileId, amountPaid, totalFees) {
  const existing = getProfileById(profileId)

  if (!existing) {
    return null
  }

  const nextAmountPaid = typeof amountPaid === 'number' ? Number(amountPaid.toFixed(2)) : existing.amount_paid
  const nextTotalFees = typeof totalFees === 'number' ? Number(totalFees.toFixed(2)) : existing.total_fees
  const updatedAt = nowIso()

  db.prepare(
    'UPDATE profiles SET amount_paid = ?, total_fees = ?, updated_at = ? WHERE id = ?',
  ).run(nextAmountPaid, nextTotalFees, updatedAt, profileId)

  return getProfileById(profileId)
}

export function grantStudentPermitPrintAccess(profileId, additionalPrints = 1) {
  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)

  if (!profileRow || profileRow.role !== 'student') {
    return null
  }

  const nextAdditionalPrints = Math.max(1, Math.min(Number(additionalPrints) || 1, 12))
  const monthKey = getCurrentPermitPrintMonthKey()
  const currentRemaining = profileRow.permit_print_grant_month === monthKey
    ? Number(profileRow.permit_print_grants_remaining ?? 0)
    : 0

  db.prepare(`
    UPDATE profiles
    SET permit_print_grant_month = ?, permit_print_grants_remaining = ?, updated_at = ?
    WHERE id = ?
  `).run(monthKey, currentRemaining + nextAdditionalPrints, nowIso(), profileId)

  return getProfileById(profileId)
}

export function consumeStudentPermitPrintGrant(profileId) {
  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)

  if (!profileRow || profileRow.role !== 'student') {
    return null
  }

  const permitAccess = getStudentPermitAccess(profileRow)

  if (permitAccess.monthly_print_count < 2 || permitAccess.granted_prints_remaining <= 0) {
    return getProfileById(profileId)
  }

  db.prepare(`
    UPDATE profiles
    SET permit_print_grants_remaining = ?, permit_print_grant_month = ?, updated_at = ?
    WHERE id = ?
  `).run(
    permitAccess.granted_prints_remaining - 1,
    getCurrentPermitPrintMonthKey(),
    nowIso(),
    profileId,
  )

  return getProfileById(profileId)
}

export function createStudentProfile(input) {
  const profileId = input.id ?? randomBytes(12).toString('hex')
  const timestamp = nowIso()
  const nextEmail = input.email.trim().toLowerCase()
  const nextPhoneNumber = normalizePhoneNumber(input.phone_number) || null
  const nextStudentId = input.student_id ?? null
  const nextStudentCategory = normalizeStudentCategory(input.student_category)
  const nextGender = input.gender === 'male' || input.gender === 'female' || input.gender === 'other' ? input.gender : null
  const nextCourse = input.course ?? null
  const nextProgram = input.program ?? null
  const nextCollege = input.college ?? null
  const nextDepartment = input.department ?? null
  const nextSemester = input.semester ?? null
  const nextProfileImage = input.profile_image ?? null
  const nextTotalFees = normalizeNumber(input.total_fees)
  const nextAmountPaid = normalizeNumber(input.amount_paid)
  const nextCampusId = String(input.campus_id ?? 'main-campus').trim() || 'main-campus'
  const nextCampusName = String(input.campus_name ?? 'Main Campus').trim() || 'Main Campus'
  const fallbackProfile = {
    id: profileId,
    course: nextCourse,
    exam_date: input.exam_date ?? null,
    exam_time: input.exam_time ?? null,
    venue: input.venue ?? null,
    seat_number: input.seat_number ?? null,
  }
  const exams = normalizeExamAssignments(input.exams ?? null, fallbackProfile)

  upsertCampus(nextCampusId, nextCampusName)
  const storedPasswordHash = typeof input.password_hash === 'string' && String(input.password_hash).startsWith('scrypt:')
    ? String(input.password_hash).trim()
    : hashPassword(typeof input.password === 'string' && input.password.trim() ? input.password.trim() : 'Permit@2026')

  db.exec('BEGIN')

  try {
    db.prepare(`
      INSERT INTO users (id, email, phone_number, role, name, campus_id, campus_name, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      nextEmail,
      nextPhoneNumber,
      'student',
      input.name.trim(),
      nextCampusId,
      nextCampusName,
      storedPasswordHash,
      timestamp,
      timestamp,
    )

    db.prepare(`
      INSERT INTO profiles (
        id, email, phone_number, role, name, campus_id, campus_name, student_id, student_category, gender, enrollment_status, course, program, college,
        department, semester, course_units_json, exam_date, exam_time, venue, seat_number,
        instructions, profile_image, permit_token, exams_json, total_fees, amount_paid, first_login_required, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      nextEmail,
      nextPhoneNumber,
      'student',
      input.name.trim(),
      nextCampusId,
      nextCampusName,
      nextStudentId,
      nextStudentCategory,
      nextGender,
      normalizeEnrollmentStatus(input.enrollment_status),
      nextCourse,
      nextProgram,
      nextCollege,
      nextDepartment,
      nextSemester,
      serializeCourseUnits(input.course_units ?? []),
      input.exam_date ?? null,
      input.exam_time ?? null,
      input.venue ?? null,
      input.seat_number ?? null,
      input.instructions ?? null,
      nextProfileImage,
      createPermitToken(),
      serializeExamAssignments(exams),
      nextTotalFees,
      nextAmountPaid,
      1,
      timestamp,
      timestamp,
    )

    replaceProfileExams(profileId, exams)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getProfileById(profileId)
}

export function updateStudentAccount(profileId, updates) {
  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(profileId)

  if (!profileRow || !userRow) {
    return null
  }

  const nextName = typeof updates.name === 'string' ? updates.name.trim() : userRow.name
  const nextEmail = typeof updates.email === 'string' ? updates.email.trim().toLowerCase() : userRow.email
  const nextPhoneNumber = typeof updates.phoneNumber === 'string' ? (normalizePhoneNumber(updates.phoneNumber) || null) : userRow.phone_number
  const nextProfileImage = typeof updates.profileImage === 'string'
    ? updates.profileImage.trim() || null
    : updates.profileImage === null
      ? null
      : profileRow.profile_image
  const requestedPassword = typeof updates.password === 'string' ? updates.password.trim() : ''
  const currentPassword = typeof updates.currentPassword === 'string' ? updates.currentPassword.trim() : ''
  const firstLoginRequired = profileRow.role === 'student' && Number(profileRow.first_login_required ?? 0) === 1

  if (requestedPassword) {
    if (!currentPassword && !firstLoginRequired) {
      throw new Error('Current password is required to set a new password.')
    }

    if (!firstLoginRequired && !verifyPassword(currentPassword, userRow.password_hash)) {
      throw new Error('Current password is incorrect.')
    }
  }
  const nextFirstLoginRequired = firstLoginRequired
    ? ((requestedPassword.length >= 8 && nextPhoneNumber) ? 0 : 1)
    : Number(profileRow.first_login_required ?? 0)
  const effectiveProfileImage = firstLoginRequired && !nextProfileImage
    ? fallbackStudentProfileImage
    : nextProfileImage

  const nextPasswordHash = typeof updates.password === 'string' && updates.password.trim()
    ? hashPassword(updates.password.trim())
    : userRow.password_hash
  const updatedAt = nowIso()

  db.exec('BEGIN')

  try {
    db.prepare(`
      UPDATE users
      SET email = ?, phone_number = ?, name = ?, password_hash = ?, updated_at = ?
      WHERE id = ?
    `).run(nextEmail, nextPhoneNumber, nextName, nextPasswordHash, updatedAt, profileId)

    db.prepare(`
      UPDATE profiles
      SET email = ?, phone_number = ?, name = ?, profile_image = ?, first_login_required = ?, updated_at = ?
      WHERE id = ?
    `).run(nextEmail, nextPhoneNumber, nextName, effectiveProfileImage, nextFirstLoginRequired, updatedAt, profileId)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getProfileById(profileId)
}

export function resetUserPassword(profileId, nextPassword) {
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(profileId)

  if (!userRow) {
    return null
  }

  db.prepare(`
    UPDATE users
    SET password_hash = ?, updated_at = ?
    WHERE id = ?
  `).run(hashPassword(nextPassword.trim()), nowIso(), profileId)

  return mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(profileId))
}

export function adminUpdateStudentProfile(profileId, updates) {
  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(profileId)

  if (!profileRow || !userRow) {
    return null
  }

  const nextName = typeof updates.name === 'string' && updates.name.trim() ? updates.name.trim() : userRow.name
  const nextEmail = typeof updates.email === 'string' && updates.email.trim() ? updates.email.trim().toLowerCase() : userRow.email
  const nextPhoneNumber = 'phone_number' in updates ? (normalizePhoneNumber(updates.phone_number) || null) : userRow.phone_number
  const nextStudentId = 'student_id' in updates ? (updates.student_id ?? null) : profileRow.student_id
  const nextStudentCategory = 'student_category' in updates ? normalizeStudentCategory(updates.student_category) : normalizeStudentCategory(profileRow.student_category)
  const nextGender = 'gender' in updates
    ? (updates.gender === 'male' || updates.gender === 'female' || updates.gender === 'other' ? updates.gender : null)
    : profileRow.gender
  const nextEnrollmentStatus = 'enrollment_status' in updates ? normalizeEnrollmentStatus(updates.enrollment_status) : normalizeEnrollmentStatus(profileRow.enrollment_status)
  const nextCourse = 'course' in updates ? (updates.course ?? null) : profileRow.course
  const nextProgram = 'program' in updates ? (updates.program ?? null) : profileRow.program
  const nextCollege = 'college' in updates ? (updates.college ?? null) : profileRow.college
  const nextDepartment = 'department' in updates ? (updates.department ?? null) : profileRow.department
  const nextSemester = 'semester' in updates ? (updates.semester ?? null) : profileRow.semester
  const nextCourseUnitsJson = 'course_units' in updates
    ? serializeCourseUnits(updates.course_units)
    : profileRow.course_units_json
  const nextExamDate = 'exam_date' in updates
    ? (updates.exam_date == null ? null : String(updates.exam_date).trim() || null)
    : profileRow.exam_date
  const nextExamTime = 'exam_time' in updates
    ? (updates.exam_time == null ? null : String(updates.exam_time).trim() || null)
    : profileRow.exam_time
  const nextVenue = 'venue' in updates
    ? (updates.venue == null ? null : String(updates.venue).trim() || null)
    : profileRow.venue
  const nextSeatNumber = 'seat_number' in updates
    ? (updates.seat_number == null ? null : String(updates.seat_number).trim() || null)
    : profileRow.seat_number
  const nextInstructions = 'instructions' in updates
    ? (updates.instructions == null ? null : String(updates.instructions).trim() || null)
    : profileRow.instructions
  const fallbackForExams = {
    id: profileId,
    course: nextCourse,
    exam_date: nextExamDate,
    exam_time: nextExamTime,
    venue: nextVenue,
    seat_number: nextSeatNumber,
  }
  let nextExamsJson = profileRow.exams_json
  let examsToReplace = null
  if ('exams' in updates) {
    examsToReplace = normalizeExamAssignments(updates.exams, fallbackForExams)
    nextExamsJson = serializeExamAssignments(examsToReplace)
  }
  const nextProfileImage = 'profile_image' in updates ? (updates.profile_image ?? null) : profileRow.profile_image
  const nextTotalFees = typeof updates.total_fees === 'number' ? updates.total_fees : profileRow.total_fees
  const updatedAt = nowIso()

  db.exec('BEGIN')

  try {
    db.prepare(`
      UPDATE users
      SET email = ?, phone_number = ?, name = ?, updated_at = ?
      WHERE id = ?
    `).run(nextEmail, nextPhoneNumber, nextName, updatedAt, profileId)

    db.prepare(`
      UPDATE profiles
      SET email = ?, phone_number = ?, name = ?, student_id = ?, student_category = ?, gender = ?, enrollment_status = ?, course = ?, program = ?, college = ?, department = ?, semester = ?, course_units_json = ?, profile_image = ?, total_fees = ?, exams_json = ?, exam_date = ?, exam_time = ?, venue = ?, seat_number = ?, instructions = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextEmail,
      nextPhoneNumber,
      nextName,
      nextStudentId,
      nextStudentCategory,
      nextGender,
      nextEnrollmentStatus,
      nextCourse,
      nextProgram,
      nextCollege,
      nextDepartment,
      nextSemester,
      nextCourseUnitsJson,
      nextProfileImage,
      nextTotalFees,
      nextExamsJson,
      nextExamDate,
      nextExamTime,
      nextVenue,
      nextSeatNumber,
      nextInstructions,
      updatedAt,
      profileId,
    )

    if (examsToReplace) {
      replaceProfileExams(profileId, examsToReplace)
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getProfileById(profileId)
}

export function insertActivityLog({ adminId, targetProfileId, action, details, campusId, campusName }) {
  const adminUser = db.prepare('SELECT campus_id, campus_name FROM users WHERE id = ?').get(adminId)
  const nextCampusId = String(campusId ?? adminUser?.campus_id ?? 'main-campus').trim() || 'main-campus'
  const nextCampusName = String(campusName ?? adminUser?.campus_name ?? 'Main Campus').trim() || 'Main Campus'

  db.prepare(`
    INSERT INTO admin_activity_logs (id, admin_id, target_profile_id, action, details, campus_id, campus_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomBytes(12).toString('hex'),
    adminId,
    targetProfileId,
    action,
    JSON.stringify(details ?? {}),
    nextCampusId,
    nextCampusName,
    nowIso(),
  )
}

export function deleteAdminActivityLogById(logId) {
  const result = db.prepare('DELETE FROM admin_activity_logs WHERE id = ?').run(logId)
  return result.changes > 0
}

export function deletePermitActivityLogs() {
  const result = db.prepare(`
    DELETE FROM admin_activity_logs
    WHERE action IN ('print_permit', 'download_permit')
  `).run()
  return Number(result.changes ?? 0)
}

export function listActivityLogs() {
  const rows = db.prepare('SELECT * FROM admin_activity_logs ORDER BY created_at DESC').all()

  return rows.map(mapActivityLog)
}

function mapSupportRequest(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    registrationNumber: row.registration_number ?? '',
    subject: row.subject,
    message: row.message,
    status: row.status,
    adminReply: row.admin_reply,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    messages: Array.isArray(row.messages) ? row.messages : [],
  }
}

function mapSupportMessage(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    senderRole: row.sender_role,
    senderId: row.sender_id,
    message: row.message,
    attachmentName: row.attachment_name ?? null,
    attachmentUrl: row.attachment_url ?? null,
    attachmentMimeType: row.attachment_mime_type ?? null,
    attachmentSizeBytes: row.attachment_size_bytes == null ? null : Number(row.attachment_size_bytes),
    createdAt: row.created_at,
  }
}

function listSupportMessagesByRequestIds(requestIds) {
  const uniqueIds = [...new Set(requestIds.filter(Boolean))]
  const collection = new Map(uniqueIds.map((id) => [id, []]))
  if (uniqueIds.length === 0) {
    return collection
  }
  const placeholders = uniqueIds.map(() => '?').join(', ')
  const rows = db.prepare(`
    SELECT * FROM support_request_messages
    WHERE request_id IN (${placeholders})
    ORDER BY created_at ASC
  `).all(...uniqueIds)

  for (const row of rows) {
    const bucket = collection.get(row.request_id)
    const mapped = mapSupportMessage(row)
    if (bucket) bucket.push(mapped)
    else collection.set(row.request_id, [mapped])
  }

  return collection
}

export function listSupportRequests({ studentId } = {}) {
  const params = []
  const whereSql = studentId ? 'WHERE support_requests.student_id = ?' : ''

  if (studentId) {
    params.push(studentId)
  }

  const rows = db.prepare(`
    SELECT
      support_requests.*, 
      profiles.name AS student_name,
      profiles.email AS student_email,
      profiles.student_id AS registration_number
    FROM support_requests
    JOIN profiles ON profiles.id = support_requests.student_id
    ${whereSql}
    ORDER BY support_requests.updated_at DESC, support_requests.created_at DESC
  `).all(...params)
  const messagesByRequestId = listSupportMessagesByRequestIds(rows.map((row) => row.id))
  return rows.map((row) => mapSupportRequest({
    ...row,
    messages: messagesByRequestId.get(row.id) ?? [],
  }))
}

export function createSupportRequest(
  studentId,
  {
    subject,
    message,
    attachmentName = null,
    attachmentUrl = null,
    attachmentMimeType = null,
    attachmentSizeBytes = null,
  },
) {
  const profile = getProfileById(studentId)

  if (!profile || profile.role !== 'student') {
    return null
  }

  const id = randomBytes(12).toString('hex')
  const timestamp = nowIso()

  db.exec('BEGIN')
  try {
    db.prepare(`
      INSERT INTO support_requests (id, student_id, subject, message, status, admin_reply, resolved_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'open', '', NULL, ?, ?)
    `).run(id, studentId, subject, message, timestamp, timestamp)
    db.prepare(`
      INSERT INTO support_request_messages (
        id, request_id, sender_role, sender_id, message,
        attachment_name, attachment_url, attachment_mime_type, attachment_size_bytes,
        created_at
      )
      VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomBytes(12).toString('hex'),
      id,
      studentId,
      message,
      attachmentName,
      attachmentUrl,
      attachmentMimeType,
      attachmentSizeBytes,
      timestamp,
    )
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return listSupportRequests({ studentId }).find((request) => request.id === id) ?? null
}

export function addSupportRequestMessage(requestId, { senderRole, senderId, message, attachmentName = null, attachmentUrl = null, attachmentMimeType = null, attachmentSizeBytes = null }) {
  const existing = db.prepare('SELECT * FROM support_requests WHERE id = ?').get(requestId)
  if (!existing) {
    return null
  }
  const trimmed = String(message ?? '').trim()
  const hasAttachment = Boolean(attachmentUrl)
  if (!trimmed && !hasAttachment) {
    return listSupportRequests().find((request) => request.id === requestId) ?? null
  }
  const timestamp = nowIso()
  const normalizedRole = senderRole === 'admin' ? 'admin' : 'student'
  const nextStatus = normalizedRole === 'student'
    ? (existing.status === 'resolved' ? 'open' : existing.status)
    : (existing.status === 'open' ? 'in_progress' : existing.status)
  const nextResolvedAt = nextStatus === 'resolved' ? (existing.resolved_at ?? timestamp) : null

  db.exec('BEGIN')
  try {
    db.prepare(`
      INSERT INTO support_request_messages (
        id, request_id, sender_role, sender_id, message,
        attachment_name, attachment_url, attachment_mime_type, attachment_size_bytes,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomBytes(12).toString('hex'),
      requestId,
      normalizedRole,
      senderId,
      trimmed,
      attachmentName,
      attachmentUrl,
      attachmentMimeType,
      attachmentSizeBytes,
      timestamp,
    )

    db.prepare(`
      UPDATE support_requests
      SET status = ?, resolved_at = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, nextResolvedAt, timestamp, requestId)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return listSupportRequests().find((request) => request.id === requestId) ?? null
}

export function updateSupportRequest(requestId, { status, adminReply }) {
  const existing = db.prepare('SELECT * FROM support_requests WHERE id = ?').get(requestId)

  if (!existing) {
    return null
  }

  const nextStatus = typeof status === 'string' ? status : existing.status
  const nextAdminReply = typeof adminReply === 'string' ? adminReply : existing.admin_reply
  const resolvedAt = nextStatus === 'resolved'
    ? (existing.resolved_at ?? nowIso())
    : null
  const updatedAt = nowIso()

  db.exec('BEGIN')
  try {
    db.prepare(`
      UPDATE support_requests
      SET status = ?, admin_reply = ?, resolved_at = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, nextAdminReply, resolvedAt, updatedAt, requestId)

    if (typeof adminReply === 'string' && adminReply.trim() && adminReply.trim() !== String(existing.admin_reply ?? '').trim()) {
      db.prepare(`
        INSERT INTO support_request_messages (id, request_id, sender_role, sender_id, message, created_at)
        VALUES (?, ?, 'admin', ?, ?, ?)
      `).run(randomBytes(12).toString('hex'), requestId, 'admin-system', adminReply.trim(), updatedAt)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return listSupportRequests().find((request) => request.id === requestId) ?? null
}

export function listSemesterRegistrations({ studentId } = {}) {
  const params = []
  const whereSql = studentId ? 'WHERE semester_registrations.student_id = ?' : ''
  if (studentId) {
    params.push(studentId)
  }
  const rows = db.prepare(`
    SELECT
      semester_registrations.*,
      profiles.name AS student_name,
      profiles.email AS student_email,
      profiles.student_id AS registration_number
    FROM semester_registrations
    JOIN profiles ON profiles.id = semester_registrations.student_id
    ${whereSql}
    ORDER BY semester_registrations.updated_at DESC, semester_registrations.created_at DESC
  `).all(...params)
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    registrationNumber: row.registration_number ?? '',
    requestedSemester: row.requested_semester,
    status: row.status,
    adminNote: row.admin_note ?? '',
    resolvedByAdminId: row.resolved_by_admin_id ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export function createSemesterRegistration(studentId, requestedSemester) {
  const profile = getProfileById(studentId)
  if (!profile || profile.role !== 'student') {
    return null
  }
  const id = randomBytes(12).toString('hex')
  const timestamp = nowIso()
  db.prepare(`
    INSERT INTO semester_registrations (id, student_id, requested_semester, status, admin_note, resolved_by_admin_id, resolved_at, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', '', NULL, NULL, ?, ?)
  `).run(id, studentId, requestedSemester, timestamp, timestamp)
  return listSemesterRegistrations({ studentId }).find((item) => item.id === id) ?? null
}

export function updateSemesterRegistrationStatus(registrationId, { status, adminNote, resolvedByAdminId }) {
  const existing = db.prepare('SELECT * FROM semester_registrations WHERE id = ?').get(registrationId)
  if (!existing) {
    return null
  }
  const nextStatus = status === 'approved' || status === 'rejected' ? status : existing.status
  const note = typeof adminNote === 'string' ? adminNote.trim() : (existing.admin_note ?? '')
  const resolvedAt = nextStatus === 'pending' ? null : nowIso()
  const updatedAt = nowIso()
  db.prepare(`
    UPDATE semester_registrations
    SET status = ?, admin_note = ?, resolved_by_admin_id = ?, resolved_at = ?, updated_at = ?
    WHERE id = ?
  `).run(nextStatus, note, nextStatus === 'pending' ? null : (resolvedByAdminId ?? existing.resolved_by_admin_id ?? null), resolvedAt, updatedAt, registrationId)
  return listSemesterRegistrations().find((item) => item.id === registrationId) ?? null
}

export function deleteStudentProfile(profileId, deletedByAdminId = null) {
  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)

  if (!profileRow || profileRow.role !== 'student') {
    return null
  }

  const existingProfile = getProfileById(profileId)
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(profileId)
  const examRows = db.prepare('SELECT * FROM profile_exams WHERE profile_id = ? ORDER BY created_at ASC').all(profileId)
  const supportRows = db.prepare('SELECT * FROM support_requests WHERE student_id = ? ORDER BY created_at ASC').all(profileId)
  const supportRequestIds = supportRows.map((row) => row.id).filter(Boolean)
  const supportMessageRows = supportRequestIds.length > 0
    ? db.prepare(`SELECT * FROM support_request_messages WHERE request_id IN (${supportRequestIds.map(() => '?').join(', ')}) ORDER BY created_at ASC`).all(...supportRequestIds)
    : []
  const activityRows = db.prepare(`
    SELECT * FROM admin_activity_logs
    WHERE target_profile_id = ? OR admin_id = ?
    ORDER BY created_at ASC
  `).all(profileId, profileId)
  const trashId = randomBytes(12).toString('hex')
  const deletedAt = nowIso()
  const purgeAfterAt = addDaysIso(deletedAt, trashRetentionDays)
  const snapshot = JSON.stringify({
    user: userRow,
    profile: profileRow,
    exams: examRows,
    supportRequests: supportRows,
    supportRequestMessages: supportMessageRows,
    activityLogs: activityRows,
  })

  db.exec('BEGIN')

  try {
    db.prepare(`
      INSERT INTO trashed_profiles (
        id, profile_id, role, name, email, student_id, deleted_at, purge_after_at, deleted_by_admin_id, snapshot_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trashId,
      profileId,
      profileRow.role,
      profileRow.name,
      profileRow.email,
      profileRow.student_id ?? null,
      deletedAt,
      purgeAfterAt,
      deletedByAdminId,
      snapshot,
    )
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(profileId)
    db.prepare('DELETE FROM admin_activity_logs WHERE target_profile_id = ?').run(profileId)
    db.prepare('DELETE FROM support_requests WHERE student_id = ?').run(profileId)
    db.prepare('DELETE FROM profile_exams WHERE profile_id = ?').run(profileId)
    db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId)
    db.prepare('DELETE FROM users WHERE id = ?').run(profileId)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return {
    trashId,
    ...existingProfile,
    deletedAt,
    purgeAfterAt,
  }
}

function mapTrashedProfile(row) {
  return {
    id: row.id,
    profile_id: row.profile_id,
    role: row.role,
    name: row.name,
    email: row.email,
    student_id: row.student_id,
    deleted_at: row.deleted_at,
    purge_after_at: row.purge_after_at,
    deleted_by_admin_id: row.deleted_by_admin_id,
    restored_at: row.restored_at,
    restored_by_admin_id: row.restored_by_admin_id,
  }
}

export function listTrashedStudentProfiles() {
  pruneExpiredTrashedProfiles()
  const rows = db.prepare(`
    SELECT * FROM trashed_profiles
    WHERE role = 'student' AND restored_at IS NULL
    ORDER BY deleted_at DESC
  `).all()

  return rows.map(mapTrashedProfile)
}

export function restoreStudentProfile(trashId, restoredByAdminId = null) {
  pruneExpiredTrashedProfiles()
  const trashRow = db.prepare('SELECT * FROM trashed_profiles WHERE id = ?').get(trashId)

  if (!trashRow || trashRow.role !== 'student' || trashRow.restored_at) {
    return null
  }

  const snapshot = parseJsonValue(trashRow.snapshot_json, null)
  const userRow = snapshot?.user ?? null
  const profileRow = snapshot?.profile ?? null
  const examRows = Array.isArray(snapshot?.exams) ? snapshot.exams : []
  const supportRows = Array.isArray(snapshot?.supportRequests) ? snapshot.supportRequests : []
  const supportMessageRows = Array.isArray(snapshot?.supportRequestMessages) ? snapshot.supportRequestMessages : []
  const activityRows = Array.isArray(snapshot?.activityLogs) ? snapshot.activityLogs : []

  if (!userRow || !profileRow || profileRow.role !== 'student') {
    throw new Error('The trashed student snapshot is incomplete and cannot be restored.')
  }

  const conflictingEmailUser = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(userRow.email)
  if (conflictingEmailUser) {
    throw new Error('A user with this email already exists. Update the active record before restoring from trash.')
  }

  if (userRow.phone_number) {
    const conflictingPhoneUser = db.prepare('SELECT id FROM users WHERE phone_number = ?').get(userRow.phone_number)
    if (conflictingPhoneUser) {
      throw new Error('A user with this phone number already exists. Update the active record before restoring from trash.')
    }
  }

  if (profileRow.student_id) {
    const conflictingStudent = db.prepare('SELECT id FROM profiles WHERE student_id = ?').get(profileRow.student_id)
    if (conflictingStudent) {
      throw new Error('A student with this registration number already exists. Update the active record before restoring from trash.')
    }
  }

  db.exec('BEGIN')

  try {
    db.prepare(`
      INSERT INTO users (
        id, email, phone_number, role, admin_scope, name, campus_id, campus_name, password_hash, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userRow.id,
      userRow.email,
      userRow.phone_number ?? null,
      userRow.role,
      userRow.admin_scope ?? null,
      userRow.name,
      userRow.campus_id ?? 'main-campus',
      userRow.campus_name ?? 'Main Campus',
      userRow.password_hash,
      userRow.created_at,
      userRow.updated_at,
    )

    db.prepare(`
      INSERT INTO profiles (
        id, email, phone_number, role, name, campus_id, campus_name, student_id, student_category, gender, enrollment_status, course, program, college,
        department, semester, course_units_json, exam_date, exam_time, venue, seat_number, instructions, profile_image,
        permit_token, permit_print_grant_month, permit_print_grants_remaining, exams_json, total_fees, amount_paid, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileRow.id,
      profileRow.email,
      profileRow.phone_number ?? null,
      profileRow.role,
      profileRow.name,
      profileRow.campus_id ?? 'main-campus',
      profileRow.campus_name ?? 'Main Campus',
      profileRow.student_id ?? null,
      normalizeStudentCategory(profileRow.student_category),
      profileRow.gender === 'male' || profileRow.gender === 'female' || profileRow.gender === 'other' ? profileRow.gender : null,
      normalizeEnrollmentStatus(profileRow.enrollment_status),
      profileRow.course ?? null,
      profileRow.program ?? null,
      profileRow.college ?? null,
      profileRow.department ?? null,
      profileRow.semester ?? null,
      profileRow.course_units_json ?? '[]',
      profileRow.exam_date ?? null,
      profileRow.exam_time ?? null,
      profileRow.venue ?? null,
      profileRow.seat_number ?? null,
      profileRow.instructions ?? null,
      profileRow.profile_image ?? null,
      profileRow.permit_token ?? createPermitToken(),
      profileRow.permit_print_grant_month ?? null,
      Number(profileRow.permit_print_grants_remaining ?? 0),
      profileRow.exams_json ?? '[]',
      Number(profileRow.total_fees ?? 0),
      Number(profileRow.amount_paid ?? 0),
      profileRow.created_at,
      profileRow.updated_at,
    )

    for (const examRow of examRows) {
      db.prepare(`
        INSERT INTO profile_exams (id, profile_id, title, exam_date, exam_time, venue, seat_number, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        examRow.id,
        examRow.profile_id,
        examRow.title,
        examRow.exam_date,
        examRow.exam_time,
        examRow.venue,
        examRow.seat_number,
        examRow.created_at,
        examRow.updated_at,
      )
    }

    for (const supportRow of supportRows) {
      db.prepare(`
        INSERT INTO support_requests (id, student_id, subject, message, status, admin_reply, resolved_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        supportRow.id,
        supportRow.student_id,
        supportRow.subject,
        supportRow.message,
        supportRow.status,
        supportRow.admin_reply,
        supportRow.resolved_at ?? null,
        supportRow.created_at,
        supportRow.updated_at,
      )
    }
    for (const messageRow of supportMessageRows) {
      db.prepare(`
        INSERT INTO support_request_messages (id, request_id, sender_role, sender_id, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        messageRow.id,
        messageRow.request_id,
        messageRow.sender_role === 'admin' ? 'admin' : 'student',
        messageRow.sender_id,
        messageRow.message,
        messageRow.created_at,
      )
    }

    for (const activityRow of activityRows) {
      const adminUser = db.prepare('SELECT id FROM users WHERE id = ?').get(activityRow.admin_id)
      const targetProfile = db.prepare('SELECT id FROM profiles WHERE id = ?').get(activityRow.target_profile_id)

      if (!adminUser || !targetProfile) {
        continue
      }

      db.prepare(`
        INSERT INTO admin_activity_logs (id, admin_id, target_profile_id, action, details, campus_id, campus_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        activityRow.id,
        activityRow.admin_id,
        activityRow.target_profile_id,
        activityRow.action,
        activityRow.details,
        activityRow.campus_id ?? 'main-campus',
        activityRow.campus_name ?? 'Main Campus',
        activityRow.created_at,
      )
    }

    db.prepare(`
      UPDATE trashed_profiles
      SET restored_at = ?, restored_by_admin_id = ?
      WHERE id = ?
    `).run(nowIso(), restoredByAdminId, trashId)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getProfileById(profileRow.id)
}

export function permanentlyDeleteTrashedProfile(trashId) {
  pruneExpiredTrashedProfiles()
  const trashRow = db.prepare('SELECT * FROM trashed_profiles WHERE id = ?').get(trashId)

  if (!trashRow || trashRow.role !== 'student' || trashRow.restored_at) {
    return false
  }

  db.prepare('DELETE FROM trashed_profiles WHERE id = ?').run(trashId)
  return true
}

export function permanentlyPurgeAllTrashedProfiles() {
  pruneExpiredTrashedProfiles()
  const result = db.prepare(`
    DELETE FROM trashed_profiles
    WHERE role = 'student' AND restored_at IS NULL
  `).run()
  return Number(result.changes ?? 0)
}

export function listActivityLogsPage({ page = 1, pageSize = 20 } = {}) {
  const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
  const safePage = Math.max(Number(page) || 1, 1)
  const offset = (safePage - 1) * safePageSize
  const totalItems = Number(db.prepare('SELECT COUNT(*) AS total FROM admin_activity_logs').get().total ?? 0)
  const rows = db.prepare(`
    SELECT * FROM admin_activity_logs
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(safePageSize, offset)

  return {
    items: rows.map(mapActivityLog),
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages: Math.max(Math.ceil(totalItems / safePageSize), 1),
  }
}

function pruneExpiredTrashedProfiles() {
  db.prepare(`
    DELETE FROM trashed_profiles
    WHERE restored_at IS NULL
      AND datetime(purge_after_at) <= datetime('now')
  `).run()
}