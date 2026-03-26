import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
const uploadsDir = path.join(backendRoot, 'uploads')
const smokeCsvPath = path.join(uploadsDir, 'smoke.csv')

async function request(pathname, options = {}) {
  const response = await fetch(`http://localhost:4000${pathname}`, options)
  const text = await response.text()

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${pathname} failed with ${response.status}: ${text}`)
  }

  return text ? JSON.parse(text) : null
}

async function requestRaw(pathname, options = {}) {
  const response = await fetch(`http://localhost:4000${pathname}`, options)
  const text = await response.text()

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  }
}

await fs.mkdir(uploadsDir, { recursive: true })

const login = await request('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'admin@example.com', password: 'Permit@2026' }),
})

const createdStudent = await request('/profiles', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${login.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Smoke Student One',
    email: 'smoke-student-1@example.com',
    password: 'Permit@2026',
    student_id: 'SMOKE001',
    course: 'Computer Science',
    total_fees: 3000,
    amount_paid: 1500,
    exam_date: '2026-04-15',
    exam_time: '10:00 AM',
    venue: 'Hall A',
    seat_number: 'A-001',
  }),
})

await fs.writeFile(smokeCsvPath, 'student_name,student_id,amount_paid,total_fees\nSmoke Student One,SMOKE001,2800,3000\n')

const formData = new FormData()
formData.set('file', new Blob([await fs.readFile(smokeCsvPath)], { type: 'text/csv' }), 'smoke.csv')

const preview = await request('/imports/financials/preview', {
  method: 'POST',
  headers: { Authorization: `Bearer ${login.token}` },
  body: formData,
})

if (preview?.data?.[0]?.studentName !== 'John Doe') {
  throw new Error(`Expected preview row to include studentName John Doe, received ${JSON.stringify(preview?.data?.[0] ?? null)}`)
}

const apply = await request('/imports/financials/apply', {
  method: 'POST',
  headers: { Authorization: `Bearer ${login.token}` },
  body: formData,
})

const profile = await request(`/profiles/${createdStudent.id}`, {
  headers: { Authorization: `Bearer ${login.token}` },
})

const publicPermit = await request(`/permits/${profile.permit_token}`)

const studentLogin = await request('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'smoke-student-1@example.com', password: 'Permit@2026' }),
})

const otherStudentLogin = await request('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'smoke-student-2@example.com', password: 'Permit@2026' }),
})

const forbiddenProfileAccess = await requestRaw(`/profiles/${createdStudent.id}`, {
  headers: { Authorization: `Bearer ${otherStudentLogin.token}` },
})

const accountUpdated = await request(`/profiles/${createdStudent.id}/account`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${studentLogin.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Smoke Student One Updated',
    email: 'smoke-student-1@example.com',
    profileImage: 'https://example.com/avatar.png',
  }),
})

const adminUpdatedProfile = await request(`/profiles/${createdStudent.id}/admin`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${login.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Smoke Student One Admin Updated',
    email: 'smoke-student-1@example.com',
    student_id: 'SMOKE001-UPDATED',
    course: 'Computer Science',
    total_fees: 3200,
  }),
})

const adminRestoredProfile = await request(`/profiles/${createdStudent.id}/admin`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${login.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Smoke Student One',
    email: 'smoke-student-1@example.com',
    student_id: 'SMOKE001',
    course: 'Computer Science',
    total_fees: 3000,
  }),
})

const accountRestored = await request(`/profiles/${createdStudent.id}/account`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${studentLogin.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Smoke Student One',
    email: 'smoke-student-1@example.com',
    profileImage: null,
  }),
})

console.log(JSON.stringify({
  login,
  preview,
  apply,
  profile,
  publicPermit,
  studentLogin,
  otherStudentLogin,
  forbiddenProfileAccess,
  accountUpdated,
  adminUpdatedProfile,
  adminRestoredProfile,
  accountRestored,
}, null, 2))