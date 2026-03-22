import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

const {
  signOut,
  refreshUser,
  fetchAllStudentProfiles,
  fetchAdminActivityLogs,
  adminUpdateStudentProfile,
  updateStudentFinancials,
  clearStudentBalance,
  importStudentFinancials,
  parseFinancialSpreadsheet,
  downloadFinancialImportTemplate,
  downloadPermitActivityCsv,
} = vi.hoisted(() => ({
  signOut: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(undefined),
  fetchAllStudentProfiles: vi.fn(),
  fetchAdminActivityLogs: vi.fn(),
  adminUpdateStudentProfile: vi.fn(),
  updateStudentFinancials: vi.fn(),
  clearStudentBalance: vi.fn(),
  importStudentFinancials: vi.fn(),
  parseFinancialSpreadsheet: vi.fn(),
  downloadFinancialImportTemplate: vi.fn(),
  downloadPermitActivityCsv: vi.fn(),
}))

describe('AdminPanel', () => {
  it('previews spreadsheet rows before applying the import', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Administrator' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchAllStudentProfiles').mockImplementation(fetchAllStudentProfiles)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogs').mockImplementation(fetchAdminActivityLogs)
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

    fetchAllStudentProfiles.mockResolvedValue([
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
        amountPaid: 500,
        feesBalance: 2500,
      },
    ])

    fetchAdminActivityLogs.mockResolvedValue([])

    parseFinancialSpreadsheet.mockResolvedValue([
      { rowNumber: 2, studentId: 'STU001', amountPaid: 2500, totalFees: 3000 },
    ])

    importStudentFinancials.mockResolvedValue({
      updatedCount: 1,
      skippedRows: [],
    })

    const { container } = render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchAllStudentProfiles).toHaveBeenCalled()
    })

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()

    const file = new File(['student_id,amount_paid,total_fees'], 'payments.csv', { type: 'text/csv' })
    await user.upload(fileInput!, file)

    expect(await screen.findByText(/import preview/i)).toBeTruthy()
    expect(await screen.findByText(/1 row\(s\) are ready to apply/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /apply import/i }))

    await waitFor(() => {
      expect(importStudentFinancials).toHaveBeenCalledWith(
        [{ rowNumber: 2, studentId: 'student-1', amountPaid: 2500, totalFees: 3000 }],
        'admin-1',
      )
    })
  })

  it('shows print and download status for each student', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Administrator' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchAllStudentProfiles').mockImplementation(fetchAllStudentProfiles)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogs').mockImplementation(fetchAdminActivityLogs)
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

    fetchAllStudentProfiles.mockResolvedValue([
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
    ])

    fetchAdminActivityLogs.mockResolvedValue([
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
    ])

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchAllStudentProfiles).toHaveBeenCalled()
      expect(fetchAdminActivityLogs).toHaveBeenCalled()
    })

    expect(await screen.findByText(/printed 1x/i)).toBeTruthy()
    expect(await screen.findByText(/downloaded 1x/i)).toBeTruthy()
  })

  it('filters the student list to only printed students', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Administrator' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchAllStudentProfiles').mockImplementation(fetchAllStudentProfiles)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogs').mockImplementation(fetchAdminActivityLogs)
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

    fetchAllStudentProfiles.mockResolvedValue([
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
    ])

    fetchAdminActivityLogs.mockResolvedValue([
      {
        id: 'log-1',
        adminId: 'student-1',
        targetProfileId: 'student-1',
        action: 'print_permit',
        details: { source: 'student-portal' },
        createdAt: '2026-03-22T12:17:07.151Z',
      },
    ])

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchAllStudentProfiles).toHaveBeenCalled()
      expect(fetchAdminActivityLogs).toHaveBeenCalled()
    })

    expect((await screen.findAllByText('John Doe')).length > 0).toBe(true)
    expect((await screen.findAllByText('Grace Walker')).length > 0).toBe(true)

    await user.click(screen.getByLabelText(/show printed students only/i))

    expect((await screen.findAllByText('John Doe')).length > 0).toBe(true)
    expect(screen.queryByText('Grace Walker')).toBeNull()
  })

  it('edits a student profile from the permit card view', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Administrator' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchAllStudentProfiles').mockImplementation(fetchAllStudentProfiles)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogs').mockImplementation(fetchAdminActivityLogs)
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

    fetchAllStudentProfiles.mockResolvedValue([
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
    ])
    fetchAdminActivityLogs.mockResolvedValue([])
    adminUpdateStudentProfile.mockResolvedValue({
      id: 'student-1',
      email: 'student1@example.com',
      role: 'student',
      name: 'John Doe Updated',
      studentId: 'STU001-NEW',
      course: 'Software Engineering',
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
      expect(fetchAllStudentProfiles).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /permit cards/i }))
    expect(await screen.findByRole('heading', { name: /permit card management/i })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /edit profile for john doe/i }))
    expect(await screen.findByRole('heading', { name: /edit student profile/i })).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe Updated' } })
    fireEvent.change(screen.getByLabelText(/registration no\./i), { target: { value: 'STU001-NEW' } })
    fireEvent.change(screen.getByLabelText(/^course$/i), { target: { value: 'Software Engineering' } })
    fireEvent.change(screen.getByLabelText(/total fees/i), { target: { value: '3200' } })
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(adminUpdateStudentProfile).toHaveBeenCalledWith(
        'student-1',
        {
          name: 'John Doe Updated',
          email: 'student1@example.com',
          studentId: 'STU001-NEW',
          course: 'Software Engineering',
          totalFees: 3200,
        },
        'admin-1',
      )
    })

    expect(await screen.findByText(/student profile updated for john doe updated\./i)).toBeTruthy()
  })

  it('exports permit activity as csv', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Administrator' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchAllStudentProfiles').mockImplementation(fetchAllStudentProfiles)
    vi.spyOn(profileServiceModule, 'fetchAdminActivityLogs').mockImplementation(fetchAdminActivityLogs)
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

    fetchAllStudentProfiles.mockResolvedValue(students)
    fetchAdminActivityLogs.mockResolvedValue(activityLogs)

    render(<AdminPanel />)

    await waitFor(() => {
      expect(fetchAllStudentProfiles).toHaveBeenCalled()
      expect(fetchAdminActivityLogs).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: /export csv/i }))

    expect(downloadPermitActivityCsv).toHaveBeenCalledWith(activityLogs, students)
    expect(await screen.findByText(/exported 1 permit activity row\(s\)\./i)).toBeTruthy()
  })
})