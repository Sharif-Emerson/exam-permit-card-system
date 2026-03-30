import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to the login page', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn().mockResolvedValue(undefined),
    })

    const { default: ProtectedRoute } = await import('./ProtectedRoute')

    render(
      <MemoryRouter initialEntries={['/student']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/student"
            element={
              <ProtectedRoute requiredRole="student">
                <div>Student Area</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Login Page')).toBeTruthy()
  })

  it('redirects authenticated users without the required role', async () => {
    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: { id: 'student-1', email: 'student@example.com', role: 'student', name: 'John Doe' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn().mockResolvedValue(undefined),
    })

    const { default: ProtectedRoute } = await import('./ProtectedRoute')

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/student" element={<div>Student Dashboard</div>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <div>Admin Area</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Student Dashboard')).toBeTruthy()
  })
})