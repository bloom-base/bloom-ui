import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Hoisted mocks — these must be defined before vi.mock calls
const { mockToast, mockPush, mockReplace, mockBack, mockRouter, mockParams, mockNotFound, mockRedirectToLogin } = vi.hoisted(() => {
  const mockToast = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  })
  const mockPush = vi.fn()
  const mockReplace = vi.fn()
  const mockBack = vi.fn()
  const mockRouter = { push: mockPush, replace: mockReplace, back: mockBack }
  const mockParams = { owner: 'bloom-base', repo: 'aurora' }
  const mockNotFound = vi.fn()
  const mockRedirectToLogin = vi.fn()
  return { mockToast, mockPush, mockReplace, mockBack, mockRouter, mockParams, mockNotFound, mockRedirectToLogin }
})

// Mock next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: mockToast,
}))

// Mock next/navigation with STABLE object reference to prevent useEffect loops
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => mockParams,
  usePathname: () => '/bloom-base/aurora',
  useSearchParams: () => new URLSearchParams(),
  notFound: () => mockNotFound(),
}))

// Mock @/lib/auth
vi.mock('@/lib/auth', () => ({
  redirectToLogin: (...args: unknown[]) => mockRedirectToLogin(...args),
}))

// Mock child components that aren't under test
vi.mock('@/components/SearchPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="search-panel">SearchPanel</div>,
}))
vi.mock('@/components/EvalDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="eval-dashboard">EvalDashboard</div>,
}))
vi.mock('@/components/AgentWorkspace', () => ({
  __esModule: true,
  default: () => <div data-testid="agent-workspace">AgentWorkspace</div>,
}))
vi.mock('@/components/DiffViewer', () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="diff-viewer">
      DiffViewer
      <button onClick={onClose}>Close diff</button>
    </div>
  ),
}))

// Mock the API module
vi.mock('@/lib/api', () => ({
  getProjectByPath: vi.fn(),
  getProjectLedger: vi.fn(),
  listConversations: vi.fn(),
  getQueueStatus: vi.fn(),
  getProjectAnalytics: vi.fn(),
  getCurrentUser: vi.fn(),
  getActiveSponsor: vi.fn(),
  getProjectSponsors: vi.fn(),
  getProjectContributors: vi.fn(),
  getProjectEvals: vi.fn(),
  getDeployStatus: vi.fn(),
  getDeployments: vi.fn(),
  getTaskProgress: vi.fn(),
  getTaskPRs: vi.fn(),
  getTaskPRFiles: vi.fn(),
  streamTaskEvents: vi.fn(),
  cancelTask: vi.fn(),
  pauseTask: vi.fn(),
  resumeTask: vi.fn(),
  sendTaskGuidance: vi.fn(),
  forkProject: vi.fn(),
  deleteConversation: vi.fn(),
  createSponsorshipCheckout: vi.fn(),
  getFollowStatus: vi.fn(),
  followProject: vi.fn(),
  unfollowProject: vi.fn(),
  getProjectReadme: vi.fn(),
  getTaskCost: vi.fn(),
  getTaskEval: vi.fn(),
}))

import ProjectPage from './page'
import * as api from '@/lib/api'

// ── Mock Data ──────────────────────────────────────────────────

const mockProject = {
  id: 'proj-1',
  name: 'Aurora',
  description: 'An AI weather app',
  github_repo: 'bloom-base/aurora',
  owner_id: 'user-1',
  is_public: true,
  vision: 'Predict the weather with AI',
  deployed_url: null as string | null,
  deploy_status: null as string | null,
  fly_app_name: null as string | null,
  deploy_error: null as string | null,
  created_at: '2026-01-15T00:00:00Z',
}

const mockTasks = [
  {
    id: 'task-1',
    project_id: 'proj-1',
    title: 'Add dark mode',
    description: 'Implement dark mode toggle',
    status: 'completed' as const,
    priority: 3,
    proposed_by: 'user-2',
    conversation_id: 'conv-1',
    github_pr_url: 'https://github.com/bloom-base/aurora/pull/1',
    created_at: '2026-01-20T00:00:00Z',
    current_stage: 0,
    started_at: '2026-01-20T01:00:00Z',
    completed_at: '2026-01-20T02:00:00Z',
  },
]

const mockSponsors = [
  {
    id: 'sponsor-1',
    project_id: 'proj-1',
    sponsor_id: 'user-3',
    sponsor_username: 'alice',
    sponsor_avatar_url: 'https://github.com/alice.png',
    display_name: 'Alice',
    is_company: false,
    monthly_amount_usd: 10,
    total_contributed_usd: 50,
    status: 'active',
    is_active: true,
    started_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'sponsor-2',
    project_id: 'proj-1',
    sponsor_id: 'user-4',
    sponsor_username: 'bobcorp',
    sponsor_avatar_url: 'https://github.com/bobcorp.png',
    display_name: 'Bob Corp',
    is_company: true,
    monthly_amount_usd: 100,
    total_contributed_usd: 500,
    status: 'active',
    is_active: true,
    started_at: '2026-01-05T00:00:00Z',
  },
]

const mockQueueStatus = {
  queue_counts: {},
  current_task: null,
  active_tasks: [],
  total_pending: 0,
}

const mockLoggedInUser: api.UserProfile = {
  id: 'user-99',
  username: 'testuser',
  handle: null,
  display_name: 'Test User',
  bio: null,
  github_username: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  subscription_tier: 'pro',
  is_admin: false,
  has_anthropic_key: false,
  email_verified: true,
  has_github: true,
  has_password: true,
  email_notifications: true,
}

const mockConversations: api.Conversation[] = [
  {
    id: 'conv-100',
    project_id: 'proj-1',
    user_id: 'user-99',
    outcome: 'task_created',
    preview: 'Add a weather widget',
    created_at: '2026-01-25T00:00:00Z',
  },
  {
    id: 'conv-101',
    project_id: 'proj-1',
    user_id: 'user-99',
    outcome: 'ongoing',
    preview: 'Improve the UI colors',
    created_at: '2026-01-26T00:00:00Z',
  },
]

// ── Setup Helper ───────────────────────────────────────────────

