import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ owner: 'bloom-base', repo: 'genesis' }),
  usePathname: () => '/bloom-base/genesis/search',
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/SearchPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="search-panel">SearchPanel</div>,
}))

vi.mock('@/lib/api', () => ({
  getProjectByPath: vi.fn(),
  getCurrentUser: vi.fn(),
}))

import SearchPage from './page'
import * as api from '@/lib/api'

const mockProject = {
  id: 'proj-1',
  name: 'genesis',
  description: 'The genesis project',
  github_repo: 'bloom-base/genesis',
  owner_id: 'user-1',
  is_public: true,
  vision: 'Build the future',
  created_at: '2026-01-01T00:00:00Z',
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows sign in message for logged-out users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<SearchPage />)

    await waitFor(() => {
      expect(screen.getByText('Sign in to search')).toBeInTheDocument()
    })
  })

  it('shows search panel for logged-in users', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<SearchPage />)

    await waitFor(() => {
      expect(screen.getByTestId('search-panel')).toBeInTheDocument()
    })
    expect(screen.getByText('Search')).toBeInTheDocument()
  })

  it('shows project not found for invalid project', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue(null as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(null as any)

    render(<SearchPage />)

    await waitFor(() => {
      expect(screen.getByText('Project not found')).toBeInTheDocument()
    })
  })

  it('shows search description', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'testuser',
      email: 'test@example.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    } as any)
    vi.mocked(api.getProjectByPath).mockResolvedValue(mockProject as any)

    render(<SearchPage />)

    await waitFor(() => {
      expect(screen.getByText('Search across code, knowledge, and conversation history')).toBeInTheDocument()
    })
  })
})
