import { render, screen } from '@testing-library/react'
import BrandMark from './BrandMark'
import { institutionName } from '../config/branding'

describe('BrandMark', () => {
  it('renders the product title and subtitle', () => {
    render(<BrandMark />)

    expect(screen.getByText(institutionName)).toBeTruthy()
    expect(screen.getByText('Secure examination permit portal')).toBeTruthy()
  })

  it('applies centered alignment classes when requested', () => {
    const { container } = render(<BrandMark align="center" />)

    expect(container.firstChild).toHaveClass('justify-center')
    expect(container.firstChild).toHaveClass('text-center')
  })
})