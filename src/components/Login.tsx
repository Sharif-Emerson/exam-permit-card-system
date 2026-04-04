import { FormEvent, useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Lock, Moon, ShieldAlert, Sun, User, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { backendProvider, publicApiBaseUrl } from '../config/provider'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { resetPassword } from '../services/authService'
import { institutionLogo, institutionName } from '../config/branding'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signInWithToken, configError } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showResetForm, setShowResetForm] = useState(false)
  const [resetIdentifier, setResetIdentifier] = useState('')
  const [verification, setVerification] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [error, setError] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [oidcAvailable, setOidcAvailable] = useState<boolean | null>(null)
  const [oidcCompleting, setOidcCompleting] = useState(false)
  const signInWithTokenRef = useRef(signInWithToken)
  signInWithTokenRef.current = signInWithToken
  function normalizeLoginErrorMessage(message: string) {
    const text = message.toLowerCase()
    const isCredentialProblem = text.includes('invalid login credentials')
      || text.includes('invalid credentials')
      || text.includes('profile not found')
      || text.includes('invalid or expired token')
      || text.includes('unable to load the current profile')

    if (isCredentialProblem) {
      return 'Invalid credentials.'
    }

    return message
  }

  useEffect(() => {
    if (backendProvider !== 'rest' || configError) {
      setOidcAvailable(false)
      return
    }

    let cancelled = false

    void fetch(`${publicApiBaseUrl}/auth/oidc/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== 'object') {
          return
        }
        const enabled = (data as { enabled?: unknown }).enabled
        if (typeof enabled === 'boolean') {
          setOidcAvailable(enabled)
        } else {
          setOidcAvailable(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOidcAvailable(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [configError])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const raw = window.location.hash.replace(/^#/, '')
    if (!raw) {
      return
    }

    const params = new URLSearchParams(raw)
    const oidcToken = params.get('oidc_token')

    if (!oidcToken) {
      return
    }

    const tokenString: string = oidcToken
    let cancelled = false

    async function completeOidc() {
      setOidcCompleting(true)
      setError('')
      try {
        const signedIn = await signInWithTokenRef.current(tokenString)
        if (cancelled) {
          return
        }
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
        navigate(signedIn.role === 'admin' ? '/admin' : '/student', { replace: true })
      } catch (signInError) {
        if (!cancelled) {
          setError(signInError instanceof Error ? signInError.message : 'University sign-in failed.')
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
        }
      } finally {
        if (!cancelled) {
          setOidcCompleting(false)
        }
      }
    }

    void completeOidc()

    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Frontend validation for identifier and password
    if (!identifier.trim()) {
      setError('Please enter your email, phone number, or registration number.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      const user = await signIn(identifier, password)
      navigate(user.role === 'admin' ? '/admin' : '/student', { replace: true })
    } catch (signInError) {
      const nextError = signInError instanceof Error ? signInError.message : 'Invalid credentials.'
      setError(normalizeLoginErrorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      setError('Password confirmation does not match.')
      setResetMessage('')
      return
    }

    try {
      setResettingPassword(true)
      setError('')
      setResetMessage('')
      const result = await resetPassword(resetIdentifier.trim(), verification.trim(), newPassword)
      setResetMessage(result.message)
      setShowResetForm(false)
      setIdentifier(resetIdentifier.trim())
      setResetIdentifier('')
      setVerification('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (resetError) {
      const nextError = resetError instanceof Error ? resetError.message : 'Unable to reset password'
      setError(nextError)
    } finally {
      setResettingPassword(false)
    }
  }

  if (oidcCompleting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(187,247,208,0.75),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(254,249,195,0.75),_transparent_24%),linear-gradient(180deg,_#f0fdf4_0%,_#ecfdf5_40%,_#f7fee7_100%)] px-4 py-8 text-emerald-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.12),_transparent_18%),linear-gradient(180deg,_#020617_0%,_#052e16_52%,_#111827_100%)] dark:text-emerald-50 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="text-sm text-emerald-800 dark:text-emerald-200">Completing university sign-in…</p>
        </div>
      </div>
    )
  }

  return (
    <>
    {error && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-red-200 bg-white shadow-2xl dark:border-red-900 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-red-100 px-5 py-4 dark:border-red-900/60">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-500 dark:text-red-400" />
            <span className="flex-1 text-sm font-semibold text-red-700 dark:text-red-300">Error</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setError('')} className="rounded-full p-1 text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="px-5 py-4 text-sm text-red-700 dark:text-red-300">{error}</p>
          <div className="flex justify-end px-5 pb-4">
            <button type="button" onClick={() => setError('')} className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600">OK</button>
          </div>
        </div>
      </div>
    )}
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(187,247,208,0.75),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(254,249,195,0.75),_transparent_24%),linear-gradient(180deg,_#f0fdf4_0%,_#ecfdf5_40%,_#f7fee7_100%)] px-4 py-8 text-emerald-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.12),_transparent_18%),linear-gradient(180deg,_#020617_0%,_#052e16_52%,_#111827_100%)] dark:text-emerald-50 sm:px-6 lg:px-8">
      <style>{`
        @keyframes login-ribbon-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .login-ribbon-border {
          position: relative;
          border-radius: 1.6rem;
          padding: 2px;
          overflow: hidden;
        }
        .login-ribbon-border::before {
          content: '';
          position: absolute;
          inset: -120%;
          border-radius: 1.6rem;
          background: conic-gradient(from 0deg, #2563eb 0deg, #dc2626 120deg, #eab308 240deg, #2563eb 360deg);
          animation: login-ribbon-spin 3s linear infinite;
          z-index: 0;
          opacity: 0.95;
        }
        .login-ribbon-border > * {
          position: relative;
          z-index: 1;
        }
      `}</style>
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <button
          type="button"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className="rounded-full border border-emerald-200/80 bg-white/85 p-3 text-emerald-900 shadow-sm transition hover:-translate-y-0.5 dark:border-emerald-900 dark:bg-slate-900/85 dark:text-emerald-100"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="login-ribbon-border w-full max-w-md rounded-3xl">
        <div className="space-y-6 rounded-3xl border border-emerald-200 bg-white/95 p-6 shadow-lg shadow-emerald-100/60 dark:border-emerald-900/60 dark:bg-slate-950/85 dark:shadow-none sm:p-8 sm:space-y-8">
          <div className="text-center">
          <div className="mx-auto flex w-full max-w-xs flex-col items-center">
            <img
              src={institutionLogo}
              alt={`${institutionName} logo`}
              className="h-40 w-40 rounded-full border-4 border-emerald-500 object-cover shadow-lg sm:h-48 sm:w-48"
              draggable={false}
            />
            <h1 className="mt-3 text-2xl font-bold text-emerald-700 dark:text-emerald-400 sm:text-3xl">
              {institutionName}
            </h1>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300 sm:text-base">Exam Permit Portal</p>
          </div>
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300 sm:text-base">Log in to your account</p>
          </div>
          {configError && (
            <div className="rounded-lg border border-amber-200 bg-amber-100 p-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200 sm:p-4">
              {configError}
            </div>
          )}

          {resetMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-100 p-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200 sm:p-4">
              {resetMessage}
            </div>
          )}
          {!showResetForm ? (
            <form className="mt-6 space-y-4 sm:mt-8 sm:space-y-6" onSubmit={handleLogin}>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  Email, Phone, or Registration No.
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  </div>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    required
                    className="block w-full rounded-md border border-emerald-200 bg-emerald-50/40 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-emerald-900/60 dark:bg-slate-900/80 dark:text-white sm:py-2 sm:pl-10 sm:text-base"
                    placeholder="Student email or registration number"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  Password
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="block w-full rounded-md border border-emerald-200 bg-emerald-50/40 py-2 pl-9 pr-10 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-emerald-900/60 dark:bg-slate-900/80 dark:text-white sm:py-2 sm:pl-10 sm:text-base"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    title={showPassword ? 'Hide characters' : 'Show characters'}
                    aria-label={showPassword ? 'Hide characters' : 'Show characters'}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-500 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-100"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowResetForm(true)
                  setError('')
                  setResetMessage('')
                  setResetIdentifier(identifier)
                }}
                className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
              >
                Forgot password?
              </button>
            </div>
            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || Boolean(configError)}
                className={`flex w-full justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-slate-950 sm:py-2 sm:text-base ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in'
                )}
              </button>
              {backendProvider === 'rest' && !configError && oidcAvailable ? (
                <a
                  href={`${publicApiBaseUrl}/auth/oidc/start`}
                  className="flex w-full justify-center rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-100 dark:hover:bg-slate-800 sm:py-2 sm:text-base"
                >
                  Sign in with university
                </a>
              ) : null}
            </div>
            </form>
          ) : (
            <form className="mt-6 space-y-4 sm:mt-8 sm:space-y-5" onSubmit={handleResetPassword}>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              Enter your main login detail, then confirm with a second registered detail such as your email, phone number, or registration number.
            </div>
            <div>
              <label htmlFor="reset-identifier" className="block text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Account identifier
              </label>
              <input
                id="reset-identifier"
                type="text"
                required
                value={resetIdentifier}
                onChange={(e) => setResetIdentifier(e.target.value)}
                placeholder="Email, phone number, or registration number"
                className="mt-1 block w-full rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-emerald-900/60 dark:bg-slate-900/80 dark:text-white sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="reset-verification" className="block text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Second registered detail
              </label>
              <input
                id="reset-verification"
                type="text"
                required
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                placeholder="Use another saved email, phone, or registration detail"
                className="mt-1 block w-full rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-emerald-900/60 dark:bg-slate-900/80 dark:text-white sm:text-base"
              />
            </div>
            <div>
              <label htmlFor="reset-new-password" className="block text-sm font-medium text-emerald-900 dark:text-emerald-100">
                New password
              </label>
              <div className="relative mt-1">
                <input
                  id="reset-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. Permit@2027"
                  className="block w-full rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-2 pr-10 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-emerald-900/60 dark:bg-slate-900/80 dark:text-white sm:text-base"
                />
                <button
                  type="button"
                  title={showNewPassword ? 'Hide characters' : 'Show characters'}
                  aria-label={showNewPassword ? 'Hide characters' : 'Show characters'}
                  onClick={() => setShowNewPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-500 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-100"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">Use uppercase, lowercase, number, and special character. Example: Permit@2027</p>
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Confirm new password
              </label>
              <div className="relative mt-1">
                <input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  className="block w-full rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-2 pr-10 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-emerald-500 dark:border-emerald-900/60 dark:bg-slate-900/80 dark:text-white sm:text-base"
                />
                <button
                  type="button"
                  title={showConfirmPassword ? 'Hide characters' : 'Show characters'}
                  aria-label={showConfirmPassword ? 'Hide characters' : 'Show characters'}
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-500 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-100"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowResetForm(false)
                  setError('')
                }}
                className="flex-1 rounded-md border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-200 dark:hover:bg-slate-900"
              >
                Back to sign in
              </button>
              <button
                type="submit"
                disabled={resettingPassword || Boolean(configError)}
                className={`flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 ${resettingPassword ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {resettingPassword ? 'Resetting...' : 'Reset password'}
              </button>
            </div>
            </form>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
  
