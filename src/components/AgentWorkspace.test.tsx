import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/api', () => ({
  streamTaskEvents: vi.fn(),
  cancelTask: vi.fn(),
  pauseTask: vi.fn(),
  resumeTask: vi.fn(),
  sendTaskGuidance: vi.fn(),
}))

import AgentWorkspace, { groupEvents, getToolSummary, diffLines } from './AgentWorkspace'
import type { QueueStatus, LedgerTask, Sponsorship, TaskStreamEvent } from '@/lib/api'

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

  it('expands activity panel on click', () => {
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
    expect(screen.getByText('Initializing agent workspace...')).toBeTruthy()
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

// ── groupEvents unit tests ──────────────────────────────────

describe('groupEvents', () => {
  it('returns empty array for no events', () => {
    expect(groupEvents([])).toEqual([])
  })

  it('skips connected and stream_end events', () => {
    const events: TaskStreamEvent[] = [
      { type: 'connected', task_id: 't1' },
      { type: 'stream_end', status: 'complete' },
    ]
    expect(groupEvents(events)).toEqual([])
  })

  it('groups agent text with tool calls in same turn', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'agent_text', turn: 1, text: 'Adding dark mode' },
      { type: 'tool_call', turn: 1, tool: 'Edit', input: { file_path: '/src/App.tsx', old_string: 'a', new_string: 'b' } },
      { type: 'tool_result', turn: 1, tool: 'Edit', result: 'ok' },
    ]
    const groups = groupEvents(events)
    expect(groups).toHaveLength(1)
    expect(groups[0].text).toBe('Adding dark mode')
    expect(groups[0].tools).toHaveLength(1)
    expect(groups[0].tools[0].tool).toBe('Edit')
    expect(groups[0].tools[0].completed).toBe(true)
  })

  it('skips empty turns (no content between turn_starts)', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'agent_text', turn: 1, text: 'Hello' },
      { type: 'turn_start', turn: 2 },
      // Empty turn — thinking-only
      { type: 'turn_start', turn: 3 },
      { type: 'tool_call', turn: 3, tool: 'Read', input: { file_path: '/a.ts' } },
      { type: 'tool_result', turn: 3, tool: 'Read', result: 'contents' },
    ]
    const groups = groupEvents(events)
    expect(groups).toHaveLength(2)
    expect(groups[0].text).toBe('Hello')
    expect(groups[1].tools[0].tool).toBe('Read')
  })

  it('collects tool output for incomplete tool calls', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'tool_call', turn: 1, tool: 'Bash', input: { command: 'ls', description: 'List files' } },
      { type: 'tool_output', tool: 'Bash', output: 'file1.ts\n' },
      { type: 'tool_output', tool: 'Bash', output: 'file2.ts\n' },
    ]
    const groups = groupEvents(events)
    expect(groups[0].tools[0].completed).toBe(false)
    expect(groups[0].tools[0].output).toBe('file1.ts\nfile2.ts\n')
  })

  it('reviewing creates parent with empty children (subtasks appear dynamically)', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'tool_call', turn: 1, tool: 'mcp__bloom__create_pr', input: { title: 'Add X' } },
      { type: 'reviewing' },
    ]
    const groups = groupEvents(events)
    expect(groups[0].status).toHaveLength(1)
    const parent = groups[0].status[0]
    expect(parent.type).toBe('review_parent')
    expect(parent.text).toBe('Waiting for Code Review')
    expect(parent.children).toHaveLength(0)
  })

  it('review_stage running_tests adds first subtask', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'reviewing' },
      { type: 'review_stage', stage: 'running_tests' } as TaskStreamEvent,
    ]
    const groups = groupEvents(events)
    const parent = groups[0].status[0]
    expect(parent.type).toBe('review_parent')
    expect(parent.children).toHaveLength(1)
    expect(parent.children![0].type).toBe('running_tests')
    expect(parent.children![0].text).toBe('Running tests')
    expect(parent.children![0].color).toBe('text-blue-400')
  })

  it('review_stage code_review marks tests done and adds reviewing code', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'reviewing' },
      { type: 'review_stage', stage: 'running_tests' } as TaskStreamEvent,
      { type: 'review_stage', stage: 'code_review' } as TaskStreamEvent,
    ]
    const groups = groupEvents(events)
    const parent = groups[0].status[0]
    expect(parent.type).toBe('review_parent')
    expect(parent.children).toHaveLength(2)
    // Tests should be marked done (solid dot)
    expect(parent.children![0].type).toBe('running_tests_done')
    expect(parent.children![0].text).toBe('Running tests')
    // Reviewing code should be active (pulsing dot)
    expect(parent.children![1].type).toBe('reviewing_code')
    expect(parent.children![1].text).toBe('Reviewing code')
    expect(parent.children![1].color).toBe('text-blue-400')
  })

  it('deploying completes review parent and shows deploying', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'tool_call', turn: 1, tool: 'mcp__bloom__create_pr', input: { title: 'Add X' } },
      { type: 'reviewing' },
      { type: 'review_stage', stage: 'running_tests' } as TaskStreamEvent,
      { type: 'review_stage', stage: 'code_review' } as TaskStreamEvent,
      { type: 'deploying' },
    ]
    const groups = groupEvents(events)
    // Review parent should be completed
    const parent = groups[0].status.find(s => s.type === 'review_done')
    expect(parent).toBeDefined()
    expect(parent!.children![0].type).toBe('running_tests_done')
    expect(parent!.children![1].type).toBe('reviewing_code_done')
    // Deploying should be active
    const deploying = groups[0].status.find(s => s.type === 'deploying')
    expect(deploying).toBeDefined()
    expect(deploying!.text).toBe('Deploying')
  })

  it('deploying without subtasks still completes review parent', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'reviewing' },
      { type: 'deploying' },
    ]
    const groups = groupEvents(events)
    const parent = groups[0].status.find(s => s.type === 'review_done')
    expect(parent).toBeDefined()
    // No subtasks were added, so children is empty but parent still marked done
    expect(parent!.children).toHaveLength(0)
    expect(groups[0].status.find(s => s.type === 'deploying')).toBeDefined()
  })

  it('complete marks deploying as done', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'reviewing' },
      { type: 'review_stage', stage: 'running_tests' } as TaskStreamEvent,
      { type: 'review_stage', stage: 'code_review' } as TaskStreamEvent,
      { type: 'deploying' },
      { type: 'complete', status: 'success' },
    ]
    const groups = groupEvents(events)
    // First group: review done + deploying done
    const dep = groups[0].status.find(s => s.type === 'deploying_done')
    expect(dep).toBeDefined()
    // Second group: complete
    expect(groups[1].status[0].type).toBe('complete')
  })

  it('second review round creates new review parent in new turn', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'reviewing' },
      { type: 'review_stage', stage: 'running_tests' } as TaskStreamEvent,
      // Changes requested — agent resumes coding
      { type: 'turn_start', turn: 2 },
      { type: 'agent_text', turn: 2, text: 'Fixing the issues...' },
      { type: 'tool_call', turn: 2, tool: 'Edit', input: { file_path: '/a.ts', old_string: 'x', new_string: 'y' } },
      { type: 'tool_result', turn: 2, tool: 'Edit', result: 'ok' },
      // Second review
      { type: 'turn_start', turn: 3 },
      { type: 'reviewing' },
    ]
    const groups = groupEvents(events)
    // First turn has review parent with tests running
    expect(groups[0].status[0].type).toBe('review_parent')
    expect(groups[0].status[0].children).toHaveLength(1)
    expect(groups[0].status[0].children![0].type).toBe('running_tests')
    // Second turn has coding (no review)
    expect(groups[1].status).toHaveLength(0)
    // Third turn has a fresh review parent with empty children
    expect(groups[2].status[0].type).toBe('review_parent')
    expect(groups[2].status[0].children).toHaveLength(0)
  })

  it('handles complete event as separate group', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'agent_text', turn: 1, text: 'Done' },
      { type: 'complete', status: 'success' },
    ]
    const groups = groupEvents(events)
    expect(groups).toHaveLength(2)
    expect(groups[1].status[0].type).toBe('complete')
    expect(groups[1].status[0].text).toBe('success')
  })

  it('concatenates multiple agent_text events in same turn', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'agent_text', turn: 1, text: 'First ' },
      { type: 'agent_text', turn: 1, text: 'Second' },
    ]
    const groups = groupEvents(events)
    expect(groups[0].text).toBe('First Second')
  })

  it('handles guidance events', () => {
    const events: TaskStreamEvent[] = [
      { type: 'guidance', message: 'focus on the nav' },
      { type: 'guidance_received' },
    ]
    const groups = groupEvents(events)
    expect(groups[0].status).toHaveLength(2)
    expect(groups[0].status[0].text).toContain('focus on the nav')
    expect(groups[0].status[1].text).toBe('Guidance received')
  })

  it('handles pause and resume events', () => {
    const events: TaskStreamEvent[] = [
      { type: 'pause_requested' },
      { type: 'paused' },
      { type: 'resumed' },
    ]
    const groups = groupEvents(events)
    expect(groups[0].status).toHaveLength(3)
    expect(groups[0].status[0].type).toBe('pause_requested')
    expect(groups[0].status[1].type).toBe('paused')
    expect(groups[0].status[2].type).toBe('resumed')
  })
})

