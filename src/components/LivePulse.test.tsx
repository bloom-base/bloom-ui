import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  getPublicLive: vi.fn(),
}))

import { LivePulse } from './LivePulse'
import * as api from '@/lib/api'

const mockLiveData = {
  active_tasks: [
    {
      id: 'task-1',
      title: 'Add dark mode support',
      project_name: 'genesis',
      project_repo: 'bloom-base/genesis',
      started_at: '2026-03-01T00:00:00Z',
      completed_at: null,
      pr_url: null,
    },
  ],
  recent_completions: [
    {
      id: 'task-2',
      title: 'Fix login redirect',
      project_name: 'arcade',
      project_repo: 'bloom-base/arcade',
      started_at: '2026-02-28T00:00:00Z',
      completed_at: '2026-03-01T01:00:00Z',
      pr_url: 'https://github.com/bloom-base/arcade/pull/5',
    },
  ],
  stats: {
    active_agents: 1,
    total_completed: 42,
    total_in_progress: 1,
  },
}

describe('LivePulse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getPublicLive).mockReturnValue(new Promise(() => {}))

    render(<LivePulse />)

    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(1)
  })

  it('shows active tasks', async () => {
    vi.mocked(api.getPublicLive).mockResolvedValue(mockLiveData as any)

    render(<LivePulse />)

    await waitFor(() => {
      expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
    })
    expect(screen.getByText('Building')).toBeInTheDocument()
  })

  it('shows completed tasks', async () => {
    vi.mocked(api.getPublicLive).mockResolvedValue(mockLiveData as any)

    render(<LivePulse />)

    await waitFor(() => {
      expect(screen.getByText('Fix login redirect')).toBeInTheDocument()
    })
    expect(screen.getByText('Shipped')).toBeInTheDocument()
  })

  it('shows project names', async () => {
    vi.mocked(api.getPublicLive).mockResolvedValue(mockLiveData as any)

    render(<LivePulse />)

    await waitFor(() => {
      expect(screen.getByText('genesis')).toBeInTheDocument()
    })
    expect(screen.getByText('arcade')).toBeInTheDocument()
  })

  it('shows PR link for completed tasks with PR', async () => {
    vi.mocked(api.getPublicLive).mockResolvedValue(mockLiveData as any)

    render(<LivePulse />)

    await waitFor(() => {
      expect(screen.getByText('PR')).toBeInTheDocument()
    })
  })

  it('shows idle state when no activity', async () => {
    vi.mocked(api.getPublicLive).mockResolvedValue({
      active_tasks: [],
      recent_completions: [],
      stats: { active_agents: 0, total_completed: 0, total_in_progress: 0 },
    } as any)

    render(<LivePulse />)

    await waitFor(() => {
      expect(screen.getByText(/No active tasks right now/)).toBeInTheDocument()
    })
  })
})
