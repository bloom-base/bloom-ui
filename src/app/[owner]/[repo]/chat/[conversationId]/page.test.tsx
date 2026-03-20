import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  back: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ owner: 'bloom-base', repo: 'genesis', conversationId: 'conv-123' }),
  usePathname: () => '/bloom-base/genesis/chat/conv-123',
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
  getConversation: vi.fn(),
  getConversationTasks: vi.fn(),
  getCurrentUser: vi.fn(),
  sendMessageStream: vi.fn(),
  approveTask: vi.fn(),
  rejectTask: vi.fn(),
}))

import ConversationPage from './page'
import * as api from '@/lib/api'
import { toast } from 'sonner'

const mockProject = {
  id: 'proj-1',
  name: 'Genesis',
  description: 'The genesis project',
  github_repo: 'bloom-base/genesis',
  owner_id: 'user-1',
  is_public: true,
}

const mockUser = {
  id: 'user-1',
  github_username: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  subscription_tier: 'free',
  is_admin: false,
  has_anthropic_key: false,
}

const mockConversation = {
  id: 'conv-123',
  project_id: 'proj-1',
  user_id: 'user-1',
  messages: [
    { id: 'msg-1', role: 'user', content: 'Add dark mode support', tool_name: null, tool_input: null, tool_output: null, task_id: null },
    { id: 'msg-2', role: 'assistant', content: 'I can help with that! Let me evaluate this idea.', tool_name: null, tool_input: null, tool_output: null, task_id: null },
  ],
}

const mockConversationWithToolMessages = {
  id: 'conv-123',
  project_id: 'proj-1',
  user_id: 'user-1',
  messages: [
    { id: 'msg-1', role: 'user', content: 'Read the config file', tool_name: null, tool_input: null, tool_output: null, task_id: null },
    { id: 'msg-2', role: 'tool', content: '', tool_name: 'read_file', tool_input: '{"path":"config.json"}', tool_output: '{"debug": true}', task_id: null },
    { id: 'msg-3', role: 'assistant', content: 'Here is the config file content.', tool_name: null, tool_input: null, tool_output: null, task_id: null },
  ],
}

const mockConversationWithTasks = {
  id: 'conv-123',
  project_id: 'proj-1',
  user_id: 'user-1',
  messages: [
    { id: 'msg-1', role: 'user', content: 'Add dark mode', tool_name: null, tool_input: null, tool_output: null, task_id: null },
    { id: 'msg-2', role: 'tool', content: '', tool_name: 'create_task', tool_input: '{"title":"Dark mode"}', tool_output: 'Task created', task_id: 'task-1' },
    { id: 'msg-3', role: 'assistant', content: 'I created a task for dark mode.', tool_name: null, tool_input: null, tool_output: null, task_id: null },
  ],
}

const mockTask = {
  id: 'task-1',
  title: 'Add dark mode support',
  description: 'Implement a dark mode toggle with system preference detection and persistent user choice. This will involve updating the CSS variables and adding a toggle component.',
  priority: 2,
  status: 'proposed' as const,
}

/** Helper: set up API mocks for a standard loaded conversation page */
function setupLoadedPage(overrides: {
  project?: typeof mockProject | null
  conversation?: typeof mockConversation
  tasks?: typeof mockTask[]
  user?: typeof mockUser | null
} = {}) {
  vi.mocked(api.getProjectByPath).mockResolvedValue(('project' in overrides ? overrides.project : mockProject) as any)
  vi.mocked(api.getConversation).mockResolvedValue(('conversation' in overrides ? overrides.conversation : mockConversation) as any)
  vi.mocked(api.getConversationTasks).mockResolvedValue(('tasks' in overrides ? overrides.tasks : []) as any)
  if ('user' in overrides && overrides.user === null) {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Not logged in'))
  } else {
    vi.mocked(api.getCurrentUser).mockResolvedValue(('user' in overrides ? overrides.user : mockUser) as any)
  }
}

