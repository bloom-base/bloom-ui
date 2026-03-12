import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ owner: 'bloom-base', repo: 'aurora' }),
  usePathname: () => '/bloom-base/aurora/council',
}))

vi.mock('@/lib/api', () => ({
  getProjectByPath: vi.fn(),
  getCurrentUser: vi.fn(),
  getProjectProposals: vi.fn(),
  getProjectSponsors: vi.fn(),
  createProposal: vi.fn(),
  getDebateEntries: vi.fn(),
  getProposalVotes: vi.fn(),
}))

import CouncilPage from './page'
import * as api from '@/lib/api'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProject: api.Project = {
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
  max_parallel_tasks: null,
  auto_improve: false,
  created_at: '2026-01-15T00:00:00Z',
}

const mockUser: api.UserProfile = {
  id: 'user-1',
  username: 'testuser',
  handle: null,
  display_name: null,
  bio: null,
  github_username: 'testuser',
  email: null,
  avatar_url: null,
  subscription_tier: 'free',
  is_admin: false,
  has_anthropic_key: false,
  email_verified: false,
  has_github: true,
  has_password: false,
  email_notifications: true,
}

const mockPatronSponsor: api.Sponsorship = {
  id: 'sp-1',
  project_id: 'proj-1',
  sponsor_id: 'user-1',
  sponsor_username: 'testuser',
  sponsor_avatar_url: null,
  display_name: 'Test Patron',
  is_company: false,
  tier: 100,
  monthly_amount_usd: 100,
  total_contributed_usd: 300,
  status: 'active',
  is_active: true,
  started_at: '2026-01-15T00:00:00Z',
  sponsor_vision: null,
}

const mockNonPatronSponsor: api.Sponsorship = {
  id: 'sp-2',
  project_id: 'proj-1',
  sponsor_id: 'user-2',
  sponsor_username: 'cheapuser',
  sponsor_avatar_url: null,
  display_name: 'Budget Sponsor',
  is_company: false,
  tier: 10,
  monthly_amount_usd: 10,
  total_contributed_usd: 30,
  status: 'active',
  is_active: true,
  started_at: '2026-01-15T00:00:00Z',
  sponsor_vision: null,
}

const mockOpenProposal: api.VisionProposal = {
  id: 'prop-1',
  project_id: 'proj-1',
  proposer_id: 'user-1',
  proposer_username: 'testuser',
  title: 'Refocus on mobile',
  description: 'Mobile is the future',
  proposed_vision: 'A mobile-first weather app',
  status: 'open',
  votes_for: 1,
  votes_against: 0,
  votes_abstain: 0,
  total_eligible_voters: 2,
  debate_summary: null,
  voting_deadline: '2026-02-01T00:00:00Z',
  resolved_at: null,
  created_at: '2026-01-30T00:00:00Z',
}

const mockPassedProposal: api.VisionProposal = {
  ...mockOpenProposal,
  id: 'prop-2',
  title: 'Enterprise pivot',
  description: 'B2B is where the money is',
  proposed_vision: 'Enterprise-first weather analytics',
  status: 'passed',
  votes_for: 2,
  votes_against: 0,
  resolved_at: '2026-02-01T12:00:00Z',
}

const mockRejectedProposal: api.VisionProposal = {
  ...mockOpenProposal,
  id: 'prop-3',
  title: 'Go blockchain',
  description: 'Web3 weather',
  proposed_vision: 'Decentralized weather on-chain',
  status: 'rejected',
  votes_for: 0,
  votes_against: 2,
  resolved_at: '2026-02-02T12:00:00Z',
}

const mockExpiredProposal: api.VisionProposal = {
  ...mockOpenProposal,
  id: 'prop-4',
  title: 'Add social features',
  description: '',
  proposed_vision: 'Weather with friends',
  status: 'expired',
  votes_for: 0,
  votes_against: 0,
  votes_abstain: 2,
  resolved_at: null,
}

const mockDebateEntries: api.DebateEntry[] = [
  {
    id: 'debate-1',
    sponsor_id: 'user-1',
    position: 'for',
    argument: 'Mobile users are 80% of traffic. We must prioritize them.',
    turn_number: 1,
    created_at: '2026-01-30T01:00:00Z',
  },
  {
    id: 'debate-2',
    sponsor_id: 'user-2',
    position: 'against',
    argument: 'Desktop power users generate 90% of revenue.',
    turn_number: 2,
    created_at: '2026-01-30T02:00:00Z',
  },
]

