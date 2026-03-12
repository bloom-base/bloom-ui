import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  loginWithEmail: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  redirectToGitHubAuth: vi.fn(),
}))

import LoginPage from './page'
import * as api from '@/lib/api'
import { redirectToGitHubAuth } from '@/lib/auth'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('renders login form with email and password fields', () => {
    render(<LoginPage />)

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders sign in button', () => {
    render(<LoginPage />)

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('renders GitHub OAuth button', () => {
    render(<LoginPage />)

    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument()
  })

  it('renders forgot password link', () => {
    render(<LoginPage />)

    expect(screen.getByText('Forgot password?')).toBeInTheDocument()
  })

  it('renders sign up link', () => {
    render(<LoginPage />)

    expect(screen.getByText('Sign up')).toBeInTheDocument()
  })

  it('shows error on failed login', async () => {
    vi.mocked(api.loginWithEmail).mockRejectedValue(new Error('Invalid credentials'))

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    })
  })

  it('calls redirectToGitHubAuth when GitHub button clicked', () => {
    render(<LoginPage />)

    fireEvent.click(screen.getByText('Continue with GitHub'))

    expect(redirectToGitHubAuth).toHaveBeenCalledWith('/explore')
  })

  it('renders bloom branding', () => {
    render(<LoginPage />)

    expect(screen.getByText('bloom')).toBeInTheDocument()
  })

  // --- New tests ---

  it('successful login flow - loginWithEmail succeeds, sets session cookie, redirects to /explore', async () => {
    vi.mocked(api.loginWithEmail).mockResolvedValue({ access_token: 'test-token' })
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(api.loginWithEmail).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' })
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: 'test-token' }),
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/explore')
    })
  })

  it('shows loading state - button displays "Signing in..." while form is submitting', async () => {
    let resolveLogin: (value: { access_token: string }) => void
    vi.mocked(api.loginWithEmail).mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve })
    )

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Signing in...' })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled()

    // Resolve to clean up the pending promise
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)
    resolveLogin!({ access_token: 'test-token' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    })
  })

  it('forgot password link has correct href (/auth/forgot-password)', () => {
    render(<LoginPage />)

    const forgotLink = screen.getByText('Forgot password?')
    expect(forgotLink.closest('a')).toHaveAttribute('href', '/auth/forgot-password')
  })

  it('sign up link has correct href (/auth/register)', () => {
    render(<LoginPage />)

    const signUpLink = screen.getByText('Sign up')
    expect(signUpLink.closest('a')).toHaveAttribute('href', '/auth/register')
  })

  it('bloom logo link has correct href (/)', () => {
    render(<LoginPage />)

    const bloomLink = screen.getByText('bloom')
    expect(bloomLink.closest('a')).toHaveAttribute('href', '/')
  })

  it('does not call loginWithEmail when email is empty', async () => {
    render(<LoginPage />)

    // Only fill password, leave email empty
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    // HTML5 required attribute prevents form submission — API should NOT be called
    expect(api.loginWithEmail).not.toHaveBeenCalled()
  })

  it('does not call loginWithEmail when password is empty', async () => {
    render(<LoginPage />)

    // Only fill email, leave password empty
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    // HTML5 required attribute prevents form submission — API should NOT be called
    expect(api.loginWithEmail).not.toHaveBeenCalled()
  })

  it('redirects to default /explore after successful login when no returnTo param', async () => {
    vi.mocked(api.loginWithEmail).mockResolvedValue({ access_token: 'tok' })
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/explore')
    })
  })

  it('clears previous error when submitting again', async () => {
    // First attempt: fail
    vi.mocked(api.loginWithEmail).mockRejectedValueOnce(new Error('Invalid credentials'))

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
    })

    // Second attempt: succeed — error should be cleared during submission
    vi.mocked(api.loginWithEmail).mockResolvedValueOnce({ access_token: 'tok' })
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correctpass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('displays generic error when non-Error exception is thrown', async () => {
    vi.mocked(api.loginWithEmail).mockRejectedValue('network failure')

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Login failed')
    })
  })

  it('GitHub OAuth button passes returnTo to redirectToGitHubAuth', () => {
    render(<LoginPage />)

    fireEvent.click(screen.getByText('Continue with GitHub'))

    // Default returnTo is /explore
    expect(redirectToGitHubAuth).toHaveBeenCalledWith('/explore')
  })

  it('email input has correct type="email" for browser validation', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
  })

  it('password input has type="password" to mask characters', () => {
    render(<LoginPage />)

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('re-enables submit button after failed login attempt', async () => {
    vi.mocked(api.loginWithEmail).mockRejectedValue(new Error('Bad request'))

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    // Wait for error to appear (loading is done)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Button should be re-enabled after error
    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled()
  })

  it('session cookie failure - fetch set-session fails, shows error', async () => {
    vi.mocked(api.loginWithEmail).mockResolvedValue({ access_token: 'test-token' })
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response)

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to set session')
    })

    // Should NOT have redirected
    expect(mockPush).not.toHaveBeenCalled()
  })
})
