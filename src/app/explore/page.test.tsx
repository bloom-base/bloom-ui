import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock the API module
vi.mock('@/lib/api', () => ({
  getPublicProjects: vi.fn(),
  getCurrentUser: vi.fn(),
}))

import ExplorePage from './page'
import * as api from '@/lib/api'

const mockProjects = [
  {
    id: 'proj-1',
    name: 'aurora',
    description: 'A modern markdown editor',
    github_repo: 'bloom-base/aurora',
    vision: 'The best editor',
    is_public: true,
    deployed_url: null,
    deploy_status: null,
    in_progress: 2,
    queued: 1,
    completed: 5,
    created_at: '2026-01-01T00:00:00Z',
    last_activity_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'proj-2',
    name: 'pixel',
    description: 'Image optimization API',
    github_repo: 'bloom-base/pixel',
    vision: 'Fast images',
    is_public: true,
    deployed_url: 'https://pixel.fly.dev',
    deploy_status: 'deployed',
    in_progress: 0,
    queued: 0,
    completed: 3,
    created_at: '2026-01-02T00:00:00Z',
    last_activity_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'proj-3',
    name: 'nebula',
    description: 'A space simulation engine',
    github_repo: 'bloom-base/nebula',
    vision: 'Simulate the cosmos',
    is_public: true,
    deployed_url: null,
    deploy_status: null,
    in_progress: 1,
    queued: 2,
    completed: 8,
    created_at: '2026-01-03T00:00:00Z',
    last_activity_at: '2026-01-20T00:00:00Z',
  },
]

