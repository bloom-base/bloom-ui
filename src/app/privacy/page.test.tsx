import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import PrivacyPage from './page'

describe('PrivacyPage', () => {
  it('renders Privacy Policy heading', () => {
    render(<PrivacyPage />)

    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })

  it('renders key sections', () => {
    render(<PrivacyPage />)

    expect(screen.getByText('1. Information We Collect')).toBeInTheDocument()
  })

  it('shows last updated date', () => {
    render(<PrivacyPage />)

    expect(screen.getAllByText(/Last updated/).length).toBeGreaterThanOrEqual(1)
  })
})
