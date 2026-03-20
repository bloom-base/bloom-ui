import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/api', () => ({
  streamTaskEvents: vi.fn(),
  cancelTask: vi.fn(),
  pauseTask: vi.fn(),
  resumeTask: vi.fn(),
  sendTaskGuidance: vi.fn(),
}))

import AgentWorkspace from './AgentWorkspace'
import type { QueueStatus, LedgerTask, Sponsorship } from '@/lib/api'

const baseQueueStatus: QueueStatus = {
  queue_counts: {},
  current_task: null,
  total_pending: 0,
}

const workingQueueStatus: QueueStatus = {
  queue_counts: {},
  current_task: { id: 'task-1', title: 'Add dark mode', project_id: 'proj-1' },
  total_pending: 0,
}

const pausedTask: LedgerTask = {
  id: 'task-2',
  project_id: 'proj-1',
  title: 'Fix bug',
  description: 'Fix a bug',
  status: 'paused',
  priority: 1,
  proposed_by: 'user-1',
  conversation_id: null,
  github_pr_url: null,
  current_stage: 0,
  created_at: '2026-01-01',
  started_at: null,
  completed_at: null,
  paused_at: '2026-01-01',
}

describe('AgentWorkspace', () => {
  const onTaskStateChanged = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when no task and no queue', () => {
    const { container } = render(
      <AgentWorkspace
        queueStatus={baseQueueStatus}
        projectId="proj-1"
        projectQueuedCount={0}
        pausedTask={null}
        activeSponsor={null}
        onTaskStateChanged={onTaskStateChanged}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('shows queued count when ideas are waiting', () => {
    render(
      <AgentWorkspace
        queueStatus={baseQueueStatus}
        projectId="proj-1"
        projectQueuedCount={3}
        pausedTask={null}
        activeSponsor={null}
        onTaskStateChanged={onTaskStateChanged}
      />
    )
    expect(screen.getByText('3 ideas waiting')).toBeTruthy()
  })

  it('shows agent workspace header when task is running', () => {
    render(
      <AgentWorkspace
        queueStatus={workingQueueStatus}
        projectId="proj-1"
        projectQueuedCount={0}
        pausedTask={null}
        activeSponsor={null}
        onTaskStateChanged={onTaskStateChanged}
      />
    )
    expect(screen.getByText('Agent Workspace')).toBeTruthy()
    expect(screen.getByText('Add dark mode')).toBeTruthy()
    expect(screen.getByText('Pause')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('shows paused state', () => {
    render(
      <AgentWorkspace
        queueStatus={baseQueueStatus}
        projectId="proj-1"
        projectQueuedCount={0}
        pausedTask={pausedTask}
        activeSponsor={null}
        onTaskStateChanged={onTaskStateChanged}
      />
    )
    expect(screen.getByText('Paused')).toBeTruthy()
    expect(screen.getByText('Resume')).toBeTruthy()
  })

  it('expands workspace panels on click', () => {
    render(
      <AgentWorkspace
        queueStatus={workingQueueStatus}
        projectId="proj-1"
        projectQueuedCount={0}
        pausedTask={null}
        activeSponsor={null}
        onTaskStateChanged={onTaskStateChanged}
      />
    )
    // Click the header to expand
    fireEvent.click(screen.getByText('Agent Workspace'))

    // Tab bar should appear
    expect(screen.getByText('Activity')).toBeTruthy()
    expect(screen.getByText('Files')).toBeTruthy()
    expect(screen.getByText('Terminal')).toBeTruthy()
  })

  it('switches between tabs', () => {
    render(
      <AgentWorkspace
        queueStatus={workingQueueStatus}
        projectId="proj-1"
        projectQueuedCount={0}
        pausedTask={null}
        activeSponsor={null}
        onTaskStateChanged={onTaskStateChanged}
      />
    )
    fireEvent.click(screen.getByText('Agent Workspace'))

    // Default tab is activity
    expect(screen.getByText('Connecting...')).toBeTruthy()

    // Switch to files tab
    fireEvent.click(screen.getByText('Files'))
    expect(screen.getByText('No files yet')).toBeTruthy()

    // Switch to terminal tab
    fireEvent.click(screen.getByText('Terminal'))
    expect(screen.getByText('Terminal output will appear when the agent runs commands')).toBeTruthy()
  })

  it('shows guidance input when expanded and not paused', () => {
    render(
      <AgentWorkspace
        queueStatus={workingQueueStatus}
        projectId="proj-1"
        projectQueuedCount={0}
        pausedTask={null}
        activeSponsor={null}
        onTaskStateChanged={onTaskStateChanged}
      />
    )
    fireEvent.click(screen.getByText('Agent Workspace'))
    expect(screen.getByPlaceholderText('Guide the agent...')).toBeTruthy()
  })

  it('shows sponsor info when sponsored', () => {
    const sponsor: Sponsorship = {
      id: 's-1',
      project_id: 'proj-1',
      sponsor_id: 'u-2',
      sponsor_username: 'alice',
      sponsor_avatar_url: 'https://example.com/alice.png',
      display_name: 'Alice',
      is_company: false,
      tier: 2,
      monthly_amount_usd: 50,
      total_contributed_usd: 150,
      status: 'active',
      is_active: true,
      started_at: '2026-01-01',
      sponsor_vision: null,
    }

    render(
      <AgentWorkspace
        queueStatus={workingQueueStatus}
        projectId="proj-1"
        projectQueuedCount={0}
        pausedTask={null}
        activeSponsor={sponsor}
        onTaskStateChanged={onTaskStateChanged}
      />
    )
    expect(screen.getByText('funded by Alice')).toBeTruthy()
  })
})
