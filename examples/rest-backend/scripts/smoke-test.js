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
await fs.writeFile(smokeCsvPath, 'student_id,amount_paid,total_fees\nSTU001,2800,3000\n')

const login = await request('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.com', password: 'Permit@2026' }),
})

const formData = new FormData()
formData.set('file', new Blob([await fs.readFile(smokeCsvPath)], { type: 'text/csv' }), 'smoke.csv')

const preview = await request('/imports/financials/preview', {
  method: 'POST',
  headers: { Authorization: `Bearer ${login.token}` },
  body: formData,
})

const apply = await request('/imports/financials/apply', {
  method: 'POST',
  headers: { Authorization: `Bearer ${login.token}` },
  body: formData,
})

const profile = await request('/profiles/student-1', {
  headers: { Authorization: `Bearer ${login.token}` },
})

const publicPermit = await request(`/permits/${profile.permit_token}`)

const studentLogin = await request('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'student1@example.com', password: 'Permit@2026' }),
})

const otherStudentLogin = await request('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'student2@example.com', password: 'Permit@2026' }),
})

const forbiddenProfileAccess = await requestRaw('/profiles/student-1', {
  headers: { Authorization: `Bearer ${otherStudentLogin.token}` },
})

const accountUpdated = await request('/profiles/student-1/account', {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${studentLogin.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe Updated',
    email: 'student1@example.com',
    profileImage: 'https://example.com/avatar.png',
  }),
})

const accountRestored = await request('/profiles/student-1/account', {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${studentLogin.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'student1@example.com',
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
  accountRestored,
}, null, 2))