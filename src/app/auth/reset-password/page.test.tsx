import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('token=test-token-123'),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  resetPassword: vi.fn(),
}))

import ResetPasswordPage from './page'
import * as api from '@/lib/api'

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders reset password form with token', () => {
    render(<ResetPasswordPage />)

    expect(screen.getByText('Choose a new password')).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeInTheDocument()
  })

  it('renders bloom branding', () => {
    render(<ResetPasswordPage />)

    expect(screen.getByText('bloom')).toBeInTheDocument()
  })

  it('shows error on failed reset', async () => {
    vi.mocked(api.resetPassword).mockRejectedValue(new Error('Token expired'))

    render(<ResetPasswordPage />)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'NewPass123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Token expired')
    })
  })

  it('shows success after reset', async () => {
    vi.mocked(api.resetPassword).mockResolvedValue(undefined as any)

    render(<ResetPasswordPage />)

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'NewPass123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))

    await waitFor(() => {
      expect(screen.getByText('Password reset')).toBeInTheDocument()
    })
    expect(screen.getByText('Your password has been updated successfully.')).toBeInTheDocument()
  })
})

