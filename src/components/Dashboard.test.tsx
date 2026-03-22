import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import Dashboard from './Dashboard'

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
    totalFees: 3000,
    amountPaid: 500,
    feesBalance: 2500,
  }),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'student-id', email: 'student@example.com', role: 'student', name: 'John Doe' },
    signOut,
  }),
}))

vi.mock('../services/profileService', () => ({
  fetchStudentProfileById,
}))

describe('Dashboard', () => {
  it('disables printing when fees are not fully cleared', async () => {
    render(<Dashboard />)

    await waitFor(() => {
      expect(fetchStudentProfileById).toHaveBeenCalledWith('student-id')
    })

    expect(await screen.findByRole('button', { name: /print permit/i })).toBeDisabled()
    expect(await screen.findByRole('button', { name: /download pdf/i })).toBeDisabled()
  })
})