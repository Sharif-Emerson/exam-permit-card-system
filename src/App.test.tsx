import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}))

vi.mock('./context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('./context/AuthContext')>('./context/AuthContext')

  return {
    ...actual,
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    useAuth: mockUseAuth,
  }
})

vi.mock('./components/Login', () => ({
  default: () => <div>Login Screen</div>,
}))

vi.mock('./components/Dashboard', () => ({
  default: () => <div>Student Dashboard</div>,
}))

vi.mock('./components/AdminPanel', () => ({
  default: () => <div>Admin Panel</div>,
}))

describe('App', () => {
  it('redirects unauthenticated users to the login route', async () => {
    window.history.pushState({}, '', '/')
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
    })

    const { default: App } = await import('./App')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Login Screen')).toBeTruthy()
    })
  })

  it('redirects an authenticated admin from the login route to the admin panel', async () => {
    window.history.pushState({}, '', '/login')
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin', name: 'Administrator' },
      loading: false,
      configError: null,
      signIn: vi.fn(),
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn(),
    })

    const { default: App } = await import('./App')
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeTruthy()
    })
  })
})