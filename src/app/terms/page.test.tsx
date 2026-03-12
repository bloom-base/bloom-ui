import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import TermsPage from './page'

describe('TermsPage', () => {
  it('renders Terms of Service heading', () => {
    render(<TermsPage />)

    expect(screen.getByText('Terms of Service')).toBeInTheDocument()
  })

  it('renders all section headings', () => {
    render(<TermsPage />)

    expect(screen.getByText('1. Acceptance of Terms')).toBeInTheDocument()
    expect(screen.getByText('2. Description of Service')).toBeInTheDocument()
    expect(screen.getByText('3. Account Registration')).toBeInTheDocument()
  })

  it('shows last updated date', () => {
    render(<TermsPage />)

    expect(screen.getByText(/Last updated/)).toBeInTheDocument()
  })
})
