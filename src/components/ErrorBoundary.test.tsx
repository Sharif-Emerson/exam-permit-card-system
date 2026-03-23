import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function ThrowingChild() {
  throw new Error('Permit application failed')
}

describe('ErrorBoundary', () => {
  it('renders child content when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>Healthy content</div>
      </ErrorBoundary>,
    )

    expect(screen.getByText('Healthy content')).toBeTruthy()
  })

  it('shows the fallback UI and refresh action when a child throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reloadSpy = vi.fn()
    const originalLocation = window.location

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        reload: reloadSpy,
      },
    })

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Permit application failed')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /refresh page/i }))
    expect(reloadSpy).toHaveBeenCalled()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
    consoleErrorSpy.mockRestore()
  })
})