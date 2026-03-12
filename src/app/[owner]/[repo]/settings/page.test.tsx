import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockBack = vi.fn()
const mockNotFound = vi.fn()

const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  back: mockBack,
}

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ owner: 'bloom-base', repo: 'genesis' }),
  usePathname: () => '/bloom-base/genesis/settings',
  useSearchParams: () => new URLSearchParams(),
  notFound: (...args: unknown[]) => mockNotFound(...args),
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
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjectMembers: vi.fn(),
  inviteProjectMember: vi.fn(),
  removeProjectMember: vi.fn(),
}))

import ProjectSettingsPage from './page'
import * as api from '@/lib/api'
import { toast } from 'sonner'

const mockUser = {
  id: 'user-1',
  github_username: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  subscription_tier: 'pro',
  is_admin: false,
  has_anthropic_key: false,
} as any

const mockProject = {
  id: 'proj-1',
  name: 'genesis',
  description: 'The genesis project',
  github_repo: 'bloom-base/genesis',
  owner_id: 'user-1',
  is_public: true,
  vision: 'Build the future',
  max_parallel_tasks: 2,
  auto_improve: false,
  created_at: '2026-01-01T00:00:00Z',
} as any

const mockMembers: any[] = [
  {
    id: 'member-1',
    user_id: 'user-2',
    project_id: 'proj-1',
    github_username: 'collaborator1',
    role: 'member',
  },
  {
    id: 'member-2',
    user_id: 'user-3',
    project_id: 'proj-1',
    github_username: 'admin1',
    role: 'admin',
  },
]

/** Helper: set up mocks for a successful page load (owner viewing their project) */
function setupSuccessfulLoad(overrides?: {
  project?: Partial<typeof mockProject>
  members?: typeof mockMembers
}) {
  const proj = { ...mockProject, ...overrides?.project }
  vi.mocked(api.getProjectByPath).mockResolvedValue(proj)
  vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser)
  vi.mocked(api.getProjectMembers).mockResolvedValue(overrides?.members ?? [])
  return proj
}

