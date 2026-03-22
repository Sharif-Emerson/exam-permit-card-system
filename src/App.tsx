
import { useEffect, useState } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AdminPanel from './components/AdminPanel'

interface User {
  id: string | number
  role: 'admin' | 'student'
}

function isValidUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as { id?: unknown; role?: unknown }

  return (
    (typeof candidate.id === 'string' || typeof candidate.id === 'number') &&
    (candidate.role === 'admin' || candidate.role === 'student')
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user')

      if (!storedUser) {
        return
      }

      const parsedUser: unknown = JSON.parse(storedUser)

      if (isValidUser(parsedUser)) {
        setUser(parsedUser)
      } else {
        localStorage.removeItem('user')
      }
    } catch (error) {
      console.warn('Failed to restore session from localStorage:', error)
      localStorage.removeItem('user')
    }
  }, [])

  const handleLogin = (userData: { id: string | number; role: 'admin' | 'student' }) => {
    setUser(userData)
  }

  const handleLogout = () => {
    setUser(null)
    try {
      localStorage.removeItem('user')
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : user.role === 'admin' ? (
        <AdminPanel onLogout={handleLogout} />
      ) : (
        <Dashboard user={user} />
      )}
    </div>
  )
}
  