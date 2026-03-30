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

/** Default degree program used for curriculum sync when a student has department set but program/course do not match KIU_CURRICULUM keys. */
export const KIU_DEPARTMENT_DEFAULT_PROGRAM: Record<string, string> = {
  'Department of Computer Science': 'BSc Computer Science',
  'Department of Information Technology': 'BSc Information Technology',
  'Department of Engineering': 'BSc Electrical Engineering',
  'School of Law': 'Bachelor of Laws (LLB)',
  'School of Medicine': 'MBChB (Medicine and Surgery)',
  'School of Business': 'BBA (Business Administration)',
  'School of Nursing': 'BSc Nursing Science',
  'School of Pharmacy': 'Bachelor of Pharmacy',
  'Department of Public Health': 'BSc Public Health',
}

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
  }
}
