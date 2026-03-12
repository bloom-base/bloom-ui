import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Stable router object to prevent useEffect infinite loops
const mockPush = vi.fn()
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock the API module
vi.mock('@/lib/api', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

import NotificationsPage from './page'
import * as api from '@/lib/api'

const mockNotifications: api.NotificationItem[] = [
  {
    id: 'n1',
    type: 'task_started',
    title: 'Building: Add dark mode',
    body: 'The agent is working on your idea',
    link: '/bloom-base/genesis',
    is_read: false,
    project_id: 'p1',
    task_id: 't1',
    created_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
  },
  {
    id: 'n2',
    type: 'task_completed',
    title: 'Shipped: Fix navbar overflow',
    body: 'Your idea has been built and merged',
    link: '/bloom-base/arcade',
    is_read: true,
    project_id: 'p2',
    task_id: 't2',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
  },
  {
    id: 'n3',
    type: 'pr_created',
    title: 'PR created: Update README',
    body: 'Pull request #42 is ready for review',
    link: 'https://github.com/bloom-base/genesis/pull/42',
    is_read: false,
    project_id: 'p1',
    task_id: 't3',
    created_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  },
  {
    id: 'n4',
    type: 'task_incomplete',
    title: 'Incomplete: Refactor auth module',
    body: 'Agent reached turn limit',
    link: null,
    is_read: true,
    project_id: 'p1',
    task_id: 't4',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
]

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.markNotificationRead).mockResolvedValue({ ok: true })
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue({ ok: true })
  })

  it('renders notifications after loading', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unread: 2,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      expect(screen.getByText('Shipped: Fix navbar overflow')).toBeDefined()
      expect(screen.getByText('PR created: Update README')).toBeDefined()
      expect(screen.getByText('Incomplete: Refactor auth module')).toBeDefined()
    })
  })

  it('shows unread count in subtitle', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unread: 2,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('2 unread notifications')).toBeDefined()
    })
  })

  it('shows "All caught up" when no unread', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications.map((n) => ({ ...n, is_read: true })),
      total: 4,
      unread: 0,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('All caught up')).toBeDefined()
    })
  })

  it('shows empty state when no notifications', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [],
      total: 0,
      unread: 0,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('No notifications yet')).toBeDefined()
    })
  })

  it('shows error state and retry button', async () => {
    vi.mocked(api.getNotifications).mockRejectedValue(new Error('Network error'))

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load notifications')).toBeDefined()
      expect(screen.getByText('Network error')).toBeDefined()
      expect(screen.getByText('Try again')).toBeDefined()
    })
  })

  it('shows loading skeleton initially', () => {
    vi.mocked(api.getNotifications).mockReturnValue(new Promise(() => {}))

    const { container } = render(<NotificationsPage />)

    const pulseElements = container.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('shows mark all read button when unread exist', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unread: 2,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Mark all as read')).toBeDefined()
    })
  })

  it('hides mark all read button when all read', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications.map((n) => ({ ...n, is_read: true })),
      total: 4,
      unread: 0,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('All caught up')).toBeDefined()
    })
    expect(screen.queryByText('Mark all as read')).toBeNull()
  })

  it('calls markAllNotificationsRead when button clicked', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unread: 2,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Mark all as read')).toBeDefined()
    })

    fireEvent.click(screen.getByText('Mark all as read'))

    await waitFor(() => {
      expect(api.markAllNotificationsRead).toHaveBeenCalledOnce()
    })
  })

  it('shows type badges on notifications', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unread: 2,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      // "Started" appears as both filter button and badge, so use getAllByText
      expect(screen.getAllByText('Started').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('Shipped').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('PR Created')).toBeDefined()
      expect(screen.getAllByText('Incomplete').length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows filter buttons', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unread: 2,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      // "All" appears in both type and read filter groups
      expect(screen.getAllByText('All').length).toBe(2)
      expect(screen.getByText('PRs')).toBeDefined()
      expect(screen.getByText('Unread')).toBeDefined()
      expect(screen.getByText('Read')).toBeDefined()
    })
  })

  it('shows load more button when more notifications exist', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 50,
      unread: 10,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Load more (4 of 50)')).toBeDefined()
    })
  })

  it('hides load more when all loaded', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: mockNotifications,
      total: 4,
      unread: 2,
    })

    render(<NotificationsPage />)

    await waitFor(() => {
      expect(screen.getByText('Building: Add dark mode')).toBeDefined()
    })
    expect(screen.queryByText(/Load more/)).toBeNull()
  })

  describe('Clear filters', () => {
    it('shows clear filters button when filtered notifications are empty', async () => {
      // Only task_started notifications — filtering to "PRs" should yield empty
      const onlyStarted: api.NotificationItem[] = [
        {
          id: 'n1',
          type: 'task_started',
          title: 'Building: Add dark mode',
          body: 'The agent is working on your idea',
          link: '/bloom-base/genesis',
          is_read: false,
          project_id: 'p1',
          task_id: 't1',
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ]

      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: onlyStarted,
        total: 1,
        unread: 1,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Click PRs filter — should show empty state
      fireEvent.click(screen.getByText('PRs'))

      await waitFor(() => {
        expect(screen.getByText('Clear filters')).toBeDefined()
      })
    })

    it('resets both type and read filters when Clear filters is clicked', async () => {
      const onlyStarted: api.NotificationItem[] = [
        {
          id: 'n1',
          type: 'task_started',
          title: 'Building: Add dark mode',
          body: 'The agent is working on your idea',
          link: '/bloom-base/genesis',
          is_read: false,
          project_id: 'p1',
          task_id: 't1',
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ]

      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: onlyStarted,
        total: 1,
        unread: 1,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Apply PRs type filter — yields empty
      fireEvent.click(screen.getByText('PRs'))

      await waitFor(() => {
        expect(screen.getByText('Clear filters')).toBeDefined()
      })

      // Click Clear filters
      fireEvent.click(screen.getByText('Clear filters'))

      // Should return to showing all notifications
      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })
    })

    it('shows clear filters when read filter yields empty', async () => {
      // All notifications are unread — filtering to "Read" should yield empty
      const allUnread = mockNotifications.map(n => ({ ...n, is_read: false }))

      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: allUnread,
        total: 4,
        unread: 4,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Click Read filter
      fireEvent.click(screen.getByText('Read'))

      await waitFor(() => {
        expect(screen.getByText('Clear filters')).toBeDefined()
      })

      // Click Clear filters
      fireEvent.click(screen.getByText('Clear filters'))

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })
    })
  })

  describe('Load more pagination', () => {
    it('loads more notifications when Load more is clicked', async () => {
      const moreNotifications: api.NotificationItem[] = [
        {
          id: 'n5',
          type: 'task_completed',
          title: 'Shipped: Add search feature',
          body: 'Search is live',
          link: '/bloom-base/genesis',
          is_read: true,
          project_id: 'p1',
          task_id: 't5',
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
      ]

      vi.mocked(api.getNotifications)
        .mockResolvedValueOnce({
          notifications: mockNotifications,
          total: 50,
          unread: 10,
        })
        .mockResolvedValueOnce({
          notifications: moreNotifications,
          total: 50,
          unread: 10,
        })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Load more (4 of 50)')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Load more (4 of 50)'))

      await waitFor(() => {
        expect(api.getNotifications).toHaveBeenCalledTimes(2)
        // Second call should use offset=4 (length of first batch)
        expect(api.getNotifications).toHaveBeenLastCalledWith(
          expect.objectContaining({ offset: 4, limit: 30 })
        )
      })

      // New notification should be appended
      await waitFor(() => {
        expect(screen.getByText('Shipped: Add search feature')).toBeDefined()
      })

      // Original notifications should still be visible
      expect(screen.getByText('Building: Add dark mode')).toBeDefined()
    })

    it('hides load more when type filter is not "all"', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 50,
        unread: 10,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Load more (4 of 50)')).toBeDefined()
      })

      // Click a type filter — load more should disappear because
      // hasMore && typeFilter === 'all' is the condition
      fireEvent.click(screen.getByText('PRs'))

      await waitFor(() => {
        expect(screen.queryByText(/Load more/)).toBeNull()
      })
    })

    it('shows loading state on Load more button while fetching', async () => {
      let resolveSecond: (value: unknown) => void
      const secondCallPromise = new Promise((resolve) => {
        resolveSecond = resolve
      })

      vi.mocked(api.getNotifications)
        .mockResolvedValueOnce({
          notifications: mockNotifications,
          total: 50,
          unread: 10,
        })
        .mockReturnValueOnce(secondCallPromise as Promise<{ notifications: api.NotificationItem[]; total: number; unread: number }>)

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Load more (4 of 50)')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Load more (4 of 50)'))

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeDefined()
      })

      // Resolve the second call
      resolveSecond!({
        notifications: [],
        total: 50,
        unread: 10,
      })

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).toBeNull()
      })
    })
  })

  describe('Type filter interactions', () => {
    it('filters to only task_started when Started is clicked', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Get the filter button "Started" (not the badge)
      const filterGroup = screen.getByRole('group', { name: 'Filter by type' })
      const startedButton = filterGroup.querySelector('button[aria-pressed]')!
      // Find the Started button in the filter group
      const buttons = filterGroup.querySelectorAll('button')
      let startedFilterButton: HTMLElement | null = null
      buttons.forEach(btn => {
        if (btn.textContent === 'Started') startedFilterButton = btn
      })
      fireEvent.click(startedFilterButton!)

      await waitFor(() => {
        // Only task_started should be visible
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
        // Others should be hidden
        expect(screen.queryByText('Shipped: Fix navbar overflow')).toBeNull()
        expect(screen.queryByText('PR created: Update README')).toBeNull()
        expect(screen.queryByText('Incomplete: Refactor auth module')).toBeNull()
      })
    })

    it('filters to only pr_created when PRs is clicked', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('PR created: Update README')).toBeDefined()
      })

      fireEvent.click(screen.getByText('PRs'))

      await waitFor(() => {
        expect(screen.getByText('PR created: Update README')).toBeDefined()
        expect(screen.queryByText('Building: Add dark mode')).toBeNull()
        expect(screen.queryByText('Shipped: Fix navbar overflow')).toBeNull()
      })
    })
  })

  describe('Read filter interactions', () => {
    it('filters to unread when Unread button is clicked', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Click "Unread" read filter
      fireEvent.click(screen.getByText('Unread'))

      // getNotifications should be called again with unread_only=true
      await waitFor(() => {
        expect(api.getNotifications).toHaveBeenLastCalledWith(
          expect.objectContaining({ unread_only: true })
        )
      })
    })

    it('filters to read-only when Read button is clicked', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Click "Read" read filter
      fireEvent.click(screen.getByText('Read'))

      // Client-side filtering: only read notifications should appear
      await waitFor(() => {
        // n2 (read) and n4 (read) should be visible
        expect(screen.getByText('Shipped: Fix navbar overflow')).toBeDefined()
        expect(screen.getByText('Incomplete: Refactor auth module')).toBeDefined()
        // n1 (unread) and n3 (unread) should be hidden
        expect(screen.queryByText('Building: Add dark mode')).toBeNull()
        expect(screen.queryByText('PR created: Update README')).toBeNull()
      })
    })
  })

  describe('Notification row interactions', () => {
    it('marks notification as read and navigates on internal link click', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Click the notification row (n1 has internal link /bloom-base/genesis)
      fireEvent.click(screen.getByText('Building: Add dark mode'))

      await waitFor(() => {
        expect(api.markNotificationRead).toHaveBeenCalledWith('n1')
        expect(mockPush).toHaveBeenCalledWith('/bloom-base/genesis')
      })
    })

    it('marks single notification as read via dot button', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Find mark-as-read buttons (the dot buttons)
      const markReadButtons = screen.getAllByTitle('Mark as read')
      expect(markReadButtons.length).toBe(2) // n1 and n3 are unread

      // Click the first one (for n1)
      fireEvent.click(markReadButtons[0])

      await waitFor(() => {
        expect(api.markNotificationRead).toHaveBeenCalledWith('n1')
      })
    })
  })

  describe('Error retry', () => {
    it('retries loading when Try again is clicked', async () => {
      vi.mocked(api.getNotifications)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          notifications: mockNotifications,
          total: 4,
          unread: 2,
        })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load notifications')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Try again'))

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      expect(api.getNotifications).toHaveBeenCalledTimes(2)
    })
  })

  describe('Mark all read updates UI', () => {
    it('updates all notifications to read state after mark all read', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Mark all as read')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Mark all as read'))

      await waitFor(() => {
        // Should show "All caught up" after marking all read
        expect(screen.getByText('All caught up')).toBeDefined()
        // Mark all as read button should disappear
        expect(screen.queryByText('Mark all as read')).toBeNull()
      })
    })

    it('removes individual mark-as-read dot buttons after mark all read', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getAllByTitle('Mark as read').length).toBe(2)
      })

      fireEvent.click(screen.getByText('Mark all as read'))

      await waitFor(() => {
        expect(screen.queryAllByTitle('Mark as read').length).toBe(0)
      })
    })
  })

  describe('Notification row click — external and null links', () => {
    it('opens external link in new tab via window.open', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('PR created: Update README')).toBeDefined()
      })

      // n3 has an external link (https://github.com/...)
      fireEvent.click(screen.getByText('PR created: Update README'))

      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith(
          'https://github.com/bloom-base/genesis/pull/42',
          '_blank',
          'noopener,noreferrer'
        )
      })

      // Should also mark as read since n3 is unread
      await waitFor(() => {
        expect(api.markNotificationRead).toHaveBeenCalledWith('n3')
      })

      openSpy.mockRestore()
    })

    it('does not navigate when notification has no link', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Incomplete: Refactor auth module')).toBeDefined()
      })

      // n4 has link: null and is_read: true
      fireEvent.click(screen.getByText('Incomplete: Refactor auth module'))

      // Should not navigate at all
      expect(mockPush).not.toHaveBeenCalled()
      expect(openSpy).not.toHaveBeenCalled()

      openSpy.mockRestore()
    })

    it('does not call markNotificationRead when clicking already-read notification', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Shipped: Fix navbar overflow')).toBeDefined()
      })

      // n2 is already read with internal link
      fireEvent.click(screen.getByText('Shipped: Fix navbar overflow'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/bloom-base/arcade')
      })

      // Should NOT call markNotificationRead since it's already read
      expect(api.markNotificationRead).not.toHaveBeenCalled()
    })
  })

  describe('Per-notification mark read — UI updates', () => {
    it('decrements unread count after marking single notification as read', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('2 unread notifications')).toBeDefined()
      })

      const markReadButtons = screen.getAllByTitle('Mark as read')
      fireEvent.click(markReadButtons[0])

      await waitFor(() => {
        expect(screen.getByText('1 unread notification')).toBeDefined()
      })
    })

    it('shows "All caught up" after marking last unread notification as read', async () => {
      const oneUnread: api.NotificationItem[] = [
        {
          id: 'n1',
          type: 'task_started',
          title: 'Building: Add dark mode',
          body: 'The agent is working on your idea',
          link: '/bloom-base/genesis',
          is_read: false,
          project_id: 'p1',
          task_id: 't1',
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ]

      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: oneUnread,
        total: 1,
        unread: 1,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('1 unread notification')).toBeDefined()
      })

      fireEvent.click(screen.getByTitle('Mark as read'))

      await waitFor(() => {
        expect(screen.getByText('All caught up')).toBeDefined()
      })
    })
  })

  describe('Type filter — additional types', () => {
    it('filters to only task_completed when Shipped is clicked', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      const filterGroup = screen.getByRole('group', { name: 'Filter by type' })
      const buttons = filterGroup.querySelectorAll('button')
      let shippedButton: HTMLElement | null = null
      buttons.forEach(btn => {
        if (btn.textContent === 'Shipped') shippedButton = btn
      })
      fireEvent.click(shippedButton!)

      await waitFor(() => {
        expect(screen.getByText('Shipped: Fix navbar overflow')).toBeDefined()
        expect(screen.queryByText('Building: Add dark mode')).toBeNull()
        expect(screen.queryByText('PR created: Update README')).toBeNull()
        expect(screen.queryByText('Incomplete: Refactor auth module')).toBeNull()
      })
    })

    it('filters to only task_incomplete when Incomplete is clicked', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Incomplete: Refactor auth module')).toBeDefined()
      })

      const filterGroup = screen.getByRole('group', { name: 'Filter by type' })
      const buttons = filterGroup.querySelectorAll('button')
      let incompleteButton: HTMLElement | null = null
      buttons.forEach(btn => {
        if (btn.textContent === 'Incomplete') incompleteButton = btn
      })
      fireEvent.click(incompleteButton!)

      await waitFor(() => {
        expect(screen.getByText('Incomplete: Refactor auth module')).toBeDefined()
        expect(screen.queryByText('Building: Add dark mode')).toBeNull()
        expect(screen.queryByText('Shipped: Fix navbar overflow')).toBeNull()
        expect(screen.queryByText('PR created: Update README')).toBeNull()
      })
    })

    it('shows all notifications again when All is clicked after filtering', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // First filter to PRs
      fireEvent.click(screen.getByText('PRs'))

      await waitFor(() => {
        expect(screen.queryByText('Building: Add dark mode')).toBeNull()
      })

      // Now click All to reset
      const filterGroup = screen.getByRole('group', { name: 'Filter by type' })
      const buttons = filterGroup.querySelectorAll('button')
      let allButton: HTMLElement | null = null
      buttons.forEach(btn => {
        if (btn.textContent === 'All') allButton = btn
      })
      fireEvent.click(allButton!)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
        expect(screen.getByText('Shipped: Fix navbar overflow')).toBeDefined()
        expect(screen.getByText('PR created: Update README')).toBeDefined()
        expect(screen.getByText('Incomplete: Refactor auth module')).toBeDefined()
      })
    })
  })

  describe('Read filter — reset to All', () => {
    it('shows all notifications when All is clicked after Unread filter', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Filter to Unread
      fireEvent.click(screen.getByText('Unread'))

      await waitFor(() => {
        expect(api.getNotifications).toHaveBeenLastCalledWith(
          expect.objectContaining({ unread_only: true })
        )
      })

      // Click All in the read filter group
      const readFilterGroup = screen.getByRole('group', { name: 'Filter by read status' })
      const buttons = readFilterGroup.querySelectorAll('button')
      let allButton: HTMLElement | null = null
      buttons.forEach(btn => {
        if (btn.textContent === 'All') allButton = btn
      })
      fireEvent.click(allButton!)

      // Should re-fetch without unread_only
      await waitFor(() => {
        expect(api.getNotifications).toHaveBeenLastCalledWith(
          expect.objectContaining({ unread_only: false })
        )
      })
    })

    it('shows all notifications when All is clicked after Read filter', async () => {
      vi.mocked(api.getNotifications).mockResolvedValue({
        notifications: mockNotifications,
        total: 4,
        unread: 2,
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Filter to Read — client-side filter, hides unread
      fireEvent.click(screen.getByText('Read'))

      await waitFor(() => {
        expect(screen.queryByText('Building: Add dark mode')).toBeNull()
      })

      // Click All in the read filter group
      const readFilterGroup = screen.getByRole('group', { name: 'Filter by read status' })
      const buttons = readFilterGroup.querySelectorAll('button')
      let allButton: HTMLElement | null = null
      buttons.forEach(btn => {
        if (btn.textContent === 'All') allButton = btn
      })
      fireEvent.click(allButton!)

      await waitFor(() => {
        // All notifications should be visible again
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
        expect(screen.getByText('Shipped: Fix navbar overflow')).toBeDefined()
      })
    })
  })

  describe('Combined type + read filters with clear', () => {
    it('clears both type and read filters when both are active', async () => {
      // Initial fetch returns all notifications
      // When readFilter changes to 'unread', useEffect refetches with unread_only: true
      // That refetch returns only unread notifications (n1, n3)
      // Type filter is Shipped — neither n1 nor n3 is task_completed → empty → Clear filters
      const unreadOnly = mockNotifications.filter(n => !n.is_read)

      vi.mocked(api.getNotifications)
        .mockResolvedValueOnce({
          notifications: mockNotifications,
          total: 4,
          unread: 2,
        })
        .mockResolvedValueOnce({
          notifications: unreadOnly,
          total: 2,
          unread: 2,
        })
        .mockResolvedValueOnce({
          notifications: mockNotifications,
          total: 4,
          unread: 2,
        })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
      })

      // Apply type filter: Shipped (client-side, only n2 which is read)
      const filterGroup = screen.getByRole('group', { name: 'Filter by type' })
      const buttons = filterGroup.querySelectorAll('button')
      let shippedButton: HTMLElement | null = null
      buttons.forEach(btn => {
        if (btn.textContent === 'Shipped') shippedButton = btn
      })
      fireEvent.click(shippedButton!)

      await waitFor(() => {
        // With Shipped filter, only n2 should show
        expect(screen.getByText('Shipped: Fix navbar overflow')).toBeDefined()
        expect(screen.queryByText('Building: Add dark mode')).toBeNull()
      })

      // Apply read filter: Unread — triggers refetch with unread_only: true
      // The refetch returns only unread (n1, n3), but type=Shipped filters to none
      fireEvent.click(screen.getByText('Unread'))

      await waitFor(() => {
        expect(screen.getByText('Clear filters')).toBeDefined()
      })

      // Click Clear filters — should reset both type and read to 'all'
      fireEvent.click(screen.getByText('Clear filters'))

      // readFilter back to 'all' triggers another refetch (3rd mock)
      await waitFor(() => {
        expect(screen.getByText('Building: Add dark mode')).toBeDefined()
        expect(screen.getByText('Shipped: Fix navbar overflow')).toBeDefined()
        expect(screen.getByText('PR created: Update README')).toBeDefined()
        expect(screen.getByText('Incomplete: Refactor auth module')).toBeDefined()
      })
    })
  })

  describe('Load more — button text updates', () => {
    it('updates count in load more button after loading additional notifications', async () => {
      const moreNotifications: api.NotificationItem[] = [
        {
          id: 'n5',
          type: 'task_completed',
          title: 'Shipped: Add search feature',
          body: 'Search is live',
          link: '/bloom-base/genesis',
          is_read: true,
          project_id: 'p1',
          task_id: 't5',
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: 'n6',
          type: 'task_started',
          title: 'Building: Add notifications',
          body: 'Working on it',
          link: '/bloom-base/arcade',
          is_read: false,
          project_id: 'p2',
          task_id: 't6',
          created_at: new Date(Date.now() - 259200000).toISOString(),
        },
      ]

      vi.mocked(api.getNotifications)
        .mockResolvedValueOnce({
          notifications: mockNotifications,
          total: 50,
          unread: 10,
        })
        .mockResolvedValueOnce({
          notifications: moreNotifications,
          total: 50,
          unread: 10,
        })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Load more (4 of 50)')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Load more (4 of 50)'))

      // After appending 2 more, should show 6 of 50
      await waitFor(() => {
        expect(screen.getByText('Load more (6 of 50)')).toBeDefined()
      })

      // Both new notifications should be visible
      expect(screen.getByText('Shipped: Add search feature')).toBeDefined()
      expect(screen.getByText('Building: Add notifications')).toBeDefined()
    })

    it('hides load more button when all notifications have been loaded', async () => {
      const oneMore: api.NotificationItem[] = [
        {
          id: 'n5',
          type: 'task_completed',
          title: 'Shipped: Add search feature',
          body: 'Search is live',
          link: '/bloom-base/genesis',
          is_read: true,
          project_id: 'p1',
          task_id: 't5',
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
      ]

      vi.mocked(api.getNotifications)
        .mockResolvedValueOnce({
          notifications: mockNotifications,
          total: 5,
          unread: 2,
        })
        .mockResolvedValueOnce({
          notifications: oneMore,
          total: 5,
          unread: 2,
        })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Load more (4 of 5)')).toBeDefined()
      })

      fireEvent.click(screen.getByText('Load more (4 of 5)'))

      // After loading 1 more, total is 5 and we have 5 — load more should disappear
      await waitFor(() => {
        expect(screen.queryByText(/Load more/)).toBeNull()
      })

      // The loaded notification should be visible
      expect(screen.getByText('Shipped: Add search feature')).toBeDefined()
    })
  })
})
