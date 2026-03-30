import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, vi } from 'vitest'
import { institutionName } from '../config/branding'

const { signIn } = vi.hoisted(() => ({
  signIn: vi.fn().mockResolvedValue({ role: 'student' }),
}))

describe('Login', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits the entered credentials through the auth provider', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.includes('/auth/oidc/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ enabled: false }),
        } as Response)
      }
      return Promise.resolve({ ok: false, status: 404 } as Response)
    })

    const authContextModule = await import('../context/AuthContext')
    vi.spyOn(authContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      configError: null,
      signIn,
      signInWithToken: vi.fn(),
      signOut: vi.fn(),
      refreshUser: vi.fn().mockResolvedValue(undefined),
    })

    const { default: Login } = await import('./Login')
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/email/i), 'student@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(signIn).toHaveBeenCalledWith('student@example.com', 'password123')
    expect(screen.getAllByText(institutionName)).toHaveLength(1)
  })
})