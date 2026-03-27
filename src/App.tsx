
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import ProtectedRoute from './components/ProtectedRoute'
import SignOutDialog from './components/SignOutDialog'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { UnsavedChangesProvider } from './context/UnsavedChangesContext'
import { institutionLogo, institutionName } from './config/branding'

const Login     = lazy(() => import('./components/Login'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))

/* ─── Branded loading screen ──────────────────────────────────────────────── */

function AppLoadingScreen() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-emerald-50 via-white to-lime-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
      style={{ animation: 'kiu-fade-in 0.35s ease-out both' }}
    >
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-4 border-emerald-100 border-t-emerald-500 dark:border-slate-800 dark:border-t-emerald-400"
          style={{ animation: 'kiu-spin 0.9s linear infinite' }}
        />
        <img
          src={institutionLogo}
          alt={institutionName}
          className="h-20 w-20 object-contain"
          draggable={false}
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm font-semibold tracking-wide text-emerald-900 dark:text-emerald-200">
          {institutionName}
        </p>
        <p className="text-xs text-emerald-500 dark:text-slate-500">Please wait…</p>
      </div>
      <style>{`
        @keyframes kiu-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes kiu-spin    { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

/* ─── Back-button interceptor ─────────────────────────────────────────────── */

function BackNavigationHandler() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  // Keep refs so the event listener always has the latest values
  const userRef    = useRef(user)
  const signOutRef = useRef(signOut)
  const navigateRef = useRef(navigate)
  userRef.current    = user
  signOutRef.current = signOut
  navigateRef.current = navigate

  const [showDialog, setShowDialog] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const handle = () => {
      const currentUser = userRef.current
      if (!currentUser) return

      // Push the user's page back so the URL doesn't change visually
      const targetPath = currentUser.role === 'admin' ? '/admin' : '/student'
      navigateRef.current(targetPath, { replace: true })

      // Show the sign-out confirmation dialog
      setShowDialog(true)
    }

    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, []) // intentionally empty — uses refs

  async function handleConfirm() {
    setSigningOut(true)
    await signOutRef.current()
    setShowDialog(false)
    setSigningOut(false)
    navigateRef.current('/login', { replace: true })
  }

  function handleCancel() {
    setShowDialog(false)
  }

  if (!showDialog) return null

  return (
    <SignOutDialog
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      signingOut={signingOut}
    />
  )
}

/* ─── Animated route wrapper ──────────────────────────────────────────────── */

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <>
      <div
        key={location.pathname}
        style={{ animation: 'kiu-page-in 0.32s ease-out both' }}
      >
        <Routes location={location}>
          <Route path="/"       element={<HomeRedirect />} />
          <Route path="/login"  element={<LoginRoute />} />
          <Route
            path="/student"
            element={
              <ProtectedRoute requiredRole="student">
                <Suspense fallback={<AppLoadingScreen />}>
                  <Dashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <Suspense fallback={<AppLoadingScreen />}>
                  <AdminPanel />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <style>{`
        @keyframes kiu-page-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </>
  )
}

/* ─── Route-level components ──────────────────────────────────────────────── */

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <AppLoadingScreen />
  if (!user)   return <Navigate to="/login" />
  return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} />
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return <AppLoadingScreen />
  if (user)    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <Login />
    </Suspense>
  )
}

/* ─── Leave-page confirmation (browser close/refresh) ─────────────────────── */

function LeaveConfirmation() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const handle = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handle)
    return () => window.removeEventListener('beforeunload', handle)
  }, [user])

  return null
}

/* ─── App root ────────────────────────────────────────────────────────────── */

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <UnsavedChangesProvider>
            <BackNavigationHandler />
            <LeaveConfirmation />
            <AnimatedRoutes />
          </UnsavedChangesProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}