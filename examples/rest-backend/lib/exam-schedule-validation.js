/**
 * Rejects obviously invalid exam schedules for a single student (same date+time slot twice).
 * Skips entries that still use placeholder date/time text.
 */

const PLACEHOLDER_DATE = new Set(['', 'not scheduled', 'tba', 'to be announced', 'tbd'])
const PLACEHOLDER_TIME = new Set(['', 'not scheduled', 'tba', 'to be announced', 'tbd'])

function normalizeSlotPart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function slotIsConcrete(exam) {
  const d = normalizeSlotPart(exam.examDate)
  const t = normalizeSlotPart(exam.examTime)
  if (!d || PLACEHOLDER_DATE.has(d)) {
    return false
  }
  if (!t || PLACEHOLDER_TIME.has(t)) {
    return false
  }
  return true
}

/**
 * @param {Array<{ title?: string, examDate?: string, examTime?: string }>} exams
 * @throws {Error} when two concrete exams share the same date+time
 */
export function assertNoStudentExamTimeConflicts(exams) {
  const seen = new Map()
  for (const exam of exams) {
    if (!slotIsConcrete(exam)) {
      continue
    }
    const key = `${normalizeSlotPart(exam.examDate)}|${normalizeSlotPart(exam.examTime)}`
    const title = typeof exam.title === 'string' ? exam.title.trim() : 'Exam'
    if (seen.has(key)) {
      throw new Error(
        `Exam schedule conflict: two assessments are scheduled at the same date and time (${exam.examDate} ${exam.examTime}): "${seen.get(key)}" and "${title}". Adjust one of the slots before saving.`,
      )
    }
    seen.set(key, title)
  }
}
