import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
const dataDir = path.resolve(backendRoot, 'data')
const uploadsDir = path.resolve(backendRoot, 'uploads')
const seedFile = path.join(dataDir, 'seed.json')
const defaultDbPath = path.join(dataDir, 'app.sqlite')

const configuredDbPath = process.env.APP_DB_PATH?.trim()
const dbPath = configuredDbPath
  ? path.resolve(backendRoot, configuredDbPath)
  : defaultDbPath

await fs.mkdir(path.dirname(dbPath), { recursive: true })
await fs.mkdir(uploadsDir, { recursive: true })

const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

const defaultSystemFeeSettings = Object.freeze({
  local_student_fee: 3000,
  international_student_fee: 6000,
})

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
    admin_scope TEXT CHECK (admin_scope IN ('super-admin', 'registrar', 'finance', 'operations')),
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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
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
ensureColumn('users', "admin_scope TEXT CHECK (admin_scope IN ('super-admin', 'registrar', 'finance', 'operations'))")
ensureColumn('profiles', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
ensureColumn('profiles', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")
ensureColumn('profiles', 'phone_number TEXT')
ensureColumn('profiles', "student_category TEXT NOT NULL DEFAULT 'local'")
ensureColumn('profiles', 'permit_token TEXT')
ensureColumn('profiles', "exams_json TEXT NOT NULL DEFAULT '[]'")
ensureColumn('profiles', 'program TEXT')
ensureColumn('profiles', 'college TEXT')
ensureColumn('profiles', 'department TEXT')
ensureColumn('profiles', 'semester TEXT')
ensureColumn('profiles', "course_units_json TEXT NOT NULL DEFAULT '[]'")
ensureColumn('admin_activity_logs', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
ensureColumn('admin_activity_logs', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")

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
    WHEN admin_scope IS NOT NULL AND admin_scope != '' THEN admin_scope
    WHEN lower(email) = 'admin@example.com' THEN 'super-admin'
    WHEN lower(email) = 'registrar@example.com' THEN 'registrar'
    WHEN lower(email) = 'finance@example.com' THEN 'finance'
    ELSE 'operations'
  END
`).run()

db.prepare(`
  UPDATE profiles
  SET campus_id = COALESCE(NULLIF(campus_id, ''), 'main-campus'),
  campus_name = COALESCE(NULLIF(campus_name, ''), 'Main Campus'),
  permit_token = COALESCE(NULLIF(permit_token, ''), ''),
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

function normalizeStudentCategory(value) {
  return value === 'international' ? 'international' : 'local'
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

function ensureSystemSettingsRow() {
  const existing = db.prepare('SELECT id FROM system_settings WHERE id = ?').get('default')

  if (existing) {
    return
  }

  const timestamp = nowIso()
  db.prepare(`
    INSERT INTO system_settings (id, local_student_fee, international_student_fee, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    'default',
    defaultSystemFeeSettings.local_student_fee,
    defaultSystemFeeSettings.international_student_fee,
    timestamp,
    timestamp,
  )
}

function mapSystemSettings(row) {
  return {
    local_student_fee: normalizeNumber(row?.local_student_fee ?? defaultSystemFeeSettings.local_student_fee),
    international_student_fee: normalizeNumber(row?.international_student_fee ?? defaultSystemFeeSettings.international_student_fee),
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

  const exams = examsByProfileId.get(row.id) ?? parseLegacyExamAssignments(row)
  const profile = { ...row }
  delete profile.campus_id
  delete profile.campus_name
  delete profile.exams_json
  delete profile.course_units_json

  return {
    ...profile,
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
      id, email, phone_number, role, name, campus_id, campus_name, student_id, student_category, course, program, college,
      department, semester, course_units_json, exam_date, exam_time, venue, seat_number,
      instructions, profile_image, permit_token, exams_json, total_fees, amount_paid, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertLog = db.prepare(`
    INSERT INTO admin_activity_logs (id, admin_id, target_profile_id, action, details, campus_id, campus_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertSystemSettings = db.prepare(`
    INSERT INTO system_settings (id, local_student_fee, international_student_fee, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
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

    for (const user of seed.users ?? []) {
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

    for (const profile of seed.profiles ?? []) {
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
    SELECT users.id, users.email, users.role, users.admin_scope, users.name, users.campus_id, users.campus_name, sessions.expires_at AS expiresAt
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

  db.prepare(`
    UPDATE system_settings
    SET local_student_fee = ?, international_student_fee = ?, updated_at = ?
    WHERE id = ?
  `).run(nextLocalStudentFee, nextInternationalStudentFee, updatedAt, 'default')

  return getSystemSettings()
}

export function listProfiles(role) {
  const rows = role
    ? db.prepare('SELECT * FROM profiles WHERE role = ? ORDER BY name ASC').all(role)
    : db.prepare('SELECT * FROM profiles ORDER BY name ASC').all()
  const examsByProfileId = listProfileExamsByIds(rows.map((row) => row.id))

  if (role) {
    return rows.map((row) => mapProfile(row, examsByProfileId))
  }

  return rows.map((row) => mapProfile(row, examsByProfileId))
}

export function listProfilesPage({ role, search, status, page = 1, pageSize = 25 } = {}) {
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
  const row = db.prepare('SELECT * FROM profiles WHERE permit_token = ? AND role = ?').get(permitToken, 'student')

  if (!row) {
    return null
  }

  const exams = listProfileExamsByIds([row.id]).get(row.id) ?? parseLegacyExamAssignments(row)

  return {
    permitToken: row.permit_token,
    profileId: row.id,
    studentName: row.name,
    profileImage: row.profile_image,
    cleared: Number(row.amount_paid ?? 0) >= Number(row.total_fees ?? 0),
    exams,
    updatedAt: row.updated_at,
  }
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

export function createStudentProfile(input) {
  const profileId = input.id ?? randomBytes(12).toString('hex')
  const timestamp = nowIso()
  const nextEmail = input.email.trim().toLowerCase()
  const nextPhoneNumber = normalizePhoneNumber(input.phone_number) || null
  const nextStudentId = input.student_id ?? null
  const nextStudentCategory = normalizeStudentCategory(input.student_category)
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
      hashPassword(input.password),
      timestamp,
      timestamp,
    )

    db.prepare(`
      INSERT INTO profiles (
        id, email, phone_number, role, name, campus_id, campus_name, student_id, student_category, course, program, college,
        department, semester, course_units_json, exam_date, exam_time, venue, seat_number,
        instructions, profile_image, permit_token, exams_json, total_fees, amount_paid, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  if (requestedPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to set a new password.')
    }

    if (!verifyPassword(currentPassword, userRow.password_hash)) {
      throw new Error('Current password is incorrect.')
    }
  }

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
      SET email = ?, phone_number = ?, name = ?, profile_image = ?, updated_at = ?
      WHERE id = ?
    `).run(nextEmail, nextPhoneNumber, nextName, nextProfileImage, updatedAt, profileId)

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
  const nextCourse = 'course' in updates ? (updates.course ?? null) : profileRow.course
  const nextProgram = 'program' in updates ? (updates.program ?? null) : profileRow.program
  const nextCollege = 'college' in updates ? (updates.college ?? null) : profileRow.college
  const nextDepartment = 'department' in updates ? (updates.department ?? null) : profileRow.department
  const nextSemester = 'semester' in updates ? (updates.semester ?? null) : profileRow.semester
  const nextCourseUnitsJson = 'course_units' in updates
    ? serializeCourseUnits(updates.course_units)
    : profileRow.course_units_json
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
      SET email = ?, phone_number = ?, name = ?, student_id = ?, student_category = ?, course = ?, program = ?, college = ?, department = ?, semester = ?, course_units_json = ?, profile_image = ?, total_fees = ?, updated_at = ?
      WHERE id = ?
    `).run(nextEmail, nextPhoneNumber, nextName, nextStudentId, nextStudentCategory, nextCourse, nextProgram, nextCollege, nextDepartment, nextSemester, nextCourseUnitsJson, nextProfileImage, nextTotalFees, updatedAt, profileId)

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
  }
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

  return rows.map(mapSupportRequest)
}

export function createSupportRequest(studentId, { subject, message }) {
  const profile = getProfileById(studentId)

  if (!profile || profile.role !== 'student') {
    return null
  }

  const id = randomBytes(12).toString('hex')
  const timestamp = nowIso()

  db.prepare(`
    INSERT INTO support_requests (id, student_id, subject, message, status, admin_reply, resolved_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'open', '', NULL, ?, ?)
  `).run(id, studentId, subject, message, timestamp, timestamp)

  return listSupportRequests({ studentId }).find((request) => request.id === id) ?? null
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

  db.prepare(`
    UPDATE support_requests
    SET status = ?, admin_reply = ?, resolved_at = ?, updated_at = ?
    WHERE id = ?
  `).run(nextStatus, nextAdminReply, resolvedAt, updatedAt, requestId)

  return listSupportRequests().find((request) => request.id === requestId) ?? null
}

export function deleteStudentProfile(profileId) {
  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)

  if (!profileRow || profileRow.role !== 'student') {
    return null
  }

  const existingProfile = getProfileById(profileId)
  const deletedAt = nowIso()

  db.exec('BEGIN')

  try {
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
    ...existingProfile,
    deletedAt,
  }
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