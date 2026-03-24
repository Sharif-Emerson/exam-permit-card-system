import assert from 'node:assert/strict'
import { request, requestRaw, startIsolatedServer } from './test-helpers.js'

const { baseUrl, stop } = await startIsolatedServer({
  dbFile: 'data/security-test.sqlite',
  port: 4014,
  extraEnv: {
    CORS_ALLOWED_ORIGINS: 'https://portal.example.com',
  },
})

try {
  const failedLogin = await requestRaw(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'wrong-password' }),
  })

  assert.equal(failedLogin.status, 401)
  assert.match(String(failedLogin.body?.message ?? failedLogin.body), /invalid login credentials/i)

  const unauthenticatedStudents = await requestRaw(baseUrl, '/profiles?role=student', {})
  assert.equal(unauthenticatedStudents.status, 401)

  const adminLogin = await request(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'Permit@2026' }),
  })

  const createdStudent = await request(baseUrl, '/profiles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminLogin.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Security Student One',
      email: 'security-one@example.com',
      password: 'Permit@2026',
      student_id: 'SEC001',
      course: 'Computer Science',
      total_fees: 3000,
      amount_paid: 0,
    }),
  })

  await request(baseUrl, '/profiles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminLogin.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Security Student Two',
      email: 'security-two@example.com',
      password: 'Permit@2026',
      student_id: 'SEC002',
      course: 'Information Systems',
      total_fees: 3000,
      amount_paid: 0,
    }),
  })

  const studentLogin = await request(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'security-two@example.com', password: 'Permit@2026' }),
  })

  const forbiddenProfileAccess = await requestRaw(baseUrl, `/profiles/${createdStudent.id}`, {
    headers: { Authorization: `Bearer ${studentLogin.token}` },
  })
  assert.equal(forbiddenProfileAccess.status, 403)
  assert.match(String(forbiddenProfileAccess.body?.message ?? forbiddenProfileAccess.body), /only access your own profile/i)

  const studentCreateAttempt = await requestRaw(baseUrl, '/profiles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentLogin.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Blocked Student',
      email: 'blocked@example.com',
      password: 'Permit@2026',
      student_id: 'SEC003',
      course: 'Computer Science',
      total_fees: 3000,
      amount_paid: 0,
    }),
  })
  assert.equal(studentCreateAttempt.status, 403)

  const allowedLoopbackOrigin = await requestRaw(baseUrl, '/auth/login', {
    method: 'POST',
    headers: {
      Origin: 'http://127.0.0.1:4173',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'Permit@2026' }),
  })
  assert.equal(allowedLoopbackOrigin.status, 200)
  assert.equal(allowedLoopbackOrigin.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4173')

  const rejectedOrigin = await requestRaw(baseUrl, '/auth/login', {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example.com',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'Permit@2026' }),
  })
  assert.equal(rejectedOrigin.status, 500)
  assert.match(String(rejectedOrigin.body), /origin is not allowed by cors/i)

  console.log('REST security test passed.')
} finally {
  await stop()
}