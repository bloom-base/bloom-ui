import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('token=verify-token-123'),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  verifyEmail: vi.fn(),
}))

import VerifyEmailPage from './page'
import * as api from '@/lib/api'

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    vi.mocked(api.verifyEmail).mockReturnValue(new Promise(() => {}))

    render(<VerifyEmailPage />)

    expect(screen.getByText('Verifying your email...')).toBeInTheDocument()
  })

  it('shows success after verification', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValue({ message: 'Email verified successfully' })

    render(<VerifyEmailPage />)

    await waitFor(() => {
      expect(screen.getByText('Email verified')).toBeInTheDocument()
    })
    expect(screen.getByText('Continue to Bloom')).toBeInTheDocument()
  })

  it('shows error on failed verification', async () => {
    vi.mocked(api.verifyEmail).mockRejectedValue(new Error('Token expired'))

    render(<VerifyEmailPage />)

    await waitFor(() => {
      expect(screen.getByText('Verification failed')).toBeInTheDocument()
    })
    expect(screen.getByText('Token expired')).toBeInTheDocument()
    expect(screen.getByText('Back to sign in')).toBeInTheDocument()
  })

  it('renders bloom branding', () => {
    vi.mocked(api.verifyEmail).mockReturnValue(new Promise(() => {}))

    render(<VerifyEmailPage />)

    expect(screen.getByText('bloom')).toBeInTheDocument()
  })
})