function setupMocks(overrides: {
  project?: Partial<typeof mockProject>
  sponsors?: typeof mockSponsors
  analytics?: Partial<api.ProjectAnalytics> | null
  loggedIn?: boolean
  user?: Partial<api.UserProfile>
  conversations?: api.Conversation[]
  tasks?: Partial<(typeof mockTasks)[0]>[]
  followStatus?: api.FollowStatus | null
  contributors?: api.ProjectContributor[]
} = {}) {
  const project = { ...mockProject, ...overrides.project }
  const sponsorItems = overrides.sponsors ?? []
  const user = overrides.loggedIn !== false
    ? { ...mockLoggedInUser, ...overrides.user }
    : null
  const conversations = overrides.conversations ?? []
  const taskItems = overrides.tasks
    ? overrides.tasks.map((t, i) => ({ ...mockTasks[0], id: `task-${i}`, ...t }))
    : mockTasks

  vi.mocked(api.getProjectByPath).mockResolvedValue(project as api.Project)
  vi.mocked(api.getProjectLedger).mockResolvedValue({ items: taskItems as api.LedgerTask[], total: taskItems.length, limit: 50, offset: 0 })
  vi.mocked(api.listConversations).mockResolvedValue({ items: conversations as api.Conversation[], total: conversations.length })
  vi.mocked(api.getQueueStatus).mockResolvedValue(mockQueueStatus)
  vi.mocked(api.getProjectAnalytics).mockResolvedValue(overrides.analytics as api.ProjectAnalytics ?? null as unknown as api.ProjectAnalytics)

  if (user) {
    vi.mocked(api.getCurrentUser).mockResolvedValue(user as api.UserProfile)
  } else {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
  }

  vi.mocked(api.getActiveSponsor).mockResolvedValue(null)
  vi.mocked(api.getProjectSponsors).mockResolvedValue({ items: sponsorItems as api.Sponsorship[], total: sponsorItems.length, limit: 50, offset: 0 })
  vi.mocked(api.getProjectContributors).mockResolvedValue(overrides.contributors ?? [])
  vi.mocked(api.getProjectEvals).mockResolvedValue({ task_count: 0, avg_quality_score: null, avg_completion: null, avg_efficiency: null, avg_cost: null, avg_reliability: null, trend: null, recent_evals: [] } as api.ProjectEvalSummary)
  vi.mocked(api.getDeployStatus).mockResolvedValue({ deploy_status: project.deploy_status, deployed_url: project.deployed_url } as any)
  vi.mocked(api.getDeployments).mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 })
  vi.mocked(api.getTaskPRs).mockResolvedValue([])
  vi.mocked(api.getFollowStatus).mockResolvedValue(overrides.followStatus ?? { following: false, follower_count: 0 })
  vi.mocked(api.getProjectReadme).mockResolvedValue({ content: null })
  vi.mocked(api.getTaskCost).mockResolvedValue({ task_id: '', total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0, per_turn: [] })
  vi.mocked(api.getTaskEval).mockResolvedValue({ task_id: '', eval: null })

  return project
}

// ── Tests ──────────────────────────────────────────────────────

