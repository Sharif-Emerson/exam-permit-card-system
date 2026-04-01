import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function AdminPanel() {
  const [students, setStudents] = useState([])

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*')
    setStudents(data || [])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl mb-4">Students</h2>
        <ul>
          {students.map(student => (
            <li key={student.id} className="mb-2">{student.name} - {student.email}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}