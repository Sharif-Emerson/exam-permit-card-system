
import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { UnsavedChangesProvider } from './context/UnsavedChangesContext'

const Login = lazy(() => import('./components/Login'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))

function RouteFallback() {
  return <div className="min-h-screen bg-gray-100 dark:bg-slate-950" />
}

// Component to show confirmation dialog when trying to leave with unsaved changes
function LeaveConfirmation() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Only show confirmation when user is logged in
    if (!user) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [user, navigate])

  return null
}

function HomeRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-gray-100" />
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} />
}

function LoginRoute() {
  const { user } = useAuth()

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} />
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Login />
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <UnsavedChangesProvider>
            <LeaveConfirmation />
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/login" element={<LoginRoute />} />
              <Route
                path="/student"
                element={
                  <ProtectedRoute requiredRole="student">
                    <Suspense fallback={<RouteFallback />}>
                      <Dashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Suspense fallback={<RouteFallback />}>
                      <AdminPanel />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </UnsavedChangesProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
  