describe('ProjectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.confirm to default
    vi.spyOn(window, 'confirm').mockRestore()
  })

  // ────────────────────────────────────────────────────────────
  // EXISTING TESTS (preserved exactly)
  // ────────────────────────────────────────────────────────────

  describe('Deployment Button', () => {
    it('shows deploy link when deploy_status is deployed', async () => {
      setupMocks({ project: { deployed_url: 'https://aurora.fly.dev', deploy_status: 'deployed' } })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByTitle('Open in new tab')).toBeInTheDocument()
      })

      const link = screen.getByTitle('Open in new tab').closest('a')
      expect(link).toHaveAttribute('href', 'https://aurora.fly.dev')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('does not show deploy button when deploy_status is null', async () => {
      setupMocks({ project: { deployed_url: null, deploy_status: null } })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('View App')).not.toBeInTheDocument()
      expect(screen.queryByText('Deploying...')).not.toBeInTheDocument()
      expect(screen.queryByText('Deploy failed')).not.toBeInTheDocument()
    })

    it('shows "Deploying..." when deploy_status is deploying', async () => {
      setupMocks({ project: { deploy_status: 'deploying', deployed_url: null } })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Deploying...')).toBeInTheDocument()
      })
    })

    it('shows "Deploy Failed" when deploy_status is failed', async () => {
      setupMocks({ project: { deploy_status: 'failed', deploy_error: 'flyctl timeout', deployed_url: null } })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Deploy failed')).toBeInTheDocument()
      })
    })

    it('deployment button links to the correct URL', async () => {
      const deployedUrl = 'https://my-custom-app.fly.dev'
      setupMocks({ project: { deployed_url: deployedUrl, deploy_status: 'deployed' } })

      render(<ProjectPage />)

      await waitFor(() => {
        const link = screen.getByTitle('Open in new tab').closest('a')
        expect(link?.getAttribute('href')).toBe(deployedUrl)
      })
    })
  })

  describe('Top Contributors Inline', () => {
    it('renders contributors inline with vision', async () => {
      setupMocks({ sponsors: mockSponsors })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Top Contributors')).toBeInTheDocument()
      })

      // Contributors should show names and amounts
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('$50')).toBeInTheDocument()
      expect(screen.getByText('Bob Corp')).toBeInTheDocument()
      expect(screen.getByText('$500')).toBeInTheDocument()
    })

    it('does not render contributors section when empty', async () => {
      setupMocks({ sponsors: [] })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Top Contributors')).not.toBeInTheDocument()
    })

    it('shows at most 3 contributors', async () => {
      const manySponsors = [
        ...mockSponsors,
        { ...mockSponsors[0], id: 'sponsor-3', sponsor_username: 'charlie', display_name: 'Charlie', total_contributed_usd: 25 },
        { ...mockSponsors[0], id: 'sponsor-4', sponsor_username: 'diana', display_name: 'Diana', total_contributed_usd: 10 },
      ]
      setupMocks({ sponsors: manySponsors })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Top Contributors')).toBeInTheDocument()
      })

      // First 3 should show
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob Corp')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()

      // 4th should not
      expect(screen.queryByText('Diana')).not.toBeInTheDocument()
    })
  })

  describe('Vision Section', () => {
    it('renders vision text', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Predict the weather with AI')).toBeInTheDocument()
      })

      expect(screen.getByText('Vision')).toBeInTheDocument()
    })
  })

  describe('Project Header', () => {
    it('renders project name and description', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
        expect(screen.getByText('An AI weather app')).toBeInTheDocument()
      })
    })

    it('renders org name from URL params', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('bloom-base')).toBeInTheDocument()
      })
    })

    it('shows GitHub link', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        const ghLink = screen.getByTitle('View on GitHub')
        expect(ghLink).toHaveAttribute('href', 'https://github.com/bloom-base/aurora')
      })
    })
  })

  describe('Task List', () => {
    it('renders completed tasks', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Add dark mode')).toBeInTheDocument()
        expect(screen.getByText('Done')).toBeInTheDocument()
      })
    })

    it('shows PR link on completed tasks', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('PR')).toBeInTheDocument()
      })

      const prLink = screen.getByText('PR')
      expect(prLink).toHaveAttribute('href', 'https://github.com/bloom-base/aurora/pull/1')
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Follow/Unfollow
  // ────────────────────────────────────────────────────────────

  describe('Follow/Unfollow Button', () => {
    it('shows Follow button for logged-in user who does not own the project', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-99', subscription_tier: 'free' },
        followStatus: { following: false, follower_count: 5 },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })
      // Shows follower count
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('shows Following button when already following', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-99' },
        followStatus: { following: true, follower_count: 10 },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })
    })

    it('does not show Follow button for project owner', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-1' }, // Same as project owner_id
        followStatus: { following: false, follower_count: 0 },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Follow')).not.toBeInTheDocument()
    })

    it('does not show Follow button when not logged in', async () => {
      setupMocks({ loggedIn: false })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Follow')).not.toBeInTheDocument()
    })

    it('calls followProject when Follow button is clicked', async () => {
      vi.mocked(api.followProject).mockResolvedValue({ following: true, follower_count: 6 })

      setupMocks({
        loggedIn: true,
        user: { id: 'user-99' },
        followStatus: { following: false, follower_count: 5 },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Follow'))

      await waitFor(() => {
        expect(api.followProject).toHaveBeenCalledWith('proj-1')
      })

      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })

      expect(mockToast.success).toHaveBeenCalledWith('Following project')
    })

    it('calls unfollowProject when Following button is clicked', async () => {
      vi.mocked(api.unfollowProject).mockResolvedValue({ following: false, follower_count: 9 })

      setupMocks({
        loggedIn: true,
        user: { id: 'user-99' },
        followStatus: { following: true, follower_count: 10 },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Following')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Following'))

      await waitFor(() => {
        expect(api.unfollowProject).toHaveBeenCalledWith('proj-1')
      })

      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      expect(mockToast.success).toHaveBeenCalledWith('Unfollowed project')
    })

    it('shows error toast when follow fails', async () => {
      vi.mocked(api.followProject).mockRejectedValue(new Error('Network error'))

      setupMocks({
        loggedIn: true,
        user: { id: 'user-99' },
        followStatus: { following: false, follower_count: 0 },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Follow'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Network error')
      })
    })

    it('does not show follower count when zero', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-99' },
        followStatus: { following: false, follower_count: 0 },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Follow')).toBeInTheDocument()
      })

      // The button should contain only the "Follow" text (no count span)
      const followBtn = screen.getByText('Follow').closest('button')!
      expect(followBtn.querySelector('.text-xs.text-gray-400')).not.toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Fork Button
  // ────────────────────────────────────────────────────────────

  describe('Fork Button', () => {
    it('shows Fork button for logged-in Pro user who does not own the project', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-99', subscription_tier: 'pro' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Fork')).toBeInTheDocument()
      })
    })

    it('does not show Fork button for free-tier user', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-99', subscription_tier: 'free' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Fork')).not.toBeInTheDocument()
    })

    it('does not show Fork button for project owner', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-1', subscription_tier: 'pro' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Fork')).not.toBeInTheDocument()
    })

    it('does not show Fork button when not logged in', async () => {
      setupMocks({ loggedIn: false })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Fork')).not.toBeInTheDocument()
    })

    it('does not show Fork button for private projects', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-99', subscription_tier: 'pro' },
        project: { is_public: false },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Fork')).not.toBeInTheDocument()
    })

    it('calls forkProject and navigates on success', async () => {
      vi.mocked(api.forkProject).mockResolvedValue({
        ...mockProject,
        id: 'proj-forked',
        github_repo: 'testuser/aurora',
      } as api.Project)

      setupMocks({
        loggedIn: true,
        user: { id: 'user-99', subscription_tier: 'pro' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Fork')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Fork'))

      await waitFor(() => {
        expect(api.forkProject).toHaveBeenCalledWith('proj-1')
      })

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Project forked successfully')
        expect(mockPush).toHaveBeenCalledWith('/testuser/aurora')
      })
    })

    it('shows error toast when fork fails', async () => {
      vi.mocked(api.forkProject).mockRejectedValue(new Error('Fork limit reached'))

      setupMocks({
        loggedIn: true,
        user: { id: 'user-99', subscription_tier: 'pro' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Fork')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Fork'))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Fork limit reached')
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Contribute Idea / Start Chatting
  // ────────────────────────────────────────────────────────────

  describe('Contribute Idea Button', () => {
    it('renders as a Link to chat when logged in', async () => {
      setupMocks({ loggedIn: true })

      render(<ProjectPage />)

      await waitFor(() => {
        const contributeLink = screen.getByText('Contribute idea')
        expect(contributeLink.closest('a')).toHaveAttribute('href', '/bloom-base/aurora/chat')
      })
    })

    it('calls redirectToLogin when clicked while not logged in', async () => {
      setupMocks({ loggedIn: false })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Contribute idea')).toBeInTheDocument()
      })

      // When not logged in, it's a <button> not a <Link>
      const btn = screen.getByText('Contribute idea')
      expect(btn.tagName).toBe('BUTTON')

      fireEvent.click(btn)

      expect(mockRedirectToLogin).toHaveBeenCalledWith('/bloom-base/aurora/chat')
    })

    it('shows Sponsor link', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        const sponsorLink = screen.getByText('Sponsor')
        expect(sponsorLink.closest('a')).toHaveAttribute('href', '/bloom-base/aurora/sponsor')
      })
    })

    it('shows Governance link', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        const govLink = screen.getByText('Governance')
        expect(govLink.closest('a')).toHaveAttribute('href', '/bloom-base/aurora/council')
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Empty Queue - "Sign in to contribute" / "Contribute an idea"
  // ────────────────────────────────────────────────────────────

  describe('Empty Queue CTA', () => {
    it('shows "Contribute an idea" link in empty queue when logged in', async () => {
      setupMocks({
        loggedIn: true,
        tasks: [{ status: 'completed' as const }], // only completed, none queued
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('No ideas in queue')).toBeInTheDocument()
      })

      const link = screen.getByText('Contribute an idea')
      expect(link.closest('a')).toHaveAttribute('href', '/bloom-base/aurora/chat')
    })

    it('shows "Sign in to contribute" button when not logged in', async () => {
      setupMocks({
        loggedIn: false,
        tasks: [{ status: 'completed' as const }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('No ideas in queue')).toBeInTheDocument()
      })

      const btn = screen.getByText('Sign in to contribute')
      expect(btn.tagName).toBe('BUTTON')

      fireEvent.click(btn)

      expect(mockRedirectToLogin).toHaveBeenCalledWith('/bloom-base/aurora/chat')
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Preview Toggle
  // ────────────────────────────────────────────────────────────

  describe('Preview Toggle', () => {
    it('shows Preview button when project is deployed', async () => {
      setupMocks({
        project: { deployed_url: 'https://aurora.fly.dev', deploy_status: 'deployed' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument()
      })
    })

    it('does not show Preview button when not deployed', async () => {
      setupMocks({
        project: { deployed_url: null, deploy_status: null },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Preview')).not.toBeInTheDocument()
    })

    it('opens preview panel when Preview is clicked', async () => {
      setupMocks({
        project: { deployed_url: 'https://aurora.fly.dev', deploy_status: 'deployed' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Preview'))

      await waitFor(() => {
        // Preview button changes text to "Close preview"
        expect(screen.getByText('Close preview')).toBeInTheDocument()
        // The iframe should be rendered with the preview URL
        expect(screen.getByTitle('App preview')).toHaveAttribute('src', 'https://aurora.fly.dev')
      })
    })

    it('closes preview panel when "Close preview" is clicked', async () => {
      setupMocks({
        project: { deployed_url: 'https://aurora.fly.dev', deploy_status: 'deployed' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument()
      })

      // Open
      fireEvent.click(screen.getByText('Preview'))

      await waitFor(() => {
        expect(screen.getByText('Close preview')).toBeInTheDocument()
      })

      // Close
      fireEvent.click(screen.getByText('Close preview'))

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument()
        expect(screen.queryByTitle('App preview')).not.toBeInTheDocument()
      })
    })

    it('preview panel shows URL in toolbar', async () => {
      setupMocks({
        project: { deployed_url: 'https://aurora.fly.dev', deploy_status: 'deployed' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Preview'))

      await waitFor(() => {
        expect(screen.getByText('https://aurora.fly.dev')).toBeInTheDocument()
      })
    })

    it('preview panel has close button that calls onClose', async () => {
      setupMocks({
        project: { deployed_url: 'https://aurora.fly.dev', deploy_status: 'deployed' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Preview'))

      await waitFor(() => {
        // There are two elements with title "Close preview": the toggle button and the X button
        const closeButtons = screen.getAllByTitle('Close preview')
        expect(closeButtons.length).toBe(2)
      })

      // Click the X button in the preview toolbar (the second one with the SVG icon)
      const closeButtons = screen.getAllByTitle('Close preview')
      fireEvent.click(closeButtons[1])

      await waitFor(() => {
        expect(screen.queryByTitle('App preview')).not.toBeInTheDocument()
      })
    })

    it('preview panel expand/collapse button toggles height', async () => {
      setupMocks({
        project: { deployed_url: 'https://aurora.fly.dev', deploy_status: 'deployed' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Preview'))

      await waitFor(() => {
        expect(screen.getByTitle('Expand')).toBeInTheDocument()
      })

      // Click expand
      fireEvent.click(screen.getByTitle('Expand'))

      await waitFor(() => {
        expect(screen.getByTitle('Collapse')).toBeInTheDocument()
      })

      // Click collapse
      fireEvent.click(screen.getByTitle('Collapse'))

      await waitFor(() => {
        expect(screen.getByTitle('Expand')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Delete Conversation
  // ────────────────────────────────────────────────────────────

  describe('Delete Conversation', () => {
    it('renders conversations with delete buttons', async () => {
      setupMocks({ conversations: mockConversations })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Recent Conversations')).toBeInTheDocument()
      })

      expect(screen.getByText('Add a weather widget')).toBeInTheDocument()
      expect(screen.getByText('Improve the UI colors')).toBeInTheDocument()

      // Each conversation has a delete button
      const deleteButtons = screen.getAllByTitle('Delete')
      expect(deleteButtons.length).toBe(2)
    })

    it('deletes conversation when confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      vi.mocked(api.deleteConversation).mockResolvedValue(undefined as any)

      setupMocks({ conversations: mockConversations })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Add a weather widget')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith('Delete this conversation?')
        expect(api.deleteConversation).toHaveBeenCalledWith('conv-100')
      })

      // Conversation should be removed from the list
      await waitFor(() => {
        expect(screen.queryByText('Add a weather widget')).not.toBeInTheDocument()
      })

      // The other conversation should still be there
      expect(screen.getByText('Improve the UI colors')).toBeInTheDocument()

      expect(mockToast).toHaveBeenCalledWith('Conversation deleted')
    })

    it('does not delete conversation when cancelled', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      setupMocks({ conversations: mockConversations })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Add a weather widget')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      fireEvent.click(deleteButtons[0])

      expect(window.confirm).toHaveBeenCalledWith('Delete this conversation?')
      expect(api.deleteConversation).not.toHaveBeenCalled()
      expect(screen.getByText('Add a weather widget')).toBeInTheDocument()
    })

    it('shows error toast when delete fails', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      vi.mocked(api.deleteConversation).mockRejectedValue(new Error('Server error'))

      setupMocks({ conversations: mockConversations })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Add a weather widget')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByTitle('Delete')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Failed to delete conversation')
      })
    })

    it('shows conversation outcome badges', async () => {
      setupMocks({ conversations: mockConversations })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Task created')).toBeInTheDocument()
        expect(screen.getByText('Ongoing')).toBeInTheDocument()
      })
    })

    it('conversation links to the correct chat URL', async () => {
      setupMocks({ conversations: mockConversations })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Add a weather widget')).toBeInTheDocument()
      })

      const convLink = screen.getByText('Add a weather widget').closest('a')
      expect(convLink).toHaveAttribute('href', '/bloom-base/aurora/chat/conv-100')
    })

    it('does not show conversations section when there are none', async () => {
      setupMocks({ conversations: [] })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Recent Conversations')).not.toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: TaskCard expand/collapse
  // ────────────────────────────────────────────────────────────

  describe('TaskCard Expand/Collapse', () => {
    it('expands completed task card on click and loads progress', async () => {
      vi.mocked(api.getTaskProgress).mockResolvedValue([
        { type: 'turn_start', turn: 1, timestamp: '' },
        { type: 'agent_text', text: 'Analyzing codebase...', timestamp: '' },
      ] as api.TaskStreamEvent[])

      setupMocks({
        tasks: [{
          id: 'task-completed-1',
          status: 'completed' as const,
          title: 'Fix login bug',
          description: 'Fix the login issue',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Fix login bug')).toBeInTheDocument()
      })

      // The expand arrow should be visible
      expect(screen.getByText('\u25b6')).toBeInTheDocument()

      // Click to expand
      const card = screen.getByText('Fix login bug').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(api.getTaskProgress).toHaveBeenCalledWith('task-completed-1')
      })

      // Expand arrow changes to down
      await waitFor(() => {
        expect(screen.getByText('\u25bc')).toBeInTheDocument()
      })
    })

    it('collapses expanded task card on second click', async () => {
      vi.mocked(api.getTaskProgress).mockResolvedValue([])

      setupMocks({
        tasks: [{
          id: 'task-collapse',
          status: 'completed' as const,
          title: 'Test task',
          description: 'For testing collapse',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Test task')).toBeInTheDocument()
      })

      const card = screen.getByText('Test task').closest('[role="button"]')!

      // Click to expand
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('\u25bc')).toBeInTheDocument()
      })

      // Click to collapse
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('\u25b6')).toBeInTheDocument()
      })
    })

    it('shows "No progress data available" when task has no progress events', async () => {
      vi.mocked(api.getTaskProgress).mockResolvedValue([])

      setupMocks({
        tasks: [{
          id: 'task-no-progress',
          status: 'completed' as const,
          title: 'Empty task',
          description: 'No events',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Empty task')).toBeInTheDocument()
      })

      const card = screen.getByText('Empty task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('No progress data available')).toBeInTheDocument()
      })
    })

    it('shows loading state while fetching progress', async () => {
      // Make the progress API slow
      let resolveProgress: (value: api.TaskStreamEvent[]) => void
      vi.mocked(api.getTaskProgress).mockImplementation(() =>
        new Promise((resolve) => { resolveProgress = resolve })
      )

      setupMocks({
        tasks: [{
          id: 'task-loading',
          status: 'completed' as const,
          title: 'Loading task',
          description: 'Checking loading',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Loading task')).toBeInTheDocument()
      })

      const card = screen.getByText('Loading task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('Loading agent work...')).toBeInTheDocument()
      })

      // Resolve the promise
      resolveProgress!([])

      await waitFor(() => {
        expect(screen.queryByText('Loading agent work...')).not.toBeInTheDocument()
      })
    })

    it('shows "View original conversation" link when task has conversation_id', async () => {
      vi.mocked(api.getTaskProgress).mockResolvedValue([])

      setupMocks({
        tasks: [{
          id: 'task-with-conv',
          status: 'completed' as const,
          title: 'Task with conversation',
          description: 'Has conv link',
          conversation_id: 'conv-xyz',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Task with conversation')).toBeInTheDocument()
      })

      const card = screen.getByText('Task with conversation').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        const convLink = screen.getByText('View original conversation')
        expect(convLink.closest('a')).toHaveAttribute('href', '/bloom-base/aurora/chat/conv-xyz')
      })
    })

    it('supports keyboard expand/collapse with Enter key', async () => {
      vi.mocked(api.getTaskProgress).mockResolvedValue([])

      setupMocks({
        tasks: [{
          id: 'task-keyboard',
          status: 'completed' as const,
          title: 'Keyboard task',
          description: 'Test keyboard',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Keyboard task')).toBeInTheDocument()
      })

      const card = screen.getByText('Keyboard task').closest('[role="button"]')!

      // Press Enter to expand
      fireEvent.keyDown(card, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.getByText('\u25bc')).toBeInTheDocument()
      })
    })

    it('supports keyboard expand/collapse with Space key', async () => {
      vi.mocked(api.getTaskProgress).mockResolvedValue([])

      setupMocks({
        tasks: [{
          id: 'task-keyboard-space',
          status: 'completed' as const,
          title: 'Space task',
          description: 'Test space key',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Space task')).toBeInTheDocument()
      })

      const card = screen.getByText('Space task').closest('[role="button"]')!

      fireEvent.keyDown(card, { key: ' ' })

      await waitFor(() => {
        expect(screen.getByText('\u25bc')).toBeInTheDocument()
      })
    })

    it('does not expand non-expandable (queued/proposed) tasks', async () => {
      setupMocks({
        tasks: [{
          id: 'task-proposed',
          status: 'proposed' as const,
          title: 'Proposed task',
          description: 'Cannot expand',
          current_stage: 0,
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Proposed task')).toBeInTheDocument()
      })

      // No expand arrow should be present
      expect(screen.queryByText('\u25b6')).not.toBeInTheDocument()
      expect(screen.queryByText('\u25bc')).not.toBeInTheDocument()
    })

    it('shows duration on completed tasks with start/end times', async () => {
      setupMocks({
        tasks: [{
          id: 'task-dur',
          status: 'completed' as const,
          title: 'Duration task',
          description: 'Has duration',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z', // 1 hour = 60 minutes
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Duration task')).toBeInTheDocument()
      })

      // 3600 seconds / 60 = 60m
      expect(screen.getByText('60m')).toBeInTheDocument()
    })

    it('shows multi-stage badge when task has multiple stages', async () => {
      vi.mocked(api.getTaskPRs).mockResolvedValue([])

      setupMocks({
        tasks: [{
          id: 'task-multi',
          status: 'completed' as const,
          title: 'Multi-stage task',
          description: 'Has stages',
          current_stage: 2,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Multi-stage task')).toBeInTheDocument()
      })

      expect(screen.getByText('3 stages')).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Diff Button on TaskCard
  // ────────────────────────────────────────────────────────────

  describe('TaskCard Diff Button', () => {
    it('shows Diff button on completed tasks with PR URL', async () => {
      setupMocks({
        tasks: [{
          id: 'task-diff',
          status: 'completed' as const,
          title: 'Diff task',
          description: 'Has PR',
          github_pr_url: 'https://github.com/bloom-base/aurora/pull/5',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Diff')).toBeInTheDocument()
      })
    })

    it('loads diff files when Diff button is clicked', async () => {
      vi.mocked(api.getTaskPRFiles).mockResolvedValue([
        { filename: 'src/main.ts', status: 'modified', additions: 5, deletions: 2, patch: '+code' },
      ] as api.PRFileChange[])

      setupMocks({
        tasks: [{
          id: 'task-diff-click',
          status: 'completed' as const,
          title: 'Diff click task',
          description: 'Click diff',
          github_pr_url: 'https://github.com/bloom-base/aurora/pull/7',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })
      vi.mocked(api.getTaskProgress).mockResolvedValue([])

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Diff')).toBeInTheDocument()
      })

      // First expand the card (DiffViewer renders inside expanded section)
      const card = screen.getByText('Diff click task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('\u25bc')).toBeInTheDocument()
      })

      // Now click the Diff button
      fireEvent.click(screen.getByText('Diff'))

      await waitFor(() => {
        expect(api.getTaskPRFiles).toHaveBeenCalledWith('task-diff-click', 7)
      })

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
      })
    })

    it('toggles diff off when Diff button is clicked again', async () => {
      vi.mocked(api.getTaskPRFiles).mockResolvedValue([])

      setupMocks({
        tasks: [{
          id: 'task-diff-toggle',
          status: 'completed' as const,
          title: 'Diff toggle task',
          description: 'Toggle diff',
          github_pr_url: 'https://github.com/bloom-base/aurora/pull/8',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })
      vi.mocked(api.getTaskProgress).mockResolvedValue([])

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Diff')).toBeInTheDocument()
      })

      // First expand the card
      const card = screen.getByText('Diff toggle task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('\u25bc')).toBeInTheDocument()
      })

      // Open diff
      fireEvent.click(screen.getByText('Diff'))

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
      })

      // Click diff again to close
      fireEvent.click(screen.getByText('Diff'))

      await waitFor(() => {
        expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Show All Completed Tasks Toggle
  // ────────────────────────────────────────────────────────────

  describe('Show All Completed Tasks', () => {
    it('shows "+N more" button when there are more than 5 completed tasks', async () => {
      const manyTasks = Array.from({ length: 8 }, (_, i) => ({
        id: `task-c-${i}`,
        status: 'completed' as const,
        title: `Completed task ${i}`,
        description: `Task ${i} desc`,
        current_stage: 0,
        created_at: `2026-01-${20 + i}T00:00:00Z`,
        started_at: `2026-01-${20 + i}T01:00:00Z`,
        completed_at: `2026-01-${20 + i}T02:00:00Z`,
      }))

      setupMocks({ tasks: manyTasks })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('+3 more')).toBeInTheDocument()
      })
    })

    it('expands to show all completed tasks when "+N more" is clicked', async () => {
      const manyTasks = Array.from({ length: 7 }, (_, i) => ({
        id: `task-expand-${i}`,
        status: 'completed' as const,
        title: `Expand task ${i}`,
        description: `Expand desc ${i}`,
        current_stage: 0,
        created_at: `2026-01-${20 + i}T00:00:00Z`,
        started_at: `2026-01-${20 + i}T01:00:00Z`,
        completed_at: `2026-01-${20 + i}T02:00:00Z`,
      }))

      setupMocks({ tasks: manyTasks })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('+2 more')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('+2 more'))

      await waitFor(() => {
        expect(screen.getByText('Show less')).toBeInTheDocument()
      })

      // All 7 tasks should be visible
      for (let i = 0; i < 7; i++) {
        expect(screen.getByText(`Expand task ${i}`)).toBeInTheDocument()
      }
    })

    it('collapses back to 5 when "Show less" is clicked', async () => {
      const manyTasks = Array.from({ length: 7 }, (_, i) => ({
        id: `task-collapse-${i}`,
        status: 'completed' as const,
        title: `Collapse task ${i}`,
        description: `Collapse desc ${i}`,
        current_stage: 0,
        created_at: `2026-01-${20 + i}T00:00:00Z`,
        started_at: `2026-01-${20 + i}T01:00:00Z`,
        completed_at: `2026-01-${20 + i}T02:00:00Z`,
      }))

      setupMocks({ tasks: manyTasks })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('+2 more')).toBeInTheDocument()
      })

      // Expand
      fireEvent.click(screen.getByText('+2 more'))

      await waitFor(() => {
        expect(screen.getByText('Show less')).toBeInTheDocument()
      })

      // Collapse
      fireEvent.click(screen.getByText('Show less'))

      await waitFor(() => {
        expect(screen.getByText('+2 more')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Settings Link (Owner Only)
  // ────────────────────────────────────────────────────────────

  describe('Settings Link', () => {
    it('shows settings link for project owner', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-1' }, // Same as mockProject.owner_id
      })

      render(<ProjectPage />)

      await waitFor(() => {
        const settingsLink = screen.getByTitle('Settings')
        expect(settingsLink.closest('a')).toHaveAttribute('href', '/bloom-base/aurora/settings')
      })
    })

    it('does not show settings link for non-owner', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-99' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByTitle('Settings')).not.toBeInTheDocument()
    })

    it('does not show settings link when not logged in', async () => {
      setupMocks({ loggedIn: false })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByTitle('Settings')).not.toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Active / In-Progress Tasks Section
  // ────────────────────────────────────────────────────────────

  describe('Active Tasks Section', () => {
    it('shows "In Progress" section when there are active tasks', async () => {
      setupMocks({
        tasks: [
          { id: 'active-1', status: 'in_progress' as const, title: 'Working on auth', description: 'Auth module', current_stage: 0 },
        ],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('In Progress')).toBeInTheDocument()
        expect(screen.getByText('Working on auth')).toBeInTheDocument()
        expect(screen.getByText('Working')).toBeInTheDocument()
      })
    })

    it('does not show "In Progress" section when no active tasks', async () => {
      setupMocks({
        tasks: [{ id: 'done-1', status: 'completed' as const, title: 'Done task', description: 'Done', current_stage: 0 }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Done task')).toBeInTheDocument()
      })

      expect(screen.queryByText('In Progress')).not.toBeInTheDocument()
    })

    it('shows parallel tasks count when multiple tasks are in progress', async () => {
      setupMocks({
        tasks: [
          { id: 'active-a', status: 'in_progress' as const, title: 'Task A', description: 'A', current_stage: 0 },
          { id: 'active-b', status: 'in_progress' as const, title: 'Task B', description: 'B', current_stage: 0 },
        ],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('2 parallel tasks')).toBeInTheDocument()
      })
    })

    it('shows paused tasks in active section', async () => {
      setupMocks({
        tasks: [
          { id: 'paused-1', status: 'paused' as const, title: 'Paused task', description: 'Waiting for input', current_stage: 0 },
        ],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('In Progress')).toBeInTheDocument()
        expect(screen.getByText('Paused task')).toBeInTheDocument()
        // Status label
        expect(screen.getByText('Paused')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Queue Section
  // ────────────────────────────────────────────────────────────

  describe('Queue Section', () => {
    it('shows queued tasks in the Queue section', async () => {
      setupMocks({
        tasks: [
          { id: 'q-1', status: 'accepted' as const, title: 'Queued task', description: 'Waiting', current_stage: 0 },
          { id: 'q-2', status: 'proposed' as const, title: 'Proposed task', description: 'Waiting too', current_stage: 0 },
        ],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Queue')).toBeInTheDocument()
        expect(screen.getByText('2 pending')).toBeInTheDocument()
        expect(screen.getByText('Queued task')).toBeInTheDocument()
        expect(screen.getByText('Proposed task')).toBeInTheDocument()
      })
    })

    it('shows empty queue message', async () => {
      setupMocks({
        tasks: [{ status: 'completed' as const, title: 'Done', description: 'D', current_stage: 0 }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('No ideas in queue')).toBeInTheDocument()
        expect(screen.getByText('0 pending')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Analytics Section
  // ────────────────────────────────────────────────────────────

  describe('Analytics Section', () => {
    it('shows analytics stats when data is available', async () => {
      setupMocks({
        analytics: {
          tasks: { total: 15, completed: 12, in_progress: 1, pending: 2 },
          cost: { total_cost_usd: 3.45, last_task_cost_usd: 0.25, avg_cost_usd: 0.23 },
          timing: { avg_duration_seconds: 180, median_duration_seconds: 150 },
        } as api.ProjectAnalytics,
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument()
        expect(screen.getByText('15')).toBeInTheDocument()
        expect(screen.getByText('$0.25')).toBeInTheDocument()
        expect(screen.getByText('3m')).toBeInTheDocument()
        expect(screen.getByText('$3.45')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Idea Contributors Section
  // ────────────────────────────────────────────────────────────

  describe('Idea Contributors', () => {
    it('shows contributors section when contributors exist', async () => {
      setupMocks({
        contributors: [
          { username: 'alice', display_name: 'Alice Smith', avatar_url: 'https://avatar.com/alice.png', ideas: 3, shipped: 2 },
          { username: 'bob', display_name: null, avatar_url: null, ideas: 1, shipped: 0 },
        ] as api.ProjectContributor[],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Contributors')).toBeInTheDocument()
        expect(screen.getByText('2 people')).toBeInTheDocument()
      })

      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      expect(screen.getByText('2 shipped')).toBeInTheDocument()
      expect(screen.getByText('bob')).toBeInTheDocument()
      expect(screen.getByText('1 idea')).toBeInTheDocument()
    })

    it('does not show contributors section when empty', async () => {
      setupMocks({ contributors: [] })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByText('Contributors')).not.toBeInTheDocument()
    })

    it('contributor links to user profile', async () => {
      setupMocks({
        contributors: [
          { username: 'alice', display_name: 'Alice', avatar_url: null, ideas: 1, shipped: 0 },
        ] as api.ProjectContributor[],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        const link = screen.getByText('Alice').closest('a')
        expect(link).toHaveAttribute('href', '/u/alice')
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Search Panel (logged in only)
  // ────────────────────────────────────────────────────────────

  describe('Search Panel', () => {
    it('shows SearchPanel when logged in', async () => {
      setupMocks({ loggedIn: true })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByTestId('search-panel')).toBeInTheDocument()
        expect(screen.getByText('Search')).toBeInTheDocument()
      })
    })

    it('does not show SearchPanel when not logged in', async () => {
      setupMocks({ loggedIn: false })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Aurora')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('search-panel')).not.toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Project Not Found
  // ────────────────────────────────────────────────────────────

  describe('Project Not Found', () => {
    it('shows "Project not found" when API returns null', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Project not found')).toBeInTheDocument()
      })

      expect(screen.getByText('Retry')).toBeInTheDocument()
      expect(screen.getByText('Browse projects')).toBeInTheDocument()
    })

    it('Browse projects link goes to /explore', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))

      render(<ProjectPage />)

      await waitFor(() => {
        const browseLink = screen.getByText('Browse projects')
        expect(browseLink.closest('a')).toHaveAttribute('href', '/explore')
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: EvalDashboard rendering
  // ────────────────────────────────────────────────────────────

  describe('EvalDashboard', () => {
    it('renders EvalDashboard component when project loads', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByTestId('eval-dashboard')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Task Cost & Eval Display on Expand
  // ────────────────────────────────────────────────────────────

  describe('Task Cost & Eval on Expand', () => {
    it('shows cost information when task has cost data', async () => {
      setupMocks({
        tasks: [{
          id: 'task-cost',
          status: 'completed' as const,
          title: 'Cost task',
          description: 'Shows cost',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      // Override after setupMocks
      vi.mocked(api.getTaskProgress).mockResolvedValue([])
      vi.mocked(api.getTaskCost).mockResolvedValue({
        task_id: 'task-cost',
        total_input_tokens: 5000,
        total_output_tokens: 3000,
        total_cost_usd: 0.125,
        per_turn: [],
      })
      vi.mocked(api.getTaskEval).mockResolvedValue({ task_id: 'task-cost', eval: null })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Cost task')).toBeInTheDocument()
      })

      const card = screen.getByText('Cost task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('Cost')).toBeInTheDocument()
        expect(screen.getByText('$0.125')).toBeInTheDocument()
        expect(screen.getByText('Tokens')).toBeInTheDocument()
        expect(screen.getByText('8.0k')).toBeInTheDocument()
      })
    })

    it('shows quality score when task has eval data', async () => {
      setupMocks({
        tasks: [{
          id: 'task-eval',
          status: 'completed' as const,
          title: 'Eval task',
          description: 'Shows eval',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      // Override after setupMocks
      vi.mocked(api.getTaskProgress).mockResolvedValue([])
      vi.mocked(api.getTaskCost).mockResolvedValue({
        task_id: 'task-eval',
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cost_usd: 0,
        per_turn: [],
      })
      vi.mocked(api.getTaskEval).mockResolvedValue({
        task_id: 'task-eval',
        eval: {
          quality_score: 85,
          total_turns: 12,
          model_used: 'claude-3-sonnet-20240229',
          completion_score: 90,
          efficiency_score: 80,
          reliability_score: 88,
          summary: 'Good work',
        },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Eval task')).toBeInTheDocument()
      })

      const card = screen.getByText('Eval task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('Quality')).toBeInTheDocument()
        expect(screen.getByText('85/100')).toBeInTheDocument()
        expect(screen.getByText('Turns')).toBeInTheDocument()
        expect(screen.getByText('12')).toBeInTheDocument()
        expect(screen.getByText('Model')).toBeInTheDocument()
        expect(screen.getByText('3-sonnet')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Deployment History Section
  // ────────────────────────────────────────────────────────────

  describe('Deployment History', () => {
    it('shows deployment history section when deployments exist', async () => {
      setupMocks()

      // Override after setupMocks so it's not reset
      vi.mocked(api.getDeployments).mockResolvedValue({
        items: [
          {
            id: 'deploy-1',
            project_id: 'proj-1',
            status: 'deployed',
            commit_sha: 'abc1234567890',
            deployed_at: '2026-01-25T12:00:00Z',
            created_at: '2026-01-25T11:55:00Z',
            public_url: 'https://aurora.fly.dev',
          },
        ] as api.DeploymentHistoryItem[],
        total: 1,
        limit: 10,
        offset: 0,
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Deployments')).toBeInTheDocument()
        expect(screen.getByText('abc1234')).toBeInTheDocument()
      })
    })

    it('shows "No deployments yet" message for project owner when no deployments', async () => {
      setupMocks({
        loggedIn: true,
        user: { id: 'user-1' }, // Same as project owner_id
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('No deployments yet. Use the chat to ask the Maintainer to deploy your project.')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Task Status Badges
  // ────────────────────────────────────────────────────────────

  describe('Task Status Badges', () => {
    it.each([
      ['completed', 'Done'],
      ['incomplete', 'Incomplete'],
      ['rejected', 'Rejected'],
      ['cancelled', 'Cancelled'],
      ['in_progress', 'Working'],
      ['paused', 'Paused'],
      ['accepted', 'Queued'],
      ['proposed', 'Proposed'],
    ])('shows correct label for %s status', async (status, label) => {
      setupMocks({
        tasks: [{
          id: `task-status-${status}`,
          status: status as any,
          title: `${label} task`,
          description: 'Status test',
          current_stage: 0,
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: AgentWorkspace
  // ────────────────────────────────────────────────────────────

  describe('AgentWorkspace', () => {
    it('renders AgentWorkspace when queue status is available', async () => {
      setupMocks()

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByTestId('agent-workspace')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Multi-Stage PR Chain Diff Viewing
  // ────────────────────────────────────────────────────────────

  describe('PR Chain Diff Viewing', () => {
    it('shows PR chain timeline when multi-stage task is expanded', async () => {
      setupMocks({
        tasks: [{
          id: 'task-multi-pr',
          status: 'completed' as const,
          title: 'Multi-stage PR task',
          description: 'Has PR chain',
          current_stage: 1,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
          github_pr_url: 'https://github.com/bloom-base/aurora/pull/11',
        }],
      })

      // Override after setupMocks so they aren't reset
      vi.mocked(api.getTaskProgress).mockResolvedValue([])
      vi.mocked(api.getTaskPRs).mockResolvedValue([
        {
          pr_number: 10,
          pr_url: 'https://github.com/bloom-base/aurora/pull/10',
          stage_number: 0,
          stage_title: 'Initial setup',
          status: 'merged',
          is_final: false,
          done_summary: 'Set up the base structure',
        },
        {
          pr_number: 11,
          pr_url: 'https://github.com/bloom-base/aurora/pull/11',
          stage_number: 1,
          stage_title: 'Add features',
          status: 'open',
          is_final: true,
          done_summary: null,
        },
      ] as api.TaskPR[])

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Multi-stage PR task')).toBeInTheDocument()
      })

      // Expand the task card
      const card = screen.getByText('Multi-stage PR task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('PR Chain')).toBeInTheDocument()
        expect(screen.getByText('#10')).toBeInTheDocument()
        expect(screen.getByText('#11')).toBeInTheDocument()
        expect(screen.getByText('Initial setup')).toBeInTheDocument()
        expect(screen.getByText('Add features')).toBeInTheDocument()
        expect(screen.getByText('merged')).toBeInTheDocument()
        expect(screen.getByText('open')).toBeInTheDocument()
        expect(screen.getByText('final')).toBeInTheDocument()
      })
    })

    it('loads diff for a specific PR in the chain when Diff button is clicked', async () => {
      setupMocks({
        tasks: [{
          id: 'task-chain-diff',
          status: 'completed' as const,
          title: 'Chain diff task',
          description: 'Diff in chain',
          current_stage: 1,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      // Override after setupMocks
      vi.mocked(api.getTaskProgress).mockResolvedValue([])
      vi.mocked(api.getTaskPRs).mockResolvedValue([
        {
          pr_number: 10,
          pr_url: 'https://github.com/bloom-base/aurora/pull/10',
          stage_number: 0,
          stage_title: 'Stage 0',
          status: 'merged',
          is_final: false,
          done_summary: 'Done stage 0',
        },
      ] as api.TaskPR[])
      vi.mocked(api.getTaskPRFiles).mockResolvedValue([
        { filename: 'src/index.ts', status: 'added', additions: 10, deletions: 0, patch: '+new code' },
      ] as api.PRFileChange[])

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Chain diff task')).toBeInTheDocument()
      })

      // Expand the task card
      const card = screen.getByText('Chain diff task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('PR Chain')).toBeInTheDocument()
      })

      // Click the Diff button next to PR #10
      const diffButtons = screen.getAllByText('Diff')
      fireEvent.click(diffButtons[0])

      await waitFor(() => {
        expect(api.getTaskPRFiles).toHaveBeenCalledWith('task-chain-diff', 10)
      })

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
      })
    })

    it('shows done_summary on PR chain entries', async () => {
      setupMocks({
        tasks: [{
          id: 'task-summary',
          status: 'completed' as const,
          title: 'Summary task',
          description: 'Has summary',
          current_stage: 1,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      // Override after setupMocks
      vi.mocked(api.getTaskProgress).mockResolvedValue([])
      vi.mocked(api.getTaskPRs).mockResolvedValue([
        {
          pr_number: 20,
          pr_url: 'https://github.com/bloom-base/aurora/pull/20',
          stage_number: 0,
          stage_title: 'Stage 0',
          status: 'merged',
          is_final: true,
          done_summary: 'Implemented the auth module with tests',
        },
      ] as api.TaskPR[])

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Summary task')).toBeInTheDocument()
      })

      const card = screen.getByText('Summary task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('Implemented the auth module with tests')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: DiffViewer Close Button Callback
  // ────────────────────────────────────────────────────────────

  describe('DiffViewer Close Callback', () => {
    it('closes diff when DiffViewer close button is clicked', async () => {
      vi.mocked(api.getTaskPRFiles).mockResolvedValue([
        { filename: 'src/main.ts', status: 'modified', additions: 3, deletions: 1, patch: '+code' },
      ] as api.PRFileChange[])
      vi.mocked(api.getTaskProgress).mockResolvedValue([])

      setupMocks({
        tasks: [{
          id: 'task-diff-close',
          status: 'completed' as const,
          title: 'Diff close task',
          description: 'Close diff via button',
          github_pr_url: 'https://github.com/bloom-base/aurora/pull/12',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Diff close task')).toBeInTheDocument()
      })

      // Expand the card first
      const card = screen.getByText('Diff close task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText('\u25bc')).toBeInTheDocument()
      })

      // Open diff
      fireEvent.click(screen.getByText('Diff'))

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument()
      })

      // Close diff via DiffViewer's close button (our mock renders "Close diff" button)
      fireEvent.click(screen.getByText('Close diff'))

      await waitFor(() => {
        expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: Tool Call Result Expansion in Progress Log
  // ────────────────────────────────────────────────────────────

  describe('Tool Call Result Expansion', () => {
    it('expands and collapses tool call results on click', async () => {
      const longOutput = 'A'.repeat(100) // > 80 chars makes it expandable

      vi.mocked(api.getTaskProgress).mockResolvedValue([
        { type: 'tool_call', tool: 'read_file', input: { path: 'src/main.ts' }, timestamp: '' },
        { type: 'tool_result', tool: 'read_file', result: longOutput, timestamp: '' },
      ] as api.TaskStreamEvent[])

      setupMocks({
        tasks: [{
          id: 'task-expand-result',
          status: 'completed' as const,
          title: 'Expand result task',
          description: 'Has expandable tool result',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Expand result task')).toBeInTheDocument()
      })

      // Expand the task card
      const card = screen.getByText('Expand result task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText(/read_file/)).toBeInTheDocument()
      })

      // The output should exist with line-clamp-2 initially
      const outputEl = screen.getByText(longOutput)
      expect(outputEl.className).toContain('line-clamp-2')

      // Click on the tool call row to expand
      const toolRow = screen.getByText(/read_file/).closest('.cursor-pointer')!
      fireEvent.click(toolRow)

      // After click, the line-clamp should be removed
      await waitFor(() => {
        const updatedOutput = screen.getByText(longOutput)
        expect(updatedOutput.className).not.toContain('line-clamp-2')
      })

      // Click again to collapse
      fireEvent.click(toolRow)

      await waitFor(() => {
        const collapsedOutput = screen.getByText(longOutput)
        expect(collapsedOutput.className).toContain('line-clamp-2')
      })
    })

    it('does not make short tool results expandable', async () => {
      vi.mocked(api.getTaskProgress).mockResolvedValue([
        { type: 'tool_call', tool: 'bash', input: { command: 'ls' }, timestamp: '' },
        { type: 'tool_result', tool: 'bash', result: 'short output', timestamp: '' },
      ] as api.TaskStreamEvent[])

      setupMocks({
        tasks: [{
          id: 'task-short-result',
          status: 'completed' as const,
          title: 'Short result task',
          description: 'Has short tool result',
          current_stage: 0,
          started_at: '2026-01-20T01:00:00Z',
          completed_at: '2026-01-20T02:00:00Z',
        }],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Short result task')).toBeInTheDocument()
      })

      const card = screen.getByText('Short result task').closest('[role="button"]')!
      fireEvent.click(card)

      await waitFor(() => {
        expect(screen.getByText(/bash/)).toBeInTheDocument()
      })

      // The tool row should NOT have cursor-pointer class (not expandable)
      const toolRow = screen.getByText(/bash/).closest('.flex.items-start')!
      expect(toolRow.className).not.toContain('cursor-pointer')
    })
  })

  // ────────────────────────────────────────────────────────────
  // NEW TESTS: PreviewPanel close via toolbar X button
  // ────────────────────────────────────────────────────────────

  describe('PreviewPanel Toolbar Close', () => {
    it('closes preview via toolbar close button (not toggle)', async () => {
      setupMocks({
        project: { deployed_url: 'https://aurora.fly.dev', deploy_status: 'deployed' },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument()
      })

      // Open preview
      fireEvent.click(screen.getByText('Preview'))

      await waitFor(() => {
        // Both toggle button and X button have title="Close preview"
        const closeButtons = screen.getAllByTitle('Close preview')
        expect(closeButtons.length).toBe(2)
        expect(screen.getByTitle('App preview')).toBeInTheDocument()
      })

      // Click the toolbar X button (the second one — first is the toggle button)
      const closeButtons = screen.getAllByTitle('Close preview')
      fireEvent.click(closeButtons[1])

      await waitFor(() => {
        // Preview iframe should be gone
        expect(screen.queryByTitle('App preview')).not.toBeInTheDocument()
        // Toggle button should show "Preview" again
        expect(screen.getByText('Preview')).toBeInTheDocument()
      })
    })
  })
})
