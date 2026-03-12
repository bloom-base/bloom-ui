import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/api', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

import { NotificationBell } from './NotificationBell'
import * as api from '@/lib/api'

function makeNotification(overrides: Partial<{
  id: string
  type: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}> = {}) {
  return {
    id: 'n-1',
    type: 'task_completed',
    title: 'Task shipped: Add dark mode',
    body: 'genesis',
    link: '/bloom-base/genesis',
    is_read: false,
    created_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({ count: 0 })
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [],
      unread: 0,
    } as any)
  })

  it('renders bell button', () => {
    render(<NotificationBell />)

    expect(screen.getByRole('button', { name: /Notifications/i })).toBeInTheDocument()
  })

  it('shows unread badge when count > 0', async () => {
    vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({ count: 5 })

    render(<NotificationBell />)

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
  })

  it('shows 99+ when count exceeds 99', async () => {
    vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({ count: 150 })

    render(<NotificationBell />)

    await waitFor(() => {
      expect(screen.getByText('99+')).toBeInTheDocument()
    })
  })

  it('opens dropdown on click', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [],
      unread: 0,
    } as any)

    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })
  })

  it('shows empty state in dropdown', async () => {
    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('No notifications yet')).toBeInTheDocument()
    })
  })

  it('shows notifications in dropdown', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [
        makeNotification(),
      ],
      unread: 1,
    } as any)

    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Task shipped: Add dark mode')).toBeInTheDocument()
    })
  })

  it('shows View all notifications link', async () => {
    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('View all notifications')).toBeInTheDocument()
    })
  })

  it('shows mark all read button when unread > 0', async () => {
    vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({ count: 3 })
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [
        makeNotification({ id: 'n-1', title: 'Task completed', body: 'Done', link: null, is_read: false }),
      ],
      unread: 3,
    } as any)

    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument()
    })
  })

  // ====================================================
  // handleMarkAllRead click
  // ====================================================

  it('calls markAllNotificationsRead and marks all as read when "Mark all read" is clicked', async () => {
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue(undefined as any)
    vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({ count: 2 })
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [
        makeNotification({ id: 'n-1', title: 'First notification', is_read: false }),
        makeNotification({ id: 'n-2', title: 'Second notification', is_read: false }),
      ],
      unread: 2,
    } as any)

    render(<NotificationBell />)

    // Wait for unread count to appear
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument()
    })

    // Click mark all read
    fireEvent.click(screen.getByText('Mark all read'))

    await waitFor(() => {
      expect(api.markAllNotificationsRead).toHaveBeenCalledTimes(1)
    })

    // After marking all read, the "Mark all read" button should disappear (unreadCount becomes 0)
    await waitFor(() => {
      expect(screen.queryByText('Mark all read')).not.toBeInTheDocument()
    })
  })

  // ====================================================
  // notification row onClick — marks as read + closes
  // ====================================================

  it('marks unread notification as read and closes dropdown when notification row is clicked', async () => {
    vi.mocked(api.markNotificationRead).mockResolvedValue(undefined as any)
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [
        makeNotification({ id: 'n-1', title: 'Click me', is_read: false, link: '/bloom-base/genesis' }),
      ],
      unread: 1,
    } as any)
    vi.mocked(api.getUnreadNotificationCount).mockResolvedValue({ count: 1 })

    render(<NotificationBell />)

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    // Click the notification row
    fireEvent.click(screen.getByText('Click me'))

    // Should mark it as read
    await waitFor(() => {
      expect(api.markNotificationRead).toHaveBeenCalledWith('n-1')
    })

    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
    })
  })

  it('does not call markNotificationRead for already-read notifications', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [
        makeNotification({ id: 'n-1', title: 'Already read', is_read: true, link: '/some/path' }),
      ],
      unread: 0,
    } as any)

    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Already read')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Already read'))

    // Should NOT call markNotificationRead since it's already read
    expect(api.markNotificationRead).not.toHaveBeenCalled()

    // But dropdown should still close
    await waitFor(() => {
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
    })
  })

  it('notification with link renders as a link element', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [
        makeNotification({ id: 'n-1', title: 'With link', link: '/bloom-base/genesis', is_read: true }),
      ],
      unread: 0,
    } as any)

    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('With link')).toBeInTheDocument()
    })

    // The notification with an internal link should be wrapped in a Link (rendered as <a>)
    const linkEl = screen.getByText('With link').closest('a')
    expect(linkEl).not.toBeNull()
    expect(linkEl!.getAttribute('href')).toBe('/bloom-base/genesis')
  })

  it('notification with external link renders with target=_blank', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [
        makeNotification({ id: 'n-ext', title: 'External', link: 'https://github.com/bloom-base/genesis/pull/1', is_read: true }),
      ],
      unread: 0,
    } as any)

    render(<NotificationBell />)

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('External')).toBeInTheDocument()
    })

    const linkEl = screen.getByText('External').closest('a')
    expect(linkEl).not.toBeNull()
    expect(linkEl!.getAttribute('href')).toBe('https://github.com/bloom-base/genesis/pull/1')
    expect(linkEl!.getAttribute('target')).toBe('_blank')
  })

  // ====================================================
  // Outside click closes dropdown
  // ====================================================

  it('closes dropdown when clicking outside', async () => {
    render(<NotificationBell />)

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    // Click outside (on document body)
    fireEvent.mouseDown(document.body)

    await waitFor(() => {
      expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument()
    })
  })

  it('does not close dropdown when clicking inside it', async () => {
    vi.mocked(api.getNotifications).mockResolvedValue({
      notifications: [
        makeNotification({ id: 'n-1', title: 'Stay open', is_read: true, link: null }),
      ],
      unread: 0,
    } as any)

    render(<NotificationBell />)

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Stay open')).toBeInTheDocument()
    })

    // Click inside the dropdown (on the header)
    fireEvent.mouseDown(screen.getByText('Notifications'))

    // Dropdown should still be visible
    expect(screen.getByText('Stay open')).toBeInTheDocument()
  })

  // ====================================================
  // Escape key closes dropdown
  // ====================================================

  it('closes dropdown when Escape key is pressed', async () => {
    render(<NotificationBell />)

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument()
    })
  })

  it('does not close dropdown for non-Escape keys', async () => {
    render(<NotificationBell />)

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    // Press a random key
    fireEvent.keyDown(document, { key: 'a' })

    // Dropdown should still be open
    expect(screen.getByText('Notifications')).toBeInTheDocument()
  })

  // ====================================================
  // Toggle behavior — clicking bell again closes dropdown
  // ====================================================

  it('closes dropdown when bell button is clicked a second time', async () => {
    render(<NotificationBell />)

    const bellButton = screen.getByRole('button', { name: /Notifications/i })

    // Open
    fireEvent.click(bellButton)
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    // Close by clicking again
    fireEvent.click(bellButton)
    await waitFor(() => {
      expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument()
    })
  })
})
