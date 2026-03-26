import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { axe } from 'vitest-axe'
import PermitCard from './PermitCard'

describe('Accessibility', () => {
  it('renders the login screen without obvious accessibility violations', async () => {
    const authContextModule = await import('../context/AuthContext')
    const themeContextModule = await import('../context/ThemeContext')

    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn().mockResolvedValue(undefined),
    })
    vi.spyOn(themeContextModule, 'useTheme').mockReturnValue({
      theme: 'light',
      darkMode: false,
      setTheme: vi.fn(),
      toggleTheme: vi.fn(),
    })

    const { default: Login } = await import('./Login')
    const { container } = render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    const results = await axe(container)
    expect(results.violations).toHaveLength(0)
  })

  it('renders the permit card without obvious accessibility violations', async () => {
    const { container } = render(
      <PermitCard
        studentData={{
          id: 'student-id',
          email: 'student@example.com',
          role: 'student',
          name: 'Accessible Student',
          studentId: 'A11Y001',
          studentCategory: 'local',
          phoneNumber: '+256700123456',
          course: 'Computer Science',
          program: 'BSc Computer Science',
          college: 'College of Computing',
          department: 'Computer Science Department',
          semester: 'Semester 1 2026/2027',
          courseUnits: ['CSC 401 - Compiler Construction'],
          examDate: '2026-04-15',
          examTime: '10:00 AM',
          venue: 'Hall A',
          seatNumber: 'A-001',
          instructions: 'Bring ID.',
          profileImage: 'https://via.placeholder.com/150',
          permitToken: 'permit-token-1',
          exams: [
            {
              id: 'exam-1',
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
          canPrintPermit: true,
          printAccessMessage: undefined,
          permitPrintsUsedThisMonth: 0,
          permitPrintsRemainingThisMonth: 2,
          permitPrintGrantMonth: undefined,
          permitPrintGrantsRemaining: 0,
        }}
        qrCodeUrl="data:image/png;base64,permit-qr"
        onRefresh={vi.fn()}
        onSignOut={vi.fn()}
        onPrint={vi.fn()}
        onDownload={vi.fn()}
      />,
    )

    const results = await axe(container)
    expect(results.violations).toHaveLength(0)
  })
})