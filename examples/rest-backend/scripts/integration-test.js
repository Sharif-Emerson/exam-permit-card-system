import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
const relativeDbPath = path.join('data', 'integration-test.sqlite')
const dbPath = path.join(backendRoot, relativeDbPath)
const port = 4011

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Keep retrying until the backend is ready.
    }

    await delay(250)
  }

  throw new Error(`Server did not become ready at ${url}`)
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options)
  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${pathname} failed with ${response.status}: ${JSON.stringify(body)}`)
  }

  return body
}

async function requestRaw(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options)
  const text = await response.text()

  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  }
}

async function runReset() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/reset-data.js'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        APP_DB_PATH: relativeDbPath,
      },
      stdio: 'inherit',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }

      reject(new Error(`reset-data exited with code ${code ?? -1}`))
    })
    child.on('error', reject)
  })
}

async function stopServer(server) {
  await new Promise((resolve) => {
    server.once('exit', () => resolve(undefined))
    server.kill('SIGTERM')
  })
}

async function main() {
  await fs.rm(dbPath, { force: true })
  await fs.rm(`${dbPath}-shm`, { force: true })
  await fs.rm(`${dbPath}-wal`, { force: true })
  await runReset()

  const server = spawn(process.execPath, ['server.js'], {
    cwd: backendRoot,
    env: {
      ...process.env,
      PORT: String(port),
      APP_DB_PATH: relativeDbPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  server.stdout.on('data', (chunk) => process.stdout.write(chunk))
  server.stderr.on('data', (chunk) => process.stderr.write(chunk))

  try {
    const baseUrl = `http://127.0.0.1:${port}`
    await waitForServer(`${baseUrl}/health`)

    const adminLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@example.com', password: 'Permit@2026' }),
    })

    const registrarLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'registrar@example.com', password: 'Permit@2026' }),
    })

    assert.equal(registrarLogin.user.role, 'admin')
    assert.equal(registrarLogin.user.scope, 'registrar')
    assert.ok(registrarLogin.user.permissions.includes('manage_student_profiles'))
    assert.ok(!registrarLogin.user.permissions.includes('manage_financials'))

    const financeLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'finance@example.com', password: 'Permit@2026' }),
    })

    assert.equal(financeLogin.user.role, 'admin')
    assert.equal(financeLogin.user.scope, 'finance')
    assert.ok(financeLogin.user.permissions.includes('manage_financials'))
    assert.ok(!financeLogin.user.permissions.includes('manage_student_profiles'))

    const initialFeeSettings = await request(baseUrl, '/system-settings', {
      headers: {
        Authorization: `Bearer ${financeLogin.token}`,
      },
    })

    assert.equal(initialFeeSettings.local_student_fee, 3000)
    assert.equal(initialFeeSettings.international_student_fee, 6000)

    const updatedFeeSettings = await request(baseUrl, '/system-settings', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${financeLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        local_student_fee: 4500,
        international_student_fee: 9000,
      }),
    })

    assert.equal(updatedFeeSettings.local_student_fee, 4500)
    assert.equal(updatedFeeSettings.international_student_fee, 9000)

    await request(baseUrl, '/profiles/admin-1/account', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Administrator Preferred',
        email: 'owner@school.edu',
      }),
    })

    const renamedAdminLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'owner@school.edu', password: 'Permit@2026' }),
    })

    assert.equal(renamedAdminLogin.user.role, 'admin')
    assert.equal(renamedAdminLogin.user.scope, 'super-admin')
    assert.ok(renamedAdminLogin.user.permissions.includes('manage_student_profiles'))
    assert.ok(renamedAdminLogin.user.permissions.includes('manage_financials'))

    const duplicateAdminEmailAttempt = await requestRaw(baseUrl, '/profiles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registrarLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Duplicate Admin Email Student',
        email: 'owner@school.edu',
        password: 'Permit@2030',
        student_id: 'DUP001',
        course: 'Computer Science',
        total_fees: 250000,
        amount_paid: 0,
      }),
    })

    assert.equal(duplicateAdminEmailAttempt.status, 400)
    assert.match(duplicateAdminEmailAttempt.body.message, /already used by an admin login/i)

    const primaryStudent = await request(baseUrl, '/profiles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registrarLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Integration Student',
        email: 'integration-student@example.com',
        password: 'Permit@2026',
        student_id: 'INT001',
        course: 'Computer Science',
        total_fees: 300000,
        amount_paid: 150000,
        exam_date: '2026-04-15',
        exam_time: '10:00 AM',
        venue: 'Hall A',
        seat_number: 'A-001',
      }),
    })

    const studentLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'integration-student@example.com', password: 'Permit@2026' }),
    })

    const passwordChangeAttempt = await requestRaw(baseUrl, `/profiles/${primaryStudent.id}/account`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Integration Student',
        email: 'integration-student@example.com',
        password: 'Permit@2027',
      }),
    })

    assert.equal(passwordChangeAttempt.status, 400)
    assert.match(passwordChangeAttempt.body.message, /current password is required/i)

    await request(baseUrl, `/profiles/${primaryStudent.id}/account`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Integration Student',
        email: 'integration-student@example.com',
        currentPassword: 'Permit@2026',
        password: 'Permit@2027',
      }),
    })

    const oldPasswordLogin = await requestRaw(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'integration-student@example.com', password: 'Permit@2026' }),
    })

    assert.equal(oldPasswordLogin.status, 401)
    assert.match(oldPasswordLogin.body.message, /invalid login credentials/i)

    const updatedPasswordLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'integration-student@example.com', password: 'Permit@2027' }),
    })

    assert.equal(updatedPasswordLogin.user.id, primaryStudent.id)

    const createdStudent = await request(baseUrl, '/profiles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registrarLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Manual Entry Student',
        email: 'manual-entry@example.com',
        password: 'Permit@2028',
        student_id: 'STU900',
        phone_number: '+256701000999',
        course: 'Information Technology',
        program: 'BIT',
        department: 'Information Technology',
        semester: 'Semester 1 2026/2027',
        course_units: ['BIT 101', 'BIT 102'],
        total_fees: '500,000',
        amount_paid: '125,000',
        instructions: 'Report 30 minutes early.',
        exam_date: '2026-11-04',
        exam_time: '9:00 AM',
        venue: 'Innovation Hall',
        seat_number: 'C-21',
      }),
    })

    assert.equal(createdStudent.role, 'student')
    assert.equal(createdStudent.email, 'manual-entry@example.com')
    assert.equal(createdStudent.student_id, 'STU900')
    assert.equal(createdStudent.amount_paid, 125000)

    const createdStudentLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'STU900', password: 'Permit@2028' }),
    })

    assert.equal(createdStudentLogin.user.role, 'student')
    assert.equal(createdStudentLogin.user.email, 'manual-entry@example.com')

    const internationalStudent = await request(baseUrl, '/profiles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registrarLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'International Student',
        email: 'international-student@example.com',
        password: 'Permit@2029',
        student_id: 'INTL900',
        student_category: 'international',
        course: 'Information Technology',
      }),
    })

    assert.equal(internationalStudent.student_category, 'international')
    assert.equal(internationalStudent.total_fees, 9000)

    const localStudent = await request(baseUrl, '/profiles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registrarLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Local Student',
        email: 'local-student@example.com',
        password: 'Permit@2031',
        student_id: 'LOC900',
        student_category: 'local',
        course: 'Computer Science',
      }),
    })

    assert.equal(localStudent.student_category, 'local')
    assert.equal(localStudent.total_fees, 4500)

    await request(baseUrl, `/profiles/${primaryStudent.id}/admin`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${registrarLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: '+256700123456',
        profile_image: 'https://example.com/avatar.jpg',
      }),
    })

    const phoneLogin = await request(baseUrl, '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '+256700123456', password: 'Permit@2027' }),
    })

    assert.equal(phoneLogin.user.id, primaryStudent.id)

    const registrarFinanceAttempt = await requestRaw(baseUrl, `/profiles/${primaryStudent.id}/financials`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${registrarLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amountPaid: 50000 }),
    })

    assert.equal(registrarFinanceAttempt.status, 403)
    assert.match(registrarFinanceAttempt.body.message, /permission to manage student financials/i)

    const financeProfileAttempt = await requestRaw(baseUrl, `/profiles/${primaryStudent.id}/admin`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${financeLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: '+256700999999',
      }),
    })

    assert.equal(financeProfileAttempt.status, 403)
    assert.match(financeProfileAttempt.body.message, /permission to manage student profiles/i)

    const financeSupportAttempt = await requestRaw(baseUrl, '/support-requests', {
      headers: {
        Authorization: `Bearer ${financeLogin.token}`,
      },
    })

    assert.equal(financeSupportAttempt.status, 403)
    assert.match(financeSupportAttempt.body.message, /permission to view support requests/i)

    const financeUpdate = await request(baseUrl, `/profiles/${primaryStudent.id}/financials`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${financeLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amountPaid: 250000, totalFees: 400000 }),
    })

    assert.equal(financeUpdate.amount_paid, 250000)
    assert.equal(financeUpdate.total_fees, 400000)

    const supportRequest = await request(baseUrl, '/support-requests', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: 'Need permit help',
        message: 'Please confirm why my permit is still pending after payment.',
      }),
    })

    assert.equal(supportRequest.studentId, primaryStudent.id)
    assert.equal(supportRequest.status, 'open')

    const studentRequests = await request(baseUrl, '/support-requests', {
      headers: {
        Authorization: `Bearer ${studentLogin.token}`,
      },
    })
    assert.equal(studentRequests.data.length, 1)

    const resolvedRequest = await request(baseUrl, `/support-requests/${supportRequest.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${registrarLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'resolved',
        adminReply: 'Your permit is now being processed.',
      }),
    })

    assert.equal(resolvedRequest.status, 'resolved')
    assert.equal(resolvedRequest.adminReply, 'Your permit is now being processed.')

    await request(baseUrl, '/permit-activity', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ studentId: primaryStudent.id, action: 'download_permit' }),
    })

    await request(baseUrl, '/permit-activity', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ studentId: primaryStudent.id, action: 'print_permit' }),
    })

    const activityLogs = await request(baseUrl, '/admin-activity-logs', {
      headers: {
        Authorization: `Bearer ${adminLogin.token}`,
      },
    })

    assert.ok(activityLogs.data.some((entry) => entry.action === 'download_permit' && entry.target_profile_id === primaryStudent.id))
    assert.ok(activityLogs.data.some((entry) => entry.action === 'print_permit' && entry.target_profile_id === primaryStudent.id))

    console.log('REST integration test passed.')
  } finally {
    await stopServer(server)
    await fs.rm(dbPath, { force: true })
    await fs.rm(`${dbPath}-shm`, { force: true })
    await fs.rm(`${dbPath}-wal`, { force: true })
  }
}

await main()
