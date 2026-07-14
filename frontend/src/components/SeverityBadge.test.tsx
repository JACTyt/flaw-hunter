import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SeverityBadge } from './SeverityBadge'

describe('SeverityBadge', () => {
  it('renders severity label', () => {
    render(<SeverityBadge severity="critical" />)
    expect(screen.getByText('critical')).toBeInTheDocument()
  })

  it('applies red background class for critical', () => {
    const { container } = render(<SeverityBadge severity="critical" />)
    expect(container.firstChild).toHaveClass('bg-red-100')
  })

  it('renders info severity with blue class', () => {
    const { container } = render(<SeverityBadge severity="info" />)
    expect(container.firstChild).toHaveClass('bg-blue-100')
  })
})
