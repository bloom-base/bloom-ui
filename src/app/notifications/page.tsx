'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/lib/api'
import { timeAgo } from '@/lib/utils'

type TypeFilter = 'all' | 'task_started' | 'pr_created' | 'task_completed' | 'task_incomplete'
type ReadFilter = 'all' | 'unread' | 'read'

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'All',
  task_started: 'Started',
  pr_created: 'PRs',
  task_completed: 'Shipped',
  task_incomplete: 'Incomplete',
}

function notificationIcon(type: NotificationItem['type']): string {
  switch (type) {
    case 'task_started':
      return '\u25B6'
    case 'pr_created':
      return '\u2192'
    case 'task_completed':
      return '\u2713'
    case 'task_incomplete':
      return '\u25CB'
    case 'task_accepted':
      return '\u2713'
    case 'task_rejected':
      return '\u2715'
    default:
      return '\u25CF'
  }
}

function notificationColor(type: NotificationItem['type']): string {
  switch (type) {
    case 'task_started':
      return 'text-blue-500'
    case 'pr_created':
      return 'text-violet-500'
    case 'task_completed':
      return 'text-green-500'
    case 'task_incomplete':
      return 'text-amber-500'
    case 'task_accepted':
      return 'text-green-500'
    case 'task_rejected':
      return 'text-red-500'
    default:
      return 'text-gray-400'
  }
}

function notificationTypeBadge(type: NotificationItem['type']): string {
  switch (type) {
    case 'task_started':
      return 'bg-blue-50 text-blue-600'
    case 'pr_created':
      return 'bg-violet-50 text-violet-600'
    case 'task_completed':
      return 'bg-green-50 text-green-600'
    case 'task_incomplete':
      return 'bg-amber-50 text-amber-600'
    case 'task_accepted':
      return 'bg-green-50 text-green-600'
    case 'task_rejected':
      return 'bg-red-50 text-red-600'
    default:
      return 'bg-gray-50 text-gray-600'
  }
}

function notificationTypeLabel(type: NotificationItem['type']): string {
  switch (type) {
    case 'task_started':
      return 'Started'
    case 'pr_created':
      return 'PR Created'
    case 'task_completed':
      return 'Shipped'
    case 'task_incomplete':
      return 'Incomplete'
    case 'task_accepted':
      return 'Accepted'
    case 'task_rejected':
      return 'Rejected'
    default:
      return type
  }
}

const PAGE_SIZE = 30

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [readFilter, setReadFilter] = useState<ReadFilter>('all')

  const fetchNotifications = useCallback(async (offset = 0, append = false) => {
    try {
      if (offset === 0) setLoading(true)
      else setLoadingMore(true)

      const res = await getNotifications({
        limit: PAGE_SIZE,
        offset,
        unread_only: readFilter === 'unread',
      })

      if (append) {
        setNotifications((prev) => [...prev, ...res.notifications])
      } else {
        setNotifications(res.notifications)
      }
      setTotal(res.total)
      setUnreadCount(res.unread)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [readFilter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id).catch(() => {})
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead().catch(() => {})
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  // Client-side type filtering (backend only supports unread_only)
  const filtered = typeFilter === 'all'
    ? notifications
    : notifications.filter((n) => n.type === typeFilter)

  // Additional read/unread filter for "read" (backend handles "unread")
  const displayed = readFilter === 'read'
    ? filtered.filter((n) => n.is_read)
    : filtered

  const hasMore = notifications.length < total

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="mb-10">
            <div className="h-9 w-48 bg-gray-100 rounded-lg animate-pulse mb-3" />
            <div className="h-5 w-64 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl border border-gray-100 bg-gray-50 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-gray-500">Failed to load notifications</p>
          <p className="text-sm text-gray-400 mt-1">{error}</p>
          <button
            onClick={() => {
              setError(null)
              fetchNotifications()
            }}
            className="mt-4 text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">
              Notifications
            </h1>
            <p className="text-gray-500">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          {/* Type filter */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit" role="group" aria-label="Filter by type">
            {(Object.entries(TYPE_LABELS) as [TypeFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                aria-pressed={typeFilter === key}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  typeFilter === key
                    ? 'bg-white text-gray-900 font-medium shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Read filter */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit sm:ml-auto" role="group" aria-label="Filter by read status">
            {([['all', 'All'], ['unread', 'Unread'], ['read', 'Read']] as [ReadFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setReadFilter(key)}
                aria-pressed={readFilter === key}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  readFilter === key
                    ? 'bg-white text-gray-900 font-medium shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification list */}
        {displayed.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
            {notifications.length === 0 ? (
              <>
                <svg className="mx-auto w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                <p className="text-gray-500">No notifications yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  You&apos;ll be notified when your ideas are picked up by agents.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500">
                  No {readFilter !== 'all' ? readFilter : ''}{' '}
                  {typeFilter !== 'all' ? TYPE_LABELS[typeFilter].toLowerCase() : ''}{' '}
                  notifications
                </p>
                <button
                  onClick={() => {
                    setTypeFilter('all')
                    setReadFilter('all')
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 mt-2 underline underline-offset-2"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {displayed.map((n) => {
              const inner = (
                <div
                  className={`flex gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    !n.is_read ? 'bg-blue-50/30' : ''
                  }`}
                  onClick={() => {
                    if (!n.is_read) handleMarkRead(n.id)
                    if (n.link) {
                      const isExternal = n.link.startsWith('http')
                      if (isExternal) {
                        window.open(n.link, '_blank', 'noopener,noreferrer')
                      } else {
                        router.push(n.link)
                      }
                    }
                  }}
                >
                  {/* Icon */}
                  <span className={`mt-0.5 text-base font-mono flex-shrink-0 ${notificationColor(n.type)}`}>
                    {notificationIcon(n.type)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className={`text-sm leading-snug ${!n.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {n.title}
                      </p>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded ${notificationTypeBadge(n.type)}`}>
                        {notificationTypeLabel(n.type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 font-mono tabular-nums">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>

                  {/* Unread dot + action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.is_read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkRead(n.id)
                        }}
                        className="p-1 rounded hover:bg-gray-200 transition-colors group"
                        title="Mark as read"
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-500 block group-hover:bg-blue-600" />
                      </button>
                    )}
                    {n.link && (
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    )}
                  </div>
                </div>
              )

              return <div key={n.id}>{inner}</div>
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && typeFilter === 'all' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => fetchNotifications(notifications.length, true)}
              disabled={loadingMore}
              className="px-5 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                `Load more (${notifications.length} of ${total})`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
