import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as Window & { __printCount?: number }).__printCount = 0
    window.print = () => {
      ;(window as Window & { __printCount?: number }).__printCount = ((window as Window & { __printCount?: number }).__printCount ?? 0) + 1
    }
  })
})

async function signIn(page: Page, identifier: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email, Phone, or Registration No.').fill(identifier)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function completeDocumentChecklist(page: Page) {
  await page.getByLabel('Current course registration details').check()
  await page.getByLabel('Valid student identification').check()
  await page.getByLabel('Payment evidence when requested').check()
}

function createUniqueStudentSeed(prefix: string) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`

  return {
    name: `${prefix} ${suffix}`,
    email: `${prefix.toLowerCase().replace(/\s+/g, '-')}-${suffix}@example.com`,
    password: 'Permit@2026',
    studentId: `${prefix.toUpperCase().replace(/\s+/g, '').slice(0, 6)}-${suffix}`,
  }
}

async function createStudentAsAdmin(page: Page, values: {
  name: string
  email: string
  password: string
  studentId: string
  totalFees: string
  amountPaid: string
  course?: string
}) {
  await signIn(page, 'admin@example.com', 'Permit@2026')
  await expect(page).toHaveURL(/\/admin$/)
  await page.getByRole('button', { name: 'Add Student' }).click()
  await page.getByLabel('Full Name').fill(values.name)
  await page.getByLabel('Email').fill(values.email)
  await page.getByLabel('Initial Password').fill(values.password)
  await page.getByLabel('Registration No.').fill(values.studentId)
  await page.getByRole('textbox', { name: /^Course$/ }).fill(values.course ?? 'Computer Science')
  await page.getByLabel('Expected Total Fees ($)').fill(values.totalFees)
  await page.getByLabel('Amount Paid ($)').fill(values.amountPaid)
  await page.getByRole('button', { name: 'Create Student' }).click()
  await expect(page.getByText(`Student profile created for ${values.name}.`)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
}

test('student can submit a permit application', async ({ page }) => {
  const student = createUniqueStudentSeed('E2E Student')
  await createStudentAsAdmin(page, { ...student, totalFees: '3000', amountPaid: '1500' })
  await signIn(page, student.email, student.password)

  await expect(page).toHaveURL(/\/student$/)
  await expect(page.getByText(`Welcome, ${student.name}`)).toBeVisible()

  await page.getByRole('button', { name: 'Open full application view' }).click()
  await completeDocumentChecklist(page)
  await page.getByLabel('Course units').fill('CSC 499 - Capstone Project')
  await page.getByRole('button', { name: 'Apply for Permit' }).last().click()

  await expect(page.getByText('Permit request submitted successfully.')).toBeVisible()
  await expect(page.getByText('Outstanding fees must be cleared before approval.')).toBeVisible()
})

test('cleared student can download and print a permit', async ({ page }) => {
  const student = createUniqueStudentSeed('Cleared Student')
  await createStudentAsAdmin(page, { ...student, totalFees: '3000', amountPaid: '3000' })
  await signIn(page, student.email, student.password)

  await expect(page).toHaveURL(/\/student$/)

  const downloadButton = page.getByRole('button', { name: 'Download PDF' })
  const printButton = page.getByRole('button', { name: 'Print Permit' })

  await expect(downloadButton).toBeEnabled()
  await expect(printButton).toBeEnabled()

  await downloadButton.click()
  await printButton.click()

  await expect.poll(async () => page.evaluate(() => (window as Window & { __printCount?: number }).__printCount ?? 0)).toBe(2)
})

test('admin can assign a phone number and the student can log in with it', async ({ page }) => {
  const student = createUniqueStudentSeed('Phone Student')
  await createStudentAsAdmin(page, { ...student, totalFees: '3000', amountPaid: '1500' })
  await signIn(page, 'admin@example.com', 'Permit@2026')

  await expect(page).toHaveURL(/\/admin$/)
  await page.getByLabel('Search students').fill(student.name)

  const studentRow = page.locator('tr', { hasText: student.name }).first()
  await studentRow.getByTitle('Edit student profile').click()

  await page.getByLabel('Phone Number').fill('+256700123456')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(page.getByText(`Student profile updated for ${student.name}.`)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()

  await signIn(page, '+256700123456', 'Permit@2026')
  await expect(page).toHaveURL(/\/student$/)
  await expect(page.getByText(`Welcome, ${student.name}`)).toBeVisible()
})

test('admin can update received payment and clear the remaining balance', async ({ page }) => {
  const student = createUniqueStudentSeed('Payment Student')
  await createStudentAsAdmin(page, { ...student, totalFees: '3000', amountPaid: '1500' })
  await signIn(page, 'admin@example.com', 'Permit@2026')

  await expect(page).toHaveURL(/\/admin$/)
  await page.getByLabel('Search students').fill(student.name)

  const studentRow = page.locator('tr', { hasText: student.name }).first()
  await studentRow.getByLabel(new RegExp(`Amount received for ${student.name}`, 'i')).fill('2800')
  await studentRow.getByLabel(new RegExp(`Amount received for ${student.name}`, 'i')).press('Enter')

  await expect(page.getByText(`Saved received payment for ${student.name}.`)).toBeVisible()
  await studentRow.getByTitle('Mark fully paid').click()
  await expect(page.getByText(`${student.name} has been cleared for printing.`)).toBeVisible()
})
