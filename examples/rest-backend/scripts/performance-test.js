import assert from 'node:assert/strict'
import { request, startIsolatedServer } from './test-helpers.js'

function formatMs(value) {
  return `${value.toFixed(1)}ms`
}

async function measure(label, iterations, run) {
  const samples = []

  for (let attempt = 0; attempt < iterations; attempt += 1) {
    const started = performance.now()
    await run()
    samples.push(performance.now() - started)
  }

  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length
  const worst = Math.max(...samples)

  console.log(`${label}: avg ${formatMs(average)}, worst ${formatMs(worst)}`)
  return { average, worst }
}

const { baseUrl, stop } = await startIsolatedServer({
  dbFile: 'data/performance-test.sqlite',
  port: 4015,
})

try {
  const adminLogin = await request(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'Permit@2026' }),
  })

  for (let index = 0; index < 12; index += 1) {
    await request(baseUrl, '/profiles', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminLogin.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Performance Student ${index + 1}`,
        email: `performance-${index + 1}@example.com`,
        password: 'Permit@2026',
        student_id: `PERF${String(index + 1).padStart(3, '0')}`,
        course: 'Computer Science',
        total_fees: 3000,
        amount_paid: 1500,
      }),
    })
  }

  const healthStats = await measure('GET /health', 6, () => request(baseUrl, '/health'))
  const loginStats = await measure('POST /auth/login', 4, () => request(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'Permit@2026' }),
  }))
  const listStats = await measure('GET /profiles?role=student&page=1&pageSize=10', 6, () => request(baseUrl, '/profiles?role=student&page=1&pageSize=10', {
    headers: { Authorization: `Bearer ${adminLogin.token}` },
  }))

  assert.ok(healthStats.average < 500, `Expected health average under 500ms, received ${formatMs(healthStats.average)}`)
  assert.ok(loginStats.average < 1200, `Expected login average under 1200ms, received ${formatMs(loginStats.average)}`)
  assert.ok(listStats.average < 1200, `Expected student list average under 1200ms, received ${formatMs(listStats.average)}`)

  console.log('REST performance smoke test passed.')
} finally {
  await stop()
}