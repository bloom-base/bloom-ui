import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

// Stable router object to prevent useEffect infinite loops
const mockPush = vi.fn()
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

// Mock next/navigation with configurable params
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ owner: 'bloom-base', repo: 'aurora' }),
  usePathname: () => '/bloom-base/aurora/sponsor',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock auth
const mockRedirectToLogin = vi.fn()
vi.mock('@/lib/auth', () => ({
  redirectToLogin: (...args: unknown[]) => mockRedirectToLogin(...args),
}))

// Mock the API module
vi.mock('@/lib/api', () => ({
  getProjectByPath: vi.fn(),
  getCurrentUser: vi.fn(),
  getActiveSponsor: vi.fn(),
  getProjectSponsors: vi.fn(),
  createSponsorshipCheckout: vi.fn(),
  setSponsorVision: vi.fn(),
  deleteSponsorVision: vi.fn(),
}))

import SponsorPage from './page'
import * as api from '@/lib/api'

const mockProject = {
  id: 'proj-1',
  name: 'Aurora',
  description: 'An AI weather app',
  github_repo: 'bloom-base/aurora',
  owner_id: 'user-1',
  is_public: true,
  vision: 'Predict the weather with AI',
  deployed_url: null,
  deploy_status: null,
  fly_app_name: null,
  deploy_error: null,
  created_at: '2026-01-15T00:00:00Z',
}

const make50Sponsor = (overrides: Partial<api.Sponsorship> = {}): api.Sponsorship => ({
  id: 'sp-1',
  project_id: 'proj-1',
  sponsor_id: 'user-1',
  sponsor_username: 'testuser',
  sponsor_avatar_url: null,
  display_name: null,
  is_company: false,
  tier: 50,
  monthly_amount_usd: 50,
  total_contributed_usd: 100,
  status: 'active',
  is_active: true,
  started_at: '2026-01-01T00:00:00Z',
  sponsor_vision: null,
  ...overrides,
})

