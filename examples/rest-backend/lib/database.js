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
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'student')),
    name TEXT NOT NULL,
    student_id TEXT,
    course TEXT,
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

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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
ensureColumn('profiles', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
ensureColumn('profiles', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")
ensureColumn('profiles', 'permit_token TEXT')
ensureColumn('profiles', "exams_json TEXT NOT NULL DEFAULT '[]'")
ensureColumn('admin_activity_logs', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
ensureColumn('admin_activity_logs', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_campus_id ON users(campus_id);
  CREATE INDEX IF NOT EXISTS idx_profiles_campus_id ON profiles(campus_id);
  CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_campus_id ON admin_activity_logs(campus_id);
`)

db.prepare(`
  UPDATE users
  SET campus_id = COALESCE(NULLIF(campus_id, ''), 'main-campus'),
      campus_name = COALESCE(NULLIF(campus_name, ''), 'Main Campus')
`).run()

db.prepare(`
  UPDATE profiles
  SET campus_id = COALESCE(NULLIF(campus_id, ''), 'main-campus'),
  campus_name = COALESCE(NULLIF(campus_name, ''), 'Main Campus'),
  permit_token = COALESCE(NULLIF(permit_token, ''), ''),
  exams_json = COALESCE(NULLIF(exams_json, ''), '[]')
`).run()

db.prepare(`
  UPDATE admin_activity_logs
  SET campus_id = COALESCE(NULLIF(campus_id, ''), 'main-campus'),
      campus_name = COALESCE(NULLIF(campus_name, ''), 'Main Campus')
`).run()

function nowIso() {
  return new Date().toISOString()
}

function normalizeNumber(value) {
  return typeof value === 'number' ? Number(value.toFixed(2)) : 0
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
    name: row.name,
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

  return {
    ...profile,
    permit_token: row.permit_token,
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
    INSERT INTO users (id, email, role, name, campus_id, campus_name, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertProfile = db.prepare(`
    INSERT INTO profiles (
      id, email, role, name, campus_id, campus_name, student_id, course, exam_date, exam_time,
      venue, seat_number, instructions, profile_image, permit_token, exams_json, total_fees,
      amount_paid, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertLog = db.prepare(`
    INSERT INTO admin_activity_logs (id, admin_id, target_profile_id, action, details, campus_id, campus_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        user.role,
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
        profile.role,
        profile.name,
        profile.campus_id ?? 'main-campus',
        profile.campus_name ?? 'Main Campus',
        profile.student_id ?? null,
        profile.course ?? null,
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
    SELECT users.id, users.email, users.role, users.name, users.campus_id, users.campus_name, sessions.expires_at AS expiresAt
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

export function updateStudentAccount(profileId, updates) {
  const profileRow = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)
  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(profileId)

  if (!profileRow || !userRow) {
    return null
  }

  const nextName = typeof updates.name === 'string' ? updates.name.trim() : userRow.name
  const nextEmail = typeof updates.email === 'string' ? updates.email.trim().toLowerCase() : userRow.email
  const nextProfileImage = typeof updates.profileImage === 'string'
    ? updates.profileImage.trim() || null
    : updates.profileImage === null
      ? null
      : profileRow.profile_image
  const nextPasswordHash = typeof updates.password === 'string' && updates.password.trim()
    ? hashPassword(updates.password.trim())
    : userRow.password_hash
  const updatedAt = nowIso()

  db.exec('BEGIN')

  try {
    db.prepare(`
      UPDATE users
      SET email = ?, name = ?, password_hash = ?, updated_at = ?
      WHERE id = ?
    `).run(nextEmail, nextName, nextPasswordHash, updatedAt, profileId)

    db.prepare(`
      UPDATE profiles
      SET email = ?, name = ?, profile_image = ?, updated_at = ?
      WHERE id = ?
    `).run(nextEmail, nextName, nextProfileImage, updatedAt, profileId)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getProfileById(profileId)
}

export function insertActivityLog({ adminId, targetProfileId, action, details }) {
  db.prepare(`
    INSERT INTO admin_activity_logs (id, admin_id, target_profile_id, action, details, campus_id, campus_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomBytes(12).toString('hex'),
    adminId,
    targetProfileId,
    action,
    JSON.stringify(details ?? {}),
    'main-campus',
    'Main Campus',
    nowIso(),
  )
}

export function listActivityLogs() {
  const rows = db.prepare('SELECT * FROM admin_activity_logs ORDER BY created_at DESC').all()

  return rows.map(mapActivityLog)
}