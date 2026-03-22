import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => useAuth(),
}))

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to the login page', () => {
    useAuth.mockReturnValue({ user: null, loading: false })

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

    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})