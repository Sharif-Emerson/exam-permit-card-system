export interface Student {
  id: number
  name: string
  email: string
  password: string
  studentId: string
  course: string
  examDate: string
  examTime: string
  venue: string
  seatNumber: string
  instructions: string
  profileImage: string
  exams: Array<{
    id: string
    title: string
    examDate: string
    examTime: string
    venue: string
    seatNumber: string
  }>
  totalFees: number
  amountPaid: number
  feesBalance: number // This will be calculated as totalFees - amountPaid
}

export interface Admin {
  id: string
  email: string
  password: string
  name: string
}

export const mockStudents: Student[] = [
  {
    id: 1,
    name: "John Doe",
    email: "student1@example.com",
    password: "password123",
    studentId: "STU001",
    course: "Computer Science",
    examDate: "2024-01-15",
    examTime: "10:00 AM",
    venue: "Hall A",
    seatNumber: "A-001",
    instructions: "Bring valid ID and arrive 30 minutes early.",
    profileImage: "https://via.placeholder.com/150",
    exams: [
      {
        id: 'student-1-exam-1',
        title: 'Computer Science Theory',
        examDate: '2024-01-15',
        examTime: '10:00 AM',
        venue: 'Hall A',
        seatNumber: 'A-001'
      }
    ],
    totalFees: 3000.00,
    amountPaid: 500.00,
    feesBalance: 2500.00
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "student2@example.com",
    password: "password123",
    studentId: "STU002",
    course: "Mathematics",
    examDate: "2024-01-16",
    examTime: "2:00 PM",
    venue: "Hall B",
    seatNumber: "B-002",
    instructions: "No calculators allowed. Bring pencils only.",
    profileImage: "https://via.placeholder.com/150",
    exams: [
      {
        id: 'student-2-exam-1',
        title: 'Mathematics Paper I',
        examDate: '2024-01-16',
        examTime: '2:00 PM',
        venue: 'Hall B',
        seatNumber: 'B-002'
      }
    ],
    totalFees: 3000.00,
    amountPaid: 3000.00,
    feesBalance: 0.00
  },
  {
    id: 3,
    name: "Bob Johnson",
    email: "student3@example.com",
    password: "password123",
    studentId: "STU003",
    course: "Physics",
    examDate: "2024-01-17",
    examTime: "9:00 AM",
    venue: "Hall C",
    seatNumber: "C-003",
    instructions: "Lab coat required. Safety goggles mandatory.",
    profileImage: "https://via.placeholder.com/150",
    exams: [
      {
        id: 'student-3-exam-1',
        title: 'Physics Practical',
        examDate: '2024-01-17',
        examTime: '9:00 AM',
        venue: 'Hall C',
        seatNumber: 'C-003'
      }
    ],
    totalFees: 3000.00,
    amountPaid: 1749.50,
    feesBalance: 1250.50
  }
];

export const mockAdmins: Admin[] = [
  {
    id: "admin",
    email: "admin@example.com",
    password: "admin123",
    name: "Administrator"
  }
];