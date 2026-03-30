import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, vi } from 'vitest'
import type { AuthUser } from '../types'

const {
  signOut,
  refreshUser,
  fetchStudentProfilesPage,
  fetchTrashedStudentProfiles,
  fetchAdminActivityLogsPage,
  fetchSystemFeeSettings,
  updateSystemFeeSettings,
  updateStudentAccount,
  adminUpdateStudentProfile,
  createStudentProfile,
  deleteStudentProfile,
  grantStudentPermitPrintAccess,
  restoreStudentProfile,
  updateStudentFinancials,
  clearStudentBalance,
  importStudentFinancials,
  fetchSupportRequests,
  updateSupportRequest,
  parseFinancialSpreadsheet,
  downloadFinancialImportTemplate,
  downloadPermitActivityCsv,
} = vi.hoisted(() => ({
  signOut: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(undefined),
  fetchStudentProfilesPage: vi.fn(),
  fetchTrashedStudentProfiles: vi.fn(),
  fetchAdminActivityLogsPage: vi.fn(),
  fetchSystemFeeSettings: vi.fn(),
  updateSystemFeeSettings: vi.fn(),
  updateStudentAccount: vi.fn(),
  adminUpdateStudentProfile: vi.fn(),
  createStudentProfile: vi.fn(),
  deleteStudentProfile: vi.fn(),
  grantStudentPermitPrintAccess: vi.fn(),
  restoreStudentProfile: vi.fn(),
  updateStudentFinancials: vi.fn(),
  clearStudentBalance: vi.fn(),
  importStudentFinancials: vi.fn(),
  fetchSupportRequests: vi.fn(),
  updateSupportRequest: vi.fn(),
  parseFinancialSpreadsheet: vi.fn(),
  downloadFinancialImportTemplate: vi.fn(),
  downloadPermitActivityCsv: vi.fn(),
}))

vi.mock('../hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: () => ({
    hasUnsavedChanges: false,
    setHasUnsavedChanges: vi.fn(),
    savePendingChanges: vi.fn().mockResolvedValue(true),
    registerSaveHandler: vi.fn(),
    unregisterSaveHandler: vi.fn(),
    registerDiscardHandler: vi.fn(),
    unregisterDiscardHandler: vi.fn(),
    forceShowDialog: vi.fn(),
  }),
}))

function createStudentPage(items: Array<Record<string, unknown>>) {
  const clearedStudents = items.filter((item) => Number(item.feesBalance ?? 0) === 0).length

  return {
    items,
    page: 1,
    pageSize: 24,
    totalItems: items.length,
    totalPages: 1,
    totalStudents: items.length,
    clearedStudents,
    outstandingStudents: items.length - clearedStudents,
  }
}

function createActivityPage(items: Array<Record<string, unknown>>) {
  return {
    items,
    page: 1,
    pageSize: 12,
    totalItems: items.length,
    totalPages: 1,
  }
}

function createAdminUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
    name: 'Administrator',
    scope: 'super-admin',
    permissions: [
      'view_students',
      'manage_student_profiles',
      'manage_financials',
      'manage_support_requests',
      'view_audit_logs',
      'export_reports',
      'write_audit_logs',
    ],
    ...overrides,
  }
}

function withinEditStudentDialog() {
  return within(screen.getByRole('dialog', { name: /edit student profile/i }))
}

function withinCreateStudentDialog() {
  return within(screen.getByRole('dialog', { name: /add new student/i }))
}

