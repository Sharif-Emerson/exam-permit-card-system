import './reset-data-sqlite.js'
/*
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes, scryptSync } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
const dataDir = path.join(backendRoot, 'data')
const uploadsDir = path.join(backendRoot, 'uploads')
const seedFile = path.join(dataDir, 'seed.json')
const appDbPath = process.env.APP_DB_PATH?.trim()
	? path.resolve(backendRoot, process.env.APP_DB_PATH.trim())
	: path.join(dataDir, 'app.sqlite')

function hashPassword(password) {
	const salt = randomBytes(16).toString('hex')
	const derivedKey = scryptSync(password, salt, 64).toString('hex')
	return `scrypt:${salt}:${derivedKey}`
}

function createPermitToken() {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
	let normalized = ''
	const bytes = randomBytes(8)
	for (let index = 0; index < 8; index += 1) {
		normalized += alphabet[bytes[index] % alphabet.length]
	}
	return `${normalized.slice(0, 4)}-${normalized.slice(4)}`
}

function createExamAssignments(profile) {
	if (Array.isArray(profile.exams)) {
		return profile.exams
	}

	if (!profile.exam_date && !profile.exam_time && !profile.venue && !profile.seat_number) {
		return []
	}

	return [
		{
			id: `${profile.id}-exam-1`,
			title: profile.course ? `${profile.course} Exam` : 'Scheduled Exam',
			examDate: profile.exam_date ?? 'Not scheduled',
			examTime: profile.exam_time ?? 'Not scheduled',
			venue: profile.venue ?? 'Not assigned',
			seatNumber: profile.seat_number ?? 'Not assigned',
		},
	]
}

function hasColumn(db, tableName, columnName) {
	return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName)
}

function ensureColumn(db, tableName, columnDefinition) {
	const columnName = columnDefinition.trim().split(/\s+/, 1)[0]

	if (!hasColumn(db, tableName, columnName)) {
		db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`)
	}
}

async function readExistingAdmins(dbFilePath) {
	try {
		await fs.access(dbFilePath)
	} catch {
		return new Map()
	}

	const db = new DatabaseSync(dbFilePath)

	try {
		if (!hasColumn(db, 'users', 'phone_number')) {
			ensureColumn(db, 'users', 'phone_number TEXT')
		}

		if (!hasColumn(db, 'users', 'admin_scope')) {
			ensureColumn(db, 'users', "admin_scope TEXT CHECK (admin_scope IN ('super-admin', 'registrar', 'finance', 'operations'))")
		}

		if (!hasColumn(db, 'users', 'campus_id')) {
			ensureColumn(db, 'users', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
		}

		if (!hasColumn(db, 'users', 'campus_name')) {
			ensureColumn(db, 'users', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")
		}

		return new Map(
			db.prepare('SELECT id, email, phone_number, name, admin_scope, campus_id, campus_name, password_hash FROM users WHERE role = ?').all('admin')
				.map((row) => [row.id, row]),
		)
	} finally {
		db.close()
	}
}

async function reseedDatabase(preservedAdmins = new Map()) {
	const seed = JSON.parse(await fs.readFile(seedFile, 'utf8'))
	const db = new DatabaseSync(appDbPath)
	const timestamp = new Date().toISOString()

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
			student_category TEXT NOT NULL DEFAULT 'local',
			course TEXT,
			exam_date TEXT,
			exam_time TEXT,
			venue TEXT,
			seat_number TEXT,
			instructions TEXT,
			profile_image TEXT,
			exams_json TEXT NOT NULL DEFAULT '[]',
			total_fees REAL NOT NULL DEFAULT 0,
			amount_paid REAL NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
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
		CREATE INDEX IF NOT EXISTS idx_profile_exams_profile_id ON profile_exams(profile_id);
		CREATE TABLE IF NOT EXISTS support_requests (
			id TEXT PRIMARY KEY,
			student_id TEXT NOT NULL,
			subject TEXT NOT NULL,
			message TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'open',
			admin_reply TEXT NOT NULL DEFAULT '',
			resolved_at TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS system_settings (
			id TEXT PRIMARY KEY,
			local_student_fee REAL NOT NULL DEFAULT 3000,
			international_student_fee REAL NOT NULL DEFAULT 6000,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
	`)
	ensureColumn(db, 'profiles', 'phone_number TEXT')
	ensureColumn(db, 'profiles', "student_category TEXT NOT NULL DEFAULT 'local'")
	ensureColumn(db, 'profiles', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
	ensureColumn(db, 'profiles', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")
	ensureColumn(db, 'profiles', 'permit_token TEXT')
	ensureColumn(db, 'profiles', 'program TEXT')
	ensureColumn(db, 'profiles', 'college TEXT')
	ensureColumn(db, 'profiles', 'department TEXT')
	ensureColumn(db, 'profiles', 'semester TEXT')
	ensureColumn(db, 'profiles', "session TEXT CHECK (session IS NULL OR session IN ('day', 'evening', 'weekend'))")
	ensureColumn(db, 'profiles', "course_units_json TEXT NOT NULL DEFAULT '[]'")
	ensureColumn(db, 'users', 'phone_number TEXT')
	ensureColumn(db, 'users', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
	ensureColumn(db, 'users', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")
	ensureColumn(db, 'users', "admin_scope TEXT CHECK (admin_scope IN ('super-admin', 'registrar', 'finance', 'operations'))")
	ensureColumn(db, 'admin_activity_logs', "campus_id TEXT NOT NULL DEFAULT 'main-campus'")
	ensureColumn(db, 'admin_activity_logs', "campus_name TEXT NOT NULL DEFAULT 'Main Campus'")

	db.exec('PRAGMA foreign_keys = OFF;')
	db.exec('BEGIN;')

	try {
		db.exec('DELETE FROM sessions;')
		db.exec('DELETE FROM admin_activity_logs;')
		db.exec('DELETE FROM support_requests;')
		db.exec('DELETE FROM profile_exams;')
		db.exec('DELETE FROM profiles;')
		db.exec('DELETE FROM users;')
		db.exec('DELETE FROM campuses;')

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
				department, semester, course_units_json, exam_date, exam_time,
				venue, seat_number, instructions, profile_image, permit_token, exams_json, total_fees,
				amount_paid, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		const insertExam = db.prepare(`
			INSERT INTO profile_exams (id, profile_id, title, exam_date, exam_time, venue, seat_number, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		const insertSystemSettings = db.prepare(`
			INSERT INTO system_settings (id, local_student_fee, international_student_fee, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?)
		`)

		for (const campus of seed.campuses ?? []) {
			insertCampus.run(campus.id, campus.name, timestamp, timestamp)
		}

		for (const user of seed.users ?? []) {
			const preservedAdmin = user.role === 'admin' ? preservedAdmins.get(user.id) : null
			insertUser.run(
				user.id,
				preservedAdmin?.email ?? user.email,
				preservedAdmin?.phone_number ?? user.phone_number ?? null,
				user.role,
				preservedAdmin?.admin_scope ?? (user.role === 'admin' ? (user.admin_scope ?? 'operations') : null),
				preservedAdmin?.name ?? user.name,
				preservedAdmin?.campus_id ?? user.campus_id ?? 'main-campus',
				preservedAdmin?.campus_name ?? user.campus_name ?? 'Main Campus',
				preservedAdmin?.password_hash ?? hashPassword(user.password ?? 'Permit@2026'),
				timestamp,
				timestamp,
			)
		}

		for (const profile of seed.profiles ?? []) {
			const preservedAdmin = profile.role === 'admin' ? preservedAdmins.get(profile.id) : null
			const permitToken = createPermitToken()
			const exams = createExamAssignments(profile)

			insertProfile.run(
				profile.id,
				preservedAdmin?.email ?? profile.email,
				preservedAdmin?.phone_number ?? profile.phone_number ?? null,
				profile.role,
				preservedAdmin?.name ?? profile.name,
				preservedAdmin?.campus_id ?? profile.campus_id ?? 'main-campus',
				preservedAdmin?.campus_name ?? profile.campus_name ?? 'Main Campus',
				profile.student_id ?? null,
				profile.student_category === 'international' ? 'international' : 'local',
				profile.course ?? null,
				profile.program ?? profile.course ?? null,
				profile.college ?? null,
				profile.department ?? null,
				profile.semester ?? null,
				JSON.stringify(profile.course_units ?? profile.courseUnits ?? []),
				profile.exam_date ?? null,
				profile.exam_time ?? null,
				profile.venue ?? null,
				profile.seat_number ?? null,
				profile.instructions ?? null,
				profile.profile_image ?? null,
				permitToken,
				JSON.stringify(exams),
				profile.total_fees ?? 0,
				profile.amount_paid ?? 0,
				timestamp,
				timestamp,
			)

			for (const exam of exams) {
				insertExam.run(
					exam.id,
					profile.id,
					exam.title,
					exam.examDate,
					exam.examTime,
					exam.venue,
					exam.seatNumber,
					timestamp,
					timestamp,
				)
			}
		}

		const seededSystemSettings = seed.systemSettings ?? { local_student_fee: 3000, international_student_fee: 6000 }
		insertSystemSettings.run(
			'default',
			seededSystemSettings.local_student_fee ?? 3000,
			seededSystemSettings.international_student_fee ?? 6000,
			timestamp,
			timestamp,
		)

		db.exec('COMMIT;')
	} catch (error) {
		db.exec('ROLLBACK;')
		throw error
	} finally {
		db.exec('PRAGMA foreign_keys = ON;')
		db.close()
	}
}

await fs.mkdir(dataDir, { recursive: true })
await fs.mkdir(uploadsDir, { recursive: true })

const preservedAdmins = await readExistingAdmins(appDbPath)

let usedInPlaceReset = false

for (const filePath of [appDbPath, `${appDbPath}-shm`, `${appDbPath}-wal`, path.join(dataDir, 'store.json')]) {
	try {
		await fs.rm(filePath, { force: true })
	} catch (error) {
		if (filePath === appDbPath && error && typeof error === 'object' && 'code' in error && (error.code === 'EBUSY' || error.code === 'EPERM')) {
			usedInPlaceReset = true
			break
		}

		throw error
	}
}

if (usedInPlaceReset) {
	await reseedDatabase(preservedAdmins)
}

const uploadFiles = await fs.readdir(uploadsDir, { withFileTypes: true })

for (const entry of uploadFiles) {
	if (entry.name === '.gitkeep') {
		continue
	}

	await fs.rm(path.join(uploadsDir, entry.name), { recursive: true, force: true })
}

if (!usedInPlaceReset) {
	await reseedDatabase(preservedAdmins)
}

if (usedInPlaceReset) {
	console.log('Backend database and upload archive reset in place.')
} else {
	console.log('Backend database and upload archive reset.')
}
*/