'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/lib/api'
import { timeAgo } from '@/lib/utils'

function notificationIcon(type: NotificationItem['type']): string {
  switch (type) {
    case 'task_started':
      return '\u25B6' // play
    case 'pr_created':
      return '\u2192' // arrow
    case 'task_completed':
      return '\u2713' // check
    case 'task_incomplete':
      return '\u25CB' // circle
    case 'task_accepted':
      return '\u2713' // check
    case 'task_rejected':
      return '\u2715' // x
    default:
      return '\u25CF' // dot
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
      return 'text-gray-400 dark:text-gray-500'
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const { count } = await getUnreadNotificationCount()
      setUnreadCount(count)
    } catch {
      // Silently fail — user may not be logged in
    }
  }, [])

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount()
    pollingRef.current = setInterval(fetchUnreadCount, 30000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchUnreadCount])

  // Load notifications when dropdown opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    getNotifications({ limit: 20 })
      .then((res) => {
        setNotifications(res.notifications)
        setUnreadCount(res.unread)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-medium text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-gray-900/50 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center">
                <div className="inline-block w-5 h-5 border-2 border-gray-200 dark:border-gray-700 border-t-gray-500 dark:border-t-gray-400 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((n) => {
                  const inner = (
                    <div
                      className={`flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
                        !n.is_read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                      onClick={() => {
                        if (!n.is_read) handleMarkRead(n.id)
                        setOpen(false)
                      }}
                    >
                      <span className={`mt-0.5 text-sm font-mono ${notificationColor(n.type)}`}>
                        {notificationIcon(n.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-tight ${!n.is_read ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {n.body}
                        </p>
                        <p className="text-xs text-gray-300 dark:text-gray-600 mt-1 font-mono tabular-nums">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  )

                  if (!n.link) return <div key={n.id}>{inner}</div>

                  const isExternal = n.link.startsWith('http')
                  return isExternal ? (
                    <a key={n.id} href={n.link} target="_blank" rel="noopener noreferrer">
                      {inner}
                    </a>
                  ) : (
                    <Link key={n.id} href={n.link}>
                      {inner}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer — View all link */}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-100 dark:border-gray-800 transition-colors"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