// ── getToolSummary unit tests ───────────────────────────────

describe('getToolSummary', () => {
  it('shows file path for Edit', () => {
    expect(getToolSummary('Edit', { file_path: '/src/App.tsx', old_string: 'a', new_string: 'b' }))
      .toBe('Edit src/App.tsx')
  })

  it('shows file path for Write', () => {
    expect(getToolSummary('Write', { file_path: '/src/new.tsx', content: 'hello' }))
      .toBe('Write src/new.tsx')
  })

  it('shows file path for Read', () => {
    expect(getToolSummary('Read', { file_path: '/src/file.ts' }))
      .toBe('Read src/file.ts')
  })

  it('shows description for Bash', () => {
    expect(getToolSummary('Bash', { command: 'npm run build', description: 'Build the project' }))
      .toBe('Build the project')
  })

  it('falls back to truncated command when no Bash description', () => {
    expect(getToolSummary('Bash', { command: 'echo hello' }))
      .toBe('echo hello')
  })

  it('shows Updated tasks for TodoWrite', () => {
    expect(getToolSummary('TodoWrite', { todos: [] }))
      .toBe('Updated tasks')
  })

  it('shows pattern for Grep', () => {
    expect(getToolSummary('Grep', { pattern: 'handleClick' }))
      .toBe('Grep "handleClick"')
  })

  it('shows pattern for Glob', () => {
    expect(getToolSummary('Glob', { pattern: '**/*.tsx' }))
      .toBe('Glob **/*.tsx')
  })

  it('formats MCP tools with formatToolName', () => {
    expect(getToolSummary('mcp__bloom__create_pr', { title: 'Add X', body: 'desc' }))
      .toContain('Create PR')
  })

  it('handles edit_file alias', () => {
    expect(getToolSummary('edit_file', { file_path: '/a.py', old_string: 'x', new_string: 'y' }))
      .toBe('Edit File a.py')
  })
})

