import type { AppProfile, DatabaseProfileRow, StudentExam, StudentProfile } from '../../types'

function norm(s: string | null | undefined): string {
  return String(s ?? '').trim().toLowerCase()
}

/** True when the value is empty or a known “not set yet” label from curriculum sync / admin UI. */
function isPlaceholderExamDate(value: string | null | undefined): boolean {
  const t = norm(value)
  return !t || t === 'not scheduled' || t === 'to be announced' || t === 'tba' || t === 'n/a'
}

function isPlaceholderExamTime(value: string | null | undefined): boolean {
  return isPlaceholderExamDate(value)
}

function isPlaceholderVenue(value: string | null | undefined): boolean {
  const t = norm(value)
  return !t || t === 'not assigned' || t === 'to be announced' || t === 'tba' || t === 'n/a'
}

function isPlaceholderSeat(value: string | null | undefined): boolean {
  const t = norm(value)
  return !t || t === 'not assigned' || t === 'to be assigned' || t === 'to be announced' || t === 'tba' || t === 'n/a'
}

function pickScheduleField(
  profileValue: string | null | undefined,
  examValue: string | undefined,
  emptyLabel: string,
  isPlaceholder: (v: string | null | undefined) => boolean,
): string {
  const p = profileValue?.trim() ?? ''
  const e = examValue?.trim() ?? ''
  if (p && !isPlaceholder(p)) return p
  if (e && !isPlaceholder(e)) return e
  return p || e || emptyLabel
}

/** When the profile row has a real exam date/time/venue but synced unit rows still say “To be announced”, use the profile values. */
function mergeExamsWithProfileAnnouncements(row: DatabaseProfileRow, exams: StudentExam[]): StudentExam[] {
  if (exams.length === 0) return exams
  const pd = row.exam_date?.trim()
  const pt = row.exam_time?.trim()
  const pv = row.venue?.trim()
  const ps = row.seat_number?.trim()
  const dateOk = pd && !isPlaceholderExamDate(pd)
  const timeOk = pt && !isPlaceholderExamTime(pt)
  const venueOk = pv && !isPlaceholderVenue(pv)
  const seatOk = ps && !isPlaceholderSeat(ps)
  if (!dateOk && !timeOk && !venueOk && !seatOk) return exams
  return exams.map((exam) => ({
    ...exam,
    examDate: dateOk && isPlaceholderExamDate(exam.examDate) ? pd! : exam.examDate,
    examTime: timeOk && isPlaceholderExamTime(exam.examTime) ? pt! : exam.examTime,
    venue: venueOk && isPlaceholderVenue(exam.venue) ? pv! : exam.venue,
    seatNumber: seatOk && isPlaceholderSeat(exam.seatNumber) ? ps! : exam.seatNumber,
  }))
}

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

  const exams = mergeExamsWithProfileAnnouncements(row, parseStudentExams(row))
  const primaryExam = exams[0]

  return {
    id: row.id,
    email: row.email,
    role: 'student',
    name: row.name,
    studentId: row.student_id ?? 'N/A',
    studentCategory: row.student_category === 'international' ? 'international' : 'local',
    gender: row.gender === 'male' || row.gender === 'female' || row.gender === 'other' ? row.gender : undefined,
    enrollmentStatus: row.enrollment_status === 'on_leave' || row.enrollment_status === 'graduated' ? row.enrollment_status : 'active',
    phoneNumber: row.phone_number ?? 'Not assigned',
    course: row.course ?? 'Not assigned',
    program: row.program ?? row.course ?? 'Not assigned',
    college: row.college ?? 'Not assigned',
    department: row.department ?? 'Not assigned',
    semester: row.semester ?? 'Not assigned',
    courseUnits: Array.isArray(row.course_units) ? row.course_units : [],
    examDate: pickScheduleField(row.exam_date, primaryExam?.examDate, 'Not scheduled', isPlaceholderExamDate),
    examTime: pickScheduleField(row.exam_time, primaryExam?.examTime, 'Not scheduled', isPlaceholderExamTime),
    venue: pickScheduleField(row.venue, primaryExam?.venue, 'Not assigned', isPlaceholderVenue),
    seatNumber: pickScheduleField(row.seat_number, primaryExam?.seatNumber, 'Not assigned', isPlaceholderSeat),
    instructions: row.instructions ?? 'No instructions have been added yet.',
    profileImage: row.profile_image ?? 'https://via.placeholder.com/150',
    permitToken: row.permit_token ?? row.id,
    permitSignature: typeof row.permit_signature === 'string' && row.permit_signature ? row.permit_signature : undefined,
    exams,
    monthlyPrintCount: Number(row.monthly_print_count ?? 0),
    monthlyPrintLimit: Number(row.monthly_print_limit ?? 2),
    grantedPrintsRemaining: Number(row.granted_prints_remaining ?? 0),
    canPrintPermit: row.can_print_permit !== false,
    printAccessMessage: row.print_access_message ?? '',
    totalFees,
    amountPaid,
    feesBalance,
    firstLoginRequired: Number(row.first_login_required ?? 0) === 1,
  }
}

export function ensureStudentProfile(profile: AppProfile): StudentProfile {
  if (profile.role !== 'student') {
    throw new Error('This account does not have a student permit record.')
  }

  return profile
}