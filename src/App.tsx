import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'
import SignOutDialog from './components/SignOutDialog'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ConfirmationProvider } from './context/ConfirmationContext'
import { UnsavedChangesProvider } from './context/UnsavedChangesContext'
import { useUnsavedChanges } from './hooks/useUnsavedChanges'
import { institutionLogo, institutionName } from './config/branding'
import InvigilatorCheckIn from './components/InvigilatorCheckIn'

const Login = lazy(() => import('./components/Login'))
const Dashboard = lazy(() => import('./components/Dashboard'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))

/* ─── Branded loading screen ──────────────────────────────────────────────── */

function AppLoadingScreen() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-emerald-50 via-white to-lime-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 kiu-fade-in"
    >
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-4 border-emerald-100 border-t-emerald-500 dark:border-slate-800 dark:border-t-emerald-400 kiu-spin"
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
    </div>
  )
}

/* ─── Back-button interceptor ─────────────────────────────────────────────── */

function BackNavigationHandler() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const userRef = useRef(user)
  const signOutRef = useRef(signOut)
  const navigateRef = useRef(navigate)
  userRef.current = user
  signOutRef.current = signOut
  navigateRef.current = navigate

  const [showDialog, setShowDialog] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const handle = () => {
      const currentUser = userRef.current
      if (!currentUser) return

      const targetPath = currentUser.role === 'admin' ? '/admin' : '/student'

      // Only intercept if the user is actually navigating AWAY from the app path.
      // Hash-only navigation (e.g. /admin#students -> /admin#reports or /admin)
      // must not trigger the sign-out dialog.
      if (window.location.pathname === targetPath) {
        return
      }

      navigateRef.current(targetPath, { replace: true })
      setShowDialog(true)
    }

    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [])

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

/* ─── Route-level components ──────────────────────────────────────────────── */

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <AppLoadingScreen />
  if (!user) return <Navigate to="/login" />
  return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} />
}

function LoginRoute() {
  const { user, loading } = useAuth()
  if (loading) return <AppLoadingScreen />
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <Login />
    </Suspense>
  )
}

/* ─── Leave-page confirmation (browser close/refresh) ─────────────────────── */

function LeaveConfirmation() {
  const { user } = useAuth()
  const { hasUnsavedChanges } = useUnsavedChanges()

  useEffect(() => {
    if (!user || !hasUnsavedChanges) return

    const handle = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handle)
    return () => window.removeEventListener('beforeunload', handle)
  }, [user, hasUnsavedChanges])

  return null
}

/* ─── Root layout (data router: enables useBlocker for unsaved changes) ───── */

function RootLayout() {
  const location = useLocation()
  return (
    <ThemeProvider>
      <AuthProvider>
        <UnsavedChangesProvider>
          <ConfirmationProvider>
            <BackNavigationHandler />
            <LeaveConfirmation />
            <div key={location.pathname} className="kiu-page-in">
              <Outlet />
            </div>
          </ConfirmationProvider>
        </UnsavedChangesProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'login', element: <LoginRoute /> },
      {
        path: 'student',
        element: (
          <ProtectedRoute requiredRole="student">
            <Suspense fallback={<AppLoadingScreen />}>
              <Dashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requiredRole="admin">
            <Suspense fallback={<AppLoadingScreen />}>
              <AdminPanel />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      { path: 'invigilator-checkin', element: <InvigilatorCheckIn /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

/* ─── App root ────────────────────────────────────────────────────────────── */

export default function App() {
  return <RouterProvider router={appRouter} />
}