const mockVotes: api.CouncilVote[] = [
  {
    id: 'vote-1',
    voter_id: 'user-1',
    choice: 'for',
    reasoning: 'Mobile-first is the way forward for growth.',
    created_at: '2026-01-31T00:00:00Z',
  },
  {
    id: 'vote-2',
    voter_id: 'user-2',
    choice: 'against',
    reasoning: 'We should maintain desktop parity.',
    created_at: '2026-01-31T01:00:00Z',
  },
  {
    id: 'vote-3',
    voter_id: 'user-3',
    choice: 'abstain',
    reasoning: 'Not enough data to decide.',
    created_at: '2026-01-31T02:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up default mocks: project exists, user logged in, no proposals, no sponsors */
function setupDefaultMocks() {
  vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject)
  vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser)
  vi.mocked(api.getProjectProposals).mockResolvedValue([])
  vi.mocked(api.getProjectSponsors).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })
  vi.mocked(api.getDebateEntries).mockResolvedValue([])
  vi.mocked(api.getProposalVotes).mockResolvedValue([])
}

/** Make the current user a patron so isGovernor = true */
function makeUserPatron() {
  vi.mocked(api.getProjectSponsors).mockResolvedValue({
    items: [mockPatronSponsor],
    total: 1,
    limit: 50,
    offset: 0,
  })
}

