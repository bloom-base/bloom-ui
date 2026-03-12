import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
  }),
  useParams: () => ({ owner: 'bloom-base', repo: 'genesis' }),
  usePathname: () => '/bloom-base/genesis/chat',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const mockRedirectToLogin = vi.fn()
vi.mock('@/lib/auth', () => ({
  redirectToLogin: (...args: unknown[]) => mockRedirectToLogin(...args),
}))

vi.mock('@/lib/useAutoScroll', () => ({
  useAutoScroll: () => ({
    messagesEndRef: { current: null },
    scrollContainerRef: { current: null },
    handleScroll: vi.fn(),
  }),
}))

vi.mock('@/components/Markdown', () => ({
  AgentMarkdown: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}))

vi.mock('@/lib/api', () => ({
  getProjectByPath: vi.fn(),
  createConversation: vi.fn(),
  getCurrentUser: vi.fn(),
  sendMessageStream: vi.fn(),
  approveTask: vi.fn(),
  rejectTask: vi.fn(),
}))

import NewChatPage from './page'
import * as api from '@/lib/api'

const mockProject = {
  id: 'proj-1',
  name: 'Genesis',
  description: 'The genesis project',
  github_repo: 'bloom-base/genesis',
  owner_id: 'user-1',
  is_public: true,
  vision: 'Build the future of collaborative software',
}

