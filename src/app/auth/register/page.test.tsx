import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

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
  registerWithEmail: vi.fn(),
  checkUsernameAvailable: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  redirectToGitHubAuth: vi.fn(),
}))

import RegisterPage from './page'
import * as api from '@/lib/api'
import { redirectToGitHubAuth } from '@/lib/auth'

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset global.fetch mock between tests
    vi.restoreAllMocks()
  })

  it('renders registration form', () => {
    render(<RegisterPage />)

    expect(screen.getByText('Create your account')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders optional name field', () => {
    render(<RegisterPage />)

    expect(screen.getByLabelText(/Name/)).toBeInTheDocument()
  })

  it('renders optional username field', () => {
    render(<RegisterPage />)

    expect(screen.getByLabelText(/Username/)).toBeInTheDocument()
  })

  it('renders create account button', () => {
    render(<RegisterPage />)

    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('renders GitHub OAuth button', () => {
    render(<RegisterPage />)

    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument()
  })

  it('renders sign in link for existing users', () => {
    render(<RegisterPage />)

    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('renders Terms and Privacy links', () => {
    render(<RegisterPage />)

    expect(screen.getByText('Terms')).toBeInTheDocument()
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
  })

  it('shows error on failed registration', async () => {
    vi.mocked(api.registerWithEmail).mockRejectedValue(new Error('Email already registered'))

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already registered')
    })
  })

  it('calls redirectToGitHubAuth when GitHub button clicked', () => {
    render(<RegisterPage />)

    fireEvent.click(screen.getByText('Continue with GitHub'))

    expect(redirectToGitHubAuth).toHaveBeenCalledWith('/explore')
  })

  it('renders bloom branding', () => {
    render(<RegisterPage />)

    expect(screen.getByText('bloom')).toBeInTheDocument()
  })

  // --- New tests ---

  it('successful registration flow - registerWithEmail succeeds, sets session, redirects', async () => {
    vi.mocked(api.registerWithEmail).mockResolvedValue({
      access_token: 'test-token-123',
      token_type: 'bearer',
    } as never)

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newuser@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(api.registerWithEmail).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'StrongPass1!',
        display_name: undefined,
        username: undefined,
      })
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: 'test-token-123' }),
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/explore')
    })
  })

  it('shows "Creating account..." loading state during submission', async () => {
    // Make registerWithEmail hang so we can observe loading state
    let resolveRegister: (value: unknown) => void
    vi.mocked(api.registerWithEmail).mockImplementation(
      () => new Promise((resolve) => { resolveRegister = resolve })
    )

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Creating account...' })).toBeInTheDocument()
    })

    // Resolve to clean up
    resolveRegister!({ access_token: 'tok', token_type: 'bearer' })
  })

  it('shows password validation error for too-short password on submit', async () => {
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Ab1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters.')
    })

    // Should NOT call the API
    expect(api.registerWithEmail).not.toHaveBeenCalled()
  })

  it('shows password validation error for missing uppercase on submit', async () => {
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'lowercase1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Password must contain at least one uppercase letter.')
    })

    expect(api.registerWithEmail).not.toHaveBeenCalled()
  })

  it('shows inline password hint while typing a weak password', () => {
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })

    const hint = screen.getByText('Password must be at least 8 characters.')
    expect(hint).toBeInTheDocument()
    expect(hint.id).toBe('password-hint')
  })

  it('does not show inline password hint when password is strong', () => {
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })

    expect(screen.queryByText(/Password must/)).not.toBeInTheDocument()
  })

  it('triggers username availability check on blur', async () => {
    vi.mocked(api.checkUsernameAvailable).mockResolvedValue({
      username: 'testuser',
      available: true,
      error: null,
    })

    render(<RegisterPage />)

    const usernameInput = screen.getByLabelText(/Username/)
    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.blur(usernameInput)

    await waitFor(() => {
      expect(api.checkUsernameAvailable).toHaveBeenCalledWith('testuser')
    })
  })

  it('shows "available" status when username is available', async () => {
    vi.mocked(api.checkUsernameAvailable).mockResolvedValue({
      username: 'goodname',
      available: true,
      error: null,
    })

    render(<RegisterPage />)

    const usernameInput = screen.getByLabelText(/Username/)
    fireEvent.change(usernameInput, { target: { value: 'goodname' } })
    fireEvent.blur(usernameInput)

    await waitFor(() => {
      expect(screen.getByText('available')).toBeInTheDocument()
    })

    // The "available" status element should have role="status"
    const statusEl = screen.getByText('available')
    expect(statusEl).toHaveAttribute('role', 'status')
  })

  it('shows error when username is taken', async () => {
    vi.mocked(api.checkUsernameAvailable).mockResolvedValue({
      username: 'takenuser',
      available: false,
      error: 'Username taken',
    })

    render(<RegisterPage />)

    const usernameInput = screen.getByLabelText(/Username/)
    fireEvent.change(usernameInput, { target: { value: 'takenuser' } })
    fireEvent.blur(usernameInput)

    await waitFor(() => {
      expect(screen.getByText('Username taken')).toBeInTheDocument()
    })
  })

  it('does not trigger username check for short usernames (< 3 chars)', async () => {
    render(<RegisterPage />)

    const usernameInput = screen.getByLabelText(/Username/)
    fireEvent.change(usernameInput, { target: { value: 'ab' } })
    fireEvent.blur(usernameInput)

    // Give it a moment to confirm it does NOT call the API
    await waitFor(() => {
      expect(api.checkUsernameAvailable).not.toHaveBeenCalled()
    })
  })

  it('sign in link has correct href /auth/login', () => {
    render(<RegisterPage />)

    const signInLink = screen.getByText('Sign in')
    expect(signInLink).toHaveAttribute('href', '/auth/login')
  })

  it('Terms link has correct href /terms', () => {
    render(<RegisterPage />)

    const termsLink = screen.getByText('Terms')
    expect(termsLink).toHaveAttribute('href', '/terms')
  })

  it('Privacy Policy link has correct href /privacy', () => {
    render(<RegisterPage />)

    const privacyLink = screen.getByText('Privacy Policy')
    expect(privacyLink).toHaveAttribute('href', '/privacy')
  })

  it('blocks submission when username is entered but not available', async () => {
    vi.mocked(api.checkUsernameAvailable).mockResolvedValue({
      username: 'takenuser',
      available: false,
      error: 'Username taken',
    })

    render(<RegisterPage />)

    // Enter username and trigger check
    const usernameInput = screen.getByLabelText(/Username/)
    fireEvent.change(usernameInput, { target: { value: 'takenuser' } })
    fireEvent.blur(usernameInput)

    await waitFor(() => {
      expect(screen.getByText('Username taken')).toBeInTheDocument()
    })

    // Fill in required fields
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })

    // Button should be disabled when username is taken
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()

    // Should NOT call the API
    expect(api.registerWithEmail).not.toHaveBeenCalled()
  })

  it('shows password validation error for missing lowercase on submit', async () => {
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'UPPERCASE1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Password must contain at least one lowercase letter.')
    })

    expect(api.registerWithEmail).not.toHaveBeenCalled()
  })

  it('shows password validation error for missing number on submit', async () => {
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Password must contain at least one number.')
    })

    expect(api.registerWithEmail).not.toHaveBeenCalled()
  })

  it('does not call registerWithEmail when email is empty', async () => {
    render(<RegisterPage />)

    // Fill password but not email
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    // HTML5 required attribute prevents form submission
    expect(api.registerWithEmail).not.toHaveBeenCalled()
  })

  it('email input has type="email" for browser-level format validation', () => {
    render(<RegisterPage />)

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
  })

  it('successful registration with optional name and username fields', async () => {
    vi.mocked(api.checkUsernameAvailable).mockResolvedValue({
      username: 'janedoe',
      available: true,
      error: null,
    })
    vi.mocked(api.registerWithEmail).mockResolvedValue({
      access_token: 'token-456',
      token_type: 'bearer',
    } as never)
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })

    const usernameInput = screen.getByLabelText(/Username/)
    fireEvent.change(usernameInput, { target: { value: 'janedoe' } })
    fireEvent.blur(usernameInput)

    await waitFor(() => {
      expect(screen.getByText('available')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(api.registerWithEmail).toHaveBeenCalledWith({
        email: 'jane@example.com',
        password: 'StrongPass1!',
        display_name: 'Jane Doe',
        username: 'janedoe',
      })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/explore')
    })
  })

  it('submit button is disabled during loading state', async () => {
    let resolveRegister: (value: unknown) => void
    vi.mocked(api.registerWithEmail).mockImplementation(
      () => new Promise((resolve) => { resolveRegister = resolve })
    )

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'Creating account...' })
      expect(btn).toBeDisabled()
    })

    // Resolve to clean up
    resolveRegister!({ access_token: 'tok', token_type: 'bearer' })
  })

  it('clears previous error when submitting again', async () => {
    // First attempt: fail
    vi.mocked(api.registerWithEmail).mockRejectedValueOnce(new Error('Email already registered'))

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already registered')
    })

    // Second attempt: succeed — error should clear
    vi.mocked(api.registerWithEmail).mockResolvedValueOnce({
      access_token: 'tok',
      token_type: 'bearer',
    } as never)
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response)

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  it('displays generic error when non-Error exception is thrown', async () => {
    vi.mocked(api.registerWithEmail).mockRejectedValue('network failure')

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Registration failed')
    })
  })

  it('re-enables submit button after failed registration', async () => {
    vi.mocked(api.registerWithEmail).mockRejectedValue(new Error('Server error'))

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Button should be re-enabled after error
    expect(screen.getByRole('button', { name: 'Create account' })).not.toBeDisabled()
  })

  it('shows "please choose an available username" error when username entered but not checked', async () => {
    render(<RegisterPage />)

    // Type a username but do NOT blur to trigger the check
    const usernameInput = screen.getByLabelText(/Username/)
    fireEvent.change(usernameInput, { target: { value: 'newuser' } })
    // usernameStatus remains 'idle', but username is non-empty

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    // The component checks: username && usernameStatus !== 'available'
    // Since status is 'idle' and username is set, it should show an error
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please choose an available username.')
    })

    expect(api.registerWithEmail).not.toHaveBeenCalled()
  })

  it('username input sanitizes to lowercase alphanumeric and hyphens only', () => {
    render(<RegisterPage />)

    const usernameInput = screen.getByLabelText(/Username/)
    fireEvent.change(usernameInput, { target: { value: 'User_Name.123!' } })

    // The onChange strips non-lowercase-alphanumeric-hyphen chars and lowercases
    expect(usernameInput).toHaveValue('username123')
  })

  it('password input has minLength=8 attribute', () => {
    render(<RegisterPage />)

    expect(screen.getByLabelText('Password')).toHaveAttribute('minLength', '8')
  })

  it('shows auto-generated hint when username is blank', () => {
    render(<RegisterPage />)

    expect(screen.getByText('Auto-generated from email if left blank.')).toBeInTheDocument()
  })

  it('hides auto-generated hint when username has a value', () => {
    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: 'myuser' } })

    expect(screen.queryByText('Auto-generated from email if left blank.')).not.toBeInTheDocument()
  })

  it('GitHub OAuth button passes default returnTo /explore', () => {
    render(<RegisterPage />)

    fireEvent.click(screen.getByText('Continue with GitHub'))

    expect(redirectToGitHubAuth).toHaveBeenCalledWith('/explore')
  })

  it('shows error when set-session fetch fails', async () => {
    vi.mocked(api.registerWithEmail).mockResolvedValue({
      access_token: 'test-token',
      token_type: 'bearer',
    } as never)

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    render(<RegisterPage />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to set session')
    })

    // Should NOT redirect
    expect(mockPush).not.toHaveBeenCalled()
  })
})
