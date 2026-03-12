import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ owner: 'bloom-base', repo: 'genesis' }),
  usePathname: () => '/bloom-base/genesis/knowledge',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  getProjectByPath: vi.fn(),
  getCurrentUser: vi.fn(),
  getProjectKnowledge: vi.fn(),
  createKnowledgeEntry: vi.fn(),
  updateKnowledgeEntry: vi.fn(),
  deleteKnowledgeEntry: vi.fn(),
}))

import KnowledgePage from './page'
import * as api from '@/lib/api'
import { toast } from 'sonner'

const mockPush = vi.fn()
const mockRouter = { push: mockPush, replace: vi.fn(), back: vi.fn() }

const mockOwnerUser = {
  id: 'user-1',
  username: 'testuser',
  github_username: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  subscription_tier: 'pro',
  is_admin: false,
  has_anthropic_key: false,
  has_github: true,
  has_password: false,
  email_verified: true,
  email_notifications: true,
  handle: null,
  display_name: null,
  bio: null,
} as api.UserProfile

const mockVisitorUser = {
  ...mockOwnerUser,
  id: 'user-2',
  username: 'visitor',
  github_username: 'visitor',
  email: 'visitor@example.com',
  subscription_tier: 'free',
} as api.UserProfile

const mockProject = {
  id: 'proj-1',
  name: 'genesis',
  description: 'The genesis project',
  github_repo: 'bloom-base/genesis',
  owner_id: 'user-1',
  is_public: true,
  vision: 'Build the future',
  created_at: '2026-01-01T00:00:00Z',
} as api.Project

const mockEntries: api.KnowledgeEntry[] = [
  {
    id: 'ke-1',
    project_id: 'proj-1',
    title: 'Use PostgreSQL arrays for tags',
    content: 'We chose PostgreSQL arrays over a separate tags table for simplicity.',
    category: 'decision',
    tags: ['database', 'postgresql'],
    source_type: 'agent',
    created_by_agent: 'coder',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'ke-2',
    project_id: 'proj-1',
    title: 'API endpoints use snake_case',
    content: 'All API response fields use snake_case for consistency.',
    category: 'convention',
    tags: ['api'],
    source_type: 'user',
    created_by_agent: null,
    created_at: '2026-02-15T00:00:00Z',
    updated_at: '2026-02-15T00:00:00Z',
  },
]

function setupDefaultMocks(user = mockOwnerUser) {
  vi.mocked(api.getCurrentUser).mockResolvedValue(user)
  vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject)
  vi.mocked(api.getProjectKnowledge).mockResolvedValue({ items: mockEntries } as any)
}

async function waitForPageLoad() {
  await waitFor(() => {
    expect(screen.getByText('Project Knowledge')).toBeInTheDocument()
  })
}

