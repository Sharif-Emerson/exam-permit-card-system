
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const { getSession, onAuthStateChange, signInWithPassword, signOut, fetchProfileById } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  fetchProfileById: vi.fn(),
}))

vi.mock('../supabaseClient', () => ({
  isSupabaseConfigured: true,
  assertSupabaseConfigured: vi.fn(),
  supabase: {
    auth: {
      getSession,
      onAuthStateChange,
      signInWithPassword,
      signOut,
    },
  },
}))

vi.mock('../services/profileService', () => ({
  fetchProfileById,
}))

function Consumer() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading</div>
  }

  return <div>{user ? `${user.name}:${user.role}` : 'No session'}</div>
}

describe('AuthProvider', () => {
  it('restores the session from Supabase on startup', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: 'student-id' } } },
      error: null,
    })
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
    fetchProfileById.mockResolvedValue({
      id: 'student-id',
      email: 'student@example.com',
      role: 'student',
      name: 'John Doe',
    })

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('John Doe:student')).toBeInTheDocument()
    })
  })
})