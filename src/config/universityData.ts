// ─── Official KIU Tuition Fees (UGX per semester) ───────────────────────────
// Source: Kampala International University official fee structure
export const KIU_PROGRAM_TUITION_UGX: Record<string, number> = {
  // College of Health Sciences – Kampala
  'MBChB (Medicine and Surgery)': 4200000,
  'Bachelor of Dental Surgery (BDS)': 4200000,
  'Bachelor of Pharmacy (BPharm)': 3800000,
  'BSc Nursing Science': 2100000,
  'BSc Medical Laboratory Science': 2100000,
  'BSc Physiotherapy': 2100000,
  'BSc Environmental Health Science': 1800000,
  'BSc Public Health': 1700000,
  'BSc Human Nutrition and Dietetics': 1800000,
  // Faculty of Science and Technology
  'BSc Computer Science': 1600000,
  'BSc Information Technology': 1600000,
  'BSc Software Engineering': 1600000,
  'Bachelor of Computer Science (BCS)': 1600000,
  'Bachelor of Information Technology (BIT)': 1600000,
  'BSc Electrical Engineering': 2200000,
  'BSc Civil Engineering': 2200000,
  'BSc Mechanical Engineering': 2200000,
  'BSc Architecture': 2200000,
  'BSc Mathematics': 1400000,
  'BSc Statistics': 1400000,
  // School of Law
  'Bachelor of Laws (LLB)': 2000000,
  // Faculty of Business and Management Sciences
  'BBA (Business Administration)': 1600000,
  'Bachelor of Commerce (BCom)': 1600000,
  'Bachelor of Human Resource Management': 1600000,
  'Bachelor of Banking and Finance': 1700000,
  'Bachelor of Procurement and Logistics': 1600000,
  'Bachelor of Accounting and Finance': 1700000,
  // Faculty of Arts and Social Sciences
  'Bachelor of Mass Communication': 1400000,
  'Bachelor of Development Studies': 1400000,
  'Bachelor of Social Work and Social Administration': 1400000,
  // Faculty of Education (Western Campus)
  'Bachelor of Education (Arts)': 1400000,
  'Bachelor of Education (Science)': 1400000,
  'Bachelor of Education (Business Studies)': 1400000,
  // Faculty of Clinical Medicine & Dentistry (Western Campus)
  'Bachelor of Clinical Medicine and Community Health': 2500000,
  'BSc Anaesthesia Science': 2300000,
}

/** KIU Bursary Scheme: 50% discount on official tuition */
export const KIU_BURSARY_RATE = 0.5

/** Returns official tuition fee (UGX) for a program, or null if not found */
export function getTuitionForProgram(program: string | null | undefined): number | null {
  if (!program) return null
  return KIU_PROGRAM_TUITION_UGX[program] ?? null
}

/** Returns programs offered by a department */
export function getProgramsForDepartment(department: string): string[] {
  return KIU_DEPARTMENT_PROGRAMS[department] ?? []
}

// ─── Official KIU Department → Programs Mapping ──────────────────────────────
export const KIU_DEPARTMENT_PROGRAMS: Record<string, string[]> = {
  // College of Health Sciences
  'School of Medicine and Surgery': ['MBChB (Medicine and Surgery)'],
  'School of Dentistry': ['Bachelor of Dental Surgery (BDS)'],
  'School of Pharmacy': ['Bachelor of Pharmacy (BPharm)'],
  'Department of Nursing': ['BSc Nursing Science'],
  'Department of Medical Laboratory Science': ['BSc Medical Laboratory Science'],
  'Department of Physiotherapy': ['BSc Physiotherapy'],
  'Department of Environmental Health Science': ['BSc Environmental Health Science'],
  'Department of Public Health': ['BSc Public Health'],
  'Department of Human Nutrition and Dietetics': ['BSc Human Nutrition and Dietetics'],
  // Faculty of Science and Technology
  'Department of Computer Science': ['BSc Computer Science', 'Bachelor of Computer Science (BCS)'],
  'Department of Information Technology': ['BSc Information Technology', 'Bachelor of Information Technology (BIT)'],
  'Department of Software Engineering': ['BSc Software Engineering'],
  'Department of Electrical Engineering': ['BSc Electrical Engineering'],
  'Department of Civil Engineering': ['BSc Civil Engineering'],
  'Department of Mechanical Engineering': ['BSc Mechanical Engineering'],
  'Department of Architecture': ['BSc Architecture'],
  'Department of Mathematics and Statistics': ['BSc Mathematics', 'BSc Statistics'],
  // School of Law
  'Department of Law': ['Bachelor of Laws (LLB)'],
  // Faculty of Business and Management Sciences
  'Department of Business Administration': ['BBA (Business Administration)'],
  'Department of Commerce': ['Bachelor of Commerce (BCom)'],
  'Department of Human Resource Management': ['Bachelor of Human Resource Management'],
  'Department of Banking and Finance': ['Bachelor of Banking and Finance'],
  'Department of Procurement and Logistics': ['Bachelor of Procurement and Logistics'],
  'Department of Accounting': ['Bachelor of Accounting and Finance'],
  // Faculty of Arts and Social Sciences
  'Department of Mass Communication': ['Bachelor of Mass Communication'],
  'Department of Development Studies': ['Bachelor of Development Studies'],
  'Department of Social Work': ['Bachelor of Social Work and Social Administration'],
  // Faculty of Education (Western Campus)
  'Department of Education (Arts)': ['Bachelor of Education (Arts)', 'Bachelor of Education (Business Studies)'],
  'Department of Education (Science)': ['Bachelor of Education (Science)'],
  // Faculty of Clinical Medicine & Dentistry (Western Campus)
  'Department of Clinical Medicine': ['Bachelor of Clinical Medicine and Community Health'],
  'Department of Anaesthesia Sciences': ['BSc Anaesthesia Science'],
}