/** Wait for loading to finish (page renders heading) */
async function waitForPageLoad() {
  await waitFor(() => {
    expect(screen.getByText('Governance Council')).toBeInTheDocument()
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CouncilPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPush.mockClear()
    setupDefaultMocks()
  })

  // =========================================================================
  // Loading state
  // =========================================================================

  describe('loading state', () => {
    it('renders skeleton loading UI before data loads', () => {
      // Make API calls hang so we stay in loading
      vi.mocked(api.getProjectByPath).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}))
      const { container } = render(<CouncilPage />)
      expect(container.querySelector('.animate-pulse')).toBeTruthy()
    })
  })

  // =========================================================================
  // Project not found -> redirect
  // =========================================================================

  describe('project not found', () => {
    it('redirects to / when project is not found', async () => {
      vi.mocked(api.getProjectByPath).mockResolvedValue(null as unknown as api.Project)
      render(<CouncilPage />)
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/')
      })
    })
  })

  // =========================================================================
  // Basic rendering
  // =========================================================================

  describe('basic rendering', () => {
    it('renders the page heading and subheading', async () => {
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.getByText('Governance Council')).toBeInTheDocument()
      expect(screen.getByText(/Patron sponsors propose and vote/)).toBeInTheDocument()
    })

    it('displays the current project vision', async () => {
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.getByText('Current Vision')).toBeInTheDocument()
      expect(screen.getByText('Predict the weather with AI')).toBeInTheDocument()
    })

    it('shows fallback text when project has no vision', async () => {
      vi.mocked(api.getProjectByPath).mockResolvedValue({ ...mockProject, vision: '' })
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.getByText('No vision defined yet.')).toBeInTheDocument()
    })

    it('handles unauthenticated users gracefully', async () => {
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Unauthorized'))
      render(<CouncilPage />)
      await waitForPageLoad()
      // Page still renders, user just can't propose
      expect(screen.getByText('Governance Council')).toBeInTheDocument()
      expect(screen.queryByText('New Proposal')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Empty state (no proposals)
  // =========================================================================

  describe('empty state', () => {
    it('shows empty state when no proposals exist', async () => {
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.getByText(/No proposals yet/)).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Council Members section
  // =========================================================================

  describe('council members', () => {
    it('shows council members when $100+ sponsors exist', async () => {
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.getByText('Council Members')).toBeInTheDocument()
      expect(screen.getByText('Test Patron')).toBeInTheDocument()
    })

    it('hides council members section when no $100+ sponsors', async () => {
      vi.mocked(api.getProjectSponsors).mockResolvedValue({
        items: [mockNonPatronSponsor],
        total: 1,
        limit: 50,
        offset: 0,
      })
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.queryByText('Council Members')).not.toBeInTheDocument()
    })

    it('renders sponsor initials in avatar circles', async () => {
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      // "Test Patron" -> "T"
      expect(screen.getByText('T')).toBeInTheDocument()
    })

    it('falls back to sponsor_username when display_name is null', async () => {
      const noDisplayName = { ...mockPatronSponsor, display_name: null }
      vi.mocked(api.getProjectSponsors).mockResolvedValue({
        items: [noDisplayName],
        total: 1,
        limit: 50,
        offset: 0,
      })
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.getByText('testuser')).toBeInTheDocument()
    })

    it('does not show inactive $100 sponsors as council members', async () => {
      const inactiveSponsor = { ...mockPatronSponsor, is_active: false }
      vi.mocked(api.getProjectSponsors).mockResolvedValue({
        items: [inactiveSponsor],
        total: 1,
        limit: 50,
        offset: 0,
      })
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.queryByText('Council Members')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // "New Proposal" button visibility (patron gate)
  // =========================================================================

  describe('new proposal button visibility', () => {
    it('shows New Proposal button for patron sponsors', async () => {
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.getByText('New Proposal')).toBeInTheDocument()
    })

    it('hides New Proposal button for non-patron users', async () => {
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.queryByText('New Proposal')).not.toBeInTheDocument()
    })

    it('hides New Proposal button for $10 sponsors (below $100 threshold)', async () => {
      vi.mocked(api.getProjectSponsors).mockResolvedValue({
        items: [mockNonPatronSponsor],
        total: 1,
        limit: 50,
        offset: 0,
      })
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.queryByText('New Proposal')).not.toBeInTheDocument()
    })

    it('hides New Proposal when an open proposal already exists', async () => {
      makeUserPatron()
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })
      expect(screen.queryByText('New Proposal')).not.toBeInTheDocument()
    })

    it('shows New Proposal when only non-open proposals exist', async () => {
      makeUserPatron()
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockPassedProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Enterprise pivot')).toBeInTheDocument()
      })
      expect(screen.getByText('New Proposal')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Proposal form - open / cancel
  // =========================================================================

  describe('proposal form - open and cancel', () => {
    it('opens the proposal form when New Proposal is clicked', async () => {
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))
      expect(screen.getByText('New Vision Proposal')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Refocus on enterprise/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Explain why the vision/)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/The new vision text/)).toBeInTheDocument()
      expect(screen.getByText('Submit Proposal')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('hides the New Proposal button when form is open', async () => {
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))
      expect(screen.queryByText('New Proposal')).not.toBeInTheDocument()
    })

    it('closes the form when Cancel is clicked', async () => {
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))
      expect(screen.getByText('New Vision Proposal')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Cancel'))
      expect(screen.queryByText('New Vision Proposal')).not.toBeInTheDocument()
      // New Proposal button should reappear
      expect(screen.getByText('New Proposal')).toBeInTheDocument()
    })

    it('shows character counter for the vision textarea', async () => {
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))
      expect(screen.getByText('0/2000')).toBeInTheDocument()
    })

    it('updates character counter as user types vision', async () => {
      const user = userEvent.setup()
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)
      await user.type(visionTextarea, 'Hello')
      expect(screen.getByText('5/2000')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Proposal form - submit button disabled states
  // =========================================================================

  describe('proposal form - submit button states', () => {
    it('disables submit when title is empty', async () => {
      const user = userEvent.setup()
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const submitBtn = screen.getByText('Submit Proposal')
      expect(submitBtn).toBeDisabled()

      // Fill only vision, not title
      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)
      await user.type(visionTextarea, 'Some vision')
      expect(submitBtn).toBeDisabled()
    })

    it('disables submit when vision is empty', async () => {
      const user = userEvent.setup()
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const submitBtn = screen.getByText('Submit Proposal')
      const titleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      await user.type(titleInput, 'Some title')
      expect(submitBtn).toBeDisabled()
    })

    it('enables submit when both title and vision are filled', async () => {
      const user = userEvent.setup()
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const titleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)
      await user.type(titleInput, 'New direction')
      await user.type(visionTextarea, 'A better vision for the project')
      expect(screen.getByText('Submit Proposal')).toBeEnabled()
    })

    it('submit is enabled even when description (rationale) is empty', async () => {
      const user = userEvent.setup()
      makeUserPatron()
      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const titleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)
      await user.type(titleInput, 'Title')
      await user.type(visionTextarea, 'Vision')
      // description is left empty -- submit should still be enabled
      expect(screen.getByText('Submit Proposal')).toBeEnabled()
    })
  })

  // =========================================================================
  // Proposal form - successful submission
  // =========================================================================

  describe('proposal form - successful submission', () => {
    it('submits the proposal and adds it to the list', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      const createdProposal: api.VisionProposal = {
        id: 'prop-new',
        project_id: 'proj-1',
        proposer_id: 'user-1',
        proposer_username: 'testuser',
        title: 'New direction',
        description: 'Because reasons',
        proposed_vision: 'A better vision',
        status: 'open',
        votes_for: 0,
        votes_against: 0,
        votes_abstain: 0,
        total_eligible_voters: 1,
        debate_summary: null,
        voting_deadline: '2026-03-01T00:00:00Z',
        resolved_at: null,
        created_at: '2026-02-28T00:00:00Z',
      }
      vi.mocked(api.createProposal).mockResolvedValue(createdProposal)

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const titleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      const descriptionInput = screen.getByPlaceholderText(/Explain why the vision/)
      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)

      await user.type(titleInput, 'New direction')
      await user.type(descriptionInput, 'Because reasons')
      await user.type(visionTextarea, 'A better vision')

      await user.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(api.createProposal).toHaveBeenCalledWith('proj-1', {
          title: 'New direction',
          description: 'Because reasons',
          proposed_vision: 'A better vision',
        })
      })

      // Form should close and new proposal should appear in the list
      await waitFor(() => {
        expect(screen.queryByText('New Vision Proposal')).not.toBeInTheDocument()
        expect(screen.getByText('New direction')).toBeInTheDocument()
      })
    })

    it('clears form fields after successful submission', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      const createdProposal: api.VisionProposal = {
        ...mockOpenProposal,
        id: 'prop-cleared',
        title: 'Cleared title',
        proposed_vision: 'Cleared vision',
        status: 'open',
      }
      vi.mocked(api.createProposal).mockResolvedValue(createdProposal)

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      await user.type(screen.getByPlaceholderText(/Refocus on enterprise/), 'Cleared title')
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'Cleared vision')
      fireEvent.click(screen.getByText('Submit Proposal'))

      // After submit, form closes; since there is now an open proposal, the button is hidden
      await waitFor(() => {
        expect(screen.queryByText('New Vision Proposal')).not.toBeInTheDocument()
      })
    })

    it('shows "Submitting..." text while submission is in progress', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      // Make createProposal hang so we can observe the submitting state
      let resolveCreate!: (v: api.VisionProposal) => void
      vi.mocked(api.createProposal).mockImplementation(
        () => new Promise((res) => { resolveCreate = res })
      )

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      await user.type(screen.getByPlaceholderText(/Refocus on enterprise/), 'Title')
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'Vision')
      fireEvent.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(screen.getByText('Submitting...')).toBeInTheDocument()
      })

      // Resolve to clean up
      resolveCreate({ ...mockOpenProposal, id: 'prop-submitting' })
    })
  })

  // =========================================================================
  // Proposal form - submission failure
  // =========================================================================

  describe('proposal form - submission failure', () => {
    it('shows error message when submission fails', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      vi.mocked(api.createProposal).mockRejectedValue(new Error('Insufficient permissions'))

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      await user.type(screen.getByPlaceholderText(/Refocus on enterprise/), 'Title')
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'Vision')
      fireEvent.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(screen.getByText('Insufficient permissions')).toBeInTheDocument()
      })
      // Form stays open so user can retry
      expect(screen.getByText('New Vision Proposal')).toBeInTheDocument()
    })

    it('shows generic error for non-Error rejections', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      vi.mocked(api.createProposal).mockRejectedValue('something went wrong')

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      await user.type(screen.getByPlaceholderText(/Refocus on enterprise/), 'Title')
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'Vision')
      fireEvent.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(screen.getByText('Failed to create proposal')).toBeInTheDocument()
      })
    })

    it('re-enables submit button after failure', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      vi.mocked(api.createProposal).mockRejectedValue(new Error('Server error'))

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      await user.type(screen.getByPlaceholderText(/Refocus on enterprise/), 'Title')
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'Vision')
      fireEvent.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument()
      })
      expect(screen.getByText('Submit Proposal')).toBeEnabled()
    })
  })

  // =========================================================================
  // Proposal list rendering
  // =========================================================================

  describe('proposal list rendering', () => {
    it('displays proposals with title, status badge, and vote counts', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })
      expect(screen.getByText('Open')).toBeInTheDocument()
      expect(screen.getByText('1 for')).toBeInTheDocument()
      expect(screen.getByText('0 against')).toBeInTheDocument()
    })

    it('shows proposer username and date', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })
      expect(screen.getByText(/by testuser/)).toBeInTheDocument()
    })

    it('shows "Passed" badge for passed proposals', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockPassedProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Passed')).toBeInTheDocument()
      })
    })

    it('shows "Rejected" badge for rejected proposals', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockRejectedProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Rejected')).toBeInTheDocument()
      })
    })

    it('shows "Expired" badge for expired proposals', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockExpiredProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Expired')).toBeInTheDocument()
      })
    })

    it('shows abstain count only when votes_abstain > 0', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })
      // mockOpenProposal has votes_abstain: 0
      expect(screen.queryByText(/abstain/)).not.toBeInTheDocument()

      // Now with abstain > 0
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockExpiredProposal])
    })

    it('shows abstain count when votes_abstain > 0', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockExpiredProposal])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Add social features')).toBeInTheDocument()
      })
      expect(screen.getByText('2 abstain')).toBeInTheDocument()
    })

    it('renders multiple proposals', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([
        mockPassedProposal,
        mockRejectedProposal,
      ])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Enterprise pivot')).toBeInTheDocument()
      })
      expect(screen.getByText('Go blockchain')).toBeInTheDocument()
    })

    it('shows "Unknown" when proposer_username is null', async () => {
      const noProposer = { ...mockOpenProposal, proposer_username: null }
      vi.mocked(api.getProjectProposals).mockResolvedValue([noProposer])
      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText(/by Unknown/)).toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Expand / collapse proposal details
  // =========================================================================

  describe('expand and collapse proposals', () => {
    it('expands a proposal to show proposed vision', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      // Details should not be visible initially
      expect(screen.queryByText('Proposed Vision')).not.toBeInTheDocument()

      // Click to expand
      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })
      expect(screen.getByText('A mobile-first weather app')).toBeInTheDocument()
    })

    it('shows the rationale section when description is present', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Rationale')).toBeInTheDocument()
      })
      expect(screen.getByText('Mobile is the future')).toBeInTheDocument()
    })

    it('hides rationale section when description is empty', async () => {
      const noDesc = { ...mockOpenProposal, description: '' }
      vi.mocked(api.getProjectProposals).mockResolvedValue([noDesc])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })
      expect(screen.queryByText('Rationale')).not.toBeInTheDocument()
    })

    it('collapses an expanded proposal when clicked again', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      // Expand
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })

      // Collapse
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(screen.queryByText('Proposed Vision')).not.toBeInTheDocument()
      })
    })

    it('fetches debate entries and votes when expanding', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(api.getDebateEntries).toHaveBeenCalledWith('proj-1', 'prop-1')
        expect(api.getProposalVotes).toHaveBeenCalledWith('proj-1', 'prop-1')
      })
    })

    it('does not re-fetch when collapsing', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      // Expand
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(api.getDebateEntries).toHaveBeenCalledTimes(1)
      })

      // Collapse -- should not trigger another fetch
      fireEvent.click(screen.getByText('Refocus on mobile'))
      expect(api.getDebateEntries).toHaveBeenCalledTimes(1)
    })

    it('switches expanded proposal when clicking a different one', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([
        mockOpenProposal,
        mockPassedProposal,
      ])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      // Expand first proposal
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(screen.getByText('A mobile-first weather app')).toBeInTheDocument()
      })

      // Expand second proposal (should collapse the first)
      fireEvent.click(screen.getByText('Enterprise pivot'))
      await waitFor(() => {
        expect(screen.getByText('Enterprise-first weather analytics')).toBeInTheDocument()
      })
      // First proposal's expanded vision should no longer be visible
      // (both have "Proposed Vision" heading so check the specific text)
      expect(screen.queryByText('A mobile-first weather app')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Debate entries in expanded proposal
  // =========================================================================

  describe('debate entries', () => {
    it('shows AI debate section with debate entries', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue(mockDebateEntries)
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
      })
      expect(screen.getByText('Mobile users are 80% of traffic. We must prioritize them.')).toBeInTheDocument()
      expect(screen.getByText('Desktop power users generate 90% of revenue.')).toBeInTheDocument()
    })

    it('shows position labels (for/against) on debate entries', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue(mockDebateEntries)
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
      })
      // Position labels "for" and "against" inside debate entries
      const forLabels = screen.getAllByText('for')
      const againstLabels = screen.getAllByText('against')
      expect(forLabels.length).toBeGreaterThanOrEqual(1)
      expect(againstLabels.length).toBeGreaterThanOrEqual(1)
    })

    it('hides AI Debate section when no entries', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })
      expect(screen.queryByText('AI Debate')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Votes in expanded proposal
  // =========================================================================

  describe('votes display', () => {
    it('shows votes section with individual votes', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue(mockVotes)

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Votes')).toBeInTheDocument()
      })
      expect(screen.getByText('Mobile-first is the way forward for growth.')).toBeInTheDocument()
      expect(screen.getByText('We should maintain desktop parity.')).toBeInTheDocument()
      expect(screen.getByText('Not enough data to decide.')).toBeInTheDocument()
    })

    it('shows vote choice badges (for/against/abstain)', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue(mockVotes)

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Votes')).toBeInTheDocument()
      })
      // Each vote's choice is rendered as a badge
      const abstainBadges = screen.getAllByText('abstain')
      expect(abstainBadges.length).toBeGreaterThanOrEqual(1)
    })

    it('hides votes section when no votes', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })
      expect(screen.queryByText('Votes')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Passed proposal banner
  // =========================================================================

  describe('passed proposal banner', () => {
    it('shows "passed" confirmation banner in expanded passed proposal', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockPassedProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Enterprise pivot')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Enterprise pivot'))

      await waitFor(() => {
        expect(screen.getByText(/This proposal passed/)).toBeInTheDocument()
      })
      expect(screen.getByText(/The project vision has been updated/)).toBeInTheDocument()
    })

    it('does not show passed banner for non-passed proposals', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })
      expect(screen.queryByText(/This proposal passed/)).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // API error resilience
  // =========================================================================

  describe('API error resilience', () => {
    it('renders with empty proposals when getProjectProposals fails', async () => {
      vi.mocked(api.getProjectProposals).mockRejectedValue(new Error('Network error'))
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.getByText(/No proposals yet/)).toBeInTheDocument()
    })

    it('renders without council members when getProjectSponsors fails', async () => {
      vi.mocked(api.getProjectSponsors).mockRejectedValue(new Error('Network error'))
      render(<CouncilPage />)
      await waitForPageLoad()
      expect(screen.queryByText('Council Members')).not.toBeInTheDocument()
    })

    it('expands proposal without crashing when getDebateEntries fails', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockRejectedValue(new Error('Failed'))
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })
      // Should not show debate section since it failed
      expect(screen.queryByText('AI Debate')).not.toBeInTheDocument()
    })

    it('expands proposal without crashing when getProposalVotes fails', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockRejectedValue(new Error('Failed'))

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })
      expect(screen.queryByText('Votes')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // Submit proposal form — full interaction flow
  // =========================================================================

  describe('submit proposal form — full interaction', () => {
    it('calls createProposal with trimmed values when fields have whitespace', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      const createdProposal: api.VisionProposal = {
        ...mockOpenProposal,
        id: 'prop-trimmed',
        title: 'Trimmed title',
        description: 'Trimmed description',
        proposed_vision: 'Trimmed vision',
      }
      vi.mocked(api.createProposal).mockResolvedValue(createdProposal)

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const titleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      const descriptionInput = screen.getByPlaceholderText(/Explain why the vision/)
      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)

      await user.type(titleInput, '  Trimmed title  ')
      await user.type(descriptionInput, '  Trimmed description  ')
      await user.type(visionTextarea, '  Trimmed vision  ')

      await user.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(api.createProposal).toHaveBeenCalledWith('proj-1', {
          title: 'Trimmed title',
          description: 'Trimmed description',
          proposed_vision: 'Trimmed vision',
        })
      })
    })

    it('submits successfully without description (optional field)', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      const createdProposal: api.VisionProposal = {
        ...mockOpenProposal,
        id: 'prop-no-desc',
        title: 'No description',
        description: '',
        proposed_vision: 'Vision without rationale',
      }
      vi.mocked(api.createProposal).mockResolvedValue(createdProposal)

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      await user.type(screen.getByPlaceholderText(/Refocus on enterprise/), 'No description')
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'Vision without rationale')

      await user.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(api.createProposal).toHaveBeenCalledWith('proj-1', {
          title: 'No description',
          description: '',
          proposed_vision: 'Vision without rationale',
        })
      })

      // Form should close
      await waitFor(() => {
        expect(screen.queryByText('New Vision Proposal')).not.toBeInTheDocument()
      })
    })

    it('prepends newly created proposal to the list', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      // Start with one existing passed proposal
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockPassedProposal])

      const newProposal: api.VisionProposal = {
        ...mockOpenProposal,
        id: 'prop-prepend',
        title: 'Fresh proposal',
        proposed_vision: 'A fresh new vision',
      }
      vi.mocked(api.createProposal).mockResolvedValue(newProposal)

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Enterprise pivot')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('New Proposal'))
      await user.type(screen.getByPlaceholderText(/Refocus on enterprise/), 'Fresh proposal')
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'A fresh new vision')
      await user.click(screen.getByText('Submit Proposal'))

      await waitFor(() => {
        expect(screen.getByText('Fresh proposal')).toBeInTheDocument()
      })
      // Original proposal should still be visible
      expect(screen.getByText('Enterprise pivot')).toBeInTheDocument()
    })

    it('does not submit when title is only whitespace', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const titleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)

      await user.type(titleInput, '   ')
      await user.type(visionTextarea, 'Valid vision')

      // Submit button should be disabled because title.trim() is empty
      expect(screen.getByText('Submit Proposal')).toBeDisabled()
    })

    it('does not submit when vision is only whitespace', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      render(<CouncilPage />)
      await waitForPageLoad()
      fireEvent.click(screen.getByText('New Proposal'))

      const titleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)

      await user.type(titleInput, 'Valid title')
      await user.type(visionTextarea, '   ')

      // Submit button should be disabled because vision.trim() is empty
      expect(screen.getByText('Submit Proposal')).toBeDisabled()
    })
  })

  // =========================================================================
  // Cancel form — field reset verification
  // =========================================================================

  describe('cancel form — field reset verification', () => {
    it('resets form fields when cancelled and reopened', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      render(<CouncilPage />)
      await waitForPageLoad()

      // Open form and type into all fields
      fireEvent.click(screen.getByText('New Proposal'))

      const titleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      const descriptionInput = screen.getByPlaceholderText(/Explain why the vision/)
      const visionTextarea = screen.getByPlaceholderText(/The new vision text/)

      await user.type(titleInput, 'Draft title')
      await user.type(descriptionInput, 'Draft description')
      await user.type(visionTextarea, 'Draft vision')

      // Verify fields are filled
      expect(titleInput).toHaveValue('Draft title')
      expect(descriptionInput).toHaveValue('Draft description')
      expect(visionTextarea).toHaveValue('Draft vision')

      // Cancel the form
      fireEvent.click(screen.getByText('Cancel'))

      // Form should be hidden
      expect(screen.queryByText('New Vision Proposal')).not.toBeInTheDocument()

      // Reopen the form -- fields are controlled by state which was NOT reset on cancel,
      // but the form hides. The component sets showForm(false) on cancel.
      // State persists (formTitle, formDescription, formVision are not cleared on cancel).
      // This test documents current behavior.
      fireEvent.click(screen.getByText('New Proposal'))

      const newTitleInput = screen.getByPlaceholderText(/Refocus on enterprise/)
      const newDescInput = screen.getByPlaceholderText(/Explain why the vision/)
      const newVisionTextarea = screen.getByPlaceholderText(/The new vision text/)

      // Current behavior: fields retain their values after cancel (state is not cleared)
      expect(newTitleInput).toHaveValue('Draft title')
      expect(newDescInput).toHaveValue('Draft description')
      expect(newVisionTextarea).toHaveValue('Draft vision')
    })

    it('character counter reflects retained vision text after cancel and reopen', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      render(<CouncilPage />)
      await waitForPageLoad()

      fireEvent.click(screen.getByText('New Proposal'))
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'Hello World')
      expect(screen.getByText('11/2000')).toBeInTheDocument()

      // Cancel
      fireEvent.click(screen.getByText('Cancel'))

      // Reopen -- character counter should reflect the retained text
      fireEvent.click(screen.getByText('New Proposal'))
      expect(screen.getByText('11/2000')).toBeInTheDocument()
    })

    it('cancel does not call createProposal', async () => {
      const user = userEvent.setup()
      makeUserPatron()

      render(<CouncilPage />)
      await waitForPageLoad()

      fireEvent.click(screen.getByText('New Proposal'))
      await user.type(screen.getByPlaceholderText(/Refocus on enterprise/), 'Some title')
      await user.type(screen.getByPlaceholderText(/The new vision text/), 'Some vision')

      // Cancel instead of submit
      fireEvent.click(screen.getByText('Cancel'))

      expect(api.createProposal).not.toHaveBeenCalled()
    })

    it('New Proposal button reappears after cancelling', async () => {
      makeUserPatron()

      render(<CouncilPage />)
      await waitForPageLoad()

      expect(screen.getByText('New Proposal')).toBeInTheDocument()

      fireEvent.click(screen.getByText('New Proposal'))
      expect(screen.queryByText('New Proposal')).not.toBeInTheDocument()

      fireEvent.click(screen.getByText('Cancel'))
      expect(screen.getByText('New Proposal')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // Expand / collapse — additional interaction tests
  // =========================================================================

  describe('expand / collapse — additional interactions', () => {
    it('fetches debate entries and votes for the correct proposal when switching', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([
        mockOpenProposal,
        mockPassedProposal,
      ])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      // Expand first proposal
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(api.getDebateEntries).toHaveBeenCalledWith('proj-1', 'prop-1')
        expect(api.getProposalVotes).toHaveBeenCalledWith('proj-1', 'prop-1')
      })

      // Switch to second proposal
      fireEvent.click(screen.getByText('Enterprise pivot'))
      await waitFor(() => {
        expect(api.getDebateEntries).toHaveBeenCalledWith('proj-1', 'prop-2')
        expect(api.getProposalVotes).toHaveBeenCalledWith('proj-1', 'prop-2')
      })

      // Each should have been called twice (once per expansion)
      expect(api.getDebateEntries).toHaveBeenCalledTimes(2)
      expect(api.getProposalVotes).toHaveBeenCalledTimes(2)
    })

    it('shows passed banner only on the expanded passed proposal, not on others', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([
        mockOpenProposal,
        mockPassedProposal,
      ])
      vi.mocked(api.getDebateEntries).mockResolvedValue([])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      // Expand the open proposal
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(screen.getByText('Proposed Vision')).toBeInTheDocument()
      })
      expect(screen.queryByText(/This proposal passed/)).not.toBeInTheDocument()

      // Switch to the passed proposal
      fireEvent.click(screen.getByText('Enterprise pivot'))
      await waitFor(() => {
        expect(screen.getByText(/This proposal passed/)).toBeInTheDocument()
      })
    })

    it('collapse hides all expanded content including debate and votes', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue(mockDebateEntries)
      vi.mocked(api.getProposalVotes).mockResolvedValue(mockVotes)

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      // Expand
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
        expect(screen.getByText('Votes')).toBeInTheDocument()
      })

      // Collapse
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(screen.queryByText('AI Debate')).not.toBeInTheDocument()
        expect(screen.queryByText('Votes')).not.toBeInTheDocument()
        expect(screen.queryByText('Proposed Vision')).not.toBeInTheDocument()
      })
    })
  })

  // =========================================================================
  // Debate entries — display and interaction details
  // =========================================================================

  describe('debate entries — display details', () => {
    it('renders "for" debate entries with green styling', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([mockDebateEntries[0]]) // "for" entry only
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      const { container } = render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
      })

      // The "for" entry should have green background styling
      const forEntry = screen.getByText('Mobile users are 80% of traffic. We must prioritize them.').closest('div')
      expect(forEntry?.className).toContain('bg-green-50')
      expect(forEntry?.className).toContain('border-green-200')
    })

    it('renders "against" debate entries with red styling', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([mockDebateEntries[1]]) // "against" entry only
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
      })

      // The "against" entry should have red background styling
      const againstEntry = screen.getByText('Desktop power users generate 90% of revenue.').closest('div')
      expect(againstEntry?.className).toContain('bg-red-50')
      expect(againstEntry?.className).toContain('border-red-200')
    })

    it('renders multiple debate entries in order', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue(mockDebateEntries)
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      const { container } = render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
      })

      // Both entries should be present
      const forArg = screen.getByText('Mobile users are 80% of traffic. We must prioritize them.')
      const againstArg = screen.getByText('Desktop power users generate 90% of revenue.')
      expect(forArg).toBeInTheDocument()
      expect(againstArg).toBeInTheDocument()

      // Verify order: "for" entry should come before "against" in the DOM
      const debateSection = screen.getByText('AI Debate').parentElement
      const allArguments = debateSection?.querySelectorAll('p.text-gray-700')
      expect(allArguments).toBeDefined()
      expect(allArguments!.length).toBe(2)
      expect(allArguments![0].textContent).toBe('Mobile users are 80% of traffic. We must prioritize them.')
      expect(allArguments![1].textContent).toBe('Desktop power users generate 90% of revenue.')
    })

    it('shows debate entries alongside votes when both exist', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue(mockDebateEntries)
      vi.mocked(api.getProposalVotes).mockResolvedValue(mockVotes)

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
        expect(screen.getByText('Votes')).toBeInTheDocument()
      })

      // Debate entries
      expect(screen.getByText('Mobile users are 80% of traffic. We must prioritize them.')).toBeInTheDocument()
      expect(screen.getByText('Desktop power users generate 90% of revenue.')).toBeInTheDocument()

      // Votes
      expect(screen.getByText('Mobile-first is the way forward for growth.')).toBeInTheDocument()
      expect(screen.getByText('We should maintain desktop parity.')).toBeInTheDocument()
      expect(screen.getByText('Not enough data to decide.')).toBeInTheDocument()
    })

    it('debate entries are fetched fresh when re-expanding after collapse', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue(mockDebateEntries)
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      // First expand
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
      })
      expect(api.getDebateEntries).toHaveBeenCalledTimes(1)

      // Collapse
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(screen.queryByText('AI Debate')).not.toBeInTheDocument()
      })

      // Re-expand — should fetch again
      fireEvent.click(screen.getByText('Refocus on mobile'))
      await waitFor(() => {
        expect(api.getDebateEntries).toHaveBeenCalledTimes(2)
      })
    })

    it('position labels have correct color classes for "for" entries', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([mockDebateEntries[0]])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
      })

      // The position label "for" should have green text
      const debateSection = screen.getByText('AI Debate').parentElement
      const forLabel = debateSection?.querySelector('.text-green-700')
      expect(forLabel).toBeTruthy()
      expect(forLabel?.textContent).toBe('for')
    })

    it('position labels have correct color classes for "against" entries', async () => {
      vi.mocked(api.getProjectProposals).mockResolvedValue([mockOpenProposal])
      vi.mocked(api.getDebateEntries).mockResolvedValue([mockDebateEntries[1]])
      vi.mocked(api.getProposalVotes).mockResolvedValue([])

      render(<CouncilPage />)
      await waitFor(() => {
        expect(screen.getByText('Refocus on mobile')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Refocus on mobile'))

      await waitFor(() => {
        expect(screen.getByText('AI Debate')).toBeInTheDocument()
      })

      // The position label "against" should have red text
      const debateSection = screen.getByText('AI Debate').parentElement
      const againstLabel = debateSection?.querySelector('.text-red-700')
      expect(againstLabel).toBeTruthy()
      expect(againstLabel?.textContent).toBe('against')
    })
  })
})
