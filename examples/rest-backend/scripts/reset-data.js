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
	return randomBytes(18).toString('hex')
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

async function reseedDatabaseInPlace() {
	const seed = JSON.parse(await fs.readFile(seedFile, 'utf8'))
	const db = new DatabaseSync(appDbPath)
	const timestamp = new Date().toISOString()

	db.exec(`
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
	`)
	ensureColumn(db, 'profiles', 'permit_token TEXT')

	db.exec('PRAGMA foreign_keys = OFF;')
	db.exec('BEGIN;')

	try {
		db.exec('DELETE FROM sessions;')
		db.exec('DELETE FROM admin_activity_logs;')
		db.exec('DELETE FROM profile_exams;')
		db.exec('DELETE FROM profiles;')
		db.exec('DELETE FROM users;')
		db.exec('DELETE FROM campuses;')

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
		const insertExam = db.prepare(`
			INSERT INTO profile_exams (id, profile_id, title, exam_date, exam_time, venue, seat_number, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)

		for (const campus of seed.campuses ?? []) {
			insertCampus.run(campus.id, campus.name, timestamp, timestamp)
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
			const exams = createExamAssignments(profile)

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
	await reseedDatabaseInPlace()
}

const uploadFiles = await fs.readdir(uploadsDir, { withFileTypes: true })

for (const entry of uploadFiles) {
	if (entry.name === '.gitkeep') {
		continue
	}

	await fs.rm(path.join(uploadsDir, entry.name), { recursive: true, force: true })
}

if (usedInPlaceReset) {
	console.log('Backend database and upload archive reset in place.')
} else {
	console.log('Backend database and upload archive reset. Seed data will be loaded on next startup.')
}