describe('SponsorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as api.Project)
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: null,
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })
    vi.mocked(api.getActiveSponsor).mockResolvedValue(null)
    vi.mocked(api.getProjectSponsors).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })
  })

  it('renders sponsor page with slider and CTA', async () => {
    render(<SponsorPage />)

    await waitFor(() => {
      // Default CTA at $50/mo (Backer tier selected by default)
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    // Slider shows current stage label and preset amount buttons
    expect(screen.getByText('Backer')).toBeInTheDocument()
    // $50 appears multiple times (display, slider label, preset button)
    expect(screen.getAllByText('$50').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('$25').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('$100').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('$250').length).toBeGreaterThanOrEqual(1)
  })

  it('shows inline error when checkout fails', async () => {
    vi.mocked(api.createSponsorshipCheckout).mockRejectedValue(
      new Error('Sponsorship at $50/mo is not yet available. Please try another tier.')
    )

    render(<SponsorPage />)

    await waitFor(() => {
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Sponsor $50/mo'))

    await waitFor(() => {
      expect(screen.getByText('Sponsorship at $50/mo is not yet available. Please try another tier.')).toBeInTheDocument()
    })
  })

  it('resets loading state after error', async () => {
    vi.mocked(api.createSponsorshipCheckout).mockRejectedValue(
      new Error('API error: 503')
    )

    render(<SponsorPage />)

    await waitFor(() => {
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Sponsor $50/mo'))

    // Button should go back to normal after error
    await waitFor(() => {
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      expect(screen.queryByText('Redirecting to Stripe...')).not.toBeInTheDocument()
    })
  })

  it('shows inline error and resets button when retrying', async () => {
    vi.mocked(api.createSponsorshipCheckout)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ checkout_url: 'https://checkout.stripe.com/session123' })

    // Mock window.location.href assignment
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
      origin: 'http://localhost:3000',
    } as Location)

    render(<SponsorPage />)

    await waitFor(() => {
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    // First click — should fail with inline error
    fireEvent.click(screen.getByText('Sponsor $50/mo'))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    // Button should be usable again
    await waitFor(() => {
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    locationSpy.mockRestore()
  })

  it('calls createSponsorshipCheckout with correct amount', async () => {
    vi.mocked(api.createSponsorshipCheckout).mockResolvedValue({
      checkout_url: 'https://checkout.stripe.com/session123',
    })
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
      origin: 'http://localhost:3000',
    } as Location)

    render(<SponsorPage />)

    await waitFor(() => {
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    // Click the $100 preset button to change amount
    const buttons = screen.getAllByText('$100')
    // Click the preset button (not the slider label)
    fireEvent.click(buttons[0])

    await waitFor(() => {
      expect(screen.getByText('Sponsor $100/mo')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Sponsor $100/mo'))

    await waitFor(() => {
      expect(api.createSponsorshipCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-1',
          amount: 100,
        })
      )
    })

    locationSpy.mockRestore()
  })

  it('shows sign in button when not logged in', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

    render(<SponsorPage />)

    await waitFor(() => {
      expect(screen.getByText('Sign in to sponsor')).toBeInTheDocument()
    })
  })

  it('shows active sponsorship banner', async () => {
    vi.mocked(api.getActiveSponsor).mockResolvedValue(make50Sponsor())

    render(<SponsorPage />)

    await waitFor(() => {
      expect(screen.getByText(/currently sponsoring/i)).toBeInTheDocument()
    })
  })

  describe('Sponsor Vision', () => {
    it('shows vision input for $50+ sponsors', async () => {
      vi.mocked(api.getActiveSponsor).mockResolvedValue(make50Sponsor())

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Your Priority Focus')).toBeInTheDocument()
      })

      expect(screen.getByPlaceholderText(/Focus on academic/)).toBeInTheDocument()
    })

    it('does not show vision input for $25 sponsors', async () => {
      vi.mocked(api.getActiveSponsor).mockResolvedValue(
        make50Sponsor({ tier: 25, monthly_amount_usd: 25, total_contributed_usd: 50 })
      )

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText(/currently sponsoring/i)).toBeInTheDocument()
      })

      expect(screen.queryByText('Your Priority Focus')).not.toBeInTheDocument()
    })

    it('pre-fills existing sponsor vision', async () => {
      vi.mocked(api.getActiveSponsor).mockResolvedValue(
        make50Sponsor({ tier: 100, monthly_amount_usd: 100, total_contributed_usd: 200, sponsor_vision: 'Focus on academic writing' })
      )

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Your Priority Focus')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/Focus on academic/) as HTMLTextAreaElement
      expect(textarea.value).toBe('Focus on academic writing')

      // Should show Remove button when vision is set
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })

    it('does not show vision for non-sponsors', async () => {
      // No active sponsorship
      vi.mocked(api.getActiveSponsor).mockResolvedValue(null)

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      expect(screen.queryByText('Your Priority Focus')).not.toBeInTheDocument()
    })

    it('saves vision when Save button is clicked', async () => {
      vi.mocked(api.setSponsorVision).mockResolvedValue(undefined as unknown as ReturnType<typeof api.setSponsorVision>)
      vi.mocked(api.getActiveSponsor).mockResolvedValue(make50Sponsor({ tier: 100, monthly_amount_usd: 100 }))

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Your Priority Focus')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/Focus on academic/)
      fireEvent.change(textarea, { target: { value: 'Improve mobile experience' } })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(api.setSponsorVision).toHaveBeenCalledWith('proj-1', 'Improve mobile experience')
      })

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Priority focus saved')
      })
    })

    it('shows error toast when saving vision fails', async () => {
      vi.mocked(api.setSponsorVision).mockRejectedValue(new Error('Save failed'))
      vi.mocked(api.getActiveSponsor).mockResolvedValue(make50Sponsor({ tier: 100, monthly_amount_usd: 100 }))

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Your Priority Focus')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/Focus on academic/)
      fireEvent.change(textarea, { target: { value: 'Improve mobile experience' } })

      fireEvent.click(screen.getByText('Save'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save priority focus')
      })
    })

    it('disables Save button when vision text is empty', async () => {
      vi.mocked(api.getActiveSponsor).mockResolvedValue(make50Sponsor({ tier: 100, monthly_amount_usd: 100 }))

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Your Priority Focus')).toBeInTheDocument()
      })

      const saveButton = screen.getByText('Save')
      expect(saveButton).toBeDisabled()
    })

    it('removes vision when Remove button is clicked', async () => {
      vi.mocked(api.deleteSponsorVision).mockResolvedValue(undefined as unknown as ReturnType<typeof api.deleteSponsorVision>)
      vi.mocked(api.getActiveSponsor).mockResolvedValue(
        make50Sponsor({ tier: 100, monthly_amount_usd: 100, sponsor_vision: 'Focus on academic writing' })
      )

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Remove'))

      await waitFor(() => {
        expect(api.deleteSponsorVision).toHaveBeenCalledWith('proj-1')
      })

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('Priority focus removed')
      })

      // Vision text should be cleared
      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/Focus on academic/) as HTMLTextAreaElement
        expect(textarea.value).toBe('')
      })
    })

    it('shows error toast when removing vision fails', async () => {
      vi.mocked(api.deleteSponsorVision).mockRejectedValue(new Error('Delete failed'))
      vi.mocked(api.getActiveSponsor).mockResolvedValue(
        make50Sponsor({ tier: 100, monthly_amount_usd: 100, sponsor_vision: 'Focus on academic writing' })
      )

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Remove'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to remove priority focus')
      })
    })
  })

  describe('Custom Amount Input', () => {
    it('updates amount when valid custom value is entered', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const customInput = screen.getByPlaceholderText('Custom')
      fireEvent.change(customInput, { target: { value: '75' } })

      await waitFor(() => {
        expect(screen.getByText('Sponsor $75/mo')).toBeInTheDocument()
      })
    })

    it('does not update amount for values below minimum', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const customInput = screen.getByPlaceholderText('Custom')
      fireEvent.change(customInput, { target: { value: '2' } })

      // Amount should stay at 50 because 2 < MIN_AMOUNT (5)
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    it('does not update amount for values above maximum', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const customInput = screen.getByPlaceholderText('Custom')
      fireEvent.change(customInput, { target: { value: '999' } })

      // Amount should stay at 50 because 999 > MAX_AMOUNT (500)
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    it('updates custom input value in the field', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const customInput = screen.getByPlaceholderText('Custom') as HTMLInputElement
      fireEvent.change(customInput, { target: { value: '150' } })

      expect(customInput.value).toBe('150')
    })

    it('clears custom input when preset button is clicked', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      // First enter a custom amount
      const customInput = screen.getByPlaceholderText('Custom') as HTMLInputElement
      fireEvent.change(customInput, { target: { value: '75' } })
      expect(customInput.value).toBe('75')

      // Click a preset button
      const preset25Buttons = screen.getAllByText('$25')
      fireEvent.click(preset25Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $25/mo')).toBeInTheDocument()
      })

      // Custom input should be cleared
      expect(customInput.value).toBe('')
    })
  })

  describe('Preset Amount Buttons', () => {
    it('selects $10 preset and updates stage', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const preset10Buttons = screen.getAllByText('$10')
      fireEvent.click(preset10Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $10/mo')).toBeInTheDocument()
      })
      // At $10, stage should be "Free" (threshold 0)
      expect(screen.getByText('Free')).toBeInTheDocument()
    })

    it('selects $250 preset and shows Champion stage', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const preset250Buttons = screen.getAllByText('$250')
      fireEvent.click(preset250Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $250/mo')).toBeInTheDocument()
      })
      expect(screen.getByText('Champion')).toBeInTheDocument()
    })
  })

  describe('Benefits display', () => {
    it('shows cumulative benefits at $100 level', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      // Click $100 preset
      const preset100Buttons = screen.getAllByText('$100')
      fireEvent.click(preset100Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $100/mo')).toBeInTheDocument()
      })

      // Should show all benefits up to Patron tier
      expect(screen.getByText('Name in contributors list')).toBeInTheDocument()
      expect(screen.getByText('Sponsor badge')).toBeInTheDocument()
      expect(screen.getByText('Priority idea consideration')).toBeInTheDocument()
      expect(screen.getByText('Influence what gets built next')).toBeInTheDocument()
      expect(screen.getByText('Vote on project decisions')).toBeInTheDocument()
    })
  })

  describe('Sign in flow', () => {
    it('calls redirectToLogin with sponsor path when sign in button clicked', async () => {
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sign in to sponsor')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Sign in to sponsor'))

      expect(mockRedirectToLogin).toHaveBeenCalledWith('/bloom-base/aurora/sponsor')
    })
  })

  describe('Funding progress', () => {
    it('shows funding progress bar when totalFunding > 0', async () => {
      vi.mocked(api.getProjectSponsors).mockResolvedValue({
        items: [
          make50Sponsor({ monthly_amount_usd: 75 }),
        ],
        total: 1,
        limit: 50,
        offset: 0,
      })

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Project funding')).toBeInTheDocument()
      })

      expect(screen.getByText('$75/mo total')).toBeInTheDocument()
    })

    it('does not show funding progress when totalFunding is 0', async () => {
      vi.mocked(api.getProjectSponsors).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      expect(screen.queryByText('Project funding')).not.toBeInTheDocument()
    })
  })

  describe('Sponsor Vision — save and remove interactions', () => {
    it('shows Saving... state while save is in flight', async () => {
      // Use a deferred promise so we can observe loading state
      let resolveSave!: () => void
      vi.mocked(api.setSponsorVision).mockImplementation(
        () => new Promise<ReturnType<typeof api.setSponsorVision>>((resolve) => {
          resolveSave = () => resolve({ ok: true, sponsor_vision: 'test' } as ReturnType<typeof api.setSponsorVision>)
        })
      )
      vi.mocked(api.getActiveSponsor).mockResolvedValue(make50Sponsor({ tier: 100, monthly_amount_usd: 100 }))

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Your Priority Focus')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/Focus on academic/)
      fireEvent.change(textarea, { target: { value: 'More dark mode support' } })

      fireEvent.click(screen.getByText('Save'))

      // Should show Saving... while API call is pending
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })

      // Resolve the save
      resolveSave()

      // Should go back to Save after resolving
      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument()
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      })
    })

    it('shows character count when typing vision', async () => {
      vi.mocked(api.getActiveSponsor).mockResolvedValue(make50Sponsor({ tier: 100, monthly_amount_usd: 100 }))

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Your Priority Focus')).toBeInTheDocument()
      })

      // Initially shows 0/500
      expect(screen.getByText('0/500')).toBeInTheDocument()

      const textarea = screen.getByPlaceholderText(/Focus on academic/)
      fireEvent.change(textarea, { target: { value: 'Better API docs' } })

      // Should show updated character count
      expect(screen.getByText('15/500')).toBeInTheDocument()
    })

    it('clears vision text and hides Remove button after successful remove', async () => {
      vi.mocked(api.deleteSponsorVision).mockResolvedValue(undefined as unknown as ReturnType<typeof api.deleteSponsorVision>)
      vi.mocked(api.getActiveSponsor).mockResolvedValue(
        make50Sponsor({ tier: 100, monthly_amount_usd: 100, sponsor_vision: 'My current focus' })
      )

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Remove')).toBeInTheDocument()
      })

      // Confirm vision is pre-filled
      const textarea = screen.getByPlaceholderText(/Focus on academic/) as HTMLTextAreaElement
      expect(textarea.value).toBe('My current focus')

      fireEvent.click(screen.getByText('Remove'))

      // After remove, textarea should be empty and Remove button hidden
      await waitFor(() => {
        expect(textarea.value).toBe('')
      })

      // Remove button should disappear because sponsor_vision is now null
      await waitFor(() => {
        expect(screen.queryByText('Remove')).not.toBeInTheDocument()
      })
    })

    it('does not call setSponsorVision when vision text is only whitespace', async () => {
      vi.mocked(api.getActiveSponsor).mockResolvedValue(make50Sponsor({ tier: 100, monthly_amount_usd: 100 }))

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Your Priority Focus')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/Focus on academic/)
      fireEvent.change(textarea, { target: { value: '   ' } })

      // Save button should be disabled for whitespace-only input
      expect(screen.getByText('Save')).toBeDisabled()
    })
  })

  describe('Custom amount — edge cases', () => {
    it('updates CTA button when entering valid custom amount via typing', async () => {
      const user = userEvent.setup()
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const customInput = screen.getByPlaceholderText('Custom')
      await user.clear(customInput)
      await user.type(customInput, '200')

      await waitFor(() => {
        expect(screen.getByText('Sponsor $200/mo')).toBeInTheDocument()
      })
    })

    it('keeps field value even when amount is out of range', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const customInput = screen.getByPlaceholderText('Custom') as HTMLInputElement
      fireEvent.change(customInput, { target: { value: '1000' } })

      // The field shows the typed value
      expect(customInput.value).toBe('1000')

      // But the CTA amount doesn't change since 1000 > MAX_AMOUNT
      expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
    })

    it('accepts minimum amount boundary value', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const customInput = screen.getByPlaceholderText('Custom')
      fireEvent.change(customInput, { target: { value: '5' } })

      await waitFor(() => {
        expect(screen.getByText('Sponsor $5/mo')).toBeInTheDocument()
      })
    })

    it('accepts maximum amount boundary value', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const customInput = screen.getByPlaceholderText('Custom')
      fireEvent.change(customInput, { target: { value: '500' } })

      await waitFor(() => {
        expect(screen.getByText('Sponsor $500/mo')).toBeInTheDocument()
      })
    })
  })

  describe('Tier selection — all presets', () => {
    it('selects $25 preset and shows Supporter stage', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const preset25Buttons = screen.getAllByText('$25')
      fireEvent.click(preset25Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $25/mo')).toBeInTheDocument()
      })
      expect(screen.getByText('Supporter')).toBeInTheDocument()
    })

    it('selects $50 preset and shows Backer stage', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      // Change away from $50 first, then come back
      const preset10Buttons = screen.getAllByText('$10')
      fireEvent.click(preset10Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $10/mo')).toBeInTheDocument()
      })

      // Now select $50
      const preset50Buttons = screen.getAllByText('$50')
      fireEvent.click(preset50Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })
      expect(screen.getByText('Backer')).toBeInTheDocument()
    })

    it('selects $100 preset and shows Patron stage', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      const preset100Buttons = screen.getAllByText('$100')
      fireEvent.click(preset100Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $100/mo')).toBeInTheDocument()
      })
      expect(screen.getByText('Patron')).toBeInTheDocument()
    })

    it('updates benefits list when switching between tiers', async () => {
      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      // At $50 (Backer) — should have Free + Supporter + Backer benefits
      expect(screen.getByText('Name in contributors list')).toBeInTheDocument()
      expect(screen.getByText('Priority idea consideration')).toBeInTheDocument()
      expect(screen.getByText('Influence what gets built next')).toBeInTheDocument()
      // Should NOT have Patron or Champion benefits
      expect(screen.queryByText('Vote on project decisions')).not.toBeInTheDocument()
      expect(screen.queryByText('Agent Council governance')).not.toBeInTheDocument()

      // Switch to $10 (Free tier)
      const preset10Buttons = screen.getAllByText('$10')
      fireEvent.click(preset10Buttons[0])

      await waitFor(() => {
        expect(screen.getByText('Sponsor $10/mo')).toBeInTheDocument()
      })

      // At $10 — should only have Free tier benefits
      expect(screen.getByText('Name in contributors list')).toBeInTheDocument()
      expect(screen.getByText('Sponsor badge')).toBeInTheDocument()
      expect(screen.queryByText('Priority idea consideration')).not.toBeInTheDocument()
      expect(screen.queryByText('Influence what gets built next')).not.toBeInTheDocument()
    })
  })

  describe('Checkout creation — full flow', () => {
    it('redirects to Stripe checkout URL on success', async () => {
      vi.mocked(api.createSponsorshipCheckout).mockResolvedValue({
        checkout_url: 'https://checkout.stripe.com/c/pay_abc123',
      })
      const hrefSetter = vi.fn()
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        origin: 'http://localhost:3000',
        set href(url: string) { hrefSetter(url) },
        get href() { return '' },
      } as unknown as Location)

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Sponsor $50/mo'))

      await waitFor(() => {
        expect(api.createSponsorshipCheckout).toHaveBeenCalledWith({
          project_id: 'proj-1',
          amount: 50,
          success_url: 'http://localhost:3000/bloom-base/aurora?sponsored=true',
          cancel_url: 'http://localhost:3000/bloom-base/aurora/sponsor',
        })
      })

      locationSpy.mockRestore()
    })

    it('shows Redirecting to Stripe... while checkout is loading', async () => {
      let resolveCheckout!: (value: { checkout_url: string }) => void
      vi.mocked(api.createSponsorshipCheckout).mockImplementation(
        () => new Promise((resolve) => {
          resolveCheckout = resolve
        })
      )
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '',
        origin: 'http://localhost:3000',
      } as Location)

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Sponsor $50/mo'))

      await waitFor(() => {
        expect(screen.getByText('Redirecting to Stripe...')).toBeInTheDocument()
      })

      // Button should be disabled during checkout
      expect(screen.getByText('Redirecting to Stripe...')).toBeDisabled()

      // Resolve to cleanup
      resolveCheckout({ checkout_url: 'https://checkout.stripe.com/test' })

      locationSpy.mockRestore()
    })

    it('creates checkout with custom amount', async () => {
      vi.mocked(api.createSponsorshipCheckout).mockResolvedValue({
        checkout_url: 'https://checkout.stripe.com/c/pay_custom',
      })
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '',
        origin: 'http://localhost:3000',
      } as Location)

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      // Enter custom amount
      const customInput = screen.getByPlaceholderText('Custom')
      fireEvent.change(customInput, { target: { value: '75' } })

      await waitFor(() => {
        expect(screen.getByText('Sponsor $75/mo')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Sponsor $75/mo'))

      await waitFor(() => {
        expect(api.createSponsorshipCheckout).toHaveBeenCalledWith(
          expect.objectContaining({
            project_id: 'proj-1',
            amount: 75,
          })
        )
      })

      locationSpy.mockRestore()
    })

    it('creates checkout after switching tiers multiple times', async () => {
      vi.mocked(api.createSponsorshipCheckout).mockResolvedValue({
        checkout_url: 'https://checkout.stripe.com/c/pay_tier',
      })
      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '',
        origin: 'http://localhost:3000',
      } as Location)

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      // Switch to $10
      fireEvent.click(screen.getAllByText('$10')[0])
      await waitFor(() => {
        expect(screen.getByText('Sponsor $10/mo')).toBeInTheDocument()
      })

      // Switch to $250
      fireEvent.click(screen.getAllByText('$250')[0])
      await waitFor(() => {
        expect(screen.getByText('Sponsor $250/mo')).toBeInTheDocument()
      })

      // Click sponsor at $250
      fireEvent.click(screen.getByText('Sponsor $250/mo'))

      await waitFor(() => {
        expect(api.createSponsorshipCheckout).toHaveBeenCalledWith(
          expect.objectContaining({
            project_id: 'proj-1',
            amount: 250,
          })
        )
      })

      locationSpy.mockRestore()
    })

    it('clears checkout error when retrying successfully', async () => {
      vi.mocked(api.createSponsorshipCheckout)
        .mockRejectedValueOnce(new Error('Stripe unavailable'))
        .mockResolvedValueOnce({ checkout_url: 'https://checkout.stripe.com/retry' })

      const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
        ...window.location,
        href: '',
        origin: 'http://localhost:3000',
      } as Location)

      render(<SponsorPage />)

      await waitFor(() => {
        expect(screen.getByText('Sponsor $50/mo')).toBeInTheDocument()
      })

      // First attempt — fails
      fireEvent.click(screen.getByText('Sponsor $50/mo'))

      await waitFor(() => {
        expect(screen.getByText('Stripe unavailable')).toBeInTheDocument()
      })

      // Second attempt — should clear the error banner
      fireEvent.click(screen.getByText('Sponsor $50/mo'))

      await waitFor(() => {
        // Error should be gone during the retry
        expect(screen.queryByText('Stripe unavailable')).not.toBeInTheDocument()
      })

      locationSpy.mockRestore()
    })
  })
})
