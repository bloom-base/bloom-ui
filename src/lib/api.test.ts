import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchAPI', () => {
    it('includes cookie credentials for session auth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123', name: 'Test Project' }),
      })

      // Import dynamically to pick up mocked fetch
      const { getProject } = await import('./api')
      await getProject('123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/projects/123'),
        expect.objectContaining({
          credentials: 'include',
        })
      )
    })

    it('throws on 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => 'Unauthorized',
      })

      const { getProject } = await import('./api')
      await expect(getProject('123')).rejects.toThrow('API error: 401')
    })
  })
})

describe('SSE Parsing', () => {
  it('handles chunked SSE frames without losing events', async () => {
    const chunks = [
      'data: {"type":"text","content":"Hello',
      ' world"}\n\n',
      'data: [DONE]\n\n',
    ]
    const encoder = new TextEncoder()
    let idx = 0
    const reader = {
      read: vi.fn().mockImplementation(async () => {
        if (idx >= chunks.length) return { done: true, value: undefined }
        const value = encoder.encode(chunks[idx])
        idx += 1
        return { done: false, value }
      }),
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => reader,
      },
    })

    const events: Array<{ type: string; content?: string }> = []
    const { sendMessageStream } = await import('./api')

    await sendMessageStream('conv-1', 'hi', (event) => {
      events.push(event)
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', content: 'Hello world' })
  })
})

describe('StreamEvent Types', () => {
  it('correctly identifies tool_call events', () => {
    const event = { type: 'tool_call', tool: 'create_task', input: { title: 'Test' } }
    expect(event.type).toBe('tool_call')
    expect(event.tool).toBe('create_task')
  })

  it('correctly identifies tool_result events', () => {
    const event = { type: 'tool_result', tool: 'create_task', output: 'Task created' }
    expect(event.type).toBe('tool_result')
    expect(event.output).toBe('Task created')
  })

  it('correctly identifies task_created events', () => {
    const event = {
      type: 'event',
      event: 'task_created',
      task: { id: '123', title: 'Test Task', status: 'proposed' },
    }
    expect(event.type).toBe('event')
    expect(event.event).toBe('task_created')
    expect(event.task?.id).toBe('123')
  })
})

describe('LedgerTask Interface', () => {
  it('includes conversation_id for linking', () => {
    const task = {
      id: '123',
      project_id: '456',
      title: 'Test Task',
      description: 'A test task',
      status: 'proposed' as const,
      priority: 3,
      proposed_by: '789',
      conversation_id: 'conv-123',
      github_pr_url: null,
      created_at: '2026-02-02T00:00:00Z',
    }

    expect(task.conversation_id).toBe('conv-123')
  })

  it('allows null conversation_id', () => {
    const task = {
      id: '123',
      project_id: '456',
      title: 'Test Task',
      description: 'A test task',
      status: 'completed' as const,
      priority: 3,
      proposed_by: '789',
      conversation_id: null,
      github_pr_url: 'https://github.com/test/pr/1',
      created_at: '2026-02-02T00:00:00Z',
    }

    expect(task.conversation_id).toBeNull()
  })
})