// ─── Official KIU College → Departments Mapping ──────────────────────────────
export const KIU_COLLEGE_DEPARTMENTS: Record<string, string[]> = {
  'College of Health Sciences': [
    'School of Medicine and Surgery',
    'School of Dentistry',
    'School of Pharmacy',
    'Department of Nursing',
    'Department of Medical Laboratory Science',
    'Department of Physiotherapy',
    'Department of Environmental Health Science',
    'Department of Public Health',
    'Department of Human Nutrition and Dietetics',
  ],
  'Faculty of Science and Technology': [
    'Department of Computer Science',
    'Department of Information Technology',
    'Department of Software Engineering',
    'Department of Electrical Engineering',
    'Department of Civil Engineering',
    'Department of Mechanical Engineering',
    'Department of Architecture',
    'Department of Mathematics and Statistics',
  ],
  'School of Law': [
    'Department of Law',
  ],
  'Faculty of Business and Management Sciences': [
    'Department of Business Administration',
    'Department of Commerce',
    'Department of Human Resource Management',
    'Department of Banking and Finance',
    'Department of Procurement and Logistics',
    'Department of Accounting',
  ],
  'Faculty of Arts and Social Sciences': [
    'Department of Mass Communication',
    'Department of Development Studies',
    'Department of Social Work',
  ],
  'Faculty of Education': [
    'Department of Education (Arts)',
    'Department of Education (Science)',
  ],
  'Faculty of Clinical Medicine and Dentistry': [
    'Department of Clinical Medicine',
    'Department of Anaesthesia Sciences',
  ],
}

export const KIU_COLLEGES = Object.keys(KIU_COLLEGE_DEPARTMENTS)

export const KIU_DEPARTMENTS = Object.keys(KIU_DEPARTMENT_PROGRAMS)

export const KIU_COURSES: string[] = Array.from(
  new Set(Object.values(KIU_DEPARTMENT_PROGRAMS).flat()),
)

/** Default degree program used for curriculum sync when a student has department set but program/course do not match KIU_CURRICULUM keys. */
export const KIU_DEPARTMENT_DEFAULT_PROGRAM: Record<string, string> = Object.fromEntries(
  Object.entries(KIU_DEPARTMENT_PROGRAMS).map(([dept, programs]) => [dept, programs[0]]),
)

export const KIU_SEMESTERS = [
  'Year 1 Semester 1',
  'Year 1 Semester 2',
  'Year 2 Semester 1',
  'Year 2 Semester 2',
  'Year 3 Semester 1',
  'Year 3 Semester 2',
  'Year 4 Semester 1',
  'Year 4 Semester 2',
  'Year 5 Semester 1',
  'Year 5 Semester 2',
]

/** Duration in years for each KIU program */
export const KIU_PROGRAM_DURATION_YEARS: Record<string, number> = {
  // College of Health Sciences
  'MBChB (Medicine and Surgery)': 5,
  'Bachelor of Dental Surgery (BDS)': 5,
  'Bachelor of Pharmacy (BPharm)': 4,
  'BSc Nursing Science': 4,
  'BSc Medical Laboratory Science': 3,
  'BSc Physiotherapy': 4,
  'BSc Environmental Health Science': 3,
  'BSc Public Health': 3,
  'BSc Human Nutrition and Dietetics': 3,
  // Faculty of Science and Technology
  'BSc Computer Science': 3,
  'BSc Information Technology': 3,
  'BSc Software Engineering': 3,
  'Bachelor of Computer Science (BCS)': 3,
  'Bachelor of Information Technology (BIT)': 3,
  'BSc Electrical Engineering': 4,
  'BSc Civil Engineering': 4,
  'BSc Mechanical Engineering': 4,
  'BSc Architecture': 5,
  'BSc Mathematics': 3,
  'BSc Statistics': 3,
  // School of Law
  'Bachelor of Laws (LLB)': 5,
  // Faculty of Business and Management Sciences
  'BBA (Business Administration)': 3,
  'Bachelor of Commerce (BCom)': 3,
  'Bachelor of Human Resource Management': 3,
  'Bachelor of Banking and Finance': 3,
  'Bachelor of Procurement and Logistics': 3,
  'Bachelor of Accounting and Finance': 3,
  // Faculty of Arts and Social Sciences
  'Bachelor of Mass Communication': 3,
  'Bachelor of Development Studies': 3,
  'Bachelor of Social Work and Social Administration': 3,
  // Faculty of Education
  'Bachelor of Education (Arts)': 3,
  'Bachelor of Education (Science)': 3,
  'Bachelor of Education (Business Studies)': 3,
  // Faculty of Clinical Medicine & Dentistry
  'Bachelor of Clinical Medicine and Community Health': 4,
  'BSc Anaesthesia Science': 4,
}

/**
 * Returns only the semesters valid for a given program's duration.
 * Falls back to all KIU_SEMESTERS if the program is unknown.
 */
export function getSemestersForProgram(program: string | null | undefined): string[] {
  if (!program) return KIU_SEMESTERS
  const years = KIU_PROGRAM_DURATION_YEARS[program]
  if (!years) return KIU_SEMESTERS
  return KIU_SEMESTERS.slice(0, years * 2)
}

