import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

const { signOut, fetchStudentProfileById } = vi.hoisted(() => ({
  signOut: vi.fn(),
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
      refreshUser: vi.fn(),
    })

    const profileServiceModule = await import('../services/profileService')
    vi.spyOn(profileServiceModule, 'fetchStudentProfileById').mockImplementation(fetchStudentProfileById)

    const { default: Dashboard } = await import('./Dashboard')
    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    expect((await screen.findByRole('button', { name: /print permit/i })).hasAttribute('disabled')).toBe(true)
    expect((await screen.findByRole('button', { name: /download pdf/i })).hasAttribute('disabled')).toBe(true)
  })
})