describe('ExplorePage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Not logged in'))
  })

  it('renders projects after loading', async () => {
    vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

    render(<ExplorePage />)

    await waitFor(() => {
      expect(screen.getByText('aurora')).toBeDefined()
      expect(screen.getByText('pixel')).toBeDefined()
    })
  })

  it('shows error message when API fails', async () => {
    vi.mocked(api.getPublicProjects).mockRejectedValue(
      new Error('API error: 500')
    )

    render(<ExplorePage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load projects')).toBeDefined()
      expect(screen.getByText('API error: 500')).toBeDefined()
    })
  })

  it('shows empty state when no projects exist', async () => {
    vi.mocked(api.getPublicProjects).mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 })

    render(<ExplorePage />)

    await waitFor(() => {
      expect(screen.getByText('No public projects yet.')).toBeDefined()
    })
  })

  it('separates active and idle projects', async () => {
    vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

    render(<ExplorePage />)

    await waitFor(() => {
      // aurora (in_progress=2) and nebula (in_progress=1) are active, pixel (in_progress=0) is idle
      expect(screen.getByText('Active (2)')).toBeDefined()
      expect(screen.getByText('Idle (1)')).toBeDefined()
    })
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getPublicProjects).mockReturnValue(new Promise(() => {}))

    const { container } = render(<ExplorePage />)

    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('shows New Project button for Pro users', async () => {
    vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'prouser',
      email: 'pro@test.com',
      avatar_url: null,
      subscription_tier: 'pro',
      is_admin: false,
      has_anthropic_key: false,
    })

    render(<ExplorePage />)

    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeDefined()
    })
  })

  it('hides New Project button for free users', async () => {
    vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      id: 'user-1',
      github_username: 'freeuser',
      email: 'free@test.com',
      avatar_url: null,
      subscription_tier: 'free',
      is_admin: false,
      has_anthropic_key: false,
    })

    render(<ExplorePage />)

    await waitFor(() => {
      expect(screen.getByText('aurora')).toBeDefined()
    })
    expect(screen.queryByText('New Project')).toBeNull()
  })

  it('links projects to their github_repo path', async () => {
    vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

    render(<ExplorePage />)

    await waitFor(() => {
      expect(screen.getByText('aurora')).toBeDefined()
    })

    const auroraLink = screen.getByText('aurora').closest('a')
    expect(auroraLink?.getAttribute('href')).toBe('/bloom-base/aurora')
  })

  describe('Search', () => {
    it('filters projects by name when typing in search', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
        expect(screen.getByText('pixel')).toBeDefined()
        expect(screen.getByText('nebula')).toBeDefined()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      fireEvent.change(searchInput, { target: { value: 'aurora' } })

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
        expect(screen.queryByText('pixel')).toBeNull()
        expect(screen.queryByText('nebula')).toBeNull()
      })
    })

    it('filters projects by description', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      fireEvent.change(searchInput, { target: { value: 'image' } })

      await waitFor(() => {
        // pixel's description is "Image optimization API"
        expect(screen.getByText('pixel')).toBeDefined()
        expect(screen.queryByText('aurora')).toBeNull()
        expect(screen.queryByText('nebula')).toBeNull()
      })
    })

    it('shows no match message and clear search button', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...')
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

      await waitFor(() => {
        expect(screen.getByText(/No projects match/)).toBeDefined()
      })
      expect(screen.getByText('Clear search')).toBeDefined()
    })

    it('clears search when Clear search button is clicked', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      const searchInput = screen.getByPlaceholderText('Search projects...') as HTMLInputElement
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

      await waitFor(() => {
        expect(screen.getByText('Clear search')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Clear search'))

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
        expect(screen.getByText('pixel')).toBeDefined()
        expect(screen.getByText('nebula')).toBeDefined()
      })

      // Input should be cleared
      expect(searchInput.value).toBe('')
    })

    it('updates filter counts based on search results', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        // All 3 projects, 2 active (aurora, nebula), 1 idle (pixel)
        expect(screen.getByText('All (3)')).toBeDefined()
        expect(screen.getByText('Active (2)')).toBeDefined()
        expect(screen.getByText('Idle (1)')).toBeDefined()
      })

      // Search for 'aurora' — only 1 active project remains
      const searchInput = screen.getByPlaceholderText('Search projects...')
      fireEvent.change(searchInput, { target: { value: 'aurora' } })

      await waitFor(() => {
        expect(screen.getByText('All (1)')).toBeDefined()
        expect(screen.getByText('Active (1)')).toBeDefined()
        expect(screen.getByText('Idle (0)')).toBeDefined()
      })
    })
  })

  describe('Filter buttons', () => {
    it('filters to active projects when Active button is clicked', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
        expect(screen.getByText('pixel')).toBeDefined()
        expect(screen.getByText('nebula')).toBeDefined()
      })

      // Click Active filter
      fireEvent.click(screen.getByText('Active (2)'))

      await waitFor(() => {
        // aurora (in_progress=2) and nebula (in_progress=1) are active
        expect(screen.getByText('aurora')).toBeDefined()
        expect(screen.getByText('nebula')).toBeDefined()
        // pixel (in_progress=0) should be hidden
        expect(screen.queryByText('pixel')).toBeNull()
      })
    })

    it('filters to idle projects when Idle button is clicked', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
        expect(screen.getByText('pixel')).toBeDefined()
      })

      // Click Idle filter
      fireEvent.click(screen.getByText('Idle (1)'))

      await waitFor(() => {
        // pixel (in_progress=0) is idle
        expect(screen.getByText('pixel')).toBeDefined()
        // aurora and nebula are active, should be hidden
        expect(screen.queryByText('aurora')).toBeNull()
        expect(screen.queryByText('nebula')).toBeNull()
      })
    })

    it('returns to all projects when All button is clicked after filtering', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      // Filter to active only
      fireEvent.click(screen.getByText('Active (2)'))

      await waitFor(() => {
        expect(screen.queryByText('pixel')).toBeNull()
      })

      // Go back to all
      fireEvent.click(screen.getByText('All (3)'))

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
        expect(screen.getByText('pixel')).toBeDefined()
        expect(screen.getByText('nebula')).toBeDefined()
      })
    })

    it('shows "show all projects" button when filter yields no results', async () => {
      // All projects are active (none idle)
      const allActive = mockProjects.map(p => ({ ...p, in_progress: 1 }))
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: allActive, total: allActive.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      // Click Idle filter — should produce empty result
      fireEvent.click(screen.getByText('Idle (0)'))

      await waitFor(() => {
        expect(screen.getByText(/No idle projects/)).toBeDefined()
        expect(screen.getByText('Show all projects')).toBeDefined()
      })
    })

    it('resets filter when "Show all projects" is clicked', async () => {
      const allActive = mockProjects.map(p => ({ ...p, in_progress: 1 }))
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: allActive, total: allActive.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Idle (0)'))

      await waitFor(() => {
        expect(screen.getByText('Show all projects')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Show all projects'))

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
        expect(screen.getByText('pixel')).toBeDefined()
        expect(screen.getByText('nebula')).toBeDefined()
      })
    })
  })

  describe('Sort dropdown', () => {
    it('sorts by most shipped when "Most shipped" is selected', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      const sortSelect = screen.getByLabelText('Sort projects')
      fireEvent.change(sortSelect, { target: { value: 'shipped' } })

      // After sort by shipped: nebula (8) > aurora (5) > pixel (3)
      await waitFor(() => {
        const projectCards = screen.getAllByText(/aurora|pixel|nebula/)
        // nebula should appear before aurora, aurora before pixel
        const names = projectCards.map(el => el.textContent)
        const nebulaIdx = names.indexOf('nebula')
        const auroraIdx = names.indexOf('aurora')
        const pixelIdx = names.indexOf('pixel')
        expect(nebulaIdx).toBeLessThan(auroraIdx)
        expect(auroraIdx).toBeLessThan(pixelIdx)
      })
    })

    it('sorts by newest first when "Newest first" is selected', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      const sortSelect = screen.getByLabelText('Sort projects')
      fireEvent.change(sortSelect, { target: { value: 'newest' } })

      // After sort by newest: nebula (Jan 3) > pixel (Jan 2) > aurora (Jan 1)
      await waitFor(() => {
        const projectCards = screen.getAllByText(/aurora|pixel|nebula/)
        const names = projectCards.map(el => el.textContent)
        const nebulaIdx = names.indexOf('nebula')
        const pixelIdx = names.indexOf('pixel')
        const auroraIdx = names.indexOf('aurora')
        expect(nebulaIdx).toBeLessThan(pixelIdx)
        expect(pixelIdx).toBeLessThan(auroraIdx)
      })
    })

    it('defaults to recently active sort', async () => {
      vi.mocked(api.getPublicProjects).mockResolvedValue({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      const sortSelect = screen.getByLabelText('Sort projects') as HTMLSelectElement
      expect(sortSelect.value).toBe('recent')
    })
  })

  describe('Error retry', () => {
    it('retries loading when Try again button is clicked', async () => {
      vi.mocked(api.getPublicProjects)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ items: mockProjects, total: mockProjects.length, limit: 50, offset: 0 })

      render(<ExplorePage />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load projects')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Try again'))

      await waitFor(() => {
        expect(screen.getByText('aurora')).toBeDefined()
      })

      expect(api.getPublicProjects).toHaveBeenCalledTimes(2)
    })
  })
})