export interface KiuCourseUnit {
  unitName: string
  venue: string
  time: string
}

export interface KiuProgramCurriculum {
  defaultCourse: string
  semesters: Record<string, KiuCourseUnit[]>
}

export const KIU_CURRICULUM: Record<string, KiuProgramCurriculum> = {
  'BSc Computer Science': {
    defaultCourse: 'BSc Computer Science',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'COS 1101: Computer Architecture And Organization', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'COS 1102: Introduction To Mathematical Analysis', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'COS 1103: Digital Logic', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'UCC 1100: Computer Fundamentals', venue: 'Auditorium', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '09:00 AM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'COS 1201: Computer Hardware', venue: 'Lab 2', time: '09:00 AM' },
        { unitName: 'COS 1202: Data Structures and Algorithms', venue: 'Main Hall', time: '02:00 PM' },
        { unitName: 'COS 1203: Discrete Mathematics', venue: 'Room 5', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'COS 2101: Object Oriented Programming', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 2102: Principles Of Electronics', venue: 'Lab 3', time: '02:00 PM' },
        { unitName: 'COS 2103: Probability And Statistics', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'ITE 2102: Systems Analysis & Design', venue: 'Room 10', time: '02:00 PM' },
        { unitName: 'ITE 2103: Computer Networks & Data Communications', venue: 'Lab 2', time: '09:00 AM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'COS 2201: Operating Systems', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'COS 2202: Software Engineering', venue: 'Room 5', time: '02:00 PM' },
        { unitName: 'COS 2203: Object Oriented Systems Analysis & Design', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'ITE 2204: Fundamentals Of Database Systems', venue: 'Lab 2', time: '02:00 PM' }
      ],
      'Year 3 Semester 1': [
        { unitName: 'COS 3101: Simulation And Modelling', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 3102: Emerging Trends In Computer Science', venue: 'Auditorium', time: '02:00 PM' },
        { unitName: 'COS 3103: Application Development By Java', venue: 'Lab 4', time: '09:00 AM' },
        { unitName: 'COS 3104: Compiler Construction', venue: 'Room 12', time: '02:00 PM' },
        { unitName: 'COS 3105: Communication Systems', venue: 'Main Hall', time: '09:00 AM' }
      ],
      'Year 3 Semester 2': [
        { unitName: 'UCC3000: Research report', venue: 'Project Lab', time: '09:00 AM' },
        { unitName: 'COS 3202: Algorithm Analysis & Design', venue: 'Lab 1', time: '11:00 AM' },
        { unitName: 'CSB 3203: Artificial Intelligence', venue: 'Lab 2', time: '02:00 PM' },
        { unitName: 'COS 3204: Mobile Application Development', venue: 'Lab 3', time: '04:00 PM' },
        { unitName: 'ITE 3205: Network & Information Security', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'COS 3205: Computer Graphics', venue: 'Auditorium', time: '02:00 PM' },
        { unitName: 'COS 3207: Optimization Techniques', venue: 'Room 12', time: '09:00 AM' }
      ]
    }
  },
  'BSc Information Technology': {
    defaultCourse: 'BSc Information Technology',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'ITE 1101: Introduction to IT', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 1102: Introduction To Mathematical Analysis', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1100: Computer Fundamentals', venue: 'Auditorium', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'ITE 1201: Database Management Systems', venue: 'Lab 2', time: '09:00 AM' },
        { unitName: 'ITE 1202: Web Technologies I', venue: 'Lab 1', time: '02:00 PM' },
        { unitName: 'COS 1202: Data Structures and Algorithms', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'BSc Software Engineering': {
    defaultCourse: 'BSc Software Engineering',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'SEN 1101: Introduction to Software Engineering', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 1102: Introduction To Mathematical Analysis', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1100: Computer Fundamentals', venue: 'Auditorium', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'SEN 1201: Software Requirements Engineering', venue: 'Lab 2', time: '09:00 AM' },
        { unitName: 'SEN 1202: Software Design Patterns', venue: 'Lab 1', time: '02:00 PM' },
        { unitName: 'COS 1202: Data Structures and Algorithms', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Computer Science (BCS)': {
    defaultCourse: 'Bachelor of Computer Science (BCS)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'BCS 1101: Computer Science Fundamentals', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 1102: Introduction To Mathematical Analysis', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1100: Computer Fundamentals', venue: 'Auditorium', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'BCS 1201: Advanced Programming', venue: 'Lab 2', time: '09:00 AM' },
        { unitName: 'BCS 1202: Database Systems', venue: 'Lab 1', time: '02:00 PM' },
        { unitName: 'COS 1202: Data Structures and Algorithms', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Information Technology (BIT)': {
    defaultCourse: 'Bachelor of Information Technology (BIT)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'BIT 1101: IT Fundamentals', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 1102: Introduction To Mathematical Analysis', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1100: Computer Fundamentals', venue: 'Auditorium', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'BIT 1201: IT Infrastructure', venue: 'Lab 2', time: '09:00 AM' },
        { unitName: 'BIT 1202: Network Administration', venue: 'Lab 1', time: '02:00 PM' },
        { unitName: 'COS 1202: Data Structures and Algorithms', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'BSc Electrical Engineering': {
    defaultCourse: 'BSc Electrical Engineering',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'ELE 1101: Electrical Engineering Fundamentals', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 1102: Introduction To Mathematical Analysis', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1100: Computer Fundamentals', venue: 'Auditorium', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'ELE 1201: Circuit Analysis', venue: 'Lab 2', time: '09:00 AM' },
        { unitName: 'ELE 1202: Digital Electronics', venue: 'Lab 1', time: '02:00 PM' },
        { unitName: 'COS 1202: Data Structures and Algorithms', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'BSc Civil Engineering': {
    defaultCourse: 'BSc Civil Engineering',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'CVE 1101: Civil Engineering Fundamentals', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 1102: Introduction To Mathematical Analysis', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1100: Computer Fundamentals', venue: 'Auditorium', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'CVE 1201: Structural Analysis', venue: 'Lab 2', time: '09:00 AM' },
        { unitName: 'CVE 1202: Surveying', venue: 'Lab 1', time: '02:00 PM' },
        { unitName: 'COS 1202: Data Structures and Algorithms', venue: 'Main Hall', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Laws (LLB)': {
    defaultCourse: 'Bachelor of Laws (LLB)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'LAW 1101: Introduction to Law', venue: 'Law Hall 1', time: '09:00 AM' },
        { unitName: 'LAW 1102: Contracts I', venue: 'Law Hall 1', time: '02:00 PM' },
        { unitName: 'LAW 1103: Constitutional Law I', venue: 'Auditorium', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'LAW 1201: Contracts II', venue: 'Law Hall 1', time: '09:00 AM' },
        { unitName: 'LAW 1202: Constitutional Law II', venue: 'Law Hall 2', time: '02:00 PM' },
        { unitName: 'LAW 1203: Torts I', venue: 'Law Hall 1', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'MBChB (Medicine and Surgery)': {
    defaultCourse: 'MBChB (Medicine and Surgery)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'MED 1101: Anatomy I', venue: 'Medical Hall 1', time: '09:00 AM' },
        { unitName: 'MED 1102: Physiology I', venue: 'Medical Hall 2', time: '02:00 PM' },
        { unitName: 'MED 1103: Biochemistry I', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'MED 1201: Anatomy II', venue: 'Medical Hall 1', time: '09:00 AM' },
        { unitName: 'MED 1202: Physiology II', venue: 'Medical Hall 2', time: '02:00 PM' },
        { unitName: 'MED 1203: Biochemistry II', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'BBA (Business Administration)': {
    defaultCourse: 'BBA (Business Administration)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'BBA 1101: Introduction to Business', venue: 'Business Hall 1', time: '09:00 AM' },
        { unitName: 'BBA 1102: Principles of Management', venue: 'Business Hall 2', time: '02:00 PM' },
        { unitName: 'BBA 1103: Business Mathematics', venue: 'Room 4', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'BBA 1201: Financial Accounting', venue: 'Business Hall 1', time: '09:00 AM' },
        { unitName: 'BBA 1202: Marketing Principles', venue: 'Business Hall 2', time: '02:00 PM' },
        { unitName: 'BBA 1203: Business Statistics', venue: 'Room 4', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Pharmacy': {
    defaultCourse: 'Bachelor of Pharmacy',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'PHR 1101: Pharmaceutical Chemistry I', venue: 'Pharmacy Lab 1', time: '09:00 AM' },
        { unitName: 'PHR 1102: Pharmacology I', venue: 'Pharmacy Hall 1', time: '02:00 PM' },
        { unitName: 'PHR 1103: Pharmaceutics I', venue: 'Pharmacy Lab 2', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'PHR 1201: Pharmaceutical Chemistry II', venue: 'Pharmacy Lab 1', time: '09:00 AM' },
        { unitName: 'PHR 1202: Pharmacology II', venue: 'Pharmacy Hall 1', time: '02:00 PM' },
        { unitName: 'PHR 1203: Pharmaceutics II', venue: 'Pharmacy Lab 2', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'BSc Nursing Science': {
    defaultCourse: 'BSc Nursing Science',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'NUR 1101: Fundamentals of Nursing', venue: 'Nursing Hall 1', time: '09:00 AM' },
        { unitName: 'NUR 1102: Anatomy and Physiology', venue: 'Medical Hall 1', time: '02:00 PM' },
        { unitName: 'NUR 1103: Medical-Surgical Nursing I', venue: 'Nursing Lab 1', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'NUR 1201: Community Health Nursing', venue: 'Nursing Hall 1', time: '09:00 AM' },
        { unitName: 'NUR 1202: Maternal and Child Health', venue: 'Medical Hall 2', time: '02:00 PM' },
        { unitName: 'NUR 1203: Medical-Surgical Nursing II', venue: 'Nursing Lab 1', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Mass Communication': {
    defaultCourse: 'Bachelor of Mass Communication',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'MCO 1101: Introduction to Mass Communication', venue: 'Media Hall 1', time: '09:00 AM' },
        { unitName: 'MCO 1102: Media Writing', venue: 'Media Lab 1', time: '02:00 PM' },
        { unitName: 'MCO 1103: Communication Theory', venue: 'Media Hall 2', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'MCO 1201: Print Journalism', venue: 'Media Hall 1', time: '09:00 AM' },
        { unitName: 'MCO 1202: Broadcast Journalism', venue: 'Media Lab 1', time: '02:00 PM' },
        { unitName: 'MCO 1203: Public Relations', venue: 'Media Hall 2', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'BSc Public Health': {
    defaultCourse: 'BSc Public Health',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'PHL 1101: Introduction to Public Health', venue: 'Health Hall 1', time: '09:00 AM' },
        { unitName: 'PHL 1102: Epidemiology I', venue: 'Health Hall 2', time: '02:00 PM' },
        { unitName: 'PHL 1103: Biostatistics I', venue: 'Room 4', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'PHL 1201: Environmental Health', venue: 'Health Hall 1', time: '09:00 AM' },
        { unitName: 'PHL 1202: Epidemiology II', venue: 'Health Hall 2', time: '02:00 PM' },
        { unitName: 'PHL 1203: Biostatistics II', venue: 'Room 4', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'BSc Statistics': {
    defaultCourse: 'BSc Statistics',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'STA 1101: Introduction to Statistics', venue: 'Room 4', time: '09:00 AM' },
        { unitName: 'STA 1102: Probability Theory', venue: 'Room 5', time: '02:00 PM' },
        { unitName: 'STA 1103: Mathematical Statistics', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'STA 1201: Statistical Inference', venue: 'Room 4', time: '09:00 AM' },
        { unitName: 'STA 1202: Regression Analysis', venue: 'Room 5', time: '02:00 PM' },
        { unitName: 'STA 1203: Time Series Analysis', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'BSc Mathematics': {
    defaultCourse: 'BSc Mathematics',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'MAT 1101: Calculus I', venue: 'Room 4', time: '09:00 AM' },
        { unitName: 'MAT 1102: Linear Algebra', venue: 'Room 5', time: '02:00 PM' },
        { unitName: 'MAT 1103: Discrete Mathematics', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '02:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'MAT 1201: Calculus II', venue: 'Room 4', time: '09:00 AM' },
        { unitName: 'MAT 1202: Abstract Algebra', venue: 'Room 5', time: '02:00 PM' },
        { unitName: 'MAT 1203: Real Analysis', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Dental Surgery (BDS)': {
    defaultCourse: 'Bachelor of Dental Surgery (BDS)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'DEN 1101: Oral Biology', venue: 'Science Block A', time: '08:00 AM' },
        { unitName: 'DEN 1102: Human Anatomy for Dentistry', venue: 'Lab A', time: '11:00 AM' },
        { unitName: 'DEN 1103: Dental Biochemistry', venue: 'Lab B', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'DEN 1201: Dental Histology', venue: 'Lab A', time: '08:00 AM' },
        { unitName: 'DEN 1202: Dental Physiology', venue: 'Science Block A', time: '11:00 AM' },
        { unitName: 'DEN 1203: Introduction to Clinical Dentistry', venue: 'Clinic Block', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'DEN 2101: Oral Pathology I', venue: 'Lab B', time: '08:00 AM' },
        { unitName: 'DEN 2102: Dental Pharmacology', venue: 'Science Block A', time: '11:00 AM' },
        { unitName: 'DEN 2103: Operative Dentistry I', venue: 'Clinic Block', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'DEN 2201: Oral Pathology II', venue: 'Lab B', time: '08:00 AM' },
        { unitName: 'DEN 2202: Oral Radiology', venue: 'Radiology Unit', time: '11:00 AM' },
        { unitName: 'DEN 2203: Operative Dentistry II', venue: 'Clinic Block', time: '02:00 PM' }
      ]
    }
  },
  'BSc Medical Laboratory Science': {
    defaultCourse: 'BSc Medical Laboratory Science',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'MLS 1101: Introduction to Medical Laboratory Science', venue: 'Lab A', time: '08:00 AM' },
        { unitName: 'MLS 1102: Human Anatomy and Physiology', venue: 'Science Block B', time: '11:00 AM' },
        { unitName: 'MLS 1103: Basic Chemistry for Health Sciences', venue: 'Lab B', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'MLS 1201: Haematology I', venue: 'Lab A', time: '08:00 AM' },
        { unitName: 'MLS 1202: Clinical Biochemistry I', venue: 'Lab B', time: '11:00 AM' },
        { unitName: 'MLS 1203: Microbiology I', venue: 'Science Block B', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'MLS 2101: Haematology II', venue: 'Lab A', time: '08:00 AM' },
        { unitName: 'MLS 2102: Clinical Biochemistry II', venue: 'Lab B', time: '11:00 AM' },
        { unitName: 'MLS 2103: Parasitology', venue: 'Science Block B', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'MLS 2201: Blood Banking and Transfusion', venue: 'Lab A', time: '08:00 AM' },
        { unitName: 'MLS 2202: Histopathology I', venue: 'Lab B', time: '11:00 AM' },
        { unitName: 'MLS 2203: Research Methods', venue: 'Room 3', time: '02:00 PM' }
      ]
    }
  },
  'BSc Physiotherapy': {
    defaultCourse: 'BSc Physiotherapy',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'PHY 1101: Anatomy for Physiotherapy', venue: 'Lab A', time: '08:00 AM' },
        { unitName: 'PHY 1102: Physiology for Physiotherapy', venue: 'Science Block B', time: '11:00 AM' },
        { unitName: 'PHY 1103: Introduction to Physiotherapy', venue: 'Clinic Block', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'PHY 1201: Biomechanics', venue: 'Lab A', time: '08:00 AM' },
        { unitName: 'PHY 1202: Exercise Physiology', venue: 'Science Block B', time: '11:00 AM' },
        { unitName: 'PHY 1203: Basic Physiotherapy Techniques', venue: 'Clinic Block', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'PHY 2101: Musculoskeletal Physiotherapy', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'PHY 2102: Neurological Physiotherapy', venue: 'Clinic Block', time: '11:00 AM' },
        { unitName: 'PHY 2103: Cardiorespiratory Physiotherapy', venue: 'Lab A', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'PHY 2201: Paediatric Physiotherapy', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'PHY 2202: Sports Physiotherapy', venue: 'Gym Block', time: '11:00 AM' },
        { unitName: 'PHY 2203: Research Methods in Physiotherapy', venue: 'Room 3', time: '02:00 PM' }
      ]
    }
  },
  'BSc Environmental Health Science': {
    defaultCourse: 'BSc Environmental Health Science',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'EHS 1101: Introduction to Environmental Health', venue: 'Room 5', time: '08:00 AM' },
        { unitName: 'EHS 1102: Environmental Chemistry', venue: 'Lab B', time: '11:00 AM' },
        { unitName: 'EHS 1103: Epidemiology and Disease Control', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'EHS 1201: Water and Sanitation', venue: 'Lab B', time: '08:00 AM' },
        { unitName: 'EHS 1202: Food Safety and Hygiene', venue: 'Room 5', time: '11:00 AM' },
        { unitName: 'EHS 1203: Occupational Health and Safety', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'EHS 2101: Air Quality Management', venue: 'Room 5', time: '08:00 AM' },
        { unitName: 'EHS 2102: Solid Waste Management', venue: 'Lab B', time: '11:00 AM' },
        { unitName: 'EHS 2103: Environmental Toxicology', venue: 'Room 4', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'EHS 2201: Environmental Impact Assessment', venue: 'Room 5', time: '08:00 AM' },
        { unitName: 'EHS 2202: Disease Vector Control', venue: 'Lab B', time: '11:00 AM' },
        { unitName: 'EHS 2203: Research Methods', venue: 'Room 3', time: '02:00 PM' }
      ]
    }
  },
  'BSc Human Nutrition and Dietetics': {
    defaultCourse: 'BSc Human Nutrition and Dietetics',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'NUT 1101: Introduction to Nutrition', venue: 'Room 6', time: '08:00 AM' },
        { unitName: 'NUT 1102: Human Biochemistry', venue: 'Lab B', time: '11:00 AM' },
        { unitName: 'NUT 1103: Food Science and Technology', venue: 'Lab C', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'NUT 1201: Macronutrients and Metabolism', venue: 'Lab B', time: '08:00 AM' },
        { unitName: 'NUT 1202: Micronutrients', venue: 'Room 6', time: '11:00 AM' },
        { unitName: 'NUT 1203: Community Nutrition', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'NUT 2101: Clinical Nutrition I', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'NUT 2102: Dietetics Practice', venue: 'Lab C', time: '11:00 AM' },
        { unitName: 'NUT 2103: Maternal and Child Nutrition', venue: 'Room 6', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'NUT 2201: Clinical Nutrition II', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'NUT 2202: Public Health Nutrition', venue: 'Room 4', time: '11:00 AM' },
        { unitName: 'NUT 2203: Research Methods in Nutrition', venue: 'Room 3', time: '02:00 PM' }
      ]
    }
  },
  'BSc Mechanical Engineering': {
    defaultCourse: 'BSc Mechanical Engineering',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'MEN 1101: Engineering Mathematics I', venue: 'Room 1', time: '08:00 AM' },
        { unitName: 'MEN 1102: Engineering Drawing', venue: 'Drawing Studio', time: '11:00 AM' },
        { unitName: 'MEN 1103: Introduction to Mechanical Engineering', venue: 'Workshop A', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'MEN 1201: Engineering Mathematics II', venue: 'Room 1', time: '08:00 AM' },
        { unitName: 'MEN 1202: Thermodynamics I', venue: 'Workshop A', time: '11:00 AM' },
        { unitName: 'MEN 1203: Mechanics of Materials', venue: 'Lab E', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'MEN 2101: Thermodynamics II', venue: 'Workshop A', time: '08:00 AM' },
        { unitName: 'MEN 2102: Fluid Mechanics', venue: 'Lab E', time: '11:00 AM' },
        { unitName: 'MEN 2103: Manufacturing Technology', venue: 'Workshop B', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'MEN 2201: Machine Design', venue: 'Workshop A', time: '08:00 AM' },
        { unitName: 'MEN 2202: Heat Transfer', venue: 'Lab E', time: '11:00 AM' },
        { unitName: 'MEN 2203: Engineering Management', venue: 'Room 2', time: '02:00 PM' }
      ]
    }
  },
  'BSc Architecture': {
    defaultCourse: 'BSc Architecture',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'ARC 1101: Architectural Design I', venue: 'Design Studio', time: '08:00 AM' },
        { unitName: 'ARC 1102: History of Architecture', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'ARC 1103: Building Technology I', venue: 'Workshop A', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'ARC 1201: Architectural Design II', venue: 'Design Studio', time: '08:00 AM' },
        { unitName: 'ARC 1202: Structural Systems', venue: 'Lab E', time: '11:00 AM' },
        { unitName: 'ARC 1203: Environmental Design', venue: 'Room 7', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'ARC 2101: Urban Design and Planning', venue: 'Design Studio', time: '08:00 AM' },
        { unitName: 'ARC 2102: Building Services', venue: 'Workshop A', time: '11:00 AM' },
        { unitName: 'ARC 2103: Construction Materials', venue: 'Lab E', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'ARC 2201: Architectural Design III', venue: 'Design Studio', time: '08:00 AM' },
        { unitName: 'ARC 2202: Professional Practice', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'ARC 2203: Research Studio', venue: 'Design Studio', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Commerce (BCom)': {
    defaultCourse: 'Bachelor of Commerce (BCom)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'COM 1101: Principles of Commerce', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'COM 1102: Business Mathematics', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'COM 1103: Introduction to Accounting', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'COM 1201: Business Economics', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'COM 1202: Commercial Law', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'COM 1203: Financial Accounting', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'COM 2101: Cost Accounting', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'COM 2102: Banking and Finance', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'COM 2103: Marketing Management', venue: 'Room 4', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'COM 2201: Auditing', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'COM 2202: Taxation', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'COM 2203: Business Research Methods', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Human Resource Management': {
    defaultCourse: 'Bachelor of Human Resource Management',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'HRM 1101: Introduction to Human Resource Management', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'HRM 1102: Organisational Behaviour', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'HRM 1103: Business Communication', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'HRM 1201: Recruitment and Selection', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'HRM 1202: Labour Law', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'HRM 1203: Compensation and Benefits', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'HRM 2101: Training and Development', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'HRM 2102: Performance Management', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'HRM 2103: HR Information Systems', venue: 'Lab 1', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'HRM 2201: Strategic HR Management', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'HRM 2202: Industrial Relations', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'HRM 2203: HR Research Methods', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Banking and Finance': {
    defaultCourse: 'Bachelor of Banking and Finance',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'BNF 1101: Introduction to Banking', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'BNF 1102: Financial Mathematics', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'BNF 1103: Principles of Finance', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'BNF 1201: Commercial Banking', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'BNF 1202: Financial Accounting', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'BNF 1203: Economics for Finance', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'BNF 2101: Investment Analysis', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'BNF 2102: Risk Management', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'BNF 2103: Financial Markets', venue: 'Room 4', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'BNF 2201: Corporate Finance', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'BNF 2202: Central Banking and Monetary Policy', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'BNF 2203: Banking Research Methods', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Procurement and Logistics': {
    defaultCourse: 'Bachelor of Procurement and Logistics',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'PRL 1101: Introduction to Procurement', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'PRL 1102: Supply Chain Management', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'PRL 1103: Business Mathematics', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'PRL 1201: Logistics and Transport Management', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'PRL 1202: Procurement Law', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'PRL 1203: Warehouse Management', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'PRL 2101: Strategic Sourcing', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'PRL 2102: Inventory Management', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'PRL 2103: Quality Management', venue: 'Room 4', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'PRL 2201: Public Procurement', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'PRL 2202: International Trade and Logistics', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'PRL 2203: Research Methods', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Accounting and Finance': {
    defaultCourse: 'Bachelor of Accounting and Finance',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'ACF 1101: Introduction to Accounting', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'ACF 1102: Business Mathematics', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'ACF 1103: Microeconomics', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'ACF 1201: Financial Accounting I', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'ACF 1202: Macroeconomics', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'ACF 1203: Business Law', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'ACF 2101: Financial Accounting II', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'ACF 2102: Management Accounting', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'ACF 2103: Taxation', venue: 'Room 4', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'ACF 2201: Auditing and Assurance', venue: 'Room 2', time: '09:00 AM' },
        { unitName: 'ACF 2202: Corporate Finance', venue: 'Room 3', time: '11:00 AM' },
        { unitName: 'ACF 2203: Research Methods in Accounting', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Development Studies': {
    defaultCourse: 'Bachelor of Development Studies',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'DVS 1101: Introduction to Development Studies', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'DVS 1102: Political Economy of Development', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'DVS 1103: Development Communication', venue: 'Room 8', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'DVS 1201: Rural Development', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'DVS 1202: Gender and Development', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'DVS 1203: Development Planning', venue: 'Room 8', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'DVS 2101: Project Management', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'DVS 2102: NGO Management', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'DVS 2103: Poverty and Development', venue: 'Room 8', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'DVS 2201: International Development', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'DVS 2202: Community Development', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'DVS 2203: Research Methods in Development', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Social Work and Social Administration': {
    defaultCourse: 'Bachelor of Social Work and Social Administration',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'SWA 1101: Introduction to Social Work', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'SWA 1102: Sociology', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'SWA 1103: Psychology for Social Workers', venue: 'Room 8', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'SWA 1201: Social Policy and Administration', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'SWA 1202: Human Rights and Social Justice', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'SWA 1203: Community Organisation', venue: 'Room 8', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'SWA 2101: Child and Family Welfare', venue: 'Room 6', time: '09:00 AM' },
        { unitName: 'SWA 2102: Counselling Skills', venue: 'Room 7', time: '11:00 AM' },
        { unitName: 'SWA 2103: Community Development Practice', venue: 'Room 8', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'SWA 2201: Social Work Research Methods', venue: 'Room 5', time: '09:00 AM' },
        { unitName: 'SWA 2202: Disability Studies', venue: 'Room 6', time: '11:00 AM' },
        { unitName: 'SWA 2203: Social Work Practice Placement', venue: 'Field', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Education (Arts)': {
    defaultCourse: 'Bachelor of Education (Arts)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'EDU 1101: Introduction to Education', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 1102: Philosophy of Education', venue: 'Room 9', time: '11:00 AM' },
        { unitName: 'EDU 1103: Teaching Methods in Arts I', venue: 'Room 10', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'EDU 1201: Curriculum Development', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 1202: Psychology of Learning', venue: 'Room 9', time: '11:00 AM' },
        { unitName: 'EDU 1203: Teaching Methods in Arts II', venue: 'Room 10', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'EDU 2101: Educational Assessment and Evaluation', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 2102: Special Needs Education', venue: 'Room 9', time: '11:00 AM' },
        { unitName: 'EDU 2103: Literature and Language Teaching', venue: 'Room 10', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'EDU 2201: Educational Administration', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 2202: Teaching Practice Arts', venue: 'Field', time: '11:00 AM' },
        { unitName: 'EDU 2203: Research Methods in Education', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Education (Science)': {
    defaultCourse: 'Bachelor of Education (Science)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'EDU 1101: Introduction to Education', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 1102: Philosophy of Education', venue: 'Room 9', time: '11:00 AM' },
        { unitName: 'EDU 1104: Teaching Methods in Science I', venue: 'Science Block B', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'EDU 1201: Curriculum Development', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 1202: Psychology of Learning', venue: 'Room 9', time: '11:00 AM' },
        { unitName: 'EDU 1204: Teaching Methods in Science II', venue: 'Science Block B', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'EDU 2101: Educational Assessment and Evaluation', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 2102: Special Needs Education', venue: 'Room 9', time: '11:00 AM' },
        { unitName: 'EDU 2104: Science Practicals in Schools', venue: 'Science Block B', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'EDU 2201: Educational Administration', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 2202: Teaching Practice Science', venue: 'Field', time: '11:00 AM' },
        { unitName: 'EDU 2203: Research Methods in Education', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Education (Business Studies)': {
    defaultCourse: 'Bachelor of Education (Business Studies)',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'EDU 1101: Introduction to Education', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 1102: Philosophy of Education', venue: 'Room 9', time: '11:00 AM' },
        { unitName: 'EDU 1105: Teaching Methods in Business I', venue: 'Room 10', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'EDU 1201: Curriculum Development', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 1202: Psychology of Learning', venue: 'Room 9', time: '11:00 AM' },
        { unitName: 'EDU 1205: Teaching Methods in Business II', venue: 'Room 10', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'EDU 2101: Educational Assessment and Evaluation', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 2105: Entrepreneurship Education', venue: 'Room 10', time: '11:00 AM' },
        { unitName: 'EDU 2106: Accounting for School Business', venue: 'Room 2', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'EDU 2201: Educational Administration', venue: 'Room 8', time: '09:00 AM' },
        { unitName: 'EDU 2202: Teaching Practice Business', venue: 'Field', time: '11:00 AM' },
        { unitName: 'EDU 2203: Research Methods in Education', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  },
  'Bachelor of Clinical Medicine and Community Health': {
    defaultCourse: 'Bachelor of Clinical Medicine and Community Health',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'CLM 1101: Anatomy for Clinical Officers', venue: 'Science Block A', time: '08:00 AM' },
        { unitName: 'CLM 1102: Physiology for Clinical Officers', venue: 'Lab A', time: '11:00 AM' },
        { unitName: 'CLM 1103: Biochemistry for Clinical Medicine', venue: 'Lab B', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'CLM 1201: General Medicine I', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'CLM 1202: Surgery I', venue: 'Clinic Block', time: '11:00 AM' },
        { unitName: 'CLM 1203: Community Health I', venue: 'Room 4', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'CLM 2101: General Medicine II', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'CLM 2102: Paediatrics and Child Health', venue: 'Clinic Block', time: '11:00 AM' },
        { unitName: 'CLM 2103: Obstetrics and Gynaecology', venue: 'Clinic Block', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'CLM 2201: Mental Health', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'CLM 2202: Dermatology and Venereology', venue: 'Clinic Block', time: '11:00 AM' },
        { unitName: 'CLM 2203: Community Health II', venue: 'Field', time: '02:00 PM' }
      ]
    }
  },
  'BSc Anaesthesia Science': {
    defaultCourse: 'BSc Anaesthesia Science',
    semesters: {
      'Year 1 Semester 1': [
        { unitName: 'ANS 1101: Anatomy for Anaesthesia', venue: 'Science Block A', time: '08:00 AM' },
        { unitName: 'ANS 1102: Physiology for Anaesthesia', venue: 'Lab A', time: '11:00 AM' },
        { unitName: 'ANS 1103: Introduction to Anaesthesia Science', venue: 'Clinic Block', time: '02:00 PM' },
        { unitName: 'UCC 1101: English Language Skills', venue: 'Main Hall', time: '04:00 PM' }
      ],
      'Year 1 Semester 2': [
        { unitName: 'ANS 1201: Pharmacology for Anaesthesia', venue: 'Lab B', time: '08:00 AM' },
        { unitName: 'ANS 1202: Anaesthesia Equipment', venue: 'Clinic Block', time: '11:00 AM' },
        { unitName: 'ANS 1203: Pain Management I', venue: 'Clinic Block', time: '02:00 PM' },
        { unitName: 'UCC 1200: Communication Skills', venue: 'Auditorium', time: '04:00 PM' }
      ],
      'Year 2 Semester 1': [
        { unitName: 'ANS 2101: General Anaesthesia I', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'ANS 2102: Regional Anaesthesia', venue: 'Clinic Block', time: '11:00 AM' },
        { unitName: 'ANS 2103: Critical Care Medicine', venue: 'ICU Block', time: '02:00 PM' }
      ],
      'Year 2 Semester 2': [
        { unitName: 'ANS 2201: Paediatric Anaesthesia', venue: 'Clinic Block', time: '08:00 AM' },
        { unitName: 'ANS 2202: Obstetric Anaesthesia', venue: 'Clinic Block', time: '11:00 AM' },
        { unitName: 'ANS 2203: Research Methods in Anaesthesia', venue: 'Room 5', time: '02:00 PM' }
      ]
    }
  }
}
