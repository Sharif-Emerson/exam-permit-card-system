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

export interface KiuProgramCurriculum {
  defaultCourse: string
  semesters: Record<string, string[]>
}

export const KIU_CURRICULUM: Record<string, KiuProgramCurriculum> = {
  'BSc Computer Science': {
    defaultCourse: 'BSc Computer Science',
    semesters: {
      'Year 1 Semester 1': [
        'COS 1101: Computer Architecture And Organization',
        'COS 1102: Introduction To Mathematical Analysis',
        'COS 1103: Digital Logic',
        'UCC 1100: Computer Fundamentals',
        'UCC 1101: English Language Skills'
      ],
      'Year 1 Semester 2': [
        'COS 1201: Computer Hardware',
        'COS 1202: Data Structures and Algorithms',
        'COS 1203: Discrete Mathematics',
        'UCC 1200: Communication Skills'
      ],
      'Year 2 Semester 1': [
        'COS 2101: Object Oriented Programming',
        'COS 2102: Principles Of Electronics',
        'COS 2103: Probability And Statistics',
        'ITE 2102: Systems Analysis & Design',
        'ITE 2103: Computer Networks & Data Communications'
      ],
      'Year 3 Semester 1': [
        'COS 3101: Simulation And Modelling',
        'COS 3102: Emerging Trends In Computer Science',
        'COS 3103: Application Development By Java',
        'COS 3104: Compiler Construction',
        'COS 3105: Communication Systems'
      ]
    }
  },
  'BSc Information Technology': {
    defaultCourse: 'BSc Information Technology',
    semesters: {
      'Year 1 Semester 1': [
        'ITE 1101: Introduction to IT',
        'COS 1102: Introduction To Mathematical Analysis',
        'UCC 1100: Computer Fundamentals',
        'UCC 1101: English Language Skills'
      ],
      'Year 1 Semester 2': [
        'ITE 1201: Database Management Systems',
        'ITE 1202: Web Technologies I',
        'COS 1202: Data Structures and Algorithms',
        'UCC 1200: Communication Skills'
      ]
    }
  },
  'Bachelor of Laws (LLB)': {
    defaultCourse: 'Bachelor of Laws (LLB)',
    semesters: {
      'Year 1 Semester 1': [
        'LAW 1101: Introduction to Law',
        'LAW 1102: Contracts I',
        'LAW 1103: Constitutional Law I',
        'UCC 1101: English Language Skills'
      ],
      'Year 1 Semester 2': [
        'LAW 1201: Contracts II',
        'LAW 1202: Constitutional Law II',
        'LAW 1203: Torts I',
        'UCC 1200: Communication Skills'
      ]
    }
  }
}
