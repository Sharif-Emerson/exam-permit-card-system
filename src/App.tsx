
import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

const Login = lazy(() => import('./components/Login'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))

function RouteFallback() {
  return <div className="min-h-screen bg-gray-100 dark:bg-slate-950" />
}

function HomeRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-gray-100" />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
}

function LoginRoute() {
  const { user } = useAuth()

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
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
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
  