import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  forgotPassword: vi.fn(),
}))

import ForgotPasswordPage from './page'
import * as api from '@/lib/api'

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders forgot password form', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByText('Reset your password')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument()
  })

  it('renders bloom branding', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByText('bloom')).toBeInTheDocument()
  })

  it('renders back to sign in link', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByText('Back to sign in')).toBeInTheDocument()
  })

  it('shows success message after submission', async () => {
    vi.mocked(api.forgotPassword).mockResolvedValue(undefined as any)

    render(<ForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument()
    })
    expect(screen.getByText(/we sent a password reset link/)).toBeInTheDocument()
  })

  it('shows error on failure', async () => {
    vi.mocked(api.forgotPassword).mockRejectedValue(new Error('Rate limited'))

    render(<ForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Rate limited')
    })
  })
})
