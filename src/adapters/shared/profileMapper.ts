import type { AppProfile, DatabaseProfileRow, StudentExam, StudentProfile } from '../../types'

function createFallbackExam(row: DatabaseProfileRow): StudentExam[] {
  if (!row.exam_date && !row.exam_time && !row.venue && !row.seat_number) {
    return []
  }

  return [
    {
      id: `${row.id}-exam-1`,
      title: row.course ? `${row.course} Exam` : 'Scheduled Exam',
      examDate: row.exam_date ?? 'Not scheduled',
      examTime: row.exam_time ?? 'Not scheduled',
      venue: row.venue ?? 'Not assigned',
      seatNumber: row.seat_number ?? 'Not assigned',
    },
  ]
}

function parseStudentExams(row: DatabaseProfileRow): StudentExam[] {
  if (Array.isArray(row.exams)) {
    return row.exams.length > 0 ? row.exams : createFallbackExam(row)
  }

  if (!row.exams_json) {
    return createFallbackExam(row)
  }

  try {
    const parsed = JSON.parse(row.exams_json)

    if (!Array.isArray(parsed)) {
      return createFallbackExam(row)
    }

    const exams = parsed
      .filter((exam): exam is Record<string, unknown> => typeof exam === 'object' && exam !== null)
      .map((exam, index) => ({
        id: typeof exam.id === 'string' && exam.id.trim() ? exam.id.trim() : `${row.id}-exam-${index + 1}`,
        title: typeof exam.title === 'string' && exam.title.trim() ? exam.title.trim() : `Exam ${index + 1}`,
        examDate: typeof exam.examDate === 'string' && exam.examDate.trim() ? exam.examDate.trim() : 'Not scheduled',
        examTime: typeof exam.examTime === 'string' && exam.examTime.trim() ? exam.examTime.trim() : 'Not scheduled',
        venue: typeof exam.venue === 'string' && exam.venue.trim() ? exam.venue.trim() : 'Not assigned',
        seatNumber: typeof exam.seatNumber === 'string' && exam.seatNumber.trim() ? exam.seatNumber.trim() : 'Not assigned',
      }))

    return exams.length > 0 ? exams : createFallbackExam(row)
  } catch {
    return createFallbackExam(row)
  }
}

export function mapProfile(row: DatabaseProfileRow): AppProfile {
  const totalFees = Number(row.total_fees ?? 0)
  const amountPaid = Number(row.amount_paid ?? 0)
  const feesBalance = Math.max(totalFees - amountPaid, 0)

  if (row.role === 'admin') {
    return {
      id: row.id,
      email: row.email,
      role: 'admin',
      name: row.name,
      phoneNumber: row.phone_number ?? 'Not assigned',
      totalFees,
      amountPaid,
      feesBalance,
    }
  }

  const exams = parseStudentExams(row)
  const primaryExam = exams[0]

  return {
    id: row.id,
    email: row.email,
    role: 'student',
    name: row.name,
    studentId: row.student_id ?? 'N/A',
    studentCategory: row.student_category === 'international' ? 'international' : 'local',
    phoneNumber: row.phone_number ?? 'Not assigned',
    course: row.course ?? 'Not assigned',
    program: row.program ?? row.course ?? 'Not assigned',
    college: row.college ?? 'Not assigned',
    department: row.department ?? 'Not assigned',
    semester: row.semester ?? 'Not assigned',
    courseUnits: Array.isArray(row.course_units) ? row.course_units : [],
    examDate: primaryExam?.examDate ?? row.exam_date ?? 'Not scheduled',
    examTime: primaryExam?.examTime ?? row.exam_time ?? 'Not scheduled',
    venue: primaryExam?.venue ?? row.venue ?? 'Not assigned',
    seatNumber: primaryExam?.seatNumber ?? row.seat_number ?? 'Not assigned',
    instructions: row.instructions ?? 'No instructions have been added yet.',
    profileImage: row.profile_image ?? 'https://via.placeholder.com/150',
    permitToken: row.permit_token ?? row.id,
    exams,
    totalFees,
    amountPaid,
    feesBalance,
  }
}

export function ensureStudentProfile(profile: AppProfile): StudentProfile {
  if (profile.role !== 'student') {
    throw new Error('This account does not have a student permit record.')
  }

  return profile
}