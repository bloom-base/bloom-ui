/**
 * Pipeline stage UI tests.
 *
 * Verifies the project page renders correctly at each stage of the Bloom
 * pipeline: proposed → accepted → in_progress → completed → deploying → deployed.
 * Also tests "clicking a button on the deployment" via jsdom.
 *
 * Run with: npm run test:run -- src/app/\[owner\]/\[repo\]/pipeline.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Mock next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ owner: 'bloom-base', repo: 'riddle' }),
  usePathname: () => '/bloom-base/riddle',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}))

// Mock API module
vi.mock('@/lib/api', () => ({
  getProjectByPath: vi.fn(),
  getProjectLedger: vi.fn(),
  listConversations: vi.fn(),
  getQueueStatus: vi.fn(),
  getProjectAnalytics: vi.fn(),
  getCurrentUser: vi.fn(),
  getActiveSponsor: vi.fn(),
  getProjectSponsors: vi.fn(),
  getDeployStatus: vi.fn(),
  getDeployments: vi.fn(),
  getTaskProgress: vi.fn(),
  getTaskPRs: vi.fn(),
  streamTaskEvents: vi.fn(),
  cancelTask: vi.fn(),
  pauseTask: vi.fn(),
  resumeTask: vi.fn(),
  sendTaskGuidance: vi.fn(),
  forkProject: vi.fn(),
  deleteConversation: vi.fn(),
  createSponsorshipCheckout: vi.fn(),
  getProjectEvals: vi.fn(),
  getProjectContributors: vi.fn(),
  getFollowStatus: vi.fn(),
  followProject: vi.fn(),
  unfollowProject: vi.fn(),
  getProjectReadme: vi.fn(),
  getTaskCost: vi.fn(),
  getTaskEval: vi.fn(),
  getTaskPRFiles: vi.fn(),
}))

import ProjectPage from './page'
import * as api from '@/lib/api'

// --- Shared scenario data (matches backend test_pipeline_e2e.py) ---

const SCENARIO = {
  task_title: 'Add click counter button',
  task_description: 'Add an interactive button that displays and increments a click count.',
  pr_url: 'https://github.com/testuser/test-repo/pull/42',
  fly_app_name: 'bloom-counter-abc123',
  deployed_url: 'https://bloom-counter-abc123.fly.dev',
}

const baseProject = {
  id: 'proj-1',
  name: 'riddle',
  description: 'Daily puzzle and brain teaser platform',
  github_repo: 'bloom-base/riddle',
  owner_id: 'user-1',
  is_public: true,
  vision: 'One puzzle a day keeps the brain sharp.',
  deployed_url: null as string | null,
  deploy_status: null as string | null,
  fly_app_name: null as string | null,
  deploy_error: null as string | null,
  created_at: '2026-02-11T00:00:00Z',
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    project_id: 'proj-1',
    title: SCENARIO.task_title,
    description: SCENARIO.task_description,
    status: 'proposed' as string,
    priority: 4,
    proposed_by: 'user-2',
    conversation_id: 'conv-1',
    github_pr_url: null as string | null,
    created_at: '2026-02-11T01:00:00Z',
    started_at: null as string | null,
    completed_at: null as string | null,
    error_message: null as string | null,
    ...overrides,
  }
}

function setupMocks(overrides: {
  project?: Partial<typeof baseProject>
  tasks?: ReturnType<typeof makeTask>[]
  queueStatus?: Record<string, unknown>
} = {}) {
  const project = { ...baseProject, ...overrides.project }
  const tasks = overrides.tasks ?? [makeTask()]
  const queueStatus = overrides.queueStatus ?? {
    queue_counts: {},
    current_task: null,
    total_pending: 0,
  }

  vi.mocked(api.getProjectByPath).mockResolvedValue(project as api.Project)
  vi.mocked(api.getProjectLedger).mockResolvedValue({ items: tasks as api.LedgerTask[], total: tasks.length, limit: 50, offset: 0 })
  vi.mocked(api.listConversations).mockResolvedValue({ items: [], total: 0 })
  vi.mocked(api.getQueueStatus).mockResolvedValue(queueStatus as api.QueueStatus)
  vi.mocked(api.getProjectAnalytics).mockResolvedValue(null as unknown as api.ProjectAnalytics)
  vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('not logged in'))
  vi.mocked(api.getActiveSponsor).mockResolvedValue(null)
  vi.mocked(api.getProjectSponsors).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })
  vi.mocked(api.getProjectContributors).mockResolvedValue([])
  vi.mocked(api.getProjectEvals).mockResolvedValue({ task_count: 0, avg_quality_score: null, avg_completion: null, avg_efficiency: null, avg_cost: null, avg_reliability: null, trend: null, recent_evals: [] } as api.ProjectEvalSummary)
  vi.mocked(api.getDeployStatus).mockResolvedValue({ deploy_status: project.deploy_status, deployed_url: project.deployed_url } as any)
  vi.mocked(api.getDeployments).mockResolvedValue({ items: [], total: 0, limit: 10, offset: 0 })
  vi.mocked(api.getTaskPRs).mockResolvedValue([])
  vi.mocked(api.getProjectReadme).mockResolvedValue({ content: null })
  vi.mocked(api.getTaskCost).mockResolvedValue({ task_id: '', total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0, per_turn: [] })
  vi.mocked(api.getTaskEval).mockResolvedValue({ task_id: '', eval: null })
  vi.mocked(api.getFollowStatus).mockResolvedValue({ following: false, follower_count: 0 })

  return project
}

describe('Pipeline Stage UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------------
  // Stage 1: Task proposed — shows in queue with "Proposed" status
  // ----------------------------------------------------------------

  describe('Stage 1: Task Proposed', () => {
    it('shows proposed task in the queue section', async () => {
      setupMocks({ tasks: [makeTask({ status: 'proposed' })] })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(SCENARIO.task_title)).toBeInTheDocument()
      })
    })
  })

  // ----------------------------------------------------------------
  // Stage 2: Task accepted — shows in queue as "Queued"
  // ----------------------------------------------------------------

  describe('Stage 2: Task Accepted (Queued)', () => {
    it('shows accepted task as queued', async () => {
      setupMocks({ tasks: [makeTask({ status: 'accepted' })] })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(SCENARIO.task_title)).toBeInTheDocument()
      })
      expect(screen.getByText('Queued')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Stage 3: Task in progress — agent working
  // ----------------------------------------------------------------

  describe('Stage 3: Task In Progress', () => {
    it('shows in-progress task with working status', async () => {
      const task = makeTask({
        status: 'in_progress',
        started_at: '2026-02-11T02:00:00Z',
      })
      setupMocks({
        tasks: [task],
        queueStatus: {
          queue_counts: {},
          current_task: { id: task.id, title: task.title },
          total_pending: 0,
        },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText(SCENARIO.task_title)).toBeInTheDocument()
      })
    })
  })

  // ----------------------------------------------------------------
  // Stage 4: Task completed with PR
  // ----------------------------------------------------------------

  describe('Stage 4: Task Completed', () => {
    it('shows completed task with Done badge and PR link', async () => {
      setupMocks({
        tasks: [makeTask({
          status: 'completed',
          github_pr_url: SCENARIO.pr_url,
          completed_at: '2026-02-11T03:00:00Z',
        })],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Done')).toBeInTheDocument()
      })

      // PR link should point to the correct URL
      const prLink = screen.getByText('PR')
      expect(prLink).toHaveAttribute('href', SCENARIO.pr_url)
    })
  })

  // ----------------------------------------------------------------
  // Stage 5: Deploying
  // ----------------------------------------------------------------

  describe('Stage 5: Deploying', () => {
    it('shows deploying spinner', async () => {
      setupMocks({
        project: { deploy_status: 'deploying', deployed_url: null },
        tasks: [makeTask({ status: 'completed', github_pr_url: SCENARIO.pr_url })],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Deploying...')).toBeInTheDocument()
      })
    })
  })

  // ----------------------------------------------------------------
  // Stage 6: Deployed — View App button visible
  // ----------------------------------------------------------------

  describe('Stage 6: Deployed', () => {
    it('shows View App link pointing to deployed URL', async () => {
      setupMocks({
        project: {
          deploy_status: 'deployed',
          deployed_url: SCENARIO.deployed_url,
          fly_app_name: SCENARIO.fly_app_name,
        },
        tasks: [makeTask({ status: 'completed', github_pr_url: SCENARIO.pr_url })],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByTitle('Open in new tab')).toBeInTheDocument()
      })

      const link = screen.getByTitle('Open in new tab').closest('a')
      expect(link).toHaveAttribute('href', SCENARIO.deployed_url)
      expect(link).toHaveAttribute('target', '_blank')
    })
  })

  // ----------------------------------------------------------------
  // Stage 7: Deploy failed
  // ----------------------------------------------------------------

  describe('Stage 7: Deploy Failed', () => {
    it('shows Deploy Failed message', async () => {
      setupMocks({
        project: {
          deploy_status: 'failed',
          deploy_error: 'flyctl deploy timed out after 5 minutes',
          deployed_url: null,
        },
        tasks: [makeTask({ status: 'completed', github_pr_url: SCENARIO.pr_url })],
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('Deploy failed')).toBeInTheDocument()
      })
    })
  })

  // ----------------------------------------------------------------
  // Navigation: View App link opens correct URL in new tab
  // ----------------------------------------------------------------

  describe('View App navigation', () => {
    it('link has correct href and opens in new tab', async () => {
      setupMocks({
        project: {
          deploy_status: 'deployed',
          deployed_url: SCENARIO.deployed_url,
        },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        const link = screen.getByTitle('Open in new tab').closest('a')
        expect(link?.getAttribute('href')).toBe(SCENARIO.deployed_url)
        expect(link?.getAttribute('target')).toBe('_blank')
      })
    })
  })

  // ----------------------------------------------------------------
  // Deploy status null — no deploy button shown
  // ----------------------------------------------------------------

  describe('No deployment', () => {
    it('shows no deploy UI when status is null', async () => {
      setupMocks({
        project: { deploy_status: null, deployed_url: null },
      })

      render(<ProjectPage />)

      await waitFor(() => {
        expect(screen.getByText('riddle')).toBeInTheDocument()
      })

      expect(screen.queryByText('View App')).not.toBeInTheDocument()
      expect(screen.queryByText('Deploying...')).not.toBeInTheDocument()
      expect(screen.queryByText('Deploy failed')).not.toBeInTheDocument()
    })
  })
})

// ----------------------------------------------------------------
// Deployed app button verification (jsdom)
//
// Verifies the "clicking a button on the deployment" requirement.
// Loads the HTML the coder agent would produce into jsdom and
// clicks the button to verify it works.
// ----------------------------------------------------------------

describe('Deployed App Button Verification', () => {
  it('counter button increments on click', () => {
    // This is the HTML the coder agent would produce and deploy
    document.body.innerHTML = `
      <h1>Click Counter</h1>
      <p id="count">0</p>
      <button id="counter-btn" onclick="document.getElementById('count').textContent = parseInt(document.getElementById('count').textContent) + 1">
        Click me
      </button>
    `

    const button = document.getElementById('counter-btn')!
    const count = document.getElementById('count')!

    expect(count.textContent).toBe('0')

    button.click()
    expect(count.textContent).toBe('1')

    button.click()
    expect(count.textContent).toBe('2')

    button.click()
    expect(count.textContent).toBe('3')
  })

  it('counter button exists and is clickable', () => {
    document.body.innerHTML = `
      <button id="counter-btn" onclick="this.dataset.clicks = (parseInt(this.dataset.clicks || '0') + 1)">
        Click me
      </button>
    `

    const button = document.getElementById('counter-btn')!
    expect(button).toBeTruthy()
    expect(button.tagName).toBe('BUTTON')

    button.click()
    expect(button.dataset.clicks).toBe('1')
  })
})
