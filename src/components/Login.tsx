
import { FormEvent, useState } from 'react'
import { Lock, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BrandMark from './BrandMark'
import { backendProvider } from '../config/provider'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, configError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const accountProviderLabel = backendProvider === 'rest' ? 'your connected account' : 'your account'

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const user = await signIn(email, password)
      navigate(user.role === 'admin' ? '/admin' : '/student', { replace: true })
    } catch (signInError) {
      const nextError = signInError instanceof Error ? signInError.message : 'Unable to sign in'
      setError(nextError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-8 sm:px-6 lg:px-8 bg-gradient-to-br from-green-100 via-emerald-50 to-lime-100">
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 sm:space-y-8 bg-white/95 rounded-2xl shadow-lg border border-emerald-200">
        <div className="text-center">
          <BrandMark
            align="center"
            titleClassName="text-2xl sm:text-3xl font-bold text-emerald-950"
            subtitleClassName="text-sm sm:text-base text-emerald-700"
          />
          <p className="mt-3 text-sm sm:text-base text-emerald-700">Sign in with {accountProviderLabel}</p>
        </div>
        {configError && (
          <div className="p-3 sm:p-4 text-sm text-amber-800 bg-amber-100 rounded-lg border border-amber-200">
            {configError}
          </div>
        )}
        {error && (
          <div className="p-3 sm:p-4 text-sm text-red-700 bg-red-100 rounded-lg border border-red-200">
            {error}
          </div>
        )}
        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleLogin}>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-emerald-900">
                Email or Registration No.
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2 border border-emerald-200 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base bg-emerald-50/40"
                  placeholder="name@university.edu or REG-001"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-emerald-900">
                Password
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2 border border-emerald-200 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 text-sm sm:text-base bg-emerald-50/40"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading || Boolean(configError)}
              className={`w-full flex justify-center py-2 sm:py-2 px-4 border border-transparent rounded-md shadow-sm text-sm sm:text-base font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''} transition-colors`}
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
          </div>
        </form>
        <div className="text-xs text-emerald-800 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
          Use the credentials from your configured backend. Profiles and roles are loaded from the active data provider.
        </div>
      </div>
    </div>
  )
}
  