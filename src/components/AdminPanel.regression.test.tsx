import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(undefined),
  fetchStudentProfilesPage: vi.fn(),
  fetchAssistantAdmins: vi.fn(),
  createAssistantAdmin: vi.fn(),
  fetchSupportRequests: vi.fn(),
  fetchAdminActivityLogsPage: vi.fn(),
  fetchSystemFeeSettings: vi.fn(),
  fetchTrashedStudentProfiles: vi.fn(),
  fetchStudentProfileById: vi.fn(),
  updateStudentAccount: vi.fn(),
  adminUpdateStudentProfile: vi.fn(),
  createStudentProfile: vi.fn(),
  deleteStudentProfile: vi.fn(),
  grantStudentPermitPrintAccess: vi.fn(),
  restoreStudentProfile: vi.fn(),
  permanentlyDeleteTrashedStudent: vi.fn(),
  permanentlyPurgeAllTrashedStudents: vi.fn(),
  updateStudentFinancials: vi.fn(),
  clearStudentBalance: vi.fn(),
  importStudentFinancials: vi.fn(),
  updateSupportRequest: vi.fn(),
  updateSystemFeeSettings: vi.fn(),
  deleteAdminActivityLog: vi.fn(),
  purgePermitActivityLogs: vi.fn(),
  previewStudentAccountsImport: vi.fn(),
  applyStudentAccountsImport: vi.fn(),
  bulkSyncCurriculum: vi.fn(),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      role: 'admin',
      scope: 'super-admin',
      name: 'Admin User',
      email: 'admin@example.com',
      permissions: [
        'view_students',
        'manage_student_profiles',
        'manage_financials',
        'manage_support_requests',
        'view_audit_logs',
        'export_reports',
      ],
    },
    loading: false,
    configError: null,
    signIn: vi.fn(),
    signInWithToken: vi.fn(),
    signOut: mocks.signOut,
    refreshUser: mocks.refreshUser,
  }),
}))

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    darkMode: false,
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
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

vi.mock('../services/profileService', () => ({
  getDataConfigError: () => null,
  fetchStudentProfilesPage: mocks.fetchStudentProfilesPage,
  fetchAssistantAdmins: mocks.fetchAssistantAdmins,
  createAssistantAdmin: mocks.createAssistantAdmin,
  fetchSupportRequests: mocks.fetchSupportRequests,
  fetchAdminActivityLogsPage: mocks.fetchAdminActivityLogsPage,
  fetchSystemFeeSettings: mocks.fetchSystemFeeSettings,
  fetchTrashedStudentProfiles: mocks.fetchTrashedStudentProfiles,
  fetchStudentProfileById: mocks.fetchStudentProfileById,
  updateStudentAccount: mocks.updateStudentAccount,
  adminUpdateStudentProfile: mocks.adminUpdateStudentProfile,
  createStudentProfile: mocks.createStudentProfile,
  deleteStudentProfile: mocks.deleteStudentProfile,
  grantStudentPermitPrintAccess: mocks.grantStudentPermitPrintAccess,
  restoreStudentProfile: mocks.restoreStudentProfile,
  permanentlyDeleteTrashedStudent: mocks.permanentlyDeleteTrashedStudent,
  permanentlyPurgeAllTrashedStudents: mocks.permanentlyPurgeAllTrashedStudents,
  updateStudentFinancials: mocks.updateStudentFinancials,
  clearStudentBalance: mocks.clearStudentBalance,
  importStudentFinancials: mocks.importStudentFinancials,
  updateSupportRequest: mocks.updateSupportRequest,
  updateSystemFeeSettings: mocks.updateSystemFeeSettings,
  deleteAdminActivityLog: mocks.deleteAdminActivityLog,
  purgePermitActivityLogs: mocks.purgePermitActivityLogs,
  previewStudentAccountsImport: mocks.previewStudentAccountsImport,
  applyStudentAccountsImport: mocks.applyStudentAccountsImport,
  bulkSyncCurriculum: mocks.bulkSyncCurriculum,
}))

vi.mock('../services/spreadsheetImport', () => ({
  parseFinancialSpreadsheet: vi.fn().mockResolvedValue([]),
}))

vi.mock('../services/adminImportTemplate', () => ({
  downloadFinancialImportTemplate: vi.fn(),
  downloadStudentAccountsImportTemplate: vi.fn(),
}))

vi.mock('../services/adminDashboardExport', () => ({
  downloadAdminDashboardCsv: vi.fn(),
  downloadAdminDashboardExcel: vi.fn(),
  printAdminDashboardReport: vi.fn(),
}))

vi.mock('../services/permitActivityExport', () => ({
  downloadPermitActivityCsv: vi.fn(),
}))

describe('AdminPanel regression guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchStudentProfilesPage.mockResolvedValue({
      items: [
        {
          id: 'student-1',
          name: 'Jane Student',
          email: 'student@example.com',
          role: 'student',
          studentId: 'STU001',
          studentCategory: 'local',
          phoneNumber: '+256700000000',
          course: 'Computer Science',
          program: 'BSc Computer Science',
          college: 'College of Computing',
          department: 'Computer Science',
          semester: 'Semester 1 2026/2027',
          courseUnits: [],
          examDate: '2026-04-15',
          examTime: '10:00 AM',
          venue: 'Hall A',
          seatNumber: 'A-1',
          instructions: 'Bring ID',
          profileImage: '',
          permitToken: 'permit-token-1',
          totalFees: 3000,
          amountPaid: 500,
          feesBalance: 2500,
          exams: [],
        },
      ],
      page: 1,
      pageSize: 24,
      totalItems: 1,
      totalPages: 1,
      totalStudents: 1,
      clearedStudents: 0,
      outstandingStudents: 1,
    })
    mocks.fetchSupportRequests.mockResolvedValue([])
    mocks.fetchAssistantAdmins.mockResolvedValue([])
    mocks.fetchAdminActivityLogsPage.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 12,
      totalItems: 0,
      totalPages: 1,
    })
    mocks.fetchSystemFeeSettings.mockResolvedValue({
      localStudentFee: 3000,
      internationalStudentFee: 6000,
      currencyCode: 'USD',
    })
    mocks.fetchTrashedStudentProfiles.mockResolvedValue([])
  })

  it('keeps full admin navigation and students bulk import access visible', async () => {
    const { default: AdminPanel } = await import('./AdminPanel')
    render(<AdminPanel />)

    await waitFor(() => {
      expect(mocks.fetchStudentProfilesPage).toHaveBeenCalled()
    })

    expect(screen.getByRole('button', { name: /students/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /support requests/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /permit activity/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /permit cards/i })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /bulk import/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /reports/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /sub-admins/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /settings/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /open bulk import/i })).toBeTruthy()
  })
})