describe('NewChatPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    } as any)
  })

  it('shows loading spinner initially', () => {
    vi.mocked(api.getProjectByPath).mockReturnValue(new Promise(() => {}))

    render(<NewChatPage />)

    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows project not found when project fails to load', async () => {
    vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByText('Project not found')).toBeInTheDocument()
    })
    expect(screen.getByText('Browse projects')).toBeInTheDocument()
  })

  it('shows empty chat with prompt', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByText('What would you like to build?')).toBeInTheDocument()
    })
  })

  it('shows project vision in empty state', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByText('Vision')).toBeInTheDocument()
    })
    expect(screen.getByText('Build the future of collaborative software')).toBeInTheDocument()
  })

  it('shows project name in header', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })
    expect(screen.getByText('chat')).toBeInTheDocument()
  })

  it('shows message input with placeholder', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })
    expect(screen.getByText('Enter to send, Shift+Enter for new line')).toBeInTheDocument()
  })

  it('back arrow links to project page', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByText('Genesis')).toBeInTheDocument()
    })

    const backLink = document.querySelector('a[href="/bloom-base/genesis"]')
    expect(backLink).toBeTruthy()
  })

  it('send button is disabled when input is empty', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn).toBeTruthy()
    expect(submitBtn.disabled).toBe(true)
  })

  it('send button is enabled when input has text', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')

    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn.disabled).toBe(false)
  })

  it('submitting a message creates conversation and sends stream', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'text', content: 'I can help with that!' } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')

    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(api.createConversation).toHaveBeenCalledWith('proj-1')
    })
    expect(api.sendMessageStream).toHaveBeenCalledWith('conv-1', 'Add dark mode', expect.any(Function), expect.any(Object))

    // User message appears
    expect(screen.getByText('Add dark mode')).toBeInTheDocument()

    // Assistant response appears
    await waitFor(() => {
      expect(screen.getByText('I can help with that!')).toBeInTheDocument()
    })
  })

  it('Enter key submits the form', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockResolvedValue(undefined)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(api.createConversation).toHaveBeenCalled()
    })
  })

  it('Shift+Enter does NOT submit', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'line one')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    // Should NOT have called createConversation
    expect(api.createConversation).not.toHaveBeenCalled()
  })

  it('shows stop button while sending', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    // Never resolve sendMessageStream to keep sending=true
    vi.mocked(api.sendMessageStream).mockReturnValue(new Promise(() => {}))

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    await userEvent.click(submitBtn)

    // Stop button should appear (type="button", not submit)
    await waitFor(() => {
      const stopBtn = document.querySelector('button[type="button"]')
      expect(stopBtn).toBeTruthy()
    })
  })

  it('shows error message on send failure', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockRejectedValue(new Error('Server error'))

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Test idea')
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/Error: Server error/)).toBeInTheDocument()
    })
  })

  it('redirects to login on 401 during project load', async () => {
    vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('401 Unauthorized'))

    render(<NewChatPage />)

    await waitFor(() => {
      expect(mockRedirectToLogin).toHaveBeenCalledWith('/bloom-base/genesis/chat')
    })
  })

  it('shows task card when task_created event fires', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: {
          id: 'task-1',
          title: 'Add dark mode support',
          description: 'Implement a dark mode toggle with system preference detection and persistent user choice.',
          priority: 2,
          status: 'proposed',
        },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Task Proposed')).toBeInTheDocument()
    })
    expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
    expect(screen.getByText('P2')).toBeInTheDocument()
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  it('approve button calls approveTask and updates status', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.approveTask).mockResolvedValue({} as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-1', title: 'Dark mode', description: 'Add it', priority: 2, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Approve'))

    await waitFor(() => {
      expect(api.approveTask).toHaveBeenCalledWith('task-1')
    })

    // Status should change from 'proposed' to 'accepted' — Approve/Reject buttons should disappear
    await waitFor(() => {
      expect(screen.getByText('Task Queued')).toBeInTheDocument()
    })
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
  })

  it('reject button calls rejectTask and updates status', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.rejectTask).mockResolvedValue({} as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-1', title: 'Dark mode', description: 'Add it', priority: 2, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Reject'))

    await waitFor(() => {
      expect(api.rejectTask).toHaveBeenCalledWith('task-1')
    })

    await waitFor(() => {
      expect(screen.getByText('Task Rejected')).toBeInTheDocument()
    })
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
  })

  it('tool_call event shows tool message', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'tool_call', tool: 'read_file', input: { path: 'src/main.py' } } as any)
      onEvent({ type: 'tool_result', tool: 'read_file', output: 'file contents here' } as any)
      onEvent({ type: 'text', content: 'I read the file.' } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Read the file')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('read_file')).toBeInTheDocument()
    })
    expect(screen.getByText('(src/main.py)')).toBeInTheDocument()
  })

  it('tool output is expandable on click', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'tool_call', tool: 'read_file', input: { path: 'src/main.py' } } as any)
      onEvent({ type: 'tool_result', tool: 'read_file', output: 'print("hello world")' } as any)
      onEvent({ type: 'text', content: 'Done.' } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Read file')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('read_file')).toBeInTheDocument()
    })

    // Tool output should not be visible yet
    expect(screen.queryByText('print("hello world")')).not.toBeInTheDocument()

    // Click the tool header to expand
    const toolHeader = screen.getByText('read_file').closest('div[class*="cursor-pointer"]') || screen.getByText('read_file').parentElement
    if (toolHeader) {
      await userEvent.click(toolHeader)
    }

    // Tool output should now be visible
    await waitFor(() => {
      expect(screen.getByText('print("hello world")')).toBeInTheDocument()
    })
  })

  it('accepted task shows View progress link', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.approveTask).mockResolvedValue({} as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-1', title: 'Feature', description: 'Desc', priority: 2, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'feature')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Approve'))

    await waitFor(() => {
      expect(screen.getByText('View progress')).toBeInTheDocument()
    })
    const viewProgressLink = screen.getByText('View progress').closest('a')
    expect(viewProgressLink?.getAttribute('href')).toBe('/bloom-base/genesis')
  })

  it('placeholder changes after task is created', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-1', title: 'Feature', description: 'Desc', priority: 2, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'feature')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Refine the task or share another idea...')).toBeInTheDocument()
    })
  })

  it('Browse projects link has correct href', async () => {
    vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByText('Browse projects')).toBeInTheDocument()
    })

    const link = screen.getByText('Browse projects').closest('a')
    expect(link?.getAttribute('href')).toBe('/explore')
  })

  it('input clears after sending', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockResolvedValue(undefined)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...') as HTMLTextAreaElement
    await userEvent.type(textarea, 'Add dark mode')
    expect(textarea.value).toBe('Add dark mode')

    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    // Input should be cleared
    await waitFor(() => {
      expect(textarea.value).toBe('')
    })
  })

  it('task description expand/collapse toggles on click', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: {
          id: 'task-1',
          title: 'Add dark mode support',
          description: 'Implement a dark mode toggle with system preference detection and persistent user choice. This is a long description that exceeds the 100 character threshold.',
          priority: 2,
          status: 'proposed',
        },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
    })

    // Long description shows "show more" initially
    expect(screen.getByText('show more')).toBeInTheDocument()

    // Click the description area to expand
    const descriptionEl = screen.getByText(/Implement a dark mode toggle/).closest('.cursor-pointer')
    if (descriptionEl) {
      fireEvent.click(descriptionEl)
    }

    // "show more" should disappear after expanding
    await waitFor(() => {
      expect(screen.queryByText('show more')).not.toBeInTheDocument()
    })

    // Click again to collapse
    if (descriptionEl) {
      fireEvent.click(descriptionEl)
    }

    // "show more" should reappear after collapsing
    await waitFor(() => {
      expect(screen.getByText('show more')).toBeInTheDocument()
    })
  })

  it('Retry button on project not found calls window.location.reload', async () => {
    vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))

    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Retry'))
    expect(reloadMock).toHaveBeenCalled()
  })

  // ─── Stream event handling edge cases ───────────────────────────────

  it('error event from stream appends error content to assistant message', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'text', content: 'Starting...' } as any)
      onEvent({ type: 'error', content: 'Rate limit exceeded' } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Do something')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Starting...Rate limit exceeded')).toBeInTheDocument()
    })
  })

  it('stream error event with no prior text still shows error', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'error', content: 'Internal server error' } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Test idea')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument()
    })
  })

  it('unknown/unhandled stream event type does not crash or modify messages', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      // Fire an event type that the handler doesn't explicitly handle
      onEvent({ type: 'event', event: 'unknown_event' } as any)
      onEvent({ type: 'text', content: 'All good!' } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Test unknown event')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    // The text event should still appear — unknown event didn't break anything
    await waitFor(() => {
      expect(screen.getByText('All good!')).toBeInTheDocument()
    })
  })

  it('createConversation failure shows error message', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockRejectedValue(new Error('Failed to create conversation'))

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Hello')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to create conversation/)).toBeInTheDocument()
    })
  })

  it('401 error during send redirects to login', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockRejectedValue(new Error('401 Unauthorized'))

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Hello')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Please sign in to contribute ideas. Redirecting...')).toBeInTheDocument()
    })
  })

  // ─── Multiple sequential messages ──────────────────────────────────

  it('second message reuses existing conversationId', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'text', content: `Echo: ${content}` } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    // Send first message
    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'First message')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Echo: First message')).toBeInTheDocument()
    })

    // createConversation should be called once for the first message
    expect(api.createConversation).toHaveBeenCalledTimes(1)

    // Send second message — should reuse conv-1
    await userEvent.type(textarea, 'Second message')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Echo: Second message')).toBeInTheDocument()
    })

    // createConversation should NOT be called again
    expect(api.createConversation).toHaveBeenCalledTimes(1)

    // Both sendMessageStream calls should use conv-1
    expect(api.sendMessageStream).toHaveBeenCalledTimes(2)
    expect(vi.mocked(api.sendMessageStream).mock.calls[0][0]).toBe('conv-1')
    expect(vi.mocked(api.sendMessageStream).mock.calls[1][0]).toBe('conv-1')
  })

  it('multiple messages accumulate in conversation view', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'text', content: `Reply to: ${content}` } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')

    // Send message 1
    await userEvent.type(textarea, 'Add dark mode')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Reply to: Add dark mode')).toBeInTheDocument()
    })

    // Send message 2
    await userEvent.type(textarea, 'Also add i18n')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Reply to: Also add i18n')).toBeInTheDocument()
    })

    // Both user messages and both assistant replies should be visible
    expect(screen.getByText('Add dark mode')).toBeInTheDocument()
    expect(screen.getByText('Reply to: Add dark mode')).toBeInTheDocument()
    expect(screen.getByText('Also add i18n')).toBeInTheDocument()
    expect(screen.getByText('Reply to: Also add i18n')).toBeInTheDocument()
  })

  it('empty state disappears after first message', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockResolvedValue(undefined)

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByText('What would you like to build?')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Build something')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    // Empty state should be gone now that there's a message
    await waitFor(() => {
      expect(screen.queryByText('What would you like to build?')).not.toBeInTheDocument()
    })
  })

  // ─── Stop button interaction ───────────────────────────────────────

  it('stop button calls abort on the AbortController', async () => {
    const abortSpy = vi.fn()
    const originalAbortController = global.AbortController
    global.AbortController = vi.fn().mockImplementation(() => ({
      signal: { aborted: false },
      abort: abortSpy,
    })) as any

    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    // Never resolve to keep in sending state
    vi.mocked(api.sendMessageStream).mockReturnValue(new Promise(() => {}))

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Start something')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    // Wait for stop button to appear
    await waitFor(() => {
      const stopBtn = document.querySelector('button[type="button"]')
      expect(stopBtn).toBeTruthy()
    })

    // Click stop button
    const stopBtn = document.querySelector('button[type="button"]') as HTMLButtonElement
    await userEvent.click(stopBtn)

    expect(abortSpy).toHaveBeenCalled()

    global.AbortController = originalAbortController
  })

  it('stop button disappears after stream completes', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'text', content: 'Done!' } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Quick task')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    // After stream completes, the submit button should be back (not the stop button)
    await waitFor(() => {
      expect(screen.getByText('Done!')).toBeInTheDocument()
    })

    // Submit button should be present (type="submit"), not stop (type="button")
    const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn).toBeTruthy()
  })

  it('abort error appends (stopped) to last assistant message', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)

    let resolveStream: () => void
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent, signal) => {
      onEvent({ type: 'text', content: 'Working on it' } as any)
      // Wait for abort or resolve
      return new Promise<void>((resolve, reject) => {
        resolveStream = resolve
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
          })
        }
      })
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Start long task')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    // Wait for streaming to begin
    await waitFor(() => {
      expect(screen.getByText('Working on it')).toBeInTheDocument()
    })

    // Wait for stop button
    await waitFor(() => {
      expect(document.querySelector('button[type="button"]')).toBeTruthy()
    })

    // Click stop
    const stopBtn = document.querySelector('button[type="button"]') as HTMLButtonElement
    await userEvent.click(stopBtn)

    // The assistant message should have (stopped) appended
    await waitFor(() => {
      expect(screen.getByText('Working on it (stopped)')).toBeInTheDocument()
    })
  })

  // ─── Task approve with full interaction ────────────────────────────

  it('approve button shows success state and hides action buttons', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.approveTask).mockResolvedValue({ message: 'Task approved', status: 'accepted' })
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-42', title: 'Add caching', description: 'Add Redis caching layer', priority: 1, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add caching')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    // Click Approve
    await userEvent.click(screen.getByText('Approve'))

    // API was called with correct task ID
    await waitFor(() => {
      expect(api.approveTask).toHaveBeenCalledWith('task-42')
    })

    // Status indicator changes to green dot + "Task Queued"
    await waitFor(() => {
      expect(screen.getByText('Task Queued')).toBeInTheDocument()
    })

    // Approve/Reject buttons removed
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
    expect(screen.queryByText('Reject')).not.toBeInTheDocument()

    // "View progress" link appears
    expect(screen.getByText('View progress')).toBeInTheDocument()

    // Priority badge and status text remain
    expect(screen.getByText('P1')).toBeInTheDocument()
    expect(screen.getByText('accepted')).toBeInTheDocument()
  })

  it('approve button failure does not change task status', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.approveTask).mockRejectedValue(new Error('Network error'))
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-99', title: 'Broken task', description: 'Desc', priority: 3, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Try this')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Approve'))

    // API was called
    await waitFor(() => {
      expect(api.approveTask).toHaveBeenCalledWith('task-99')
    })

    // Status should still be proposed (approve failed)
    expect(screen.getByText('Task Proposed')).toBeInTheDocument()

    // Approve/Reject buttons should still be visible
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()

    // Error should have been logged
    expect(consoleSpy).toHaveBeenCalledWith('Failed to approve task:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  // ─── Task reject with full interaction ─────────────────────────────

  it('reject button shows rejected state and hides action buttons', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.rejectTask).mockResolvedValue({ message: 'Task rejected', status: 'rejected' })
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-77', title: 'Bad idea', description: 'This should be rejected', priority: 3, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Bad idea')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument()
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    // Click Reject
    await userEvent.click(screen.getByText('Reject'))

    // API was called with correct task ID
    await waitFor(() => {
      expect(api.rejectTask).toHaveBeenCalledWith('task-77')
    })

    // Status indicator changes to gray dot + "Task Rejected"
    await waitFor(() => {
      expect(screen.getByText('Task Rejected')).toBeInTheDocument()
    })

    // Approve/Reject buttons removed
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
    expect(screen.queryByText('Reject')).not.toBeInTheDocument()

    // No "View progress" link for rejected tasks
    expect(screen.queryByText('View progress')).not.toBeInTheDocument()

    // Status text shows "rejected"
    expect(screen.getByText('rejected')).toBeInTheDocument()
  })

  it('reject button failure does not change task status', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.rejectTask).mockRejectedValue(new Error('Server down'))
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-88', title: 'Failing reject', description: 'Desc', priority: 2, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Try reject')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Reject'))

    // API was called
    await waitFor(() => {
      expect(api.rejectTask).toHaveBeenCalledWith('task-88')
    })

    // Status should still be proposed (reject failed)
    expect(screen.getByText('Task Proposed')).toBeInTheDocument()

    // Approve/Reject buttons should still be visible
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()

    // Error should have been logged
    expect(consoleSpy).toHaveBeenCalledWith('Failed to reject task:', expect.any(Error))
    consoleSpy.mockRestore()
  })

  it('task with multiple tool calls then task_created shows full conversation', async () => {
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
    vi.mocked(api.createConversation).mockResolvedValue({ id: 'conv-1' } as any)
    vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
      onEvent({ type: 'text', content: 'Let me analyze this.' } as any)
      onEvent({ type: 'tool_call', tool: 'search_code', input: { query: 'dark mode' } } as any)
      onEvent({ type: 'tool_result', tool: 'search_code', output: 'Found 3 results' } as any)
      onEvent({ type: 'tool_call', tool: 'read_file', input: { path: 'src/theme.ts' } } as any)
      onEvent({ type: 'tool_result', tool: 'read_file', output: 'export const theme = {}' } as any)
      onEvent({ type: 'text', content: 'Based on my analysis, here is the task.' } as any)
      onEvent({
        type: 'event',
        event: 'task_created',
        task: { id: 'task-55', title: 'Dark mode', description: 'Full dark mode impl', priority: 2, status: 'proposed' },
      } as any)
    })

    render(<NewChatPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Share an idea...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Share an idea...')
    await userEvent.type(textarea, 'Add dark mode')
    await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

    // Tool calls should be visible
    await waitFor(() => {
      expect(screen.getByText('search_code')).toBeInTheDocument()
    })
    expect(screen.getByText('(dark mode)')).toBeInTheDocument()
    expect(screen.getByText('read_file')).toBeInTheDocument()
    expect(screen.getByText('(src/theme.ts)')).toBeInTheDocument()

    // Task card should appear
    expect(screen.getByText('Task Proposed')).toBeInTheDocument()
    expect(screen.getByText('Dark mode')).toBeInTheDocument()
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })
})