// ── diffLines unit tests ─────────────────────────────────────

describe('diffLines', () => {
  it('returns same for identical lines', () => {
    const result = diffLines(['a', 'b'], ['a', 'b'])
    expect(result).toEqual([
      { type: 'same', text: 'a' },
      { type: 'same', text: 'b' },
    ])
  })

  it('shows deletion and addition for changed line', () => {
    const result = diffLines(['hello'], ['world'])
    expect(result).toEqual([
      { type: 'del', text: 'hello' },
      { type: 'add', text: 'world' },
    ])
  })

  it('interleaves changes with context', () => {
    const result = diffLines(
      ['line1', 'old', 'line3'],
      ['line1', 'new', 'line3'],
    )
    expect(result).toEqual([
      { type: 'same', text: 'line1' },
      { type: 'del', text: 'old' },
      { type: 'add', text: 'new' },
      { type: 'same', text: 'line3' },
    ])
  })

  it('handles additions at end', () => {
    const result = diffLines(['a'], ['a', 'b'])
    expect(result).toEqual([
      { type: 'same', text: 'a' },
      { type: 'add', text: 'b' },
    ])
  })

  it('handles deletions at end', () => {
    const result = diffLines(['a', 'b'], ['a'])
    expect(result).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
    ])
  })

  it('handles empty old', () => {
    const result = diffLines([], ['new'])
    expect(result).toEqual([{ type: 'add', text: 'new' }])
  })

  it('handles empty new', () => {
    const result = diffLines(['old'], [])
    expect(result).toEqual([{ type: 'del', text: 'old' }])
  })
})

// ── groupEvents: duplicate tool name handling ────────────────

describe('groupEvents duplicate tools', () => {
  it('correctly matches tool_results when same tool type used twice in one turn', () => {
    const events: TaskStreamEvent[] = [
      { type: 'turn_start', turn: 1 },
      { type: 'tool_call', turn: 1, tool: 'Edit', input: { file_path: '/a.ts', old_string: 'x', new_string: 'y' } },
      { type: 'tool_result', turn: 1, tool: 'Edit', result: 'ok' },
      { type: 'tool_call', turn: 1, tool: 'Edit', input: { file_path: '/b.ts', old_string: 'p', new_string: 'q' } },
      { type: 'tool_result', turn: 1, tool: 'Edit', result: 'ok2' },
    ]
    const groups = groupEvents(events)
    expect(groups).toHaveLength(1)
    expect(groups[0].tools).toHaveLength(2)
    // First Edit should get first result, second Edit should get second result
    expect(groups[0].tools[0].completed).toBe(true)
    expect(groups[0].tools[0].result).toBe('ok')
    expect(groups[0].tools[1].completed).toBe(true)
    expect(groups[0].tools[1].result).toBe('ok2')
  })
})
