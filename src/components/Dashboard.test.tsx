import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr'),
  },
}))

const {
  signOut,
  refreshUser,
  fetchStudentProfileById,
  updateStudentAccount,
  fetchSupportRequests,
  fetchSupportContacts,
  fetchPermitActivityHistory,
  createSupportRequest,
  recordPermitActivity,
  fetchSystemFeeSettings,
  fetchSemesterRegistrations,
} = vi.hoisted(() => ({
  signOut: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(undefined),
  fetchStudentProfileById: vi.fn().mockResolvedValue({
    id: 'student-id',
    email: 'student@example.com',
    role: 'student',
    name: 'John Doe',
    studentId: 'STU001',
    studentCategory: 'international',
    phoneNumber: '+256700123456',
    course: 'Computer Science',
    program: 'BSc Computer Science',
    college: 'College of Computing',
    department: 'Computer Science Department',
    semester: 'Semester 1 2026/2027',
    courseUnits: ['CSC 401 - Compiler Construction', 'CSC 403 - Distributed Systems'],
    examDate: '2026-04-15',
    examTime: '10:00 AM',
    venue: 'Hall A',
    seatNumber: 'A-001',
    instructions: 'Bring ID.',
    profileImage: 'https://via.placeholder.com/150',
    permitToken: 'permit-token-1',
    exams: [
      {
        id: 'student-id-exam-1',
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
  }),
  updateStudentAccount: vi.fn(),
  fetchSupportRequests: vi.fn().mockResolvedValue([]),
  fetchSupportContacts: vi.fn().mockResolvedValue([]),
  fetchPermitActivityHistory: vi.fn().mockResolvedValue([]),
  createSupportRequest: vi.fn(),
  recordPermitActivity: vi.fn(),
  fetchSystemFeeSettings: vi.fn().mockResolvedValue({
    localStudentFee: 3000,
    internationalStudentFee: 5000,
    currencyCode: 'USD',
  }),
  fetchSemesterRegistrations: vi.fn().mockResolvedValue([]),
}))

describe('Dashboard', () => {
  it('disables printing when fees are not fully cleared', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'fetchSupportRequests').mockImplementation(fetchSupportRequests)
    vi.spyOn(profileServiceModule, 'fetchSupportContacts').mockImplementation(fetchSupportContacts)
    vi.spyOn(profileServiceModule, 'fetchPermitActivityHistory').mockImplementation(fetchPermitActivityHistory)
    vi.spyOn(profileServiceModule, 'createSupportRequest').mockImplementation(createSupportRequest)
    vi.spyOn(profileServiceModule, 'recordPermitActivity').mockImplementation(recordPermitActivity)
    vi.spyOn(profileServiceModule, 'fetchSemesterRegistrations').mockImplementation(fetchSemesterRegistrations)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)

    const { default: Dashboard } = await import('./Dashboard')
    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    expect((await screen.findByRole('button', { name: /print permit/i })).hasAttribute('disabled')).toBe(true)
    expect((await screen.findByRole('button', { name: /download pdf/i })).hasAttribute('disabled')).toBe(true)
  }, 10000)

  it('saves updated profile settings', async () => {
    window.localStorage.clear()

    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'fetchSupportRequests').mockImplementation(fetchSupportRequests)
    vi.spyOn(profileServiceModule, 'fetchSupportContacts').mockImplementation(fetchSupportContacts)
    vi.spyOn(profileServiceModule, 'fetchPermitActivityHistory').mockImplementation(fetchPermitActivityHistory)
    vi.spyOn(profileServiceModule, 'createSupportRequest').mockImplementation(createSupportRequest)
    vi.spyOn(profileServiceModule, 'recordPermitActivity').mockImplementation(recordPermitActivity)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)
    vi.spyOn(profileServiceModule, 'fetchSemesterRegistrations').mockImplementation(fetchSemesterRegistrations)

    updateStudentAccount.mockResolvedValue({
      id: 'student-id',
      email: 'john.doe.updated@example.com',
      role: 'student',
      name: 'John Doe Updated',
      studentId: 'STU001',
      studentCategory: 'international',
      phoneNumber: '+256700999888',
      course: 'Computer Science',
      program: 'BSc Computer Science',
      college: 'College of Computing',
      department: 'Computer Science Department',
      semester: 'Semester 1 2026/2027',
      courseUnits: ['CSC 401 - Compiler Construction', 'CSC 403 - Distributed Systems'],
      examDate: '2026-04-15',
      examTime: '10:00 AM',
      venue: 'Hall A',
      seatNumber: 'A-001',
      instructions: 'Bring ID.',
      profileImage: 'https://cdn.example.com/new-avatar.png',
      permitToken: 'permit-token-1',
      exams: [
        {
          id: 'student-id-exam-1',
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
    })

    const { default: Dashboard } = await import('./Dashboard')
    const user = userEvent.setup()
    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    await waitFor(() => {
      expect(screen.queryByText(/loading your student dashboard/i)).toBeNull()
    })

    await user.click(screen.getByRole('button', { name: /profile settings/i }))
    await user.clear(screen.getByLabelText(/phone number/i))
    await user.type(screen.getByLabelText(/phone number/i), '+256700999888')
    await user.clear(screen.getByLabelText(/^profile photo$/i))
    await user.type(screen.getByLabelText(/^profile photo$/i), 'https://cdn.example.com/new-avatar.png')
    await user.type(screen.getByLabelText(/current password/i), 'Permit@2026')
    await user.type(screen.getByLabelText(/^new password$/i), 'Permit@2027')
    await user.type(screen.getByLabelText(/confirm password/i), 'Permit@2027')
    await user.click(screen.getByRole('button', { name: /save profile settings/i }))

    await waitFor(() => {
      expect(updateStudentAccount).toHaveBeenCalledWith('student-id', {
        name: 'John Doe',
        email: 'student@example.com',
        phoneNumber: '+256700999888',
        profileImage: 'https://cdn.example.com/new-avatar.png',
        currentPassword: 'Permit@2026',
        password: 'Permit@2027',
      })
    })

    expect(refreshUser).toHaveBeenCalled()
    expect(await screen.findByText(/profile settings updated successfully\./i)).toBeTruthy()
  }, 10000)

  it('shows the expanded student profile structure in the student preview', async () => {
    window.localStorage.clear()

    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'fetchSupportRequests').mockImplementation(fetchSupportRequests)
    vi.spyOn(profileServiceModule, 'fetchSupportContacts').mockImplementation(fetchSupportContacts)
    vi.spyOn(profileServiceModule, 'fetchPermitActivityHistory').mockImplementation(fetchPermitActivityHistory)
    vi.spyOn(profileServiceModule, 'createSupportRequest').mockImplementation(createSupportRequest)
    vi.spyOn(profileServiceModule, 'recordPermitActivity').mockImplementation(recordPermitActivity)
    vi.spyOn(profileServiceModule, 'fetchSemesterRegistrations').mockImplementation(fetchSemesterRegistrations)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)

    const { default: Dashboard } = await import('./Dashboard')
    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    await userEvent.setup().click(screen.getByRole('button', { name: /profile settings/i }))

    expect(await screen.findByText(/phone: \+256700123456/i)).toBeTruthy()
    expect(screen.getByText(/student category: international/i)).toBeTruthy()
    expect(screen.getByText(/college: college of computing/i)).toBeTruthy()
    expect(screen.getByText(/department: computer science department/i)).toBeTruthy()
    expect(screen.getByText(/course units: csc 401 - compiler construction, csc 403 - distributed systems/i)).toBeTruthy()
  }, 10000)

  it.skip('submits a permit application and stores it in history', async () => {
    window.localStorage.clear()

    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'fetchSupportRequests').mockImplementation(fetchSupportRequests)
    vi.spyOn(profileServiceModule, 'fetchSupportContacts').mockImplementation(fetchSupportContacts)
    vi.spyOn(profileServiceModule, 'fetchPermitActivityHistory').mockImplementation(fetchPermitActivityHistory)
    vi.spyOn(profileServiceModule, 'createSupportRequest').mockImplementation(createSupportRequest)
    vi.spyOn(profileServiceModule, 'recordPermitActivity').mockImplementation(recordPermitActivity)
    vi.spyOn(profileServiceModule, 'fetchSemesterRegistrations').mockImplementation(fetchSemesterRegistrations)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)

    const { default: Dashboard } = await import('./Dashboard')
    const user = userEvent.setup()
    const { container } = render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    await user.click(screen.getByRole('button', { name: /open full application view/i }))
    await user.click(screen.getByLabelText(/current course registration details/i))
    await user.click(screen.getByLabelText(/valid student identification/i))
    await user.click(screen.getByLabelText(/payment evidence when requested/i))
    const reactSelectInput = container.querySelector('.react-select__input') as HTMLInputElement | null
    expect(reactSelectInput).toBeTruthy()
    await user.click(reactSelectInput!)
    await user.type(reactSelectInput!, 'CSC 401 - Compiler Construction{Enter}')
    await user.click(screen.getAllByRole('button', { name: /^apply for permit$/i }).at(-1)!)

    expect(await screen.findByText(/permit request submitted successfully\./i)).toBeTruthy()
    expect(await screen.findByText(/outstanding fees must be cleared before approval\./i)).toBeTruthy()

    const storedHistory = JSON.parse(window.localStorage.getItem('student-portal-history:student-id') ?? '[]')
    expect(storedHistory).toHaveLength(1)
    expect(storedHistory[0]).toMatchObject({
      semester: expect.any(String),
      status: 'pending',
      courseUnits: ['CSC 401 - Compiler Construction'],
    })
  })

  it('records download and print activity for a cleared permit', async () => {
    window.localStorage.clear()

    const originalPrint = window.print
    const printSpy = vi.fn()
    window.print = printSpy

    fetchStudentProfileById.mockResolvedValue({
      id: 'student-id',
      email: 'student@example.com',
      role: 'student',
      name: 'John Doe',
      studentId: 'STU001',
      course: 'Computer Science',
      examDate: '2026-04-15',
      examTime: '10:00 AM',
      venue: 'Hall A',
      seatNumber: 'A-001',
      instructions: 'Bring ID.',
      profileImage: 'https://via.placeholder.com/150',
      permitToken: 'permit-token-1',
      exams: [
        {
          id: 'student-id-exam-1',
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
      monthlyPrintCount: 0,
      monthlyPrintLimit: 2,
      grantedPrintsRemaining: 0,
      canPrintPermit: true,
      printAccessMessage: '',
    })

    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)
    vi.spyOn(profileServiceModule, 'fetchSupportRequests').mockImplementation(fetchSupportRequests)
    vi.spyOn(profileServiceModule, 'fetchSupportContacts').mockImplementation(fetchSupportContacts)
    vi.spyOn(profileServiceModule, 'fetchPermitActivityHistory').mockImplementation(fetchPermitActivityHistory)
    vi.spyOn(profileServiceModule, 'createSupportRequest').mockImplementation(createSupportRequest)
    vi.spyOn(profileServiceModule, 'recordPermitActivity').mockImplementation(recordPermitActivity)
    vi.spyOn(profileServiceModule, 'fetchSemesterRegistrations').mockImplementation(fetchSemesterRegistrations)
    vi.spyOn(profileServiceModule, 'fetchSystemFeeSettings').mockImplementation(fetchSystemFeeSettings)

    const { default: Dashboard } = await import('./Dashboard')
    const user = userEvent.setup()
    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    await user.click(await screen.findByRole('button', { name: /download pdf/i }))
    await user.click(await screen.findByRole('button', { name: /print permit/i }))

    expect(recordPermitActivity).toHaveBeenNthCalledWith(1, 'student-id', 'download_permit')
    expect(recordPermitActivity).toHaveBeenNthCalledWith(2, 'student-id', 'print_permit')
    expect(printSpy).toHaveBeenCalledTimes(2)

    window.print = originalPrint
  })
})