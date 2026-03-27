export const KIU_COURSES = [
  'BSc Computer Science',
  'BSc Information Technology',
  'BSc Software Engineering',
  'Bachelor of Computer Science (BCS)',
  'Bachelor of Information Technology (BIT)',
  'BSc Electrical Engineering',
  'BSc Civil Engineering',
  'Bachelor of Laws (LLB)',
  'MBChB (Medicine and Surgery)',
  'BBA (Business Administration)',
  'Bachelor of Pharmacy',
  'BSc Nursing Science',
  'Bachelor of Mass Communication',
  'BSc Public Health',
  'BSc Statistics',
  'BSc Mathematics',
]

export const KIU_DEPARTMENTS = [
  'Department of Computer Science',
  'Department of Information Technology',
  'Department of Engineering',
  'School of Law',
  'School of Medicine',
  'School of Business',
  'School of Nursing',
  'School of Pharmacy',
  'Department of Public Health',
]

export const KIU_COLLEGES = [
  'College of Science and Technology',
  'College of Education',
  'College of Humanities and Social Sciences',
  'College of Business and Management',
  'School of Health Sciences',
  'School of Law',
]

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
        { unitName: 'COS 3201: Artificial Intelligence', venue: 'Lab 1', time: '09:00 AM' },
        { unitName: 'COS 3202: Computer Graphics', venue: 'Lab 2', time: '02:00 PM' },
        { unitName: 'COS 3203: Final Year Project', venue: 'Project Lab', time: '09:00 AM' },
        { unitName: 'UCC 3200: Entrepreneurship Skills', venue: 'Auditorium', time: '02:00 PM' }
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
  }
}