describe('ProjectSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ────────────────────────────────────────────────
  // RENDERING / LOADING TESTS
  // ────────────────────────────────────────────────

  describe('loading state', () => {
    it('shows skeleton loading while fetching project', () => {
      // Never resolve so we stay in loading state
      vi.mocked(api.getProjectByPath).mockReturnValue(new Promise(() => {}))
      vi.mocked(api.getCurrentUser).mockReturnValue(new Promise(() => {}))

      render(<ProjectSettingsPage />)
      expect(screen.getByText((_, el) => el?.classList.contains('animate-pulse') ?? false)).toBeInTheDocument()
    })
  })

  describe('renders settings form for project owner', () => {
    it('shows all form fields populated with project data', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Project Settings')).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      expect(nameInput.value).toBe('genesis')

      const descInput = screen.getByLabelText('Description') as HTMLInputElement
      expect(descInput.value).toBe('The genesis project')

      const visionInput = screen.getByLabelText('Vision') as HTMLTextAreaElement
      expect(visionInput.value).toBe('Build the future')
    })

    it('shows visibility section with Public label when project is public', async () => {
      setupSuccessfulLoad({ project: { is_public: true } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Visibility')).toBeInTheDocument()
      })
      expect(screen.getByText('Public')).toBeInTheDocument()
      expect(screen.getByText('Anyone can view this project and contribute ideas.')).toBeInTheDocument()
    })

    it('shows Private label when project is private', async () => {
      setupSuccessfulLoad({ project: { is_public: false } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Private')).toBeInTheDocument()
      })
      expect(screen.getByText('Only you can view this project.')).toBeInTheDocument()
    })

    it('shows parallel tasks populated from project', async () => {
      setupSuccessfulLoad({ project: { max_parallel_tasks: 5 } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Parallel Tasks')).toBeInTheDocument()
      })
      const input = screen.getByPlaceholderText('3') as HTMLInputElement
      expect(input.value).toBe('5')
      expect(screen.getByText('5 concurrent tasks')).toBeInTheDocument()
    })

    it('shows platform default text when max_parallel_tasks is null', async () => {
      setupSuccessfulLoad({ project: { max_parallel_tasks: null } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Using platform default (3)')).toBeInTheDocument()
      })
    })

    it('shows self-improvement toggle off by default', async () => {
      setupSuccessfulLoad({ project: { auto_improve: false } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Self-Improvement')).toBeInTheDocument()
      })
      expect(screen.getByText('Enable to let the AI automatically find and fix improvement opportunities.')).toBeInTheDocument()
      expect(screen.queryByText('Active')).not.toBeInTheDocument()
    })

    it('shows self-improvement active badge when enabled', async () => {
      setupSuccessfulLoad({ project: { auto_improve: true } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument()
      })
      expect(screen.getByText('Scans every 30 minutes')).toBeInTheDocument()
    })

    it('shows team members section', async () => {
      setupSuccessfulLoad({ members: mockMembers })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Team Members')).toBeInTheDocument()
      })
      expect(screen.getByText('@collaborator1')).toBeInTheDocument()
      expect(screen.getByText('@admin1')).toBeInTheDocument()
    })

    it('shows empty members message when no members', async () => {
      setupSuccessfulLoad({ members: [] })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('No team members yet. Invite collaborators by GitHub username.')).toBeInTheDocument()
      })
    })

    it('shows github repo link', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Repository')).toBeInTheDocument()
      })
      const repoLink = screen.getByText('bloom-base/genesis')
      expect(repoLink.closest('a')).toHaveAttribute('href', 'https://github.com/bloom-base/genesis')
    })

    it('shows danger zone with delete project button', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Danger Zone')).toBeInTheDocument()
      })
      expect(screen.getByText('Delete project')).toBeInTheDocument()
    })

    it('shows cancel link pointing to project page', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })
      const cancelLink = screen.getByText('Cancel').closest('a')
      expect(cancelLink).toHaveAttribute('href', '/bloom-base/genesis')
    })

    it('shows Save Changes button', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })
    })
  })

  // ────────────────────────────────────────────────
  // ACCESS CONTROL
  // ────────────────────────────────────────────────

  describe('access control', () => {
    it('redirects non-owner to project page', async () => {
      vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject)
      vi.mocked(api.getCurrentUser).mockResolvedValue({
        ...mockUser,
        id: 'different-user',
      } as any)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/bloom-base/genesis')
      })
    })

    it('redirects when getCurrentUser fails (not logged in)', async () => {
      vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject)
      vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Unauthorized'))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/bloom-base/genesis')
      })
    })
  })

  // ────────────────────────────────────────────────
  // ERROR STATES
  // ────────────────────────────────────────────────

  describe('error states', () => {
    it('shows error when project fails to load', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Network error'))
      vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
      expect(screen.getByText('Browse projects')).toBeInTheDocument()
    })

    it('shows browse projects link in error state', async () => {
      vi.mocked(api.getProjectByPath).mockRejectedValue(new Error('Server error'))
      vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Browse projects')).toBeInTheDocument()
      })
      const link = screen.getByText('Browse projects').closest('a')
      expect(link).toHaveAttribute('href', '/explore')
    })
  })

  // ────────────────────────────────────────────────
  // SAVE SETTINGS FORM SUBMISSION
  // ────────────────────────────────────────────────

  describe('save settings form', () => {
    it('submits form with updated values on Save Changes click', async () => {
      const updatedProject = { ...mockProject, name: 'updated-genesis', description: 'Updated desc' }
      setupSuccessfulLoad()
      vi.mocked(api.updateProject).mockResolvedValue(updatedProject)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument()
      })

      // Change name
      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'updated-genesis' } })
      expect(nameInput.value).toBe('updated-genesis')

      // Change description
      const descInput = screen.getByLabelText('Description') as HTMLInputElement
      fireEvent.change(descInput, { target: { value: 'Updated desc' } })
      expect(descInput.value).toBe('Updated desc')

      // Change vision
      const visionInput = screen.getByLabelText('Vision') as HTMLTextAreaElement
      fireEvent.change(visionInput, { target: { value: 'New vision statement' } })
      expect(visionInput.value).toBe('New vision statement')

      // Click Save Changes
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(api.updateProject).toHaveBeenCalledWith('proj-1', {
          name: 'updated-genesis',
          description: 'Updated desc',
          vision: 'New vision statement',
          is_public: true,
          max_parallel_tasks: 2,
          auto_improve: false,
        })
      })

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Settings saved')
      })
    })

    it('shows Saving... text while save is in progress', async () => {
      setupSuccessfulLoad()
      // Never resolve to keep the saving state
      vi.mocked(api.updateProject).mockReturnValue(new Promise(() => {}))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      })
    })

    it('shows error toast on save failure', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.updateProject).mockRejectedValue(new Error('Permission denied'))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Permission denied')
      })
    })

    it('shows generic error toast when save error is not an Error instance', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.updateProject).mockRejectedValue('some string error')

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save')
      })
    })

    it('re-enables save button after save completes', async () => {
      const updatedProject = { ...mockProject, name: 'new-name' }
      setupSuccessfulLoad()
      vi.mocked(api.updateProject).mockResolvedValue(updatedProject)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      const saveBtn = screen.getByText('Save Changes')
      fireEvent.click(saveBtn)

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
        expect(screen.getByText('Save Changes')).not.toBeDisabled()
      })
    })

    it('re-enables save button after save error', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.updateProject).mockRejectedValue(new Error('fail'))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
        expect(screen.getByText('Save Changes')).not.toBeDisabled()
      })
    })

    it('sends null for max_parallel_tasks when input is empty', async () => {
      setupSuccessfulLoad({ project: { max_parallel_tasks: null } })
      vi.mocked(api.updateProject).mockResolvedValue(mockProject)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Save Changes')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(api.updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
          max_parallel_tasks: null,
        }))
      })
    })
  })

  // ────────────────────────────────────────────────
  // VISIBILITY TOGGLE
  // ────────────────────────────────────────────────

  describe('visibility toggle', () => {
    it('toggles from public to private on click', async () => {
      setupSuccessfulLoad({ project: { is_public: true } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Public')).toBeInTheDocument()
      })

      // The visibility toggle is the button inside the Visibility section
      const visibilitySection = screen.getByText('Visibility').closest('div.border')!
      const toggleBtn = visibilitySection.querySelector('button')!
      fireEvent.click(toggleBtn)

      await waitFor(() => {
        expect(screen.getByText('Private')).toBeInTheDocument()
      })
      expect(screen.getByText('Only you can view this project.')).toBeInTheDocument()
    })

    it('toggles from private to public on click', async () => {
      setupSuccessfulLoad({ project: { is_public: false } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Private')).toBeInTheDocument()
      })

      const visibilitySection = screen.getByText('Visibility').closest('div.border')!
      const toggleBtn = visibilitySection.querySelector('button')!
      fireEvent.click(toggleBtn)

      await waitFor(() => {
        expect(screen.getByText('Public')).toBeInTheDocument()
      })
    })

    it('saves the toggled visibility value when form is submitted', async () => {
      setupSuccessfulLoad({ project: { is_public: true } })
      vi.mocked(api.updateProject).mockResolvedValue({ ...mockProject, is_public: false })

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Public')).toBeInTheDocument()
      })

      // Toggle to private
      const visibilitySection = screen.getByText('Visibility').closest('div.border')!
      const toggleBtn = visibilitySection.querySelector('button')!
      fireEvent.click(toggleBtn)

      await waitFor(() => {
        expect(screen.getByText('Private')).toBeInTheDocument()
      })

      // Save
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(api.updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
          is_public: false,
        }))
      })
    })
  })

  // ────────────────────────────────────────────────
  // AUTO-IMPROVE TOGGLE
  // ────────────────────────────────────────────────

  describe('auto-improve toggle', () => {
    it('toggles auto-improve from off to on', async () => {
      setupSuccessfulLoad({ project: { auto_improve: false } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Self-Improvement')).toBeInTheDocument()
      })

      // Find the toggle in the self-improvement section
      const section = screen.getByText('Self-Improvement').closest('div.border')!
      const toggleBtn = section.querySelector('button')!
      fireEvent.click(toggleBtn)

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument()
        expect(screen.getByText('Scans every 30 minutes')).toBeInTheDocument()
      })
    })

    it('toggles auto-improve from on to off', async () => {
      setupSuccessfulLoad({ project: { auto_improve: true } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument()
      })

      const section = screen.getByText('Self-Improvement').closest('div.border')!
      const toggleBtn = section.querySelector('button')!
      fireEvent.click(toggleBtn)

      await waitFor(() => {
        expect(screen.queryByText('Active')).not.toBeInTheDocument()
      })
    })

    it('saves auto-improve value on form submit', async () => {
      setupSuccessfulLoad({ project: { auto_improve: false } })
      vi.mocked(api.updateProject).mockResolvedValue({ ...mockProject, auto_improve: true })

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Self-Improvement')).toBeInTheDocument()
      })

      // Toggle on
      const section = screen.getByText('Self-Improvement').closest('div.border')!
      const toggleBtn = section.querySelector('button')!
      fireEvent.click(toggleBtn)

      // Save
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(api.updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
          auto_improve: true,
        }))
      })
    })
  })

  // ────────────────────────────────────────────────
  // MAX PARALLEL TASKS INPUT
  // ────────────────────────────────────────────────

  describe('max parallel tasks input', () => {
    it('allows changing the parallel tasks value', async () => {
      setupSuccessfulLoad({ project: { max_parallel_tasks: 2 } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('3')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('3') as HTMLInputElement
      fireEvent.change(input, { target: { value: '7' } })
      expect(input.value).toBe('7')
      expect(screen.getByText('7 concurrent tasks')).toBeInTheDocument()
    })

    it('shows platform default text when cleared', async () => {
      setupSuccessfulLoad({ project: { max_parallel_tasks: 2 } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('3')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('3') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      expect(screen.getByText('Using platform default (3)')).toBeInTheDocument()
    })

    it('submits parsed integer for parallel tasks', async () => {
      setupSuccessfulLoad({ project: { max_parallel_tasks: 2 } })
      vi.mocked(api.updateProject).mockResolvedValue(mockProject)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('3')).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('3') as HTMLInputElement
      fireEvent.change(input, { target: { value: '5' } })

      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(api.updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
          max_parallel_tasks: 5,
        }))
      })
    })
  })

  // ────────────────────────────────────────────────
  // VISION CHARACTER COUNTER
  // ────────────────────────────────────────────────

  describe('vision character counter', () => {
    it('shows character count for vision field', async () => {
      setupSuccessfulLoad({ project: { vision: 'Build the future' } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('16/1000')).toBeInTheDocument()
      })
    })

    it('truncates vision to 1000 characters', async () => {
      setupSuccessfulLoad({ project: { vision: '' } })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Vision')).toBeInTheDocument()
      })

      const longText = 'a'.repeat(1100)
      const visionInput = screen.getByLabelText('Vision') as HTMLTextAreaElement
      fireEvent.change(visionInput, { target: { value: longText } })

      // The onChange handler slices to 1000
      expect(visionInput.value).toBe('a'.repeat(1000))
    })
  })

  // ────────────────────────────────────────────────
  // INVITE TEAM MEMBER
  // ────────────────────────────────────────────────

  describe('invite team member', () => {
    it('invite button is disabled when username input is empty', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Invite')).toBeInTheDocument()
      })

      const inviteBtn = screen.getByText('Invite')
      expect(inviteBtn).toBeDisabled()
    })

    it('invite button is enabled when username is entered', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: 'newuser' } })

      expect(screen.getByText('Invite')).not.toBeDisabled()
    })

    it('invites a member with default role (member) and clears input', async () => {
      const newMember = {
        id: 'member-new',
        user_id: 'user-new',
        project_id: 'proj-1',
        github_username: 'newuser',
        role: 'member',
      }
      setupSuccessfulLoad()
      vi.mocked(api.inviteProjectMember).mockResolvedValue(newMember as any)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('GitHub username') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'newuser' } })
      fireEvent.click(screen.getByText('Invite'))

      await waitFor(() => {
        expect(api.inviteProjectMember).toHaveBeenCalledWith('proj-1', 'newuser', 'member')
      })

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Member invited')
      })

      await waitFor(() => {
        expect(input.value).toBe('')
      })

      // The new member should appear in the list
      expect(screen.getByText('@newuser')).toBeInTheDocument()
    })

    it('invites a member with admin role when selected', async () => {
      const newMember = {
        id: 'member-admin',
        user_id: 'user-admin',
        project_id: 'proj-1',
        github_username: 'adminuser',
        role: 'admin',
      }
      setupSuccessfulLoad()
      vi.mocked(api.inviteProjectMember).mockResolvedValue(newMember as any)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      // Change role to admin
      const roleSelect = screen.getByDisplayValue('Member') as HTMLSelectElement
      fireEvent.change(roleSelect, { target: { value: 'admin' } })

      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: 'adminuser' } })
      fireEvent.click(screen.getByText('Invite'))

      await waitFor(() => {
        expect(api.inviteProjectMember).toHaveBeenCalledWith('proj-1', 'adminuser', 'admin')
      })
    })

    it('shows Inviting... text while invite is in progress', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.inviteProjectMember).mockReturnValue(new Promise(() => {}))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: 'newuser' } })
      fireEvent.click(screen.getByText('Invite'))

      await waitFor(() => {
        expect(screen.getByText('Inviting...')).toBeInTheDocument()
      })
    })

    it('shows error toast on invite failure', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.inviteProjectMember).mockRejectedValue(new Error('User not found'))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: 'nonexistentuser' } })
      fireEvent.click(screen.getByText('Invite'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('User not found')
      })
    })

    it('shows generic error toast on invite failure with non-Error', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.inviteProjectMember).mockRejectedValue('something went wrong')

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: 'someuser' } })
      fireEvent.click(screen.getByText('Invite'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to invite')
      })
    })

    it('re-enables invite button after invite completes', async () => {
      const newMember = {
        id: 'member-new',
        user_id: 'user-new',
        project_id: 'proj-1',
        github_username: 'newuser',
        role: 'member',
      }
      setupSuccessfulLoad()
      vi.mocked(api.inviteProjectMember).mockResolvedValue(newMember as any)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: 'newuser' } })
      fireEvent.click(screen.getByText('Invite'))

      // After success, input is cleared so invite button becomes disabled (empty username)
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Member invited')
      })
    })

    it('re-enables invite button after invite failure', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.inviteProjectMember).mockRejectedValue(new Error('fail'))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: 'baduser' } })
      fireEvent.click(screen.getByText('Invite'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled()
      })

      // Button text should return to "Invite" (not "Inviting...")
      await waitFor(() => {
        expect(screen.getByText('Invite')).toBeInTheDocument()
      })
    })

    it('trims whitespace from username before inviting', async () => {
      const newMember = {
        id: 'member-new',
        user_id: 'user-new',
        project_id: 'proj-1',
        github_username: 'trimmeduser',
        role: 'member',
      }
      setupSuccessfulLoad()
      vi.mocked(api.inviteProjectMember).mockResolvedValue(newMember as any)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('GitHub username')).toBeInTheDocument()
      })

      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: '  trimmeduser  ' } })
      fireEvent.click(screen.getByText('Invite'))

      await waitFor(() => {
        expect(api.inviteProjectMember).toHaveBeenCalledWith('proj-1', 'trimmeduser', 'member')
      })
    })
  })

  // ────────────────────────────────────────────────
  // REMOVE TEAM MEMBER
  // ────────────────────────────────────────────────

  describe('remove team member', () => {
    it('removes a member on Remove button click', async () => {
      setupSuccessfulLoad({ members: mockMembers })
      vi.mocked(api.removeProjectMember).mockResolvedValue(undefined as any)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('@collaborator1')).toBeInTheDocument()
      })

      // Click the first Remove button (for collaborator1)
      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])

      await waitFor(() => {
        expect(api.removeProjectMember).toHaveBeenCalledWith('proj-1', 'user-2')
      })

      await waitFor(() => {
        expect(screen.queryByText('@collaborator1')).not.toBeInTheDocument()
      })

      // The other member should still be there
      expect(screen.getByText('@admin1')).toBeInTheDocument()

      expect(toast).toHaveBeenCalledWith('Member removed')
    })

    it('shows error toast on remove failure', async () => {
      setupSuccessfulLoad({ members: mockMembers })
      vi.mocked(api.removeProjectMember).mockRejectedValue(new Error('Cannot remove owner'))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('@collaborator1')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Cannot remove owner')
      })

      // Member should still be in the list (not removed on error)
      expect(screen.getByText('@collaborator1')).toBeInTheDocument()
    })

    it('shows generic error toast on remove failure with non-Error', async () => {
      setupSuccessfulLoad({ members: mockMembers })
      vi.mocked(api.removeProjectMember).mockRejectedValue('unexpected')

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('@collaborator1')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to remove member')
      })
    })

    it('displays correct role badges for members', async () => {
      setupSuccessfulLoad({ members: mockMembers })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('@collaborator1')).toBeInTheDocument()
      })

      // Check role badges
      expect(screen.getByText('member')).toBeInTheDocument()
      expect(screen.getByText('admin')).toBeInTheDocument()
    })
  })

  // ────────────────────────────────────────────────
  // DELETE PROJECT
  // ────────────────────────────────────────────────

  describe('delete project', () => {
    it('shows delete confirmation dialog when Delete project is clicked', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByText(/This will permanently delete/)).toBeInTheDocument()
      })
      expect(screen.getByPlaceholderText('genesis')).toBeInTheDocument()
      expect(screen.getByText('Permanently delete project')).toBeInTheDocument()
    })

    it('delete confirmation button is disabled when name does not match', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByText('Permanently delete project')).toBeInTheDocument()
      })

      // Type wrong name
      const confirmInput = screen.getByPlaceholderText('genesis')
      fireEvent.change(confirmInput, { target: { value: 'wrong-name' } })

      expect(screen.getByText('Permanently delete project')).toBeDisabled()
    })

    it('delete confirmation button is enabled when name matches exactly', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByText('Permanently delete project')).toBeInTheDocument()
      })

      const confirmInput = screen.getByPlaceholderText('genesis')
      fireEvent.change(confirmInput, { target: { value: 'genesis' } })

      expect(screen.getByText('Permanently delete project')).not.toBeDisabled()
    })

    it('deletes project and redirects to /profile on success', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.deleteProject).mockResolvedValue(undefined as any)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('genesis')).toBeInTheDocument()
      })

      const confirmInput = screen.getByPlaceholderText('genesis')
      fireEvent.change(confirmInput, { target: { value: 'genesis' } })
      fireEvent.click(screen.getByText('Permanently delete project'))

      await waitFor(() => {
        expect(api.deleteProject).toHaveBeenCalledWith('proj-1')
      })

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Project deleted')
      })

      expect(mockPush).toHaveBeenCalledWith('/profile')
    })

    it('shows Deleting... text during delete', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.deleteProject).mockReturnValue(new Promise(() => {}))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('genesis')).toBeInTheDocument()
      })

      const confirmInput = screen.getByPlaceholderText('genesis')
      fireEvent.change(confirmInput, { target: { value: 'genesis' } })
      fireEvent.click(screen.getByText('Permanently delete project'))

      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument()
      })
    })

    it('shows error toast on delete failure and re-enables button', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.deleteProject).mockRejectedValue(new Error('Insufficient permissions'))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('genesis')).toBeInTheDocument()
      })

      const confirmInput = screen.getByPlaceholderText('genesis')
      fireEvent.change(confirmInput, { target: { value: 'genesis' } })
      fireEvent.click(screen.getByText('Permanently delete project'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Insufficient permissions')
      })

      // Button should be re-enabled (not stuck in Deleting... state)
      await waitFor(() => {
        expect(screen.getByText('Permanently delete project')).toBeInTheDocument()
        expect(screen.getByText('Permanently delete project')).not.toBeDisabled()
      })
    })

    it('shows generic error toast on delete failure with non-Error', async () => {
      setupSuccessfulLoad()
      vi.mocked(api.deleteProject).mockRejectedValue('unexpected error')

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('genesis')).toBeInTheDocument()
      })

      const confirmInput = screen.getByPlaceholderText('genesis')
      fireEvent.change(confirmInput, { target: { value: 'genesis' } })
      fireEvent.click(screen.getByText('Permanently delete project'))

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to delete project')
      })
    })

    it('cancel button hides delete confirmation and clears input', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      // Open confirmation
      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByText('Permanently delete project')).toBeInTheDocument()
      })

      // Type something in the confirm input
      const confirmInput = screen.getByPlaceholderText('genesis')
      fireEvent.change(confirmInput, { target: { value: 'gen' } })

      // Click cancel (the one in the delete confirmation, not the form cancel link)
      // The form cancel is a link, the delete cancel is a button
      const cancelButtons = screen.getAllByText('Cancel')
      // Find the button (not the link)
      const deleteCancelBtn = cancelButtons.find(el => el.tagName === 'BUTTON')!
      fireEvent.click(deleteCancelBtn)

      // Should go back to showing "Delete project" button
      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })
      expect(screen.queryByText('Permanently delete project')).not.toBeInTheDocument()
    })

    it('does not call deleteProject when confirmation name does not match', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('genesis')).toBeInTheDocument()
      })

      const confirmInput = screen.getByPlaceholderText('genesis')
      fireEvent.change(confirmInput, { target: { value: 'wrong' } })

      // The button should be disabled, but let's also verify no API call
      const deleteBtn = screen.getByText('Permanently delete project')
      fireEvent.click(deleteBtn)

      // Wait a tick and verify no API call
      await waitFor(() => {
        expect(api.deleteProject).not.toHaveBeenCalled()
      })
    })

    it('displays project name in confirmation message', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Delete project')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Delete project'))

      await waitFor(() => {
        expect(screen.getByText(/This will permanently delete/)).toBeInTheDocument()
      })

      // The project name should appear in the confirmation message and as the type-to-confirm hint
      const genesisSpans = screen.getAllByText('genesis')
      // There should be at least 2: one in the "permanently delete <name>" sentence, one as the type hint
      expect(genesisSpans.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ────────────────────────────────────────────────
  // FORM FIELD INTERACTIONS
  // ────────────────────────────────────────────────

  describe('form field interactions', () => {
    it('allows editing the name field', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      fireEvent.change(nameInput, { target: { value: 'new-name' } })
      expect(nameInput.value).toBe('new-name')
    })

    it('allows editing the description field', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Description')).toBeInTheDocument()
      })

      const descInput = screen.getByLabelText('Description') as HTMLInputElement
      fireEvent.change(descInput, { target: { value: 'New description' } })
      expect(descInput.value).toBe('New description')
    })

    it('allows editing the vision field', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Vision')).toBeInTheDocument()
      })

      const visionInput = screen.getByLabelText('Vision') as HTMLTextAreaElement
      fireEvent.change(visionInput, { target: { value: 'Updated vision' } })
      expect(visionInput.value).toBe('Updated vision')
    })

    it('name field is required', async () => {
      setupSuccessfulLoad()
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Name') as HTMLInputElement
      expect(nameInput.required).toBe(true)
    })
  })

  // ────────────────────────────────────────────────
  // MEMBER LIST DISPLAY
  // ────────────────────────────────────────────────

  describe('member list display', () => {
    it('shows multiple members with correct roles', async () => {
      setupSuccessfulLoad({ members: mockMembers })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('@collaborator1')).toBeInTheDocument()
      })

      expect(screen.getByText('@admin1')).toBeInTheDocument()
      expect(screen.getByText('member')).toBeInTheDocument()
      expect(screen.getByText('admin')).toBeInTheDocument()
    })

    it('shows a Remove button for each member', async () => {
      setupSuccessfulLoad({ members: mockMembers })
      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('@collaborator1')).toBeInTheDocument()
      })

      const removeButtons = screen.getAllByText('Remove')
      expect(removeButtons).toHaveLength(2)
    })
  })

  // ────────────────────────────────────────────────
  // EDGE CASES & INTEGRATION
  // ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles getProjectMembers failure gracefully (shows empty list)', async () => {
      vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject)
      vi.mocked(api.getCurrentUser).mockResolvedValue(mockUser)
      vi.mocked(api.getProjectMembers).mockRejectedValue(new Error('Members API down'))

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('No team members yet. Invite collaborators by GitHub username.')).toBeInTheDocument()
      })
    })

    it('full workflow: edit fields, toggle visibility, save', async () => {
      const updatedProject = {
        ...mockProject,
        name: 'workflow-test',
        description: 'Workflow desc',
        vision: 'Workflow vision',
        is_public: false,
        max_parallel_tasks: 4,
        auto_improve: true,
      }
      setupSuccessfulLoad()
      vi.mocked(api.updateProject).mockResolvedValue(updatedProject)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText('Name')).toBeInTheDocument()
      })

      // Edit all fields
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'workflow-test' } })
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Workflow desc' } })
      fireEvent.change(screen.getByLabelText('Vision'), { target: { value: 'Workflow vision' } })

      // Toggle visibility off
      const visibilitySection = screen.getByText('Visibility').closest('div.border')!
      const visToggle = visibilitySection.querySelector('button')!
      fireEvent.click(visToggle)

      // Change parallel tasks
      fireEvent.change(screen.getByPlaceholderText('3'), { target: { value: '4' } })

      // Toggle auto-improve on
      const aiSection = screen.getByText('Self-Improvement').closest('div.border')!
      const aiToggle = aiSection.querySelector('button')!
      fireEvent.click(aiToggle)

      // Save
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(api.updateProject).toHaveBeenCalledWith('proj-1', {
          name: 'workflow-test',
          description: 'Workflow desc',
          vision: 'Workflow vision',
          is_public: false,
          max_parallel_tasks: 4,
          auto_improve: true,
        })
      })

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Settings saved')
      })
    })

    it('invite then remove workflow', async () => {
      const newMember = {
        id: 'member-new',
        user_id: 'user-new',
        project_id: 'proj-1',
        github_username: 'freshuser',
        role: 'member',
      }
      setupSuccessfulLoad({ members: [] })
      vi.mocked(api.inviteProjectMember).mockResolvedValue(newMember as any)
      vi.mocked(api.removeProjectMember).mockResolvedValue(undefined as any)

      render(<ProjectSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('No team members yet. Invite collaborators by GitHub username.')).toBeInTheDocument()
      })

      // Invite
      const input = screen.getByLabelText('GitHub username')
      fireEvent.change(input, { target: { value: 'freshuser' } })
      fireEvent.click(screen.getByText('Invite'))

      await waitFor(() => {
        expect(screen.getByText('@freshuser')).toBeInTheDocument()
      })

      // Now remove
      fireEvent.click(screen.getByText('Remove'))

      await waitFor(() => {
        expect(screen.queryByText('@freshuser')).not.toBeInTheDocument()
      })
    })
  })
})
