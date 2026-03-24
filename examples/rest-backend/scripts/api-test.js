import assert from 'node:assert/strict'
import { request, startIsolatedServer } from './test-helpers.js'

function readNumericField(record, ...fieldNames) {
  for (const fieldName of fieldNames) {
    const value = record?.[fieldName]
    if (typeof value === 'number') {
      return value
    }
  }

  return undefined
}

function readFeeBalance(record) {
  const explicitBalance = readNumericField(record, 'feesBalance', 'fees_balance')
  if (typeof explicitBalance === 'number') {
    return explicitBalance
  }

  const totalFees = readNumericField(record, 'totalFees', 'total_fees')
  const amountPaid = readNumericField(record, 'amountPaid', 'amount_paid')

  if (typeof totalFees === 'number' && typeof amountPaid === 'number') {
    return totalFees - amountPaid
  }

  return undefined
}

const { baseUrl, stop } = await startIsolatedServer({
  dbFile: 'data/api-test.sqlite',
  port: 4013,
})

try {
  const health = await request(baseUrl, '/health')
  assert.equal(health.ok, true)

  const adminLogin = await request(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'Permit@2026' }),
  })

  assert.ok(typeof adminLogin.token === 'string' && adminLogin.token.length > 20)
  assert.equal(adminLogin.user.role, 'admin')

  const me = await request(baseUrl, '/auth/me', {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  })

  assert.equal(me.user.email, 'admin@example.com')

  const createdStudent = await request(baseUrl, '/profiles', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminLogin.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'API Contract Student',
      email: 'api-student@example.com',
      password: 'Permit@2026',
      student_id: 'API001',
      course: 'Computer Science',
      program: 'BSc Computer Science',
      total_fees: 3000,
      amount_paid: 1200,
      exam_date: '2026-04-15',
      exam_time: '10:00 AM',
      venue: 'Hall A',
      seat_number: 'A-001',
    }),
  })

  assert.equal(createdStudent.name, 'API Contract Student')
  assert.ok(typeof createdStudent.id === 'string' && createdStudent.id.length > 0)

  const studentsPage = await request(baseUrl, '/profiles?role=student&page=1&pageSize=10', {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  })

  assert.ok(Array.isArray(studentsPage.data))
  assert.ok(studentsPage.data.some((student) => student.id === createdStudent.id))
  assert.equal(studentsPage.meta.page, 1)
  assert.equal(studentsPage.meta.pageSize, 10)

  const studentProfile = await request(baseUrl, `/profiles/${createdStudent.id}`, {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  })

  assert.equal(studentProfile.email, 'api-student@example.com')
  assert.equal(readNumericField(studentProfile, 'totalFees', 'total_fees'), 3000)
  assert.equal(readNumericField(studentProfile, 'amountPaid', 'amount_paid'), 1200)
  assert.equal(readFeeBalance(studentProfile), 1800)

  const updatedFinancials = await request(baseUrl, `/profiles/${createdStudent.id}/financials`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminLogin.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amountPaid: 3000,
    }),
  })

  assert.equal(readNumericField(updatedFinancials, 'amountPaid', 'amount_paid'), 3000)
  assert.equal(readFeeBalance(updatedFinancials), 0)

  const settings = await request(baseUrl, '/system-settings', {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  })

  assert.equal(typeof settings.local_student_fee, 'number')
  assert.equal(typeof settings.international_student_fee, 'number')

  const updatedSettings = await request(baseUrl, '/system-settings', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${adminLogin.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      local_student_fee: 3500,
      international_student_fee: 7000,
    }),
  })

  assert.equal(updatedSettings.local_student_fee, 3500)
  assert.equal(updatedSettings.international_student_fee, 7000)

  await request(baseUrl, '/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  })

  console.log('REST API contract test passed.')
} finally {
  await stop()
}