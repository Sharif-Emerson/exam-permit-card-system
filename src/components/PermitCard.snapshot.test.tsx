import { render } from '@testing-library/react'
import { vi } from 'vitest'
import PermitCard from './PermitCard'

describe('PermitCard snapshot', () => {
  it('matches the cleared student permit layout', () => {
    const { container } = render(
      <PermitCard
        studentData={{
          id: 'student-id',
          email: 'student@example.com',
          role: 'student',
          name: 'Snapshot Student',
          studentId: 'SNAP001',
          studentCategory: 'international',
          phoneNumber: '+256700123456',
          course: 'Computer Science',
          program: 'BSc Computer Science',
          college: 'College of Computing',
          department: 'Computer Science Department',
          semester: 'Semester 1 2026/2027',
          courseUnits: ['CSC 401 - Compiler Construction', 'CSC 402 - Distributed Systems'],
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
          printAccessMessage: null,
          permitPrintsUsedThisMonth: 0,
          permitPrintsRemainingThisMonth: 2,
          permitPrintGrantMonth: null,
          permitPrintGrantsRemaining: 0,
        }}
        qrCodeUrl="data:image/png;base64,permit-qr"
        onRefresh={vi.fn()}
        onSignOut={vi.fn()}
        onPrint={vi.fn()}
        onDownload={vi.fn()}
      />,
    )

    expect(container.firstChild).toMatchSnapshot()
  })
})