describe('ConversationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      vi.mocked(api.getProjectByPath).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getConversation).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getConversationTasks).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}))

      render(<ConversationPage />)

      expect(document.querySelector('.animate-spin')).toBeTruthy()
    })

    it('hides loading spinner after data loads', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeFalsy()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Error / not found states
  // ---------------------------------------------------------------------------
  describe('error states', () => {
    it('shows conversation not found on error', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getConversation).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getConversationTasks).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Not logged in'))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Conversation not found')).toBeInTheDocument()
      })
      expect(screen.getByText("This conversation doesn't exist or you don't have access.")).toBeInTheDocument()
    })

    it('shows Start new conversation link on error', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getConversation).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getConversationTasks).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Not logged in'))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Start new conversation')).toBeInTheDocument()
      })
      const link = screen.getByText('Start new conversation').closest('a')
      expect(link?.getAttribute('href')).toBe('/bloom-base/genesis/chat')
    })

    it('shows Retry button on error', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getConversation).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getConversationTasks).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Not logged in'))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('Retry button calls window.location.reload', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getConversation).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getConversationTasks).mockRejectedValue(new Error('Not found'))
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Not logged in'))

      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Retry'))
      expect(reloadMock).toHaveBeenCalled()
    })

    it('redirects to login on 401 error', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('401 Unauthorized'))
      vi.mocked(api.getConversation).mockRejectedValue(new Error('401 Unauthorized'))
      vi.mocked(api.getConversationTasks).mockRejectedValue(new Error('401 Unauthorized'))
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('401'))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(mockRedirectToLogin).toHaveBeenCalledWith('/bloom-base/genesis/chat/conv-123')
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Header & navigation
  // ---------------------------------------------------------------------------
  describe('header and navigation', () => {
    it('shows project name in header', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })
      expect(screen.getByText('Continue conversation')).toBeInTheDocument()
    })

    it('back arrow links to project page', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })

      const backLink = document.querySelector('a[href="/bloom-base/genesis"]')
      expect(backLink).toBeTruthy()
    })
  })

  // ---------------------------------------------------------------------------
  // Message history rendering
  // ---------------------------------------------------------------------------
  describe('message history rendering', () => {
    it('renders existing user messages', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
      })
    })

    it('renders existing assistant messages', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('I can help with that! Let me evaluate this idea.')).toBeInTheDocument()
      })
    })

    it('renders multiple messages in order', async () => {
      const multiMessageConv = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: [
          { id: 'msg-1', role: 'user', content: 'First message', tool_name: null, tool_input: null, tool_output: null, task_id: null },
          { id: 'msg-2', role: 'assistant', content: 'First reply', tool_name: null, tool_input: null, tool_output: null, task_id: null },
          { id: 'msg-3', role: 'user', content: 'Second message', tool_name: null, tool_input: null, tool_output: null, task_id: null },
          { id: 'msg-4', role: 'assistant', content: 'Second reply', tool_name: null, tool_input: null, tool_output: null, task_id: null },
        ],
      }
      setupLoadedPage({ conversation: multiMessageConv })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('First message')).toBeInTheDocument()
      })
      expect(screen.getByText('First reply')).toBeInTheDocument()
      expect(screen.getByText('Second message')).toBeInTheDocument()
      expect(screen.getByText('Second reply')).toBeInTheDocument()
    })

    it('renders conversation with no messages (empty messages array)', async () => {
      const emptyConv = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: [],
      }
      setupLoadedPage({ conversation: emptyConv })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })
      // Should show the input but no messages
      expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
    })

    it('renders conversation with null messages', async () => {
      const nullMsgConv = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: null,
      }
      setupLoadedPage({ conversation: nullMsgConv as any })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Genesis')).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Owner vs non-owner input visibility
  // ---------------------------------------------------------------------------
  describe('input visibility', () => {
    it('shows input for conversation owner', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })
    })

    it('shows read-only message for non-owner', async () => {
      const otherUser = { ...mockUser, id: 'user-2', github_username: 'otheruser' }
      setupLoadedPage({ user: otherUser })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('You can view this conversation but only the owner can continue it.')).toBeInTheDocument()
      })
    })

    it('hides input textarea for non-owner', async () => {
      const otherUser = { ...mockUser, id: 'user-2' }
      setupLoadedPage({ user: otherUser })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('You can view this conversation but only the owner can continue it.')).toBeInTheDocument()
      })
      expect(screen.queryByPlaceholderText('Continue the conversation...')).not.toBeInTheDocument()
    })

    it('shows read-only message when getCurrentUser returns null', async () => {
      setupLoadedPage({ user: null })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('You can view this conversation but only the owner can continue it.')).toBeInTheDocument()
      })
    })

    it('shows hint text about Enter / Shift+Enter for owner', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Press Enter to send, Shift+Enter for new line')).toBeInTheDocument()
      })
    })

    it('changes placeholder when tasks exist', async () => {
      setupLoadedPage({ tasks: [mockTask] })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Refine the task or propose another idea...')).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Send message form
  // ---------------------------------------------------------------------------
  describe('send message form', () => {
    it('submit button is disabled when input is empty', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(submitBtn).toBeTruthy()
      expect(submitBtn.disabled).toBe(true)
    })

    it('submit button is enabled when input has text', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Hello agent')

      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(submitBtn.disabled).toBe(false)
    })

    it('typing in textarea updates input value', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...') as HTMLTextAreaElement
      await userEvent.type(textarea, 'My message')
      expect(textarea.value).toBe('My message')
    })

    it('submitting sends message and clears input', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'text', content: 'Agent response' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...') as HTMLTextAreaElement
      await userEvent.type(textarea, 'New idea')

      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(api.sendMessageStream).toHaveBeenCalledWith(
          'conv-123',
          'New idea',
          expect.any(Function),
          expect.any(Object)
        )
      })

      // Input should be cleared
      await waitFor(() => {
        expect(textarea.value).toBe('')
      })
    })

    it('user message appears immediately after submit', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async () => {})

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'My new message')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('My new message')).toBeInTheDocument()
      })
    })

    it('assistant response appears after streaming', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'text', content: 'Here is my ' } as any)
        onEvent({ type: 'text', content: 'response.' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Tell me something')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Here is my response.')).toBeInTheDocument()
      })
    })

    it('does not submit when input is only whitespace', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      fireEvent.change(textarea, { target: { value: '   ' } })

      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(submitBtn.disabled).toBe(true)
    })

    it('does not submit while already sending', async () => {
      setupLoadedPage()
      // Never resolve to keep sending=true
      vi.mocked(api.sendMessageStream).mockReturnValue(new Promise(() => {}))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'First message')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      // Wait for sending state to take effect
      await waitFor(() => {
        expect(document.querySelector('button[type="button"]')).toBeTruthy()
      })

      // sendMessageStream should have been called once
      expect(api.sendMessageStream).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  describe('keyboard shortcuts', () => {
    it('Enter key submits the form', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockResolvedValue(undefined)

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Test message')
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

      await waitFor(() => {
        expect(api.sendMessageStream).toHaveBeenCalledWith(
          'conv-123',
          'Test message',
          expect.any(Function),
          expect.any(Object)
        )
      })
    })

    it('Shift+Enter does NOT submit the form', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Line one')
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

      expect(api.sendMessageStream).not.toHaveBeenCalled()
    })

    it('Enter on empty input does not submit', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

      expect(api.sendMessageStream).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Stop / cancel button during streaming
  // ---------------------------------------------------------------------------
  describe('stop button during streaming', () => {
    it('shows stop button while sending', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockReturnValue(new Promise(() => {}))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Send something')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        const stopBtn = document.querySelector('button[type="button"]')
        expect(stopBtn).toBeTruthy()
      })

      // Submit button should be gone
      expect(document.querySelector('button[type="submit"]')).toBeFalsy()
    })

    it('clicking stop button aborts the stream and appends (stopped)', async () => {
      setupLoadedPage()

      // Simulate a stream that hangs until aborted
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent, signal) => {
        onEvent({ type: 'text', content: 'Partial response' } as any)
        // Wait for abort signal
        return new Promise<void>((_, reject) => {
          const abortErr = new Error('The operation was aborted.')
          abortErr.name = 'AbortError'
          signal?.addEventListener('abort', () => {
            reject(abortErr)
          })
        })
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Send message')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      // Wait for stop button to appear
      await waitFor(() => {
        expect(document.querySelector('button[type="button"]')).toBeTruthy()
      })

      // Click stop
      const stopBtn = document.querySelector('button[type="button"]') as HTMLButtonElement
      await userEvent.click(stopBtn)

      // Should show "(stopped)" appended to partial response
      await waitFor(() => {
        expect(screen.getByText('Partial response (stopped)')).toBeInTheDocument()
      })

      // Submit button should reappear
      await waitFor(() => {
        expect(document.querySelector('button[type="submit"]')).toBeTruthy()
      })
    })

    it('submit button reappears after stream completes', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'text', content: 'Done' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Quick question')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      // After stream completes, submit button should be back
      await waitFor(() => {
        expect(document.querySelector('button[type="submit"]')).toBeTruthy()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Error handling in streaming
  // ---------------------------------------------------------------------------
  describe('error handling during send', () => {
    it('shows error message on stream failure', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockRejectedValue(new Error('Server error'))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Trigger error')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
      })
    })

    it('does not show error for user-initiated abort (AbortError)', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent, signal) => {
        return new Promise<void>((_, reject) => {
          const abortErr = new Error('Aborted')
          abortErr.name = 'AbortError'
          signal?.addEventListener('abort', () => {
            reject(abortErr)
          })
        })
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Will be stopped')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(document.querySelector('button[type="button"]')).toBeTruthy()
      })

      const stopBtn = document.querySelector('button[type="button"]') as HTMLButtonElement
      await userEvent.click(stopBtn)

      await waitFor(() => {
        expect(document.querySelector('button[type="submit"]')).toBeTruthy()
      })

      // Should NOT show "Something went wrong"
      expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Tool call display
  // ---------------------------------------------------------------------------
  describe('tool call display', () => {
    it('renders tool messages from history', async () => {
      setupLoadedPage({ conversation: mockConversationWithToolMessages })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Read File')).toBeInTheDocument()
      })
    })

    it('shows tool input path in parentheses', async () => {
      setupLoadedPage({ conversation: mockConversationWithToolMessages })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('(path=config.json)')).toBeInTheDocument()
      })
    })

    it('tool output is hidden by default', async () => {
      setupLoadedPage({ conversation: mockConversationWithToolMessages })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Read File')).toBeInTheDocument()
      })

      expect(screen.queryByText('{"debug": true}')).not.toBeInTheDocument()
    })

    it('shows "click to expand" hint for tool with output', async () => {
      setupLoadedPage({ conversation: mockConversationWithToolMessages })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('click to expand')).toBeInTheDocument()
      })
    })

    it('clicking tool header expands output', async () => {
      setupLoadedPage({ conversation: mockConversationWithToolMessages })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Read File')).toBeInTheDocument()
      })

      // Click the tool header to expand
      const toolHeader = screen.getByText('Read File').closest('div[class*="cursor-pointer"]') || screen.getByText('Read File').parentElement
      if (toolHeader) {
        await userEvent.click(toolHeader)
      }

      await waitFor(() => {
        expect(screen.getByText('{"debug": true}')).toBeInTheDocument()
      })
    })

    it('clicking expanded tool header collapses output', async () => {
      setupLoadedPage({ conversation: mockConversationWithToolMessages })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Read File')).toBeInTheDocument()
      })

      // Expand
      const toolHeader = screen.getByText('Read File').closest('div[class*="cursor-pointer"]') || screen.getByText('Read File').parentElement
      if (toolHeader) {
        await userEvent.click(toolHeader)
      }

      await waitFor(() => {
        expect(screen.getByText('{"debug": true}')).toBeInTheDocument()
      })

      // Collapse
      if (toolHeader) {
        await userEvent.click(toolHeader)
      }

      await waitFor(() => {
        expect(screen.queryByText('{"debug": true}')).not.toBeInTheDocument()
      })
    })

    it('tool call during streaming shows tool name', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'tool_call', tool: 'search_code', input: { query: 'dark mode' } } as any)
        onEvent({ type: 'tool_result', tool: 'search_code', output: 'Found 3 results' } as any)
        onEvent({ type: 'text', content: 'I searched the code.' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Search for dark mode')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Search Code')).toBeInTheDocument()
      })
      expect(screen.getByText('(query=dark mode)')).toBeInTheDocument()
    })

    it('tool with title input shows title in parentheses', async () => {
      const convWithTitleTool = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: [
          { id: 'msg-1', role: 'tool', content: '', tool_name: 'create_task', tool_input: '{"title":"Add tests"}', tool_output: 'created', task_id: null },
        ],
      }
      setupLoadedPage({ conversation: convWithTitleTool as any })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('(title=Add tests)')).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Task cards — approve / reject
  // ---------------------------------------------------------------------------
  describe('task cards', () => {
    it('renders proposed task card from history', async () => {
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Task Proposed')).toBeInTheDocument()
      })
      expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
      expect(screen.getByText('P2')).toBeInTheDocument()
      expect(screen.getByText('proposed')).toBeInTheDocument()
    })

    it('shows Approve and Reject buttons for proposed tasks', async () => {
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument()
      })
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    it('approve button calls approveTask and updates status', async () => {
      vi.mocked(api.approveTask).mockResolvedValue({} as any)
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('Approve'))

      await waitFor(() => {
        expect(api.approveTask).toHaveBeenCalledWith('task-1')
      })

      await waitFor(() => {
        expect(screen.getByText('Task Queued')).toBeInTheDocument()
      })
      expect(screen.queryByText('Approve')).not.toBeInTheDocument()
      expect(screen.queryByText('Reject')).not.toBeInTheDocument()
    })

    it('approve success shows toast', async () => {
      vi.mocked(api.approveTask).mockResolvedValue({} as any)
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('Approve'))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Task approved and queued')
      })
    })

    it('approve failure shows error toast', async () => {
      vi.mocked(api.approveTask).mockRejectedValue(new Error('API error'))
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Approve')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('Approve'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to approve task')
      })
    })

    it('reject button calls rejectTask and updates status', async () => {
      vi.mocked(api.rejectTask).mockResolvedValue({} as any)
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

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
      expect(screen.queryByText('Reject')).not.toBeInTheDocument()
    })

    it('reject success shows toast', async () => {
      vi.mocked(api.rejectTask).mockResolvedValue({} as any)
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Reject')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('Reject'))

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith('Task rejected')
      })
    })

    it('reject failure shows error toast', async () => {
      vi.mocked(api.rejectTask).mockRejectedValue(new Error('API error'))
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Reject')).toBeInTheDocument()
      })

      await userEvent.click(screen.getByText('Reject'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to reject task')
      })
    })

    it('accepted task shows View progress link', async () => {
      const acceptedTask = { ...mockTask, status: 'accepted' as const }
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [acceptedTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('View progress')).toBeInTheDocument()
      })

      const link = screen.getByText('View progress').closest('a')
      expect(link?.getAttribute('href')).toBe('/bloom-base/genesis')
    })

    it('accepted task shows Task Queued status', async () => {
      const acceptedTask = { ...mockTask, status: 'accepted' as const }
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [acceptedTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Task Queued')).toBeInTheDocument()
      })
    })

    it('rejected task shows Task Rejected status and no buttons', async () => {
      const rejectedTask = { ...mockTask, status: 'rejected' as const }
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [rejectedTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Task Rejected')).toBeInTheDocument()
      })
      expect(screen.queryByText('Approve')).not.toBeInTheDocument()
      expect(screen.queryByText('Reject')).not.toBeInTheDocument()
      expect(screen.queryByText('View progress')).not.toBeInTheDocument()
    })

    it('cancelled task shows Task Cancelled status and no buttons', async () => {
      const cancelledTask = { ...mockTask, status: 'cancelled' as const }
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [cancelledTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Task Cancelled')).toBeInTheDocument()
      })
      expect(screen.queryByText('Approve')).not.toBeInTheDocument()
      expect(screen.queryByText('View progress')).not.toBeInTheDocument()
    })

    it('in_progress task shows Task Queued and View progress', async () => {
      const inProgressTask = { ...mockTask, status: 'in_progress' as const }
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [inProgressTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Task Queued')).toBeInTheDocument()
      })
      expect(screen.getByText('View progress')).toBeInTheDocument()
    })

    it('task description is expandable on click', async () => {
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
      })

      // Long description should show "show more"
      expect(screen.getByText('show more')).toBeInTheDocument()

      // Click to expand
      const descriptionEl = screen.getByText(/Implement a dark mode toggle/).closest('.cursor-pointer')
      if (descriptionEl) {
        await userEvent.click(descriptionEl)
      }

      // "show more" should disappear after expanding
      await waitFor(() => {
        expect(screen.queryByText('show more')).not.toBeInTheDocument()
      })
    })

    it('task created during streaming shows task card', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'tool_call', tool: 'create_task', input: { title: 'New feature' } } as any)
        onEvent({ type: 'tool_result', tool: 'create_task', output: 'Task created' } as any)
        onEvent({
          type: 'event',
          event: 'task_created',
          task: {
            id: 'task-new',
            title: 'New feature',
            description: 'Build a new feature for the project.',
            priority: 1,
            status: 'proposed',
          },
        } as any)
        onEvent({ type: 'text', content: 'I created a task.' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Build a feature')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Task Proposed')).toBeInTheDocument()
      })
      expect(screen.getByText('New feature')).toBeInTheDocument()
      expect(screen.getByText('P1')).toBeInTheDocument()
      expect(screen.getByText('Approve')).toBeInTheDocument()
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Streaming events
  // ---------------------------------------------------------------------------
  describe('streaming events', () => {
    it('handles text events and builds up assistant message', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'text', content: 'Hello ' } as any)
        onEvent({ type: 'text', content: 'world!' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Greet me')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Hello world!')).toBeInTheDocument()
      })
    })

    it('handles error event type and appends to assistant message', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'error', content: 'Rate limit exceeded' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Do something')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
      })
    })

    it('shows typing indicator for empty assistant message during stream', async () => {
      setupLoadedPage()
      // Start streaming but don't send any text events yet
      let resolveStream: () => void
      vi.mocked(api.sendMessageStream).mockImplementation(async () => {
        return new Promise<void>((resolve) => {
          resolveStream = resolve
        })
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Say something')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      // The empty assistant message should show the bounce animation
      await waitFor(() => {
        const bounceDots = document.querySelectorAll('.animate-bounce')
        expect(bounceDots.length).toBeGreaterThanOrEqual(3)
      })
    })

    it('assistant message renders via AgentMarkdown when content exists', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'text', content: '**bold text**' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Format something')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        // AgentMarkdown mock renders content inside a div with data-testid="markdown"
        const markdownEls = screen.getAllByTestId('markdown')
        const hasStreamed = markdownEls.some((el) => el.textContent?.includes('**bold text**'))
        expect(hasStreamed).toBe(true)
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  describe('data fetching', () => {
    it('calls getProjectByPath with owner and repo', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(api.getProjectByPath).toHaveBeenCalledWith('bloom-base', 'genesis')
      })
    })

    it('calls getConversation with conversationId', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(api.getConversation).toHaveBeenCalledWith('conv-123')
      })
    })

    it('calls getConversationTasks with conversationId', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(api.getConversationTasks).toHaveBeenCalledWith('conv-123')
      })
    })

    it('calls getCurrentUser', async () => {
      setupLoadedPage()

      render(<ConversationPage />)

      await waitFor(() => {
        expect(api.getCurrentUser).toHaveBeenCalled()
      })
    })

    it('handles getCurrentUser failure gracefully (treats as logged out)', async () => {
      vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)
      vi.mocked(api.getConversation).mockResolvedValue(mockConversation as any)
      vi.mocked(api.getConversationTasks).mockResolvedValue([])
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Not logged in'))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('You can view this conversation but only the owner can continue it.')).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Error recovery — send fails, then retry succeeds
  // ---------------------------------------------------------------------------
  describe('error recovery', () => {
    it('user can send a new message after a previous send fails', async () => {
      setupLoadedPage()

      // First call fails, second call succeeds
      vi.mocked(api.sendMessageStream)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementationOnce(async (convId, content, onEvent) => {
          onEvent({ type: 'text', content: 'Recovery response' } as any)
        })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      // First attempt — fails
      const textarea = screen.getByPlaceholderText('Continue the conversation...') as HTMLTextAreaElement
      await userEvent.type(textarea, 'First attempt')
      const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement
      await userEvent.click(submitBtn)

      await waitFor(() => {
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
      })

      // Submit button should be back (not stuck in sending state)
      await waitFor(() => {
        expect(document.querySelector('button[type="submit"]')).toBeTruthy()
      })

      // Second attempt — succeeds
      await userEvent.type(textarea, 'Retry message')
      await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

      await waitFor(() => {
        expect(screen.getByText('Recovery response')).toBeInTheDocument()
      })

      expect(api.sendMessageStream).toHaveBeenCalledTimes(2)
    })

    it('input is cleared after failed send, allowing fresh input', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockRejectedValue(new Error('Server error'))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...') as HTMLTextAreaElement
      await userEvent.type(textarea, 'Doomed message')
      await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

      // After failure, input should be empty (it was cleared on submit)
      await waitFor(() => {
        expect(textarea.value).toBe('')
      })

      // And user message should appear in the chat (optimistic add)
      expect(screen.getByText('Doomed message')).toBeInTheDocument()
    })

    it('sending state resets to false after stream error', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockRejectedValue(new Error('fail'))

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Error message')
      await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

      // After error, submit button (not stop button) should be present
      await waitFor(() => {
        expect(document.querySelector('button[type="submit"]')).toBeTruthy()
      })
      expect(document.querySelector('button[type="button"]')).toBeFalsy()
    })
  })

  // ---------------------------------------------------------------------------
  // Many messages rendering (long conversation)
  // ---------------------------------------------------------------------------
  describe('long conversation rendering', () => {
    it('renders a conversation with many messages', async () => {
      const manyMessages = Array.from({ length: 50 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message number ${i}`,
        tool_name: null,
        tool_input: null,
        tool_output: null,
        task_id: null,
      }))
      const longConv = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: manyMessages,
      }
      setupLoadedPage({ conversation: longConv as any })

      render(<ConversationPage />)

      // First and last messages should be visible
      await waitFor(() => {
        expect(screen.getByText('Message number 0')).toBeInTheDocument()
      })
      expect(screen.getByText('Message number 49')).toBeInTheDocument()

      // Spot check some messages in the middle
      expect(screen.getByText('Message number 24')).toBeInTheDocument()
      expect(screen.getByText('Message number 25')).toBeInTheDocument()
    })

    it('renders a conversation with mixed message types (user, assistant, tool)', async () => {
      const mixedMessages = [
        { id: 'msg-0', role: 'user', content: 'Do something', tool_name: null, tool_input: null, tool_output: null, task_id: null },
        { id: 'msg-1', role: 'tool', content: '', tool_name: 'read_file', tool_input: '{"path":"README.md"}', tool_output: '# Readme', task_id: null },
        { id: 'msg-2', role: 'tool', content: '', tool_name: 'search_code', tool_input: '{"query":"TODO"}', tool_output: 'Found 5 results', task_id: null },
        { id: 'msg-3', role: 'assistant', content: 'I found some things.', tool_name: null, tool_input: null, tool_output: null, task_id: null },
        { id: 'msg-4', role: 'user', content: 'Do more', tool_name: null, tool_input: null, tool_output: null, task_id: null },
        { id: 'msg-5', role: 'tool', content: '', tool_name: 'write_file', tool_input: '{"path":"fix.ts"}', tool_output: 'Written', task_id: null },
        { id: 'msg-6', role: 'assistant', content: 'Done!', tool_name: null, tool_input: null, tool_output: null, task_id: null },
      ]
      const conv = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: mixedMessages,
      }
      setupLoadedPage({ conversation: conv as any })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Do something')).toBeInTheDocument()
      })
      expect(screen.getByText('Read File')).toBeInTheDocument()
      expect(screen.getByText('Search Code')).toBeInTheDocument()
      expect(screen.getByText('I found some things.')).toBeInTheDocument()
      expect(screen.getByText('Do more')).toBeInTheDocument()
      expect(screen.getByText('Write File')).toBeInTheDocument()
      expect(screen.getByText('Done!')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Multiple tasks in one conversation
  // ---------------------------------------------------------------------------
  describe('multiple tasks', () => {
    it('renders multiple task cards from history', async () => {
      const convWithMultipleTasks = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Build two features', tool_name: null, tool_input: null, tool_output: null, task_id: null },
          { id: 'msg-2', role: 'tool', content: '', tool_name: 'create_task', tool_input: '{"title":"Feature A"}', tool_output: 'Task created', task_id: 'task-a' },
          { id: 'msg-3', role: 'tool', content: '', tool_name: 'create_task', tool_input: '{"title":"Feature B"}', tool_output: 'Task created', task_id: 'task-b' },
          { id: 'msg-4', role: 'assistant', content: 'Created two tasks.', tool_name: null, tool_input: null, tool_output: null, task_id: null },
        ],
      }
      const taskA = { id: 'task-a', title: 'Feature A', description: 'First feature', priority: 1, status: 'proposed' as const }
      const taskB = { id: 'task-b', title: 'Feature B', description: 'Second feature', priority: 2, status: 'accepted' as const }

      setupLoadedPage({
        conversation: convWithMultipleTasks as any,
        tasks: [taskA, taskB],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Feature A')).toBeInTheDocument()
      })
      expect(screen.getByText('Feature B')).toBeInTheDocument()
      // Task A is proposed — should have Approve button
      expect(screen.getByText('Approve')).toBeInTheDocument()
      // Task B is accepted — should have View progress
      expect(screen.getByText('View progress')).toBeInTheDocument()
    })

    it('approving one task does not affect another task', async () => {
      vi.mocked(api.approveTask).mockResolvedValue({} as any)
      const convWithMultipleTasks = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Two features', tool_name: null, tool_input: null, tool_output: null, task_id: null },
          { id: 'msg-2', role: 'tool', content: '', tool_name: 'create_task', tool_input: '{"title":"Task One"}', tool_output: 'Created', task_id: 'task-1' },
          { id: 'msg-3', role: 'tool', content: '', tool_name: 'create_task', tool_input: '{"title":"Task Two"}', tool_output: 'Created', task_id: 'task-2' },
          { id: 'msg-4', role: 'assistant', content: 'Done.', tool_name: null, tool_input: null, tool_output: null, task_id: null },
        ],
      }
      const task1 = { id: 'task-1', title: 'Task One', description: 'First', priority: 1, status: 'proposed' as const }
      const task2 = { id: 'task-2', title: 'Task Two', description: 'Second', priority: 2, status: 'proposed' as const }

      setupLoadedPage({
        conversation: convWithMultipleTasks as any,
        tasks: [task1, task2],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Task One')).toBeInTheDocument()
      })
      expect(screen.getByText('Task Two')).toBeInTheDocument()

      // Both should have Approve buttons initially
      const approveButtons = screen.getAllByText('Approve')
      expect(approveButtons).toHaveLength(2)

      // Approve the first task
      await userEvent.click(approveButtons[0])

      await waitFor(() => {
        expect(api.approveTask).toHaveBeenCalledWith('task-1')
      })

      // Task One should now show "Task Queued", Task Two should still show "Approve"
      await waitFor(() => {
        expect(screen.getAllByText('Task Proposed')).toHaveLength(1) // only task-2
      })
      // Task Two should still have its Approve button
      expect(screen.getByText('Approve')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Tool call streaming — tool_result matches correct tool message
  // ---------------------------------------------------------------------------
  describe('tool result matching', () => {
    it('tool_result updates the correct tool message for different tool types', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'tool_call', tool: 'read_file', input: { path: 'a.ts' } } as any)
        onEvent({ type: 'tool_result', tool: 'read_file', output: 'content of a.ts' } as any)
        onEvent({ type: 'tool_call', tool: 'search_code', input: { query: 'TODO' } } as any)
        onEvent({ type: 'tool_result', tool: 'search_code', output: 'Found 5 TODOs' } as any)
        onEvent({ type: 'text', content: 'Read and searched.' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Read and search')
      await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

      await waitFor(() => {
        expect(screen.getByText('Read and searched.')).toBeInTheDocument()
      })

      // Both tool calls should be rendered with their inputs
      expect(screen.getByText('(path=a.ts)')).toBeInTheDocument()
      expect(screen.getByText('(query=TODO)')).toBeInTheDocument()

      // Both tools got their results (shown by "click to expand" hints)
      const expandHints = screen.getAllByText('click to expand')
      expect(expandHints.length).toBeGreaterThanOrEqual(2)

      // Expand read_file tool and verify its specific output
      const readFileHeader = screen.getByText('(path=a.ts)').closest('div[class*="cursor-pointer"]') || screen.getByText('(path=a.ts)').parentElement
      if (readFileHeader) {
        await userEvent.click(readFileHeader)
      }

      await waitFor(() => {
        expect(screen.getByText('content of a.ts')).toBeInTheDocument()
      })
    })

    it('two sequential calls of the same tool both get their results', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'tool_call', tool: 'read_file', input: { path: 'first.ts' } } as any)
        onEvent({ type: 'tool_result', tool: 'read_file', output: 'first file content' } as any)
        onEvent({ type: 'tool_call', tool: 'read_file', input: { path: 'second.ts' } } as any)
        onEvent({ type: 'tool_result', tool: 'read_file', output: 'second file content' } as any)
        onEvent({ type: 'text', content: 'Read two files.' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Read two files')
      await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

      await waitFor(() => {
        expect(screen.getByText('Read two files.')).toBeInTheDocument()
      })

      // Both tool calls should be rendered with their file paths
      expect(screen.getByText('(path=first.ts)')).toBeInTheDocument()
      expect(screen.getByText('(path=second.ts)')).toBeInTheDocument()

      // Both should show "click to expand" meaning they both have output
      const expandHints = screen.getAllByText('click to expand')
      expect(expandHints.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Complex streaming flow — mixed events in sequence
  // ---------------------------------------------------------------------------
  describe('complex streaming flow', () => {
    it('handles text + tool_call + tool_result + task_created in one stream', async () => {
      setupLoadedPage()
      vi.mocked(api.approveTask).mockResolvedValue({} as any)

      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'text', content: 'Let me analyze this. ' } as any)
        onEvent({ type: 'tool_call', tool: 'search_code', input: { query: 'dark mode' } } as any)
        onEvent({ type: 'tool_result', tool: 'search_code', output: 'Found 3 matches' } as any)
        onEvent({ type: 'text', content: 'I found relevant code. ' } as any)
        onEvent({ type: 'tool_call', tool: 'create_task', input: { title: 'Implement dark mode' } } as any)
        onEvent({ type: 'tool_result', tool: 'create_task', output: 'Task created' } as any)
        onEvent({
          type: 'event',
          event: 'task_created',
          task: {
            id: 'task-dm',
            title: 'Implement dark mode',
            description: 'Add dark mode toggle with system preference detection.',
            priority: 2,
            status: 'proposed',
          },
        } as any)
        onEvent({ type: 'text', content: 'I created a task for you.' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Add dark mode')
      await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

      // Verify all parts of the stream rendered
      await waitFor(() => {
        expect(screen.getByText('Let me analyze this. I found relevant code. I created a task for you.')).toBeInTheDocument()
      })
      expect(screen.getByText('Search Code')).toBeInTheDocument()
      expect(screen.getByText('(query=dark mode)')).toBeInTheDocument()
      expect(screen.getByText('Create Task')).toBeInTheDocument()
      expect(screen.getByText('Implement dark mode')).toBeInTheDocument()
      expect(screen.getByText('Task Proposed')).toBeInTheDocument()
      expect(screen.getByText('Approve')).toBeInTheDocument()

      // Approve the task created during streaming
      await userEvent.click(screen.getByText('Approve'))

      await waitFor(() => {
        expect(api.approveTask).toHaveBeenCalledWith('task-dm')
      })
      await waitFor(() => {
        expect(screen.getByText('Task Queued')).toBeInTheDocument()
      })
    })

    it('error event mid-stream appends error content to assistant message', async () => {
      setupLoadedPage()
      vi.mocked(api.sendMessageStream).mockImplementation(async (convId, content, onEvent) => {
        onEvent({ type: 'text', content: 'Starting analysis... ' } as any)
        onEvent({ type: 'error', content: 'Token limit reached.' } as any)
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Continue the conversation...')).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText('Continue the conversation...')
      await userEvent.type(textarea, 'Analyze everything')
      await userEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement)

      await waitFor(() => {
        expect(screen.getByText('Starting analysis... Token limit reached.')).toBeInTheDocument()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Task description expand/collapse toggle
  // ---------------------------------------------------------------------------
  describe('task description toggle', () => {
    it('clicking expanded description collapses it back', async () => {
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [mockTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
      })

      // Should show "show more" initially (description is >100 chars)
      expect(screen.getByText('show more')).toBeInTheDocument()

      // Expand
      const descriptionEl = screen.getByText(/Implement a dark mode toggle/).closest('.cursor-pointer')
      if (descriptionEl) {
        await userEvent.click(descriptionEl)
      }

      await waitFor(() => {
        expect(screen.queryByText('show more')).not.toBeInTheDocument()
      })

      // Collapse back
      const descriptionElAgain = screen.getByText(/Implement a dark mode toggle/).closest('.cursor-pointer')
      if (descriptionElAgain) {
        await userEvent.click(descriptionElAgain)
      }

      await waitFor(() => {
        expect(screen.getByText('show more')).toBeInTheDocument()
      })
    })

    it('short task description does not show "show more"', async () => {
      const shortDescTask = { ...mockTask, description: 'Short desc.' }
      setupLoadedPage({
        conversation: mockConversationWithTasks,
        tasks: [shortDescTask],
      })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('Add dark mode support')).toBeInTheDocument()
      })

      expect(screen.queryByText('show more')).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Tool message without output (no expand affordance)
  // ---------------------------------------------------------------------------
  describe('tool message without output', () => {
    it('tool message without output does not show expand hint or cursor', async () => {
      const convWithPendingTool = {
        id: 'conv-123',
        project_id: 'proj-1',
        user_id: 'user-1',
        messages: [
          { id: 'msg-1', role: 'tool', content: '', tool_name: 'list_files', tool_input: '{"path":"."}', tool_output: null, task_id: null },
        ],
      }
      setupLoadedPage({ conversation: convWithPendingTool as any })

      render(<ConversationPage />)

      await waitFor(() => {
        expect(screen.getByText('List Files')).toBeInTheDocument()
      })

      // Should NOT show "click to expand" since there's no output
      expect(screen.queryByText('click to expand')).not.toBeInTheDocument()
    })
  })
})
