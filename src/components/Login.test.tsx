import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import Login from './Login'

const { signIn } = vi.hoisted(() => ({
  signIn: vi.fn().mockResolvedValue({ role: 'student' }),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    signIn,
    configError: null,
  }),
}))

describe('Login', () => {
  it('submits the entered credentials through the auth provider', async () => {
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
  })
})