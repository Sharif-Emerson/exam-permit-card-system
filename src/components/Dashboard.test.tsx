import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

const { signOut, refreshUser, fetchStudentProfileById, updateStudentAccount } = vi.hoisted(() => ({
  signOut: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(undefined),
  fetchStudentProfileById: vi.fn().mockResolvedValue({
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
    amountPaid: 500,
    feesBalance: 2500,
  }),
  updateStudentAccount: vi.fn(),
}))

describe('Dashboard', () => {
  it('disables printing when fees are not fully cleared', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)

    const { default: Dashboard } = await import('./Dashboard')
    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    expect((await screen.findByRole('button', { name: /print permit/i })).hasAttribute('disabled')).toBe(true)
    expect((await screen.findByRole('button', { name: /download pdf/i })).hasAttribute('disabled')).toBe(true)
  })

  it('saves updated profile settings', async () => {
    window.localStorage.clear()

    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)

    updateStudentAccount.mockResolvedValue({
      id: 'student-id',
      email: 'student@example.com',
      role: 'student',
      name: 'John Doe Updated',
      studentId: 'STU001',
      course: 'Computer Science',
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

    await user.click(screen.getByRole('button', { name: /profile settings/i }))
    await user.clear(screen.getByLabelText(/full name/i))
    await user.type(screen.getByLabelText(/full name/i), 'John Doe Updated')
    await user.clear(screen.getByLabelText(/profile image url/i))
    await user.type(screen.getByLabelText(/profile image url/i), 'https://cdn.example.com/new-avatar.png')
    await user.click(screen.getByRole('button', { name: /save profile settings/i }))

    await waitFor(() => {
      expect(updateStudentAccount).toHaveBeenCalledWith('student-id', {
        name: 'John Doe Updated',
        email: 'student@example.com',
        profileImage: 'https://cdn.example.com/new-avatar.png',
        password: undefined,
      })
    })

    expect(refreshUser).toHaveBeenCalled()
    expect(await screen.findByText(/profile settings updated successfully\./i)).toBeTruthy()
  })

  it('submits a permit application and stores it in history', async () => {
    window.localStorage.clear()

    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut,
      refreshUser,
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)
    vi.spyOn(profileServiceModule, 'updateStudentAccount').mockImplementation(updateStudentAccount)

    const { default: Dashboard } = await import('./Dashboard')
    const user = userEvent.setup()
    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    await user.click(screen.getByRole('button', { name: /open full application view/i }))
    await user.type(screen.getByLabelText(/course units/i), 'CSC 401 - Compiler Construction')
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
})