describe('KnowledgePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // Rendering tests
  it('renders knowledge page header', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()
  })

  it('shows knowledge entries', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitFor(() => {
      expect(screen.getByText('Use PostgreSQL arrays for tags')).toBeInTheDocument()
    })
    expect(screen.getByText('API endpoints use snake_case')).toBeInTheDocument()
  })

  it('shows category filter tabs', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Decision')).toBeInTheDocument()
    expect(screen.getByText('Convention')).toBeInTheDocument()
    expect(screen.getByText('Architecture')).toBeInTheDocument()
  })

  it('shows Add Entry button for project owner', async () => {
    setupDefaultMocks()
    vi.mocked(api.getProjectKnowledge).mockResolvedValue({ items: [] } as any)
    render(<KnowledgePage />)
    await waitFor(() => {
      expect(screen.getByText('Add Entry')).toBeInTheDocument()
    })
  })

  it('hides Add Entry button for non-owners', async () => {
    setupDefaultMocks(mockVisitorUser)
    render(<KnowledgePage />)
    await waitForPageLoad()
    expect(screen.queryByText('Add Entry')).not.toBeInTheDocument()
  })

  it('shows empty state when no entries', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject)
    vi.mocked(api.getProjectKnowledge).mockResolvedValue({ items: [] } as any)
    render(<KnowledgePage />)
    await waitFor(() => {
      expect(screen.getByText('No knowledge entries yet')).toBeInTheDocument()
    })
  })

  it('shows project not found', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(null as any)
    render(<KnowledgePage />)
    await waitFor(() => {
      expect(screen.getByText('Project not found')).toBeInTheDocument()
    })
  })

  it('shows stats footer with entry counts', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitFor(() => {
      expect(screen.getByText('1 agent-created')).toBeInTheDocument()
    })
    expect(screen.getByText('1 manual')).toBeInTheDocument()
  })

  it('shows search input', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject)
    vi.mocked(api.getProjectKnowledge).mockResolvedValue({ items: [] } as any)
    render(<KnowledgePage />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search knowledge...')).toBeInTheDocument()
    })
  })

  // === Interactive tests ===

  it('clicking Add Entry opens the create form', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))
    expect(screen.getByText('New Knowledge Entry')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Use PostgreSQL arrays/)).toBeInTheDocument()
    expect(screen.getByText('Create Entry')).toBeInTheDocument()
  })

  it('clicking Add Entry again (Cancel) closes the form', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))
    expect(screen.getByText('New Knowledge Entry')).toBeInTheDocument()

    // Button text changes to Cancel
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('New Knowledge Entry')).not.toBeInTheDocument()
  })

  it('Create Entry button is disabled when title or content is empty', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))
    expect(screen.getByText('Create Entry')).toBeDisabled()
  })

  it('Create Entry button is enabled when title and content filled', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))

    const titleInput = screen.getByPlaceholderText(/Use PostgreSQL arrays/)
    const contentInput = screen.getByPlaceholderText(/Describe the decision/)
    await user.type(titleInput, 'New entry')
    await user.type(contentInput, 'Some content')

    expect(screen.getByText('Create Entry')).toBeEnabled()
  })

  it('successful create calls API and adds entry to list', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()

    const newEntry: api.KnowledgeEntry = {
      id: 'ke-new',
      project_id: 'proj-1',
      title: 'New pattern',
      content: 'Always validate inputs',
      category: 'decision',
      tags: ['validation'],
      source_type: 'user',
      created_by_agent: null,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    }
    vi.mocked(api.createKnowledgeEntry).mockResolvedValue(newEntry)

    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))

    await user.type(screen.getByPlaceholderText(/Use PostgreSQL arrays/), 'New pattern')
    await user.type(screen.getByPlaceholderText(/Describe the decision/), 'Always validate inputs')
    await user.type(screen.getByPlaceholderText(/database, performance/), 'validation')

    await user.click(screen.getByText('Create Entry'))

    await waitFor(() => {
      expect(api.createKnowledgeEntry).toHaveBeenCalledWith('proj-1', {
        title: 'New pattern',
        content: 'Always validate inputs',
        category: 'decision',
        tags: ['validation'],
      })
    })

    await waitFor(() => {
      expect(screen.getByText('New pattern')).toBeInTheDocument()
    })
    expect(toast.success).toHaveBeenCalledWith('Knowledge entry created')
  })

  it('create failure shows error toast', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()
    vi.mocked(api.createKnowledgeEntry).mockRejectedValue(new Error('Server error'))

    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))
    await user.type(screen.getByPlaceholderText(/Use PostgreSQL arrays/), 'Title')
    await user.type(screen.getByPlaceholderText(/Describe the decision/), 'Content')
    await user.click(screen.getByText('Create Entry'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error')
    })
  })

  it('category filter tab click triggers API call with filter', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Decision'))

    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: 'decision',
        search: undefined,
      })
    })
  })

  it('clicking active category tab toggles it off (back to All)', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    // Click Decision to activate
    fireEvent.click(screen.getByText('Decision'))
    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: 'decision',
        search: undefined,
      })
    })

    // Click Decision again to deactivate
    fireEvent.click(screen.getByText('Decision'))
    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: undefined,
        search: undefined,
      })
    })
  })

  it('search input Enter key triggers search', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    const searchInput = screen.getByPlaceholderText('Search knowledge...')
    fireEvent.change(searchInput, { target: { value: 'postgresql' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: undefined,
        search: 'postgresql',
      })
    })
  })

  it('clear button resets search', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    const searchInput = screen.getByPlaceholderText('Search knowledge...')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Clear')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Clear'))

    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: undefined,
        search: undefined,
      })
    })
  })

  it('clicking entry expands it to show details', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText(/We chose PostgreSQL arrays/)).toBeInTheDocument()
    })
  })

  it('owner sees Edit and Remove buttons on expanded entry', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    // Click the entry title to expand — title is inside a button
    const entryTitle = screen.getByText('Use PostgreSQL arrays for tags')
    fireEvent.click(entryTitle.closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })
  })

  it('non-owner does NOT see Edit and Remove buttons', async () => {
    setupDefaultMocks(mockVisitorUser)
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText(/We chose PostgreSQL arrays/)).toBeInTheDocument()
    })
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })

  it('delete button calls deleteKnowledgeEntry and removes entry', async () => {
    setupDefaultMocks()
    vi.mocked(api.deleteKnowledgeEntry).mockResolvedValue(undefined as any)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<KnowledgePage />)
    await waitForPageLoad()

    // Expand entry
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Remove'))

    await waitFor(() => {
      expect(api.deleteKnowledgeEntry).toHaveBeenCalledWith('proj-1', 'ke-1')
    })
    expect(toast.success).toHaveBeenCalledWith('Knowledge entry removed')
  })

  it('delete confirmation cancelled does not delete', async () => {
    setupDefaultMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Remove'))

    expect(api.deleteKnowledgeEntry).not.toHaveBeenCalled()
  })

  it('edit button opens inline edit form with pre-filled values', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Use PostgreSQL arrays for tags')).toBeInTheDocument()
      expect(screen.getByDisplayValue('We chose PostgreSQL arrays over a separate tags table for simplicity.')).toBeInTheDocument()
    })
  })

  it('save edit calls updateKnowledgeEntry and updates entry', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()

    const updatedEntry = {
      ...mockEntries[0],
      title: 'Updated title',
    }
    vi.mocked(api.updateKnowledgeEntry).mockResolvedValue(updatedEntry as api.KnowledgeEntry)

    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Edit'))

    const titleInput = screen.getByDisplayValue('Use PostgreSQL arrays for tags')
    await user.clear(titleInput)
    await user.type(titleInput, 'Updated title')

    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(api.updateKnowledgeEntry).toHaveBeenCalledWith('proj-1', 'ke-1', expect.objectContaining({
        title: 'Updated title',
      }))
    })
    expect(toast.success).toHaveBeenCalledWith('Knowledge entry updated')
  })

  it('category select in create form allows changing category', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))

    const select = screen.getByDisplayValue(/Decision/)
    fireEvent.change(select, { target: { value: 'convention' } })

    expect((select as HTMLSelectElement).value).toBe('convention')
  })

  // === Additional interaction tests ===

  it('clicking expanded entry again collapses it', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    const entryButton = screen.getByText('Use PostgreSQL arrays for tags').closest('button')!

    // Expand
    fireEvent.click(entryButton)
    await waitFor(() => {
      expect(screen.getByText(/We chose PostgreSQL arrays/)).toBeInTheDocument()
    })

    // Collapse
    fireEvent.click(entryButton)
    await waitFor(() => {
      // The full content paragraph should no longer be visible
      // (the truncated preview may still appear, but Edit/Remove buttons should be gone)
      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
      expect(screen.queryByText('Remove')).not.toBeInTheDocument()
    })
  })

  it('cancel button in edit mode closes edit form without saving', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    // Expand entry
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    // Open edit mode
    fireEvent.click(screen.getByText('Edit'))
    await waitFor(() => {
      expect(screen.getByDisplayValue('Use PostgreSQL arrays for tags')).toBeInTheDocument()
    })

    // Click Cancel in edit form
    fireEvent.click(screen.getByText('Cancel'))

    // Edit form should close, view mode should return
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Use PostgreSQL arrays for tags')).not.toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    // API should not have been called
    expect(api.updateKnowledgeEntry).not.toHaveBeenCalled()
  })

  it('edit failure shows error toast', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()
    vi.mocked(api.updateKnowledgeEntry).mockRejectedValue(new Error('Update failed'))

    render(<KnowledgePage />)
    await waitForPageLoad()

    // Expand and enter edit mode
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Edit'))

    const titleInput = screen.getByDisplayValue('Use PostgreSQL arrays for tags')
    await user.clear(titleInput)
    await user.type(titleInput, 'Changed title')

    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(api.updateKnowledgeEntry).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Update failed')
    })
  })

  it('delete failure shows error toast', async () => {
    setupDefaultMocks()
    vi.mocked(api.deleteKnowledgeEntry).mockRejectedValue(new Error('Delete failed'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<KnowledgePage />)
    await waitForPageLoad()

    // Expand entry
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Remove'))

    await waitFor(() => {
      expect(api.deleteKnowledgeEntry).toHaveBeenCalledWith('proj-1', 'ke-1')
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Delete failed')
    })
  })

  it('create form submits selected category in API call', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()

    const newEntry: api.KnowledgeEntry = {
      id: 'ke-cat',
      project_id: 'proj-1',
      title: 'Convention entry',
      content: 'Some convention',
      category: 'convention',
      tags: [],
      source_type: 'user',
      created_by_agent: null,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    }
    vi.mocked(api.createKnowledgeEntry).mockResolvedValue(newEntry)

    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))

    // Change category to convention before filling in fields
    const select = screen.getByDisplayValue(/Decision/)
    fireEvent.change(select, { target: { value: 'convention' } })

    await user.type(screen.getByPlaceholderText(/Use PostgreSQL arrays/), 'Convention entry')
    await user.type(screen.getByPlaceholderText(/Describe the decision/), 'Some convention')

    await user.click(screen.getByText('Create Entry'))

    await waitFor(() => {
      expect(api.createKnowledgeEntry).toHaveBeenCalledWith('proj-1', {
        title: 'Convention entry',
        content: 'Some convention',
        category: 'convention',
        tags: [],
      })
    })
  })

  it('clicking Convention category tab filters by convention', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Convention'))

    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: 'convention',
        search: undefined,
      })
    })
  })

  it('clicking Architecture category tab filters by architecture', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Architecture'))

    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: 'architecture',
        search: undefined,
      })
    })
  })

  it('search filters entries and shows no matching entries when empty', async () => {
    setupDefaultMocks()
    // After search, API returns empty results
    vi.mocked(api.getProjectKnowledge)
      .mockResolvedValueOnce({ items: mockEntries } as any) // initial load
      .mockResolvedValueOnce({ items: [] } as any) // after search

    render(<KnowledgePage />)
    await waitForPageLoad()

    const searchInput = screen.getByPlaceholderText('Search knowledge...')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('No matching entries')).toBeInTheDocument()
    })
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument()
  })

  it('search combined with category filter passes both to API', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    // Set category first
    fireEvent.click(screen.getByText('Decision'))
    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: 'decision',
        search: undefined,
      })
    })

    // Then search
    const searchInput = screen.getByPlaceholderText('Search knowledge...')
    fireEvent.change(searchInput, { target: { value: 'arrays' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })

    await waitFor(() => {
      expect(api.getProjectKnowledge).toHaveBeenCalledWith('proj-1', {
        category: 'decision',
        search: 'arrays',
      })
    })
  })

  it('edit mode allows modifying tags', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()

    const updatedEntry = {
      ...mockEntries[0],
      tags: ['database', 'postgresql', 'newtag'],
    }
    vi.mocked(api.updateKnowledgeEntry).mockResolvedValue(updatedEntry as api.KnowledgeEntry)

    render(<KnowledgePage />)
    await waitForPageLoad()

    // Expand and edit
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Edit'))

    // Find the tags input (pre-filled with "database, postgresql")
    const tagsInput = screen.getByDisplayValue('database, postgresql')
    await user.clear(tagsInput)
    await user.type(tagsInput, 'database, postgresql, newtag')

    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(api.updateKnowledgeEntry).toHaveBeenCalledWith('proj-1', 'ke-1', expect.objectContaining({
        tags: ['database', 'postgresql', 'newtag'],
      }))
    })
    expect(toast.success).toHaveBeenCalledWith('Knowledge entry updated')
  })

  it('edit mode allows changing category', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()

    const updatedEntry = {
      ...mockEntries[0],
      category: 'convention',
    }
    vi.mocked(api.updateKnowledgeEntry).mockResolvedValue(updatedEntry as api.KnowledgeEntry)

    render(<KnowledgePage />)
    await waitForPageLoad()

    // Expand and edit
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Edit'))

    // Change category select in edit form
    // The edit form has a select pre-filled with the entry's category
    const editSelects = screen.getAllByDisplayValue('Decision')
    // The edit select is the one inside the expanded entry
    const editSelect = editSelects[editSelects.length - 1]
    fireEvent.change(editSelect, { target: { value: 'convention' } })

    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(api.updateKnowledgeEntry).toHaveBeenCalledWith('proj-1', 'ke-1', expect.objectContaining({
        category: 'convention',
      }))
    })
  })

  it('expanding one entry collapses the previously expanded entry', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    // Expand first entry
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    // Expand second entry
    fireEvent.click(screen.getByText('API endpoints use snake_case').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText(/All API response fields use snake_case/)).toBeInTheDocument()
    })

    // First entry should no longer show its Edit/Remove buttons (collapsed)
    // Only one Edit button should be visible (for the second entry)
    const editButtons = screen.getAllByText('Edit')
    expect(editButtons).toHaveLength(1)
  })

  it('delete removes entry from the displayed list', async () => {
    setupDefaultMocks()
    vi.mocked(api.deleteKnowledgeEntry).mockResolvedValue(undefined as any)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<KnowledgePage />)
    await waitForPageLoad()

    // Both entries visible
    expect(screen.getByText('Use PostgreSQL arrays for tags')).toBeInTheDocument()
    expect(screen.getByText('API endpoints use snake_case')).toBeInTheDocument()

    // Expand and delete the first entry
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Remove'))

    await waitFor(() => {
      expect(screen.queryByText('Use PostgreSQL arrays for tags')).not.toBeInTheDocument()
    })
    // Second entry should still be there
    expect(screen.getByText('API endpoints use snake_case')).toBeInTheDocument()
  })

  it('create form resets fields after successful submission', async () => {
    const user = userEvent.setup()
    setupDefaultMocks()

    const newEntry: api.KnowledgeEntry = {
      id: 'ke-reset',
      project_id: 'proj-1',
      title: 'Reset test',
      content: 'Testing form reset',
      category: 'decision',
      tags: [],
      source_type: 'user',
      created_by_agent: null,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    }
    vi.mocked(api.createKnowledgeEntry).mockResolvedValue(newEntry)

    render(<KnowledgePage />)
    await waitForPageLoad()

    fireEvent.click(screen.getByText('Add Entry'))

    await user.type(screen.getByPlaceholderText(/Use PostgreSQL arrays/), 'Reset test')
    await user.type(screen.getByPlaceholderText(/Describe the decision/), 'Testing form reset')
    await user.click(screen.getByText('Create Entry'))

    // Form should close after successful creation
    await waitFor(() => {
      expect(screen.queryByText('New Knowledge Entry')).not.toBeInTheDocument()
    })

    // Re-open form and verify fields are cleared
    fireEvent.click(screen.getByText('Add Entry'))
    expect(screen.getByPlaceholderText(/Use PostgreSQL arrays/)).toHaveValue('')
    expect(screen.getByPlaceholderText(/Describe the decision/)).toHaveValue('')
    expect(screen.getByPlaceholderText(/database, performance/)).toHaveValue('')
  })

  it('shows entry tags when expanded', async () => {
    setupDefaultMocks()
    render(<KnowledgePage />)
    await waitForPageLoad()

    // Expand the first entry which has tags ['database', 'postgresql']
    fireEvent.click(screen.getByText('Use PostgreSQL arrays for tags').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('database')).toBeInTheDocument()
      expect(screen.getByText('postgresql')).toBeInTheDocument()
    })
  })
})
