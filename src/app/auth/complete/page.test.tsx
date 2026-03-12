import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('returnTo=/profile'),
}))

import AuthCompletePage from './page'

describe('AuthCompletePage', () => {
  it('renders completion spinner', () => {
    render(<AuthCompletePage />)

    expect(screen.getByText('Completing sign in...')).toBeInTheDocument()
  })

  it('redirects to returnTo parameter', () => {
    render(<AuthCompletePage />)

    expect(mockReplace).toHaveBeenCalledWith('/profile')
  })
})