describe('AdminPanel', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchTrashedStudentProfiles').mockImplementation(fetchTrashedStudentProfiles)
    vi.spyOn(profileServiceModule, 'restoreStudentProfile').mockImplementation(restoreStudentProfile)
    fetchTrashedStudentProfiles.mockResolvedValue([])
    fetchSupportRequests.mockResolvedValue([])
    updateSupportRequest.mockResolvedValue({})
    fetchSystemFeeSettings.mockResolvedValue({
      localStudentFee: 3000,
      internationalStudentFee: 6000,
    })
    updateSystemFeeSettings.mockResolvedValue({
      localStudentFee: 3500,
      internationalStudentFee: 7000,
    })
  })

  it('previews spreadsheet rows before applying the import', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        phoneNumber: '+256700123456',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [
          {
            id: 'student-1-exam-1',
            title: 'Computer Science Theory',
            examDate: '2026-04-15',
            examTime: '10:00 AM',
            venue: 'Hall A',
            seatNumber: 'A-001',
          },
        ],
        totalFees: 3000,
        amountPaid: 500,
        feesBalance: 2500,
      },
    ]))

    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    parseFinancialSpreadsheet.mockResolvedValue([
      { rowNumber: 2, studentId: 'STU001', amountPaid: 2500, totalFees: 3000 },
    ])

    importStudentFinancials.mockResolvedValue({
      updatedCount: 1,
      createdCount: 0,
      createdStudents: [],
      skippedRows: [],
    })

    const { container } = render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /open bulk import/i }))

    const fileInput = container.querySelector('#admin-financial-import-input') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()

    const file = new File(['student_id,amount_paid,total_fees'], 'payments.csv', { type: 'text/csv' })
    await user.upload(fileInput!, file)

    expect(await screen.findByText(/import preview/i)).toBeTruthy()
    expect(await screen.findByText(/1 row\(s\) are ready to apply/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /apply import/i }))

    await waitFor(() => {
      expect(importStudentFinancials).toHaveBeenCalledWith(
        [{ rowNumber: 2, action: 'update', studentId: 'student-1', amountPaid: 2500, totalFees: 3000 }],
        'admin-1',
      )
    })
  }, 20000)

  it('prepares unmatched spreadsheet rows as new student creations when required details are present', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    parseFinancialSpreadsheet.mockResolvedValue([
      {
        rowNumber: 2,
        studentName: 'Imported Student',
        studentId: 'IMP001',
        email: 'imported.student@example.com',
        course: 'Computer Science',
        department: 'Computer Science',
        semester: 'Semester 1 2026/2027',
        amountPaid: 500,
        totalFees: 3000,
      },
    ])

    importStudentFinancials.mockResolvedValue({
      updatedCount: 0,
      createdCount: 1,
      createdStudents: [
        {
          rowNumber: 2,
          name: 'Imported Student',
          email: 'imported.student@example.com',
          studentId: 'IMP001',
          password: 'Permit-IMP001',
        },
      ],
      skippedRows: [],
    })

    const { container } = render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /open bulk import/i }))

    const fileInput = container.querySelector('#admin-financial-import-input') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()

    const file = new File(['student_name,student_id,email,course,amount_paid,total_fees'], 'new-students.csv', { type: 'text/csv' })
    await user.upload(fileInput!, file)

    expect(await screen.findByText(/import preview/i)).toBeTruthy()
    expect(await screen.findByText(/new student account will be created/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /apply import/i }))

    await waitFor(() => {
      expect(importStudentFinancials).toHaveBeenCalledWith(
        [
          {
            rowNumber: 2,
            action: 'create',
            createStudent: {
              name: 'Imported Student',
              email: 'imported.student@example.com',
              password: 'Permit-IMP001',
              studentId: 'IMP001',
              studentCategory: 'local',
              course: 'Computer Science',
              department: 'Computer Science',
              semester: 'Semester 1 2026/2027',
              totalFees: 3000,
              amountPaid: 500,
            },
          },
        ],
        'admin-1',
      )
    })
  }, 20000)

  it('shows print and download status for each student', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        studentCategory: 'local',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [
          {
            id: 'student-1-exam-1',
            title: 'Computer Science Theory',
            examDate: '2026-04-15',
            examTime: '10:00 AM',
            venue: 'Hall A',
            seatNumber: 'A-001',
          },
        ],
        totalFees: 3000,
        amountPaid: 3000,
        feesBalance: 0,
      },
    ]))

    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([
      {
        id: 'log-1',
        adminId: 'student-1',
        targetProfileId: 'student-1',
        action: 'print_permit',
        details: { source: 'student-portal' },
        createdAt: '2026-03-22T12:17:07.151Z',
      },
      {
        id: 'log-2',
        adminId: 'student-1',
        targetProfileId: 'student-1',
        action: 'download_permit',
        details: { source: 'student-portal' },
        createdAt: '2026-03-22T12:18:07.151Z',
      },
    ]))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
      expect(fetchAdminActivityLogsPage).toHaveBeenCalled()
    })

    expect(await screen.findByText(/printed 1x/i)).toBeTruthy()
    expect(await screen.findByText(/downloaded 1x/i)).toBeTruthy()
  })

  it('filters the student list to only printed students', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [
          {
            id: 'student-1-exam-1',
            title: 'Computer Science Theory',
            examDate: '2026-04-15',
            examTime: '10:00 AM',
            venue: 'Hall A',
            seatNumber: 'A-001',
          },
        ],
        totalFees: 3000,
        amountPaid: 3000,
        feesBalance: 0,
      },
      {
        id: 'student-3',
        email: 'student3@example.com',
        role: 'student',
        name: 'Grace Walker',
        studentId: 'STU003',
        course: 'Information Systems',
        examDate: '2026-04-18',
        examTime: '8:30 AM',
        venue: 'Hall C',
        seatNumber: 'C-014',
        instructions: 'Bring your permit and student card.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [
          {
            id: 'student-3-exam-1',
            title: 'Information Systems Analysis',
            examDate: '2026-04-18',
            examTime: '8:30 AM',
            venue: 'Hall C',
            seatNumber: 'C-014',
          },
        ],
        totalFees: 3000,
        amountPaid: 3000,
        feesBalance: 0,
      },
    ]))

    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([
      {
        id: 'log-1',
        adminId: 'student-1',
        targetProfileId: 'student-1',
        action: 'print_permit',
        details: { source: 'student-portal' },
        createdAt: '2026-03-22T12:17:07.151Z',
      },
    ]))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
      expect(fetchAdminActivityLogsPage).toHaveBeenCalled()
    })

    expect((await screen.findAllByText('John Doe')).length > 0).toBe(true)
    expect((await screen.findAllByText('Grace Walker')).length > 0).toBe(true)

    await user.click(screen.getByLabelText(/show printed students only/i))

    expect((await screen.findAllByText('John Doe')).length > 0).toBe(true)
    expect(screen.queryByText('Grace Walker')).toBeNull()
  })

  it('shows active student filters and resets them so hidden students reappear', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    const allStudentsPage = createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        course: 'Computer Science',
        totalFees: 3000,
        amountPaid: 3000,
        feesBalance: 0,
        exams: [],
      },
      {
        id: 'student-2',
        email: 'student2@example.com',
        role: 'student',
        name: 'Grace Walker',
        studentId: 'STU002',
        course: 'Information Systems',
        totalFees: 3000,
        amountPaid: 1000,
        feesBalance: 2000,
        exams: [],
      },
    ])

    fetchStudentProfilesPage.mockImplementation(async (query) => {
      if (String(query?.search ?? '').trim().toLowerCase() === 'missing student') {
        return {
          ...allStudentsPage,
          items: [],
          totalItems: 0,
          totalPages: 1,
        }
      }

      return allStudentsPage
    })

    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.type(screen.getByLabelText(/search students/i), 'missing student')

    expect(await screen.findByText(/student filters are active/i)).toBeTruthy()
    expect(await screen.findByRole('button', { name: /reset student view/i })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /reset student view/i }))

    expect(await screen.findByText('John Doe')).toBeTruthy()
    expect(await screen.findByText('Grace Walker')).toBeTruthy()
    expect(screen.queryByText(/student filters are active/i)).toBeNull()
  })

  it('opens the notification center from the admin header and routes alerts to the student queue', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'Outstanding Student',
        studentId: 'STU001',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [],
        totalFees: 3000,
        amountPaid: 1000,
        feesBalance: 2000,
        canPrintPermit: false,
        printAccessMessage: 'Outstanding balance remains.',
        permitPrintsUsedThisMonth: 0,
        permitPrintsRemainingThisMonth: 2,
        permitPrintGrantMonth: null,
        permitPrintGrantsRemaining: 0,
      },
    ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /^dashboard$/i }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /open notification center/i }))
    const notificationCenter = await screen.findByRole('dialog', { name: /admin notifications/i })
    expect(notificationCenter).toBeTruthy()
    expect(within(notificationCenter).getByText(/pending approvals require action/i)).toBeTruthy()

    await user.click(within(notificationCenter).getByRole('button', { name: /review students/i }))

    expect(await screen.findByRole('heading', { name: 'Students' })).toBeTruthy()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /admin notifications/i })).toBeNull()
    })
  })

  it('edits a student profile from the permit card view', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [
          {
            id: 'student-1-exam-1',
            title: 'Computer Science Theory',
            examDate: '2026-04-15',
            examTime: '10:00 AM',
            venue: 'Hall A',
            seatNumber: 'A-001',
          },
        ],
        totalFees: 3000,
        amountPaid: 1500,
        feesBalance: 1500,
      },
    ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))
    adminUpdateStudentProfile.mockResolvedValue({
      id: 'student-1',
      email: 'student1@example.com',
      role: 'student',
      name: 'John Doe Updated',
      studentId: 'STU001-NEW',
      studentCategory: 'local',
      phoneNumber: '+256700123456',
      course: 'Software Engineering',
      program: 'BSc Software Engineering',
      college: 'College of Computing and Digital Innovation',
      department: 'Department of Software Engineering',
      semester: 'Semester 2 2026/2027',
      courseUnits: ['SWE 401 Secure Coding', 'SWE 403 DevOps Engineering'],
      examDate: '2026-04-15',
      examTime: '10:00 AM',
      venue: 'Hall A',
      seatNumber: 'A-001',
      instructions: 'Bring valid ID.',
      profileImage: 'https://via.placeholder.com/150',
      exams: [
        {
          id: 'student-1-exam-1',
          title: 'Computer Science Theory',
          examDate: '2026-04-15',
          examTime: '10:00 AM',
          venue: 'Hall A',
          seatNumber: 'A-001',
        },
      ],
      totalFees: 3200,
      amountPaid: 1500,
      feesBalance: 1700,
    })

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /permit cards/i }))
    expect(await screen.findByRole('heading', { name: /permit card management/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /edit profile for john doe/i }))
    expect(await screen.findByRole('heading', { name: /edit student profile/i })).toBeTruthy()

    const editDlg = withinEditStudentDialog()
    fireEvent.change(editDlg.getByLabelText(/full name/i), { target: { value: 'John Doe Updated' } })
    fireEvent.change(editDlg.getByLabelText(/registration no\./i), { target: { value: 'STU001-NEW' } })
    fireEvent.change(editDlg.getByLabelText(/^course$/i), { target: { value: 'Software Engineering' } })
    fireEvent.change(editDlg.getByLabelText(/^program$/i), { target: { value: 'BSc Software Engineering' } })
    fireEvent.change(editDlg.getByLabelText(/^college$/i), { target: { value: 'College of Computing and Digital Innovation' } })
    fireEvent.change(editDlg.getByLabelText(/^department$/i), { target: { value: 'Department of Software Engineering' } })
    fireEvent.change(editDlg.getByLabelText(/^semester$/i), { target: { value: 'Semester 2 2026/2027' } })
    fireEvent.change(editDlg.getByLabelText(/course units/i), { target: { value: 'SWE 401 Secure Coding\nSWE 403 DevOps Engineering' } })
    fireEvent.change(editDlg.getByLabelText(/total fees/i), { target: { value: '3200' } })
    await user.click(editDlg.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(adminUpdateStudentProfile).toHaveBeenCalledWith(
        'student-1',
        {
          name: 'John Doe Updated',
          email: 'student1@example.com',
          studentId: 'STU001-NEW',
          studentCategory: 'local',
          phoneNumber: '',
          profileImage: 'https://via.placeholder.com/150',
          course: 'Software Engineering',
          program: 'BSc Software Engineering',
          college: 'College of Computing and Digital Innovation',
          department: 'Department of Software Engineering',
          semester: 'Semester 2 2026/2027',
          courseUnits: ['SWE 401 Secure Coding', 'SWE 403 DevOps Engineering'],
          totalFees: 3200,
        },
        'admin-1',
      )
    })

    expect(await screen.findByText(/student profile updated for john doe updated\./i)).toBeTruthy()
  }, 10000)

  it('creates a student profile from the students view', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'createStudentProfile').mockImplementation(createStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    fetchStudentProfilesPage
      .mockResolvedValueOnce(createStudentPage([]))
      .mockResolvedValueOnce(createStudentPage([
        {
          id: 'student-99',
          email: 'newstudent@example.com',
          role: 'student',
          name: 'New Student',
          studentId: 'STU099',
          studentCategory: 'international',
          phoneNumber: '+256700111222',
          course: 'Computer Science',
          program: 'BSc Computer Science',
          college: 'College of Computing',
          department: 'Computer Science',
          semester: 'Semester 1 2026/2027',
          courseUnits: ['CSC 101', 'MAT 110'],
          examDate: '2026-11-04',
          examTime: '9:00 AM',
          venue: 'Main Hall',
          seatNumber: 'B-12',
          instructions: 'Bring your ID card.',
          profileImage: 'https://example.com/photo.jpg',
          permitToken: 'permit-token-99',
          exams: [
            {
              id: 'student-99-exam-1',
              title: 'Computer Science Exam',
              examDate: '2026-11-04',
              examTime: '9:00 AM',
              venue: 'Main Hall',
              seatNumber: 'B-12',
            },
          ],
          totalFees: 9000,
          amountPaid: 1000,
          feesBalance: 8000,
        },
      ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))
    fetchSystemFeeSettings.mockResolvedValue({
      localStudentFee: 4500,
      internationalStudentFee: 9000,
    })
    createStudentProfile.mockResolvedValue({
      id: 'student-99',
      email: 'newstudent@example.com',
      role: 'student',
      name: 'New Student',
      studentId: 'STU099',
      studentCategory: 'international',
      phoneNumber: '+256700111222',
      course: 'Computer Science',
      program: 'BSc Computer Science',
      college: 'College of Computing',
      department: 'Computer Science',
      semester: 'Semester 1 2026/2027',
      courseUnits: ['CSC 101', 'MAT 110'],
      examDate: '2026-11-04',
      examTime: '9:00 AM',
      venue: 'Main Hall',
      seatNumber: 'B-12',
      instructions: 'Bring your ID card.',
      profileImage: 'https://example.com/photo.jpg',
      permitToken: 'permit-token-99',
      exams: [
        {
          id: 'student-99-exam-1',
          title: 'Computer Science Exam',
          examDate: '2026-11-04',
          examTime: '9:00 AM',
          venue: 'Main Hall',
          seatNumber: 'B-12',
        },
      ],
      totalFees: 9000,
      amountPaid: 1000,
      feesBalance: 8000,
    })

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /add student/i }))
    expect(await screen.findByRole('heading', { name: /add new student/i })).toBeTruthy()

    const createDlg = withinCreateStudentDialog()
    fireEvent.change(createDlg.getByLabelText(/^full name$/i), { target: { value: 'New Student' } })
    fireEvent.change(createDlg.getByLabelText(/^email$/i), { target: { value: 'newstudent@example.com' } })
    await user.click(createDlg.getByRole('button', { name: /generate/i }))
    const generatedPassword = (createDlg.getByLabelText(/initial password/i) as HTMLInputElement).value
    expect(generatedPassword).toMatch(/^Permit-/)
    fireEvent.change(createDlg.getByLabelText(/registration no\./i), { target: { value: 'STU099' } })
    fireEvent.change(createDlg.getByLabelText(/^phone number$/i), { target: { value: '+256700111222' } })
    fireEvent.change(createDlg.getByLabelText(/^course$/i), { target: { value: 'Computer Science' } })
    fireEvent.change(createDlg.getByLabelText(/^program$/i), { target: { value: 'BSc Computer Science' } })
    fireEvent.change(createDlg.getByLabelText(/^college$/i), { target: { value: 'College of Computing' } })
    fireEvent.change(createDlg.getByLabelText(/^department$/i), { target: { value: 'Computer Science' } })
    fireEvent.change(createDlg.getByLabelText(/^semester$/i), { target: { value: 'Semester 1 2026/2027' } })
    fireEvent.change(createDlg.getByLabelText(/student category/i), { target: { value: 'international' } })
    fireEvent.change(createDlg.getByLabelText(/amount paid/i), { target: { value: '1000' } })
    fireEvent.change(createDlg.getByLabelText(/profile photo url/i), { target: { value: 'https://example.com/photo.jpg' } })
    fireEvent.change(createDlg.getByLabelText(/^exam date$/i), { target: { value: '2026-11-04' } })
    fireEvent.change(createDlg.getByLabelText(/^exam time$/i), { target: { value: '9:00 AM' } })
    fireEvent.change(createDlg.getByLabelText(/^venue$/i), { target: { value: 'Main Hall' } })
    fireEvent.change(createDlg.getByLabelText(/seat number/i), { target: { value: 'B-12' } })
    fireEvent.change(createDlg.getByLabelText(/course units/i), { target: { value: 'CSC 101\nMAT 110' } })
    fireEvent.change(createDlg.getByLabelText(/permit instructions/i), { target: { value: 'Bring your ID card.' } })

    await user.click(createDlg.getByRole('button', { name: /create student/i }))

    await waitFor(() => {
      expect(createStudentProfile).toHaveBeenCalledWith(
        {
          name: 'New Student',
          email: 'newstudent@example.com',
          password: generatedPassword,
          studentId: 'STU099',
          studentCategory: 'international',
          phoneNumber: '+256700111222',
          course: 'Computer Science',
          program: 'BSc Computer Science',
          college: 'College of Computing',
          department: 'Computer Science',
          semester: 'Semester 1 2026/2027',
          courseUnits: ['CSC 101', 'MAT 110'],
          profileImage: 'https://example.com/photo.jpg',
          totalFees: 9000,
          amountPaid: 1000,
          instructions: 'Bring your ID card.',
          examDate: '2026-11-04',
          examTime: '9:00 AM',
          venue: 'Main Hall',
          seatNumber: 'B-12',
        },
        'admin-1',
      )
    })

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 24,
        search: 'STU099',
        status: 'all',
      })
    })

    expect(await screen.findByText(/student profile created for new student\./i)).toBeTruthy()
    expect(await screen.findByText(/new student account ready/i)).toBeTruthy()
    expect(await screen.findByText(/temporary password/i)).toBeTruthy()
    expect(await screen.findByText(generatedPassword)).toBeTruthy()
  }, 20000)

  it('removes a student profile from the edit dialog', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'deleteStudentProfile').mockImplementation(deleteStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    fetchStudentProfilesPage
      .mockResolvedValueOnce(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          course: 'Computer Science',
          examDate: '2026-04-15',
          examTime: '10:00 AM',
          venue: 'Hall A',
          seatNumber: 'A-001',
          instructions: 'Bring valid ID.',
          profileImage: 'https://via.placeholder.com/150',
          exams: [],
          totalFees: 3000,
          amountPaid: 1000,
          feesBalance: 2000,
        },
      ]))
      .mockResolvedValueOnce(createStudentPage([]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))
    deleteStudentProfile.mockResolvedValue(undefined)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByTitle(/edit student profile/i))
    const removeDlg = withinEditStudentDialog()
    await user.click(removeDlg.getByRole('button', { name: /remove student/i }))
    await user.click(screen.getByRole('button', { name: /move to trash/i }))

    await waitFor(() => {
      expect(deleteStudentProfile).toHaveBeenCalledWith('student-1', 'admin-1')
    })

    expect(await screen.findByText(/student profile moved to trash for john doe\./i)).toBeTruthy()
  }, 10000)

  it('removes a student profile directly from the students table', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'deleteStudentProfile').mockImplementation(deleteStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    fetchStudentProfilesPage
      .mockResolvedValueOnce(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          course: 'Computer Science',
          examDate: '2026-04-15',
          examTime: '10:00 AM',
          venue: 'Hall A',
          seatNumber: 'A-001',
          instructions: 'Bring valid ID.',
          profileImage: 'https://via.placeholder.com/150',
          exams: [],
          totalFees: 3000,
          amountPaid: 1000,
          feesBalance: 2000,
        },
      ]))
      .mockResolvedValueOnce(createStudentPage([]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))
    deleteStudentProfile.mockResolvedValue(undefined)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /remove john doe/i }))
    await user.click(screen.getByRole('button', { name: /move to trash/i }))

    await waitFor(() => {
      expect(deleteStudentProfile).toHaveBeenCalledWith('student-1', 'admin-1')
    })

    expect(await screen.findByText(/student profile moved to trash for john doe\./i)).toBeTruthy()
  }, 10000)

  it('grants one extra permit print copy from the students view', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'grantStudentPermitPrintAccess').mockImplementation(grantStudentPermitPrintAccess)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    fetchStudentProfilesPage
      .mockResolvedValueOnce(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          course: 'Computer Science',
          totalFees: 3000,
          amountPaid: 3000,
          feesBalance: 0,
          monthlyPrintCount: 2,
          monthlyPrintLimit: 2,
          grantedPrintsRemaining: 0,
          canPrintPermit: false,
          printAccessMessage: 'You have used 2 of 2 permit print copies this month.',
          exams: [],
        },
      ]))
      .mockResolvedValueOnce(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          course: 'Computer Science',
          totalFees: 3000,
          amountPaid: 3000,
          feesBalance: 0,
          monthlyPrintCount: 2,
          monthlyPrintLimit: 3,
          grantedPrintsRemaining: 1,
          canPrintPermit: true,
          printAccessMessage: 'You have used 2 of 3 permit print copies this month.',
          exams: [],
        },
      ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))
    grantStudentPermitPrintAccess.mockResolvedValue({
      id: 'student-1',
      email: 'student1@example.com',
      role: 'student',
      name: 'John Doe',
      studentId: 'STU001',
      course: 'Computer Science',
      totalFees: 3000,
      amountPaid: 3000,
      feesBalance: 0,
      monthlyPrintCount: 2,
      monthlyPrintLimit: 3,
      grantedPrintsRemaining: 1,
      canPrintPermit: true,
      printAccessMessage: 'You have used 2 of 3 permit print copies this month.',
      exams: [],
    })

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByLabelText(/grant one extra permit print for john doe/i))

    await waitFor(() => {
      expect(grantStudentPermitPrintAccess).toHaveBeenCalledWith('student-1', 1, 'admin-1')
    })

    expect(await screen.findByText(/granted one extra permit print copy for john doe\./i)).toBeTruthy()
    expect(await screen.findByText(/1 extra print copy remains for this month\./i)).toBeTruthy()
  }, 10000)

  it('restores a student profile from the trash list after confirmation', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'restoreStudentProfile').mockImplementation(restoreStudentProfile)

    fetchStudentProfilesPage
      .mockResolvedValueOnce(createStudentPage([]))
      .mockResolvedValueOnce(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          course: 'Computer Science',
          totalFees: 3000,
          amountPaid: 3000,
          feesBalance: 0,
          exams: [],
        },
      ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))
    fetchTrashedStudentProfiles
      .mockResolvedValueOnce([
        {
          id: 'trash-1',
          profileId: 'student-1',
          role: 'student',
          name: 'John Doe',
          email: 'student1@example.com',
          studentId: 'STU001',
          deletedAt: '2026-04-01T08:00:00.000Z',
          purgeAfterAt: '2026-05-01T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([])
    restoreStudentProfile.mockResolvedValue({
      id: 'student-1',
      email: 'student1@example.com',
      role: 'student',
      name: 'John Doe',
      studentId: 'STU001',
      course: 'Computer Science',
      totalFees: 3000,
      amountPaid: 3000,
      feesBalance: 0,
      exams: [],
    })

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchTrashedStudentProfiles).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /restore/i }))
    await user.click(screen.getByRole('button', { name: /restore student/i }))

    await waitFor(() => {
      expect(restoreStudentProfile).toHaveBeenCalledWith('trash-1', 'admin-1')
    })

    expect(await screen.findByText(/restored student profile for john doe\./i)).toBeTruthy()
  }, 10000)

  it('lets support-capable admins review and update support requests', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser({
        id: 'admin-2',
        email: 'registrar@example.com',
        name: 'Registrar Office',
        scope: 'registrar',
        permissions: ['view_students', 'manage_student_profiles', 'manage_support_requests', 'view_audit_logs', 'export_reports', 'write_audit_logs'],
      }),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSupportRequests').mockImplementation(fetchSupportRequests)
    vi.spyOn(profileServiceModule, 'updateSupportRequest').mockImplementation(updateSupportRequest)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    fetchStudentProfilesPage
      .mockResolvedValueOnce(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          studentCategory: 'local',
          course: 'Computer Science',
          semester: 'Semester 1 2026/2027',
          exams: [],
          totalFees: 3000,
          amountPaid: 500,
          feesBalance: 2500,
        },
      ]))
      .mockResolvedValue(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          studentCategory: 'local',
          course: 'Computer Science',
          semester: 'Semester 1 2026/2027',
          exams: [],
          totalFees: 3500,
          amountPaid: 500,
          feesBalance: 3000,
        },
      ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))
    fetchSupportRequests.mockResolvedValue([
      {
        id: 'support-1',
        studentId: 'student-1',
        studentName: 'John Doe',
        studentEmail: 'student1@example.com',
        registrationNumber: 'STU001',
        subject: 'Permit approval delay',
        message: 'My payment is complete but the permit still shows pending.',
        status: 'open',
        adminReply: '',
        createdAt: '2026-03-20T10:00:00.000Z',
        updatedAt: '2026-03-20T10:00:00.000Z',
        resolvedAt: null,
      },
    ])
    updateSupportRequest.mockResolvedValue({
      id: 'support-1',
      studentId: 'student-1',
      studentName: 'John Doe',
      studentEmail: 'student1@example.com',
      registrationNumber: 'STU001',
      subject: 'Permit approval delay',
      message: 'My payment is complete but the permit still shows pending.',
      status: 'in_progress',
      adminReply: 'We are checking payment reconciliation now.',
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T11:00:00.000Z',
      resolvedAt: null,
    })

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /support requests/i }))

    await waitFor(() => {
      expect(fetchSupportRequests).toHaveBeenCalled()
    })

    expect(await screen.findByText(/permit approval delay/i)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/^status$/i), { target: { value: 'in_progress' } })
    fireEvent.change(screen.getByLabelText(/admin reply/i), { target: { value: 'We are checking payment reconciliation now.' } })
    await user.click(screen.getByRole('button', { name: /save update/i }))

    await waitFor(() => {
      expect(updateSupportRequest).toHaveBeenCalledWith('support-1', {
        status: 'in_progress',
        adminReply: 'We are checking payment reconciliation now.',
      })
    })

    expect(await screen.findByText(/updated support request for john doe\./i)).toBeTruthy()
  }, 10000)

  it('exports permit activity as csv', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    const students = [
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        studentCategory: 'local',
        course: 'Computer Science',
        semester: 'Semester 1 2026/2027',
        exams: [
          {
            id: 'student-1-exam-1',
            title: 'Computer Science Theory',
            examDate: '2026-04-15',
            examTime: '10:00 AM',
            venue: 'Hall A',
            seatNumber: 'A-001',
          },
        ],
        totalFees: 3000,
        amountPaid: 3000,
        feesBalance: 0,
      },
    ]

    const activityLogs = [
      {
        id: 'log-1',
        adminId: 'student-1',
        targetProfileId: 'student-1',
        action: 'print_permit',
        details: { source: 'student-portal' },
        createdAt: '2026-03-22T12:17:07.151Z',
      },
    ]

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage(students))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage(activityLogs))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
      expect(fetchAdminActivityLogsPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /export csv/i }))

    expect(downloadPermitActivityCsv).toHaveBeenCalledWith(activityLogs, students)
    expect(await screen.findByText(/exported 1 permit activity row\(s\)\./i)).toBeTruthy()
  })

  it('updates received amount and clears the student balance', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [],
        totalFees: 3000,
        amountPaid: 1000,
        feesBalance: 2000,
      },
    ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    fireEvent.change(screen.getByLabelText(/amount received for john doe/i), { target: { value: '2800' } })
    await user.click(screen.getByTitle(/save received amount/i))

    await waitFor(() => {
      expect(updateStudentFinancials).toHaveBeenCalledWith('student-1', { amountPaid: 2800 }, 'admin-1')
    })

    await user.click(screen.getByTitle(/mark fully paid/i))

    await waitFor(() => {
      expect(clearStudentBalance).toHaveBeenCalledWith('student-1', 'admin-1')
    })

    expect(await screen.findByText(/john doe has been cleared for printing\./i)).toBeTruthy()
  }, 10000)

  it('shows a finance-scoped admin with full management commands', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser({
        id: 'admin-3',
        email: 'finance@example.com',
        name: 'Finance Office',
        scope: 'finance',
        permissions: ['view_students', 'manage_student_profiles', 'manage_financials', 'manage_support_requests', 'view_audit_logs', 'export_reports', 'write_audit_logs'],
      }),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [],
        totalFees: 3000,
        amountPaid: 1000,
        feesBalance: 2000,
      },
    ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    expect(screen.getByRole('button', { name: /open bulk import/i })).toBeEnabled()

    await userEvent.setup().click(screen.getByRole('button', { name: /^dashboard$/i }))

    expect(screen.getAllByText(/finance desk/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^bulk import$/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /^permit cards$/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /generate bulk permits/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /send reminders/i })).toBeEnabled()
  }, 15000)

  it('derives navigation and quick actions from permissions instead of scope defaults', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser({
        id: 'admin-4',
        email: 'operations@example.com',
        name: 'Operations Office',
        scope: 'operations',
        permissions: ['view_students', 'manage_student_profiles', 'export_reports'],
      }),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [],
        totalFees: 3000,
        amountPaid: 3000,
        feesBalance: 0,
      },
    ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    expect(screen.getByRole('button', { name: /permit cards/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^bulk import$/i })).toBeNull()

    await userEvent.setup().click(screen.getByRole('button', { name: /^dashboard$/i }))

    expect(screen.getByRole('button', { name: /generate bulk permits/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /send reminders/i })).toBeEnabled()
  })

  it('disables mutating student actions for report-only admins', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser({
        id: 'admin-5',
        email: 'auditor@example.com',
        name: 'Audit Office',
        scope: 'operations',
        permissions: ['view_students', 'export_reports'],
      }),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    const { default: AdminPanel } = await import('./AdminPanel')

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([
      {
        id: 'student-1',
        email: 'student1@example.com',
        role: 'student',
        name: 'John Doe',
        studentId: 'STU001',
        course: 'Computer Science',
        examDate: '2026-04-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001',
        instructions: 'Bring valid ID.',
        profileImage: 'https://via.placeholder.com/150',
        exams: [],
        totalFees: 3000,
        amountPaid: 1000,
        feesBalance: 2000,
      },
    ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    expect(screen.getAllByTitle(/save received amount/i)[0]).toBeDisabled()
    expect(screen.getAllByTitle(/mark fully paid/i)[0]).toBeDisabled()
    expect(screen.getAllByTitle(/edit student profile/i)[0]).toBeDisabled()
    expect(screen.queryByRole('button', { name: /^bulk import$/i })).toBeNull()

    await userEvent.setup().click(screen.getByRole('button', { name: /^reports$/i }))

    expect(screen.getByRole('button', { name: /^export csv$/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /export excel/i })).toBeEnabled()
  })

  it('lets finance-capable admins update the fee structure from settings', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser(),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    fetchStudentProfilesPage
      .mockResolvedValueOnce(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          studentCategory: 'local',
          course: 'Computer Science',
          semester: 'Semester 1 2026/2027',
          exams: [],
          totalFees: 3000,
          amountPaid: 500,
          feesBalance: 2500,
        },
      ]))
      .mockResolvedValue(createStudentPage([
        {
          id: 'student-1',
          email: 'student1@example.com',
          role: 'student',
          name: 'John Doe',
          studentId: 'STU001',
          studentCategory: 'local',
          course: 'Computer Science',
          semester: 'Semester 1 2026/2027',
          exams: [],
          totalFees: 3500,
          amountPaid: 500,
          feesBalance: 3000,
        },
      ]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))
    fetchSystemFeeSettings.mockResolvedValue({
      localStudentFee: 3000,
      internationalStudentFee: 6000,
    })
    updateSystemFeeSettings.mockResolvedValue({
      localStudentFee: 3500,
      internationalStudentFee: 7200,
    })

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /students/i }))
    expect(await screen.findByText('$3000.00')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^settings$/i }))
    await user.clear(screen.getByLabelText(/local student fee/i))
    await user.type(screen.getByLabelText(/local student fee/i), '3500')
    await user.clear(screen.getByLabelText(/international student fee/i))
    await user.type(screen.getByLabelText(/international student fee/i), '7200')
    await user.click(screen.getByRole('button', { name: /save fee structure/i }))

    await waitFor(() => {
      expect(updateSystemFeeSettings).toHaveBeenCalledWith({
        localStudentFee: 3500,
        internationalStudentFee: 7200,
        deadlines: [],
      })
      expect(fetchStudentProfilesPage).toHaveBeenCalledTimes(2)
    })

    expect(await screen.findByText(/fee structure settings updated successfully/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /students/i }))
    expect(await screen.findByText('$3500.00')).toBeTruthy()
  }, 20000)

  it('lets admins update their own account credentials from settings', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: createAdminUser({ name: 'Administrator', email: 'admin@example.com' }),
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfilesPage').mockImplementation(fetchStudentProfilesPage)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogsPage').mockImplementation(fetchAdminActivityLogsPage)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateSystemFeeSettings').mockImplementation(updateSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'adminUpdateStudentProfile').mockImplementation(adminUpdateStudentProfile)
    vi.spyOn(profileServiceModule, 'updateStudentFinancials').mockImplementation(updateStudentFinancials)
    vi.spyOn(profileServiceModule, 'clearStudentBalance').mockImplementation(clearStudentBalance)
    vi.spyOn(profileServiceModule, 'importStudentFinancials').mockImplementation(importStudentFinancials)

    const spreadsheetImportModule = await import('../services/spreadsheetImport')
    vi.spyOn(spreadsheetImportModule, 'parseFinancialSpreadsheet').mockImplementation(parseFinancialSpreadsheet)

    const adminTemplateModule = await import('../services/adminImportTemplate')
    vi.spyOn(adminTemplateModule, 'downloadFinancialImportTemplate').mockImplementation(downloadFinancialImportTemplate)

    const permitActivityExportModule = await import('../services/permitActivityExport')
    vi.spyOn(permitActivityExportModule, 'downloadPermitActivityCsv').mockImplementation(downloadPermitActivityCsv)

    updateStudentAccount.mockResolvedValue({
      id: 'admin-1',
      email: 'registrar.office@example.com',
      role: 'admin',
      name: 'Registrar Office',
      totalFees: 0,
      amountPaid: 0,
      feesBalance: 0,
    })

    const { default: AdminPanel } = await import('./AdminPanel')
    const user = userEvent.setup()

    fetchStudentProfilesPage.mockResolvedValue(createStudentPage([]))
    fetchAdminActivityLogsPage.mockResolvedValue(createActivityPage([]))

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchStudentProfilesPage).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /^settings$/i }))
    await user.clear(screen.getByLabelText(/full name/i))
    await user.type(screen.getByLabelText(/full name/i), 'Registrar Office')
    await user.clear(screen.getByLabelText(/email address/i))
    await user.type(screen.getByLabelText(/email address/i), 'registrar.office@example.com')
    await user.type(screen.getByLabelText(/phone number/i), '+256700123456')
    await user.type(screen.getByLabelText(/current password/i), 'Permit@2026')
    await user.type(screen.getByLabelText(/^new password$/i), 'Permit@2027')
    await user.type(screen.getByLabelText(/confirm password/i), 'Permit@2027')
    await user.click(screen.getByRole('button', { name: /save account settings/i }))

    await waitFor(() => {
      expect(updateStudentAccount).toHaveBeenCalledWith('admin-1', {
        name: 'Registrar Office',
        email: 'registrar.office@example.com',
        phoneNumber: '+256700123456',
        currentPassword: 'Permit@2026',
        password: 'Permit@2027',
      })
    })

    expect(refreshUser).toHaveBeenCalled()
    expect(await screen.findByText(/admin account settings updated successfully/i)).toBeTruthy()
  }, 20000)
})