import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { generalExamRules } from '../config/examRules'
import { institutionName } from '../config/branding'
import PermitCard from './PermitCard'

describe('PermitCard', () => {
  it('renders permit details and a verification qr image', () => {
    render(
      <PermitCard
        studentData={{
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
        }}
        qrCodeUrl="data:image/png;base64,permit-qr"
        onRefresh={vi.fn()}
        onSignOut={vi.fn()}
        onPrint={vi.fn()}
        onDownload={vi.fn()}
      />,
    )

    expect(screen.getByText('John Doe')).toBeTruthy()
    expect(screen.getAllByText('Computer Science Theory').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/college of computing/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/international/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\+256700123456/i).length).toBeGreaterThan(0)
    expect(screen.getByText('General Rules')).toBeTruthy()
    for (const rule of generalExamRules) {
      expect(screen.getByText(rule)).toBeTruthy()
    }
    expect(screen.getAllByText(institutionName).length).toBeGreaterThan(0)
    expect(screen.getByAltText('Verification QR code')).toBeTruthy()
  })
})